import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const WorkspaceRoute: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const location = useLocation();

  if (!currentWorkspace) {
    // If no workspace is selected, we could redirect to a workspace selection page.
    // For now, redirect to a hypothetical selector or settings.
    return <Navigate to="/settings?tab=workspaces" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default WorkspaceRoute;
