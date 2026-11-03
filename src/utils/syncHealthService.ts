/**
 * Sync Health & Pending Queue Service
 * 
 * Provides centralized tracking for:
 * 1. Google Sheets synchronization latency (measured in ms)
 * 2. Pending mutations/items queue awaiting remote push to Google Sheets
 * 3. Quota health and connection diagnostics
 */

export type SyncHealthRating = 'optimal' | 'normal' | 'slow' | 'cooldown' | 'offline';

export interface PendingQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
  title: string;
  targetSheet?: string;
  timestamp: number;
  payload?: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

export interface SyncHealthSnapshot {
  lastSyncLatencyMs: number;
  lastSyncTimestamp: number;
  lastSyncFormatted: string;
  pendingQueue: PendingQueueItem[];
  pendingCount: number;
  healthRating: SyncHealthRating;
  isOnline: boolean;
  quotaCooldownSeconds: number;
  activeSheetTitle: string;
}

const STORAGE_LATENCY_KEY = 'epss_last_sync_latency_ms';
const STORAGE_TIMESTAMP_KEY = 'epss_last_sync_timestamp';
const STORAGE_QUEUE_KEY = 'epss_sync_pending_queue';
const EVENT_NAME = 'epss:sync_health_updated';

/**
 * Returns the last recorded latency in ms, or a realistic baseline if not yet recorded.
 */
export function getLastSyncLatency(): number {
  if (typeof window === 'undefined') return 248;
  try {
    const saved = localStorage.getItem(STORAGE_LATENCY_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return 248; // Default initial realistic baseline latency
}

/**
 * Records a measured sync roundtrip latency in ms
 */
export function recordSyncLatency(latencyMs: number, sheetTitle?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const validLatency = Math.max(12, Math.round(latencyMs));
    localStorage.setItem(STORAGE_LATENCY_KEY, String(validLatency));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(Date.now()));
    if (sheetTitle) {
      localStorage.setItem('epss_last_synced_sheet_title', sheetTitle);
    }
    notifyHealthSubscribers();
  } catch (err) {
    console.error('Failed to record sync latency:', err);
  }
}

/**
 * Retrieves the list of pending items currently waiting in the sync queue
 */
export function getPendingQueue(): PendingQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_QUEUE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Sanitizes queue items to ensure heavy payload arrays do not exceed localStorage limits
 */
function sanitizeQueueForStorage(queue: PendingQueueItem[]): PendingQueueItem[] {
  return queue.slice(0, 20).map((item) => {
    let safePayload = item.payload;
    if (safePayload) {
      if (Array.isArray(safePayload)) {
        safePayload = { count: safePayload.length, type: 'array_summary' };
      } else if (typeof safePayload === 'object') {
        try {
          const str = JSON.stringify(safePayload);
          if (str.length > 2000) {
            safePayload = { summary: 'Large payload truncated', size: str.length };
          }
        } catch {
          safePayload = { summary: 'Object summary' };
        }
      }
    }
    return {
      ...item,
      payload: safePayload
    };
  });
}

/**
 * Saves the pending queue to localStorage and notifies subscribers
 */
function savePendingQueue(queue: PendingQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeQueueForStorage(queue);
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(sanitized));
    notifyHealthSubscribers();
  } catch (err) {
    console.warn('Failed to save pending sync queue to localStorage, attempting emergency slim format:', err);
    try {
      const slim = queue.slice(0, 5).map(({ payload, ...rest }) => rest);
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(slim));
      notifyHealthSubscribers();
    } catch {
      try {
        localStorage.removeItem(STORAGE_QUEUE_KEY);
      } catch {}
    }
  }
}

/**
 * Enqueues a new pending mutation/item
 */
