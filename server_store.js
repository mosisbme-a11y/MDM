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
  'confirmedBatches'
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
  confirmedBatches: 'confirmedBatches'
};

const EMPTY_COUNTS = Object.fromEntries(Object.values(COUNT_KEY).map((k) => [k, 0]));

const DEFAULT_META = () => ({
  version: 0,
  lastUpdated: new Date().toISOString(),
  lastUpdatedBy: 'EPSS System Initializer',
  updateKind: 'Initial Master Repository',
  counts: { ...EMPTY_COUNTS }
});

function requireClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured on the server (missing SUPABASE_SERVICE_ROLE_KEY).');
  }
  return supabaseAdmin;
}

async function readMeta() {
  const client = requireClient();
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
  const { data, error } = await client.from(TABLE).select('dataset,payload');
  if (error) throw new Error(`Supabase read failed: ${error.message}`);

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

  const newMeta = {
    version: (meta.version || 0) + 1,
    lastUpdated: now,
    lastUpdatedBy: updates.updatedBy || meta.lastUpdatedBy || 'Inventory Administrator',
    updateKind: updates.updateKind || 'Master Data Update',
    counts
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
