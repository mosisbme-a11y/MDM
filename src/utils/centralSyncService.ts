import {
  MedicalDeviceItem,
  MultipleStockRecord,
  ReceivingDataRecord,
  DistributionDataRecord,
  MaterialMasterRecord,
  HealthFacilityRecord,
  ProgramMdRecord,
  NoBkdItem,
  ConfirmedUploadBatch,
  CategoryThreshold
} from '../types';
import { supabase } from '../lib/supabase';

export interface CentralMasterDataCounts {
  items: number;
  multipleStock: number;
  receiving: number;
  distribution: number;
  materialMaster: number;
  hfList: number;
  programMd?: number;
  noBkd?: number;
  confirmedBatches?: number;
}

export interface CentralMasterData {
  version: number;
  lastUpdated: string;
  lastUpdatedBy: string;
  updateKind: string;
  serverTime?: string;
  items?: MedicalDeviceItem[];
  multipleStockItems?: MultipleStockRecord[];
  receivingDataRecords?: ReceivingDataRecord[];
  distributionDataRecords?: DistributionDataRecord[];
  materialMasterItems?: MaterialMasterRecord[];
  hfListItems?: HealthFacilityRecord[];
  programMdRecords?: ProgramMdRecord[];
  noBkdItems?: NoBkdItem[];
  confirmedBatches?: ConfirmedUploadBatch[];
  categoryThresholds?: Record<string, CategoryThreshold>;
  counts?: CentralMasterDataCounts;
}

export interface CentralSyncStatus {
  version: number;
  lastUpdated: string;
  lastUpdatedBy: string;
  updateKind: string;
  serverTime: string;
  counts: CentralMasterDataCounts;
}

const LOCAL_STORAGE_LAST_SEEN_VERSION = 'epss_central_sync_seen_version';
const LOCAL_STORAGE_LAST_SYNC_METADATA = 'epss_central_sync_metadata';

let localKnownVersion = 0;
try {
  const savedV = localStorage.getItem(LOCAL_STORAGE_LAST_SEEN_VERSION);
  if (savedV) localKnownVersion = parseInt(savedV, 10) || 0;
} catch {}

/**
 * Returns current locally known version.
 */
export function getLocalKnownVersion(): number {
  return localKnownVersion;
}

/**
 * Sets locally known version.
 */
export function setLocalKnownVersion(v: number): void {
  localKnownVersion = v;
  try {
    localStorage.setItem(LOCAL_STORAGE_LAST_SEEN_VERSION, String(v));
  } catch {}
}

/**
 * Retrieves the cached central sync metadata.
 */
export function getLastSyncMetadata(): CentralSyncStatus | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LAST_SYNC_METADATA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Saves central sync metadata.
 */
export function saveLastSyncMetadata(meta: CentralSyncStatus): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_LAST_SYNC_METADATA, JSON.stringify(meta));
  } catch {}
}

/**
 * Fetches the complete centralized dataset from the server API (stored in Supabase).
 */