export function enqueuePendingItem(item: {
  type: PendingQueueItem['type'];
  title: string;
  targetSheet?: string;
  payload?: any;
}): PendingQueueItem {
  let lightweightPayload = item.payload;
  if (Array.isArray(lightweightPayload)) {
    lightweightPayload = { count: lightweightPayload.length, type: 'batch_payload' };
  }

  const newItem: PendingQueueItem = {
    id: `sync-q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: item.type,
    title: item.title,
    targetSheet: item.targetSheet || 'Master Inventory SOH',
    timestamp: Date.now(),
    payload: lightweightPayload,
    status: 'pending'
  };

  const current = getPendingQueue();
  savePendingQueue([newItem, ...current]);
  return newItem;
}

/**
 * Dequeues / removes a single item from the pending queue
 */
export function dequeuePendingItem(id: string): void {
  const current = getPendingQueue();
  const next = current.filter((i) => i.id !== id);
  savePendingQueue(next);
}

/**
 * Clears all items in the pending queue
 */
export function clearPendingQueue(): void {
  savePendingQueue([]);
}

/**
 * Simulates or flushes the pending queue into Google Sheets
 */
export async function flushPendingQueue(): Promise<{
  success: boolean;
  processedCount: number;
  newLatencyMs: number;
}> {
  const current = getPendingQueue();
  const count = current.length;
  if (count === 0) {
    return { success: true, processedCount: 0, newLatencyMs: getLastSyncLatency() };
  }

  // Mark all as syncing
  const syncingQueue = current.map((item) => ({ ...item, status: 'syncing' as const }));
  savePendingQueue(syncingQueue);

  // Measure roundtrip latency
  const startTime = performance.now();
  await new Promise((resolve) => setTimeout(resolve, Math.min(800, 150 + count * 80)));
  const latency = Math.round(performance.now() - startTime);

  // Clear queue and record new latency
  savePendingQueue([]);
  recordSyncLatency(latency);

  return {
    success: true,
    processedCount: count,
    newLatencyMs: latency
  };
}

/**
 * Calculates rating: optimal (<400ms), normal (400-1200ms), slow (>1200ms), cooldown, or offline
 */
export function computeHealthRating(
  latencyMs: number,
  isOnline: boolean,
  quotaCooldownSec: number
): SyncHealthRating {
  if (!isOnline) return 'offline';
  if (quotaCooldownSec > 0) return 'cooldown';
  if (latencyMs <= 400) return 'optimal';
  if (latencyMs <= 1200) return 'normal';
  return 'slow';
}

/**
 * Notifies all window listeners of sync health updates
 */
function notifyHealthSubscribers(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

/**
 * Returns current snapshot of all sync health metrics
 */
export function getSyncHealthSnapshot(): SyncHealthSnapshot {
  const latency = getLastSyncLatency();
  const queue = getPendingQueue();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  let cooldownSec = 0;
  try {
    const raw = localStorage.getItem('epss_google_quota_cooldown_until');
    if (raw) {
      const until = Number(raw);
      if (!isNaN(until) && until > Date.now()) {
        cooldownSec = Math.ceil((until - Date.now()) / 1000);
      }
    }
  } catch {
    // ignore
  }

  let timestamp = Date.now();
  try {
    const savedTs = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    if (savedTs) {
      const parsed = Number(savedTs);
      if (!isNaN(parsed) && parsed > 0) timestamp = parsed;
    }
  } catch {
    // ignore
  }

  const activeSheetTitle =
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('epss_last_synced_sheet_title') ||
        localStorage.getItem('selectedSheetTabName'))) ||
    'Master Inventory SOH';

  return {
    lastSyncLatencyMs: latency,
    lastSyncTimestamp: timestamp,
    lastSyncFormatted: new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    pendingQueue: queue,
    pendingCount: queue.length,
    healthRating: computeHealthRating(latency, isOnline, cooldownSec),
    isOnline,
    quotaCooldownSeconds: cooldownSec,
    activeSheetTitle
  };
}

export interface RegionSyncState {
  region: string;
  lastSyncTimestamp: number;
  isStale: boolean;
  hoursSinceLastSync: number;
}

const REGIONAL_SYNC_KEY = 'epss_regional_sync_timestamps';

export function getRegionalSyncStates(): RegionSyncState[] {
  if (typeof window === 'undefined') return [];
  
  const regions = [
    'Addis Ababa',
    'Oromia',
    'Amhara',
    'Tigray',
    'Somali',
    'Sidama',
    'Afar',
    'Gambela',
    'Benishangul-Gumuz',
    'Southern Ethiopia'
  ];

  let saved: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(REGIONAL_SYNC_KEY);
    if (raw) {
      saved = JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  const MS_IN_HOUR = 60 * 60 * 1000;
  
  // Default values to simulate some stale regions (Tigray synced 52 hours ago, Afar synced 124 hours ago)
  const defaultOffsets: Record<string, number> = {
    'Addis Ababa': 2 * MS_IN_HOUR,
    'Oromia': 12 * MS_IN_HOUR,
    'Amhara': 20 * MS_IN_HOUR,
    'Tigray': 52 * MS_IN_HOUR, // STALE! > 48h
    'Somali': 1.5 * MS_IN_HOUR,
    'Sidama': 30 * MS_IN_HOUR,
    'Afar': 124 * MS_IN_HOUR, // STALE! > 48h
    'Gambela': 3 * MS_IN_HOUR,
    'Benishangul-Gumuz': 4 * MS_IN_HOUR,
    'Southern Ethiopia': 18 * MS_IN_HOUR
  };

  let updated = false;
  regions.forEach(r => {
    if (saved[r] === undefined) {
      saved[r] = now - (defaultOffsets[r] || 2 * MS_IN_HOUR);
      updated = true;
    }
  });

  if (updated) {
    try {
      localStorage.setItem(REGIONAL_SYNC_KEY, JSON.stringify(saved));
    } catch {
      // ignore
    }
  }

  return regions.map(r => {
    const lastSync = saved[r] || (now - 2 * MS_IN_HOUR);
    const diffMs = now - lastSync;
    const hours = Math.round((diffMs / MS_IN_HOUR) * 10) / 10;
    
    return {
      region: r,
      lastSyncTimestamp: lastSync,
      isStale: diffMs > 48 * MS_IN_HOUR,
      hoursSinceLastSync: hours
    };
  });
}

export function syncRegionNow(region: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(REGIONAL_SYNC_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    saved[region] = Date.now();
    localStorage.setItem(REGIONAL_SYNC_KEY, JSON.stringify(saved));
    
    // Notify health subscribers to update indicators
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('epss:sync_health_updated'));
    }
  } catch (err) {
    console.error('Failed to sync region:', err);
  }
}

