import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <div className="auth-blob blue"></div>
      <div className="auth-blob purple"></div>
      <Outlet />
    </div>
  );
};
