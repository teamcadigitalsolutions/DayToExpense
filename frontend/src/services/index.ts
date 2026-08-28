// src/services/index.ts — all services in one file for easy imports
import api from '../lib/axios';
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
  list: async (workspaceId: string): Promise<Account[]> => {
    const ws = workspaceId || 'ws-primary-01';
    const storageKey = `app_accounts_${ws}`;
    let localList: Account[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        localList = JSON.parse(raw);
      } else {
        localList = DEFAULT_ACCOUNTS;
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_ACCOUNTS));
      }
    } catch {
      localList = DEFAULT_ACCOUNTS;
    }

    try {
      const res = await api.get(`/workspaces/${ws}/accounts`);
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        return payload;
      }
    } catch {}

    return localList;
  },

  create: async (workspaceId: string, data: Partial<Account>) => {
    const ws = workspaceId || 'ws-primary-01';
    const storageKey = `app_accounts_${ws}`;
    const newAcc: Account = {
      id: 'acc-' + Date.now(),
      workspace_id: ws,
      name: data.name || 'New Account',
      account_type: data.account_type || 'SAVINGS',
      bank_name: data.bank_name || '',
      currency_code: data.currency_code || 'INR',
      opening_balance: Number(data.opening_balance || 0),
      current_balance: Number(data.opening_balance || 0),
      color: data.color || '#3b82f6',
      notes: data.notes || '',
      is_active: true,
    };

    let existing: Account[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      existing = raw ? JSON.parse(raw) : DEFAULT_ACCOUNTS;
    } catch {
      existing = DEFAULT_ACCOUNTS;
    }

    const updatedList = [newAcc, ...existing];
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    try {
      await api.post(`/workspaces/${ws}/accounts`, data);
    } catch {}

    return newAcc;
  },

  update: async (workspaceId: string, id: string, data: Partial<Account>) => {
    const ws = workspaceId || 'ws-primary-01';
    const storageKey = `app_accounts_${ws}`;
    let existing: Account[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      existing = raw ? JSON.parse(raw) : DEFAULT_ACCOUNTS;
    } catch {
      existing = DEFAULT_ACCOUNTS;
    }

    let updatedAccount: Account | null = null;
    const updatedList = existing.map((acc) => {
      if (acc.id === id) {
        updatedAccount = {
          ...acc,
          ...data,
          opening_balance: data.opening_balance !== undefined ? Number(data.opening_balance) : acc.opening_balance,
          current_balance: data.opening_balance !== undefined ? Number(data.opening_balance) : acc.current_balance,
        };
        return updatedAccount;
      }
      return acc;
    });

    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    try {
      await api.put(`/workspaces/${ws}/accounts/${id}`, data);
    } catch {}

    return updatedAccount ?? data;
  },

  delete: async (workspaceId: string, id: string) => {
    const ws = workspaceId || 'ws-primary-01';
    const storageKey = `app_accounts_${ws}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const list: Account[] = JSON.parse(raw);
        const filtered = list.filter((a) => a.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    } catch {}

    try {
      await api.delete(`/workspaces/${ws}/accounts/${id}`);
    } catch {}

    return true;
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
    const ws = workspaceId || 'ws-primary-01';
    let categories: any[] = [];

    try {
      const saved = localStorage.getItem(`app_categories_${ws}`);
      if (saved) {
        categories = JSON.parse(saved);
      } else {
        categories = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];
        localStorage.setItem(`app_categories_${ws}`, JSON.stringify(categories));
      }
    } catch {
      categories = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];
    }

    try {
      const res = await api.get(`/workspaces/${ws}/categories`, { params: { type } });
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) {
        categories = payload;
      }
    } catch {}

    if (type) {
      return categories.filter((c: any) => c.type === type);
    }
    return categories;
  },
  create: async (workspaceId: string, data: { name: string; type: string; icon?: string; color?: string }) => {
    const ws = workspaceId || 'ws-primary-01';
    const newCat = {
      id: 'cat-' + Date.now(),
      name: data.name,
      type: data.type,
      icon: data.icon || 'Tag',
      color: data.color || '#3b82f6',
    };

    try {
      const saved = localStorage.getItem(`app_categories_${ws}`);
      const list = saved ? JSON.parse(saved) : [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];
      const updated = [newCat, ...list];
      localStorage.setItem(`app_categories_${ws}`, JSON.stringify(updated));
    } catch {}

    try {
      const res = await api.post(`/workspaces/${ws}/categories`, data);
      return getPayload(res, newCat);
    } catch {
      return newCat;
    }
  },
  update: (workspaceId: string, id: string, data: Partial<Category>) =>
    api.put(`/workspaces/${workspaceId}/categories/${id}`, data).then(r => getPayload(r, null)),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/categories/${id}`),
};

