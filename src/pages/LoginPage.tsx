import React, { useState } from 'react';
import { ArrowLeft, Shield, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center py-12 px-4">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />

      <div className="relative w-full max-w-md">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </button>

        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl mb-4">
              <Shield className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
            <p className="text-slate-600">Sign in to access your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-4 text-center">Demo Accounts:</p>
            <div className="space-y-2">
              <button
                onClick={() => quickLogin('admin@sinnara.com', 'admin123')}
                className="w-full text-left px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition-colors"
              >
                <div className="font-medium text-slate-900">Platform Admin</div>
                <div className="text-slate-600">admin@sinnara.com</div>
              </button>
              <button
                onClick={() => quickLogin('teemo@teemo.com', 'company123')}
                className="w-full text-left px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition-colors"
              >
                <div className="font-medium text-slate-900">Company Admin</div>
                <div className="text-slate-600">teemo@teemo.com</div>
              </button>
              <button
                onClick={() => quickLogin('mohammed@techcorp.com', 'employee123')}
                className="w-full text-left px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition-colors"
              >
                <div className="font-medium text-slate-900">Employee</div>
                <div className="text-slate-600">mohammed@techcorp.com</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          Accounts are created by administrators only
        </p>
      </div>
    </div>
  );
};
