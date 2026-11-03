import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from './server_supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Legacy disk store (pre-Supabase). Only read once, to import old data.
const LEGACY_STORE_FILE = path.join(__dirname, 'server_data', 'epss_master_store.json');

const TABLE = 'system_master_data';
const META_KEY = '_meta';
// Large datasets (e.g. 7,500+ health facilities) are split into chunks of this many records,
// one database row each, so no single request/row is too big or times out.
const CHUNK_SIZE = 500;
const chunkKey = (field, i) => `${field}:${String(i).padStart(5, '0')}`;

// Array datasets stored one row each in public.system_master_data
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
  'uploadedAgreementBatches'
];
// Object dataset
const OBJECT_FIELDS = ['categoryThresholds'];

const COUNT_KEY = {
  items: 'items',
  multipleStockItems: 'multipleStock',
  receivingDataRecords: 'receiving',
  distributionDataRecords: 'distribution',
  materialMasterItems: 'materialMaster',
  hfListItems: 'hfList',
  programMdRecords: 'programMd',
  noBkdItems: 'noBkd',
  confirmedBatches: 'confirmedBatches',
  dspWorkflowRecords: 'dspWorkflows',
  agreements: 'agreements',
  uploadedAgreementBatches: 'uploadedAgreementBatches'
};

const EMPTY_COUNTS = Object.fromEntries(Object.values(COUNT_KEY).map((k) => [k, 0]));

const DEFAULT_META = () => ({
  version: 0,
  lastUpdated: new Date().toISOString(),
  lastUpdatedBy: 'EPSS System Initializer',
  updateKind: 'Initial Master Repository',
  counts: { ...EMPTY_COUNTS }
});

function readLocalStore() {
  try {
    if (fs.existsSync(LEGACY_STORE_FILE)) {
      const raw = fs.readFileSync(LEGACY_STORE_FILE, 'utf-8');
      if (raw && raw.trim()) return JSON.parse(raw);
    }
  } catch {}
  const def = DEFAULT_META();
  for (const f of ARRAY_FIELDS) def[f] = [];
  def.categoryThresholds = {};
  def.uploaded_files_registry = [];
  def.master_data_logs = [];
  return def;
}

