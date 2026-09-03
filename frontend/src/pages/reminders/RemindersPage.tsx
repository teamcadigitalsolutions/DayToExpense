import React, { useState, useEffect } from 'react';
import {
  Calendar, Bell, Plus, Search, Filter, Clock, Tag, Award, Gift,
  Tv, AlertCircle, CheckCircle2, Trash2, Edit2, X, BellRing
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { settingsService } from '../../services';

export interface ImportantEvent {
  id: string;
  title: string;
  category: 'PURCHASE' | 'BIRTHDAY' | 'ANNIVERSARY' | 'FOLLOWUP' | 'RENEWAL' | 'MILESTONE' | 'OTHER';
  event_date: string;
  advance_days: number; // e.g. 3 days before, 1 day before
  notes: string;
  is_completed: boolean;
  created_at: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  PURCHASE: { label: 'Purchase / Warranty', icon: Tv, color: 'text-purple-600', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  BIRTHDAY: { label: 'Birthday', icon: Gift, color: 'text-pink-600', badge: 'bg-pink-100 text-pink-700 border-pink-200' },
  ANNIVERSARY: { label: 'Anniversary', icon: Award, color: 'text-red-600', badge: 'bg-red-100 text-red-700 border-red-200' },
  FOLLOWUP: { label: 'Scheduled Follow-up', icon: Clock, color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  RENEWAL: { label: 'Renewal / Bill', icon: Bell, color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  MILESTONE: { label: 'Milestone', icon: Calendar, color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  OTHER: { label: 'Other', icon: Tag, color: 'text-gray-600', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
};

function computeLoanReminders(loans: any[]): any[] {
  const reminders: any[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  loans.forEach((loan: any) => {
    if (loan.status !== 'ACTIVE' || (loan.outstanding_balance <= 0 && loan.status === 'CLOSED')) return;
    const emi = loan.emi_amount || 0;
    const tenure = loan.tenure_months || 12;
    const startDate = new Date(loan.emi_start_date || loan.start_date || new Date());
    const paidCount = Math.floor(Math.max(0, loan.total_paid - loan.down_payment) / (emi || 1));
    for (let i = paidCount + 1; i <= tenure; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + (i - 1));
      const diffMs = dueDate.getTime() - today.getTime();
      const daysRem = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      reminders.push({
        id: `loan-emi-${loan.id}-${i}`,
        loan_id: loan.id,
        title: `EMI Payment: ${loan.name}`,
        installment_label: `Month ${i} of ${tenure}`,
        provider: loan.institution || 'Bank / Vendor',
        amount: emi,
        due_date: dueDate.toISOString().split('T')[0],
        days_remaining: daysRem,
        item_purchased: loan.item_purchased,
      });
      break;
    }
  });
  return reminders;
}

export default function RemindersPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';

  const [loanReminders, setLoanReminders] = useState<any[]>([]);

  useEffect(() => {
    if (!wsId) return;
    settingsService.get(wsId, `smart_loans_${wsId}`).then((data) => {
      const loans = data?.data || [];
      if (Array.isArray(loans)) {
        setLoanReminders(computeLoanReminders(loans));
      }
    }).catch(() => {
      // fallback: try localStorage
      try {
        const raw = localStorage.getItem(`smart_loans_${wsId}`);
        if (raw) setLoanReminders(computeLoanReminders(JSON.parse(raw)));
      } catch {}
    });
  }, [wsId]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted' && loanReminders.length > 0) {
      loanReminders.forEach((rem) => {
        if (rem.days_remaining <= 7) {
          const notifiedKey = `notified_push_${rem.id}_${rem.due_date}`;
          if (!sessionStorage.getItem(notifiedKey)) {
            new Notification(`⏰ Loan EMI Reminder: ${rem.title}`, {
              body: `${rem.installment_label} — ₹${rem.amount.toLocaleString()} due on ${rem.due_date} (${rem.days_remaining <= 0 ? 'TODAY!' : 'in ' + rem.days_remaining + ' days'})`,
            });
            sessionStorage.setItem(notifiedKey, 'true');
          }
        }
      });
    }
  }, [wsId, loanReminders.length]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFilter, setSelectedFilter] = useState<'UPCOMING' | 'ALL' | 'TODAY'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    category: 'PURCHASE' as ImportantEvent['category'],
    event_date: new Date().toISOString().split('T')[0],
    advance_days: 3,
    notes: '',
  });

  // DB-backed State for Events
  const [events, setEvents] = useState<ImportantEvent[]>(() => {
    try {
      const saved = localStorage.getItem(`important_events_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `important_events_${wsId}`).then((data) => {
        if (data && Array.isArray(data.data)) {
          setEvents(data.data);
        }
        setIsLoaded(true);
      }).catch(() => setIsLoaded(true));
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`important_events_${wsId}`, JSON.stringify(events));
      settingsService.save(wsId, `important_events_${wsId}`, { data: events });
    }
  }, [events, wsId, isLoaded]);

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.event_date) return;

    if (editingId) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingId
            ? { ...ev, title: form.title, category: form.category, event_date: form.event_date, advance_days: form.advance_days, notes: form.notes }
            : ev
        )
      );
    } else {
      const newEv: ImportantEvent = {
        id: 'ev-' + Date.now(),
        title: form.title,
        category: form.category,
        event_date: form.event_date,
        advance_days: Number(form.advance_days),
        notes: form.notes,
        is_completed: false,
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [newEv, ...prev]);
    }

    setIsModalOpen(false);
    setEditingId(null);
    setForm({
      title: '',
      category: 'PURCHASE',
      event_date: new Date().toISOString().split('T')[0],
      advance_days: 3,
      notes: '',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this reminder?')) {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    }
  };

  const handleToggleComplete = (id: string) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, is_completed: !ev.is_completed } : ev))
    );
  };

  // Helper for computing days remaining
  const getDaysRemaining = (targetDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch = ev.title.toLowerCase().includes(search.toLowerCase()) || ev.notes.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || ev.category === selectedCategory;
    const daysRem = getDaysRemaining(ev.event_date);

    if (!matchesSearch || !matchesCat) return false;
    if (selectedFilter === 'UPCOMING') return daysRem >= 0 && daysRem <= 7;
    if (selectedFilter === 'TODAY') return daysRem === 0;
    return true;
  });

  const upcomingCount = events.filter((ev) => {
    const d = getDaysRemaining(ev.event_date);
    return d >= 0 && d <= 7;
  }).length;

  const dueSoonCount = events.filter((ev) => {
    const d = getDaysRemaining(ev.event_date);
    return d >= 0 && d <= ev.advance_days;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} /> Important Dates & Reminders
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Save purchase dates, birthdays, anniversaries, follow-ups, and get 3-day advance alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if ('Notification' in window) {
                Notification.requestPermission().then((perm) => {
                  if (perm === 'granted') alert('Push Notification Alerts Activated!');
                });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold rounded-lg shadow-sm"
          >
            <BellRing size={15} /> Enable Push Alerts
          </button>

          <button
            onClick={() => {
              setEditingId(null);
              setForm({
                title: '',
                category: 'PURCHASE',
                event_date: new Date().toISOString().split('T')[0],
                advance_days: 3,
                notes: '',
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus size={16} /> Add Important Date / Event
          </button>
        </div>
      </div>

      {/* Automated Loan EMI Push & Schedule Reminders Section */}
      {loanReminders.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-5 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-3">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <BellRing size={18} className="text-purple-300 animate-bounce" /> Loan EMI & Scheduled Repayment Push Alerts ({loanReminders.length})
              </h3>
              <p className="text-xs text-purple-200 mt-0.5">
                Real-time push notifications & scheduled reminders for upcoming loan installment due dates
              </p>
            </div>
            <button
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then((perm) => {
                    if (perm === 'granted') {
                      new Notification('✅ Push Notifications Active!', { body: 'You will receive push reminders for upcoming loan EMIs.' });
                    }
                  });
                }
              }}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-all flex items-center gap-1.5 w-fit"
            >
              <Bell size={14} /> Enable Web Push Alerts
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loanReminders.map((rem) => {
              const isToday = rem.days_remaining === 0;
              const isOverdue = rem.days_remaining < 0;
              const isDueSoon = rem.days_remaining > 0 && rem.days_remaining <= 7;

              return (
                <div key={rem.id} className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-purple-200">{rem.installment_label}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isToday
                          ? 'bg-red-500 text-white animate-pulse'
                          : isOverdue
                          ? 'bg-rose-600 text-white'
                          : isDueSoon
                          ? 'bg-amber-400 text-gray-900'
                          : 'bg-emerald-400 text-gray-900'
                      }`}
                    >
                      {isToday ? 'DUE TODAY' : isOverdue ? `${Math.abs(rem.days_remaining)} Days Overdue` : `Due in ${rem.days_remaining} Days`}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm">{rem.title}</h4>
                    <p className="text-xs text-purple-200 mt-0.5">Item: {rem.item_purchased} • Provider: {rem.provider}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                    <div>
                      <span className="text-[10px] text-purple-300 block">EMI Due Amount</span>
                      <span className="font-extrabold text-amber-300 text-sm">₹{rem.amount.toLocaleString()}</span>
                    </div>

                    <a
                      href="/loans"
                      className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1"
                    >
                      Record EMI
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Total Saved Reminders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{events.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Upcoming (Next 7 Days)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{upcomingCount} Events</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Alerts Active (≤ 3 Days)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{dueSoonCount} Due Soon</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dates, purchases, birthdays..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setSelectedFilter('UPCOMING')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedFilter === 'UPCOMING' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Next 7 Days ({upcomingCount})
            </button>
            <button
              onClick={() => setSelectedFilter('TODAY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedFilter === 'TODAY' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${
              selectedCategory === 'ALL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
            const Icon = cat.icon;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                  selectedCategory === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon size={12} /> {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvents.length === 0 ? (
          <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-gray-700 mb-1">No Important Dates Found</p>
            <p className="text-xs text-gray-400 mb-4">Click "Add Important Date" above to save TV purchases, birthdays, or follow-ups.</p>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const catInfo = CATEGORY_MAP[ev.category] || CATEGORY_MAP.OTHER;
            const Icon = catInfo.icon;
            const daysRemaining = getDaysRemaining(ev.event_date);
            const isDueSoon = daysRemaining >= 0 && daysRemaining <= ev.advance_days;

            return (
              <div
                key={ev.id}
                className={`bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  isDueSoon ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catInfo.badge}`}>
                      <Icon size={12} /> {catInfo.label}
                    </span>

                    {/* Days Remaining Pill */}
                    {daysRemaining < 0 ? (
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        Past Event
                      </span>
                    ) : daysRemaining === 0 ? (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded animate-pulse">
                        🔔 TODAY!
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isDueSoon ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {daysRemaining} Day{daysRemaining > 1 ? 's' : ''} Left
                      </span>
                    )}
                  </div>

                  <h3 className={`font-semibold text-sm ${ev.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {ev.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2 font-mono">
                    <Calendar size={13} className="text-gray-400" />
                    <span>{new Date(ev.event_date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>

                  {ev.notes && (
                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                      {ev.notes}
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleComplete(ev.id)}
                    className={`flex items-center gap-1 text-xs font-medium ${
                      ev.is_completed ? 'text-green-600' : 'text-gray-400 hover:text-green-600'
                    }`}
                  >
                    <CheckCircle2 size={15} /> {ev.is_completed ? 'Done' : 'Mark Done'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(ev.id);
                        setForm({
                          title: ev.title,
                          category: ev.category,
                          event_date: ev.event_date,
                          advance_days: ev.advance_days,
                          notes: ev.notes,
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(ev.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Edit Important Date' : 'Save Important Date & Reminder'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Event Title / Purchase Item</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bought OLED TV / John's Birthday / Car Service"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="PURCHASE">Purchase / Warranty</option>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="ANNIVERSARY">Anniversary</option>
                    <option value="FOLLOWUP">Scheduled Follow-up</option>
                    <option value="RENEWAL">Renewal / Bill</option>
                    <option value="MILESTONE">Personal Milestone</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Advance Alert Notice</label>
                <select
                  value={form.advance_days}
                  onChange={(e) => setForm((f) => ({ ...f, advance_days: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={3}>3 Days Before (Recommended)</option>
                  <option value={1}>1 Day Before</option>
                  <option value={7}>7 Days Before</option>
                  <option value={0}>On Event Day Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Details / Warranty Info</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Model number, invoice link, gift ideas, or follow-up instructions..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  {editingId ? 'Update Event' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
