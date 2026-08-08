import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { EmptyState } from '../../../components/EmptyState';
import { ReceiptBadge } from '../../../components/ReceiptBadge';
import apiClient from '../../../services/apiClient';

const PAYABLE_STATUSES = ['pending', 'overdue', 'processing'];

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount || 0);

const getPaymentButtonLabel = (invoice, isLoading) => {
  if (isLoading) return 'Opening Checkout...';
  if (invoice.status === 'processing') return 'Resume Payment';
  if (invoice.status === 'pending' || invoice.status === 'overdue') return 'Pay';
  if (invoice.status === 'paid') return 'Paid';
  if (invoice.status === 'cancelled') return 'Cancelled';
  return 'Not Payable';
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState('');
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    const loadInvoices = async () => {
      setLoadingInvoices(true);
      setInvoiceError('');

      try {
        const { data } = await apiClient.get('/invoices/my');
        setInvoices(data.data || []);
      } catch (err) {
        setInvoiceError(err.response?.data?.message || 'Unable to load invoices.');
      } finally {
        setLoadingInvoices(false);
      }
    };

    loadInvoices();
  }, []);

  const metrics = useMemo(() => {
    const unpaidInvoices = invoices.filter((invoice) => PAYABLE_STATUSES.includes(invoice.status));
    const totalDue = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const currency = unpaidInvoices[0]?.currency || invoices[0]?.currency || 'USD';

    return {
      unpaidCount: unpaidInvoices.length,
      totalDue,
      currency,
    };
  }, [invoices]);

  const handlePayInvoice = async (invoiceId) => {
    if (payingInvoiceId) return;

    setPayingInvoiceId(invoiceId);
    setPaymentError('');

    try {
      const { data } = await apiClient.post(`/payments/invoices/${invoiceId}/checkout-session`);
      const checkoutUrl = data.data?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error('Checkout URL was not returned by the server.');
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setPaymentError(
        err.response?.data?.message || err.message || 'Unable to start payment. Please try again.'
      );
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadReceipt = async (invoice) => {
    if (!invoice?.receiptUrl || downloadingReceiptId) return;

    setDownloadingReceiptId(invoice._id);
    setReceiptError('');

    try {
      const response = await apiClient.get(`/invoices/${invoice._id}/receipt`, {
        responseType: 'blob',
      });

      const href = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = href;
      link.setAttribute('download', `${invoice.invoiceNumber || invoice._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(href);
    } catch (err) {
      setReceiptError(err.response?.data?.message || 'Unable to download the receipt right now.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <h1 className="page-title">Welcome back, {user?.name}</h1>
        <p className="page-subtitle">Here is your financial overview.</p>
      </header>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3 className="metric-label">Unpaid Invoices</h3>
          <p className="metric-value highlight">{metrics.unpaidCount}</p>
        </div>
        <div className="metric-card">
          <h3 className="metric-label">Total Due</h3>
          <p className="metric-value">{formatCurrency(metrics.totalDue, metrics.currency)}</p>
        </div>
      </div>

      <section className="invoice-section">
        <div className="section-heading">
          <h2>Invoices</h2>
        </div>

        {paymentError && <div className="alert error">{paymentError}</div>}
        {receiptError && <div className="alert error">{receiptError}</div>}
        {invoiceError && <div className="alert error">{invoiceError}</div>}

        {loadingInvoices ? (
          <div className="invoice-empty-state">
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Your invoice history will appear here once billing is started." />
        ) : (
          <div className="invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const isPaying = payingInvoiceId === invoice._id;
                  const isPayable = PAYABLE_STATUSES.includes(invoice.status);

                  return (
                    <tr key={invoice._id}>
                      <td>
                        <button type="button" className="invoice-link" onClick={() => navigate(`/invoices/${invoice._id}`)}>
                          <div className="invoice-number">{invoice.invoiceNumber}</div>
                          <div className="invoice-id">{invoice._id}</div>
                        </button>
                      </td>
                      <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-pill ${invoice.status}`}>{invoice.status}</span>
                      </td>
                      <td>
                        <ReceiptBadge status={invoice.downloadStatus} />
                      </td>
                      <td>{formatCurrency(invoice.total, invoice.currency)}</td>
                      <td>
                        <div className="action-stack">
                          {invoice.receiptUrl ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={Boolean(downloadingReceiptId)}
                              onClick={() => handleDownloadReceipt(invoice)}
                            >
                              {downloadingReceiptId === invoice._id ? 'Downloading...' : 'Download Receipt'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-pay"
                            disabled={!isPayable || Boolean(payingInvoiceId)}
                            onClick={() => handlePayInvoice(invoice._id)}
                          >
                            {getPaymentButtonLabel(invoice, isPaying)}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
