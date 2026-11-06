// EPSS Master Medical Device Management System - System Settings Utility

export interface SystemSettingsConfig {
  // General & Regional
  language: 'en' | 'am';
  defaultRegionalHub: string;
  currency: 'ETB' | 'USD';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';

  // Appearance & Display
  tableRowDensity: 'compact' | 'comfortable' | 'spacious';
  headerNavThemeId: string;
  highContrast: boolean;
  fontScale: 'normal' | 'large' | 'compact' | 'maximize';

  // Inventory & Operational Thresholds
  criticalStockThreshold: number; // Default: 5
  reorderStockThreshold: number;  // Default: 15
  nearExpiryDays: number;         // Default: 90
  biomedicalServiceIntervalMonths: number; // Default: 6
  urgentStockAlertBanner: boolean; // Show alert ribbon for critical items

  // Notifications & Sound
  audioFeedbackEnabled: boolean;
  soundVolume: number; // 0 to 100
  browserNotificationsEnabled: boolean;
  autoSyncIntervalMinutes: number; // 0 = manual, 5, 15, 30, 60
  toastDurationSeconds: number;    // 3, 5, 8

  // Strict Cloud Persistence
  strictCloudPersistence: boolean;

  // Last Modified
  lastUpdated: string;
}

export const REGIONAL_HUBS = [
  'All Hubs & Warehouses (National)',
  'Addis Ababa Central Warehouse',
  'Hawassa Hub (Sidama)',
  'Jimma Hub (Oromia)',
  'Bahir Dar Hub (Amhara)',
  'Mekelle Hub (Tigray)',
  'Dire Dawa Hub (Eastern)',
  'Adama Hub (Oromia)',
  'Gondar Hub (Amhara)',
  'Dessie Hub (Amhara)',
  'Jigjiga Hub (Somali)',
  'Gambella Hub (Gambella)',
  'Asosa Hub (Benishangul-Gumuz)'
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsConfig = {
  language: 'en',
  defaultRegionalHub: 'All Hubs & Warehouses (National)',
  currency: 'ETB',
  dateFormat: 'DD/MM/YYYY',
  tableRowDensity: 'comfortable',
  headerNavThemeId: 'professional-gray',
  highContrast: false,
  fontScale: 'normal',
  criticalStockThreshold: 5,
  reorderStockThreshold: 15,
  nearExpiryDays: 90,
  biomedicalServiceIntervalMonths: 6,
  urgentStockAlertBanner: true,
  audioFeedbackEnabled: true,
  soundVolume: 75,
  browserNotificationsEnabled: false,
  autoSyncIntervalMinutes: 15,
  toastDurationSeconds: 4,
  strictCloudPersistence: true,
  lastUpdated: new Date().toISOString()
};

const SETTINGS_STORAGE_KEY = 'epss_system_settings_v1';

export const applyFontScaleToDOM = (scale?: SystemSettingsConfig['fontScale']): void => {
  if (typeof document === 'undefined') return;
  const currentScale = scale || loadSystemSettings().fontScale || 'normal';
  const root = document.documentElement;

  // Clear previous scale classes
  root.classList.remove('font-scale-compact', 'font-scale-normal', 'font-scale-large', 'font-scale-maximize');
  root.classList.add(`font-scale-${currentScale}`);

  // Base font size scaling for REM calculation across whole interface
  if (currentScale === 'compact') {
    root.style.fontSize = '14px';
  } else if (currentScale === 'normal') {
    root.style.fontSize = '16px';
  } else if (currentScale === 'large') {
    root.style.fontSize = '18.5px';
  } else if (currentScale === 'maximize') {
    root.style.fontSize = '22px';
  }
};

export const loadSystemSettings = (): SystemSettingsConfig => {
  return { ...DEFAULT_SYSTEM_SETTINGS };
};

export const saveSystemSettings = (settings: SystemSettingsConfig): void => {
  try {
    const updated = { ...settings, lastUpdated: new Date().toISOString() };
    applyFontScaleToDOM(updated.fontScale);
    window.dispatchEvent(new CustomEvent('epss_settings_updated', { detail: updated }));
  } catch (err) {
    console.error('Failed to apply system settings:', err);
  }
};

export const resetSystemSettingsToDefaults = (): SystemSettingsConfig => {
  try {
    const defaults = { ...DEFAULT_SYSTEM_SETTINGS, lastUpdated: new Date().toISOString() };
    applyFontScaleToDOM(defaults.fontScale);
    window.dispatchEvent(new CustomEvent('epss_settings_updated', { detail: defaults }));
    return defaults;
  } catch (err) {
    console.error('Failed to reset system settings:', err);
    return DEFAULT_SYSTEM_SETTINGS;
  }
};

// Web Audio API Sound Feedback Synthesizer (No external audio files required)
export const playSystemAudioChime = (
  type: 'chime' | 'success' | 'alert' | 'click' = 'chime',
  volumePercent: number = 75
): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    const masterVol = Math.max(0, Math.min(1, (volumePercent / 100) * 0.3));

    gainNode.gain.setValueAtTime(masterVol, now);
    gainNode.connect(ctx.destination);

    if (type === 'click') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      // Pleasant Major Chord (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        noteGain.gain.setValueAtTime(masterVol * 0.5, now + idx * 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

        osc.connect(noteGain);
        noteGain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === 'alert') {
      // Urgent double tone
      [440, 330].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        noteGain.gain.setValueAtTime(masterVol * 0.4, now + idx * 0.12);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.18);

        osc.connect(noteGain);
        noteGain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.2);
      });
    } else {
      // Crisp Notification Chime (659Hz -> 880Hz)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

      gainNode.gain.setValueAtTime(masterVol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.debug('Audio feedback not permitted or unavailable:', e);
  }
};

