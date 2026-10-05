import React, { useState } from 'react';
import { ArrowRight, Shield } from 'lucide-react';

interface LoginViewProps {
  onLogin: () => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await onLogin();
    } catch (e) {
      console.error('Auth0 sign-in failed', e);
      setError('Sign-in could not be started. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-50 flex items-center justify-center px-4">
      {/* Subtle ambient background shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-stone-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-100/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <div className="inline-block p-3 rounded-3xl bg-white shadow-xl shadow-blue-500/10 border border-slate-100 mb-3">
            <img
              src="/logo.png"
              alt="Career Wave — Your Path to Opportunity"
              className="h-24 w-auto object-contain mx-auto"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Career Wave
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Your Path to Opportunity
          </p>
        </div>

        {/* Card — sign-in only, nothing else on this screen */}
        <div className="bg-white rounded-3xl shadow-xl border border-stone-100 p-8">
          <h2 className="text-lg font-bold text-stone-900 mb-1">Sign in to continue</h2>
          <p className="text-xs text-stone-500 mb-6">
            Sign in securely to upload and manage your resumes.
          </p>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
          >
            <span>{loading ? 'Opening secure sign-in…' : 'Continue with Auth0'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Footer note */}
          <p className="mt-4 text-center text-[11px] text-stone-400 flex items-center justify-center space-x-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Authentication is handled securely by Auth0.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
