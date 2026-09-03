import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { transferService, accountService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

export default function TransfersPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_account_id:'', to_account_id:'', amount:'', date: new Date().toISOString().split('T')[0], notes:'' });

  const { data: transferData } = useQuery({ queryKey:['transfers',wsId], queryFn:()=>transferService.list(wsId), enabled:!!wsId });
  const { data: accounts=[] } = useQuery({ queryKey:['accounts',wsId], queryFn:()=>accountService.list(wsId), enabled:!!wsId });
  const transfers = (transferData as any)?.items ?? [];

  const getAccountName = (accId: string, backendName?: string) => {
    if (backendName) return backendName;
    if (!accId) return 'N/A';
    const found = accounts.find((a: any) => a.id === accId);
    return found?.name || accId.slice(0, 8);
  };

  const createMutation = useMutation({
    mutationFn: () => transferService.create(wsId, { ...form, amount: Number(form.amount) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['transfers',wsId]}); qc.invalidateQueries({queryKey:['accounts',wsId]}); setShowForm(false); setForm({ from_account_id:'', to_account_id:'', amount:'', date: new Date().toISOString().split('T')[0], notes:'' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id:string) => transferService.delete(wsId, id),
    onSuccess: () => { qc.invalidateQueries({queryKey:['transfers',wsId]}); qc.invalidateQueries({queryKey:['accounts',wsId]}); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-600">
          <RefreshCw size={18}/>
          <span className="font-medium text-gray-800">Account Transfers</span>
        </div>
        <button onClick={() => setShowForm(s=>!s)} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 w-full sm:w-auto">
          <Plus size={16}/> New Transfer
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Create Transfer</h3>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded mb-4">
            Transfers do NOT appear as Income or Expense — they only move money between your accounts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">From Account</label>
              <select value={form.from_account_id} onChange={e=>setForm(f=>({...f,from_account_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select account</option>
                {accounts.map((a:any) => <option key={a.id} value={a.id}>{a.name} ({formatAmount(a.current_balance)})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">To Account</label>
              <select value={form.to_account_id} onChange={e=>setForm(f=>({...f,to_account_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select account</option>
                {accounts.filter((a:any)=>a.id!==form.from_account_id).map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₹)</label>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0.00" min="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={!form.from_account_id||!form.to_account_id||!form.amount||createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {createMutation.isPending ? 'Transferring…' : 'Transfer'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-full bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">From</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">To</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 w-16"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transfers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No transfers yet</td></tr>
            ) : transfers.map((t:any) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{getAccountName(t.from_account_id, t.from_account_name)}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{getAccountName(t.to_account_id, t.to_account_name)}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600 whitespace-nowrap">{formatAmount(t.amount)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { if(confirm('Delete this transfer? Both account balances will be reversed.')) deleteMutation.mutate(t.id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
