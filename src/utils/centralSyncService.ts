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
  CategoryThreshold,
  DspWorkflowRecord,
  MedicalDeviceAgreement,
  UploadedAgreementBatch
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
  dspWorkflows?: number;
  agreements?: number;
  uploadedAgreementBatches?: number;
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
  dspWorkflowRecords?: DspWorkflowRecord[];
  agreements?: MedicalDeviceAgreement[];
  uploadedAgreementBatches?: UploadedAgreementBatch[];
  categoryThresholds?: Record<string, CategoryThreshold>;
  dspReceivedMohRows?: any[];
  dspReceivedEpssRows?: any[];
  dsp22Columns?: any[];
  dsp22Rows?: any[];
  dspReceivedMohRecord?: any;
  dspReceivedEpssRecord?: any;
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

// ------------------------------------------------------------------------------
// DELTA SYNC
// The dataset is stored on the server as chunks of ~500 records, each with a content hash.
// Downloads/uploads only move the chunks that differ from what this browser already has,
// in parallel, as small requests (also keeps every request under Vercel's 4.5 MB limit).
// ------------------------------------------------------------------------------
const ARRAY_FIELDS = [
  'items',
  'multipleStockItems',
  'receivingDataRecords',
  'distributionDataRecords',
  'materialMasterItems',
  'hfListItems',
  'programMdRecords',
  'noBkdItems',
  'confirmedBatches',
  'dspWorkflowRecords',
  'agreements',
  'uploadedAgreementBatches',
  'dspReceivedMohRows',
  'dspReceivedEpssRows',
  'dsp22Columns',
  'dsp22Rows'
] as const;
type ArrayField = typeof ARRAY_FIELDS[number];

interface ManifestField { keys: string[]; hashes: (string | null)[] }
interface Manifest extends CentralSyncStatus {
  chunkSize: number;
  fields: Record<string, ManifestField>;
}

// What this browser already holds: chunk key -> { hash, payload }
const chunkCache = new Map<string, { hash: string; payload: any[] }>();

/** Fast, non-cryptographic 53-bit string hash (cyrb53) used to compare chunk contents. */
function hashString(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}-${str.length.toString(36)}`;
}

const chunkKeyOf = (field: string, i: number) => `${field}:${String(i).padStart(5, '0')}`;

/** Runs async jobs with a fixed number in flight at once. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** JSON body, gzip-compressed when the browser supports it (spreadsheet rows compress ~10x). */
async function jsonBody(value: unknown): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  const text = JSON.stringify(value);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (text.length > 20_000 && typeof CompressionStream !== 'undefined') {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressed = await new Response(stream).arrayBuffer();
      headers['Content-Encoding'] = 'gzip';
      return { body: compressed, headers };
    }
  } catch {
    // fall through to plain JSON
  }
  return { body: text, headers };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
  if (!res.ok) {
    const err: any = new Error(`${url} -> HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Older servers (deployed before delta sync) answer 404/405 on the new endpoints -> use the original full-dataset API.
let legacyServer = false;
const isMissingEndpoint = (err: any) => err && (err.status === 404 || err.status === 405);

async function legacyFetch(): Promise<CentralMasterData> {
  return getJson<CentralMasterData>('/api/system-master-data');
}

async function fetchManifest(): Promise<Manifest> {
  return getJson<Manifest>('/api/system-master-data/manifest');
}

/**
 * Fetches the complete centralized dataset from the server API (stored in Supabase),
 * downloading only the chunks that changed since this browser last looked.
 */
