// src/services/index.ts — all services in one file for easy imports
import api from '../lib/axios';
import { useAuthStore } from '../stores/authStore';
import type {
  User, Workspace, Account, Transaction, Category,
  Investment, Budget, Loan, Invoice, Contact, Subscription,
  Notification, PaginatedResponse, APIResponse,
} from '../types';

// Helper function to extract data payload and guarantee it is NEVER undefined
const getPayload = (r: any, fallback: any = []) => {
  if (r === null || r === undefined) return fallback;
  if (r.data !== undefined && r.data !== null) return r.data;
  return r ?? fallback;
};

// Helper function to get current user's active workspace ID dynamically
const getWsId = (workspaceId?: string): string => {
  return workspaceId || useAuthStore.getState().currentWorkspace?.id || '';
};

const DEFAULT_SUMMARY = {
  total_balance: 0,
  total_income: 0,
  total_expense: 0,
  net_cash_flow: 0,
  total_investments: 0,
  investment_profit_loss: 0,
  total_receivable: 0,
  total_payable: 0,
  credit_card_outstanding: 0,
  loan_outstanding: 0,
  savings_rate: 0,
  income_change_pct: 0,
  expense_change_pct: 0,
  period_label: 'This Month',
};

const DEFAULT_NET_WORTH = { net_worth: 0, assets: 0, liabilities: 0 };

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {
  login: (data: { username_or_email: string; password: string }): Promise<APIResponse<any>> =>
    api.post('/auth/login', data),
  register: (data: { email: string; username: string; password: string; full_name: string }): Promise<APIResponse<any>> =>
    api.post('/auth/register', data),
  refreshToken: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  logout: () => api.post('/auth/logout'),
  getMe: (): Promise<User> => api.get('/auth/me').then(r => getPayload(r, null)),
  updateMe: (data: Partial<User>) => api.put('/auth/me', data).then(r => getPayload(r, null)),
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    api.put('/auth/change-password', data),
  getWorkspaces: (): Promise<Workspace[]> => api.get('/auth/workspaces').then(r => getPayload(r, [])),
};

// ─── Workspace Service ────────────────────────────────────────────────────────
export const workspaceService = {
  list: (): Promise<Workspace[]> => api.get('/workspaces').then(r => getPayload(r, [])),
  create: (data: { name: string; type: string; base_currency: string; description?: string }) =>
    api.post('/workspaces', data).then(r => getPayload(r, null)),
  get: (id: string): Promise<Workspace> => api.get(`/workspaces/${id}`).then(r => getPayload(r, null)),
  update: (id: string, data: Partial<Workspace>) =>
    api.put(`/workspaces/${id}`, data).then(r => getPayload(r, null)),
};

const DEFAULT_ACCOUNTS: Account[] = [];

// ─── Account Service ──────────────────────────────────────────────────────────
export const accountService = {
  list: (workspaceId: string): Promise<Account[]> => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/accounts`).then(r => getPayload(r, []));
  },

  create: (workspaceId: string, data: Partial<Account>) => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/accounts`, data).then(r => getPayload(r, null));
  },

  update: (workspaceId: string, id: string, data: Partial<Account>) => {
    const ws = getWsId(workspaceId);
    return api.put(`/workspaces/${ws}/accounts/${id}`, data).then(r => getPayload(r, null));
  },

  delete: (workspaceId: string, id: string) => {
    const ws = getWsId(workspaceId);
    return api.delete(`/workspaces/${ws}/accounts/${id}`);
  },

  getStatement: (workspaceId: string, id: string, params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get(`/workspaces/${workspaceId}/accounts/${id}/statement`, { params }).then((r) => getPayload(r, [])),
};

// ─── Transaction Service ──────────────────────────────────────────────────────
export type TransactionFilter = {
  type?: string; account_id?: string; category_id?: string;
  start_date?: string; end_date?: string; search?: string;
  status?: string; page?: number; size?: number;
};

export const transactionService = {
  list: (workspaceId: string, params?: TransactionFilter): Promise<PaginatedResponse<Transaction>> =>
    api.get(`/workspaces/${workspaceId}/transactions`, { params }).then(r => getPayload(r, { items: [], total: 0, page: 1, size: 50, pages: 1 })),
  create: (workspaceId: string, data: Partial<Transaction>) =>
    api.post(`/workspaces/${workspaceId}/transactions`, data).then(r => getPayload(r, null)),
  get: (workspaceId: string, id: string): Promise<Transaction> =>
    api.get(`/workspaces/${workspaceId}/transactions/${id}`).then(r => getPayload(r, null)),
  update: (workspaceId: string, id: string, data: Partial<Transaction>) =>
    api.put(`/workspaces/${workspaceId}/transactions/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/transactions/${id}`),
};

