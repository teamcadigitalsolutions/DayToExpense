import api from '../lib/axios';

export const transactionService = {
  getTransactions: (workspaceId: string, params: any) => api.get(`/workspaces/${workspaceId}/transactions`, { params }),
  createTransaction: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/transactions`, data),
  updateTransaction: (workspaceId: string, id: string, data: any) => api.put(`/workspaces/${workspaceId}/transactions/${id}`, data),
  deleteTransaction: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/transactions/${id}`),
  getTransaction: (workspaceId: string, id: string) => api.get(`/workspaces/${workspaceId}/transactions/${id}`),
};
