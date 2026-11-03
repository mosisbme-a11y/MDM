import React from 'react';
import { Palette, Check, Layout, Compass, ShieldAlert, Settings } from 'lucide-react';
import { HeaderNavThemeId } from '../types';
import { HEADER_NAV_THEMES, getMergedHeaderNavThemes, getHeaderNavThemeById } from '../utils/headerNavThemes';

interface HeaderNavThemeSelectorProps {
  currentThemeId: HeaderNavThemeId;
  onThemeChange: (themeId: HeaderNavThemeId) => void;
  language: string;
}

export const HeaderNavThemeSelector: React.FC<HeaderNavThemeSelectorProps> = ({
  currentThemeId,
  onThemeChange,
  language
}) => {
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

  const availableThemes = getMergedHeaderNavThemes();
  const activeTheme = getHeaderNavThemeById(currentThemeId);

  const titleText = language === 'am' ? 'የዳሽቦርድ ጭብጥ' : 'Menu Theme';
  const headerText = language === 'am' ? 'የምናሌ እና የራስጌ ጭብጥ ይምረጡ' : 'Select Nav & Header Theme';

  return (
    <div className="relative" ref={containerRef} id="header-nav-theme-selector-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer shadow-xs focus:outline-hidden focus:ring-1 focus:ring-cyan-500/50"
        title="Customize Header & Navigation Bar Theme"
        id="header-nav-theme-toggle-btn"
      >
        <Palette className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>{titleText}</span>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800"
          id="header-nav-theme-dropdown"
        >
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-700">{headerText}</h3>
            <span className="text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-200">
              {availableThemes.length} Options
            </span>
          </div>

          <div className="p-1.5 max-h-[380px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
            {availableThemes.map((theme) => {
              const isSelected = currentThemeId === theme.id;
              
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    onThemeChange(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-2 rounded-lg transition text-left cursor-pointer border ${
                    isSelected 
                      ? 'bg-cyan-50/70 border-cyan-400 text-cyan-900 shadow-2xs' 
                      : 'hover:bg-slate-50 border-transparent text-slate-700'
                  }`}
                  id={`theme-option-${theme.id}`}
                >
                  {/* Theme Gradient Preview */}
                  <div className={`w-9 h-9 rounded-md shrink-0 bg-gradient-to-br ${theme.previewGradient} border border-slate-300 shadow-inner flex items-center justify-center relative overflow-hidden`}>
                    {/* Tiny header/sidebar line indicators */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/40" />
                    <div className="absolute top-1.5 left-0 bottom-0 w-2.5 bg-slate-800/15" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-cyan-600/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-700" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-cyan-800' : 'text-slate-900'}`}>
                        {theme.name}
                      </span>
                      {theme.category === 'special' && (
                        <span className="text-[8px] font-bold text-pink-700 bg-pink-50 px-1 rounded border border-pink-200">
                          Special
                        </span>
                      )}
                      {theme.category === 'light' && (
                        <span className="text-[8px] font-bold text-slate-600 bg-slate-100 px-1 rounded border border-slate-200">
                          Light
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{theme.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-200 bg-slate-50 text-[9px] text-slate-500 flex items-center justify-between">
            <span>Perfect alignment with operational layouts</span>
            <span className="font-mono text-cyan-700 font-bold">v2.6 Customizer</span>
          </div>
        </div>
      )}
    </div>
  );
};
