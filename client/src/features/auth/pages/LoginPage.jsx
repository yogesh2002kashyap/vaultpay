import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const user = await login(credentials);
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card-container">
      <div className="auth-card">
        <h1 className="title">VaultPay Core</h1>
        <p className="subtitle">Sign in to your secure account</p>
        <p className="page-subtitle">
          Client accounts are created by an administrator. If you need access, contact your admin for your credentials.
        </p>
        
        <form onSubmit={handleLogin} className="auth-form">
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </label>

          <label className="form-field" style={{ position: 'relative' }}>
            <span>Password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={credentials.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
