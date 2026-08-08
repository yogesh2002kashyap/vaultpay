import express, { Router } from 'express';
import { handleStripeWebhook } from './stripeWebhook.controller.js';

const router = Router();

router.post(
  '/',
  express.raw({
    type: 'application/json',
    limit: '1mb',
  }),
  handleStripeWebhook
);

export default router;
