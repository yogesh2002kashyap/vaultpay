import mongoose from 'mongoose';

/**
 * Transaction Schema
 * 
 * Represents an immutable record of a payment attempt via Stripe.
 * Denormalizes clientId for easier dashboard querying.
 */
const transactionSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Transaction must be linked to an invoice'],
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Transaction must belong to a client'],
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    webhookEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['succeeded', 'failed', 'processing', 'requires_action'],
      required: true,
    },
    previousInvoiceStatus: {
      type: String,
      required: true,
    },
    newInvoiceStatus: {
      type: String,
      required: true,
    },
    paymentSource: {
      type: String,
      enum: ['stripe_webhook'],
      default: 'stripe_webhook',
    },
    paidAt: {
      type: Date,
      required: true,
    },
    metadata: {
      type: Map,
      of: String,
      description: 'Store extra raw details from Stripe webhook payload if needed'
    }
  },
  { 
    timestamps: true 
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
