import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Workspace } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  token: string | null;
  isAuthenticated: boolean;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];

  login: (tokens: { access_token: string; refresh_token: string }, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setWorkspace: (workspace: Workspace | null) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      token: null,
      isAuthenticated: false,
      currentWorkspace: null,
      workspaces: [],

      login: (tokens, user) => {
        localStorage.setItem('accessToken', tokens.access_token);
        localStorage.setItem('refreshToken', tokens.refresh_token);
        set({
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          token: tokens.access_token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          token: null,
          isAuthenticated: false,
          currentWorkspace: null,
          workspaces: [],
        });
      },
      setUser: (user) => set({ user }),
      setWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
