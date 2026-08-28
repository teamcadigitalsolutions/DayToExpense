import api from '../lib/axios';

export const workspaceService = {
  getWorkspaces: () => api.get('/workspaces'),
  createWorkspace: (data: any) => api.post('/workspaces', data),
  updateWorkspace: (id: string, data: any) => api.put(`/workspaces/${id}`, data),
  deleteWorkspace: (id: string) => api.delete(`/workspaces/${id}`),
  getMembers: (id: string) => api.get(`/workspaces/${id}/members`),
  addMember: (id: string, data: any) => api.post(`/workspaces/${id}/members`, data),
  removeMember: (id: string, memberId: string) => api.delete(`/workspaces/${id}/members/${memberId}`),
  switchWorkspace: (id: string) => api.post(`/workspaces/${id}/switch`),
};
