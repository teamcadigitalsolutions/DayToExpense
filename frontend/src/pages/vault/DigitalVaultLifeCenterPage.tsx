import React, { useState, useEffect } from 'react';
import {
  FileCheck, Shield, Zap, CheckSquare, Plus, Search, Trash2, Edit2, X,
  Calendar, AlertTriangle, ExternalLink, Check, Copy, Sparkles, Building2, Phone, Download, Clock
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

// --- Types ---
export interface VaultDocument {
  id: string;
  title: string;
  category: 'PASSPORT' | 'DRIVING_LICENSE' | 'VEHICLE_RC' | 'INSURANCE' | 'AADHAAR_PAN' | 'PROPERTY_DEED' | 'OTHER';
  doc_number: string;
  issue_date?: string;
  expiry_date?: string;
  holder_name: string;
  notes?: string;
  file_name?: string;
}

export interface HouseholdUtility {
  id: string;
  name: string;
  category: 'ELECTRICITY' | 'WATER' | 'GAS_CYLINDER' | 'WIFI_BROADBAND' | 'MAID_COOK_SALARY' | 'DTH_CABLE' | 'RENT';
  consumer_number: string;
  vendor_contact: string;
  monthly_cost: number;
  due_day_of_month: number;
  status: 'PAID' | 'DUE' | 'OVERDUE';
  last_paid_date?: string;
}

export interface DailyTaskItem {
  id: string;
  title: string;
  category: 'SHOPPING_LIST' | 'DAILY_TODO' | 'FINANCIAL_NOTE' | 'WORK';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  is_completed: boolean;
  due_date?: string;
}

export default function DigitalVaultLifeCenterPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';
  const { formatAmount } = useCurrency();

  const [activeTab, setActiveTab] = useState<'vault' | 'utilities' | 'checklist'>('vault');

  // ===========================================================================
  // 1. DIGITAL VAULT STATE & CRUD
  // ===========================================================================
  const [documents, setDocuments] = useState<VaultDocument[]>(() => {
    try {
      const saved = localStorage.getItem(`digital_vault_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({
    title: '',
    category: 'PASSPORT' as VaultDocument['category'],
    doc_number: '',
    issue_date: '',
    expiry_date: '',
    holder_name: '',
    notes: '',
  });

  useEffect(() => {
    if (wsId) localStorage.setItem(`digital_vault_${wsId}`, JSON.stringify(documents));
  }, [documents, wsId]);

  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.title || !docForm.doc_number) return;

    if (editingDocId) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === editingDocId ? { ...d, ...docForm } : d))
      );
    } else {
      const newD: VaultDocument = {
        id: 'doc-' + Date.now(),
        ...docForm,
        file_name: 'document_scan.pdf',
      };
      setDocuments((prev) => [newD, ...prev]);
    }
    setIsDocModalOpen(false);
    setEditingDocId(null);
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm('Delete this stored document record?')) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  // Expiry Warning Scanner
  const getDaysUntilExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ===========================================================================
  // 2. HOUSEHOLD UTILITY BILLS & MAID PAYMENTS STATE & CRUD
  // ===========================================================================
  const [utilities, setUtilities] = useState<HouseholdUtility[]>(() => {
    try {
      const saved = localStorage.getItem(`household_utilities_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isUtilModalOpen, setIsUtilModalOpen] = useState(false);
  const [editingUtilId, setEditingUtilId] = useState<string | null>(null);
  const [utilForm, setUtilForm] = useState({
    name: '',
    category: 'ELECTRICITY' as HouseholdUtility['category'],
    consumer_number: '',
    vendor_contact: '',
    monthly_cost: '',
    due_day_of_month: '5',
    status: 'DUE' as HouseholdUtility['status'],
  });

  useEffect(() => {
    if (wsId) localStorage.setItem(`household_utilities_${wsId}`, JSON.stringify(utilities));
  }, [utilities, wsId]);

  const handleSaveUtil = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utilForm.name || !utilForm.monthly_cost) return;

    if (editingUtilId) {
      setUtilities((prev) =>
        prev.map((u) =>
          u.id === editingUtilId
            ? {
                ...u,
                name: utilForm.name,
                category: utilForm.category,
                consumer_number: utilForm.consumer_number,
                vendor_contact: utilForm.vendor_contact,
                monthly_cost: parseFloat(utilForm.monthly_cost),
                due_day_of_month: parseInt(utilForm.due_day_of_month, 10),
                status: utilForm.status,
              }
            : u
        )
      );
    } else {
      const newU: HouseholdUtility = {
        id: 'util-' + Date.now(),
        name: utilForm.name,
        category: utilForm.category,
        consumer_number: utilForm.consumer_number,
        vendor_contact: utilForm.vendor_contact,
        monthly_cost: parseFloat(utilForm.monthly_cost),
        due_day_of_month: parseInt(utilForm.due_day_of_month, 10),
        status: utilForm.status,
      };
      setUtilities((prev) => [newU, ...prev]);
    }
    setIsUtilModalOpen(false);
    setEditingUtilId(null);
  };

  const handleToggleUtilPaid = (id: string) => {
    setUtilities((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const nextStatus: HouseholdUtility['status'] = u.status === 'PAID' ? 'DUE' : 'PAID';
        return {
          ...u,
          status: nextStatus,
          last_paid_date: nextStatus === 'PAID' ? new Date().toISOString().split('T')[0] : u.last_paid_date,
        };
      })
    );
  };

  const handleDeleteUtil = (id: string) => {
    if (confirm('Delete this utility/maid payment entry?')) {
      setUtilities((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const totalMonthlyUtilitiesCost = utilities.reduce((sum, u) => sum + u.monthly_cost, 0);

  // ===========================================================================
  // 3. DAILY CHECKLIST, SHOPPING & SCRATCHPAD STATE & CRUD
  // ===========================================================================
  const [tasks, setTasks] = useState<DailyTaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(`daily_tasks_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [scratchpadText, setScratchpadText] = useState<string>(() => {
    return localStorage.getItem(`scratchpad_notes_${wsId}`) || '';
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    category: 'SHOPPING_LIST' as DailyTaskItem['category'],
    priority: 'MEDIUM' as DailyTaskItem['priority'],
  });

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`daily_tasks_${wsId}`, JSON.stringify(tasks));
      localStorage.setItem(`scratchpad_notes_${wsId}`, scratchpadText);
    }
  }, [tasks, scratchpadText, wsId]);

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title) return;

    const newT: DailyTaskItem = {
      id: 'task-' + Date.now(),
      title: taskForm.title,
      category: taskForm.category,
      priority: taskForm.priority,
      is_completed: false,
    };

    setTasks((prev) => [newT, ...prev]);
    setIsTaskModalOpen(false);
    setTaskForm({ title: '', category: 'SHOPPING_LIST', priority: 'MEDIUM' });
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t)));
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={24} /> Digital Vault & Household Operations Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Store critical document numbers, manage monthly household utilities & maid salaries, and maintain scratchpad checklists
          </p>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'vault' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield size={15} /> 🗄️ Document Vault ({documents.length})
          </button>

          <button
            onClick={() => setActiveTab('utilities')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'utilities' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Zap size={15} /> ⚡ Utility Bills & Maid Hub ({utilities.length})
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'checklist' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CheckSquare size={15} /> 📋 Daily Checklist & Scratchpad ({tasks.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🗄️ TAB 1: ENCRYPTED DIGITAL VAULT & IMPORTANT DOCUMENT LOCKER */}
      {/* ========================================================================= */}
      {activeTab === 'vault' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Stored Identity & Policy Documents</h3>
            <button
              onClick={() => {
                setEditingDocId(null);
                setDocForm({
                  title: '',
                  category: 'PASSPORT',
                  doc_number: '',
                  issue_date: '',
                  expiry_date: '',
                  holder_name: '',
                  notes: '',
                });
                setIsDocModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Add Document
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
              <Shield size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-gray-700 mb-1">No Documents Stored in Digital Vault</p>
              <p className="text-xs text-gray-400 mb-4">Click "Add Document" above to safely store Passport, Driving License, RC, or Policy details.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => {
                const daysLeft = getDaysUntilExpiry(doc.expiry_date);
                const isExpiringSoon = daysLeft !== null && daysLeft <= 90;

                return (
                  <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          {doc.category.replace('_', ' ')}
                        </span>
                        {isExpiringSoon && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={11} /> Expiring in {daysLeft} Days!
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-900 text-base">{doc.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Holder: <strong className="text-gray-800">{doc.holder_name || 'Self'}</strong></p>

                      {/* Doc Number Box */}
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono text-xs my-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-sans">Document Number</span>
                          <span className="font-bold text-gray-900 tracking-wide">{doc.doc_number}</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(doc.doc_number);
                            alert('Document number copied to clipboard!');
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Copy Document Number"
                        >
                          <Copy size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="text-[10px] text-gray-400 block">Issue Date</span>
                          <span className="font-mono text-gray-800 font-medium">{doc.issue_date || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block">Expiry Date</span>
                          <span className={`font-mono font-bold ${isExpiringSoon ? 'text-red-600' : 'text-green-600'}`}>
                            {doc.expiry_date || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {doc.notes && <p className="text-xs text-gray-600 mt-2">📝 {doc.notes}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                        <FileCheck size={13} /> {doc.file_name || 'Attached Scan'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingDocId(doc.id);
                            setDocForm({
                              title: doc.title,
                              category: doc.category,
                              doc_number: doc.doc_number,
                              issue_date: doc.issue_date || '',
                              expiry_date: doc.expiry_date || '',
                              holder_name: doc.holder_name,
                              notes: doc.notes || '',
                            });
                            setIsDocModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ⚡ TAB 2: HOUSEHOLD UTILITY BILLS & MAID PAYMENT HUB */}
      {/* ========================================================================= */}
      {activeTab === 'utilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Monthly Household Operations & Maid Salaries</h3>
              <p className="text-xs text-gray-500">Total Recurring Monthly Outflow: <strong className="text-purple-600">{formatAmount(totalMonthlyUtilitiesCost)}</strong></p>
            </div>
            <button
              onClick={() => {
                setEditingUtilId(null);
                setUtilForm({
                  name: '',
                  category: 'ELECTRICITY',
                  consumer_number: '',
                  vendor_contact: '',
                  monthly_cost: '',
                  due_day_of_month: '5',
                  status: 'DUE',
                });
                setIsUtilModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Add Utility / Vendor
            </button>
          </div>

          {utilities.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
              <Zap size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-gray-700 mb-1">No Household Utilities Logged</p>
              <p className="text-xs text-gray-400 mb-4">Click "Add Utility / Vendor" above to track Electricity, Broadband, or Maid Salaries.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {utilities.map((util) => (
                <div key={util.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                        {util.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${util.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {util.status === 'PAID' ? 'Paid ✅' : `Due Day ${util.due_day_of_month}`}
                      </span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-base">{util.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Consumer No: <span className="font-mono text-gray-800">{util.consumer_number || 'N/A'}</span></p>
                    {util.vendor_contact && <p className="text-xs text-gray-500 mt-0.5">Contact: <span className="font-mono text-gray-800">{util.vendor_contact}</span></p>}

                    <div className="pt-3">
                      <span className="text-2xl font-bold text-gray-900">{formatAmount(util.monthly_cost)}</span>
                      <span className="text-xs text-gray-400 block">/ month</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleToggleUtilPaid(util.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                        util.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {util.status === 'PAID' ? 'Paid for Month ✅' : 'Mark Paid'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUtilId(util.id);
                          setUtilForm({
                            name: util.name,
                            category: util.category,
                            consumer_number: util.consumer_number,
                            vendor_contact: util.vendor_contact,
                            monthly_cost: String(util.monthly_cost),
                            due_day_of_month: String(util.due_day_of_month),
                            status: util.status,
                          });
                          setIsUtilModalOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteUtil(util.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📋 TAB 3: DAILY CHECKLIST, SHOPPING & SCRATCHPAD */}
      {/* ========================================================================= */}
      {activeTab === 'checklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Checklist & To-Dos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Shopping List & Daily Task Board</h3>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Plus size={14} /> Add Checklist Item
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
                <CheckSquare size={36} className="mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-gray-700 mb-1">No Checklist Items Added</p>
                <p className="text-xs text-gray-400 mb-4">Click "Add Checklist Item" above to add shopping lists or daily tasks.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm divide-y divide-gray-100">
                {tasks.map((task) => (
                  <div key={task.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center border ${
                          task.is_completed ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {task.is_completed && <Check size={14} />}
                      </button>
                      <span className={`text-xs font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                        {task.category.replace('_', ' ')}
                      </span>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Quick Scratchpad Text Area */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600" /> Daily Scratchpad Notes
            </h3>
            <p className="text-xs text-gray-500">Auto-saved quick scratchpad for ideas, phone numbers, or shopping notes</p>

            <textarea
              rows={12}
              placeholder="Type any quick scratchpad notes here... (Auto-saved)"
              value={scratchpadText}
              onChange={(e) => setScratchpadText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingDocId ? 'Edit Vault Document' : 'Store Document in Digital Vault'}</h3>
              <button onClick={() => setIsDocModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indian Passport / Health Insurance Policy"
                  value={docForm.title}
                  onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={docForm.category}
                    onChange={(e) => setDocForm((f) => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="VEHICLE_RC">Vehicle RC</option>
                    <option value="INSURANCE">Insurance Policy</option>
                    <option value="AADHAAR_PAN">Aadhaar / PAN</option>
                    <option value="PROPERTY_DEED">Property Deed</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Document Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Z-9948271"
                    value={docForm.doc_number}
                    onChange={(e) => setDocForm((f) => ({ ...f, doc_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={docForm.issue_date}
                    onChange={(e) => setDocForm((f) => ({ ...f, issue_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={docForm.expiry_date}
                    onChange={(e) => setDocForm((f) => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Holder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={docForm.holder_name}
                  onChange={(e) => setDocForm((f) => ({ ...f, holder_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Utility Modal */}
      {isUtilModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Household Utility / Maid Salary</h3>
              <button onClick={() => setIsUtilModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUtil} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Utility / Maid Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill / Maid Monthly Salary"
                  value={utilForm.name}
                  onChange={(e) => setUtilForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={utilForm.category}
                    onChange={(e) => setUtilForm((f) => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="ELECTRICITY">Electricity</option>
                    <option value="WATER">Water</option>
                    <option value="GAS_CYLINDER">Gas Cylinder</option>
                    <option value="WIFI_BROADBAND">WiFi Broadband</option>
                    <option value="MAID_COOK_SALARY">Maid / Cook Salary</option>
                    <option value="DTH_CABLE">DTH / Cable</option>
                    <option value="RENT">Rent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Cost (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="3500"
                    value={utilForm.monthly_cost}
                    onChange={(e) => setUtilForm((f) => ({ ...f, monthly_cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Consumer / Account No</label>
                  <input
                    type="text"
                    placeholder="e.g. 10294819"
                    value={utilForm.consumer_number}
                    onChange={(e) => setUtilForm((f) => ({ ...f, consumer_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={utilForm.due_day_of_month}
                    onChange={(e) => setUtilForm((f) => ({ ...f, due_day_of_month: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUtilModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Save Utility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Checklist Item</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Buy Organic Milk & Eggs / Pay Water Bill"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={taskForm.category}
                  onChange={(e) => setTaskForm((f) => ({ ...f, category: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="SHOPPING_LIST">Shopping List</option>
                  <option value="DAILY_TODO">Daily To-Do</option>
                  <option value="FINANCIAL_NOTE">Financial Note</option>
                  <option value="WORK">Work / Task</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
