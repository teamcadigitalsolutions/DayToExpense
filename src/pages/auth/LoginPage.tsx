import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username_or_email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials: { username_or_email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      await login(credentials);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        err?.response?.data?.detail ??
        err?.message ??
        'Invalid credentials. Check your username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username_or_email || !form.password) return;
    handleLogin(form);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Log in</h1>
        <p className="text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email or Username */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">Email or Username</label>
          <input
            type="text"
            required
            value={form.username_or_email}
            onChange={(e) => setForm((f) => ({ ...f, username_or_email: e.target.value }))}
            placeholder="Enter your email or username"
            className="w-full px-4 py-3 bg-[#262238] border border-[#352f4c] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">Enter your password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••••••"
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
        </div>

        {/* Remember me Checkbox */}
        <div className="flex items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-[#352f4c] bg-[#262238] text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
          <label htmlFor="remember" className="text-xs text-slate-300 cursor-pointer">
            Remember me for 30 days
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-[#6b58ed] hover:bg-[#5b48dc] active:bg-[#4d3cc8] text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
