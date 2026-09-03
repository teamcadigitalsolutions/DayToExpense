// src/App.tsx - Complete router configuration
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ProtectedRoute } from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';

// Lazy load all other pages for performance
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'));
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage'));
const IncomePage = lazy(() => import('./pages/income/IncomePage'));
const ExpensesPage = lazy(() => import('./pages/expenses/ExpensesPage'));
const TransfersPage = lazy(() => import('./pages/transfers/TransfersPage'));
const InvestmentsPage = lazy(() => import('./pages/investments/InvestmentsPage'));
const BudgetsPage = lazy(() => import('./pages/budgets/BudgetsPage'));
const LoansPage = lazy(() => import('./pages/loans/LoansPage'));
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage'));
const ContactsPage = lazy(() => import('./pages/contacts/ContactsPage'));
const SubscriptionsPage = lazy(() => import('./pages/subscriptions/SubscriptionsPage'));
const PayrollPage = lazy(() => import('./pages/payroll/PayrollPage'));
const RemindersPage = lazy(() => import('./pages/reminders/RemindersPage'));
const DigitalVaultLifeCenterPage = lazy(() => import('./pages/vault/DigitalVaultLifeCenterPage'));
const CashFlowPlannerPage = lazy(() => import('./pages/predictions/CashFlowPlannerPage'));
const ProjectStudioPage = lazy(() => import('./pages/projects/ProjectStudioPage'));
const SmartHubPage = lazy(() => import('./pages/hub/SmartHubPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const WishlistPage = lazy(() => import('./pages/wishlist/WishlistPage'));
const HealthPage = lazy(() => import('./pages/health/HealthPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/accounts" element={<Suspense fallback={<PageLoader />}><AccountsPage /></Suspense>} />
                <Route path="/health" element={<Suspense fallback={<PageLoader />}><HealthPage /></Suspense>} />
                <Route path="/transactions" element={<Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>} />
                <Route path="/income" element={<Suspense fallback={<PageLoader />}><IncomePage /></Suspense>} />
                <Route path="/expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
                <Route path="/transfers" element={<Suspense fallback={<PageLoader />}><TransfersPage /></Suspense>} />
                <Route path="/investments" element={<Suspense fallback={<PageLoader />}><InvestmentsPage /></Suspense>} />
                <Route path="/budgets" element={<Suspense fallback={<PageLoader />}><BudgetsPage /></Suspense>} />
                <Route path="/loans" element={<Suspense fallback={<PageLoader />}><LoansPage /></Suspense>} />
                <Route path="/invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
                <Route path="/contacts" element={<Suspense fallback={<PageLoader />}><ContactsPage /></Suspense>} />
                <Route path="/subscriptions" element={<Suspense fallback={<PageLoader />}><SubscriptionsPage /></Suspense>} />
                <Route path="/payroll" element={<Suspense fallback={<PageLoader />}><PayrollPage /></Suspense>} />
                <Route path="/reminders" element={<Suspense fallback={<PageLoader />}><RemindersPage /></Suspense>} />
                <Route path="/vault" element={<Suspense fallback={<PageLoader />}><DigitalVaultLifeCenterPage /></Suspense>} />
                <Route path="/planner" element={<Suspense fallback={<PageLoader />}><CashFlowPlannerPage /></Suspense>} />
                <Route path="/projects" element={<Suspense fallback={<PageLoader />}><ProjectStudioPage /></Suspense>} />
                <Route path="/hub" element={<Suspense fallback={<PageLoader />}><SmartHubPage /></Suspense>} />
                <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                <Route path="/wishlist" element={<Suspense fallback={<PageLoader />}><WishlistPage /></Suspense>} />
              </Route>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
