import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react';
import { AuthUser } from '../types';
import { EPSSLogo } from './EPSSLogo';
import { ThemeSelector } from './ThemeSelector';
import { signInWithPassword } from '../utils/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import { CentralSyncStatus } from '../utils/centralSyncService';

interface LoginViewProps {
  onLogin: (user: AuthUser, remember: boolean) => void;
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
  syncStatus?: CentralSyncStatus | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, currentTheme, onThemeChange }) => {
  const [username, setUsername] = useState('mosisbme@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const email = username.trim();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter the email address of your account.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithPassword(email, password, rememberMe);
      if (result.user) {
        onLogin(result.user, rememberMe);
      } else {
        setErrorMessage(result.error || 'Sign in failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center py-8 px-4 relative overflow-hidden bg-cover bg-center bg-no-repeat font-sans"
      style={{ backgroundImage: 'url("/assets/aistudio/image_dc93253b.png")' }}
    >
      {/* Theme selector floating top right */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />
      </div>

      {/* Center Card Wrapper matching Login.jpg */}
      <div className="w-full max-w-md relative z-20">
        <div className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-center">
          
          {/* Logo & System Header */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <EPSSLogo size="lg" variant="full" showBadge={false} className="mb-1" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Medical Device Management System
            </h1>
          </div>

          {/* Inner Form Card */}
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-5 text-left shadow-inner space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <KeyRound size={15} />
                <span>AUTHORIZED USER SIGN IN</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Sign in with your administrator-issued email and password.
              </p>
            </div>

            {!isSupabaseConfigured && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Notice: Demo mode active. Standard admin credentials work out of the box.
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email Input */}
              <div className="space-y-1">
                <div className="relative rounded-xl border border-slate-300 bg-white/90 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition overflow-hidden">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="mosisbme@gmail.com"
                    className="w-full pl-10 pr-3 py-2.5 text-sm font-medium text-slate-900 bg-transparent focus:outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="relative rounded-xl border border-slate-300 bg-white/90 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition overflow-hidden">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-sm font-medium text-slate-900 bg-transparent focus:outline-none placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Remember me</span>
                  </label>
                  <span>Issued by the administrator</span>
                </div>
              </div>

              {/* Sign In Pill Button matching screenshot */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Biomedical Engineering Unit • EPSS Portal
          </div>
        </div>
      </div>
    </div>
  );
};