// ─── Dashboard Service ────────────────────────────────────────────────────────
export const dashboardService = {
  getSummary: async (workspaceId: string, params?: { period?: string; start_date?: string; end_date?: string }) => {
    const ws = workspaceId || 'ws-primary-01';
    let totalBalance = 0;
    let totalInvestments = 0;
    let loanOutstanding = 0;
    let ccOutstanding = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    // 1. Account Balances
    try {
      const accs = await accountService.list(ws);
      if (Array.isArray(accs)) {
        accs.forEach((a: any) => {
          const bal = Number(a.current_balance ?? a.opening_balance ?? 0);
          if (a.account_type === 'CREDIT_CARD') {
            ccOutstanding += Math.abs(bal);
          } else if (a.account_type === 'LOAN') {
            loanOutstanding += Math.abs(bal);
          } else {
            totalBalance += bal;
          }
        });
      }
    } catch {}

    // 2. Read Smart Loans from smart_loans_${ws}
    try {
      const rawLoans = localStorage.getItem(`smart_loans_${ws}`);
      if (rawLoans) {
        const smartLoans = JSON.parse(rawLoans);
        if (Array.isArray(smartLoans)) {
          smartLoans.forEach((l: any) => {
            if (l.status === 'ACTIVE' || (Number(l.outstanding_balance) > 0 && l.status !== 'CLOSED')) {
              loanOutstanding += Number(l.outstanding_balance || 0);
            }
          });
        }
      }
    } catch {}

    // 3. Read Investments from custom_investments_${ws}
    try {
      const rawInv = localStorage.getItem(`custom_investments_${ws}`);
      if (rawInv) {
        const invs = JSON.parse(rawInv);
        if (Array.isArray(invs)) {
          invs.forEach((i: any) => {
            totalInvestments += Number(i.current_value || i.amount || 0);
          });
        }
      }
    } catch {}

    // Try backend API first, if offline use live calculated summary
    try {
      const res = await api.get(`/workspaces/${ws}/dashboard/summary`, { params });
      const payload = getPayload(res, null);
      if (payload && typeof payload === 'object' && (Number(payload.total_balance) > 0 || Number(payload.loan_outstanding) > 0)) {
        return payload;
      }
    } catch {}

    return {
      total_balance: totalBalance,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: totalBalance,
      total_investments: totalInvestments,
      investment_profit_loss: 0,
      total_receivable: 0,
      total_payable: loanOutstanding,
      credit_card_outstanding: ccOutstanding,
      loan_outstanding: loanOutstanding,
      savings_rate: 0,
      income_change_pct: 0,
      expense_change_pct: 0,
      period_label: 'This Month',
    };
  },

  getNetWorth: async (workspaceId: string) => {
    const ws = workspaceId || 'ws-primary-01';
    let assets = 0;
    let liabilities = 0;

    // Account Balances
    try {
      const accs = await accountService.list(ws);
      if (Array.isArray(accs)) {
        accs.forEach((a: any) => {
          const bal = Number(a.current_balance ?? a.opening_balance ?? 0);
          if (['CREDIT_CARD', 'LOAN'].includes(a.account_type)) {
            liabilities += Math.abs(bal);
          } else {
            assets += bal;
          }
        });
      }
    } catch {}

    // Smart Loans Outstanding Debt
    try {
      const rawLoans = localStorage.getItem(`smart_loans_${ws}`);
      if (rawLoans) {
        const smartLoans = JSON.parse(rawLoans);
        if (Array.isArray(smartLoans)) {
          smartLoans.forEach((l: any) => {
            if (l.status === 'ACTIVE' || (Number(l.outstanding_balance) > 0 && l.status !== 'CLOSED')) {
              liabilities += Number(l.outstanding_balance || 0);
            }
          });
        }
      }
    } catch {}

    // Investments
    try {
      const rawInv = localStorage.getItem(`custom_investments_${ws}`);
      if (rawInv) {
        const invs = JSON.parse(rawInv);
        if (Array.isArray(invs)) {
          invs.forEach((i: any) => {
            assets += Number(i.current_value || i.amount || 0);
          });
        }
      }
    } catch {}

    try {
      const res = await api.get(`/workspaces/${ws}/dashboard/net-worth`);
      const payload = getPayload(res, null);
      if (payload && typeof payload === 'object' && Number(payload.net_worth) > 0) {
        return payload;
      }
    } catch {}

    return { net_worth: assets - liabilities, total_assets: assets, assets, total_liabilities: liabilities, liabilities };
  },

  getIncomeExpenseChart: (workspaceId: string, period = 'THIS_YEAR') =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/income-expense`, { params: { period } }).then(r => getPayload(r, [])),
  getCategoryBreakdown: (workspaceId: string, params?: { type?: string; period?: string }) =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/category-breakdown`, { params }).then(r => getPayload(r, [])),
  getAccountBalances: async (workspaceId: string) => {
    const ws = workspaceId || 'ws-primary-01';
    try {
      const accs = await accountService.list(ws);
      if (Array.isArray(accs) && accs.length > 0) {
        return accs.map((a: any) => ({
          account_id: a.id,
          account_name: a.name,
          account_type: a.account_type,
          current_balance: Number(a.current_balance ?? a.opening_balance ?? 0),
          color: a.color || '#3b82f6',
        }));
      }
    } catch {}

    try {
      const res = await api.get(`/workspaces/${ws}/dashboard/charts/account-balances`);
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) return payload;
    } catch {}

    return [];
  },
  getMonthlyCashflow: (workspaceId: string, months = 12) =>
    api.get(`/workspaces/${workspaceId}/dashboard/charts/monthly-cashflow`, { params: { months } }).then(r => getPayload(r, [])),
  getAnalytics: (workspaceId: string, period = 'THIS_MONTH') =>
    api.get(`/workspaces/${workspaceId}/dashboard/analytics`, { params: { period } }).then(r => getPayload(r, [])),
};