export async function fetchCentralMasterData(): Promise<CentralMasterData | null> {
  try {
    if (legacyServer) return await finishFetch(await legacyFetch());
    let manifest: Manifest;
    try {
      manifest = await fetchManifest();
    } catch (err) {
      console.warn('[CentralSyncService] Manifest failed, falling back to full dataset API:', err);
      legacyServer = true;
      return await finishFetch(await legacyFetch());
    }
    const result: any = {
      version: manifest.version,
      lastUpdated: manifest.lastUpdated,
      lastUpdatedBy: manifest.lastUpdatedBy,
      updateKind: manifest.updateKind,
      serverTime: manifest.serverTime,
      counts: manifest.counts
    };

    const jobs: { field: string; index: number; key: string; hash: string | null }[] = [];
    const parts: Record<string, any[][]> = {};
    for (const field of ARRAY_FIELDS) {
      const f = manifest.fields?.[field] || { keys: [], hashes: [] };
      parts[field] = new Array(f.keys.length);
      f.keys.forEach((key, index) => {
        const hash = f.hashes[index] ?? null;
        const cached = chunkCache.get(key);
        if (hash && cached && cached.hash === hash) parts[field][index] = cached.payload;
        else jobs.push({ field, index, key, hash });
      });
    }

    await runPool(jobs, 6, async (job) => {
      const { payload } = await getJson<{ payload: any[] }>(`/api/system-master-data/chunk?key=${encodeURIComponent(job.key)}`);
      const rows = Array.isArray(payload) ? payload : [];
      parts[job.field][job.index] = rows;
      if (job.hash) chunkCache.set(job.key, { hash: job.hash, payload: rows });
      else chunkCache.delete(job.key);
    });

    for (const field of ARRAY_FIELDS) result[field] = parts[field].flat();
    try {
      const { payload } = await getJson<{ payload: any }>('/api/system-master-data/chunk?key=categoryThresholds');
      result.categoryThresholds = payload && typeof payload === 'object' ? payload : {};
    } catch {
      result.categoryThresholds = {};
    }

    return await finishFetch(result as CentralMasterData);
  } catch (err) {
    console.warn('[CentralSyncService] Could not fetch central data:', err);
  }

  return null;
}

