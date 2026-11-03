import React from 'react';
import { Palette, Check, Sun, Moon, Droplets, Layout, Image as ImageIcon, Video } from 'lucide-react';

export interface ThemeOption {
  id: string;
  name: string;
  bgClass: string;
  icon: React.ElementType;
  description: string;
  type?: 'color' | 'image' | 'video';
  source?: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'warm-taupe',
    name: 'Warm Gray & Bronze',
    bgClass: 'bg-stone-100',
    icon: Palette,
    description: 'Sophisticated warm gray and bronze brown tones',
    type: 'color'
  },
  {
    id: 'classic',
    name: 'Classic Slate',
    bgClass: 'bg-slate-100',
    icon: Layout,
    description: 'Professional enterprise grayscale',
    type: 'color'
  },
  {
    id: 'medical-blue',
    name: 'Medical Blue',
    bgClass: 'bg-blue-50/50',
    icon: Droplets,
    description: 'Calm healthcare atmosphere',
    type: 'color'
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    bgClass: 'bg-white',
    icon: Sun,
    description: 'High-contrast clinical look',
    type: 'color'
  },
  {
    id: 'midnight-lab',
    name: 'Executive Slate',
    bgClass: 'bg-slate-100',
    icon: Moon,
    description: 'Crisp executive clinical mode',
    type: 'color'
  },
  {
    id: 'hospital-view',
    name: 'Modern Clinic',
    bgClass: 'bg-slate-100',
    icon: ImageIcon,
    description: 'High-quality medical facility image',
    type: 'image',
    source: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2053'
  },
  {
    id: 'tech-video',
    name: 'Digital Pulse',
    bgClass: 'bg-slate-900',
    icon: Video,
    description: 'Ambient animated laboratory background',
    type: 'video',
    source: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-lines-and-dots-in-blue-background-27258-large.mp4'
  }
];

interface ThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTheme = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
        title="Change Background Theme"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Background Theme</h3>
          </div>
          <div className="p-1">
            {THEMES.map((theme) => {
              const Icon = theme.icon;
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    onThemeChange(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition text-left cursor-pointer ${
                    isSelected ? 'bg-cyan-50 border border-cyan-100' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-cyan-900' : 'text-slate-900'}`}>{theme.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-cyan-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{theme.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
