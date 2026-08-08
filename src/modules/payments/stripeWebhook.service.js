import mongoose from 'mongoose';
import { stripeConfig } from '../../config/stripe.js';
import { ApiError } from '../../core/errors/ApiError.js';
import { logger } from '../../utils/logger.js';
import { Invoice } from '../invoices/invoice.model.js';
import { Transaction } from './transaction.model.js';
import { WebhookEvent } from './webhookEvent.model.js';
import {
  STRIPE_CHECKOUT_COMPLETED_EVENT,
  WEBHOOK_CONFIRMABLE_INVOICE_STATUSES,
} from './payment.constants.js';
import { extractStripeId } from './payment.service.js';
import { recordPaymentSucceededAudit } from './paymentAudit.service.js';
import { createReceiptForInvoice } from './receipt.service.js';

const toStripeMinorUnits = (amount) => Math.round(Number(amount) * 100);

const safeErrorMessage = (error) => {
  if (error instanceof ApiError) return error.message;
  return 'Webhook processing failed.';
};

const assertEventMode = (event) => {
  const expectedLiveMode = stripeConfig.mode === 'live';
  if (event.livemode !== expectedLiveMode) {
    throw new ApiError(400, 'Stripe event mode does not match server configuration.');
  }
};

const acquireWebhookEvent = async (event) => {
  const stripeObject = event.data?.object || {};

  try {
    const record = await WebhookEvent.create({
      eventId: event.id,
      eventType: event.type,
      status: 'processing',
      stripeObjectId: stripeObject.id || null,
      stripeObjectType: stripeObject.object || null,
      stripeCreatedAt: event.created ? new Date(event.created * 1000) : null,
    });

    return { record, duplicate: false };
  } catch (error) {
    if (error.code !== 11000) throw error;

    const existing = await WebhookEvent.findOne({ eventId: event.id });

    if (!existing) {
      throw error;
    }

    if (existing.status === 'failed') {
      existing.status = 'processing';
      existing.errorMessage = null;
      existing.attempts += 1;
      await existing.save();
      return { record: existing, duplicate: false };
    }

    return { record: existing, duplicate: true };
  }
};

const validateCheckoutMetadata = (session) => {
  const metadata = session.metadata || {};
  const { invoiceId, clientId, invoiceNumber, currency, amount } = metadata;

  if (!mongoose.Types.ObjectId.isValid(invoiceId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new ApiError(400, 'Stripe Checkout Session metadata is malformed.');
  }

  if (!invoiceNumber || !currency || !amount) {
    throw new ApiError(400, 'Stripe Checkout Session metadata is incomplete.');
  }

  return {
    invoiceId,
    clientId,
    invoiceNumber,
    currency,
    amount: Number(amount),
  };
};

const assertStripeSessionMatchesInvoice = ({ session, invoice, metadata }) => {
  const expectedAmount = toStripeMinorUnits(invoice.total);
  const sessionAmount = Number(session.amount_total);
  const sessionCurrency = session.currency?.toUpperCase();

  if (sessionAmount !== expectedAmount || metadata.amount !== expectedAmount) {
    throw new ApiError(409, 'Stripe payment amount does not match the invoice total.');
  }

  if (sessionCurrency !== invoice.currency || metadata.currency !== invoice.currency) {
    throw new ApiError(409, 'Stripe payment currency does not match the invoice currency.');
  }

  if (metadata.invoiceNumber !== invoice.invoiceNumber) {
    throw new ApiError(409, 'Stripe payment metadata does not match the invoice.');
  }
};

const upsertPaymentTransaction = async ({
  invoice,
  previousStatus,
  webhookEventId,
  paymentIntentId,
  checkoutSessionId,
  customerId,
  paidAt,
  session,
}) => {
  return Transaction.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntentId },
    {
      $setOnInsert: {
        invoiceId: invoice._id,
        clientId: invoice.clientId,
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionId: checkoutSessionId,
        stripeCustomerId: customerId,
        webhookEventId,
        amount: invoice.total,
        currency: invoice.currency,
        status: 'succeeded',
        previousInvoiceStatus: previousStatus,
        newInvoiceStatus: 'paid',
        paymentSource: 'stripe_webhook',
        paidAt,
        metadata: {
          stripePaymentStatus: session.payment_status,
          stripeCheckoutStatus: session.status,
          stripeAmountTotal: String(session.amount_total),
          stripeCurrency: session.currency,
        },
      },
    },
    { new: true, upsert: true }
  );
};

const ensurePaymentSideEffects = async ({
  invoice,
  previousStatus,
  webhookEventId,
  paymentIntentId,
  checkoutSessionId,
  customerId,
  paidAt,
  session,
}) => {
  const transaction = await upsertPaymentTransaction({
    invoice,
    previousStatus,
    webhookEventId,
    paymentIntentId,
    checkoutSessionId,
    customerId,
    paidAt,
    session,
  });

  await recordPaymentSucceededAudit({
    invoice,
    previousStatus,
    transactionId: transaction._id,
    webhookEventId,
    paymentIntentId,
    checkoutSessionId,
    customerId,
    paidAt,
  });

  return transaction;
};

