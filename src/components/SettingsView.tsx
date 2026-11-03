import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Globe,
  Database,
  RefreshCw,
  CheckCircle2,
  Shield,
  Bell,
  Sliders,
  Palette,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RotateCcw,
  Activity,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Copy,
  Check,
  Building2,
  Coins,
  Clock,
  ExternalLink,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  User,
  KeyRound,
  Plus,
  Trash2,
  Lock,
  FileSpreadsheet,
  FileText,
  Archive
} from 'lucide-react';
import { Language } from '../utils/localization';
import { HeaderNavThemeId, MasterDataLog, DspWorkflowRecord } from '../types';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { HEADER_NAV_THEMES } from '../utils/headerNavThemes';
import { ThemeCreatorSection } from './ThemeCreatorSection';
import {
  SystemSettingsConfig,
  REGIONAL_HUBS,
  loadSystemSettings,
  saveSystemSettings,
  resetSystemSettingsToDefaults,
  playSystemAudioChime,
  runLiveSystemDiagnostics,
  DiagnosticReport,
  applyFontScaleToDOM
} from '../utils/systemSettings';
import {
  getAuthorizedUsers,
  addAuthorizedUser,
  deleteAuthorizedUser,
  resetUserPassword,
  AuthorizedUser
} from '../utils/userManager';

interface SettingsViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  headerNavThemeId: HeaderNavThemeId;
  onThemeChange: (themeId: HeaderNavThemeId) => void;
  isOnline: boolean;
  onSyncNow: () => void;
  isSyncing: boolean;
  cachedMeta: any;
  fontScale: 'normal' | 'large' | 'compact' | 'maximize';
  onFontScaleChange: (scale: 'normal' | 'large' | 'compact' | 'maximize') => void;
  userId?: string;
  dspRecords?: DspWorkflowRecord[];
}

