// src/hooks/index.ts — all custom hooks

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { authService } from '../services';

const DEFAULT_WORKSPACE: any = {
  id: 'ws-primary-01',
  name: 'Primary Workspace',
  type: 'PERSONAL',
  base_currency: 'INR',
  is_active: true,
};

// ─── useAuth ──────────────────────────────────────────────────────────────────
export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const login = useCallback(async (credentials: { username_or_email: string; password: string }) => {
    const inputUser = (credentials.username_or_email || '').trim().toLowerCase();
    const inputPw = (credentials.password || '').trim();

    if (!inputUser || !inputPw) {
      throw new Error('Please enter both email/username and password.');
    }

    // 1. Authenticate strictly with backend API & Database
    let res: any;
    try {
      res = await authService.login(credentials);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Backend server is unreachable. Please ensure the backend database server is running.';
      throw new Error(typeof errMsg === 'string' ? errMsg : 'Invalid email/username or password.');
    }

    const data = res?.data ?? res;
    if (!data?.access_token) {
      throw new Error('Login failed: Invalid server response.');
    }

    const tokens = { access_token: data.access_token, refresh_token: data.refresh_token };
    const user = data.user;
    store.login(tokens, user);

    // 2. Fetch user's actual isolated workspaces from database
    let userWorkspaces: any[] = [];
    try {
      userWorkspaces = await authService.getWorkspaces();
    } catch {}

    if (!Array.isArray(userWorkspaces) || userWorkspaces.length === 0) {
      userWorkspaces = [
        {
          id: `ws-${user?.id || 'personal'}`,
          name: `${user?.full_name || user?.username || 'User'}'s Finance`,
          type: 'PERSONAL',
          base_currency: 'INR',
          is_active: true,
        },
      ];
    }

    store.setWorkspaces(userWorkspaces);
    store.setCurrentWorkspace(userWorkspaces[0]);

    qc.invalidateQueries();
    navigate('/dashboard', { replace: true });
  }, [store, navigate, qc]);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch {}
    store.logout();
    qc.clear();
    navigate('/login');
  }, [store, navigate, qc]);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    currentWorkspace: store.currentWorkspace || (store.workspaces && store.workspaces[0]) || null,
    token: store.token,
    login,
    logout,
    switchWorkspace: store.setCurrentWorkspace,
  };
}

// ─── useWorkspace ──────────────────────────────────────────────────────────────
export function useWorkspace() {
  const { currentWorkspace, setCurrentWorkspace, workspaces } = useAuthStore();

  useEffect(() => {
    if (!currentWorkspace) {
      setCurrentWorkspace(DEFAULT_WORKSPACE);
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  const activeWsList = workspaces && workspaces.length > 0 ? workspaces : [DEFAULT_WORKSPACE];
  return {
    currentWorkspace: currentWorkspace ?? DEFAULT_WORKSPACE,
    workspaces: activeWsList,
    switchWorkspace: setCurrentWorkspace,
  };
}

// ─── usePeriod ────────────────────────────────────────────────────────────────
export type Period = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

export function usePeriod(defaultPeriod: Period = 'THIS_MONTH') {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const setCustomRange = useCallback((start: string, end: string) => {
    setPeriod('CUSTOM');
    setStartDate(start);
    setEndDate(end);
  }, []);

  return { period, setPeriod, startDate, endDate, setCustomRange };
}

// ─── useDebounce ──────────────────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─── useCurrency ──────────────────────────────────────────────────────────────
export function useCurrency() {
  const { currentWorkspace } = useAuthStore();
  const currency = currentWorkspace?.base_currency ?? 'INR';

  const formatAmount = useCallback((value: number | string | null | undefined): string => {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '₹0.00';

    if (currency === 'INR') {
      // Indian number format: ₹1,23,456.78
      const absNum = Math.abs(num);
      const [intPart, decPart = '00'] = absNum.toFixed(2).split('.');
      const dec = decPart.slice(0, 2);
      let formatted = '';
      if (intPart.length <= 3) {
        formatted = intPart;
      } else {
        const last3 = intPart.slice(-3);
        const rest = intPart.slice(0, -3);
        const groups: string[] = [];
        for (let i = rest.length; i > 0; i -= 2) {
          groups.unshift(rest.slice(Math.max(0, i - 2), i));
        }
        formatted = groups.join(',') + ',' + last3;
      }
      return `${num < 0 ? '-' : ''}₹${formatted}.${dec}`;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(num);
  }, [currency]);

  const formatCompact = useCallback((value: number | string): string => {
    const num = Number(value ?? 0);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return formatAmount(num);
  }, [formatAmount]);

  return { currency, formatAmount, formatCompact };
}

// ─── useDisclosure ─────────────────────────────────────────────────────────────
export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);
  return { isOpen, open, close, toggle };
}

// ─── useLocalStorage ──────────────────────────────────────────────────────────
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setLocalValue = useCallback((newValue: T) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  }, [key]);

  return [value, setLocalValue];
}

// ─── usePrevious ──────────────────────────────────────────────────────────────
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
