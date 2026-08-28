import api from '../lib/axios';

export const accountService = {
  getAccounts: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/accounts`),
  createAccount: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/accounts`, data),
  updateAccount: (workspaceId: string, id: string, data: any) => api.put(`/workspaces/${workspaceId}/accounts/${id}`, data),
  deleteAccount: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/accounts/${id}`),
  getAccountStatement: (workspaceId: string, id: string, params: any) => api.get(`/workspaces/${workspaceId}/accounts/${id}/statement`, { params }),
  getAccountSummary: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/accounts/summary`),
};