type SettingsSection = 'general' | 'appearance' | 'theme-creator' | 'thresholds' | 'notifications' | 'backup' | 'logs' | 'moh-history' | 'diagnostics' | 'users';

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  onLanguageChange,
  headerNavThemeId,
  onThemeChange,
  isOnline,
  onSyncNow,
  isSyncing,
  cachedMeta,
  fontScale,
  onFontScaleChange,
  userId,
  dspRecords = []
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<SystemSettingsConfig>(loadSystemSettings);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Access & Credential Management State
  const [usersList, setUsersList] = useState<AuthorizedUser[]>(getAuthorizedUsers);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('Biomedical Officer');
  const [newUserHub, setNewUserHub] = useState('Central Hub (HO01)');
  const [isNewUserAdmin, setIsNewUserAdmin] = useState(false);

  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [assignedPasswordInput, setAssignedPasswordInput] = useState('');

  // Master Data Upload Logs State
  const [uploadLogs, setUploadLogs] = useState<MasterDataLog[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'users', userId, 'masterDataLogs'),
      orderBy('uploadedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data() as MasterDataLog);
      setUploadLogs(logs);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      language,
      headerNavThemeId
    }));
  }, [language, headerNavThemeId]);

  // Listen to sidebar sub-nav clicks
  useEffect(() => {
    const handleSectionSelect = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsSection>;
      if (customEvent.detail) {
        setActiveSection(customEvent.detail);
      }
    };
    window.addEventListener('epss_select_settings_section', handleSectionSelect);
    return () => window.removeEventListener('epss_select_settings_section', handleSectionSelect);
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    if (settings.audioFeedbackEnabled) {
      playSystemAudioChime('chime', settings.soundVolume);
    }
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const updateSetting = <K extends keyof SystemSettingsConfig>(key: K, value: SystemSettingsConfig[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSystemSettings(updated);
    if (key === 'fontScale') {
      onFontScaleChange?.(value as any);
      applyFontScaleToDOM(value as any);
    }
  };

  const handleTestAudio = () => {
    playSystemAudioChime('success', settings.soundVolume);
    triggerSuccess(language === 'am' ? 'የድምፅ ፍተሻ ተሳክቷል' : 'Audio chime tested successfully');
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiag(true);
    if (settings.audioFeedbackEnabled) {
      playSystemAudioChime('click', settings.soundVolume);
    }
    try {
      const report = await runLiveSystemDiagnostics();
      setDiagnosticReport(report);
      triggerSuccess(language === 'am' ? 'የስርዓት ምርመራ ተጠናቋል' : 'System diagnostics completed');
    } catch {
      // fallback
    } finally {
      setIsRunningDiag(false);
    }
  };

  const handleCopyDiagnosticReport = () => {
    if (!diagnosticReport) return;
    const text = [
      `EPSS MEDICAL DEVICE SYSTEM DIAGNOSTIC REPORT`,
      `Generated: ${new Date(diagnosticReport.timestamp).toLocaleString()}`,
      `Health Status: ${diagnosticReport.overallHealth.toUpperCase()}`,
      `----------------------------------------`,
      ...diagnosticReport.items.map(i => `[${i.status.toUpperCase()}] ${i.name}: ${i.value} (${i.details})`)
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
    triggerSuccess(language === 'am' ? 'ሪፖርቱ ወደ ቅንጥብ ሰሌዳ ተቀድቷል' : 'Diagnostic report copied to clipboard');
  };

  const handleExportBackup = () => {
    const backupData = {
      system: 'EPSS Medical Device Management System',
      exportDate: new Date().toISOString(),
      version: '2.6.4 Production',
      settings,
      cacheMeta: cachedMeta || null,
      storedKeysCount: localStorage.length
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epss-system-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (settings.audioFeedbackEnabled) {
      playSystemAudioChime('success', settings.soundVolume);
    }
    triggerSuccess(language === 'am' ? 'የስርዓት ቅንብሮች መጠባበቂያ ፋይል ወርዷል' : 'System settings backup downloaded');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.settings) {
          saveSystemSettings(parsed.settings);
          setSettings(parsed.settings);
          if (parsed.settings.language) {
            onLanguageChange(parsed.settings.language);
          }
          if (parsed.settings.headerNavThemeId) {
            onThemeChange(parsed.settings.headerNavThemeId);
          }
          triggerSuccess(language === 'am' ? 'ቅንብሮች በተሳካ ሁኔታ ተመልሰዋል' : 'Configuration restored successfully');
        } else {
          alert('Invalid configuration file structure.');
        }
      } catch (err) {
        alert('Could not parse JSON configuration file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearCache = () => {
    // Keep credentials & settings, clear non-critical temporary keys
    const keysToPreserve = ['epss_system_settings_v1', 'selectedSpreadsheetId', 'ignoredSheetTabs'];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToPreserve.includes(key) && key.startsWith('epss_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    triggerSuccess(
      language === 'am'
        ? `${keysToRemove.length} ጊዜያዊ መሸጎጫዎች ተሰርዘዋል`
        : `Cleared ${keysToRemove.length} temporary cached items`
    );
  };

  const handleConfirmReset = () => {
    const defaults = resetSystemSettingsToDefaults();
    setSettings(defaults);
    onLanguageChange(defaults.language);
    onThemeChange(defaults.headerNavThemeId as HeaderNavThemeId);
    setIsResetConfirmOpen(false);
    triggerSuccess(language === 'am' ? 'ቅንብሮች ወደ ነባሪ ተመልሰዋል' : 'Settings restored to factory defaults');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      alert('Please fill in name, email, and assigned password.');
      return;
    }
    addAuthorizedUser({
      username: newUserEmail.split('@')[0],
      email: newUserEmail.trim(),
      password: newUserPassword.trim(),
      name: newUserName.trim(),
      role: newUserRole.trim(),
      hub: newUserHub.trim(),
      isAdmin: isNewUserAdmin
    });
    setUsersList(getAuthorizedUsers());
    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    triggerSuccess('Authorized user created with admin-assigned password');
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (username === 'admin') {
      alert('Cannot delete primary system administrator.');
      return;
    }
    if (confirm('Are you sure you want to revoke access for this user?')) {
      deleteAuthorizedUser(id);
      setUsersList(getAuthorizedUsers());
      triggerSuccess('User access revoked');
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUserId || !assignedPasswordInput.trim()) return;
    const success = resetUserPassword(resetModalUserId, assignedPasswordInput.trim());
    if (success) {
      setUsersList(getAuthorizedUsers());
      setResetModalUserId(null);
      setAssignedPasswordInput('');
      triggerSuccess('User password successfully updated by admin');
    }
  };

  // Section tabs configuration
  const sections = [
    {
      id: 'general',
      label: language === 'am' ? 'አጠቃላይ እና ክልላዊ' : 'General & Regional',
      icon: Globe,
      desc: language === 'am' ? 'ቋንቋ፣ ቅርንጫፍ ማዕከል እና ገንዘብ' : 'Language, primary hub & currency'
    },
    {
      id: 'appearance',
      label: language === 'am' ? 'ገጽታ እና ማሳያ' : 'Appearance & Themes',
      icon: Palette,
      desc: language === 'am' ? 'ቀለሞች፣ የሰንጠረዥ ጥግግት' : 'Themes, row density & contrast'
    },
    {
      id: 'theme-creator',
      label: language === 'am' ? 'የገጽታ ፈጣሪ' : 'Theme Creator',
      icon: Sparkles,
      desc: language === 'am' ? 'ብጁ የመጀመሪያ እና ሁለተኛ ቀለሞች' : 'Custom primary & secondary color palettes'
    },
    {
      id: 'thresholds',
      label: language === 'am' ? 'የክምችት እና ማስጠንቀቂያ ወሰኖች' : 'Inventory & Thresholds',
      icon: Sliders,
      desc: language === 'am' ? 'ዝቅተኛ ክምችት፣ የመጨረሻ ቀን' : 'Critical stock, expiry & service'
    },
    {
      id: 'notifications',
      label: language === 'am' ? 'ድምፅ እና ማሳወቂያዎች' : 'Sound & Notifications',
      icon: Bell,
      desc: language === 'am' ? 'የድምፅ ግብረ-መልስ፣ አውቶ-ማመሳሰል' : 'Audio chime, alerts & auto-sync'
    },
    {
      id: 'backup',
      label: language === 'am' ? 'መጠባበቂያ እና ማከማቻ' : 'Backup & Data Storage',
      icon: Database,
      desc: language === 'am' ? 'JSON ማውጣት/ማስገባት፣ መሸጎጫ' : 'JSON export/import & cache tools'
    },
    {
      id: 'diagnostics',
      label: language === 'am' ? 'የስርዓት ምርመራ' : 'System Diagnostics',
      icon: Activity,
      desc: language === 'am' ? 'የኔትወርክ ፍጥነት፣ የማህደረ ትውስታ ጤና' : 'Network latency & memory quota'
    },
    {
      id: 'moh-history',
      label: language === 'am' ? 'የMOH ኤክስፖርት ታሪክ' : 'MOH Export History',
      icon: ExternalLink,
      desc: language === 'am' ? 'ወደ ጤና ጥበቃ ሚኒስቴር የተላኩ መረጃዎች' : 'Transmission logs of data sent to MOH'
    },
    {
      id: 'logs',
      label: language === 'am' ? 'የመረጃ መዝገቦች' : 'Master Data Logs',
      icon: Clock,
      desc: language === 'am' ? 'የፋይል ጭነት ታሪክ' : 'Audit history of master data uploads'
    },
    {
      id: 'users',
      label: language === 'am' ? 'የተጠቃሚዎች እና የይለፍ ቃል አስተዳደር' : 'User & Access Management',
      icon: User,
      desc: language === 'am' ? 'የግል ኢሜይል እና የአስተዳዳሪ የይለፍ ቃሎች' : 'Manage users, individual email login & passwords'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 shrink-0">
            <Settings className="w-8 h-8 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
                {language === 'am' ? 'የስርዓት ውቅር' : 'System Configuration'}
              </span>
              <span className="text-xs text-slate-400">
                {language === 'am' ? 'የኢትዮጵያ መድኃኒት አቅራቢ አገልግሎት (EPSS)' : 'Ethiopian Pharmaceuticals Supply Service (EPSS)'}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-400 text-xs font-mono">v2.6.4 Production</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              {language === 'am' ? 'የስርዓት ቅንብሮች እና ምርጫዎች' : 'System Settings & Operational Preferences'}
            </h2>
            <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
              {language === 'am'
                ? 'የማሳያ ቋንቋ፣ የክልል ቅርንጫፍ ማዕከላት፣ የክምችት ዝቅተኛ ማስጠንቀቂያ ወሰኖች፣ የድምፅ ግብረ-መልስ፣ የመረጃ መጠባበቂያ እና የምርመራ መሳሪያዎችን ያስተዳድሩ።'
                : 'Configure language, regional hubs, stock threshold triggers, audio feedback chimes, automated data backups, and live diagnostic health tests.'}
            </p>
          </div>
        </div>

        {/* Network & Quick Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">
              {language === 'am' ? 'የኔትወርክ ሁኔታ' : 'Network Link'}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-xs font-bold text-white">
                {isOnline ? (language === 'am' ? 'የተገናኘ' : 'Online Connected') : (language === 'am' ? 'ከመስመር ውጭ' : 'Offline Mode')}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title={language === 'am' ? 'ቅንብሮችን ወደ ነባሪ መልስ' : 'Reset to default configuration'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'am' ? 'ወደ ነባሪ መልስ' : 'Reset Defaults'}</span>
          </button>
        </div>
      </div>

      {/* Segmented Section Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none">
        {sections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => {
                setActiveSection(sec.id as SettingsSection);
                if (settings.audioFeedbackEnabled) {
                  playSystemAudioChime('click', settings.soundVolume);
                }
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. GENERAL & REGIONAL */}
      {activeSection === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language Selection */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የማሳያ ቋንቋ ምርጫ' : 'Display Language'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የመተግበሪያውን ዋና ቋንቋ ይምረጡ' : 'Select primary interface language'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  onLanguageChange('en');
                  updateSetting('language', 'en');
                  triggerSuccess('Language switched to English');
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  language === 'en'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">English</span>
                  {language === 'en' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <span className="text-[10px] text-slate-400 mt-2">
                  Standard Federal Health Terminology
                </span>
              </button>

              <button
                onClick={() => {
                  onLanguageChange('am');
                  updateSetting('language', 'am');
                  triggerSuccess('ቋንቋ ወደ አማርኛ ተቀይሯል (Amharic)');
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  language === 'am'
                    ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">አማርኛ (Amharic)</span>
                  {language === 'am' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <span className="text-[10px] text-slate-400 mt-2">
                  የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ
                </span>
              </button>
            </div>
          </div>

          {/* Primary Assigned Regional Hub */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'ነባሪ የክልል ቅርንጫፍ ማዕከል' : 'Default Assigned Regional Hub'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'በስራ ማስጀመሪያ ላይ ቅድሚያ የሚሰጠው ማዕከል' : 'Initial hub filter when accessing inventory'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-300 block">
                {language === 'am' ? 'የተመረጠ ማዕከል' : 'Selected EPSS Branch / Hub'}
              </label>
              <select
                value={settings.defaultRegionalHub}
                onChange={(e) => {
                  updateSetting('defaultRegionalHub', e.target.value);
                  triggerSuccess(language === 'am' ? `ነባሪ ማዕከል: ${e.target.value}` : `Default hub set to: ${e.target.value}`);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {REGIONAL_HUBS.map(hub => (
                  <option key={hub} value={hub}>{hub}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {language === 'am'
                  ? 'ይህ አማራጭ በክምችት እና በስርጭት ገጾች ላይ የትኛውን ማዕከል በቅድሚያ ማየት እንደሚፈልጉ ይወስናል።'
                  : 'Pre-selects this distribution hub across the inventory, warehouse, and maintenance breakdown modules.'}
              </p>
            </div>
          </div>

          {/* Currency Preference */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የንብረት ግምት የገንዘብ አይነት' : 'Asset Valuation Currency'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'በዳሽቦርድ እና ሪፖርቶች ላይ የሚታይ' : 'Currency display for stock valuations and procurement'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  updateSetting('currency', 'ETB');
                  triggerSuccess('Currency set to Ethiopian Birr (ETB)');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  settings.currency === 'ETB'
                    ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">ETB (Ethiopian Birr)</span>
                  {settings.currency === 'ETB' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">የኢትዮጵያ ብር (ብሔራዊ ባንክ)</span>
              </button>

              <button
                onClick={() => {
                  updateSetting('currency', 'USD');
                  triggerSuccess('Currency set to US Dollars (USD)');
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  settings.currency === 'USD'
                    ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">USD ($ Dollars)</span>
                  {settings.currency === 'USD' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Donor & International Procurement</span>
              </button>
            </div>
          </div>

          {/* Date Formatting */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-violet-500/20 border border-violet-500/30 rounded-xl text-violet-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የቀን አቀራረብ ቅርጸት' : 'Date Display Format'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የስርጭት እና የመጨረሻ ቀናት አቀራረብ' : 'Formatting for expiry dates and delivery schedules'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {[
                { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 04/10/2026)', desc: 'Standard Ethiopian Official Format' },
                { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-10-04)', desc: 'ISO International Standard' },
                { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 10/04/2026)', desc: 'US Medical Equipment Standard' }
              ].map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    updateSetting('dateFormat', fmt.id as any);
                    triggerSuccess(`Date format updated to ${fmt.id}`);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between text-xs ${
                    settings.dateFormat === fmt.id
                      ? 'bg-violet-600/20 border-violet-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div>
                    <span className="font-semibold block">{fmt.label}</span>
                    <span className="text-[10px] text-slate-400">{fmt.desc}</span>
                  </div>
                  {settings.dateFormat === fmt.id && <Check className="w-4 h-4 text-violet-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. APPEARANCE & THEMES */}
      {activeSection === 'appearance' && (
        <div className="space-y-6">
          {/* Font Size Selection */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      {language === 'am' ? 'የቅርጸ-ቁምፊ መጠን' : 'Font Size'}
                    </h3>
                    {settings.fontScale === 'maximize' && (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md animate-pulse">
                        MAXIMIZED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {language === 'am' ? 'የመተግበሪያውን ጽሁፍ መጠን ያስተካክሉ' : 'Adjust the global text size for the interface'}
                  </p>
                </div>
              </div>

              {/* Quick Stepper & Scale Indicator */}
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  title="Decrease font size"
                  onClick={() => {
                    const order: Array<SystemSettingsConfig['fontScale']> = ['compact', 'normal', 'large', 'maximize'];
                    const currentIndex = order.indexOf(settings.fontScale);
                    if (currentIndex > 0) {
                      const prevScale = order[currentIndex - 1];
                      updateSetting('fontScale', prevScale);
                      triggerSuccess(language === 'am' ? `መጠን ወደ ${prevScale} ዝቅ ተደርጓል` : `Font scale decreased to ${prevScale}`);
                    }
                  }}
                  disabled={settings.fontScale === 'compact'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="px-3 text-center min-w-[90px]">
                  <span className="text-xs font-mono font-bold text-cyan-300 block">
                    {settings.fontScale === 'compact' ? '85%' : settings.fontScale === 'normal' ? '100%' : settings.fontScale === 'large' ? '115%' : '138%'}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                    {settings.fontScale === 'maximize' ? '22px Base' : settings.fontScale === 'large' ? '18.5px Base' : settings.fontScale === 'compact' ? '14px Base' : '16px Base'}
                  </span>
                </div>
                <button
                  type="button"
                  title="Increase font size"
                  onClick={() => {
                    const order: Array<SystemSettingsConfig['fontScale']> = ['compact', 'normal', 'large', 'maximize'];
                    const currentIndex = order.indexOf(settings.fontScale);
                    if (currentIndex < order.length - 1) {
                      const nextScale = order[currentIndex + 1];
                      updateSetting('fontScale', nextScale);
                      triggerSuccess(language === 'am' ? `መጠን ወደ ${nextScale} ከፍ ተደርጓል` : `Font scale increased to ${nextScale}`);
                    }
                  }}
                  disabled={settings.fontScale === 'maximize'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Scale Selection Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {[
                {
                  id: 'compact',
                  label: language === 'am' ? 'ትንሽ' : 'Small',
                  sub: '85% / 14px',
                  desc: language === 'am' ? 'የታመቀ እይታ' : 'Compact view',
                  badge: null
                },
                {
                  id: 'normal',
                  label: language === 'am' ? 'መካከለኛ' : 'Medium',
                  sub: '100% / 16px',
                  desc: language === 'am' ? 'መደበኛ እይታ' : 'Standard view',
                  badge: null
                },
                {
                  id: 'large',
                  label: language === 'am' ? 'ትልቅ' : 'Large',
                  sub: '115% / 18.5px',
                  desc: language === 'am' ? 'ትልቅ እይታ' : 'Large view',
                  badge: null
                },
                {
                  id: 'maximize',
                  label: language === 'am' ? 'ከፍተኛ መጠን (Maximize)' : 'Maximize',
                  sub: '138% / 22px',
                  desc: language === 'am' ? 'ለቀላል ንባብ እጅግ የጎላ' : 'Maximum enlarged view',
                  badge: 'MAX'
                }
              ].map(option => {
                const isSelected = settings.fontScale === option.id;
                const isMaximize = option.id === 'maximize';
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      updateSetting('fontScale', option.id as any);
                      triggerSuccess(language === 'am' ? `የጽሁፍ መጠን ወደ ${option.label} ተቀይሯል` : `Font scale set to ${option.label}`);
                    }}
                    className={`relative p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[92px] ${
                      isSelected
                        ? isMaximize
                          ? 'bg-gradient-to-b from-amber-500/20 via-cyan-950/40 to-slate-900 border-amber-400/80 text-white shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                          : 'bg-cyan-600/25 border-cyan-500 text-white font-bold shadow-md shadow-cyan-500/10'
                        : isMaximize
                          ? 'bg-slate-950/80 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {option.badge && (
                      <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded uppercase shadow">
                        {option.badge}
                      </span>
                    )}
                    <div className="w-full">
                      <div className="flex items-center justify-center gap-1.5">
                        {isMaximize && <Maximize2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className={`text-xs font-bold block ${isSelected ? 'text-white' : ''}`}>
                          {option.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400 font-semibold block mt-0.5">
                        {option.sub}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1.5 leading-tight">
                      {option.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Maximize CTA if not currently maximized */}
            {settings.fontScale !== 'maximize' ? (
              <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-amber-300">
                  <Maximize2 className="w-4 h-4 shrink-0 text-amber-400" />
                  <p className="text-xs">
                    {language === 'am'
                      ? 'የጠረጴዛዎች እና የጽሁፍ መጠኖችን በአንድ ጠቅታ ወደ ከፍተኛ መጠን ከፍ ያድርጉ (138% / 22px)'
                      : 'Maximize all table rows, badges, and interface typography with one click for high legibility.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSetting('fontScale', 'maximize');
                    triggerSuccess(language === 'am' ? 'የጽሁፍ መጠን በከፍተኛ ተለቅ ተደርጓል' : 'Text size maximized across the entire interface');
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg shadow transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{language === 'am' ? 'አሁን አጎላ (Maximize Now)' : 'Maximize Text Now'}</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <p className="text-xs font-medium">
                  {language === 'am'
                    ? 'የጽሁፍ መጠን በአሁኑ ወቅት በከፍተኛ መጠን (Maximized) ላይ ተቀምጧል - ሁሉም መረጃዎች በግልጽ ይታያሉ'
                    : 'Maximum text size is currently active. All tables, cards, and labels are scaled up for maximum legibility.'}
                </p>
              </div>
            )}

            {/* Interactive Live Preview Sandbox */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    {language === 'am' ? 'የቀጥታ የጽሁፍ እይታ (Live Preview Sandbox)' : 'Live Text Preview at Current Scale'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Active: {settings.fontScale.toUpperCase()}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">ICU Ventilator Series-X</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      OPERATIONAL
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">SN: EPSS-MED-2026-8841</span>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                  <span>Plant: Addis Ababa Central Hub (AA01)</span>
                  <span className="text-cyan-400 font-semibold">Qty: 24 Units Allocated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Theme Creator Quick Access Banner */}
          <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-purple-950/70 rounded-2xl p-5 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    {language === 'am' ? 'ብጁ የገጽታ ቀለም ፈጣሪ (Theme Creator)' : 'Custom Theme Creator for Administrators'}
                  </h4>
                  <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                    ADMIN STUDIO
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  {language === 'am'
                    ? 'የመጀመሪያ እና የሁለተኛ ደረጃ ቀለሞችን በከለር መራጭ ያዘጋጁ እና በቋሚነት ለመላው መተግበሪያ ያስቀምጡ።'
                    : 'Define custom corporate primary & secondary color schemes using color pickers and save them to localStorage for the entire app.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSection('theme-creator')}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-cyan-950/50"
            >
              <Palette className="w-4 h-4" />
              <span>{language === 'am' ? 'የገጽታ ፈጣሪን ክፈት' : 'Launch Theme Creator'}</span>
            </button>
          </div>

          {/* Header Navigation Theme Selector */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የራስጌ እና የዳሰሳ ገጽታ' : 'Header & Navigation Theme'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የዳሽቦርድ ዋና ቀለም እና የንድፍ ስልት ይምረጡ' : 'Select color scheme and contrast profile'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {HEADER_NAV_THEMES.map((theme) => {
                const isSelected = headerNavThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      onThemeChange(theme.id);
                      updateSetting('headerNavThemeId', theme.id);
                      triggerSuccess(`Theme applied: ${theme.name}`);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-600/25 border-purple-500 text-white shadow-lg shadow-purple-950/40 ring-1 ring-purple-400/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate text-white">{theme.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 ml-2" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{theme.description}</p>
                    <div className={`mt-3 h-2 rounded-full w-full bg-gradient-to-r ${theme.previewGradient} border border-white/10`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Table Row Density */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {language === 'am' ? 'የሰንጠረዥ መስመር ጥግግት' : 'Table Row Density'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'am' ? 'የእቃ ዝርዝሮች ከፍታ እና ክፍተት' : 'Adjust spacing for large inventory lists'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { id: 'compact', label: language === 'am' ? 'የተጨመቀ' : 'Compact', desc: 'Max items per view' },
                  { id: 'comfortable', label: language === 'am' ? 'ምቹ' : 'Comfortable', desc: 'Standard balance' },
                  { id: 'spacious', label: language === 'am' ? 'ሰፊ' : 'Spacious', desc: 'High readability' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      updateSetting('tableRowDensity', item.id as any);
                      triggerSuccess(`Table density set to ${item.label}`);
                    }}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      settings.tableRowDensity === item.id
                        ? 'bg-cyan-600/25 border-cyan-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* High Contrast Mode */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {language === 'am' ? 'ከፍተኛ ንፅፅር ሁነታ' : 'High Contrast Borders'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'am' ? 'የዳርቻ መስመሮችን እና ፅሁፎችን ያጎላል' : 'Enhance visibility in bright warehouse environments'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {settings.highContrast
                      ? (language === 'am' ? 'ንቁ (በርቷል)' : 'Enabled')
                      : (language === 'am' ? 'ቦዝኗል (ጠፍቷል)' : 'Standard Contrast')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'am' ? 'ለዝቅተኛ ብርሃን ወይም ለደማቅ ማሳያዎች ተስማሚ' : 'Boosts border strokes and sharpens table dividers'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.highContrast;
                    updateSetting('highContrast', next);
                    triggerSuccess(next ? 'High contrast enabled' : 'Standard contrast restored');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.highContrast ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.highContrast ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: THEME CREATOR */}
      {activeSection === 'theme-creator' && (
        <ThemeCreatorSection
          language={language}
          onThemeChange={onThemeChange}
          onTriggerToast={triggerSuccess}
        />
      )}

      {/* TAB CONTENT: 3. INVENTORY & THRESHOLDS */}
      {activeSection === 'thresholds' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Critical Low Stock Threshold */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'አስቸኳይ ዝቅተኛ ክምችት ወሰን (Critical ≤ N)' : 'Critical Stock Threshold (≤ N)'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'ቀይ ማስጠንቀቂያ የሚቀሰቅስበት የንጥል ብዛት' : 'Trigger urgent red procurement alert'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  {language === 'am' ? 'የተመረጠ ወሰን:' : 'Current Threshold:'}
                </span>
                <span className="text-sm font-mono font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                  ≤ {settings.criticalStockThreshold} {language === 'am' ? 'ንጥሎች' : 'Units'}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="25"
                value={settings.criticalStockThreshold}
                onChange={(e) => updateSetting('criticalStockThreshold', parseInt(e.target.value, 10))}
                className="w-full accent-rose-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>1 Unit (Urgent)</span>
                <span>Default: 5 Units</span>
                <span>25 Units (Buffer)</span>
              </div>
            </div>
          </div>

          {/* Reorder Warning Level */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የድጋሚ ትዕዛዝ ደረጃ (Reorder Level)' : 'Reorder Warning Level'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'ቢጫ ማስጠንቀቂያ የሚቀሰቅስበት ክልል' : 'Trigger amber replenishment warning'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  {language === 'am' ? 'የድጋሚ ትዕዛዝ ወሰን:' : 'Reorder Ceiling:'}
                </span>
                <span className="text-sm font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                  ≤ {settings.reorderStockThreshold} {language === 'am' ? 'ንጥሎች' : 'Units'}
                </span>
              </div>

              <input
                type="range"
                min="6"
                max="50"
                value={settings.reorderStockThreshold}
                onChange={(e) => updateSetting('reorderStockThreshold', parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>6 Units</span>
                <span>Default: 15 Units</span>
                <span>50 Units</span>
              </div>
            </div>
          </div>

          {/* Near-Expiry Warning Window */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የመጨረሻ ቀን ማስጠንቀቂያ መስኮት' : 'Near-Expiry Notice Window'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'መድሃኒቶች እና ሬጀንቶች ከማለቃቸው በፊት' : 'Lead-time before medical consumables or reagents expire'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2">
              {[30, 60, 90, 180].map(days => (
                <button
                  key={days}
                  onClick={() => {
                    updateSetting('nearExpiryDays', days);
                    triggerSuccess(`Expiry alert set to ${days} days`);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                    settings.nearExpiryDays === days
                      ? 'bg-blue-600/25 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{days} {language === 'am' ? 'ቀን' : 'Days'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Biomedical Equipment Maintenance Interval */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የባዮሜዲካል ጥገና ምርመራ ክፍተት' : 'Biomedical Service Interval'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የመከላከያ ጥገና (PPM) መርሐግብር' : 'Recommended preventative maintenance interval'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { months: 3, label: '3 Months (Quarterly)' },
                { months: 6, label: '6 Months (Bi-Annual)' },
                { months: 12, label: '12 Months (Annual)' }
              ].map(item => (
                <button
                  key={item.months}
                  onClick={() => {
                    updateSetting('biomedicalServiceIntervalMonths', item.months);
                    triggerSuccess(`Maintenance interval set to ${item.label}`);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                    settings.biomedicalServiceIntervalMonths === item.months
                      ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. SOUND & NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio Chime Feedback */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                {settings.audioFeedbackEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የድምፅ ግብረ-መልስ (Audio Chime)' : 'Operational Audio Chimes'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'በባርኮድ ስካን እና ማረጋገጫ ወቅት ድምፅ ይሰማ' : 'Audible feedback during barcode scans and uploads'}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {settings.audioFeedbackEnabled
                      ? (language === 'am' ? 'በርቷል (ንቁ)' : 'Enabled')
                      : (language === 'am' ? 'ጠፍቷል' : 'Muted')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'am' ? 'የድር አውዲዮ ሲንተሳይዘር ቴክኖሎጂ' : 'Synthesized Web Audio tones'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.audioFeedbackEnabled;
                    updateSetting('audioFeedbackEnabled', next);
                    if (next) playSystemAudioChime('chime', settings.soundVolume);
                    triggerSuccess(next ? 'Sound feedback enabled' : 'Sound feedback muted');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.audioFeedbackEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.audioFeedbackEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {settings.audioFeedbackEnabled && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>{language === 'am' ? 'የድምፅ መጠን:' : 'Chime Volume:'}</span>
                    <span className="font-mono font-bold text-cyan-400">{settings.soundVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.soundVolume}
                    onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <button
                    onClick={handleTestAudio}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-cyan-500/30"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{language === 'am' ? 'የድምፅ ፍተሻ አድርግ' : 'Test Audio Chime Now'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Sync Polling Interval */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'ራስ-ሰር የማመሳሰል ድግግሞሽ' : 'Auto-Sync Polling Frequency'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'ከGoogle Sheets ጋር በየስንት ደቂቃው ይመሳሰል' : 'Automated spreadsheet background pull'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {[
                { minutes: 0, label: 'Manual Only', desc: 'Sync on button click' },
                { minutes: 5, label: 'Every 5 Minutes', desc: 'High frequency' },
                { minutes: 15, label: 'Every 15 Minutes', desc: 'Recommended default' },
                { minutes: 30, label: 'Every 30 Minutes', desc: 'Low bandwidth mode' }
              ].map(item => (
                <button
                  key={item.minutes}
                  onClick={() => {
                    updateSetting('autoSyncIntervalMinutes', item.minutes);
                    triggerSuccess(`Auto-sync frequency set to ${item.label}`);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    settings.autoSyncIntervalMinutes === item.minutes
                      ? 'bg-emerald-600/25 border-emerald-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold block">{item.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                onSyncNow();
                triggerSuccess('Instant sync initiated');
              }}
              disabled={isSyncing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing Live Data...' : 'Synchronize Live Data Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. BACKUP, RESTORE & DATA STORAGE */}
      {activeSection === 'backup' && (
        <div className="space-y-6">
          {/* Supabase & Cloud SQL Hub Banner */}
          <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-blue-500/30 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    PostgreSQL & Supabase SQL Hub
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      13 Tables Configured
                    </span>
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Upload all visible data in one click or export complete SQL DDL & seeds for Supabase
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('epss:open_upload_all_sql'))}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/50 transition flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Open Unified Upload & SQL Hub</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-100">
              <div className="p-3 rounded-xl bg-blue-900/30 border border-blue-700/40">
                <span className="font-bold text-white block">1. One-Click Cloud Upload</span>
                <p className="text-blue-200/80 mt-1">
                  Uploads all visible records from inventory, facilities, multiple stock, receiving, and distribution in one operation.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-900/30 border border-blue-700/40">
                <span className="font-bold text-white block">2. Complete Supabase Schema</span>
                <p className="text-blue-200/80 mt-1">
                  Ready-to-run <code className="text-cyan-300">/supabase_schema.sql</code> script with RLS policies and high-speed B-Tree indexes.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-900/30 border border-blue-700/40">
                <span className="font-bold text-white block">3. Drizzle ORM Sync</span>
                <p className="text-blue-200/80 mt-1">
                  All 13 tables are mapped in <code className="text-cyan-300">src/db/schema.ts</code> for TypeScript type safety.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Settings & Local Cache Backup */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {language === 'am' ? 'የስርዓት ውቅር መጠባበቂያ ፋይል አውርድ' : 'Export System Configuration Backup'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'am' ? 'ሁሉንም ቅንብሮች እና የመሸጎጫ መረጃዎች በJSON አስቀምጥ' : 'Download complete settings profile as a JSON backup file'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                {language === 'am'
                  ? 'ይህ እርምጃ የተመረጡትን የማዕከል ምርጫዎች፣ የክምችት ወሰኖች፣ የገጽታ ቅንብሮች እና የመረጃ መሸጎጫዎች የያዘ የJSON ፋይል ያወርዳል።'
                  : 'Exports current preferences, threshold limits, assigned hub configurations, and cache metadata for disaster recovery.'}
              </p>

              <button
                onClick={handleExportBackup}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'am' ? 'መጠባበቂያ ፋይል አውርድ (JSON)' : 'Download Backup File (.json)'}</span>
              </button>
            </div>

            {/* Import / Restore Settings */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {language === 'am' ? 'ቅንብሮችን ከመጠባበቂያ ፋይል መልስ' : 'Restore Configuration from JSON'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'am' ? 'ቀደም ሲል የተዘጋጀ የJSON መጠባበቂያ ፋይል ጫን' : 'Import settings profile from an existing backup'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                {language === 'am'
                  ? 'ቀደም ሲል ያወረዱትን የስርዓት ውቅር ፋይል በመምረጥ ሁሉንም ምርጫዎችዎን ወዲያውኑ መልሰው ማግኘት ይችላሉ።'
                  : 'Upload an EPSS backup JSON file to immediately restore your team preferences and threshold alerts.'}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{language === 'am' ? 'ፋይል ምረጥ እና አስገባ' : 'Upload Backup File (.json)'}</span>
              </button>
            </div>
          </div>

          {/* Cache Maintenance & Reset */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የአካባቢ ማህደረ ትውስታ እና መሸጎጫ አስተዳደር' : 'LocalStorage & Cache Maintenance'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'ጊዜያዊ መረጃዎችን ማጽዳት ወይም ወደ ነባሪ መመለስ' : 'Purge transient cache items or perform factory reset'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">
                  {language === 'am' ? 'ጊዜያዊ መሸጎጫ አጽዳ' : 'Purge Temporary Local Cache'}
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {language === 'am'
                    ? 'የመግቢያ መረጃዎችን ሳያጠፋ ጊዜያዊ የመረጃ ቅጂዎችን እና የሰንጠረዥ ማጣሪያዎችን ያጸዳል።'
                    : 'Removes cached spreadsheet rows and filter states while preserving your active credentials and key settings.'}
                </p>
                <button
                  onClick={handleClearCache}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-700 mt-1"
                >
                  {language === 'am' ? 'ጊዜያዊ መሸጎጫ አጽዳ' : 'Clear Temporary Cache'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                <span className="text-xs font-bold text-rose-300 block">
                  {language === 'am' ? 'ሁሉንም ቅንብሮች ወደ ፋብሪካ ነባሪ መልስ' : 'Factory Reset All Settings'}
                </span>
                <p className="text-[11px] text-rose-200/70 leading-relaxed">
                  {language === 'am'
                    ? 'ሁሉንም ብጁ ምርጫዎች፣ ወሰኖች እና ገጽታዎች ወደ መጀመሪያው የመጫኛ ሁኔታ ይመልሳል።'
                    : 'Reverts language, threshold limits, assigned hub, and themes to initial factory defaults.'}
                </p>
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow-sm mt-1"
                >
                  {language === 'am' ? 'ወደ ነባሪ መልስ' : 'Reset to Defaults'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 6. SYSTEM DIAGNOSTICS & HEALTH */}
      {activeSection === 'diagnostics' && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'am' ? 'የቀጥታ የስርዓት ጤና እና ምርመራ' : 'Live System Health & Diagnostic Suite'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የኔትወርክ ፍጥነት፣ የማህደረ ትውስታ እና የአሳሽ ዝግጁነት ፍተሻ' : 'Measure network latency, local storage quota, and browser environment health'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {diagnosticReport && (
                <button
                  onClick={handleCopyDiagnosticReport}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? (language === 'am' ? 'ተቀድቷል' : 'Copied!') : (language === 'am' ? 'ቅጂ አድርግ' : 'Copy Report')}</span>
                </button>
              )}

              <button
                onClick={handleRunDiagnostics}
                disabled={isRunningDiag}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isRunningDiag ? 'animate-spin' : ''}`} />
                <span>{isRunningDiag ? (language === 'am' ? 'በመመርመር ላይ...' : 'Running Diagnostics...') : (language === 'am' ? 'ምርመራ ጀምር' : 'Run Diagnostics Now')}</span>
              </button>
            </div>
          </div>

          {!diagnosticReport && !isRunningDiag ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">
                {language === 'am' ? 'ምንም የምርመራ ሪፖርት አልተሰራም' : 'No Diagnostic Run Yet'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
                {language === 'am'
                  ? 'የኔትወርክ ፍጥነትዎን፣ የአካባቢ ማከማቻዎን እና የድረ-ገጽ ችሎታዎችን ለመፈተሽ "ምርመራ ጀምር" የሚለውን ቁልፍ ይጫኑ።'
                  : 'Click "Run Diagnostics Now" to verify network round-trip latency, LocalStorage quota, and Web Audio synthesizer hardware.'}
              </p>
              <button
                onClick={handleRunDiagnostics}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {language === 'am' ? 'የስርዓት ምርመራ ጀምር' : 'Execute Diagnostic Check'}
              </button>
            </div>
          ) : isRunningDiag ? (
            <div className="text-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-300">
                {language === 'am' ? 'የስርዓት ፍተሻዎች እየተካሄዱ ነው...' : 'Testing network round-trip, storage quota, and browser engines...'}
              </p>
            </div>
          ) : (
            diagnosticReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{language === 'am' ? 'የጤና ሁኔታ:' : 'Overall System Status:'}</span>
                    <span className={`font-bold ${diagnosticReport.overallHealth === 'optimal' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {diagnosticReport.overallHealth === 'optimal' ? '● OPTIMAL & HEALTHY' : '▲ ATTENTION ADVISED'}
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                  {diagnosticReport.items.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.name}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            item.status === 'optimal'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">{item.details}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400 shrink-0">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* TAB CONTENT: 7. MASTER DATA UPLOAD LOGS */}
      {activeSection === 'logs' && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {language === 'am' ? 'የመረጃ መዝገቦች' : 'Master Data Upload Logs'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'am'
                  ? 'የፋይል ጭነት ታሪክ እና ዝርዝር መረጃ'
                  : 'Complete audit history of Health Facility Master and Inventory bulk uploads.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4">Data Type</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4 text-center">Records</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {uploadLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                      No upload logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  uploadLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-400">
                        {new Date(log.uploadedAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                          log.type === 'HF Master' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          log.type === 'Material Master' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-200">
                        {log.fileName}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-cyan-400">
                        {log.rowCount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {log.fileUrl ? (
                          <a
                            href={log.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center justify-end gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Source</span>
                          </a>
                        ) : (
                          <span className="text-slate-600 text-[10px] italic">No File Stored</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MOH EXPORT HISTORY */}
      {activeSection === 'moh-history' && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <ExternalLink className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {language === 'am' ? 'የMOH ኤክስፖርት ታሪክ' : 'MOH Submission & Export History'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'am'
                  ? 'ወደ ጤና ጥበቃ ሚኒስቴር በተሳካ ሁኔታ የተላኩ የመረጃ ስብስቦች'
                  : 'Audit trail of all Distribution Suggestion Plans successfully transmitted to the Ministry of Health portal.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Transmission Date</th>
                  <th className="py-3 px-4">DSP Reference</th>
                  <th className="py-3 px-4">Workflow Stage</th>
                  <th className="py-3 px-4 text-right">Devices</th>
                  <th className="py-3 px-4 text-right">Total Qty</th>
                  <th className="py-3 px-4">Binary Files</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dspRecords.filter(r => r.status === 'Submitted & Pending' || r.status === 'Endorsed & Approved' || r.status === 'Dispatched to Plants').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500 italic">
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="w-8 h-8 opacity-20" />
                        <span>No successful transmissions to MOH found in the audit history.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dspRecords
                    .filter(r => r.status === 'Submitted & Pending' || r.status === 'Endorsed & Approved' || r.status === 'Dispatched to Plants')
                    .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime())
                    .map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-400">
                          {rec.dateSubmitted}
                        </td>
                        <td className="py-4 px-4 font-bold text-white">
                          {rec.dspRefNumber}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 uppercase">
                            {rec.stageTitle || rec.stage}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-cyan-400">
                          {rec.totalDevices}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">
                          {rec.totalQuantity.toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1 max-w-[200px]">
                            {rec.excelFile && (
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold truncate" title={rec.excelFile.name}>
                                <FileSpreadsheet className="w-3 h-3 shrink-0" />
                                <span className="truncate">{rec.excelFile.name}</span>
                              </div>
                            )}
                            {rec.pdfFile && (
                              <div className="flex items-center gap-1.5 text-[10px] text-rose-500 font-bold truncate" title={rec.pdfFile.name}>
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="truncate">{rec.pdfFile.name}</span>
                              </div>
                            )}
                            {rec.zipFile && (
                              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold truncate" title={rec.zipFile.name}>
                                <Archive className="w-3 h-3 shrink-0" />
                                <span className="truncate">{rec.zipFile.name}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            rec.status === 'Endorsed & Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            rec.status === 'Dispatched to Plants' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>All transmissions verified with immutable binary payload hashing.</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              Audit System v2.6
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 8. USER & ACCESS MANAGEMENT */}
      {activeSection === 'users' && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {language === 'am' ? 'የተጠቃሚዎች እና የይለፍ ቃል አስተዳደር' : 'User Access & Credential Management'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'am'
                    ? 'ለሌሎች ተጠቃሚዎች የግል ኢሜይል መለያዎችን መፍጠር እና በአስተዳዳሪ ብቻ የሚሰጥ የይለፍ ቃል ማስተዳደር።'
                    : 'Except Inventory Administrator, all users log in via the system link using individual email usernames with passwords created and given by admin only.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'am' ? 'አዲስ ተጠቃሚ ጨምር' : 'Add Authorized User'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {usersList.map((u) => (
              <div key={u.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${u.isAdmin ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-cyan-300 border border-slate-700'}`}>
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{u.name}</span>
                      {u.isAdmin ? (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                          Inventory Administrator
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                          {u.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span>Email: <strong className="text-slate-200">{u.email}</strong></span>
                      <span>•</span>
                      <span>Hub: <strong className="text-slate-200">{u.hub}</strong></span>
                      <span>•</span>
                      <span className="font-mono text-cyan-400">Assigned Password: {u.password}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => {
                      setResetModalUserId(u.id);
                      setAssignedPasswordInput(u.password);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                    title="Change or reset user password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{language === 'am' ? 'የይለፍ ቃል ቀይር' : 'Assign Password'}</span>
                  </button>

                  {u.username !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer border border-rose-500/20"
                      title="Revoke user access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                <span>{language === 'am' ? 'አዲስ የተፈቀደ ተጠቃሚ ጨምር' : 'Add Authorized System User'}</span>
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Dr. Abebe Kebede"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Individual Email Username</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. abebe@epss.gov.et"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admin-Assigned Password</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="e.g. securePass2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono text-cyan-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This password is created and given by the admin only for the user to access via the system link.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role / Designation</label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g. Regional Biomedical Officer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Hub / Location</label>
                <select
                  value={newUserHub}
                  onChange={(e) => setNewUserHub(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {REGIONAL_HUBS.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isAdminCheckbox"
                  checked={isNewUserAdmin}
                  onChange={(e) => setIsNewUserAdmin(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="isAdminCheckbox" className="text-xs text-slate-300 cursor-pointer">
                  Grant Inventory Administrator privileges
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition cursor-pointer shadow-lg shadow-cyan-950/40"
                >
                  Create & Assign Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalUserId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <span>Assign New Password</span>
              </h3>
              <button
                onClick={() => setResetModalUserId(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Admin-Assigned Password</label>
                <input
                  type="text"
                  required
                  value={assignedPasswordInput}
                  onChange={(e) => setAssignedPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono text-cyan-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Give this password to the user to securely log in with their email address.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetModalUserId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition cursor-pointer shadow-lg shadow-cyan-950/40"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {language === 'am' ? 'ቅንብሮችን ወደ ነባሪ መመለስ እርግጠኛ ነዎት?' : 'Confirm Factory Settings Reset'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'ይህ እርምጃ ሊቀለበስ አይችልም' : 'This action cannot be undone'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'am'
                ? 'ይህ የተመረጡትን የማዕከል ምርጫዎች፣ የክምችት ዝቅተኛ ማስጠንቀቂያ ወሰኖች እና የገጽታ ቀለሞችን ወደ መጀመሪያው ሁኔታ ይመልሳል።'
                : 'This will reset all your custom thresholds, assigned regional hubs, sound volume preferences, and visual themes back to factory defaults.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                {language === 'am' ? 'ተወው' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition cursor-pointer shadow-lg shadow-rose-950/40"
              >
                {language === 'am' ? 'አዎ፣ ወደ ነባሪ መልስ' : 'Yes, Reset Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