const handleCheckoutSessionCompleted = async (event) => {
  const session = event.data.object;

  if (session.payment_status !== 'paid') {
    logger.warn(
      `Ignoring checkout.session.completed ${event.id} because payment_status=${session.payment_status}`
    );
    return { ignored: true, reason: 'Checkout Session is not paid.' };
  }

  const paymentIntentId = extractStripeId(session.payment_intent);
  if (!paymentIntentId) {
    throw new ApiError(400, 'Stripe Checkout Session is missing a payment intent.');
  }

  const checkoutSessionId = session.id;
  const customerId = extractStripeId(session.customer);
  const paidAt = event.created ? new Date(event.created * 1000) : new Date();
  const metadata = validateCheckoutMetadata(session);

  const invoice = await Invoice.findOne({
    _id: metadata.invoiceId,
    clientId: metadata.clientId,
  });

  if (!invoice) {
    throw new ApiError(404, 'Invoice referenced by Stripe event was not found.');
  }

  assertStripeSessionMatchesInvoice({ session, invoice, metadata });

  if (invoice.status === 'paid') {
    if (
      invoice.stripePaymentIntentId === paymentIntentId ||
      invoice.stripeSessionId === checkoutSessionId
    ) {
      const existingTransaction = await Transaction.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (!existingTransaction || existingTransaction.webhookEventId === event.id) {
        await ensurePaymentSideEffects({
          invoice,
          previousStatus: existingTransaction?.previousInvoiceStatus || 'paid',
          webhookEventId: event.id,
          paymentIntentId,
          checkoutSessionId,
          customerId,
          paidAt: invoice.paidAt || paidAt,
          session,
        });
      }

      return {
        duplicate: true,
        invoiceId: invoice._id,
        message: 'Invoice was already marked paid for this Stripe payment.',
      };
    }

    throw new ApiError(409, 'Invoice is already paid by a different payment.');
  }

  if (!WEBHOOK_CONFIRMABLE_INVOICE_STATUSES.includes(invoice.status)) {
    throw new ApiError(409, `Invoice status '${invoice.status}' cannot be confirmed as paid.`);
  }

  const previousStatus = invoice.status;
  const updatedInvoice = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      clientId: invoice.clientId,
      status: { $in: WEBHOOK_CONFIRMABLE_INVOICE_STATUSES },
    },
    {
      $set: {
        status: 'paid',
        paidAt,
        stripeSessionId: checkoutSessionId,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        checkoutSessionExpiresAt: null,
      },
    },
    { new: true }
  );

  if (!updatedInvoice) {
    const latestInvoice = await Invoice.findById(invoice._id);
    if (latestInvoice?.status === 'paid') {
      return {
        duplicate: true,
        invoiceId: latestInvoice._id,
        message: 'Invoice was already paid by a concurrent webhook handler.',
      };
    }

    throw new ApiError(409, 'Invoice could not be confirmed as paid.');
  }

  const transaction = await ensurePaymentSideEffects({
    invoice: updatedInvoice,
    previousStatus,
    webhookEventId: event.id,
    paymentIntentId,
    checkoutSessionId,
    customerId,
    paidAt,
    session,
  });

  const client = await mongoose.model('User').findById(updatedInvoice.clientId);
  if (client) {
    try {
      await createReceiptForInvoice({ invoice: updatedInvoice, client });
    } catch (receiptError) {
      logger.warn(`Receipt automation failed for invoice ${updatedInvoice._id}: ${receiptError.message}`);
    }
  }

  return {
    processed: true,
    invoiceId: updatedInvoice._id,
    transactionId: transaction._id,
    paidAt,
  };
};

const processStripeEventByType = async (event) => {
  switch (event.type) {
    case STRIPE_CHECKOUT_COMPLETED_EVENT:
      return handleCheckoutSessionCompleted(event);
    default:
      logger.info(`Ignoring unsupported Stripe webhook event type: ${event.type}`);
      return { ignored: true, reason: `Unhandled event type: ${event.type}` };
  }
};

export const processVerifiedStripeEvent = async (event) => {
  assertEventMode(event);

  const { record, duplicate } = await acquireWebhookEvent(event);
  if (duplicate) {
    return {
      duplicate: true,
      eventId: record.eventId,
      status: record.status,
    };
  }

  try {
    const result = await processStripeEventByType(event);
    record.status = result.ignored ? 'ignored' : 'processed';
    record.processedAt = new Date();
    record.errorMessage = null;
    await record.save();
    return result;
  } catch (error) {
    record.status = 'failed';
    record.errorMessage = safeErrorMessage(error);
    await record.save().catch((saveError) => {
      logger.error(`Unable to mark webhook event ${event.id} as failed: ${saveError.message}`);
    });
    throw error;
  }
};