function writeLocalStore(storeData) {
  try {
    const dir = path.dirname(LEGACY_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEGACY_STORE_FILE, JSON.stringify(storeData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local store:', err);
  }
}

function requireClient() {
  return supabaseAdmin;
}

async function readMeta() {
  const client = requireClient();
  if (!client) {
    const local = readLocalStore();
    return { ...DEFAULT_META(), ...local, counts: { ...EMPTY_COUNTS, ...(local.counts || {}) } };
  }
  const { data, error } = await client.from(TABLE).select('payload').eq('dataset', META_KEY).maybeSingle();
  if (error) throw new Error(`Supabase read (_meta) failed: ${error.message}`);
  if (!data || !data.payload) return DEFAULT_META();
  return { ...DEFAULT_META(), ...data.payload, counts: { ...EMPTY_COUNTS, ...(data.payload.counts || {}) } };
}

/**
 * Returns the complete central dataset (all datasets + meta).
 */
export async function getMasterData() {
  const client = requireClient();
  if (!client) {
    const local = readLocalStore();
    const result = { ...DEFAULT_META(), ...local };
    for (const f of ARRAY_FIELDS) {
      if (!Array.isArray(result[f])) result[f] = [];
    }
    result.categoryThresholds = result.categoryThresholds || {};
    result.counts = { ...EMPTY_COUNTS, ...(result.counts || {}) };
    return result;
  }

  const { data, error } = await client.from(TABLE).select('dataset,payload');
  if (error) {
    console.error(`[DEBUG] Supabase read failed: ${error.message}`);
    throw new Error(`Supabase read failed: ${error.message}`);
  }

  const result = { ...DEFAULT_META() };
  for (const f of ARRAY_FIELDS) result[f] = [];
  result.categoryThresholds = {};

  const chunks = {}; // field -> [{ index, payload }]
  for (const row of data || []) {
    if (row.dataset === META_KEY) {
      Object.assign(result, row.payload || {});
      continue;
    }
    const [field, idx] = String(row.dataset).split(':');
    if (ARRAY_FIELDS.includes(field)) {
      (chunks[field] = chunks[field] || []).push({
        index: idx === undefined ? -1 : parseInt(idx, 10), // -1 = old single-row format
        payload: Array.isArray(row.payload) ? row.payload : []
      });
    } else if (OBJECT_FIELDS.includes(row.dataset)) {
      result[row.dataset] = row.payload && typeof row.payload === 'object' ? row.payload : {};
    }
  }
  for (const field of Object.keys(chunks)) {
    const list = chunks[field];
    // If new-format chunks exist, ignore any old single row
    const hasChunks = list.some((c) => c.index >= 0);
    result[field] = list
      .filter((c) => (hasChunks ? c.index >= 0 : true))
      .sort((x, y) => x.index - y.index)
      .flatMap((c) => c.payload);
  }
  result.counts = { ...EMPTY_COUNTS, ...(result.counts || {}) };
  delete result.chunks;
  return result;
}

/**
 * Lightweight status (version + counts) for cross-browser change detection.
 */
export async function getMasterDataStatus() {
  const meta = await readMeta();
  return {
    version: meta.version || 0,
    lastUpdated: meta.lastUpdated,
    lastUpdatedBy: meta.lastUpdatedBy || 'Inventory Administrator',
    updateKind: meta.updateKind || 'Master Inventory',
    serverTime: new Date().toISOString(),
    counts: meta.counts
  };
}

// Saves are serialised so two simultaneous uploads can not produce the same version number.
let saveQueue = Promise.resolve();

/**
 * Saves updates to Supabase. Only datasets present in `updates` are written.
 * Unless the update is an explicit "clear", an empty array never overwrites existing data.
 */
export function saveMasterData(updates = {}) {
  const run = saveQueue.then(() => doSave(updates));
  saveQueue = run.catch(() => {});
  return run;
}

// Remember what is already stored so repeat saves only send the chunks that changed.
const chunkHashes = new Map();   // chunk key -> content hash
const chunkCounts = new Map();   // field -> number of chunks last written

const hashOf = (value) => createHash('md5').update(JSON.stringify(value)).digest('hex');

async function runLimited(tasks, limit) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task();
    }
  });
  await Promise.all(workers);
}

async function writeChunked(client, field, records, now) {
  const chunkRows = [];
  for (let i = 0, n = 0; i < records.length; i += CHUNK_SIZE, n++) {
    const payload = records.slice(i, i + CHUNK_SIZE);
    chunkRows.push({ dataset: chunkKey(field, n), payload, updated_at: now, _hash: hashOf(payload) });
  }

  // Only upload chunks whose content changed since the last save
  const changed = chunkRows.filter((r) => chunkHashes.get(r.dataset) !== r._hash);
  const tasks = changed.map((row) => async () => {
    const { _hash, ...dbRow } = row;
    const { error } = await client.from(TABLE).upsert(dbRow, { onConflict: 'dataset' });
    if (error) throw new Error(`Supabase write failed (${field}, ${row.dataset}): ${error.message}`);
    chunkHashes.set(row.dataset, _hash);
  });
  await runLimited(tasks, 8); // 8 uploads in parallel

  // Clean up stale rows only when needed (first save after a restart, or the list got shorter)
  const previousCount = chunkCounts.get(field);
  if (previousCount === undefined || previousCount > chunkRows.length) {
    const keep = new Set(chunkRows.map((r) => r.dataset));
    const { data: chunkList, error: listError } = await client
      .from(TABLE)
      .select('dataset')
      .like('dataset', `${field}:%`);
    if (listError) throw new Error(`Supabase cleanup failed (${field}): ${listError.message}`);
    const stale = (chunkList || []).map((r) => r.dataset).filter((k) => !keep.has(k));
    stale.push(field); // old single-row format (deleting a missing row is harmless)
    const { error: delError } = await client.from(TABLE).delete().in('dataset', stale);
    if (delError) throw new Error(`Supabase cleanup failed (${field}): ${delError.message}`);
    stale.forEach((k) => chunkHashes.delete(k));
  }
  chunkCounts.set(field, chunkRows.length);
}