export const incomeService = {
  list: (workspaceId: string, params?: TransactionFilter) =>
    transactionService.list(workspaceId, { ...params, type: 'INCOME' }),
  create: (workspaceId: string, data: Partial<Transaction>) =>
    transactionService.create(workspaceId, { ...data, type: 'INCOME' }),
};

export const expenseService = {
  list: (workspaceId: string, params?: TransactionFilter) =>
    transactionService.list(workspaceId, { ...params, type: 'EXPENSE' }),
  create: (workspaceId: string, data: Partial<Transaction>) =>
    transactionService.create(workspaceId, { ...data, type: 'EXPENSE' }),
};

// ─── Transfer Service ─────────────────────────────────────────────────────────
export const transferService = {
  list: (workspaceId: string, params?: { page?: number; size?: number }) =>
    api.get(`/workspaces/${workspaceId}/transfers`, { params }).then(r => getPayload(r, [])),
  create: (workspaceId: string, data: { from_account_id: string; to_account_id: string; amount: number; date: string; notes?: string; fee?: number }) =>
    api.post(`/workspaces/${workspaceId}/transfers`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/transfers/${id}`),
};

// ─── Category Service ─────────────────────────────────────────────────────────
export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'cat-inc-1', name: 'Salary & Wages', type: 'INCOME', icon: 'DollarSign', color: '#16a34a' },
  { id: 'cat-inc-2', name: 'Business & Freelance', type: 'INCOME', icon: 'Briefcase', color: '#2563eb' },
  { id: 'cat-inc-3', name: 'Investments & Dividends', type: 'INCOME', icon: 'TrendingUp', color: '#8b5cf6' },
  { id: 'cat-inc-4', name: 'Rental & Real Estate', type: 'INCOME', icon: 'Home', color: '#059669' },
  { id: 'cat-inc-5', name: 'Interest & Returns', type: 'INCOME', icon: 'Percent', color: '#d97706' },
  { id: 'cat-inc-6', name: 'Refunds & Cashbacks', type: 'INCOME', icon: 'RefreshCw', color: '#0284c7' },
  { id: 'cat-inc-7', name: 'Gifts & Allowance', type: 'INCOME', icon: 'Gift', color: '#ec4899' },
  { id: 'cat-inc-8', name: 'Other Income', type: 'INCOME', icon: 'PlusCircle', color: '#64748b' },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat-exp-1', name: 'Housing & Rent', type: 'EXPENSE', icon: 'Home', color: '#dc2626' },
  { id: 'cat-exp-2', name: 'Food & Groceries', type: 'EXPENSE', icon: 'ShoppingCart', color: '#f59e0b' },
  { id: 'cat-exp-3', name: 'Utilities & Bills', type: 'EXPENSE', icon: 'Zap', color: '#2563eb' },
  { id: 'cat-exp-4', name: 'Transportation & Fuel', type: 'EXPENSE', icon: 'Car', color: '#4f46e5' },
  { id: 'cat-exp-5', name: 'Health & Medical', type: 'EXPENSE', icon: 'Heart', color: '#e11d48' },
  { id: 'cat-exp-6', name: 'Entertainment & Leisure', type: 'EXPENSE', icon: 'Film', color: '#9333ea' },
  { id: 'cat-exp-7', name: 'Shopping & Personal', type: 'EXPENSE', icon: 'ShoppingBag', color: '#06b6d4' },
  { id: 'cat-exp-8', name: 'Loans & EMI Repayments', type: 'EXPENSE', icon: 'Landmark', color: '#ea580c' },
  { id: 'cat-exp-9', name: 'Other Expense', type: 'EXPENSE', icon: 'MoreHorizontal', color: '#64748b' },
];

export const categoryService = {
  listSystem: (type?: string): Promise<Category[]> =>
    api.get('/categories', { params: { type } }).then(r => getPayload(r, [])),
  list: async (workspaceId: string, type?: string): Promise<any[]> => {
    const ws = getWsId(workspaceId);
    let categories: any[] = [];
    try {
      const res = await api.get(`/workspaces/${ws}/categories`, { params: { type } });
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) {
        categories = payload;
      }
    } catch {}

    if (categories.length === 0) {
      categories = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];
    }

    if (type) {
      return categories.filter((c: any) => c.type === type);
    }
    return categories;
  },
  create: (workspaceId: string, data: { name: string; type: string; icon?: string; color?: string }) => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/categories`, data).then(r => getPayload(r, null));
  },
  update: (workspaceId: string, id: string, data: Partial<Category>) =>
    api.put(`/workspaces/${workspaceId}/categories/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/categories/${id}`),
};

