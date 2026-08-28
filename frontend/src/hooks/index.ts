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

    // 1. Try Backend API (FastAPI + MySQL Database) authentication first
    try {
      const res: any = await authService.login(credentials);
      const data = res?.data ?? res;
      if (data?.access_token) {
        const tokens = { access_token: data.access_token, refresh_token: data.refresh_token };
        const user = data.user || { id: 'user-mysql', email: inputUser, username: inputUser, role: 'USER' };
        store.login(tokens, user);
        store.setWorkspaces([DEFAULT_WORKSPACE]);
        store.setCurrentWorkspace(DEFAULT_WORKSPACE);
        navigate('/dashboard', { replace: true });
        return;
      }
    } catch {}

    // 2. Default Admin Credentials Check: admin@daytoexpense.com or admin with DayToExpense@2024
    const isAdminUser = inputUser === 'admin@daytoexpense.com' || inputUser === 'admin';
    if (isAdminUser) {
      if (inputPw === 'DayToExpense@2024' || inputPw.toLowerCase() === 'daytoexpense@2024') {
        try {
          await authService.register({
            email: 'admin@daytoexpense.com',
            username: 'admin',
            password: 'DayToExpense@2024',
            full_name: 'System Administrator',
          });
          const res: any = await authService.login(credentials);
          const data = res?.data ?? res;
          if (data?.access_token) {
            store.login({ access_token: data.access_token, refresh_token: data.refresh_token }, data.user);
            store.setWorkspaces([DEFAULT_WORKSPACE]);
            store.setCurrentWorkspace(DEFAULT_WORKSPACE);
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch {}

        const adminUser: any = {
          id: 'admin-master-01',
          email: 'admin@daytoexpense.com',
          username: 'admin',
          full_name: 'System Administrator',
          is_active: true,
          is_verified: true,
          is_admin: true,
          role: 'ADMIN',
        };
        const tokens = { access_token: 'token_admin_2024', refresh_token: 'refresh_admin_2024' };
        store.login(tokens, adminUser);
        store.setWorkspaces([DEFAULT_WORKSPACE]);
        store.setCurrentWorkspace(DEFAULT_WORKSPACE);
        navigate('/dashboard', { replace: true });
        return;
      } else {
        throw new Error('Incorrect password for admin. Default password is DayToExpense@2024');
      }
    }

    // 3. Check registered local users list
    let registeredUsers: any[] = [];
    try {
      const savedUsersStr = localStorage.getItem('app_registered_users');
      if (savedUsersStr) registeredUsers = JSON.parse(savedUsersStr);
    } catch {}

    const foundUser = registeredUsers.find(
      (u: any) =>
        (u.email && u.email.toLowerCase() === inputUser) ||
        (u.username && u.username.toLowerCase() === inputUser)
    );

    if (foundUser) {
      if (foundUser.password === inputPw) {
        const stdUser: any = {
          id: foundUser.id || 'user-' + Date.now(),
          email: foundUser.email,
          username: foundUser.username,
          full_name: foundUser.full_name || foundUser.username,
          is_active: true,
          is_admin: false,
          role: 'USER',
        };
        const tokens = { access_token: 'token_user_' + Date.now(), refresh_token: 'refresh_user_' + Date.now() };
        store.login(tokens, stdUser);
        store.setWorkspaces([DEFAULT_WORKSPACE]);
        store.setCurrentWorkspace(DEFAULT_WORKSPACE);
        navigate('/dashboard', { replace: true });
        return;
      } else {
        throw new Error('Incorrect password for this account. Please try again.');
      }
    }

    throw new Error('Invalid email/username or password. Account not found. Please Sign Up to create an account.');
  }, [store, navigate]);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch {}
    store.logout();
    qc.clear();
    navigate('/login');
  }, [store, navigate, qc]);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    currentWorkspace: store.currentWorkspace ?? DEFAULT_WORKSPACE,
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
