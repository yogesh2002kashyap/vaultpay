import { Invoice } from '../../modules/invoices/invoice.model.js';
import { sendForbidden, sendNotFound } from '../utils/response.js';

/**
 * verifyInvoiceOwnership Middleware
 *
 * This middleware is the primary IDOR (Insecure Direct Object Reference) defense.
 *
 * Zero Trust Principle:
 * The frontend CANNOT be trusted. Just because a user sends a valid invoice ID
 * does not mean they own it. Every single request to a specific invoice resource
 * MUST pass through this check — authentication + authorization alone is insufficient.
 *
 * Logic:
 * 1. Fetch the invoice from the database using the `id` from req.params.
 * 2. If not found → 404.
 * 3. If the requesting user is an admin → bypass ownership, proceed.
 * 4. If the requesting user is a client → strictly verify clientId matches req.user._id.
 * 5. If mismatch → 403 Forbidden. The controller NEVER executes.
 *
 * We also attach `req.invoice` to avoid a second DB lookup in the controller.
 *
 * Architectural Decision:
 * This middleware fetches and attaches the invoice. This means controllers
 * for ownership-protected routes should use `req.invoice` directly instead
 * of fetching again, following the DRY principle.
 */
export const verifyInvoiceOwnership = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return sendNotFound(res, `Invoice not found.`);
    }

    if (req.user.role === 'admin') {
      req.invoice = invoice;
      return next();
    }

    if (!invoice.clientId.equals(req.user._id)) {
      return sendForbidden(res, 'You do not have permission to access this invoice.');
    }

    req.invoice = invoice;
    next();
  } catch (err) {
    next(err);
  }
};
