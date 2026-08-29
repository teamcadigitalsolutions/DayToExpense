import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { contactService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useDebounce } from '../../hooks';

const TYPE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700',
  SUPPLIER: 'bg-purple-100 text-purple-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
  PERSONAL: 'bg-gray-100 text-gray-600',
  OTHER: 'bg-yellow-100 text-yellow-700',
};

export default function ContactsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'CUSTOMER',
    email: '',
    phone: '',
    company: '',
    gstin: '',
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', wsId, debouncedSearch, filterType],
    queryFn: () => contactService.list(wsId, { search: debouncedSearch || undefined, type: filterType || undefined }),
    enabled: !!wsId,
  });

  const createMutation = useMutation({
    mutationFn: (newContact: any) => contactService.create(wsId, newContact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', wsId] });
      setIsOpen(false);
      setForm({
        name: '',
        type: 'CUSTOMER',
        email: '',
        phone: '',
        company: '',
        gstin: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    createMutation.mutate(form);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">All Types</option>
            {['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'PERSONAL'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} /> Add Contact
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)
        ) : contacts.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400">No contacts found</div>
        ) : (
          (contacts as any[]).map((c: any) => (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{c.name}</p>
                  {c.company && <p className="text-xs text-gray-500 truncate">{c.company}</p>}
                  {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                </div>
                <span
                  className={
                    'text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ' +
                    (TYPE_COLORS[c.type] ?? 'bg-gray-100 text-gray-600')
                  }
                >
                  {c.type}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add New Contact</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="rahul@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="36AAAAA0000A1Z5"
                  value={form.gstin}
                  onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
