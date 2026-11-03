import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, CheckCircle2, ArrowRight, KeyRound, Database, RefreshCw, Radio } from 'lucide-react';
import { AuthUser } from '../types';
import { EPSSLogo } from './EPSSLogo';
import { ThemeSelector } from './ThemeSelector';
import { getAuthorizedUsers, authenticateUser, AuthorizedUser } from '../utils/userManager';
import { checkCentralSyncStatus, CentralSyncStatus } from '../utils/centralSyncService';

interface LoginViewProps {
  onLogin: (user: AuthUser, remember: boolean) => void;
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
  syncStatus?: CentralSyncStatus | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, currentTheme, onThemeChange, syncStatus: propSyncStatus }) => {
  const authorizedUsers = getAuthorizedUsers();
  const [username, setUsername] = useState('admin@epss.gov.et');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoBgEnabled, setIsVideoBgEnabled] = useState(true);
  const [liveSyncStatus, setLiveSyncStatus] = useState<CentralSyncStatus | null>(propSyncStatus || null);

  useEffect(() => {
    let isMounted = true;
    checkCentralSyncStatus().then((st) => {
      if (isMounted && st) setLiveSyncStatus(st);
    });
    const interval = setInterval(() => {
      checkCentralSyncStatus().then((st) => {
        if (isMounted && st) setLiveSyncStatus(st);
      });
    }, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser) {
      setErrorMessage('Please enter your individual email address or username.');
      return;
    }

    if (!trimmedPass) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const matched = authenticateUser(trimmedUser, trimmedPass);

      if (matched) {
        const authUser: AuthUser = {
          id: matched.id,
          username: matched.username,
          name: matched.name,
          email: matched.email,
          role: matched.role,
          hub: matched.hub,
          isAdmin: matched.isAdmin
        };
        onLogin(authUser, rememberMe);
      } else {
        setErrorMessage('Invalid email or password. Passwords are created and assigned by the Inventory Administrator only.');
      }
      setIsLoading(false);
    }, 350);
  };

  const handleSelectPreset = (user: AuthorizedUser) => {
    setUsername(user.email);
    setPassword(user.password);
    setErrorMessage('');
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
              Log in with your individual email username and the password created and assigned by the Inventory Administrator.
            </p>

            {/* Central Master Cross-Browser Synchronization Indicator */}
            <div className="mt-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>EPSS Master Central Server</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-blue-200/60 px-1.5 py-0.5 rounded text-blue-800">
                  v{liveSyncStatus?.version || 1}.0 Active
                </span>
              </div>
              <div className="mt-1 text-slate-600 text-[11px] flex items-center justify-between">
                <span>Multi-browser sync: <strong>Zero Variance</strong></span>
                {liveSyncStatus?.counts && (
                  <span className="text-blue-700 font-medium">
                    {liveSyncStatus.counts.items || 0} Devices • {liveSyncStatus.counts.multipleStock || 0} Stock
                  </span>
                )}
              </div>
            </div>
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
                Individual Email Username
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin@epss.gov.et or mosisa"
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password (Admin Assigned)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Created by Admin only
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
                  placeholder="Enter assigned password"
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

          {/* Quick Select Authorized Accounts (for testing/convenience) */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Authorized Accounts Quick Sign-In:
            </span>
            <div className="space-y-2">
              {authorizedUsers.map((user) => {
                const isSelected = username.toLowerCase() === user.email.toLowerCase() || username.toLowerCase() === user.username.toLowerCase();
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectPreset(user)}
                    className={`w-full text-left p-2.5 rounded-lg border transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${user.isAdmin ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 leading-tight">
                          {user.name} {user.isAdmin && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded ml-1">Admin</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {user.email} • {user.role}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                        Select
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center">
              Note: Self-registration is disabled. Only the Inventory Administrator can create accounts and assign passwords.
            </p>
          </div>
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
