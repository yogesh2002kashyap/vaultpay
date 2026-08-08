import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

const renderReceiptEmailHtml = ({ clientName, invoiceNumber, amount, receiptUrl, companyName }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Received</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr style="background:linear-gradient(135deg,#0ea5e9,#8b5cf6);">
              <td style="padding:28px 32px;color:#ffffff;">
                <h1 style="margin:0;font-size:24px;">Payment Confirmed</h1>
                <p style="margin:8px 0 0;opacity:0.95;">${companyName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 12px;font-size:16px;">Hello ${clientName || 'there'},</p>
                <p style="margin:0 0 16px;line-height:1.6;">Your payment for invoice <strong>${invoiceNumber}</strong> has been successfully received. A PDF receipt is ready for download.</p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:20px 0;">
                  <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Amount Paid</p>
                  <p style="margin:0;font-size:24px;font-weight:700;">${amount}</p>
                </div>
                <p style="margin:0 0 20px;">
                  <a href="${receiptUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">Download Receipt</a>
                </p>
                <p style="margin:0;color:#64748b;line-height:1.6;">If you have any questions, reply to this email and our team will be happy to help.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const sendReceiptEmail = async ({ to, subject, clientName, invoiceNumber, amount, receiptUrl, attachments = [] }) => {
  try {
    const companyName = 'VaultPay Financial Core';
    const html = renderReceiptEmailHtml({ clientName, invoiceNumber, amount, receiptUrl, companyName });

    await transporter.sendMail({
      from: `VaultPay <${config.smtp.user}>`,
      to,
      subject: subject || 'Payment receipt ready',
      html,
      attachments,
    });

    return true;
  } catch (error) {
    logger.error(`Receipt email failed: ${error.message}`);
    return false;
  }
};
