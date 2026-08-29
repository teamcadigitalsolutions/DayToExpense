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
        const state = useAuthStore.getState();
        const wsIds = (state.workspaces || []).map((w) => w.id);
        wsIds.push('ws-primary-01');
        if (state.currentWorkspace?.id) {
          wsIds.push(state.currentWorkspace.id);
        }
        
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('notification-storage');
        
        wsIds.forEach((wsId) => {
          const keys = [
            `daily_tasks_${wsId}`,
            `scratchpad_notes_${wsId}`,
            `important_events_${wsId}`,
            `savings_buckets_${wsId}`,
            `auto_rules_${wsId}`,
            `smart_loans_${wsId}`,
            `custom_investments_${wsId}`,
            `payroll_disbursements_${wsId}`,
            `digital_vault_${wsId}`,
            `household_utilities_${wsId}`,
            `smart_receipts_${wsId}`,
            `smart_debts_${wsId}`,
            `smart_tax_${wsId}`,
            `project_studio_${wsId}`,
            `app_accounts_${wsId}`,
            `app_categories_${wsId}`,
            `app_subscriptions_${wsId}`
          ];
          keys.forEach((k) => localStorage.removeItem(k));
        });

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
