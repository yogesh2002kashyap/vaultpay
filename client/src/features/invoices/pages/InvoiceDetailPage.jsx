import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../services/apiClient';

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

export const InvoiceDetailPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const { data } = await apiClient.get(`/invoices/${invoiceId}`);
        setInvoice(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load invoice details.');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  const canPay = useMemo(() => !['paid', 'cancelled'].includes(invoice?.status), [invoice]);

  if (loading) {
    return <div className="invoice-empty-state">Loading invoice details...</div>;
  }

  if (error) {
    return <div className="alert error">{error}</div>;
  }

  if (!invoice) {
    return null;
  }

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <h1 className="page-title">{invoice.invoiceNumber}</h1>
        <p className="page-subtitle">Managed for {user?.name}</p>
      </header>

      <div className="card-grid">
        <section className="glass-card">
          <h2>Invoice Overview</h2>
          <dl className="detail-list">
            <div><dt>Status</dt><dd>{invoice.status}</dd></div>
            <div><dt>Due Date</dt><dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd></div>
            <div><dt>Payment Date</dt><dd>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : 'Pending'}</dd></div>
            <div><dt>Total</dt><dd>{formatCurrency(invoice.total, invoice.currency)}</dd></div>
          </dl>
        </section>

        <section className="glass-card">
          <h2>Receipt</h2>
          <p>{invoice.receiptUrl ? 'Receipt is available for download.' : 'Receipt will be generated after payment confirmation.'}</p>
          {invoice.receiptUrl ? (
            <button type="button" className="btn-secondary" onClick={() => window.open(`/api/v1/invoices/${invoice._id}/receipt`, '_blank')}>Download Receipt</button>
          ) : null}
          {canPay ? (
            <button type="button" className="btn-primary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
          ) : null}
        </section>
      </div>
    </div>
  );
};
