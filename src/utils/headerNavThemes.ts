import { HeaderNavThemeOption } from '../types';

export const HEADER_NAV_THEMES: HeaderNavThemeOption[] = [
  {
    id: 'professional-white',
    name: 'Professional Clinical White',
    category: 'light',
    description: 'Executive clinical clean white background with crisp dark contrast',
    headerBg: 'bg-white',
    headerBorder: 'border-slate-200',
    sidebarBg: 'bg-white',
    sidebarBorder: 'border-slate-200',
    sidebarHeaderBg: 'bg-slate-50',
    navActiveBg: 'bg-cyan-700 text-white font-bold shadow-md shadow-cyan-900/20',
    navInactiveHover: 'hover:bg-slate-100 text-slate-800 hover:text-slate-950 font-semibold',
    accentColor: 'text-cyan-700',
    textColor: 'text-slate-900',
    subtextColor: 'text-slate-600',
    badgeActiveBg: 'bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold',
    searchBg: 'bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600',
    previewGradient: 'from-white to-slate-100'
  },
  {
    id: 'professional-gray',
    name: 'Professional Executive Gray',
    category: 'light',
    description: 'Crisp professional gray background with high-contrast black labels',
    headerBg: 'bg-slate-200',
    headerBorder: 'border-slate-300',
    sidebarBg: 'bg-slate-200',
    sidebarBorder: 'border-slate-300',
    sidebarHeaderBg: 'bg-slate-300/90',
    navActiveBg: 'bg-slate-900 text-white font-bold shadow-md shadow-slate-900/30',
    navInactiveHover: 'hover:bg-slate-300 text-black hover:text-black font-semibold',
    accentColor: 'text-slate-900',
    textColor: 'text-black',
    subtextColor: 'text-slate-700',
    badgeActiveBg: 'bg-slate-300 text-black border border-slate-400 font-bold',
    searchBg: 'bg-white text-black placeholder-slate-500 border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800',
    previewGradient: 'from-slate-200 to-slate-300'
  },
  {
    id: 'taupe-bronze',
    name: 'Warm Gray & Bronze Brown',
    category: 'dark',
    description: 'Sophisticated warm gray and rich brown styling',
    headerBg: 'bg-[#382f2b]',
    headerBorder: 'border-[#4e423d]',
    sidebarBg: 'bg-[#2a221e]',
    sidebarBorder: 'border-[#4e423d]',
    sidebarHeaderBg: 'bg-[#1f1917]',
    navActiveBg: 'bg-gradient-to-r from-amber-700 to-stone-700 text-white shadow-md shadow-black/40',
    navInactiveHover: 'hover:bg-[#382f2b] text-stone-300 hover:text-white',
    accentColor: 'text-amber-400',
    textColor: 'text-stone-200',
    subtextColor: 'text-stone-400',
    badgeActiveBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    searchBg: 'bg-[#1f1917] text-white border-[#4e423d] focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
    previewGradient: 'from-[#2a221e] to-[#382f2b]'
  },
  {
    id: 'slate-dark',
    name: 'Classic Slate Dark',
    category: 'dark',
    description: 'Standard professional charcoal styling',
    headerBg: 'bg-slate-800',
    headerBorder: 'border-slate-700',
    sidebarBg: 'bg-slate-800',
    sidebarBorder: 'border-slate-700',
    sidebarHeaderBg: 'bg-slate-900',
    navActiveBg: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/40',
    navInactiveHover: 'hover:bg-slate-700/60 text-slate-300 hover:text-white',
    accentColor: 'text-cyan-400',
    textColor: 'text-slate-100',
    subtextColor: 'text-slate-300',
    badgeActiveBg: 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40',
    searchBg: 'bg-slate-700 text-white border-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500',
    previewGradient: 'from-slate-800 to-slate-700'
  },
  {
    id: 'medical-cyan',
    name: 'Clinical Teal & Cyan',
    category: 'dark',
    description: 'Refreshing active clinical teal aesthetics',
    headerBg: 'bg-teal-950',
    headerBorder: 'border-teal-900',
    sidebarBg: 'bg-teal-950',
    sidebarBorder: 'border-teal-900',
    sidebarHeaderBg: 'bg-teal-950/80',
    navActiveBg: 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-md shadow-teal-900/50',
    navInactiveHover: 'hover:bg-teal-900/50 text-teal-300/80 hover:text-white',
    accentColor: 'text-cyan-400',
    textColor: 'text-teal-100',
    subtextColor: 'text-teal-400/90',
    badgeActiveBg: 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30',
    searchBg: 'bg-teal-900 text-white border-teal-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400',
    previewGradient: 'from-teal-950 to-cyan-900'
  },
  {
    id: 'royal-navy',
    name: 'Royal Deep Navy',
    category: 'dark',
    description: 'Prestigious deep blue academy vibe',
    headerBg: 'bg-[#0b132b]',
    headerBorder: 'border-slate-800/80',
    sidebarBg: 'bg-[#0b132b]',
    sidebarBorder: 'border-slate-800/80',
    sidebarHeaderBg: 'bg-[#080d1e]',
    navActiveBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/50',
    navInactiveHover: 'hover:bg-[#1c2541]/75 text-slate-400 hover:text-slate-100',
    accentColor: 'text-cyan-400',
    textColor: 'text-slate-200',
    subtextColor: 'text-slate-400',
    badgeActiveBg: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    searchBg: 'bg-[#1c2541] text-white border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
    previewGradient: 'from-[#0b132b] to-[#1c2541]'
  },
  {
    id: 'ethiopian-emerald',
    name: 'Ethiopian Emerald',
    category: 'dark',
    description: 'Local national biomedical colors',
    headerBg: 'bg-emerald-950',
    headerBorder: 'border-emerald-900/60',
    sidebarBg: 'bg-emerald-950',
    sidebarBorder: 'border-emerald-900/60',
    sidebarHeaderBg: 'bg-emerald-950/80',
    navActiveBg: 'bg-gradient-to-r from-emerald-600 to-yellow-600 text-white shadow-md shadow-emerald-900/50',
    navInactiveHover: 'hover:bg-emerald-900/50 text-emerald-300/80 hover:text-white',
    accentColor: 'text-yellow-400',
    textColor: 'text-emerald-100',
    subtextColor: 'text-emerald-400',
    badgeActiveBg: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    searchBg: 'bg-emerald-900 text-white border-emerald-800 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400',
    previewGradient: 'from-emerald-950 to-emerald-900'
  },
  {
    id: 'clinical-light',
    name: 'Clinical Light Slate',
    category: 'light',
    description: 'High-contrast clean hospital white/grey tone',
    headerBg: 'bg-white',
    headerBorder: 'border-slate-200',
    sidebarBg: 'bg-white',
    sidebarBorder: 'border-slate-200',
    sidebarHeaderBg: 'bg-slate-50/80',
    navActiveBg: 'bg-slate-100 text-slate-950 border border-slate-200 font-semibold shadow-2xs',
    navInactiveHover: 'hover:bg-slate-50 text-slate-500 hover:text-slate-800',
    accentColor: 'text-cyan-600',
    textColor: 'text-slate-800',
    subtextColor: 'text-slate-500',
    badgeActiveBg: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    searchBg: 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500',
    previewGradient: 'from-white to-slate-100'
  },
  {
    id: 'amethyst-carbon',
    name: 'Amethyst Indigo',
    category: 'dark',
    description: 'Tech-forward deep violet mode',
    headerBg: 'bg-indigo-900',
    headerBorder: 'border-indigo-800',
    sidebarBg: 'bg-indigo-900',
    sidebarBorder: 'border-indigo-800',
    sidebarHeaderBg: 'bg-indigo-950',
    navActiveBg: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/40',
    navInactiveHover: 'hover:bg-indigo-800 text-slate-200 hover:text-white',
    accentColor: 'text-violet-400',
    textColor: 'text-slate-100',
    subtextColor: 'text-slate-300',
    badgeActiveBg: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
    searchBg: 'bg-indigo-950 text-white border-indigo-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500',
    previewGradient: 'from-indigo-900 to-violet-900'
  },
  {
    id: 'frosted-glass',
    name: 'Modern Glassmorphism',
    category: 'special',
    description: 'Sleek translucent blur background overlay',
    headerBg: 'bg-slate-900/60 backdrop-blur-md',
    headerBorder: 'border-slate-800/40',
    sidebarBg: 'bg-slate-900/70 backdrop-blur-lg',
    sidebarBorder: 'border-slate-800/30',
    sidebarHeaderBg: 'bg-slate-950/30',
    navActiveBg: 'bg-white/10 text-white border border-white/15 shadow-inner',
    navInactiveHover: 'hover:bg-white/5 text-slate-300 hover:text-white',
    accentColor: 'text-cyan-300',
    textColor: 'text-slate-200',
    subtextColor: 'text-slate-400',
    badgeActiveBg: 'bg-white/15 text-white border border-white/20',
    searchBg: 'bg-white/5 text-white placeholder-slate-400 border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/20',
    previewGradient: 'from-slate-900/60 to-slate-800/30 backdrop-blur-xs'
  }
];

