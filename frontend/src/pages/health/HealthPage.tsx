import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Plus, Heart, Scale, Footprints, Moon, Trash2, Edit2, X, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useAuthStore } from '../../stores/authStore';
import { settingsService } from '../../services';

interface HealthEntry {
  id: string;
  date: string;
  weight: number;
  height: number;
  bmi: number;
  steps?: number;
  sleepHours?: number;
  notes?: string;
}

export default function HealthPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';

  const [entries, setEntries] = useState<HealthEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`health_data_${wsId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HealthEntry | null>(null);

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    steps: '',
    sleepHours: '',
    notes: '',
  });

  // Fetch from backend
  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `health_data_${wsId}`).then((data) => {
        if (data && Array.isArray(data.entries)) {
          setEntries(data.entries);
        } else if (Array.isArray(data)) {
          setEntries(data);
        }
        setIsLoaded(true);
      }).catch(() => {
        setIsLoaded(true);
      });
    }
  }, [wsId]);

  // Save to backend
  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`health_data_${wsId}`, JSON.stringify(entries));
      settingsService.save(wsId, `health_data_${wsId}`, { entries });
    }
  }, [entries, wsId, isLoaded]);

  // Pre-fill height from last entry if available
  const openAddModal = () => {
    const lastHeight = entries.length > 0 ? entries[entries.length - 1].height.toString() : '';
    setForm({
      date: new Date().toISOString().split('T')[0],
      weight: '',
      height: lastHeight,
      steps: '',
      sleepHours: '',
      notes: '',
    });
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: HealthEntry) => {
    setForm({
      date: entry.date,
      weight: entry.weight.toString(),
      height: entry.height.toString(),
      steps: entry.steps ? entry.steps.toString() : '',
      sleepHours: entry.sleepHours ? entry.sleepHours.toString() : '',
      notes: entry.notes || '',
    });
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const calculateBMI = (weightKg: number, heightCm: number) => {
    if (!weightKg || !heightCm) return 0;
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(form.weight);
    const h = parseFloat(form.height);
    if (!w || !h) return;

    const newEntry: HealthEntry = {
      id: editingEntry ? editingEntry.id : crypto.randomUUID(),
      date: form.date,
      weight: w,
      height: h,
      bmi: calculateBMI(w, h),
      steps: form.steps ? parseInt(form.steps, 10) : undefined,
      sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : undefined,
      notes: form.notes,
    };

    if (editingEntry) {
      setEntries(entries.map(e => e.id === editingEntry.id ? newEntry : e).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } else {
      setEntries([...entries, newEntry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-500' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-500' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-500' };
    return { label: 'Obese', color: 'text-red-500' };
  };

  const latestEntry = useMemo(() => {
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-500" />
            Smart Health Monitoring
          </h1>
          <p className="text-sm text-gray-500">Track your weight, BMI, steps, and sleep.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span>Add Entry</span>
        </button>
      </div>

      {latestEntry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Scale size={16} />
              <span className="text-sm font-medium">Latest Weight</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{latestEntry.weight} kg</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Activity size={16} />
              <span className="text-sm font-medium">Latest BMI</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{latestEntry.bmi}</span>
              <span className={`text-xs font-medium ${getBMICategory(latestEntry.bmi).color}`}>
                {getBMICategory(latestEntry.bmi).label}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Footprints size={16} />
              <span className="text-sm font-medium">Steps (Last)</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{latestEntry.steps || '-'}</div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Moon size={16} />
              <span className="text-sm font-medium">Sleep (Last)</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{latestEntry.sleepHours ? `${latestEntry.sleepHours} hrs` : '-'}</div>
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weight & BMI Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight & BMI Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={entries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    itemStyle={{ color: '#111827' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="bmi" name="BMI" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Steps & Sleep Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity & Rest</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    itemStyle={{ color: '#111827' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="steps" name="Steps" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="sleepHours" name="Sleep (hrs)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Health Data Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Start tracking your daily or weekly weight, BMI, steps, and sleep to view trends and charts.
          </p>
          <button
            onClick={openAddModal}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus size={18} /> Add First Entry
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">History Log</h3>
          </div>
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm text-gray-700">
              <thead className="text-xs uppercase bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Weight (kg)</th>
                  <th className="px-4 py-3">Height (cm)</th>
                  <th className="px-4 py-3">BMI</th>
                  <th className="px-4 py-3">Steps</th>
                  <th className="px-4 py-3">Sleep (hrs)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.slice().reverse().map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{entry.weight}</td>
                    <td className="px-4 py-3">{entry.height}</td>
                    <td className="px-4 py-3">
                      <span className={getBMICategory(entry.bmi).color}>{entry.bmi}</span>
                    </td>
                    <td className="px-4 py-3">{entry.steps || '-'}</td>
                    <td className="px-4 py-3">{entry.sleepHours || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditModal(entry)} className="p-1 text-gray-500 hover:text-blue-600 mr-2">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-500 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEntry ? 'Edit Health Entry' : 'Log Health Data'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 70.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 175"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs text-blue-800">
                    BMI will be automatically calculated based on your weight and height.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Steps (Optional)</label>
                  <input
                    type="number"
                    value={form.steps}
                    onChange={(e) => setForm({ ...form, steps: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sleep Hrs (Optional)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.sleepHours}
                    onChange={(e) => setForm({ ...form, sleepHours: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 7.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="How did you feel today?"
                  rows={2}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
