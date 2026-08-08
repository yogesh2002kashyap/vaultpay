import { sendSuccess } from '../../core/utils/response.js';
import { createCheckoutSessionForInvoice } from './payment.service.js';

export const createCheckoutSession = async (req, res, next) => {
  try {
    const checkoutSession = await createCheckoutSessionForInvoice({
      invoice: req.invoice,
      client: req.user,
    });

    return sendSuccess(res, 'Stripe Checkout session ready.', {
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      invoiceId: req.invoice._id,
      invoiceNumber: req.invoice.invoiceNumber,
      expiresAt: checkoutSession.expiresAt,
      reused: checkoutSession.reused,
    });
  } catch (err) {
    next(err);
  }
};
