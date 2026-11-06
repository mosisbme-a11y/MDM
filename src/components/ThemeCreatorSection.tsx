import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Layers,
  FileSpreadsheet,
  Warehouse,
  Search,
  RefreshCw,
  Bell,
  Building2
} from 'lucide-react';
import { Language } from '../utils/localization';
import { HeaderNavThemeId } from '../types';
import {
  CustomThemeConfig,
  CUSTOM_THEME_PRESETS,
  DEFAULT_CUSTOM_THEME,
  loadCustomThemeConfig,
  saveCustomThemeConfig,
  loadCustomThemeHistory,
  deleteCustomThemeConfig,
  getContrastRatio,
  isColorDark,
  applyCustomThemeCSSVariables
} from '../utils/customTheme';
import { playSystemAudioChime } from '../utils/systemSettings';

interface ThemeCreatorSectionProps {
  language: Language;
  onThemeChange: (themeId: HeaderNavThemeId) => void;
  onTriggerToast: (msg: string) => void;
}

export const ThemeCreatorSection: React.FC<ThemeCreatorSectionProps> = ({
  language,
  onThemeChange,
  onTriggerToast
}) => {
  const [themeName, setThemeName] = useState('Executive Custom Theme');
  const [primaryColor, setPrimaryColor] = useState('#0891b2');
  const [secondaryColor, setSecondaryColor] = useState('#0f172a');
  const [accentColor, setAccentColor] = useState('#22d3ee');
  const [headerBgColor, setHeaderBgColor] = useState('#0f172a');
  const [sidebarBgColor, setSidebarBgColor] = useState('#090d16');
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [savedThemes, setSavedThemes] = useState<CustomThemeConfig[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Load existing custom theme if any on mount
  useEffect(() => {
    const existing = loadCustomThemeConfig();
    if (existing) {
      setThemeName(existing.name || 'Executive Custom Theme');
      setPrimaryColor(existing.primaryColor);
      setSecondaryColor(existing.secondaryColor);
      setAccentColor(existing.accentColor || existing.primaryColor);
      setHeaderBgColor(existing.headerBgColor || existing.secondaryColor);
      setSidebarBgColor(existing.sidebarBgColor || existing.secondaryColor);
      setMode(existing.mode || 'dark');
    }
    setSavedThemes(loadCustomThemeHistory());
  }, []);

  // Compute contrast ratios for accessibility checks
  const primaryTextContrast = getContrastRatio(primaryColor, isColorDark(primaryColor) ? '#ffffff' : '#0f172a');
  const secondaryTextContrast = getContrastRatio(secondaryColor, mode === 'dark' ? '#f8fafc' : '#0f172a');
  const isAccessiblePrimary = primaryTextContrast >= 4.5;

  const handleSelectPreset = (preset: typeof CUSTOM_THEME_PRESETS[0]) => {
    setSelectedPresetId(preset.id);
    setThemeName(preset.name);
    setPrimaryColor(preset.primaryColor);
    setSecondaryColor(preset.secondaryColor);
    setAccentColor(preset.accentColor);
    setHeaderBgColor(preset.headerBgColor);
    setSidebarBgColor(preset.sidebarBgColor);
    setMode(preset.mode);
    playSystemAudioChime('click', 70);
    onTriggerToast(language === 'am' ? `ቅድመ-ውቅር ተመርጧል: ${preset.name}` : `Preset selected: ${preset.name}`);
  };

  const handleSaveAndApply = () => {
    const newConfig: CustomThemeConfig = {
      id: 'custom-admin',
      name: themeName.trim() || 'Custom Admin Theme',
      primaryColor,
      secondaryColor,
      accentColor,
      headerBgColor,
      sidebarBgColor,
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveCustomThemeConfig(newConfig);
    applyCustomThemeCSSVariables(newConfig);
    setSavedThemes(loadCustomThemeHistory());
    onThemeChange('custom-admin' as HeaderNavThemeId);
    playSystemAudioChime('success', 80);
    onTriggerToast(
      language === 'am'
        ? `ብጁ ገጽታ "${newConfig.name}" ተቀምጧል እና ለመተግበሪያው ተግብሯል!`
        : `Custom theme "${newConfig.name}" saved & applied across the entire app!`
    );
  };

  const handleResetToDefault = () => {
    deleteCustomThemeConfig();
    setThemeName(DEFAULT_CUSTOM_THEME.name);
    setPrimaryColor(DEFAULT_CUSTOM_THEME.primaryColor);
    setSecondaryColor(DEFAULT_CUSTOM_THEME.secondaryColor);
    setAccentColor(DEFAULT_CUSTOM_THEME.accentColor);
    setHeaderBgColor(DEFAULT_CUSTOM_THEME.headerBgColor);
    setSidebarBgColor(DEFAULT_CUSTOM_THEME.sidebarBgColor);
    setMode(DEFAULT_CUSTOM_THEME.mode);
    onThemeChange('professional-gray');
    playSystemAudioChime('chime', 70);
    onTriggerToast(language === 'am' ? 'ገጽታ ወደ ነባሪ ተመልሷል' : 'Theme reset to system defaults');
  };

  const handleExportThemeJSON = () => {
    const data = {
      system: 'EPSS Medical Device Management System',
      type: 'CustomThemeProfile',
      version: '1.0',
      theme: {
        name: themeName,
        primaryColor,
        secondaryColor,
        accentColor,
        headerBgColor,
        sidebarBgColor,
        mode
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epss-theme-${themeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onTriggerToast(language === 'am' ? 'የገጽታ JSON ፋይል ወርዷል' : 'Theme JSON file downloaded');
  };

  const handleImportThemeJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const t = parsed.theme || parsed;
        if (t.primaryColor && t.secondaryColor) {
          setThemeName(t.name || 'Imported Theme');
          setPrimaryColor(t.primaryColor);
          setSecondaryColor(t.secondaryColor);
          setAccentColor(t.accentColor || t.primaryColor);
          setHeaderBgColor(t.headerBgColor || t.secondaryColor);
          setSidebarBgColor(t.sidebarBgColor || t.secondaryColor);
          if (t.mode) setMode(t.mode);
          playSystemAudioChime('chime', 75);
          onTriggerToast(language === 'am' ? 'የገጽታ መረጃ በተሳካ ሁኔታ ገብቷል' : 'Theme imported successfully! Click "Save & Apply"');
        } else {
          alert('Invalid theme file format');
        }
      } catch {
        alert('Could not parse JSON theme file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {language === 'am' ? 'ብጁ የገጽታ ቀለም ፈጣሪ (Theme Creator)' : 'Custom Theme Creator for Administrators'}
              </h3>
              <span className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
                PRO ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'am'
                ? 'የመጀመሪያ እና የሁለተኛ ደረጃ ቀለሞችን በከለር መራጭ ያዘጋጁ እና ለመላው መተግበሪያ በቋሚነት ያስቀምጡ'
                : 'Define custom primary and secondary color palettes using color pickers for the entire app session'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportThemeJSON}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            title="Download theme as JSON file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".json" onChange={handleImportThemeJSON} className="hidden" />
          </label>

          <button
            onClick={handleResetToDefault}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            title="Revert to factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Preset Swatches Palette Ribbon */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          {language === 'am' ? 'የተዘጋጁ ተቋማዊ የቀለም ቅድመ-ውቅሮች (Presets):' : 'Institutional Brand Presets:'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {CUSTOM_THEME_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-500 bg-slate-800/80 shadow-md ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shadow-xs shrink-0"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shadow-xs shrink-0"
                    style={{ backgroundColor: preset.secondaryColor }}
                  />
                </div>
                <span className="text-[11px] font-bold text-white truncate block">{preset.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{preset.primaryColor}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Editor & Live Interactive Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Color Pickers and Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Theme Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              {language === 'am' ? 'የገጽታ ስም (Theme Name):' : 'Custom Theme Name:'}
            </label>
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="e.g. EPSS Addis Central Corporate"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Primary Color Picker */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white block">
                  {language === 'am' ? 'ዋና ቀለም (Primary Brand Color)' : 'Primary Brand Color'}
                </label>
                <span className="text-[11px] text-slate-400 block">
                  {language === 'am'
                    ? 'ለአክቲቭ ምናሌዎች፣ አዝራሮች እና አመልካቾች የሚያገለግል'
                    : 'Active tab highlight, primary action buttons & key indicators'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  maxLength={7}
                  className="w-22 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center uppercase focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Swatches for Primary */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto">
              {['#0891b2', '#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0284c7', '#10b981', '#f59e0b'].map((hex) => (
                <button
                  key={hex}
                  onClick={() => setPrimaryColor(hex)}
                  className={`w-6 h-6 rounded-full border transition cursor-pointer shrink-0 ${
                    primaryColor.toLowerCase() === hex.toLowerCase() ? 'border-white ring-2 ring-cyan-500 scale-110' : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>

          {/* Secondary Color Picker */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white block">
                  {language === 'am' ? 'ሁለተኛ ቀለም / የዳራ ገጽታ (Secondary Surface Color)' : 'Secondary Surface Color'}
                </label>
                <span className="text-[11px] text-slate-400 block">
                  {language === 'am'
                    ? 'ለጎን አምድ (Sidebar)፣ ለካርዶች እና ለዳራ ማሳያዎች የሚያገለግል'
                    : 'System vertical sidebar, card backdrops & navigation containers'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSecondaryColor(val);
                    setSidebarBgColor(val);
                    setHeaderBgColor(val);
                  }}
                  className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSecondaryColor(val);
                    setSidebarBgColor(val);
                    setHeaderBgColor(val);
                  }}
                  maxLength={7}
                  className="w-22 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center uppercase focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Swatches for Secondary */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto">
              {['#0f172a', '#18181b', '#090d16', '#022c22', '#1e293b', '#292524', '#1f1f23', '#f8fafc', '#ffffff'].map((hex) => (
                <button
                  key={hex}
                  onClick={() => {
                    setSecondaryColor(hex);
                    setSidebarBgColor(hex);
                    setHeaderBgColor(hex);
                    setMode(isColorDark(hex) ? 'dark' : 'light');
                  }}
                  className={`w-6 h-6 rounded-full border transition cursor-pointer shrink-0 ${
                    secondaryColor.toLowerCase() === hex.toLowerCase() ? 'border-white ring-2 ring-cyan-500 scale-110' : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>

          {/* Accent Highlight Color */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white block">
                  {language === 'am' ? 'የማድመቂያ ቀለም (Accent Highlight Color)' : 'Accent Highlight Color'}
                </label>
                <span className="text-[11px] text-slate-400 block">
                  {language === 'am' ? 'ለባጅ፣ ለማሳወቂያ ቁጥሮች እና ለትኩረት ቀለበቶች' : 'Badge counters, live sync status & border focus highlights'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  maxLength={7}
                  className="w-22 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center uppercase focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Accessibility & Contrast Indicator */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              {isAccessiblePrimary ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <span className="font-bold text-white block">
                  {language === 'am' ? 'የተደራሽነት እና የንፅፅር ደረጃ (WCAG Contrast)' : 'Accessibility Contrast Rating'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Primary Text Contrast: <strong className="text-white">{primaryTextContrast}:1</strong> ({isAccessiblePrimary ? 'WCAG AA Compliant' : 'Low Contrast Warning'})
                </span>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
              isAccessiblePrimary ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {primaryTextContrast >= 7 ? 'WCAG AAA' : isAccessiblePrimary ? 'WCAG AA' : 'CAUTION'}
            </span>
          </div>

          {/* Save & Apply Primary Action Button */}
          <button
            onClick={handleSaveAndApply}
            className="w-full py-3.5 rounded-xl text-white font-black text-xs shadow-xl transition flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
            style={{
              backgroundColor: primaryColor,
              color: isColorDark(primaryColor) ? '#ffffff' : '#0f172a'
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {language === 'am'
                ? 'ገጽታውን አስቀምጥ እና ለመላው መተግበሪያ ተግብር'
                : 'Save Custom Theme & Apply Across Entire App'}
            </span>
          </button>
        </div>

        {/* Right Column: Live Interactive Preview Canvas (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>{language === 'am' ? 'የቀጥታ ቅድመ-ዕይታ (Live Preview Canvas)' : 'Live Interactive App Preview'}</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Real-time simulation</span>
          </div>

          {/* Mini Mockup Window Container */}
          <div
            className="rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300"
            style={{
              borderColor: secondaryColor,
              backgroundColor: isColorDark(secondaryColor) ? '#020617' : '#f1f5f9'
            }}
          >
            {/* 1. Mockup Header Bar */}
            <div
              className="p-3 border-b flex items-center justify-between transition-colors"
              style={{
                backgroundColor: headerBgColor || secondaryColor,
                borderColor: secondaryColor,
                color: isColorDark(headerBgColor || secondaryColor) ? '#ffffff' : '#0f172a'
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shadow-xs"
                  style={{ backgroundColor: primaryColor, color: isColorDark(primaryColor) ? '#ffffff' : '#0f172a' }}
                >
                  EP
                </div>
                <div className="leading-tight">
                  <span className="text-[11px] font-black tracking-tight block">EPSS PORTAL</span>
                  <span className="text-[8px] font-semibold opacity-70 block">MEDICAL DEVICE</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-[9px] font-bold opacity-80">Live Link</span>
              </div>
            </div>

            {/* 2. Mockup Body: Mini Sidebar + Mini Content Area */}
            <div className="flex min-h-[260px]">
              {/* Mini Sidebar */}
              <div
                className="w-36 p-2.5 border-r space-y-1.5 transition-colors shrink-0"
                style={{
                  backgroundColor: sidebarBgColor || secondaryColor,
                  borderColor: isColorDark(sidebarBgColor) ? '#334155' : '#e2e8f0',
                  color: isColorDark(sidebarBgColor) ? '#f8fafc' : '#0f172a'
                }}
              >
                <span className="text-[9px] font-bold tracking-wider uppercase opacity-60 px-2 block mb-1">
                  MAIN NAVIGATION
                </span>

                {/* Active Tab Mock */}
                <div
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between shadow-xs transition-colors"
                  style={{
                    backgroundColor: primaryColor,
                    color: isColorDark(primaryColor) ? '#ffffff' : '#0f172a'
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Warehouse className="w-3 h-3 shrink-0" />
                    <span className="truncate">Outbound (EPSS)</span>
                  </div>
                  <span
                    className="px-1 py-0.2 rounded-full text-[8px] font-bold"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      color: isColorDark(primaryColor) ? '#ffffff' : '#0f172a'
                    }}
                  >
                    +24
                  </span>
                </div>

                {/* Inactive Tab Mock */}
                <div
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 opacity-70 hover:opacity-100 transition"
                  style={{ color: isColorDark(sidebarBgColor) ? '#cbd5e1' : '#334155' }}
                >
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">Regional Hubs</span>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 opacity-70 hover:opacity-100 transition"
                  style={{ color: isColorDark(sidebarBgColor) ? '#cbd5e1' : '#334155' }}
                >
                  <FileSpreadsheet className="w-3 h-3 shrink-0" />
                  <span className="truncate">Google Sheets</span>
                </div>
              </div>

              {/* Mini Content Canvas */}
              <div className="flex-1 p-3 space-y-2.5 bg-slate-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Stock Overview</span>
                  <button
                    className="px-2 py-1 rounded-md text-[9px] font-bold shadow-xs transition cursor-pointer"
                    style={{
                      backgroundColor: primaryColor,
                      color: isColorDark(primaryColor) ? '#ffffff' : '#0f172a'
                    }}
                  >
                    + New Device
                  </button>
                </div>

                {/* Mini Stat Card */}
                <div
                  className="p-2.5 rounded-xl border bg-slate-900/90 space-y-1"
                  style={{ borderLeftColor: primaryColor, borderLeftWidth: '3px' }}
                >
                  <span className="text-[9px] text-slate-400 block font-semibold">Total Stock Units</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">12,450</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                      style={{
                        backgroundColor: primaryColor + '25',
                        color: primaryColor
                      }}
                    >
                      Active
                    </span>
                  </div>
                </div>

                {/* Mini Badge / Accent pill */}
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[9px] text-slate-300 flex items-center justify-between">
                  <span>Custom Primary Hex:</span>
                  <span className="font-mono font-bold" style={{ color: accentColor }}>
                    {primaryColor}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            {language === 'am'
              ? 'ይህ የቀጥታ ቅድመ-ዕይታ የእርስዎ የቀለም ምርጫ በዳሽቦርዱ አርእስት፣ በጎን አምድ እና በአዝራሮች ላይ እንዴት እንደሚታይ ወዲያውኑ ያሳያል።'
              : 'The live preview dynamically reacts to color picker and hex adjustments, illustrating how navigation tabs, headers, and action buttons will render across your EPSS session.'}
          </p>
        </div>
      </div>

      {/* Saved Custom Themes Library */}
      {savedThemes.length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 block">
            {language === 'am' ? 'የተቀመጡ ብጁ ገጽታዎች ታሪክ (Saved Custom Themes):' : 'Saved Custom Themes Library:'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {savedThemes.map((saved, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: saved.primaryColor }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white truncate block">{saved.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {saved.primaryColor} · {saved.secondaryColor}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    saveCustomThemeConfig(saved);
                    onThemeChange('custom-admin' as HeaderNavThemeId);
                    onTriggerToast(`Activated: ${saved.name}`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 transition cursor-pointer shrink-0"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
