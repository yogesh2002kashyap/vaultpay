import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['processing', 'processed', 'ignored', 'failed'],
      default: 'processing',
      index: true,
    },
    stripeObjectId: {
      type: String,
      default: null,
      index: true,
    },
    stripeObjectType: {
      type: String,
      default: null,
    },
    stripeCreatedAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
