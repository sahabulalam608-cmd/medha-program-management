import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Please enter both user name and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = login(username, password);
      if (!res.success) {
        setError(res.error || 'Authentication failed');
      }
      setLoading(false);
    }, 400);
  };

  const handleQuickLogin = (user: 'admin' | 'ota') => {
    setError(null);
    setLoading(true);
    setTimeout(() => {
      if (user === 'admin') {
        login('admin', 'medha2026');
      } else {
        login('ota', 'ota2026');
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-[#1e1b4b] via-[#2e1065] to-[#0f172a] text-white select-none overflow-y-auto">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-600/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(#7c3aed_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl relative z-10 my-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-[#6d28d9] to-[#8b5cf6] p-1 shadow-xl ring-4 ring-purple-500/20 flex items-center justify-center overflow-hidden">
              <img
                src="/assets/img/medha-logo-256.png"
                alt="Medha"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-3xl font-extrabold text-white">M</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Medha Program Management</h1>
          <p className="text-xs text-purple-200 mt-1">Sign in to your Online Tech Academy portal</p>
          <div className="mt-3 flex justify-center">
            <img
              src="/assets/img/ota-logo-1000.png"
              alt="Online Tech Academy"
              className="h-7 w-auto object-contain opacity-90"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-purple-200 uppercase tracking-wider mb-1.5">
              User Name
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-purple-300 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter user name (admin / ota)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300/50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-purple-300 absolute left-3.5 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300/50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 text-purple-300 hover:text-white transition-colors"
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs animate-in fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] hover:from-[#7c3aed] hover:to-[#9333ea] text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <span>{loading ? 'Authenticating...' : 'Sign in'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Access Bar */}
        <div className="mt-6 pt-5 border-t border-white/15">
          <div className="flex items-center gap-1.5 text-xs text-purple-200/90 font-medium mb-3 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>One-Click Quick Access</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleQuickLogin('admin')}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-purple-100 transition-colors text-center"
            >
              Medha Admin
              <span className="block text-[10px] text-purple-300 font-normal">admin / medha2026</span>
            </button>
            <button
              onClick={() => handleQuickLogin('ota')}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-purple-100 transition-colors text-center"
            >
              OTA Team
              <span className="block text-[10px] text-purple-300 font-normal">ota / ota2026</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
