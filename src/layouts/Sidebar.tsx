// src/layouts/Sidebar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, ArrowRightLeft, TrendingUp, TrendingDown,
  RefreshCw, BarChart2, Target, Landmark, FileText, Users, Bell, BellRing, Sparkles, FolderKanban, Shield,
  Settings, LogOut, ChevronLeft, ChevronRight, Repeat,
  ChevronsUpDown, Building2, ShoppingBag
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useAuth } from '../hooks';

const navItems = [
  { section: 'Overview', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Accounts', icon: Wallet, path: '/accounts' },
  ]},
  { section: 'Money Flow', items: [
    { label: 'Income', icon: TrendingUp, path: '/income' },
    { label: 'Expenses', icon: TrendingDown, path: '/expenses' },
    { label: 'Transfers', icon: RefreshCw, path: '/transfers' },
    { label: 'All Transactions', icon: ArrowRightLeft, path: '/transactions' },
  ]},
  { section: 'Planning', items: [
    { label: 'Cash Flow & Goals', icon: TrendingUp, path: '/planner' },
    { label: 'Budgets', icon: Target, path: '/budgets' },
    { label: 'Investments', icon: BarChart2, path: '/investments' },
    { label: 'Loans & EMI', icon: Landmark, path: '/loans' },
    { label: 'Subscriptions', icon: Repeat, path: '/subscriptions' },
  ]},
  { section: 'Personal', items: [
    { label: 'Digital Vault & Life Hub', icon: Shield, path: '/vault' },
    { label: 'Important Dates', icon: BellRing, path: '/reminders' },
    { label: 'Shopping Wishlist', icon: ShoppingBag, path: '/wishlist' },
  ]},
  { section: 'Business', items: [
    { label: 'Project Billing Studio', icon: FolderKanban, path: '/projects' },
    { label: 'Smart Hub & Tools', icon: Sparkles, path: '/hub' },
    { label: 'Invoices', icon: FileText, path: '/invoices' },
    { label: 'Payroll & HR', icon: Users, path: '/payroll' },
    { label: 'Contacts', icon: Building2, path: '/contacts' },
    { label: 'Reports', icon: BarChart2, path: '/reports' },
  ]},
];

export default function Sidebar() {
  const { user, currentWorkspace, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const handleNavClick = () => {
    if (window.innerWidth < 1024 && !sidebarCollapsed) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!sidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={clsx(
          'flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 h-screen sticky top-0 flex-shrink-0 z-50 overflow-hidden',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0',
          sidebarCollapsed ? 'w-16 max-lg:-translate-x-full' : 'w-60 max-lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-slate-700 min-h-[60px]">
          {sidebarCollapsed ? (
            <span className="font-black text-blue-400 text-lg tracking-tight mx-auto">D</span>
          ) : (
            <span className="font-bold text-base text-white tracking-tight truncate">DayToExpense</span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Workspace badge */}
        {!sidebarCollapsed && currentWorkspace && (
          <div className="mx-3 mt-3 mb-1 px-3 py-2 bg-slate-800 rounded-lg flex items-center gap-2">
            <Building2 size={14} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs text-slate-300 truncate">{currentWorkspace.name}</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1 scrollbar-thin">
          {navItems.map((section) => (
            <div key={section.section}>
              {!sidebarCollapsed && (
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 py-2 mt-2">
                  {section.section}
                </p>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                    sidebarCollapsed && 'justify-center'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon size={16} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 p-2 space-y-1">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              sidebarCollapsed && 'justify-center'
            )}
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings size={16} />
            {!sidebarCollapsed && <span>Settings</span>}
          </NavLink>
          <button
            onClick={logout}
            className={clsx(
              'w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            <LogOut size={16} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>

          {!sidebarCollapsed && user && (
            <div className="px-2.5 py-2 mt-1 border-t border-slate-700">
              <p className="text-xs font-medium text-slate-200 truncate">{user.full_name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