// ─── Dashboard Service ────────────────────────────────────────────────────────
export const dashboardService = {
  getSummary: (workspaceId: string, params?: { period?: string; start_date?: string; end_date?: string }) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/dashboard/summary`, { params }).then(r => getPayload(r, DEFAULT_SUMMARY));
  },

  getNetWorth: (workspaceId: string) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/dashboard/net-worth`).then(r => getPayload(r, DEFAULT_NET_WORTH));
  },

  getIncomeExpenseChart: (workspaceId: string, period = 'THIS_YEAR') =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/income-expense`, { params: { period } }).then(r => getPayload(r, [])),
  getCategoryBreakdown: (workspaceId: string, params?: { type?: string; period?: string }) =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/category-breakdown`, { params }).then(r => getPayload(r, [])),
  getAccountBalances: (workspaceId: string) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/dashboard/charts/account-balances`).then(r => getPayload(r, []));
  },
  getMonthlyCashflow: (workspaceId: string, months = 12) =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/monthly-cashflow`, { params: { months } }).then(r => getPayload(r, [])),
  getAnalytics: (workspaceId: string, period = 'THIS_MONTH') =>
    api.get(`/workspaces/${workspaceId}/dashboard/analytics`, { params: { period } }).then(r => getPayload(r, [])),
};

// ─── Investment Service ────────────────────────────────────────────────────────
export const investmentService = {
  list: (workspaceId: string): Promise<any[]> => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/investments`).then(r => getPayload(r, []));
  },

  create: (workspaceId: string, data: any) => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/investments`, data).then(r => getPayload(r, null));
  },

  update: (workspaceId: string, id: string, data: any) => {
    const ws = getWsId(workspaceId);
    return api.put(`/workspaces/${ws}/investments/${id}`, data).then(r => getPayload(r, null));
  },

  delete: (workspaceId: string, id: string) => {
    const ws = getWsId(workspaceId);
    return api.delete(`/workspaces/${ws}/investments/${id}`).then(() => true);
  },

  getPortfolio: (workspaceId: string) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/investments/portfolio/summary`).then(r => getPayload(r, null));
  },

  createSIP: (workspaceId: string, investmentId: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/investments/${investmentId}/sip`, data).then(r => getPayload(r, null)),
};

// ─── Budget Service ────────────────────────────────────────────────────────────
export const budgetService = {
  list: (workspaceId: string): Promise<Budget[]> =>
    api.get(`/workspaces/${workspaceId}/budgets`).then(r => getPayload(r, [])),
  create: (workspaceId: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/budgets`, data).then(r => getPayload(r, null)),
  update: (workspaceId: string, id: string, data: object) =>
    api.put(`/workspaces/${workspaceId}/budgets/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/budgets/${id}`),
};

// ─── Loan Service ──────────────────────────────────────────────────────────────
export const loanService = {
  list: (workspaceId: string): Promise<Loan[]> =>
    api.get(`/workspaces/${workspaceId}/loans`).then(r => getPayload(r, [])),
  create: (workspaceId: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/loans`, data).then(r => getPayload(r, null)),
  update: (workspaceId: string, id: string, data: object) =>
    api.put(`/workspaces/${workspaceId}/loans/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/loans/${id}`),
  addPayment: (workspaceId: string, loanId: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/loans/${loanId}/payments`, data).then(r => getPayload(r, null)),
  getPayments: (workspaceId: string, loanId: string) =>
    api.get(`/workspaces/${workspaceId}/loans/${loanId}/payments`).then(r => getPayload(r, [])),
};

// ─── Invoice Service ───────────────────────────────────────────────────────────
export const invoiceService = {
  list: (workspaceId: string, params?: object): Promise<PaginatedResponse<Invoice>> =>
    api.get(`/workspaces/${workspaceId}/invoices`, { params }).then(r => getPayload(r, { items: [], total: 0, page: 1, size: 50, pages: 1 })),
  create: (workspaceId: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/invoices`, data).then(r => getPayload(r, null)),
  get: (workspaceId: string, id: string): Promise<Invoice> =>
    api.get(`/workspaces/${workspaceId}/invoices/${id}`).then(r => getPayload(r, null)),
  update: (workspaceId: string, id: string, data: object) =>
    api.put(`/workspaces/${workspaceId}/invoices/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/invoices/${id}`),
  recordPayment: (workspaceId: string, id: string, data: object) =>
    api.post(`/workspaces/${workspaceId}/invoices/${id}/payments`, data).then(r => getPayload(r, null)),
  downloadPDF: (workspaceId: string, id: string) =>
    api.get(`/workspaces/${workspaceId}/invoices/${id}/pdf`, { responseType: 'blob' }),
};

