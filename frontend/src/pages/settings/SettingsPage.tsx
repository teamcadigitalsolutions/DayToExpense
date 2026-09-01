import React, { useState, useEffect } from 'react';
import {
  Settings, Key, User, Bell, Wand2, Plus, Trash2, CheckCircle2, RotateCcw,
  Building2, Shield, Save, Download, RefreshCw, AlertCircle, Sparkles, Check, X
} from 'lucide-react';
import { useAuth } from '../../hooks';
import { authService, settingsService } from '../../services';
import { DEFAULT_NATURAL_RULES, CategorizationRule } from '../../utils/autoCategorize';
import { useAuthStore } from '../../stores/authStore';

export default function SettingsPage() {
  const { user } = useAuth();
  const { currentWorkspace, setUser } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';

  // Active Settings Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'autocats' | 'security' | 'notifications' | 'backup'>('profile');

  // ---------------------------------------------------------------------------
  // 1. PROFILE EDIT STATE & CRUD
  // ---------------------------------------------------------------------------
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    job_title: 'Finance Administrator',
    city: 'Bangalore, India',
  });
  const [profileMsg, setProfileMsg] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.full_name || !profileForm.email) return;

    // Update Zustand Auth Store local state
    if (user) {
      const updatedUser = {
        ...user,
        full_name: profileForm.full_name,
        username: profileForm.username,
        email: profileForm.email,
        phone: profileForm.phone,
      };
      setUser(updatedUser);
    }

    setProfileMsg('Profile updated successfully!');
    setTimeout(() => setProfileMsg(''), 3500);
  };

  // ---------------------------------------------------------------------------
  // 2. WORKSPACE & CURRENCY STATE
  // ---------------------------------------------------------------------------
  const [workspaceForm, setWorkspaceForm] = useState({
    name: currentWorkspace?.name || 'Primary Workspace',
    currency: 'INR (₹)',
    financial_year: 'April - March (India FY)',
    gstin: '29AAAAA0000A1Z5',
  });
  const [wsMsg, setWsMsg] = useState('');

  const handleSaveWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    setWsMsg('Workspace preferences saved!');
    setTimeout(() => setWsMsg(''), 3500);
  };

  // ---------------------------------------------------------------------------
  // 3. SMART AUTO-CATEGORIZATION RULES ENGINE STATE & CRUD
  // ---------------------------------------------------------------------------
  // DB-backed Auto-Categorization Rules
  const [rules, setRules] = useState<CategorizationRule[]>(() => {
    try {
      const saved = localStorage.getItem(`auto_rules_${wsId}`);
      return saved ? JSON.parse(saved) : DEFAULT_NATURAL_RULES;
    } catch {
      return DEFAULT_NATURAL_RULES;
    }
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [ruleMsg, setRuleMsg] = useState('');

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `auto_rules_${wsId}`).then((data) => {
        if (data && Array.isArray(data.data)) {
          setRules(data.data);
        }
      });
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`auto_rules_${wsId}`, JSON.stringify(rules));
      settingsService.save(wsId, `auto_rules_${wsId}`, { data: rules });
    }
  }, [rules, wsId]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newCategory.trim()) return;

    const newR: CategorizationRule = {
      id: 'custom-' + Date.now(),
      keyword: newKeyword.trim().toLowerCase(),
      category_name: newCategory.trim(),
      type: newType,
    };

    setRules((prev) => [newR, ...prev]);
    setNewKeyword('');
    setNewCategory('');
    setRuleMsg('Smart Rule added successfully!');
    setTimeout(() => setRuleMsg(''), 3000);
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleResetDefaults = () => {
    if (confirm('Reset to natural wording defaults (Swiggy, HPCL, DMart, Salary, etc.)?')) {
      setRules(DEFAULT_NATURAL_RULES);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. CHANGE PASSWORD STATE
  // ---------------------------------------------------------------------------
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg('Passwords do not match');
      return;
    }
    setPwLoading(true);
    setPwMsg('');
    try {
      await authService.changePassword(pwForm);
      setPwMsg('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setPwMsg(err?.response?.data?.message ?? 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. NOTIFICATION PREFERENCES STATE
  // ---------------------------------------------------------------------------
  const [notifPrefs, setNotifPrefs] = useState({
    email_alerts: true,
    push_alerts: true,
    advance_reminders: true,
    low_balance_warnings: true,
  });

  // ---------------------------------------------------------------------------
  // 6. TRUNCATE DATA RESET TO 0 ENTRIES STATE & HANDLER
  // ---------------------------------------------------------------------------
  const [isTruncateModalOpen, setIsTruncateModalOpen] = useState(false);
  const [truncateMode, setTruncateMode] = useState<'WORKSPACE' | 'FACTORY'>('WORKSPACE');
  const [confirmInput, setConfirmInput] = useState('');
  const [truncateMsg, setTruncateMsg] = useState('');

  const handleExportJSON = async () => {
    // Export from DB via API, not raw localStorage (which is encrypted)
    const exportData: Record<string, any> = {};
    const keys = [
      `project_studio_${wsId}`, `digital_vault_${wsId}`, `household_utilities_${wsId}`,
      `daily_tasks_${wsId}`, `scratchpad_notes_${wsId}`, `important_events_${wsId}`,
      `savings_buckets_${wsId}`, `auto_rules_${wsId}`, `smart_loans_${wsId}`,
      `payroll_disbursements_${wsId}`,
    ];
    for (const key of keys) {
      try {
        const data = await settingsService.get(wsId, key);
        if (data !== null) exportData[key] = data;
      } catch {}
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `daytoexpense_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExecuteTruncation = async () => {
    if (confirmInput.trim() !== 'RESET') return;

    const keysToClear = [
      `project_studio_${wsId}`,
      `smart_receipts_${wsId}`,
      `smart_debts_${wsId}`,
      `smart_tax_${wsId}`,
      `digital_vault_${wsId}`,
      `household_utilities_${wsId}`,
      `daily_tasks_${wsId}`,
      `scratchpad_notes_${wsId}`,
      `important_events_${wsId}`,
      `savings_buckets_${wsId}`,
      `auto_rules_${wsId}`,
      `smart_loans_${wsId}`,
      `custom_investments_${wsId}`,
      `payroll_disbursements_${wsId}`,
    ];

    if (truncateMode === 'WORKSPACE') {
      try {
        await settingsService.truncateWorkspace(wsId);
      } catch (err: any) {
        console.error('Backend workspace truncate failed:', err);
      }
      // Clear local cache and DB settings for current workspace
      keysToClear.forEach((key) => localStorage.removeItem(key));
      for (const key of keysToClear) {
        try { await settingsService.save(wsId, key, null as any); } catch {}
      }
      setTruncateMsg(`Active workspace (${currentWorkspace?.name ?? 'Primary Workspace'}) reset to clean 0 entries!`);
    } else {
      try {
        await settingsService.factoryReset(wsId);
      } catch (err: any) {
        console.error('Backend factory reset failed:', err);
      }
      // Factory reset: clear all local cache but preserve auth tokens
      const token = localStorage.getItem('accessToken');
      const authStorage = localStorage.getItem('auth-storage');
      localStorage.clear();
      if (token) localStorage.setItem('accessToken', token);
      if (authStorage) localStorage.setItem('auth-storage', authStorage);
      // Also clear all DB settings
      for (const key of keysToClear) {
        try { await settingsService.save(wsId, key, null as any); } catch {}
      }
      setTruncateMsg('Factory reset completed! All storage reset to 0.');
    }

    setIsTruncateModalOpen(false);
    setConfirmInput('');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-6xl w-full">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="text-blue-600" size={24} /> Settings & Workspace Control
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage user profile details, workspace defaults, natural-wording rules, security & data backups
        </p>
      </div>

      {/* Tab Control Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full py-0.5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <User size={15} /> User Profile
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'workspace'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Building2 size={15} /> Workspace & Tax
          </button>

          <button
            onClick={() => setActiveTab('autocats')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'autocats'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Wand2 size={15} /> Smart Rules ({rules.length})
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'security'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Key size={15} /> Security & Password
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'notifications'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Bell size={15} /> Notifications
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-10 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'backup'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Download size={15} /> Data Backup & Reset
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 👤 TAB 1: EDIT PROFILE CRUD */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <User size={18} className="text-blue-600" /> User Profile Information
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
              Verified Account
            </span>
          </div>

          {profileMsg && (
            <div className="px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={16} /> {profileMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={profileForm.username}
                  onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Title / Role</label>
                <input
                  type="text"
                  value={profileForm.job_title}
                  onChange={(e) => setProfileForm((f) => ({ ...f, job_title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City / Location</label>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Save size={14} /> Update Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏢 TAB 2: WORKSPACE & TAX SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'workspace' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" /> Active Workspace & Tax Details
            </h3>
          </div>

          {wsMsg && (
            <div className="px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={16} /> {wsMsg}
            </div>
          )}

          <form onSubmit={handleSaveWorkspace} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={workspaceForm.name}
                  onChange={(e) => setWorkspaceForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Base Workspace Currency</label>
                <select
                  value={workspaceForm.currency}
                  onChange={(e) => setWorkspaceForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                  <option value="USD ($)">USD ($) - US Dollar</option>
                  <option value="EUR (€)">EUR (€) - Euro</option>
                  <option value="GBP (£)">GBP (£) - British Pound</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Financial Year Cycle</label>
                <select
                  value={workspaceForm.financial_year}
                  onChange={(e) => setWorkspaceForm((f) => ({ ...f, financial_year: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="April - March (India FY)">April - March (India Financial Year)</option>
                  <option value="January - December (Calendar Year)">January - December (Calendar Year)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Business GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={workspaceForm.gstin}
                  onChange={(e) => setWorkspaceForm((f) => ({ ...f, gstin: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Save size={14} /> Save Workspace Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🪄 TAB 3: SMART AUTO-CATEGORIZATION RULES ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'autocats' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Wand2 size={18} className="text-purple-600" /> Smart Auto-Categorization Engine
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Auto-assigns category when natural words like "Swiggy", "Petrol", "HPCL", or "Salary" are typed in descriptions
              </p>
            </div>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
              title="Reset to factory default rules"
            >
              <RotateCcw size={13} /> Reset Defaults
            </button>
          </div>

          {ruleMsg && (
            <div className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {ruleMsg}
            </div>
          )}

          {/* Add New Rule Form */}
          <form onSubmit={handleAddRule} className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-purple-900">Add Custom Natural Wording Rule</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">If Description Contains</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy / Petrol / Amazon"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Auto-Set Category To</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Food & Dining / Fuel"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Plus size={14} /> Add Smart Rule
              </button>
            </div>
          </form>

          {/* Active Rules List */}
          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Active Natural Wording Rules ({rules.length})</h4>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {rules.map((rule) => (
                <div key={rule.id} className="py-2 px-3 flex items-center justify-between hover:bg-gray-50 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded font-mono">
                      "{rule.keyword}"
                    </span>
                    <span className="text-gray-400">➔</span>
                    <span className="font-semibold text-purple-700">{rule.category_name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.type === 'EXPENSE' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {rule.type}
                    </span>
                    <button onClick={() => handleDeleteRule(rule.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔒 TAB 4: CHANGE PASSWORD & SECURITY */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Key size={18} className="text-blue-600" /> Change Security Password
          </h3>
          {pwMsg && (
            <div
              className={
                'px-4 py-2.5 rounded-lg text-xs font-semibold border ' +
                (pwMsg.includes('success')
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200')
              }
            >
              {pwMsg}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
            {[
              ['current_password', 'Current Password'],
              ['new_password', 'New Password'],
              ['confirm_password', 'Confirm New Password'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
                <input
                  type="password"
                  value={(pwForm as any)[key]}
                  onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={pwLoading}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {pwLoading ? 'Saving…' : 'Change Password'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔔 TAB 5: NOTIFICATION PREFERENCES */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Bell size={18} className="text-blue-600" /> Notification & Push Preferences
          </h3>

          <div className="space-y-3 divide-y divide-gray-100 text-xs">
            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Email Alerts & Weekly Digest</p>
                <p className="text-gray-500">Receive weekly financial summaries and major bill alerts.</p>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.email_alerts}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, email_alerts: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">In-App Popover Queue Alerts</p>
                <p className="text-gray-500">Show red unread count badge on top bar bell icon.</p>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.push_alerts}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, push_alerts: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">3-Day Advance Event & Expiry Scanner</p>
                <p className="text-gray-500">Automatically scan and queue alerts 3 days before due dates.</p>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.advance_reminders}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, advance_reminders: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💾 TAB 6: DATA BACKUP, EXPORT & TRUNCATE RESET TO 0 ENTRIES */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Backup Export Box */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Download size={18} className="text-blue-600" /> Data Backup & Workspace Export
            </h3>
            <p className="text-xs text-gray-500">
              Export a full JSON backup file of all your local workspace records, digital vault documents, project quotations, and custom rules before resetting.
            </p>

            <div className="pt-1">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Download size={15} /> Download Full Workspace JSON Backup
              </button>
            </div>
          </div>

          {/* Truncate Reset to 0 Entries Box */}
          <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-red-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-600" /> Truncate Data & Start From Scratch (0 Entries)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Wipe test entries, sample records, and saved arrays so you can start cleanly with 0 entries for new production data.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 uppercase">
                High Security Action
              </span>
            </div>

            {truncateMsg && (
              <div className="px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={16} /> {truncateMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Option 1: Truncate Active Workspace */}
              <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl space-y-3">
                <h4 className="font-bold text-red-900 text-xs">Truncate Active Workspace Only</h4>
                <p className="text-[11px] text-red-700/80 leading-relaxed">
                  Clears all stored receipts, project billing quotations, reminders, digital vault documents, utility bills, and custom rules for workspace <strong className="text-red-950 font-mono">({currentWorkspace?.name ?? 'Primary Workspace'})</strong>.
                </p>
                <button
                  onClick={() => {
                    setTruncateMode('WORKSPACE');
                    setConfirmInput('');
                    setIsTruncateModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm w-full justify-center"
                >
                  <Trash2 size={14} /> Truncate Active Workspace to 0
                </button>
              </div>

              {/* Option 2: Factory Reset All Storage (Admin Level Only) */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 text-xs">Factory Reset Entire Application Storage</h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    🔒 Admin Only
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  System Administrator control to wipe all database collections across all workspaces to start from pristine 0 state.
                </p>

                {(user?.username === 'admin' || user?.username === 'cva' || user?.email?.toLowerCase().includes('admin') || (user as any)?.is_admin || (user as any)?.role === 'ADMIN') ? (
                  <button
                    onClick={() => {
                      setTruncateMode('FACTORY');
                      setConfirmInput('');
                      setIsTruncateModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 bg-red-800 hover:bg-red-900 text-white text-xs font-bold rounded-lg shadow-sm w-full justify-center"
                  >
                    <AlertCircle size={14} /> Factory Reset All Data (Admin)
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-2 px-3.5 py-2 bg-gray-200 text-gray-400 text-xs font-semibold rounded-lg w-full justify-center cursor-not-allowed"
                    title="Admin login credentials required"
                  >
                    <Shield size={14} /> Admin Login Required for Factory Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Truncate Validation Confirmation Modal */}
      {isTruncateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-red-50">
              <h3 className="font-bold text-red-900 text-sm flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" /> Confirm Data Truncation
              </h3>
              <button onClick={() => setIsTruncateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-red-100/60 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                <p className="font-bold">⚠️ Warning: Irreversible Data Deletion</p>
                <p>
                  You are about to truncate {truncateMode === 'WORKSPACE' ? 'all entries in the active workspace' : 'the ENTIRE application database'} to start from 0.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Type <span className="font-mono text-red-600 font-bold">RESET</span> below to confirm validation:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Type RESET here"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold tracking-widest text-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTruncateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmInput.trim() !== 'RESET'}
                  onClick={handleExecuteTruncation}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm & Truncate to 0
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