async function doSave(updates) {
  const client = requireClient();
  if (!client) {
    const store = readLocalStore();
    const now = new Date().toISOString();
    const isExplicitClear = Boolean(updates.updateKind && /clear/i.test(updates.updateKind));
    const counts = { ...store.counts };

    for (const field of ARRAY_FIELDS) {
      const incoming = updates[field];
      if (!Array.isArray(incoming)) continue;
      if (incoming.length === 0 && !isExplicitClear) continue;
      store[field] = incoming;
      counts[COUNT_KEY[field]] = incoming.length;
    }
    for (const field of OBJECT_FIELDS) {
      const incoming = updates[field];
      if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        store[field] = incoming;
      }
    }
    store.version = (store.version || 0) + 1;
    store.lastUpdated = now;
    store.lastUpdatedBy = updates.updatedBy || store.lastUpdatedBy || 'Inventory Administrator';
    store.updateKind = updates.updateKind || 'Master Data Update';
    store.counts = counts;
    writeLocalStore(store);
    return {
      success: true,
      version: store.version,
      lastUpdated: store.lastUpdated,
      lastUpdatedBy: store.lastUpdatedBy,
      updateKind: store.updateKind,
      counts
    };
  }

  const meta = await readMeta();
  const now = new Date().toISOString();
  const isExplicitClear = Boolean(updates.updateKind && /clear/i.test(updates.updateKind));

  const rows = [];
  const arrayWrites = [];
  const counts = { ...meta.counts };

  for (const field of ARRAY_FIELDS) {
    const incoming = updates[field];
    if (!Array.isArray(incoming)) continue;
    if (incoming.length === 0 && !isExplicitClear) continue; // protect existing data
    arrayWrites.push({ field, incoming });
    counts[COUNT_KEY[field]] = incoming.length;
  }
  for (const field of OBJECT_FIELDS) {
    const incoming = updates[field];
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      rows.push({ dataset: field, payload: incoming, updated_at: now });
    }
  }

  if (rows.length) {
    const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'dataset' });
    if (error) throw new Error(`Supabase write failed: ${error.message}`);
  }

  for (const { field, incoming } of arrayWrites) {
    await writeChunked(client, field, incoming, now);
  }

  const chunks = { ...(meta.chunks || {}) };
  for (const { field } of arrayWrites) delete chunks[field]; // hashes unknown after a full save -> clients re-download that dataset
  const newMeta = {
    version: (meta.version || 0) + 1,
    lastUpdated: now,
    lastUpdatedBy: updates.updatedBy || meta.lastUpdatedBy || 'Inventory Administrator',
    updateKind: updates.updateKind || 'Master Data Update',
    counts,
    chunks
  };
  // Meta row is written LAST: browsers react to it via Realtime, so by the time
  // they hear about the new version the datasets are already in place.
  const { error: metaError } = await client
    .from(TABLE)
    .upsert({ dataset: META_KEY, payload: newMeta, updated_at: now }, { onConflict: 'dataset' });
  if (metaError) throw new Error(`Supabase write (_meta) failed: ${metaError.message}`);

  console.log(`[Supabase Store] master data v${newMeta.version} (${newMeta.updateKind}) by ${newMeta.lastUpdatedBy}`);
  return {
    success: true,
    version: newMeta.version,
    lastUpdated: newMeta.lastUpdated,
    lastUpdatedBy: newMeta.lastUpdatedBy,
    updateKind: newMeta.updateKind,
    counts
  };
}

