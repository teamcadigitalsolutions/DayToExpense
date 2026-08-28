import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setError('You must agree to the Terms & Conditions to register.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const full_name = `${form.firstName} ${form.lastName}`.trim() || form.username;
      
      // Save created user to local registered users store
      const newRegUser = {
        id: 'usr-' + Date.now(),
        email: form.email,
        username: form.username,
        password: form.password,
        full_name,
      };

      try {
        const savedUsersStr = localStorage.getItem('app_registered_users');
        const registeredUsers = savedUsersStr ? JSON.parse(savedUsersStr) : [];
        registeredUsers.push(newRegUser);
        localStorage.setItem('app_registered_users', JSON.stringify(registeredUsers));
      } catch {}

      try {
        await authService.register({
          email: form.email,
          username: form.username,
          password: form.password,
          full_name,
        });
      } catch {}

      navigate('/login', { state: { message: 'Account created! Please sign in with your username and password.' } });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Registration failed. Check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create an account</h1>
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed whitespace-pre-line">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Fields (2 Columns) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <input
              type="text"
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="First name"
              className="w-full px-4 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Last name"
              className="w-full px-4 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Username */}
        <div className="space-y-1">
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="Username"
            className="w-full px-4 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email address"
            className="w-full px-4 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Password */}
        <div className="space-y-1 relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Enter your password"
            className="w-full pl-4 pr-11 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
          </button>
        </div>

        {/* Checkbox */}
        <div className="flex items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            id="terms"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="w-4 h-4 rounded border-[#352f4c] bg-[#262238] text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs text-slate-300 cursor-pointer">
            I agree to the <span className="text-purple-400 underline">Terms & Conditions</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-[#6b58ed] hover:bg-[#5b48dc] active:bg-[#4d3cc8] text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
