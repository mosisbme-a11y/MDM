import { HeaderNavThemeOption } from '../types';

export interface CustomThemeConfig {
  id: string; // 'custom-admin'
  name: string;
  primaryColor: string;     // Brand color for buttons, active accents, indicators
  secondaryColor: string;   // Surface background for sidebar & cards
  accentColor: string;      // Accent highlight for badges and status
  headerBgColor: string;    // Custom header background
  sidebarBgColor: string;   // Custom sidebar background
  mode: 'dark' | 'light';
  createdAt: string;
  updatedAt: string;
}

export const CUSTOM_THEME_PRESETS: {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBgColor: string;
  sidebarBgColor: string;
  mode: 'dark' | 'light';
}[] = [
  {
    id: 'ethiopian-emerald',
    name: 'Ethiopian Health Emerald',
    description: 'Vibrant national emerald green with rich dark forest surfaces',
    primaryColor: '#059669',
    secondaryColor: '#064e3b',
    accentColor: '#34d399',
    headerBgColor: '#064e3b',
    sidebarBgColor: '#022c22',
    mode: 'dark'
  },
  {
    id: 'epss-medical-cyan',
    name: 'EPSS Medical Cyan',
    description: 'High-tech biomedical cyan on dark slate foundation',
    primaryColor: '#0891b2',
    secondaryColor: '#0f172a',
    accentColor: '#22d3ee',
    headerBgColor: '#0f172a',
    sidebarBgColor: '#0b1120',
    mode: 'dark'
  },
  {
    id: 'addis-central-sapphire',
    name: 'Addis Central Sapphire',
    description: 'Federal executive royal blue with deep midnight styling',
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    accentColor: '#60a5fa',
    headerBgColor: '#1e293b',
    sidebarBgColor: '#0f172a',
    mode: 'dark'
  },
  {
    id: 'ministry-amethyst',
    name: 'Ministry Amethyst',
    description: 'Deep violet branding with obsidian card surfaces',
    primaryColor: '#7c3aed',
    secondaryColor: '#18181b',
    accentColor: '#a78bfa',
    headerBgColor: '#18181b',
    sidebarBgColor: '#09090b',
    mode: 'dark'
  },
  {
    id: 'oromia-amber-gold',
    name: 'Oromia Sunset Amber',
    description: 'Warm earth amber gold with dark espresso surfaces',
    primaryColor: '#d97706',
    secondaryColor: '#292524',
    accentColor: '#fbbf24',
    headerBgColor: '#292524',
    sidebarBgColor: '#1c1917',
    mode: 'dark'
  },
  {
    id: 'biomedical-crimson',
    name: 'Biomedical Crimson Alert',
    description: 'High-visibility ruby crimson on charcoal backdrop',
    primaryColor: '#dc2626',
    secondaryColor: '#1f1f23',
    accentColor: '#f87171',
    headerBgColor: '#1f1f23',
    sidebarBgColor: '#141416',
    mode: 'dark'
  },
  {
    id: 'clinical-pure-light',
    name: 'Clinical Pure White',
    description: 'Hospital clean high-contrast white & medical sky blue',
    primaryColor: '#0284c7',
    secondaryColor: '#f8fafc',
    accentColor: '#0369a1',
    headerBgColor: '#ffffff',
    sidebarBgColor: '#f1f5f9',
    mode: 'light'
  }
];

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  id: 'custom-admin',
  name: 'Custom Admin Theme',
  primaryColor: '#0891b2',
  secondaryColor: '#0f172a',
  accentColor: '#22d3ee',
  headerBgColor: '#0f172a',
  sidebarBgColor: '#090d16',
  mode: 'dark',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Color Utility Functions
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

export const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

export const isColorDark = (hex: string): boolean => {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const lum = getLuminance(rgb.r, rgb.g, rgb.b);
  return lum < 0.35;
};