async function finishFetch(data: CentralMasterData): Promise<CentralMasterData> {
  {
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

export type SupabaseSyncState = 'syncing' | 'synced' | 'error';
export interface SupabaseSyncEventDetail {
  state: SupabaseSyncState;
  pending: number;
  kind?: string;
  version?: number;
  message?: string;
}
export const SUPABASE_SYNC_EVENT = 'epss_supabase_sync';

let pendingPushes = 0;
function emitSyncEvent(detail: SupabaseSyncEventDetail): void {
  try {
    window.dispatchEvent(new CustomEvent(SUPABASE_SYNC_EVENT, { detail }));
  } catch {}
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
  let resultStatus: CentralSyncStatus | null = null;
  let errorMessage = '';

  pendingPushes += 1;
  emitSyncEvent({ state: 'syncing', pending: pendingPushes, kind: updates.updateKind });

  try {
    let manifest: Manifest | null = null;
    if (!legacyServer) {
      try {
        manifest = await fetchManifest();
      } catch (err) {
        console.warn('[CentralSyncService] Manifest failed, falling back to full dataset API:', err);
        legacyServer = true;
      }
    }
    if (!manifest) {
      const res = await fetch('/api/system-master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        let msg = `Server returned ${res.status} (${res.url ? new URL(res.url).pathname : 'api'})`;
        try { msg = (await res.json())?.error || msg; } catch {}
        throw new Error(msg);
      }
      const respData = await res.json();
      if (respData && respData.version) {
        setLocalKnownVersion(respData.version);
        resultStatus = {
          version: respData.version, lastUpdated: respData.lastUpdated, lastUpdatedBy: respData.lastUpdatedBy,
          updateKind: respData.updateKind, serverTime: new Date().toISOString(), counts: respData.counts
        };
        saveLastSyncMetadata(resultStatus);
      }
      pendingPushes = Math.max(0, pendingPushes - 1);
      emitSyncEvent(pendingPushes > 0 ? { state: 'syncing', pending: pendingPushes } : { state: 'synced', pending: 0, kind: resultStatus?.updateKind, version: resultStatus?.version });
      return resultStatus;
    }
    const chunkSize = manifest.chunkSize || 500;
    const commitFields: Record<string, { hashes: string[]; total: number }> = {};
    const uploads: { field: string; index: number; key: string; hash: string; payload: any[] }[] = [];

    for (const field of ARRAY_FIELDS) {
      const records = (updates as any)[field];
      if (!Array.isArray(records)) continue;
      const serverHashes = manifest.fields?.[field]?.hashes || [];
      const hashes: string[] = [];
      for (let i = 0, n = 0; i < records.length; i += chunkSize, n++) {
        const payload = records.slice(i, i + chunkSize);
        const hash = hashString(JSON.stringify(payload));
        hashes.push(hash);
        if (serverHashes[n] !== hash) uploads.push({ field, index: n, key: chunkKeyOf(field, n), hash, payload });
      }
      commitFields[field] = { hashes, total: records.length };
    }

    // Upload only the chunks that differ from what the server already has
    await runPool(uploads, 4, async (u) => {
      const { body, headers } = await jsonBody({ field: u.field, index: u.index, payload: u.payload });
      const res = await fetch('/api/system-master-data/chunk', { method: 'PUT', headers, body });
      if (!res.ok) {
        let msg = `Server returned ${res.status} (${res.url ? new URL(res.url).pathname : 'api'})`;
        try { msg = (await res.json())?.error || msg; } catch {}
        throw new Error(msg);
      }
      chunkCache.set(u.key, { hash: u.hash, payload: u.payload });
    });

    // Nothing differs from the server -> nothing to commit (also stops echo loops between browsers)
    const unchanged =
      uploads.length === 0 &&
      updates.categoryThresholds === undefined &&
      Object.entries(commitFields).every(([f, c]) => {
        const sh = manifest.fields?.[f]?.hashes || [];
        return sh.length === c.hashes.length && sh.every((h, i) => h === c.hashes[i]);
      });
    if (unchanged) {
      resultStatus = {
        version: manifest.version, lastUpdated: manifest.lastUpdated, lastUpdatedBy: manifest.lastUpdatedBy,
        updateKind: manifest.updateKind, serverTime: manifest.serverTime, counts: manifest.counts
      };
      pendingPushes = Math.max(0, pendingPushes - 1);
      emitSyncEvent(pendingPushes > 0 ? { state: 'syncing', pending: pendingPushes } : { state: 'synced', pending: 0, kind: manifest.updateKind, version: manifest.version });
      return resultStatus;
    }

    // One tiny request bumps the version; other browsers then pull just the changed chunks
    const res = await fetch('/api/system-master-data/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: commitFields,
        categoryThresholds: updates.categoryThresholds,
        updatedBy: updates.updatedBy,
        updateKind: updates.updateKind
      })
    });

    if (res.ok) {
      const respData = await res.json();
      console.log('[CentralSyncService] Push successful:', { version: respData?.version, chunksUploaded: uploads.length });
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
      console.error('[CentralSyncService] Commit failed, res:', res.status, res.statusText);
      try {
        const body = await res.json();
        errorMessage = body?.error || `Server returned ${res.status} (${res.url ? new URL(res.url).pathname : 'api'})`;
      } catch {
        errorMessage = `Server returned ${res.status} (${res.url ? new URL(res.url).pathname : 'api'})`;
      }
    }
  } catch (err: any) {
    console.error('[CentralSyncService] Failed to sync with central server API:', err);
    errorMessage = err?.message || 'Network error';
  }

  pendingPushes = Math.max(0, pendingPushes - 1);
  if (resultStatus) {
    // Only announce "synced" once every outstanding upload has finished
    emitSyncEvent(
      pendingPushes > 0
        ? { state: 'syncing', pending: pendingPushes }
        : { state: 'synced', pending: 0, kind: resultStatus.updateKind, version: resultStatus.version }
    );
  } else {
    emitSyncEvent({ state: 'error', pending: pendingPushes, message: errorMessage || 'Sync failed' });
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

  // 1b. Instant push from Supabase Realtime across all inventory, stock, and master data tables
  let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  if (supabase) {
    try {
      realtimeChannel = supabase
        .channel('system-master-data-realtime-all')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_master_data' },
          (payload) => {
            console.log('[CentralSyncService] Supabase Realtime update received:', payload.eventType);
            performCheck('realtime-inventory-stock');
          }
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
