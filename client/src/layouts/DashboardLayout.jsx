import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const DashboardLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-brand">VaultPay</h2>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            Dashboard
          </NavLink>
          {user?.role === 'admin' ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              Admin Console
            </NavLink>
          ) : null}
          <span className="nav-item">Invoices</span>
          <span className="nav-item">Settings</span>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <p className="name">{user?.name}</p>
              <p className="role">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};
