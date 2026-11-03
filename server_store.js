import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('[Server Store] __dirname:', __dirname);

const DATA_DIR = path.join(__dirname, 'server_data');
const STORE_FILE = path.join(DATA_DIR, 'epss_master_store.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Server Store] Failed to create server_data directory:', err);
  }
}

const DEFAULT_STORE = {
  version: 0,
  lastUpdated: new Date().toISOString(),
  lastUpdatedBy: 'EPSS System Initializer',
  updateKind: 'Initial Master Repository',
  items: [],
  multipleStockItems: [],
  receivingDataRecords: [],
  distributionDataRecords: [],
  materialMasterItems: [],
  hfListItems: [],
  noBkdItems: [],
  confirmedBatches: [],
  categoryThresholds: {},
  users: []
};

/**
 * Reads the master store from disk.
 */
export function getMasterData() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        return {
          ...DEFAULT_STORE,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.error('[Server Store] Error reading store file:', err);
  }
  return { ...DEFAULT_STORE };
}

/**
 * Computes record counts summary.
 */
function computeCounts(data) {
  return {
    items: Array.isArray(data.items) ? data.items.length : 0,
    multipleStock: Array.isArray(data.multipleStockItems) ? data.multipleStockItems.length : 0,
    receiving: Array.isArray(data.receivingDataRecords) ? data.receivingDataRecords.length : 0,
    distribution: Array.isArray(data.distributionDataRecords) ? data.distributionDataRecords.length : 0,
    materialMaster: Array.isArray(data.materialMasterItems) ? data.materialMasterItems.length : 0,
    hfList: Array.isArray(data.hfListItems) ? data.hfListItems.length : 0,
    programMd: Array.isArray(data.programMdRecords) ? data.programMdRecords.length : 0,
    noBkd: Array.isArray(data.noBkdItems) ? data.noBkdItems.length : 0,
    confirmedBatches: Array.isArray(data.confirmedBatches) ? data.confirmedBatches.length : 0
  };
}

/**
 * Returns lightweight status for rapid cross-browser polling.
 */
export function getMasterDataStatus() {
  const current = getMasterData();
  return {
    version: current.version || 0,
    lastUpdated: current.lastUpdated || new Date().toISOString(),
    lastUpdatedBy: current.lastUpdatedBy || 'Inventory Administrator',
    updateKind: current.updateKind || 'Master Inventory',
    serverTime: new Date().toISOString(),
    counts: computeCounts(current)
  };
}

/**
 * Saves updates to the centralized store file.
 */
export function saveMasterData(updates) {
  try {
    const current = getMasterData();
    const newVersion = (current.version || 0) + 1;
    const now = new Date().toISOString();

    const isExplicitClear = updates && updates.updateKind && /clear/i.test(updates.updateKind);

    const merged = {
      ...current,
      ...updates,
      version: newVersion,
      lastUpdated: now,
      lastUpdatedBy: updates.updatedBy || current.lastUpdatedBy || 'Inventory Administrator',
      updateKind: updates.updateKind || current.updateKind || 'Master Data Update'
    };

    // If this is NOT an explicit clear command, protect all existing datasets from being overwritten by empty arrays
    if (!isExplicitClear) {
      const arrayFields = [
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

      for (const field of arrayFields) {
        if (
          Array.isArray(current[field]) &&
          current[field].length > 0 &&
          (!updates[field] || (Array.isArray(updates[field]) && updates[field].length === 0))
        ) {
          merged[field] = current[field];
        }
      }
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    console.log('[Server Store] Saving to:', STORE_FILE);
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(merged, null, 2), 'utf-8');
    fs.renameSync(tempFile, STORE_FILE);
    console.log(`[Server Store] Successfully synchronized master data v${newVersion} (${merged.updateKind}) by ${merged.lastUpdatedBy}`);

    return {
      success: true,
      version: newVersion,
      lastUpdated: now,
      lastUpdatedBy: merged.lastUpdatedBy,
      updateKind: merged.updateKind,
      counts: computeCounts(merged)
    };
  } catch (err) {
    console.error('[Server Store] Failed to save master data:', err);
    throw err;
  }
}
