import { AuditLog } from '../audit/auditLog.model.js';
import { PAYMENT_AUDIT_ACTIONS } from './payment.constants.js';

export const recordCheckoutAudit = async ({ invoice, action, sessionId, expiresAt }) => {
  await AuditLog.create({
    actorId: invoice.clientId,
    action,
    entityType: 'Invoice',
    entityId: invoice._id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      stripeCheckoutSessionId: sessionId,
      checkoutSessionExpiresAt: expiresAt,
      paymentSource: 'stripe_checkout',
    },
  });
};

export const recordPaymentSucceededAudit = async ({
  invoice,
  previousStatus,
  transactionId,
  webhookEventId,
  paymentIntentId,
  checkoutSessionId,
  customerId,
  paidAt,
}) => {
  const existingAudit = await AuditLog.findOne({
    action: PAYMENT_AUDIT_ACTIONS.PAYMENT_SUCCEEDED,
    entityType: 'Invoice',
    entityId: invoice._id,
    'metadata.webhookEventId': webhookEventId,
  });

  if (existingAudit) return existingAudit;

  return AuditLog.create({
    actorId: invoice.clientId,
    action: PAYMENT_AUDIT_ACTIONS.PAYMENT_SUCCEEDED,
    entityType: 'Invoice',
    entityId: invoice._id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      previousStatus,
      newStatus: 'paid',
      webhookEventId,
      transactionId,
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: checkoutSessionId,
      stripeCustomerId: customerId,
      paymentSource: 'stripe_webhook',
      paymentTime: paidAt,
    },
  });
};