// Helper to retrieve custom admin theme from localStorage
export const getActiveCustomThemeOption = (): HeaderNavThemeOption | null => {
  try {
    const raw = localStorage.getItem('epss_custom_theme_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      const isDark = parsed.mode === 'dark' || (parsed.sidebarBgColor && parsed.sidebarBgColor.startsWith('#') && parseInt(parsed.sidebarBgColor.slice(1, 3), 16) < 100);
      return {
        id: 'custom-admin',
        name: parsed.name || 'Custom Admin Theme',
        category: isDark ? 'dark' : 'light',
        description: `Custom ${parsed.primaryColor} on ${parsed.secondaryColor}`,
        headerBg: isDark ? 'bg-slate-900' : 'bg-white',
        headerBorder: isDark ? 'border-slate-800' : 'border-slate-200',
        sidebarBg: isDark ? 'bg-slate-900' : 'bg-slate-50',
        sidebarBorder: isDark ? 'border-slate-800' : 'border-slate-200',
        sidebarHeaderBg: isDark ? 'bg-slate-950' : 'bg-slate-100',
        navActiveBg: 'shadow-md font-bold',
        navInactiveHover: isDark ? 'hover:bg-slate-800/60 text-slate-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-600 hover:text-slate-950',
        accentColor: `text-[${parsed.accentColor || parsed.primaryColor}]`,
        textColor: isDark ? 'text-slate-100' : 'text-slate-900',
        subtextColor: isDark ? 'text-slate-400' : 'text-slate-600',
        badgeActiveBg: 'border font-bold',
        searchBg: isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300',
        previewGradient: `from-[${parsed.primaryColor}] to-[${parsed.secondaryColor}]`,
        isCustom: true,
        customStyles: {
          headerBgColor: parsed.headerBgColor || parsed.secondaryColor,
          headerBorderColor: isDark ? '#334155' : '#cbd5e1',
          sidebarBgColor: parsed.sidebarBgColor || parsed.secondaryColor,
          sidebarBorderColor: isDark ? '#334155' : '#cbd5e1',
          sidebarHeaderBgColor: parsed.headerBgColor || parsed.secondaryColor,
          navActiveBgColor: parsed.primaryColor,
          navActiveTextColor: '#ffffff',
          accentColor: parsed.accentColor || parsed.primaryColor,
          textColor: isDark ? '#f8fafc' : '#0f172a',
          subtextColor: isDark ? '#94a3b8' : '#64748b',
          badgeBgColor: parsed.primaryColor + '33',
          badgeTextColor: parsed.primaryColor
        }
      };
    }
  } catch {
    // fallback
  }
  return null;
};

export const getMergedHeaderNavThemes = (): HeaderNavThemeOption[] => {
  const custom = getActiveCustomThemeOption();
  if (custom) {
    return [custom, ...HEADER_NAV_THEMES.filter(t => t.id !== 'custom-admin')];
  }
  return HEADER_NAV_THEMES;
};

export const getHeaderNavThemeById = (id: string): HeaderNavThemeOption => {
  if (id === 'custom-admin') {
    const custom = getActiveCustomThemeOption();
    if (custom) return custom;
  }
  return HEADER_NAV_THEMES.find(t => t.id === id) || HEADER_NAV_THEMES[0];
};

// Initial check to populate custom theme if already in localStorage
const initialCustom = getActiveCustomThemeOption();
if (initialCustom && !HEADER_NAV_THEMES.some(t => t.id === 'custom-admin')) {
  HEADER_NAV_THEMES.unshift(initialCustom);
}

