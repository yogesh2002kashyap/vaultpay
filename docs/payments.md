# VaultPay Payment System

## Architecture

VaultPay uses Stripe Hosted Checkout:

Invoice -> Checkout Session -> Stripe Hosted Checkout -> Successful Payment -> Stripe Webhook -> Database Update -> Future Receipt Generation

This keeps card handling and payment authentication inside Stripe, keeps secret keys on the backend, and makes the verified Stripe webhook the only source allowed to mark an invoice as paid. The frontend can request a Checkout URL, but it cannot set or confirm payment status.

## Security Decisions

- Stripe keys are loaded from environment variables and validated in `src/config/stripe.js`.
- `STRIPE_MODE=test` requires `pk_test_` and `sk_test_` keys. `STRIPE_MODE=live` requires live keys.
- Production refuses to boot unless Stripe mode is `live`.
- Checkout is available only to authenticated clients.
- Ownership is enforced through the existing invoice ownership middleware.
- Payable invoice statuses are `pending` and `overdue`; `processing` can resume an open Checkout Session.
- `draft`, `paid`, `cancelled`, and unknown statuses are rejected before Checkout creation.
- Webhooks are mounted at `POST /api/webhooks/stripe` before `express.json()` so Stripe receives the raw body for signature verification.
- `stripe.webhooks.constructEvent()` verifies every webhook. Unverified events are rejected and never processed.
- Webhook processing records Stripe event IDs in `WebhookEvent` to make retries safe.
- Invoice payment confirmation uses an atomic Mongo update filtered by allowed statuses.
- Transaction and audit records are created only after verified webhook confirmation.

## Endpoints

### POST `/api/v1/payments/invoices/:id/checkout-session`

Purpose: Create or resume a Stripe Checkout Session for an invoice.

Authentication: Required.

Authorization: Client only. The client must own the invoice.

Request:

```http
POST /api/v1/payments/invoices/64f0f4f6f88c8d42a1d9aa01/checkout-session
Cookie: vaultpay_token=<httpOnly cookie>
Content-Type: application/json
```

Body: empty.

Success response:

```json
{
  "success": true,
  "message": "Stripe Checkout session ready.",
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "sessionId": "cs_test_...",
    "invoiceId": "64f0f4f6f88c8d42a1d9aa01",
    "invoiceNumber": "INV-1001",
    "expiresAt": "2026-08-08T12:30:00.000Z",
    "reused": false
  }
}
```

Possible errors:

- `400`: invalid invoice ID, draft invoice, cancelled invoice, invalid invoice total, invalid invoice status.
- `401`: missing or expired session cookie.
- `403`: authenticated user is not a client or does not own the invoice.
- `404`: invoice not found.
- `409`: invoice already paid or payment is already being confirmed.
- `502`: Stripe API unavailable or network failure.

Security consideration: This endpoint does not mark invoices paid. It only creates or resumes a hosted Stripe Checkout Session.

### POST `/api/webhooks/stripe`

Purpose: Receive Stripe webhook events and confirm completed payments.

Authentication: No user session. Stripe signature is mandatory.

Authorization: `Stripe-Signature` header must verify against `STRIPE_WEBHOOK_SECRET`.

Supported event:

- `checkout.session.completed`

Processing behavior:

- Reject missing or invalid signatures.
- Reject test/live mode mismatch.
- Ignore unsupported event types after logging safely.
- Require `payment_status=paid`.
- Validate Stripe metadata: invoice ID, client ID, invoice number, currency, amount.
- Compare Stripe amount and currency against the database invoice.
- Update invoice to `paid` only from confirmable statuses.
- Store `paidAt`, `stripeSessionId`, `stripePaymentIntentId`, and `stripeCustomerId`.
- Upsert a `Transaction` record.
- Write an audit log with previous status, new status, webhook event ID, Stripe IDs, payment source, and payment time.

Success response:

```json
{
  "received": true,
  "eventId": "evt_...",
  "eventType": "checkout.session.completed",
  "processed": true,
  "invoiceId": "64f0f4f6f88c8d42a1d9aa01",
  "transactionId": "64f0f4f6f88c8d42a1d9aa99"
}
```

Possible errors:

- `400`: missing signature, invalid signature, malformed metadata, mode mismatch.
- `404`: invoice in Stripe metadata does not exist.
- `409`: amount/currency mismatch, invoice already paid by another payment, invalid invoice status.
- `500`: database or unexpected processing failure. Stripe should retry.

Security consideration: Signature verification is mandatory because webhook routes are public. Without verification, any caller could forge a payment event and mark invoices paid.

## Stripe Metadata

VaultPay stores this metadata on both the Checkout Session and PaymentIntent:

```json
{
  "invoiceId": "<Mongo invoice id>",
  "clientId": "<Mongo client id>",
  "invoiceNumber": "INV-1001",
  "currency": "USD",
  "amount": "12500"
}
```

`amount` is stored in Stripe minor units, for example cents for USD.

## Testing Strategy

Checkout Session:

- Login as a client.
- Create a `pending` or `overdue` invoice owned by that client.
- POST the checkout endpoint.
- Confirm the response has `checkoutUrl`.
- Confirm the invoice moves to `processing`, not `paid`.
- Repeat the request and confirm the open session is reused.

Authentication and authorization:

- Call checkout without a cookie and expect `401`.
- Call checkout as an admin and expect `403`.
- Call checkout as a different client and expect `403`.
- Use a missing invoice ID and expect `404`.

Invalid invoice states:

- `draft`: expect `400`.
- `cancelled`: expect `400`.
- `paid`: expect `409`.
- invalid total: expect `400`.

Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Use the webhook secret printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET`.

Webhook events:

- Valid `checkout.session.completed`: invoice becomes `paid`.
- Duplicate event ID: response is `200`, no duplicate transaction/audit side effects.
- Same payment intent with a different event ID: no duplicate invoice update.
- Invalid signature: expect `400`.
- Old/replayed signed payload outside Stripe tolerance: expect `400`.
- Missing invoice metadata: expect `400`.
- Missing invoice record: expect `404`.
- Amount/currency mismatch: expect `409`.
- Unsupported event type: expect `200` with ignored result.

Postman examples:

Checkout request:

```http
POST {{API_BASE_URL}}/payments/invoices/{{INVOICE_ID}}/checkout-session
Cookie: vaultpay_token={{SESSION_COOKIE}}
Content-Type: application/json
```

Webhook negative test:

```http
POST {{SERVER_URL}}/api/webhooks/stripe
Content-Type: application/json
Stripe-Signature: invalid

{"id":"evt_fake","type":"checkout.session.completed"}
```

Expected response:

```json
{
  "success": false,
  "message": "Invalid Stripe webhook signature."
}
```

## Frontend Flow

- The dashboard fetches invoices from `GET /api/v1/invoices/my`.
- Payable invoices show a Pay or Resume Payment button.
- Clicking the button disables payment actions and requests a backend Checkout Session.
- The browser redirects to Stripe using the returned `checkoutUrl`.
- Stripe redirects back to `/payments/success` or `/payments/cancel`.
- The frontend never marks the invoice as paid. It only reflects backend state after refresh.
