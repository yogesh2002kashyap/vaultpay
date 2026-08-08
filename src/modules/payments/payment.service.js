import { stripe } from '../../config/stripe.js';
import { config } from '../../config/env.js';
import { ApiError } from '../../core/errors/ApiError.js';
import { logger } from '../../utils/logger.js';
import {
  PAYABLE_INVOICE_STATUSES,
  PAYMENT_AUDIT_ACTIONS,
  RESUMABLE_INVOICE_STATUS,
} from './payment.constants.js';
import { recordCheckoutAudit } from './paymentAudit.service.js';

const CLIENT_URL = config.app.clientUrl.replace(/\/$/, '');

const toStripeMinorUnits = (amount) => Math.round(Number(amount) * 100);

const getStripeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
};

const buildCheckoutUrls = (invoice) => ({
  successUrl: `${CLIENT_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}&invoiceId=${invoice._id}`,
  cancelUrl: `${CLIENT_URL}/payments/cancel?invoiceId=${invoice._id}`,
});

const buildMetadata = ({ invoice, client, amountInMinorUnits }) => ({
  invoiceId: invoice._id.toString(),
  clientId: client._id.toString(),
  invoiceNumber: invoice.invoiceNumber,
  currency: invoice.currency,
  amount: String(amountInMinorUnits),
});

const assertInvoiceCanStartCheckout = (invoice) => {
  if (invoice.status === 'paid') {
    throw new ApiError(409, 'Invoice has already been paid.');
  }

  if (invoice.status === 'cancelled') {
    throw new ApiError(400, 'Cancelled invoices cannot be paid.');
  }

  if (invoice.status === 'draft') {
    throw new ApiError(400, 'Invoice must be issued before payment can be started.');
  }

  if (
    !PAYABLE_INVOICE_STATUSES.includes(invoice.status) &&
    invoice.status !== RESUMABLE_INVOICE_STATUS
  ) {
    throw new ApiError(400, `Invoice status '${invoice.status}' is not payable.`);
  }
};

const handleStripeApiError = (error) => {
  logger.error(
    `Stripe API error while creating checkout session: ${error.type || error.name} ${error.code || ''}`
  );

  throw new ApiError(
    error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502,
    'Unable to create payment session. Please try again later.'
  );
};

const retrieveReusableCheckoutSession = async (invoice) => {
  if (invoice.status !== RESUMABLE_INVOICE_STATUS || !invoice.stripeSessionId) {
    return null;
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(invoice.stripeSessionId);
  } catch (error) {
    handleStripeApiError(error);
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
  const isOpen = session.status === 'open';
  const isUnpaid = session.payment_status !== 'paid';
  const isUnexpired = expiresAt && expiresAt.getTime() > Date.now();

  if (isOpen && isUnpaid && isUnexpired && session.url) {
    await recordCheckoutAudit({
      invoice,
      action: PAYMENT_AUDIT_ACTIONS.CHECKOUT_SESSION_REUSED,
      sessionId: session.id,
      expiresAt,
    });

    return session;
  }

  if (session.payment_status === 'paid') {
    throw new ApiError(409, 'Payment has already been submitted and is being confirmed.');
  }

  return null;
};

export const createCheckoutSessionForInvoice = async ({ invoice, client }) => {
  assertInvoiceCanStartCheckout(invoice);

  const reusableSession = await retrieveReusableCheckoutSession(invoice);
  if (reusableSession) {
    return {
      id: reusableSession.id,
      url: reusableSession.url,
      expiresAt: reusableSession.expires_at
        ? new Date(reusableSession.expires_at * 1000)
        : invoice.checkoutSessionExpiresAt,
      reused: true,
    };
  }

  const amountInMinorUnits = toStripeMinorUnits(invoice.total);
  if (!Number.isInteger(amountInMinorUnits) || amountInMinorUnits <= 0) {
    throw new ApiError(400, 'Invoice total is invalid for payment.');
  }

  const metadata = buildMetadata({ invoice, client, amountInMinorUnits });
  const { successUrl, cancelUrl } = buildCheckoutUrls(invoice);

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: client.email,
        client_reference_id: invoice._id.toString(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              product_data: {
                name: `VaultPay Invoice ${invoice.invoiceNumber}`,
                description: `Secure payment for invoice ${invoice.invoiceNumber}`,
              },
              unit_amount: amountInMinorUnits,
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
      },
      {
        idempotencyKey: `checkout-session:${invoice._id}:${invoice.updatedAt?.getTime() || Date.now()}`,
      }
    );
  } catch (error) {
    handleStripeApiError(error);
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;

  invoice.status = RESUMABLE_INVOICE_STATUS;
  invoice.stripeSessionId = session.id;
  invoice.checkoutSessionExpiresAt = expiresAt;
  await invoice.save();

  await recordCheckoutAudit({
    invoice,
    action: PAYMENT_AUDIT_ACTIONS.CHECKOUT_SESSION_CREATED,
    sessionId: session.id,
    expiresAt,
  });

  return {
    id: session.id,
    url: session.url,
    expiresAt,
    reused: false,
  };
};

export const extractStripeId = getStripeId;
