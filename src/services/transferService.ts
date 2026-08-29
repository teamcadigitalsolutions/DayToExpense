import api from '../lib/axios';

export const transferService = {
  getTransfers: (workspaceId: string, params?: any) => api.get(`/workspaces/${workspaceId}/transfers`, { params }),
  createTransfer: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/transfers`, data),
  deleteTransfer: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/transfers/${id}`),
};
