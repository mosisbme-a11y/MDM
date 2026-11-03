import React from 'react';

interface MOHLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only' | 'horizontal';
  theme?: 'dark' | 'light' | 'auto';
  showBadge?: boolean;
}

export const MOHLogo: React.FC<MOHLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  theme = 'auto',
  showBadge = false,
}) => {
  // Size mappings
  const markDimensions = {
    sm: { w: 32, h: 32 },
    md: { w: 48, h: 48 },
    lg: { w: 64, h: 64 },
    xl: { w: 84, h: 84 }
  }[size];

  // MOH Logo Image
  const LogoMark = (
    <img
      src="/public/assets/aistudio/_373DB10B-B1BF-4959-94FC-FF8923A3C59E__4708e8e6.png"
      alt="Ministry of Health Logo"
      style={{ width: markDimensions.w, height: markDimensions.h }}
      className="shrink-0 object-contain"
    />
  );

  const isDark = theme === 'dark';

  if (variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {LogoMark}
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div className="p-1 rounded-xl bg-white shadow-xs border border-slate-100/90 flex items-center justify-center shrink-0">
          {LogoMark}
        </div>
        <div className="leading-tight">
          <div className={`font-black text-sm sm:text-base tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Ethiopian
          </div>
          <div className={`font-bold text-xs sm:text-sm tracking-tight leading-none mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            Pharmaceutical
          </div>
          <div className={`text-[10px] sm:text-[11px] font-normal tracking-wide mt-0.5 ${isDark ? 'text-cyan-300' : 'text-slate-600'}`}>
            Supply Service
          </div>
        </div>
      </div>
    );
  }

  // Default 'full' stacked layout matching the uploaded logo
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Logo container with crisp white badge backdrop */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white shadow-xl shadow-slate-950/10 border border-slate-200/90 flex items-center justify-center mb-3">
        <div className="flex flex-col items-center">
          {LogoMark}
          <div className="mt-2 text-slate-900 leading-none select-none">
            <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
              Ministry
            </div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-slate-900 mt-0.5">
              of
            </div>
            <div className="text-xs sm:text-sm font-normal tracking-wide text-slate-600 mt-0.5">
              Health
            </div>
          </div>
        </div>
      </div>

      {showBadge && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950 text-cyan-200 border border-cyan-800/80">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Official Directorate Portal
        </span>
      )}
    </div>
  );
};
