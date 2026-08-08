# Receipt Automation

## Overview

VaultPay now automates receipt generation after successful Stripe payment confirmation.

## Flow

1. Stripe webhook confirms a paid checkout session.
2. The invoice status is updated to paid.
3. A PDF receipt is generated from invoice and client data.
4. The receipt is uploaded to storage (Cloudinary preferred, local fallback).
5. The invoice stores the receipt URL and storage metadata.
6. A professional HTML receipt email is sent to the client.

## Services

- PDF generation: src/services/pdfReceipt.service.js
- Storage: src/services/storage.service.js
- Email delivery: src/services/email.service.js
- Automation orchestration: src/modules/payments/receipt.service.js

## Security Notes

- Receipt download is protected by the same ownership middleware as invoices.
- Clients can only access their own receipts.
- Admins can access any receipt.
- Sensitive Stripe values are not exposed in invoice responses.