export const getContrastRatio = (hex1: string, hex2: string): number => {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return parseFloat(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
};

export const adjustBrightness = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 + percent / 100;
  const clamp = (val: number) => Math.min(255, Math.max(0, Math.round(val)));
  const r = clamp(rgb.r * factor).toString(16).padStart(2, '0');
  const g = clamp(rgb.g * factor).toString(16).padStart(2, '0');
  const b = clamp(rgb.b * factor).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

export const convertConfigToThemeOption = (config: CustomThemeConfig): HeaderNavThemeOption => {
  const isDark = config.mode === 'dark' || isColorDark(config.sidebarBgColor || config.secondaryColor);
  const textColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const subtextColor = isDark ? 'text-slate-400' : 'text-slate-600';

  // Compute contrast for active items
  const navActiveTextColor = isColorDark(config.primaryColor) ? '#ffffff' : '#0f172a';
  const borderColor = isDark ? adjustBrightness(config.secondaryColor, 20) : adjustBrightness(config.secondaryColor, -15);
  const headerBorderColor = isDark ? adjustBrightness(config.headerBgColor, 25) : adjustBrightness(config.headerBgColor, -20);
  const sidebarHeaderBg = isDark ? adjustBrightness(config.sidebarBgColor, -15) : adjustBrightness(config.sidebarBgColor, -5);

  return {
    id: 'custom-admin',
    name: config.name || 'Custom Admin Theme',
    category: isDark ? 'dark' : 'light',
    description: `Custom ${config.primaryColor} on ${config.secondaryColor}`,
    headerBg: isDark ? 'bg-slate-900' : 'bg-white',
    headerBorder: isDark ? 'border-slate-800' : 'border-slate-200',
    sidebarBg: isDark ? 'bg-slate-900' : 'bg-slate-50',
    sidebarBorder: isDark ? 'border-slate-800' : 'border-slate-200',
    sidebarHeaderBg: isDark ? 'bg-slate-950' : 'bg-slate-100',
    navActiveBg: 'shadow-md font-bold',
    navInactiveHover: isDark ? 'hover:bg-slate-800/60 text-slate-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-600 hover:text-slate-950',
    accentColor: `text-[${config.accentColor || config.primaryColor}]`,
    textColor,
    subtextColor,
    badgeActiveBg: 'border font-bold',
    searchBg: isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300',
    previewGradient: `from-[${config.primaryColor}] to-[${config.secondaryColor}]`,
    isCustom: true,
    customStyles: {
      headerBgColor: config.headerBgColor || config.secondaryColor,
      headerBorderColor: headerBorderColor,
      sidebarBgColor: config.sidebarBgColor || config.secondaryColor,
      sidebarBorderColor: borderColor,
      sidebarHeaderBgColor: sidebarHeaderBg,
      navActiveBgColor: config.primaryColor,
      navActiveTextColor: navActiveTextColor,
      accentColor: config.accentColor || config.primaryColor,
      textColor: isDark ? '#f8fafc' : '#0f172a',
      subtextColor: isDark ? '#94a3b8' : '#64748b',
      badgeBgColor: config.primaryColor + '33',
      badgeTextColor: config.primaryColor
    }
  };
};

export const applyCustomThemeCSSVariables = (config: CustomThemeConfig): void => {
  try {
    const root = document.documentElement;
    root.style.setProperty('--epss-primary', config.primaryColor);
    root.style.setProperty('--epss-secondary', config.secondaryColor);
    root.style.setProperty('--epss-accent', config.accentColor || config.primaryColor);
    root.style.setProperty('--epss-header-bg', config.headerBgColor || config.secondaryColor);
    root.style.setProperty('--epss-sidebar-bg', config.sidebarBgColor || config.secondaryColor);
    root.style.setProperty('--epss-text-on-primary', isColorDark(config.primaryColor) ? '#ffffff' : '#0f172a');
  } catch (e) {
    console.debug('Failed to set root CSS variables', e);
  }
};

let memoryThemeHistory: CustomThemeConfig[] = [];

export const loadCustomThemeConfig = (): CustomThemeConfig | null => {
  return null;
};

export const saveCustomThemeConfig = (config: CustomThemeConfig): void => {
  try {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    
    // Save to memory history
    memoryThemeHistory = memoryThemeHistory.filter(h => h.id !== updated.id && h.name !== updated.name);
    memoryThemeHistory.unshift(updated);
    if (memoryThemeHistory.length > 8) memoryThemeHistory.pop();

    applyCustomThemeCSSVariables(updated);
    window.dispatchEvent(new CustomEvent('epss_custom_theme_saved', { detail: updated }));
  } catch (e) {
    console.error('Failed to apply custom theme', e);
  }
};

export const loadCustomThemeHistory = (): CustomThemeConfig[] => {
  return memoryThemeHistory;
};

export const deleteCustomThemeConfig = (): void => {
  try {
    const root = document.documentElement;
    root.style.removeProperty('--epss-primary');
    root.style.removeProperty('--epss-secondary');
    root.style.removeProperty('--epss-accent');
    root.style.removeProperty('--epss-header-bg');
    root.style.removeProperty('--epss-sidebar-bg');
    root.style.removeProperty('--epss-text-on-primary');
    window.dispatchEvent(new CustomEvent('epss_custom_theme_deleted'));
  } catch (e) {
    console.error('Failed to delete custom theme', e);
  }
};