/**
 * One-time import: if Supabase has no data yet but an old server_data/epss_master_store.json
 * exists, copy it into Supabase so nothing is lost when switching over.
 */
export async function importLegacyDiskStoreIfNeeded() {
  try {
    if (!supabaseAdmin || !fs.existsSync(LEGACY_STORE_FILE)) return;
    const meta = await readMeta();
    if (meta.version > 0) return; // Supabase already has data
    const raw = fs.readFileSync(LEGACY_STORE_FILE, 'utf-8');
    if (!raw || !raw.trim()) return;
    const legacy = JSON.parse(raw);
    const { users, version, lastUpdated, ...datasets } = legacy; // never import legacy plaintext users
    await saveMasterData({
      ...datasets,
      updatedBy: legacy.lastUpdatedBy || 'Legacy import',
      updateKind: 'Imported from previous server disk store'
    });
    console.log('[Supabase Store] Imported legacy disk store into Supabase.');
  } catch (err) {
    console.warn('[Supabase Store] Legacy import skipped:', err.message);
  }
}


// ==============================================================================
// DELTA SYNC (stateless - safe on serverless hosts such as Vercel)
//
// Instead of moving the whole dataset on every change, the browser:
//   1. GETs the manifest (version + hash of every stored chunk),
//   2. uploads / downloads ONLY the chunks whose hash differs,
//   3. POSTs a small "commit" that bumps the version.
// Every request body/response stays well below Vercel's 4.5 MB limit.
// ==============================================================================
export const CHUNK_SIZE_PUBLIC = CHUNK_SIZE;
export const ARRAY_FIELD_NAMES = ARRAY_FIELDS;

const MAX_CHUNK_RECORDS = 2000;

/** Version + per-chunk hashes for every array dataset. */
export async function getManifest() {
  const client = requireClient();
  const meta = await readMeta();
  const fields = {};
  const missing = [];
  for (const f of ARRAY_FIELDS) {
    const m = meta.chunks && meta.chunks[f];
    if (m && Array.isArray(m.hashes)) {
      fields[f] = { keys: m.hashes.map((_, i) => chunkKey(f, i)), hashes: m.hashes };
    } else {
      missing.push(f);
    }
  }
  if (missing.length) {
    // Datasets written before delta sync existed (or by the full-save endpoint): list their rows, hashes unknown.
    const { data, error } = await client.from(TABLE).select('dataset');
    if (error) throw new Error(`Supabase manifest read failed: ${error.message}`);
    const keys = (data || []).map((r) => String(r.dataset));
    for (const f of missing) {
      const indexed = keys.filter((k) => k.startsWith(`${f}:`)).sort();
      const list = indexed.length ? indexed : keys.includes(f) ? [f] : [];
      fields[f] = { keys: list, hashes: list.map(() => null) };
    }
  }
  return {
    version: meta.version || 0,
    lastUpdated: meta.lastUpdated,
    lastUpdatedBy: meta.lastUpdatedBy || 'Inventory Administrator',
    updateKind: meta.updateKind || 'Master Inventory',
    serverTime: new Date().toISOString(),
    counts: meta.counts,
    chunkSize: CHUNK_SIZE,
    fields
  };
}

