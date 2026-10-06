import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Lock, X, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen, login, user, logout, addToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleLogin = async (targetEmail: string, targetPassword?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await login(targetEmail, targetPassword);
    setIsLoading(false);
    if (res.success) {
      addToast('success', 'Authenticated Successfully', `Signed in as ${targetEmail}`);
      setAuthModalOpen(false);
    } else {
      setErrorMessage(res.error || 'Login failed. Please verify credentials.');
    }
  };

  const handleQuickDemo = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      setEmail('alex.morgan@example.com');
      handleLogin('alex.morgan@example.com');
    } else {
      setEmail('sarah.c@example.com');
      handleLogin('sarah.c@example.com');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">MediaForge Authentication</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Cryptographically verified session tokens</p>
            </div>
          </div>
          <button
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Session</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      user.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-emerald-500/20 text-emerald-500'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    logout();
                    setAuthModalOpen(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                >
                  Sign Out of Session
                </button>
                <button
                  onClick={() => setAuthModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                  {errorMessage}
                </div>
              )}

              {/* Quick demo roles */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Quick Access Profiles
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    id="login-demo-admin-btn"
                    onClick={() => handleQuickDemo('admin')}
                    disabled={isLoading}
                    className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-colors flex flex-col gap-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin Account</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Alex Morgan (Admin Console)
                    </span>
                  </button>

                  <button
                    id="login-demo-user-btn"
                    onClick={() => handleQuickDemo('user')}
                    disabled={isLoading}
                    className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-left transition-colors flex flex-col gap-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-500">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Standard User</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Sarah Connor (Pro Member)
                    </span>
                  </button>
                </div>
              </div>

              {/* Direct email login */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) handleLogin(email, password);
                }}
                className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Password <span className="text-slate-400 font-normal">(Optional for demo)</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
