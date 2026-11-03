import React, { useState, useEffect } from 'react';
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

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, currentTheme, onThemeChange, syncStatus: propSyncStatus }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoBgEnabled, setIsVideoBgEnabled] = useState(true);

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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50 text-slate-900">
      {/* Medical Device Management System Cinematic Background Video & Tech Canvas */}
      {isVideoBgEnabled && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-15 filter brightness-105 contrast-110 scale-105"
            src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-medical-data-31908-large.mp4"
            onError={(e) => {
              const target = e.currentTarget;
              target.src = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
            }}
          />
          <div className="absolute inset-0 bg-linear-to-tr from-slate-50 via-slate-50/85 to-blue-50/60 backdrop-blur-[2px]" />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>
      )}

      {/* Top Controls: Theme Selector & Video Background Toggle */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <button
          onClick={() => setIsVideoBgEnabled(prev => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer shadow-xs ${
            isVideoBgEnabled 
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="Toggle Medical Equipment Cinematic Background Video"
        >
          <span>🎥</span>
          <span className="font-bold">{isVideoBgEnabled ? 'Video BG: On' : 'Video BG: Off'}</span>
        </button>
        <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />
      </div>

      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header with Authentic EPSS Logo */}
        <div className="text-center">
          <EPSSLogo size="lg" variant="full" showBadge={true} className="mb-2" />
          
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 uppercase mt-2">
            EPSS@2026
          </h2>
          <p className="mt-0.5 text-xs text-blue-700 font-semibold tracking-wide">
            EPSS@2026 - Master Inventory & Medical Device Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="mb-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Authorized User Sign In</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Portal Access</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sign in with your email address and the password issued by the Inventory Administrator.
            </p>

            {!isSupabaseConfigured && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> and rebuild.
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <span className="font-semibold shrink-0">Notice:</span> 
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email Input */}
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Issued by the administrator
                </span>
              </div>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-100 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-600">Keep me logged in</span>
              </label>
              <span className="text-[11px] text-slate-500">Secure 256-bit Session</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to System Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-slate-400 mt-5 pt-4 border-t border-slate-200 text-center">
            Self-registration is disabled. Only the Inventory Administrator can create accounts.
          </p>
        </div>

        {/* Footer Credit */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>
            Created & Maintained by <strong className="text-slate-800 font-semibold">Mosisa Berhanu</strong>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Biomedical Engineering Unit • EPSS@2026
          </p>
        </div>
      </div>
    </div>
  );
};
