import { Router } from 'express';
import healthRoutes from './health/health.routes.js';
import authRoutes from '../../modules/auth/auth.routes.js';
import invoiceRoutes from '../../modules/invoices/invoice.routes.js';
import paymentRoutes from '../../modules/payments/payment.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);

export default router;
