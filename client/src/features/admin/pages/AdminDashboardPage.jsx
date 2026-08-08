import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { EmptyState } from '../../../components/EmptyState';
import apiClient from '../../../services/apiClient';

const initialClientForm = {
  name: '',
  email: '',
  password: '',
};

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

export const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientForm, setClientForm] = useState(initialClientForm);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientMessage, setClientMessage] = useState('');

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const { data } = await apiClient.get('/invoices');
        setInvoices(data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load invoices.');
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  const summary = useMemo(() => {
    const paid = invoices.filter((invoice) => invoice.status === 'paid').length;
    const pending = invoices.filter((invoice) => invoice.status !== 'paid').length;
    const total = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    return { paid, pending, total };
  }, [invoices]);

  const handleCreateClient = async (event) => {
    event.preventDefault();
    setCreatingClient(true);
    setClientMessage('');

    try {
      await apiClient.post('/auth/register', {
        ...clientForm,
        role: 'client',
      });

      setClientMessage('Client account created successfully.');
      setClientForm(initialClientForm);
    } catch (err) {
      setClientMessage(err.response?.data?.message || 'Unable to create the client account.');
    } finally {
      setCreatingClient(false);
    }
  };

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <h1 className="page-title">Admin Overview</h1>
        <p className="page-subtitle">Welcome back, {user?.name}</p>
      </header>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3 className="metric-label">Paid Invoices</h3>
          <p className="metric-value highlight">{summary.paid}</p>
        </div>
        <div className="metric-card">
          <h3 className="metric-label">Pending Invoices</h3>
          <p className="metric-value">{summary.pending}</p>
        </div>
        <div className="metric-card">
          <h3 className="metric-label">Total Billed</h3>
          <p className="metric-value">{formatCurrency(summary.total, 'USD')}</p>
        </div>
      </div>

      <section className="invoice-section">
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <h2>Create Client Account</h2>
          <p className="page-subtitle">Admins can create client accounts directly from here.</p>
          <form onSubmit={handleCreateClient} className="auth-form">
            <label className="form-field">
              <span>Name</span>
              <input
                type="text"
                value={clientForm.name}
                onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={clientForm.email}
                onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                value={clientForm.password}
                onChange={(event) => setClientForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            {clientMessage ? <p className="form-error">{clientMessage}</p> : null}
            <button type="submit" className="btn-primary" disabled={creatingClient}>
              {creatingClient ? 'Creating Account...' : 'Create Client'}
            </button>
          </form>
        </div>

        {error ? <div className="alert error">{error}</div> : null}
        {loading ? <div className="invoice-empty-state">Loading invoices...</div> : null}
        {!loading && invoices.length === 0 ? (
          <EmptyState title="No invoices found" description="Invoices created by admins will appear here." />
        ) : null}
        {!loading && invoices.length > 0 ? (
          <div className="invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>
                      <div className="invoice-number">{invoice.invoiceNumber}</div>
                      <div className="invoice-id">{invoice._id}</div>
                    </td>
                    <td>{invoice.clientId?.name || invoice.clientId?.email || '—'}</td>
                    <td><span className={`status-pill ${invoice.status}`}>{invoice.status}</span></td>
                    <td>{invoice.receiptUrl ? 'Ready' : 'Pending'}</td>
                    <td>{formatCurrency(invoice.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
