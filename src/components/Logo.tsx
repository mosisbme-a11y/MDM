import React from 'react';
import { EPSSLogo } from './EPSSLogo';
import { MOHLogo } from './MOHLogo';

export interface LogoProps {
  isAdmin?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only' | 'horizontal';
  theme?: 'dark' | 'light' | 'auto';
  showBadge?: boolean;
  preferMoh?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ preferMoh = false, ...props }) => {
  return preferMoh ? <MOHLogo {...props} /> : <EPSSLogo {...props} />;
};