// ─── Contact Service ───────────────────────────────────────────────────────────
export const contactService = {
  list: (workspaceId: string, params?: { type?: string; search?: string; page?: number }): Promise<Contact[]> =>
    api.get(`/workspaces/${workspaceId}/contacts`, { params }).then(r => getPayload(r, [])),
  create: (workspaceId: string, data: Partial<Contact>) =>
    api.post(`/workspaces/${workspaceId}/contacts`, data).then(r => getPayload(r, null)),
  get: (workspaceId: string, id: string): Promise<Contact> =>
    api.get(`/workspaces/${workspaceId}/contacts/${id}`).then(r => getPayload(r, null)),
  update: (workspaceId: string, id: string, data: Partial<Contact>) =>
    api.put(`/workspaces/${workspaceId}/contacts/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/contacts/${id}`),
};

// ─── Subscription Service ──────────────────────────────────────────────────────
export const subscriptionService = {
  list: (workspaceId: string): Promise<any[]> => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/subscriptions`).then(r => getPayload(r, []));
  },

  create: (workspaceId: string, data: Partial<Subscription>) => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/subscriptions`, data).then(r => getPayload(r, null));
  },

  update: (workspaceId: string, id: string, data: Partial<Subscription>) => {
    const ws = getWsId(workspaceId);
    return api.put(`/workspaces/${ws}/subscriptions/${id}`, data).then(r => getPayload(r, null));
  },

  delete: (workspaceId: string, id: string) => {
    const ws = getWsId(workspaceId);
    return api.delete(`/workspaces/${ws}/subscriptions/${id}`).then(() => true);
  },
};

// ─── Report Service ────────────────────────────────────────────────────────────
export const reportService = {
  income: (workspaceId: string, params: { format?: string; period?: string; start_date?: string; end_date?: string }) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/reports/income`, { params });
  },
  expense: (workspaceId: string, params: { format?: string; period?: string; start_date?: string; end_date?: string }) => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/reports/expense`, { params });
  },
  downloadCSV: async (workspaceId: string, type: 'income' | 'expense', period: string) => {
    const ws = getWsId(workspaceId);
    const res: any = await api.get(`/workspaces/${ws}/reports/${type}`, {
      params: { format: 'csv', period },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data ?? res]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── Notification Service ──────────────────────────────────────────────────────
export const notificationService = {
  list: (unreadOnly = false): Promise<Notification[]> =>
    api.get('/notifications', { params: { unread_only: unreadOnly } }).then(r => getPayload(r, [])),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const settingsService = {
  get: (workspaceId: string, key: string): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/settings/${key}`).then(r => getPayload(r, null));
  },
  save: (workspaceId: string, key: string, value: any): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/settings/${key}`, value).then(r => getPayload(r, null));
  },
  truncateWorkspace: (workspaceId: string): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/settings-action/truncate`).then(r => getPayload(r, null));
  },
  factoryReset: (workspaceId: string): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/settings-action/factory-reset`).then(r => getPayload(r, null));
  },
};

export const wishlistService = {
  list: (workspaceId: string): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.get(`/workspaces/${ws}/wishlist`).then(r => getPayload(r, []));
  },
  create: (workspaceId: string, data: any): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/wishlist`, data).then(r => getPayload(r, null));
  },
  update: (workspaceId: string, id: string, data: any): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.put(`/workspaces/${ws}/wishlist/${id}`, data).then(r => getPayload(r, null));
  },
  delete: (workspaceId: string, id: string): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.delete(`/workspaces/${ws}/wishlist/${id}`).then(r => getPayload(r, null));
  },
  purchase: (workspaceId: string, id: string, data: { account_id: string; category_id?: string; price?: number; record_expense: boolean }): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/wishlist/${id}/purchase`, data).then(r => getPayload(r, null));
  },
  recordAdvance: (workspaceId: string, id: string, data: { account_id: string; category_id?: string; amount: number; notes?: string }): Promise<any> => {
    const ws = getWsId(workspaceId);
    return api.post(`/workspaces/${ws}/wishlist/${id}/advance`, data).then(r => getPayload(r, null));
  },
};
