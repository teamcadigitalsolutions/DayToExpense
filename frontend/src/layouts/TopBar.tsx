import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Check, Archive, Trash2, CheckCheck, X, Calendar, AlertCircle, RefreshCw, Landmark, ExternalLink,
  User, Settings, Key, LogOut, ShieldCheck, Database, Wand2, Building2, Menu, Mic, FileText, Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks';
import { useNotificationStore, AppNotification } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import ReceiptOCRModal from '../components/ReceiptOCRModal';
import VoiceTextLoggerModal from '../components/VoiceTextLoggerModal';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'All Transactions',
  '/income': 'Income',
  '/expenses': 'Expenses',
  '/transfers': 'Transfers',
  '/investments': 'Investments',
  '/budgets': 'Budgets',
  '/loans': 'Loans & EMI',
  '/invoices': 'Invoices',
  '/contacts': 'Contacts',
  '/subscriptions': 'Subscriptions',
  '/reminders': 'Important Dates & Reminders',
  '/vault': 'Digital Vault & Life Operations Hub',
  '/planner': 'Cash Flow Predictor & Goal Buckets',
  '/projects': 'Project Milestone Billing & WhatsApp Studio',
  '/hub': 'Smart Financial Hub & Utilities',
  '/payroll': 'Payroll & HR',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentWorkspace } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const wsId = currentWorkspace?.id ?? 'default';

  const title = PAGE_TITLES[pathname] ?? 'DayToExpense';

  // Notification Store
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    clearAll,
    syncDynamicNotifications,
  } = useNotificationStore();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'UNREAD' | 'ALL' | 'ARCHIVED'>('UNREAD');

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Sync expiry-based notifications on mount or workspace change
  useEffect(() => {
    if (wsId) {
      syncDynamicNotifications(wsId);
    }
  }, [wsId, syncDynamicNotifications]);

  // Click outside listener to close popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.is_archived).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'UNREAD') return !n.is_read && !n.is_archived;
    if (filterTab === 'ARCHIVED') return n.is_archived;
    return !n.is_archived;
  });

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'REMINDER': return <Calendar size={14} className="text-amber-600" />;
      case 'SUBSCRIPTION': return <RefreshCw size={14} className="text-purple-600" />;
      case 'PAYROLL': return <Landmark size={14} className="text-green-600" />;
      case 'DEBT': return <AlertCircle size={14} className="text-red-600" />;
      default: return <Bell size={14} className="text-blue-600" />;
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 relative z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden flex-shrink-0"
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-sm sm:text-lg font-semibold text-gray-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* AI Voice Logger Shortcut */}
        <button
          onClick={() => setIsVoiceOpen(true)}
          className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-all shadow-sm"
          title="AI Voice & Natural Language Logger"
        >
          <Mic size={14} className="text-purple-600 animate-pulse" />
          <span className="hidden sm:inline">AI Voice</span>
        </button>

        {/* AI Receipt Scanner Shortcut */}
        <button
          onClick={() => setIsOcrOpen(true)}
          className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-all shadow-sm"
          title="AI Receipt & Bill OCR Scanner"
        >
          <FileText size={14} className="text-blue-600" />
          <span className="hidden sm:inline">AI Scan</span>
        </button>

        {/* Notification Bell Icon & Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            className={`relative p-2 rounded-lg transition-colors ${
              isNotifOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Notification Center"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Interactive Popover Queue Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-blue-600" />
                  <span className="font-bold text-gray-900 text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <button onClick={() => setIsNotifOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>

              {/* Toolbar Tabs */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white text-xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFilterTab('UNREAD')}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                      filterTab === 'UNREAD' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('ALL')}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                      filterTab === 'ALL' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setFilterTab('ARCHIVED')}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                      filterTab === 'ARCHIVED' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Archived
                  </button>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} /> Read All
                  </button>
                )}
              </div>

              {/* Notification List Queue */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold text-gray-600">No {filterTab.toLowerCase()} notifications</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">You're all caught up!</p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3.5 flex items-start gap-3 transition-colors ${
                        !notif.is_read ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-gray-100 flex-shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs font-bold text-gray-900 truncate ${!notif.is_read ? 'text-blue-900' : ''}`}>
                            {notif.title}
                          </h4>
                          {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                        </div>

                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{notif.message}</p>

                        <div className="flex items-center justify-between pt-2 mt-1 text-[10px] text-gray-400">
                          <span className="font-mono">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <div className="flex items-center gap-2">
                            {notif.link && (
                              <button
                                onClick={() => {
                                  markAsRead(notif.id);
                                  setIsNotifOpen(false);
                                  navigate(notif.link!);
                                }}
                                className="flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                              >
                                View <ExternalLink size={10} />
                              </button>
                            )}

                            {!notif.is_read && (
                              <button onClick={() => markAsRead(notif.id)} className="hover:text-blue-600" title="Mark as read">
                                <Check size={13} />
                              </button>
                            )}

                            {!notif.is_archived ? (
                              <button onClick={() => archiveNotification(notif.id)} className="hover:text-purple-600" title="Archive">
                                <Archive size={13} />
                              </button>
                            ) : (
                              <button onClick={() => deleteNotification(notif.id)} className="hover:text-red-600" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{notifications.length} Total Logs</span>
                  <button onClick={clearAll} className="text-red-600 font-medium hover:underline text-[11px]">
                    Clear All Notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Avatar & Dropdown Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setIsProfileOpen((prev) => !prev);
              setIsNotifOpen(false);
            }}
            className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none"
            title="User Profile & Settings"
          >
            {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* User Header */}
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                    {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{user?.full_name ?? 'Admin User'}</p>
                    <p className="text-[11px] text-gray-500 truncate">@{user?.username ?? 'admin'}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full">
                      Secured Account
                    </span>
                  </div>
                </div>
              </div>

              {/* Workspace Info */}
              <div className="px-4 py-2 bg-blue-50/50 border-b border-gray-100 text-xs flex items-center justify-between text-blue-900">
                <span className="flex items-center gap-1 font-medium">
                  <Building2 size={13} className="text-blue-600" /> Active Workspace:
                </span>
                <span className="font-bold truncate max-w-[110px]">{currentWorkspace?.name ?? 'Primary Workspace'}</span>
              </div>

              {/* Quick Actions Menu */}
              <div className="p-1.5 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  <User size={15} className="text-gray-500" /> My Profile & Details
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  <Wand2 size={15} className="text-purple-600" /> Smart Auto-Categorization
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  <Key size={15} className="text-amber-600" /> Change Password
                </button>
              </div>

              {/* Sign Out Button */}
              <div className="p-1.5 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors text-xs"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Modals */}
      <ReceiptOCRModal isOpen={isOcrOpen} onClose={() => setIsOcrOpen(false)} />
      <VoiceTextLoggerModal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} />
    </header>
  );
}
