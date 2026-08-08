import { Router } from 'express';
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getMyInvoices,
  downloadInvoiceReceipt,
} from './invoice.controller.js';
import { createInvoiceSchema, updateInvoiceSchema, mongoIdSchema } from './invoice.validation.js';
import { validate } from '../../core/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../core/middlewares/auth.middleware.js';
import { verifyInvoiceOwnership } from '../../core/middlewares/ownership.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/my', requireRole(['client']), getMyInvoices);
router.post('/', requireRole(['admin']), validate(createInvoiceSchema), createInvoice);
router.get('/', requireRole(['admin']), getAllInvoices);
router.get('/:id', validate(mongoIdSchema), verifyInvoiceOwnership, getInvoiceById);
router.get('/:id/receipt', validate(mongoIdSchema), verifyInvoiceOwnership, downloadInvoiceReceipt);
router.put('/:id', requireRole(['admin']), validate(mongoIdSchema), validate(updateInvoiceSchema), verifyInvoiceOwnership, updateInvoice);
router.delete('/:id', requireRole(['admin']), validate(mongoIdSchema), verifyInvoiceOwnership, deleteInvoice);

export default router;
