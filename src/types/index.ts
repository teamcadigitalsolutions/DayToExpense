export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified?: boolean;
  last_login?: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: string;
  base_currency: string;
  member_role?: string;
  description?: string;
  owner_id?: string;
  is_active?: boolean;
  gstin?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  invoice_prefix?: string;
}

export interface Account {
  id: string;
  workspace_id: string;
  name: string;
  account_type: string;
  bank_name?: string;
  account_number_masked?: string;
  current_balance: number;
  opening_balance?: number;
  currency_code: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  credit_limit?: number;
  billing_date?: number;
  due_date?: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  account_id: string;
  category_id?: string;
  subcategory_id?: string;
  type: string;
  amount: number;
  currency_code: string;
  date: string;
  description: string;
  notes?: string;
  reference_number?: string;
  payment_method?: string;
  status: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  account_name?: string;
  tags?: string[];
  is_recurring?: boolean;
}

export interface Category {
  id: string;
  workspace_id?: string;
  name: string;
  icon?: string;
  color?: string;
  type: string;
  is_system: boolean;
  is_active?: boolean;
  sort_order?: number;
  subcategories?: any[];
}

export interface Transfer {
  id: string;
  workspace_id?: string;
  from_account_id: string;
  to_account_id: string;
  from_account_name?: string;
  to_account_name?: string;
  amount: number;
  fee?: number;
  date: string;
  reference?: string;
  notes?: string;
}

export interface Investment {
  id: string;
  workspace_id?: string;
  name: string;
  type: string;
  institution?: string;
  account_id?: string;
  invested_amount: number;
  current_value?: number;
  purchase_date?: string;
  maturity_date?: string;
  profit_loss?: number;
  return_pct?: number;
  is_active?: boolean;
}

export interface Budget {
  id: string;
  workspace_id?: string;
  name: string;
  period: string;
  start_date: string;
  end_date?: string;
  is_active?: boolean;
  total_allocated?: number;
  total_spent?: number;
  categories: BudgetCategoryStatus[];
}

export interface BudgetCategoryStatus {
  id?: string;
  category_id: string;
  category_name: string;
  category_color?: string;
  category_icon?: string;
  allocated_amount: number;
  spent_amount: number;
  remaining?: number;
  percentage_used?: number;
}

export interface Loan {
  id: string;
  workspace_id?: string;
  name: string;
  type: string;
  institution?: string;
  principal: number;
  interest_rate: number;
  tenure_months?: number;
  emi_amount: number;
  start_date: string;
  end_date?: string;
  outstanding_balance: number;
  total_paid: number;
  interest_paid?: number;
  status: string;
  notes?: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct?: number;
  tax_rate?: number;
  amount: number;
}

export interface Invoice {
  id: string;
  workspace_id?: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  date: string;
  due_date: string;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total: number;
  paid_amount: number;
  balance: number;
  status: string;
  currency_code?: string;
  notes?: string;
  items?: InvoiceItem[];
}

export interface Contact {
  id: string;
  workspace_id?: string;
  type: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  is_active?: boolean;
}

export interface Subscription {
  id: string;
  workspace_id?: string;
  name: string;
  amount: number;
  currency_code?: string;
  billing_cycle: string;
  next_billing_date: string;
  account_id?: string;
  category_id?: string;
  status: string;
  reminder_days?: number;
  notes?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardSummary {
  total_balance: number;
  total_income: number;
  total_expense: number;
  net_cash_flow: number;
  total_investments: number;
  investment_profit_loss: number;
  total_receivable: number;
  total_payable: number;
  credit_card_outstanding?: number;
  loan_outstanding?: number;
  savings_rate?: number;
  income_change_pct?: number;
  expense_change_pct?: number;
  period_label?: string;
}

export interface LoginRequest {
  username_or_email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface APIResponse<T> {
  status: number;
  isSuccess: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
