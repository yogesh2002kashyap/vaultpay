import { Invoice } from './invoice.model.js';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden } from '../../core/utils/response.js';
import { User } from '../auth/user.model.js';
import { streamReceiptFromStorage } from '../../services/storage.service.js';

const computeInvoiceTotals = (items, taxRate = 0) => {
  const computedItems = items.map((item) => ({
    ...item,
    amount: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
  }));
  const subtotal = parseFloat(computedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const taxAmount = parseFloat((subtotal * (taxRate / 100)).toFixed(2));
  const total = parseFloat((subtotal + taxAmount).toFixed(2));
  return { computedItems, subtotal, taxAmount, total };
};

export const createInvoice = async (req, res, next) => {
  try {
    const { clientId, items, tax, currency, dueDate, notes } = req.body;

    const client = await User.findById(clientId);
    if (!client || client.role !== 'client') {
      return sendBadRequest(res, 'The specified client does not exist or is not a client account.');
    }

    const { computedItems, subtotal, taxAmount, total } = computeInvoiceTotals(items, tax);

    const invoice = await Invoice.create({
      clientId,
      items: computedItems,
      subtotal,
      tax: taxAmount,
      total,
      currency,
      dueDate,
      notes,
    });

    return sendCreated(res, 'Invoice created successfully.', invoice);
  } catch (err) {
    next(err);
  }
};

export const getAllInvoices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.clientId) filter.clientId = req.query.clientId;

    const invoices = await Invoice.find(filter)
      .populate('clientId', 'name email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Invoices retrieved successfully.', invoices);
  } catch (err) {
    next(err);
  }
};

export const getInvoiceById = (req, res) => {
  return sendSuccess(res, 'Invoice retrieved successfully.', req.invoice);
};

export const updateInvoice = async (req, res, next) => {
  try {
    const invoice = req.invoice;

    if (['paid', 'processing'].includes(invoice.status)) {
      return sendBadRequest(res, `Cannot modify an invoice with status '${invoice.status}'.`);
    }

    const { items, tax, currency, dueDate, notes, status } = req.body;

    if (items) {
      const { computedItems, subtotal, taxAmount, total } = computeInvoiceTotals(items, tax ?? 0);
      invoice.items = computedItems;
      invoice.subtotal = subtotal;
      invoice.tax = taxAmount;
      invoice.total = total;
    }

    if (currency !== undefined) invoice.currency = currency;
    if (dueDate !== undefined) invoice.dueDate = dueDate;
    if (notes !== undefined) invoice.notes = notes;
    if (status !== undefined) invoice.status = status;

    await invoice.save();
    return sendSuccess(res, 'Invoice updated successfully.', invoice);
  } catch (err) {
    next(err);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = req.invoice;

    if (invoice.status === 'paid') {
      return sendBadRequest(res, 'Paid invoices cannot be deleted.');
    }

    await Invoice.findByIdAndUpdate(invoice._id, { isDeleted: true });
    return sendSuccess(res, 'Invoice deleted successfully.');
  } catch (err) {
    next(err);
  }
};

export const getMyInvoices = async (req, res, next) => {
  try {
    const filter = { clientId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    const safeInvoices = invoices.map((invoice) => ({
      ...invoice.toObject(),
      receiptAvailable: Boolean(invoice.receiptUrl),
      paymentDate: invoice.paidAt || null,
      downloadStatus: invoice.receiptUrl ? 'available' : invoice.status === 'paid' ? 'generating' : 'unavailable',
      paymentMetadata: {
        paid: invoice.status === 'paid',
        transactionId: invoice.stripePaymentIntentId || null,
      },
    }));

    return sendSuccess(res, 'Your invoices retrieved successfully.', safeInvoices);
  } catch (err) {
    next(err);
  }
};

export const downloadInvoiceReceipt = async (req, res, next) => {
  try {
    const invoice = req.invoice;

    if (!invoice.receiptUrl) {
      return sendNotFound(res, 'Receipt is not available for this invoice yet.');
    }

    if (req.user.role !== 'admin' && !invoice.clientId.equals(req.user._id)) {
      return sendForbidden(res, 'You do not have permission to download this receipt.');
    }

    const storageRef = {
      storage: invoice.receiptStorage || 'local',
      url: invoice.receiptUrl,
      publicId: invoice.receiptPublicId,
    };

    const receipt = await streamReceiptFromStorage(storageRef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName}"`);
    return res.send(receipt.buffer);
  } catch (err) {
    next(err);
  }
};
