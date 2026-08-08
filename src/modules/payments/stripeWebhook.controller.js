import { stripe, stripeConfig } from '../../config/stripe.js';
import { ApiError } from '../../core/errors/ApiError.js';
import { logger } from '../../utils/logger.js';
import { processVerifiedStripeEvent } from './stripeWebhook.service.js';

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: 'Missing Stripe webhook signature.',
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeConfig.webhookSecret);
  } catch (error) {
    logger.warn(`Rejected Stripe webhook with invalid signature: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid Stripe webhook signature.',
    });
  }

  try {
    const result = await processVerifiedStripeEvent(event);
    return res.status(200).json({
      received: true,
      eventId: event.id,
      eventType: event.type,
      ...result,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message =
      statusCode >= 500
        ? 'Unable to process Stripe webhook.'
        : error.message || 'Stripe webhook was rejected.';

    logger.error(`Stripe webhook ${event.id} failed: ${message}`);

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};