// ─── Investment Service ────────────────────────────────────────────────────────
export const investmentService = {
  list: async (workspaceId: string): Promise<any[]> => {
    const ws = workspaceId || 'ws-primary-01';
    let invs: any[] = [];

    try {
      const saved = localStorage.getItem(`custom_investments_${ws}`);
      if (saved) {
        invs = JSON.parse(saved);
      } else {
        invs = [];
        localStorage.setItem(`custom_investments_${ws}`, JSON.stringify(invs));
      }
    } catch {}

    try {
      const res = await api.get(`/workspaces/${ws}/investments`);
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) return payload;
    } catch {}

    return invs;
  },

  create: async (workspaceId: string, data: any) => {
    const ws = workspaceId || 'ws-primary-01';
    const invested = Number(data.invested_amount || data.amount || 0);
    const currentVal = data.current_value ? Number(data.current_value) : invested;
    const pnl = currentVal - invested;
    const retPct = invested > 0 ? (pnl / invested) * 100 : 0;

    const newInv = {
      id: 'inv-' + Date.now(),
      name: data.name || 'Investment',
      type: data.type || 'MUTUAL_FUND',
      institution: data.institution || 'Broker / Bank',
      invested_amount: invested,
      current_value: currentVal,
      profit_loss: pnl,
      return_pct: retPct,
      purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
      notes: data.notes || '',
    };

    try {
      const saved = localStorage.getItem(`custom_investments_${ws}`);
      const list = saved ? JSON.parse(saved) : [];
      const updated = [newInv, ...list];
      localStorage.setItem(`custom_investments_${ws}`, JSON.stringify(updated));
    } catch {}

    try {
      const res = await api.post(`/workspaces/${ws}/investments`, data);
      return getPayload(res, newInv);
    } catch {
      return newInv;
    }
  },

  update: async (workspaceId: string, id: string, data: any) => {
    const ws = workspaceId || 'ws-primary-01';
    let updatedInv: any = null;

    try {
      const saved = localStorage.getItem(`custom_investments_${ws}`);
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.map((inv: any) => {
          if (inv.id === id) {
            const invested = Number(data.invested_amount ?? inv.invested_amount ?? 0);
            const currentVal = Number(data.current_value ?? inv.current_value ?? invested);
            const pnl = currentVal - invested;
            const retPct = invested > 0 ? (pnl / invested) * 100 : 0;
            updatedInv = { ...inv, ...data, invested_amount: invested, current_value: currentVal, profit_loss: pnl, return_pct: retPct };
            return updatedInv;
          }
          return inv;
        });
        localStorage.setItem(`custom_investments_${ws}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const res = await api.put(`/workspaces/${ws}/investments/${id}`, data);
      return getPayload(res, updatedInv);
    } catch {
      return updatedInv;
    }
  },

  delete: async (workspaceId: string, id: string) => {
    const ws = workspaceId || 'ws-primary-01';

    try {
      const saved = localStorage.getItem(`custom_investments_${ws}`);
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.filter((inv: any) => inv.id !== id);
        localStorage.setItem(`custom_investments_${ws}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      await api.delete(`/workspaces/${ws}/investments/${id}`);
    } catch {}

    return true;
  },

  getPortfolio: async (workspaceId: string) => {
    const ws = workspaceId || 'ws-primary-01';
    const list = await investmentService.list(ws);
    const totalInvested = list.reduce((s: number, i: any) => s + Number(i.invested_amount || 0), 0);
    const totalValue = list.reduce((s: number, i: any) => s + Number(i.current_value || i.invested_amount || 0), 0);
    const profitLoss = totalValue - totalInvested;
    const returnPct = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    return {
      total_invested: totalInvested,
      current_value: totalValue,
      total_value: totalValue,
      total_profit_loss: profitLoss,
      profit_loss: profitLoss,
      total_return_pct: returnPct,
      return_pct: returnPct,
    };
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
  list: async (workspaceId: string): Promise<any[]> => {
    const ws = workspaceId || 'ws-primary-01';
    let subs: any[] = [];

    try {
      const saved = localStorage.getItem(`app_subscriptions_${ws}`);
      if (saved) {
        subs = JSON.parse(saved);
      } else {
        subs = [];
        localStorage.setItem(`app_subscriptions_${ws}`, JSON.stringify(subs));
      }
    } catch {}

    try {
      const res = await api.get(`/workspaces/${ws}/subscriptions`);
      const payload = getPayload(res, []);
      if (Array.isArray(payload) && payload.length > 0) return payload;
    } catch {}

    return subs;
  },

  create: async (workspaceId: string, data: Partial<Subscription>) => {
    const ws = workspaceId || 'ws-primary-01';
    const newSub = {
      id: 'sub-' + Date.now(),
      name: data.name || 'Subscription',
      amount: Number(data.amount || 0),
      billing_cycle: data.billing_cycle || 'MONTHLY',
      next_billing_date: data.next_billing_date || new Date().toISOString().split('T')[0],
      reminder_days: Number(data.reminder_days || 3),
      status: data.status || 'ACTIVE',
      notes: data.notes || '',
    };

    try {
      const saved = localStorage.getItem(`app_subscriptions_${ws}`);
      const list = saved ? JSON.parse(saved) : [];
      const updated = [newSub, ...list];
      localStorage.setItem(`app_subscriptions_${ws}`, JSON.stringify(updated));
    } catch {}

    try {
      const res = await api.post(`/workspaces/${ws}/subscriptions`, data);
      return getPayload(res, newSub);
    } catch {
      return newSub;
    }
  },

  update: async (workspaceId: string, id: string, data: Partial<Subscription>) => {
    const ws = workspaceId || 'ws-primary-01';
    let updatedSub: any = null;

    try {
      const saved = localStorage.getItem(`app_subscriptions_${ws}`);
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.map((s: any) => {
          if (s.id === id) {
            updatedSub = { ...s, ...data };
            return updatedSub;
          }
          return s;
        });
        localStorage.setItem(`app_subscriptions_${ws}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const res = await api.put(`/workspaces/${ws}/subscriptions/${id}`, data);
      return getPayload(res, updatedSub);
    } catch {
      return updatedSub;
    }
  },

  delete: async (workspaceId: string, id: string) => {
    const ws = workspaceId || 'ws-primary-01';

    try {
      const saved = localStorage.getItem(`app_subscriptions_${ws}`);
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.filter((s: any) => s.id !== id);
        localStorage.setItem(`app_subscriptions_${ws}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      await api.delete(`/workspaces/${ws}/subscriptions/${id}`);
    } catch {}

    return true;
  },
};

// ─── Report Service ────────────────────────────────────────────────────────────
export const reportService = {
  income: (workspaceId: string, params: { format?: string; period?: string; start_date?: string; end_date?: string }) =>
    api.get(`/workspaces/${workspaceId}/reports/income`, { params }),
  expense: (workspaceId: string, params: { format?: string; period?: string }) =>
    api.get(`/workspaces/${workspaceId}/reports/expense`, { params }),
  downloadCSV: async (workspaceId: string, type: 'income' | 'expense', period: string) => {
    const res: any = await api.get(`/workspaces/${workspaceId}/reports/${type}`, {
      params: { format: 'csv', period },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data ?? res]));
    const a = document.createElement('a');
    a.href = url; a.download = `${type}_report.csv`; a.click();
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