export async function fetchCentralMasterData(): Promise<CentralMasterData | null> {
  try {
    const res = await fetch('/api/system-master-data', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });

    if (res.ok) {
      const data: CentralMasterData = await res.json();
      if (data && typeof data.version === 'number') {
        setLocalKnownVersion(data.version);
        if (data.counts) {
          saveLastSyncMetadata({
            version: data.version,
            lastUpdated: data.lastUpdated,
            lastUpdatedBy: data.lastUpdatedBy,
            updateKind: data.updateKind,
            serverTime: data.serverTime || new Date().toISOString(),
            counts: data.counts
          });
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('[CentralSyncService] Could not fetch central data:', err);
  }

  return null;
}

/**
 * Pushes updates to the central server so all other browsers and devices
 * immediately reflect the same dataset.
 */
export async function pushCentralMasterData(
  updates: Partial<CentralMasterData> & {
    updatedBy?: string;
    updateKind?: string;
  }
): Promise<CentralSyncStatus | null> {
  console.log('[CentralSyncService] Pushing updates:', updates);
  let resultStatus: CentralSyncStatus | null = null;

  try {
    const res = await fetch('/api/system-master-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (res.ok) {
      const respData = await res.json();
      console.log('[CentralSyncService] Push successful, response:', respData);
      if (respData && respData.version) {
        setLocalKnownVersion(respData.version);
        resultStatus = {
          version: respData.version,
          lastUpdated: respData.lastUpdated,
          lastUpdatedBy: respData.lastUpdatedBy,
          updateKind: respData.updateKind,
          serverTime: new Date().toISOString(),
          counts: respData.counts
        };
        saveLastSyncMetadata(resultStatus);
      }
    } else {
      console.error('[CentralSyncService] Push failed, res:', res.status, res.statusText);
    }
  } catch (err) {
    console.error('[CentralSyncService] Failed to POST to central server API:', err);
  }

  return resultStatus;
}

/**
 * Checks lightweight sync status from the server.
 */
export async function checkCentralSyncStatus(): Promise<CentralSyncStatus | null> {
  try {
    const res = await fetch('/api/system-master-data/status', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (res.ok) {
      const status: CentralSyncStatus = await res.json();
      return status;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

/**
 * Subscribes to automatic polling across browsers.
 * Triggers callback whenever the server version is newer than the locally known version.
 */
export function subscribeCentralSync(
  onRemoteDataUpdate: (data: CentralMasterData) => void,
  pollIntervalMs = 5000
): () => void {
  let isChecking = false;

  const performCheck = async (source: string) => {
    if (isChecking) return;
    isChecking = true;
    try {
      const status = await checkCentralSyncStatus();
      if (status && status.version > localKnownVersion) {
        console.log(`[CentralSyncService] Remote update detected (${source}): v${status.version} > v${localKnownVersion}`);
        const fullData = await fetchCentralMasterData();
        if (fullData) {
          onRemoteDataUpdate(fullData);
        }
      }
    } catch (err) {
      console.warn('[CentralSyncService] Polling check encountered error:', err);
    } finally {
      isChecking = false;
    }
  };

  // 1. Initial check
  performCheck('mount');

  // 1b. Instant push from Supabase Realtime: the server bumps the '_meta' row after every save
  let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  if (supabase) {
    try {
      realtimeChannel = supabase
        .channel('system-master-data-meta')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_master_data', filter: 'dataset=eq._meta' },
          () => performCheck('realtime')
        )
        .subscribe();
    } catch (err) {
      console.warn('[CentralSyncService] Realtime subscription unavailable, using polling only:', err);
    }
  }

  // 2. Periodic interval
  const intervalId = setInterval(() => performCheck('heartbeat'), pollIntervalMs);

  // 3. Regain focus or visibility
  const handleFocus = () => performCheck('window_focus');
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  return () => {
    if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel);
    clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
  };
}

/**
 * Saves HF Master List records to the dedicated server disk endpoint.
 * Defaults to 'append' mode to never clear or remove existing records.
 */
export async function saveHFMasterListToServer(
  items: HealthFacilityRecord[],
  mode: 'append' | 'replace' = 'append'
): Promise<{ success: boolean; count: number; items: HealthFacilityRecord[] } | null> {
  try {
    const res = await fetch('/api/hf-master-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, mode })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[CentralSyncService] saveHFMasterListToServer error:', err);
  }
  return null;
}

/**
 * Fetches HF Master List records from the dedicated server disk endpoint.
 */
export async function fetchHFMasterListFromServer(): Promise<HealthFacilityRecord[] | null> {
  try {
    const res = await fetch('/api/hf-master-list', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        return data.items;
      }
    }
  } catch (err) {
    console.warn('[CentralSyncService] fetchHFMasterListFromServer error:', err);
  }
  return null;
}
