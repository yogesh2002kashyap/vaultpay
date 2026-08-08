import { generateReceiptPdfBuffer } from '../../services/pdfReceipt.service.js';
import { uploadReceiptToStorage } from '../../services/storage.service.js';
import { sendReceiptEmail } from '../../services/email.service.js';
import { Invoice } from '../invoices/invoice.model.js';
import { User } from '../auth/user.model.js';
import { logger } from '../../utils/logger.js';

const getReceiptFilename = (invoice) => `receipt-${invoice.invoiceNumber || invoice._id?.toString() || 'invoice'}.pdf`;

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amount || 0);

export const createReceiptForInvoice = async ({ invoice, client, company = {} }) => {
  if (!invoice || !client) {
    throw new Error('Invoice and client are required to generate a receipt.');
  }

  if (invoice.receiptUrl) {
    return {
      receiptUrl: invoice.receiptUrl,
      created: false,
      skipped: true,
    };
  }

  const pdfBuffer = await generateReceiptPdfBuffer({ invoice, client, company });
  const storageResult = await uploadReceiptToStorage({
    buffer: pdfBuffer,
    invoiceId: invoice._id.toString(),
    filename: getReceiptFilename(invoice),
  });

  const updatedInvoice = await Invoice.findByIdAndUpdate(
    invoice._id,
    {
      $set: {
        receiptUrl: storageResult.url,
        receiptStorage: storageResult.storage,
        receiptPublicId: storageResult.publicId,
      },
    },
    { new: true }
  );

  const receiptUrl = updatedInvoice?.receiptUrl || storageResult.url;

  if (!updatedInvoice) {
    throw new Error('Receipt could not be persisted to the invoice.');
  }

  const attachment = {
    filename: getReceiptFilename(invoice),
    content: pdfBuffer,
    contentType: 'application/pdf',
  };

  const emailSent = await sendReceiptEmail({
    to: client.email,
    subject: `Receipt for ${invoice.invoiceNumber}`,
    clientName: client.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: formatCurrency(invoice.total, invoice.currency),
    receiptUrl,
    attachments: [attachment],
  });

  logger.info(`Receipt workflow completed for invoice ${invoice.invoiceNumber}: emailSent=${emailSent}`);

  return {
    receiptUrl,
    created: true,
    emailSent,
    storage: storageResult.storage,
  };
};

export const ensureReceiptForInvoice = async ({ invoiceId }) => {
  const invoice = await Invoice.findById(invoiceId).populate('clientId', 'name email');
  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  if (invoice.receiptUrl) {
    return { invoice, receiptUrl: invoice.receiptUrl, exists: true };
  }

  const client = await User.findById(invoice.clientId);
  if (!client) {
    throw new Error('Client not found.');
  }

  const receipt = await createReceiptForInvoice({ invoice, client });
  return { invoice: await Invoice.findById(invoiceId), ...receipt };
};
