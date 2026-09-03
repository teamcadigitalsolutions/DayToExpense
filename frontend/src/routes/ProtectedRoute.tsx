import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { isTokenExpired } from '../lib/axios';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, accessToken, refreshToken, logout } = useAuthStore();
  const location = useLocation();

  const tokenExpired = isTokenExpired(accessToken);
  const refreshExpired = isTokenExpired(refreshToken);

  // If token is expired and refresh token is also missing or expired, log out immediately
  if (!isAuthenticated || (tokenExpired && refreshExpired)) {
    if (isAuthenticated) {
      logout();
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
