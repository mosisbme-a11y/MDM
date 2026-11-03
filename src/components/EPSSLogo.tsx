import React from 'react';

export interface EPSSLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only' | 'horizontal';
  theme?: 'dark' | 'light' | 'auto';
  showBadge?: boolean;
}

export const EPSSLogo: React.FC<EPSSLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  theme = 'auto',
  showBadge = false,
}) => {
  // Dimension mappings tuned for the EPSS logo aspect ratio (287 x 213)
  const dimensions = {
    sm: { w: 36, h: 27 },
    md: { w: 56, h: 42 },
    lg: { w: 150, h: 111 },
    xl: { w: 210, h: 156 }
  }[size];

  const logoSrc = '/public/assets/aistudio/image_e2e3b934.png';
  const fallbackSrc = '/assets/aistudio/image_e2e3b934.png';

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    if (target.src.includes('/public/assets/')) {
      target.src = fallbackSrc;
    }
  };

  if (variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center justify-center overflow-hidden ${className}`}>
        <img
          src={logoSrc}
          alt="EPSS Logo"
          onError={handleImageError}
          style={{ width: dimensions.w, height: 'auto', maxHeight: dimensions.h * 1.25 }}
          className="shrink-0 object-contain"
        />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div className="p-1 rounded-xl bg-white shadow-xs border border-slate-100/90 flex items-center justify-center shrink-0">
          <img
            src={logoSrc}
            alt="EPSS Logo"
            onError={handleImageError}
            style={{ width: dimensions.w, height: 'auto', maxHeight: dimensions.h * 1.1 }}
            className="shrink-0 object-contain"
          />
        </div>
      </div>
    );
  }

  // Default 'full' presentation (used in LoginView, official branding headers, etc.)
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Clean badge card showcasing authentic EPSS emblem and branding */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white shadow-xl shadow-slate-950/10 border border-slate-200/90 flex items-center justify-center mb-3">
        <img
          src={logoSrc}
          alt="Ethiopian Pharmaceutical Supply Service (EPSS) Logo"
          onError={handleImageError}
          style={{ width: dimensions.w, height: 'auto' }}
          className="shrink-0 object-contain"
        />
      </div>

      {showBadge && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-950 text-blue-200 border border-blue-800/80 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Official EPSS Portal
        </span>
      )}
    </div>
  );
};
