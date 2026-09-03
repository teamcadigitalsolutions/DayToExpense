import React, { useState, useEffect } from 'react';
import {
  FolderKanban, DollarSign, Calendar, MessageSquare, Copy, Check, Plus,
  Search, Users, AlertCircle, TrendingUp, Clock, FileText, Trash2, Edit2, X, ChevronRight, CheckCircle2, Building2, Send
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';
import { settingsService } from '../../services';

export interface Milestone {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  due_date: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  notes?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  assigned_to: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
}

export interface ProjectExpense {
  id: string;
  title: string;
  type: 'TEAM_PAYOUT' | 'SERVER_HOSTING' | 'ASSETS_DOMAIN' | 'OTHER';
  recipient: string;
  amount: number;
  date: string;
}

export interface Project {
  id: string;
  client_name: string;
  client_phone: string;
  project_name: string;
  total_cost: number;
  start_date: string;
  target_date: string;
  status: 'PROPOSAL' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  milestones: Milestone[];
  tasks: TaskItem[];
  expenses: ProjectExpense[];
  notes: string;
}

export default function ProjectStudioPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';
  const { formatAmount } = useCurrency();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseProjectId, setExpenseProjectId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    type: 'TEAM_PAYOUT' as ProjectExpense['type'],
    recipient: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', assigned_to: '' });

  // Main Form State
  const [projectForm, setProjectForm] = useState({
    client_name: '',
    client_phone: '',
    project_name: '',
    total_cost: '80000',
    start_date: new Date().toISOString().split('T')[0],
    target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'IN_PROGRESS' as Project['status'],
    notes: '',
    m1_name: 'Advance Payment (Kickoff)',
    m1_pct: '30',
    m1_due: new Date().toISOString().split('T')[0],

    m2_name: 'Beta Release & Review',
    m2_pct: '20',
    m2_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

    m3_name: 'Final Delivery & Launch',
    m3_pct: '50',
    m3_due: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // DB-backed Projects State
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(`project_studio_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `project_studio_${wsId}`).then((data) => {
        if (data && Array.isArray(data.data)) {
          setProjects(data.data);
        }
        setIsLoaded(true);
      }).catch(() => setIsLoaded(true));
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`project_studio_${wsId}`, JSON.stringify(projects));
      settingsService.save(wsId, `project_studio_${wsId}`, { data: projects });
    }
  }, [projects, wsId, isLoaded]);

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(projectForm.total_cost || '0');
    if (!projectForm.project_name || !projectForm.client_name || total <= 0) return;

    const m1_pct = parseFloat(projectForm.m1_pct || '30');
    const m2_pct = parseFloat(projectForm.m2_pct || '20');
    const m3_pct = parseFloat(projectForm.m3_pct || '50');

    if (editingProjectId) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== editingProjectId) return p;

          const updatedMilestones: Milestone[] = [
            {
              id: p.milestones[0]?.id || 'm-1',
              name: projectForm.m1_name,
              percentage: m1_pct,
              amount: (total * m1_pct) / 100,
              due_date: projectForm.m1_due,
              status: p.milestones[0]?.status || 'PENDING',
            },
            {
              id: p.milestones[1]?.id || 'm-2',
              name: projectForm.m2_name,
              percentage: m2_pct,
              amount: (total * m2_pct) / 100,
              due_date: projectForm.m2_due,
              status: p.milestones[1]?.status || 'PENDING',
            },
            {
              id: p.milestones[2]?.id || 'm-3',
              name: projectForm.m3_name,
              percentage: m3_pct,
              amount: (total * m3_pct) / 100,
              due_date: projectForm.m3_due,
              status: p.milestones[2]?.status || 'PENDING',
            },
          ];

          return {
            ...p,
            client_name: projectForm.client_name,
            client_phone: projectForm.client_phone,
            project_name: projectForm.project_name,
            total_cost: total,
            start_date: projectForm.start_date,
            target_date: projectForm.target_date,
            status: projectForm.status,
            notes: projectForm.notes,
            milestones: updatedMilestones,
          };
        })
      );
    } else {
      const milestones: Milestone[] = [
        {
          id: 'm-1',
          name: projectForm.m1_name,
          percentage: m1_pct,
          amount: (total * m1_pct) / 100,
          due_date: projectForm.m1_due,
          status: 'PENDING',
        },
        {
          id: 'm-2',
          name: projectForm.m2_name,
          percentage: m2_pct,
          amount: (total * m2_pct) / 100,
          due_date: projectForm.m2_due,
          status: 'PENDING',
        },
        {
          id: 'm-3',
          name: projectForm.m3_name,
          percentage: m3_pct,
          amount: (total * m3_pct) / 100,
          due_date: projectForm.m3_due,
          status: 'PENDING',
        },
      ];

      const newProj: Project = {
        id: 'proj-' + Date.now(),
        client_name: projectForm.client_name,
        client_phone: projectForm.client_phone,
        project_name: projectForm.project_name,
        total_cost: total,
        start_date: projectForm.start_date,
        target_date: projectForm.target_date,
        status: projectForm.status,
        milestones,
        tasks: [],
        expenses: [],
        notes: projectForm.notes,
      };
      setProjects((prev) => [newProj, ...prev]);
    }

    setIsProjectModalOpen(false);
    setEditingProjectId(null);
  };

  const handleEditProjectClick = (proj: Project) => {
    setEditingProjectId(proj.id);
    setProjectForm({
      client_name: proj.client_name,
      client_phone: proj.client_phone || '',
      project_name: proj.project_name,
      total_cost: String(proj.total_cost),
      start_date: proj.start_date,
      target_date: proj.target_date,
      status: proj.status,
      notes: proj.notes || '',

      m1_name: proj.milestones[0]?.name || 'Advance Payment (Kickoff)',
      m1_pct: String(proj.milestones[0]?.percentage || '30'),
      m1_due: proj.milestones[0]?.due_date || proj.start_date,

      m2_name: proj.milestones[1]?.name || 'Beta Release & Review',
      m2_pct: String(proj.milestones[1]?.percentage || '20'),
      m2_due: proj.milestones[1]?.due_date || proj.target_date,

      m3_name: proj.milestones[2]?.name || 'Final Delivery & Launch',
      m3_pct: String(proj.milestones[2]?.percentage || '50'),
      m3_due: proj.milestones[2]?.due_date || proj.target_date,
    });
    setIsProjectModalOpen(true);
  };

  const handleUpdateMilestoneDueDateDirect = (projId: string, mId: string, newDueDate: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const updatedM = p.milestones.map((m) => (m.id === mId ? { ...m, due_date: newDueDate } : m));
        return { ...p, milestones: updatedM };
      })
    );
  };

  const handleToggleMilestoneStatus = (projId: string, mId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const updatedM = p.milestones.map((m) => {
          if (m.id !== mId) return m;
          const nextStatus: Milestone['status'] = m.status === 'PAID' ? 'PENDING' : 'PAID';
          return { ...m, status: nextStatus };
        });
        return { ...p, milestones: updatedM };
      })
    );
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseProjectId || !expenseForm.title || !expenseForm.amount) return;

    const newExp: ProjectExpense = {
      id: 'exp-' + Date.now(),
      title: expenseForm.title,
      type: expenseForm.type,
      recipient: expenseForm.recipient,
      amount: parseFloat(expenseForm.amount),
      date: expenseForm.date,
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === expenseProjectId ? { ...p, expenses: [newExp, ...p.expenses] } : p))
    );

    setIsExpenseModalOpen(false);
    setExpenseProjectId(null);
    setExpenseForm({ title: '', type: 'TEAM_PAYOUT', recipient: '', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProjectId || !taskForm.title) return;

    const newTask: TaskItem = {
      id: 'task-' + Date.now(),
      title: taskForm.title,
      assigned_to: taskForm.assigned_to || 'Unassigned',
      status: 'IN_PROGRESS',
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === taskProjectId ? { ...p, tasks: [...p.tasks, newTask] } : p))
    );

    setIsTaskModalOpen(false);
    setTaskProjectId(null);
    setTaskForm({ title: '', assigned_to: '' });
  };

  const handleToggleTaskStatus = (projId: string, taskId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const updatedTasks = p.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: (t.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED') as TaskItem['status'] }
            : t
        );
        return { ...p, tasks: updatedTasks };
      })
    );
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Delete this project and all its milestone billing records?')) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Generate WhatsApp Follow-up Message
  const generateWhatsAppMessage = (proj: Project, milestone: Milestone) => {
    return `Hi ${proj.client_name},\n\nHope you're doing well! This is a friendly reminder regarding the milestone payment for *${proj.project_name}*.\n\n📌 *Milestone:* ${milestone.name} (${milestone.percentage}%)\n💰 *Pending Amount:* ₹${milestone.amount.toLocaleString('en-IN')}\n📅 *Due Date:* ${milestone.due_date}\n\nPlease let us know once the transfer is completed so we can proceed with the next phase.\n\nThank you!`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Portfolio Analytics
  const totalAgreedContract = projects.reduce((sum, p) => sum + p.total_cost, 0);
  const totalCollected = projects.reduce(
    (sum, p) => sum + p.milestones.filter((m) => m.status === 'PAID').reduce((mSum, m) => mSum + m.amount, 0),
    0
  );
  const totalPendingDues = totalAgreedContract - totalCollected;
  const totalProjectExpenses = projects.reduce(
    (sum, p) => sum + p.expenses.reduce((eSum, e) => eSum + e.amount, 0),
    0
  );
  const netProjectProfit = totalCollected - totalProjectExpenses;

  // Filtered Projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.project_name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderKanban className="text-blue-600" size={24} /> Project Milestone Billing & WhatsApp Studio
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage project quotations (30/20/50 splits), edit due dates & notes, 1-click WhatsApp reminders, assigned work & net profit
          </p>
        </div>

        <button
          onClick={() => {
            setEditingProjectId(null);
            setProjectForm({
              client_name: '',
              client_phone: '',
              project_name: '',
              total_cost: '80000',
              start_date: new Date().toISOString().split('T')[0],
              target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'IN_PROGRESS',
              notes: '',
              m1_name: 'Advance Payment (Kickoff)',
              m1_pct: '30',
              m1_due: new Date().toISOString().split('T')[0],
              m2_name: 'Beta Release & Review',
              m2_pct: '20',
              m2_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              m3_name: 'Final Delivery & Launch',
              m3_pct: '50',
              m3_due: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
            setIsProjectModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Plus size={16} /> New Project Quotation
        </button>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Total Contract Value</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatAmount(totalAgreedContract)}</p>
          <span className="text-[11px] text-gray-400 block mt-0.5">{projects.length} Active Projects</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Collected Client Revenue</span>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatAmount(totalCollected)}</p>
          <span className="text-[11px] text-green-700 font-medium block mt-0.5">Paid Milestones</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Pending Client Dues</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatAmount(totalPendingDues)}</p>
          <span className="text-[11px] text-amber-700 font-medium block mt-0.5">Follow-up Required</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Net Project Profitability</span>
          <p className={`text-2xl font-bold mt-1 ${netProjectProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatAmount(netProjectProfit)}
          </p>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            After ₹{totalProjectExpenses.toLocaleString('en-IN')} Team & Server Costs
          </span>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name or client name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
              selectedStatus === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Projects ({projects.length})
          </button>
          <button
            onClick={() => setSelectedStatus('IN_PROGRESS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
              selectedStatus === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setSelectedStatus('COMPLETED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
              selectedStatus === 'COMPLETED' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
          <FolderKanban size={36} className="mx-auto mb-2 opacity-40" />
          <p className="font-semibold text-gray-700 mb-1">No Projects Found</p>
          <p className="text-xs text-gray-400 mb-4">
            Click "New Project Quotation" above to add your client project and milestone splits.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProjects.map((proj) => {
            const paidSum = proj.milestones.filter((m) => m.status === 'PAID').reduce((sum, m) => sum + m.amount, 0);
            const pendingSum = proj.total_cost - paidSum;
            const expSum = proj.expenses.reduce((sum, e) => sum + e.amount, 0);

            return (
              <div key={proj.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
                {/* Project Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{proj.project_name}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          proj.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Client: <strong className="text-gray-900">{proj.client_name}</strong> • Phone:{' '}
                      <span className="font-mono text-gray-700">{proj.client_phone || 'N/A'}</span>
                    </p>
                    {proj.notes && <p className="text-xs text-gray-600 mt-1 bg-amber-50/60 p-2 rounded-lg border border-amber-100">📝 Notes: {proj.notes}</p>}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Total Contract</span>
                      <span className="font-bold text-gray-900 text-base">{formatAmount(proj.total_cost)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-green-600 block font-medium">Collected</span>
                      <span className="font-bold text-green-600 text-base">{formatAmount(paidSum)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-amber-600 block font-medium">Pending Dues</span>
                      <span className="font-bold text-amber-600 text-base">{formatAmount(pendingSum)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditProjectClick(proj)}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                        title="Edit Project & Milestone Due Dates / Notes"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Delete Project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 1. Milestone Payment Splits & Editable Due Dates */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Milestone Billing & 1-Click WhatsApp Reminders
                    </h4>
                    <span className="text-[11px] text-gray-400">📅 Editable Due Dates</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {proj.milestones.map((m) => {
                      const waText = generateWhatsAppMessage(proj, m);
                      const isPaid = m.status === 'PAID';

                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                            isPaid ? 'bg-green-50/50 border-green-200' : 'bg-amber-50/40 border-amber-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold text-gray-900">{m.name}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {m.percentage}% ({formatAmount(m.amount)})
                              </span>
                            </div>

                            {/* Direct Due Date Editor */}
                            <div className="flex items-center gap-1 mt-1 text-[11px]">
                              <span className="text-gray-500">Due Date:</span>
                              <input
                                type="date"
                                value={m.due_date}
                                onChange={(e) => handleUpdateMilestoneDueDateDirect(proj.id, m.id, e.target.value)}
                                className="px-1.5 py-0.5 border border-gray-300 rounded font-mono text-[11px] text-gray-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200/60">
                            <button
                              onClick={() => handleToggleMilestoneStatus(proj.id, m.id)}
                              className={`flex items-center gap-1 text-xs font-semibold ${
                                isPaid ? 'text-green-700' : 'text-amber-700 hover:text-green-700'
                              }`}
                            >
                              <CheckCircle2 size={14} /> {isPaid ? 'Paid ✅' : 'Mark Paid'}
                            </button>

                            {!isPaid && (
                              <button
                                onClick={() => copyToClipboard(waText, `wa-${proj.id}-${m.id}`)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold rounded-lg shadow-sm"
                                title="Copy pre-filled WhatsApp Follow-up message"
                              >
                                {copiedId === `wa-${proj.id}-${m.id}` ? (
                                  <>
                                    <Check size={12} /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Send size={12} /> WhatsApp Msg
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Assigned Work & Deliverable Status */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Assigned Work & Deliverables ({proj.tasks.length})
                    </h4>
                    <button
                      onClick={() => {
                        setTaskProjectId(proj.id);
                        setTaskForm({ title: '', assigned_to: '' });
                        setIsTaskModalOpen(true);
                      }}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      + Add Task
                    </button>
                  </div>

                  {proj.tasks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No deliverable tasks added yet. Click "+ Add Task".</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {proj.tasks.map((t) => (
                        <div key={t.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className={`font-semibold ${t.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {t.title}
                            </span>
                            <span className="text-gray-500 block text-[10px]">Assigned to: {t.assigned_to}</span>
                          </div>
                          <button
                            onClick={() => handleToggleTaskStatus(proj.id, t.id)}
                            className={`p-1 rounded ${t.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Project Expenses & Team Payouts */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Project Expenses & Team Payouts ({formatAmount(expSum)})
                    </h4>
                    <button
                      onClick={() => {
                        setExpenseProjectId(proj.id);
                        setExpenseForm({
                          title: '',
                          type: 'TEAM_PAYOUT',
                          recipient: '',
                          amount: '',
                          date: new Date().toISOString().split('T')[0],
                        });
                        setIsExpenseModalOpen(true);
                      }}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      + Record Payout / Expense
                    </button>
                  </div>

                  {proj.expenses.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No direct project expenses or team payouts logged.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {proj.expenses.map((e) => (
                        <div key={e.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-gray-900">{e.title}</span>
                            <span className="text-gray-500 block text-[10px]">Paid to: {e.recipient || 'Vendor'}</span>
                          </div>
                          <span className="font-bold text-red-600">{formatAmount(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / New Project Quotation Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingProjectId ? 'Edit Project & Milestone Due Dates / Notes' : 'New Project Quotation & Milestones'}</h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website & Mobile App Development"
                  value={projectForm.project_name}
                  onChange={(e) => setProjectForm((f) => ({ ...f, project_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Enterprises"
                    value={projectForm.client_name}
                    onChange={(e) => setProjectForm((f) => ({ ...f, client_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client WhatsApp Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={projectForm.client_phone}
                    onChange={(e) => setProjectForm((f) => ({ ...f, client_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Contract Cost (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="80000"
                    value={projectForm.total_cost}
                    onChange={(e) => setProjectForm((f) => ({ ...f, total_cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    required
                    value={projectForm.target_date}
                    onChange={(e) => setProjectForm((f) => ({ ...f, target_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Detailed Milestone Splits & Editable Due Dates */}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-gray-800">Configure Milestone Splits & Due Dates</h4>

                {/* Milestone 1 */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 text-xs">
                  <div className="font-semibold text-blue-700">Milestone 1 (Advance / Kickoff)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={projectForm.m1_name}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m1_name: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="%"
                      value={projectForm.m1_pct}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m1_pct: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="date"
                      value={projectForm.m1_due}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m1_due: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Milestone 2 */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 text-xs">
                  <div className="font-semibold text-blue-700">Milestone 2 (Beta / Review)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={projectForm.m2_name}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m2_name: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="%"
                      value={projectForm.m2_pct}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m2_pct: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="date"
                      value={projectForm.m2_due}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m2_due: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Milestone 3 */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 text-xs">
                  <div className="font-semibold text-blue-700">Milestone 3 (Final Launch)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={projectForm.m3_name}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m3_name: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="%"
                      value={projectForm.m3_pct}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m3_pct: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                    />
                    <input
                      type="date"
                      value={projectForm.m3_due}
                      onChange={(e) => setProjectForm((f) => ({ ...f, m3_due: e.target.value }))}
                      className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Project Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scope includes Web + Android + iOS App; 3 months free support."
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  {editingProjectId ? 'Update Project & Milestones' : 'Save Project Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Project Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Record Project Expense / Payout</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Developer Payout / Server Hosting"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="TEAM_PAYOUT">Team Payout</option>
                    <option value="SERVER_HOSTING">Server / Hosting</option>
                    <option value="ASSETS_DOMAIN">Assets / Domain</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="15000"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Paid To / Recipient</label>
                <input
                  type="text"
                  placeholder="e.g. Suresh (UI Designer) / AWS"
                  value={expenseForm.recipient}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, recipient: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Save Expense
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
              <h3 className="font-semibold text-gray-900">Add Assigned Task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend API Integration"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
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
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