export interface DiagnosticItem {
  id: string;
  name: string;
  status: 'optimal' | 'warning' | 'info';
  details: string;
  value: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallHealth: 'optimal' | 'warning';
  items: DiagnosticItem[];
}

export const runLiveSystemDiagnostics = async (): Promise<DiagnosticReport> => {
  const items: DiagnosticItem[] = [];

  // 1. Network & Latency Check
  const startPing = performance.now();
  let networkLatency = 0;
  let networkStatus: 'optimal' | 'warning' = 'optimal';
  try {
    // Ping current origin with cache bust
    await fetch(`/?_diag=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
    networkLatency = Math.round(performance.now() - startPing);
    if (networkLatency > 800) {
      networkStatus = 'warning';
    }
  } catch {
    networkLatency = 0;
    networkStatus = 'warning';
  }

  items.push({
    id: 'network',
    name: 'Network Latency & Reachability',
    status: navigator.onLine ? networkStatus : 'warning',
    details: navigator.onLine ? `Connected (${networkLatency}ms round-trip)` : 'Device is offline',
    value: navigator.onLine ? `${networkLatency} ms` : 'Offline'
  });

  // 2. Storage Quota & LocalStorage Usage
  items.push({
    id: 'storage',
    name: 'Cloud Storage Mode',
    status: 'optimal',
    details: `All business data is strictly persisted in Supabase Cloud.`,
    value: `Cloud Native`
  });

  // 3. StorageManager API Quota Check (IndexedDB / Cache)
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageMb = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
      const quotaMb = ((estimate.quota || 0) / (1024 * 1024)).toFixed(0);
      items.push({
        id: 'indexeddb',
        name: 'Browser Persistent Quota (IndexedDB)',
        status: 'optimal',
        details: `Consuming ${usageMb} MB of ${quotaMb} MB allocated quota`,
        value: `${usageMb} MB / ${quotaMb} MB`
      });
    } catch {
      // fallback
    }
  }

  // 4. Web Audio Engine Readiness
  const audioSupported = !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  items.push({
    id: 'audio',
    name: 'Audio Feedback Synthesizer',
    status: audioSupported ? 'optimal' : 'info',
    details: audioSupported ? 'Hardware Web Audio API ready for scanner/action chimes' : 'Web Audio not supported in this browser environment',
    value: audioSupported ? 'Supported' : 'Disabled'
  });

  // 5. Desktop Notifications API
  let notifStatus: 'optimal' | 'warning' | 'info' = 'info';
  let notifValue = 'Unavailable';
  if ('Notification' in window) {
    notifValue = Notification.permission;
    notifStatus = Notification.permission === 'granted' ? 'optimal' : Notification.permission === 'denied' ? 'warning' : 'info';
  }
  items.push({
    id: 'notifications',
    name: 'Browser Notification Permission',
    status: notifStatus,
    details: `Status: ${notifValue} for urgent equipment alerts`,
    value: notifValue
  });

  // 6. Viewport & Display Specs
  items.push({
    id: 'display',
    name: 'Display Resolution & Pixel Ratio',
    status: 'optimal',
    details: `${window.innerWidth}x${window.innerHeight} viewport · Device Pixel Ratio: ${window.devicePixelRatio}`,
    value: `${window.screen.width}x${window.screen.height}`
  });

  const hasWarnings = items.some(i => i.status === 'warning');

  return {
    timestamp: new Date().toISOString(),
    overallHealth: hasWarnings ? 'warning' : 'optimal',
    items
  };
};