function assertDatasetKey(key) {
  const k = String(key || '');
  if (OBJECT_FIELDS.includes(k)) return k;
  const [field, idx, ...rest] = k.split(':');
  if (!ARRAY_FIELDS.includes(field) || rest.length) throw badRequest('Unknown dataset key');
  if (idx !== undefined && !/^\d{1,6}$/.test(idx)) throw badRequest('Bad chunk index');
  return k;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Reads one chunk (or categoryThresholds) by its dataset key. */
export async function getDatasetRow(key) {
  const client = requireClient();
  const k = assertDatasetKey(key);
  const { data, error } = await client.from(TABLE).select('payload').eq('dataset', k).maybeSingle();
  if (error) throw new Error(`Supabase read (${k}) failed: ${error.message}`);
  return data ? data.payload : OBJECT_FIELDS.includes(k) ? {} : [];
}

/** Writes one chunk. The version is NOT bumped until commitMasterData() is called. */
export async function putChunk(field, index, payload) {
  const client = requireClient();
  if (!ARRAY_FIELDS.includes(field)) throw badRequest('Unknown dataset');
  if (!Number.isInteger(index) || index < 0 || index > 100000) throw badRequest('Bad chunk index');
  if (!Array.isArray(payload) || payload.length > MAX_CHUNK_RECORDS) throw badRequest('Chunk must be an array');
  const { error } = await client
    .from(TABLE)
    .upsert({ dataset: chunkKey(field, index), payload, updated_at: new Date().toISOString() }, { onConflict: 'dataset' });
  if (error) throw new Error(`Supabase write failed (${field}:${index}): ${error.message}`);
}

/**
 * Finalises a delta upload: records the new chunk hashes, removes stale chunks,
 * bumps the version once. Retries on a version race so concurrent users never lose each other's changes.
 */
export async function commitMasterData({ fields = {}, categoryThresholds, updatedBy, updateKind }) {
  const client = requireClient();
  const isExplicitClear = Boolean(updateKind && /clear/i.test(updateKind));
  const now = new Date().toISOString();

  const accepted = {};
  for (const [field, info] of Object.entries(fields)) {
    if (!ARRAY_FIELDS.includes(field)) throw badRequest(`Unknown dataset: ${field}`);
    const hashes = info && info.hashes;
    const total = info && Number(info.total);
    if (!Array.isArray(hashes) || hashes.length > 100000 || !hashes.every((h) => typeof h === 'string')) {
      throw badRequest(`Bad hashes for ${field}`);
    }
    if (!Number.isFinite(total) || total < 0) throw badRequest(`Bad total for ${field}`);
    if (total === 0 && !isExplicitClear) continue; // protect existing data from accidental empty saves
    accepted[field] = { hashes, total };
  }

  if (categoryThresholds && typeof categoryThresholds === 'object' && !Array.isArray(categoryThresholds)) {
    const { error } = await client
      .from(TABLE)
      .upsert({ dataset: 'categoryThresholds', payload: categoryThresholds, updated_at: now }, { onConflict: 'dataset' });
    if (error) throw new Error(`Supabase write failed: ${error.message}`);
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const meta = await readMeta();
    const counts = { ...meta.counts };
    const chunks = { ...(meta.chunks || {}) };

    // Remove chunks beyond the new length (only when the dataset could have shrunk / was never tracked)
    for (const [field, info] of Object.entries(accepted)) {
      const prev = chunks[field];
      if (!prev || prev.hashes.length > info.hashes.length) {
        const { data: list, error: listError } = await client.from(TABLE).select('dataset').like('dataset', `${field}:%`);
        if (listError) throw new Error(`Supabase cleanup failed (${field}): ${listError.message}`);
        const keep = new Set(info.hashes.map((_, i) => chunkKey(field, i)));
        const stale = (list || []).map((r) => r.dataset).filter((k) => !keep.has(k));
        stale.push(field); // old single-row format
        const { error: delError } = await client.from(TABLE).delete().in('dataset', stale);
        if (delError) throw new Error(`Supabase cleanup failed (${field}): ${delError.message}`);
      }
      chunks[field] = { hashes: info.hashes };
      counts[COUNT_KEY[field]] = info.total;
    }

    const newMeta = {
      version: (meta.version || 0) + 1,
      lastUpdated: now,
      lastUpdatedBy: updatedBy || meta.lastUpdatedBy || 'Inventory Administrator',
      updateKind: updateKind || 'Master Data Update',
      counts,
      chunks
    };

    // Compare-and-set on the version so two simultaneous commits can not both claim the same number.
    const { data: updated, error: updError } = await client
      .from(TABLE)
      .update({ payload: newMeta, updated_at: now })
      .eq('dataset', META_KEY)
      .eq('payload->>version', String(meta.version || 0))
      .select('dataset');
    if (updError) throw new Error(`Supabase write (_meta) failed: ${updError.message}`);
    let won = Boolean(updated && updated.length);
    if (!won) {
      // Either the row does not exist yet (first ever save) or another commit won the race.
      const { error: insError } = await client.from(TABLE).insert({ dataset: META_KEY, payload: newMeta, updated_at: now });
      won = !insError;
    }
    if (won) {
      console.log(`[Supabase Store] delta commit v${newMeta.version} (${newMeta.updateKind}) by ${newMeta.lastUpdatedBy}`);
      return {
        success: true,
        version: newMeta.version,
        lastUpdated: newMeta.lastUpdated,
        lastUpdatedBy: newMeta.lastUpdatedBy,
        updateKind: newMeta.updateKind,
        counts
      };
    }
  }
  throw new Error('Could not save: too many people saving at once. Please try again.');
}

// ------------------------------------------------------------------------------
// Uploaded-file registry (the files themselves live in Supabase Storage)
// ------------------------------------------------------------------------------
const REGISTRY_KEY = 'uploaded_files_registry';

export async function getUploadRegistry() {
  const client = requireClient();
  if (!client) {
    const store = readLocalStore();
    return Array.isArray(store.uploaded_files_registry) ? store.uploaded_files_registry : [];
  }
  const { data, error } = await client.from(TABLE).select('payload').eq('dataset', REGISTRY_KEY).maybeSingle();
  if (error) throw new Error(`Supabase read (registry) failed: ${error.message}`);
  return data && Array.isArray(data.payload) ? data.payload : [];
}

export async function addUploadRecord(record) {
  const client = requireClient();
  if (!client) {
    const store = readLocalStore();
    store.uploaded_files_registry = Array.isArray(store.uploaded_files_registry) ? store.uploaded_files_registry : [];
    store.uploaded_files_registry.unshift(record);
    writeLocalStore(store);
    return record;
  }
  const registry = await getUploadRegistry();
  registry.unshift(record);
  const { error } = await client
    .from(TABLE)
    .upsert({ dataset: REGISTRY_KEY, payload: registry, updated_at: new Date().toISOString() }, { onConflict: 'dataset' });
  if (error) throw new Error(`Supabase write (registry) failed: ${error.message}`);
  return record;
}

// ------------------------------------------------------------------------------
// Master-data upload/audit log (shared, newest first, capped)
// ------------------------------------------------------------------------------
const LOGS_KEY = 'master_data_logs';
const MAX_LOGS = 200;

export async function getMasterDataLogs() {
  const client = requireClient();
  if (!client) {
    const store = readLocalStore();
    return Array.isArray(store.master_data_logs) ? store.master_data_logs : [];
  }
  const { data, error } = await client.from(TABLE).select('payload').eq('dataset', LOGS_KEY).maybeSingle();
  if (error) throw new Error(`Supabase read (logs) failed: ${error.message}`);
  return data && Array.isArray(data.payload) ? data.payload : [];
}

export async function addMasterDataLog(log) {
  const client = requireClient();
  if (!client) {
    const store = readLocalStore();
    store.master_data_logs = Array.isArray(store.master_data_logs) ? store.master_data_logs : [];
    store.master_data_logs.unshift(log);
    if (store.master_data_logs.length > MAX_LOGS) store.master_data_logs = store.master_data_logs.slice(0, MAX_LOGS);
    writeLocalStore(store);
    return log;
  }
  const logs = await getMasterDataLogs();
  logs.unshift(log);
  const { error } = await client
    .from(TABLE)
    .upsert({ dataset: LOGS_KEY, payload: logs.slice(0, MAX_LOGS), updated_at: new Date().toISOString() }, { onConflict: 'dataset' });
  if (error) throw new Error(`Supabase write (logs) failed: ${error.message}`);
  return log;
}
