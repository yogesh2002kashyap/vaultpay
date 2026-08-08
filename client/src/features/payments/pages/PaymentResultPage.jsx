import { Link, useSearchParams } from 'react-router-dom';

export const PaymentResultPage = ({ result }) => {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');
  const sessionId = searchParams.get('session_id');
  const isSuccess = result === 'success';

  return (
    <div className="payment-result">
      <div className={`payment-result-icon ${isSuccess ? 'success' : 'cancel'}`}>
        {isSuccess ? 'OK' : '!'}
      </div>
      <h1>{isSuccess ? 'Payment Submitted' : 'Payment Cancelled'}</h1>
      <p>
        {isSuccess
          ? 'VaultPay will update the invoice after the verified Stripe webhook is processed.'
          : 'No payment status was changed. You can return to the invoice list and try again.'}
      </p>

      <dl className="payment-result-details">
        {invoiceId && (
          <>
            <dt>Invoice ID</dt>
            <dd>{invoiceId}</dd>
          </>
        )}
        {sessionId && (
          <>
            <dt>Stripe Session</dt>
            <dd>{sessionId}</dd>
          </>
        )}
      </dl>

      <Link to="/dashboard" className="btn-primary payment-result-link">
        Back to Dashboard
      </Link>
    </div>
  );
};
