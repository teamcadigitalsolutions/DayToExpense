import api from '../lib/axios';

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

export const dashboardService = {
  getSummary: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/summary`, { params });
      return res ?? DEFAULT_SUMMARY;
    } catch {
      return DEFAULT_SUMMARY;
    }
  },
  getIncomeExpenseChart: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/income-expense`, { params });
      return res ?? [];
    } catch {
      return [];
    }
  },
  getCategoryBreakdown: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/categories`, { params });
      return res ?? [];
    } catch {
      return [];
    }
  },
  getAccountBalances: async (workspaceId: string) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/balances`);
      return res ?? [];
    } catch {
      return [];
    }
  },
  getNetWorthTrend: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/net-worth`, { params });
      return res ?? [];
    } catch {
      return [];
    }
  },
  getMonthlyCashflow: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/cashflow`, { params });
      return res ?? [];
    } catch {
      return [];
    }
  },
  getAnalytics: async (workspaceId: string, params?: any) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/analytics`, { params });
      return res ?? [];
    } catch {
      return [];
    }
  },
  getNetWorth: async (workspaceId: string) => {
    try {
      const res: any = await api.get(`/workspaces/${workspaceId}/dashboard/net-worth`);
      return res ?? DEFAULT_NET_WORTH;
    } catch {
      return DEFAULT_NET_WORTH;
    }
  },
};
