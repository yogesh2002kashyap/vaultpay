import { Router } from 'express';
import { createCheckoutSession } from './payment.controller.js';
import { checkoutInvoiceParamSchema } from './payment.validation.js';
import { requireAuth, requireRole } from '../../core/middlewares/auth.middleware.js';
import { validate } from '../../core/middlewares/validate.middleware.js';
import { verifyInvoiceOwnership } from '../../core/middlewares/ownership.middleware.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/invoices/:id/checkout-session',
  requireRole(['client']),
  validate(checkoutInvoiceParamSchema),
  verifyInvoiceOwnership,
  createCheckoutSession
);

export default router;
