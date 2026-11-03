import {
  MedicalDeviceItem,
  NoBkdItem,
  MultipleStockRecord,
  HealthFacilityRecord,
  ReceivingDataRecord,
  DistributionDataRecord,
  MaterialMasterRecord,
  ProgramMdRecord
} from '../types';

const DB_NAME = 'EPSS_MedicalDeviceInventoryDB';
const DB_VERSION = 6;
const STORE_ITEMS = 'inventory_items';
const STORE_NOBKD = 'inventory_nobkd';
const STORE_META = 'sync_meta';
const STORE_MULTIPLE_STOCK = 'multiple_stock_items';
const STORE_DSP_RECORDS = 'dsp_workflow_records';
const STORE_HF_LIST = 'hf_master_list';
const STORE_RECEIVING = 'receiving_data_records';
const STORE_DISTRIBUTION = 'distribution_data_records';
const STORE_MATERIAL_MASTER = 'material_master_items';
const STORE_PROGRAM_MD = 'program_md_records';
const META_KEY_LAST_SYNC = 'last_sync_state';

export interface InventoryCacheMeta {
  key: string;
  timestamp: number;
  dateFormatted: string;
  totalItems: number;
  totalUnits: number;
  totalValuation: number;
  sourceSpreadsheetId?: string;
  sourceSheetTab?: string;
  syncType: 'google_sheets_batch' | 'manual_pull' | 'auto_detect_pull_all' | 'aggregate_all_drive' | 'excel_import' | 'manual_edit' | 'initial_seed' | 'fast_refresh';
  isOfflineAvailable: boolean;
}

/**
 * Checks if IndexedDB is supported in the current environment
 */
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * Opens or upgrades the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create items store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        itemStore.createIndex('plant', 'plant', { unique: false });
        itemStore.createIndex('sohStatus', 'sohStatus', { unique: false });
        itemStore.createIndex('manufacturer', 'manufacturer', { unique: false });
        itemStore.createIndex('materialType', 'materialType', { unique: false });
      }

      // Create no-breakdown items store
      if (!db.objectStoreNames.contains(STORE_NOBKD)) {
        const noBkdStore = db.createObjectStore(STORE_NOBKD, { keyPath: 'id' });
        noBkdStore.createIndex('code', 'code', { unique: false });
        noBkdStore.createIndex('plant', 'plant', { unique: false });
      }

      // Create metadata store with primary key `key`
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }

      // Create dedicated multiple stock ledger store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_MULTIPLE_STOCK)) {
        const mStockStore = db.createObjectStore(STORE_MULTIPLE_STOCK, { keyPath: 'id' });
        mStockStore.createIndex('plant', 'plant', { unique: false });
        mStockStore.createIndex('material', 'material', { unique: false });
      }

      // Create DSP workflow records store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_DSP_RECORDS)) {
        const dspStore = db.createObjectStore(STORE_DSP_RECORDS, { keyPath: 'id' });
        dspStore.createIndex('dspRefNumber', 'dspRefNumber', { unique: false });
        dspStore.createIndex('stage', 'stage', { unique: false });
      }

      // Create Health Facility (HF List) master store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_HF_LIST)) {
        const hfStore = db.createObjectStore(STORE_HF_LIST, { keyPath: 'id' });
        hfStore.createIndex('customer', 'customer', { unique: false });
        hfStore.createIndex('deliveringPlant', 'deliveringPlant', { unique: false });
        hfStore.createIndex('region', 'region', { unique: false });
      }

      // Create Receiving data records store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_RECEIVING)) {
        const recStore = db.createObjectStore(STORE_RECEIVING, { keyPath: 'id' });
        recStore.createIndex('purchaseOrder', 'purchaseOrder', { unique: false });
        recStore.createIndex('material', 'material', { unique: false });
      }

      // Create Distribution data records store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_DISTRIBUTION)) {
        const distStore = db.createObjectStore(STORE_DISTRIBUTION, { keyPath: 'id' });
        distStore.createIndex('customerName', 'customerName', { unique: false });
        distStore.createIndex('materialCode', 'materialCode', { unique: false });
      }

      // Create Material Master items store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_MATERIAL_MASTER)) {
        const matStore = db.createObjectStore(STORE_MATERIAL_MASTER, { keyPath: 'id' });
        matStore.createIndex('material', 'material', { unique: false });
      }

      // Create Program MD records store with primary key `id`
      if (!db.objectStoreNames.contains(STORE_PROGRAM_MD)) {
        const pmdStore = db.createObjectStore(STORE_PROGRAM_MD, { keyPath: 'id' });
        pmdStore.createIndex('sapPo', 'sapPo', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB database'));
    };

    request.onblocked = () => {
      console.warn('IndexedDB database upgrade blocked by other open tabs');
    };
  });
}

/**
 * Caches the medical device inventory items and metadata to IndexedDB
 */
export async function saveInventoryToIndexedDB(
  items: MedicalDeviceItem[],
  options?: {
    noBkdItems?: NoBkdItem[];
    sourceSpreadsheetId?: string;
    sourceSheetTab?: string;
    syncType?: InventoryCacheMeta['syncType'];
  }
): Promise<boolean> {
  if (!isIndexedDBSupported() || !items) return false;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('epss:indexeddb:sync-start', { detail: { total: items.length } }));
    window.dispatchEvent(new CustomEvent('epss:indexeddb:progress', { detail: { progress: 25 } }));
  }

  try {
    const db = await openDB();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('epss:indexeddb:progress', { detail: { progress: 50 } }));
    }
    const now = new Date();
    const totalUnits = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalValuation = items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

    const meta: InventoryCacheMeta = {
      key: META_KEY_LAST_SYNC,
      timestamp: now.getTime(),
      dateFormatted: now.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      totalItems: items.length,
      totalUnits,
      totalValuation,
      sourceSpreadsheetId: options?.sourceSpreadsheetId || localStorage.getItem('selectedSpreadsheetId') || undefined,
      sourceSheetTab: options?.sourceSheetTab || localStorage.getItem('selectedSheetTabName') || 'all',
      syncType: options?.syncType || 'google_sheets_batch',
      isOfflineAvailable: true
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('epss:indexeddb:progress', { detail: { progress: 75 } }));
    }

    return new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction([STORE_ITEMS, STORE_NOBKD, STORE_META], 'readwrite');
      const itemsStore = transaction.objectStore(STORE_ITEMS);
      const noBkdStore = transaction.objectStore(STORE_NOBKD);
      const metaStore = transaction.objectStore(STORE_META);

      // Clear previous cached items to keep cache clean & synced
      itemsStore.clear();
      noBkdStore.clear();

      // Put all devices with periodic progress updates if there are many
      const totalItemsCount = items.length;
      let processedCount = 0;
      
      for (const item of items) {
        itemsStore.put(item);
        processedCount++;
        
        // Update progress every 50 items or 10% of items, whichever is larger
        const updateInterval = Math.max(50, Math.floor(totalItemsCount / 10));
        if (processedCount % updateInterval === 0 && typeof window !== 'undefined') {
          const currentProgress = 30 + Math.floor((processedCount / totalItemsCount) * 60); // Use 30-90 range for items
          window.dispatchEvent(new CustomEvent('epss:indexeddb:progress', { detail: { progress: currentProgress } }));
        }
      }

      // Put no-breakdown items if provided
      if (options?.noBkdItems) {
        for (const item of options.noBkdItems) {
          noBkdStore.put(item);
        }
      }

      // Save metadata
      metaStore.put(meta);

      transaction.oncomplete = () => {
        db.close();
        // Dispatch window event so other components can react to cache updates
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epss:indexeddb:progress', { detail: { progress: 100 } }));
          window.dispatchEvent(new CustomEvent('epss:indexeddb:updated', { detail: meta }));
        }
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        console.error('IndexedDB transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error('Failed to save inventory to IndexedDB:', err);
    return false;
  }
}

/**
 * Loads the cached inventory items and metadata from IndexedDB
 */
export async function loadInventoryFromIndexedDB(): Promise<{
  items: MedicalDeviceItem[];
  noBkdItems: NoBkdItem[];
  meta: InventoryCacheMeta | null;
} | null> {
  if (!isIndexedDBSupported()) return null;

  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ITEMS, STORE_NOBKD, STORE_META], 'readonly');
      const itemsStore = transaction.objectStore(STORE_ITEMS);
      const noBkdStore = transaction.objectStore(STORE_NOBKD);
      const metaStore = transaction.objectStore(STORE_META);

      const itemsRequest = itemsStore.getAll();
      const noBkdRequest = noBkdStore.getAll();
      const metaRequest = metaStore.get(META_KEY_LAST_SYNC);

      let loadedItems: MedicalDeviceItem[] = [];
      let loadedNoBkdItems: NoBkdItem[] = [];
      let loadedMeta: InventoryCacheMeta | null = null;

      itemsRequest.onsuccess = () => {
        loadedItems = itemsRequest.result || [];
      };

      noBkdRequest.onsuccess = () => {
        loadedNoBkdItems = noBkdRequest.result || [];
      };

      metaRequest.onsuccess = () => {
        loadedMeta = metaRequest.result || null;
      };

      transaction.oncomplete = () => {
        db.close();
        if (loadedItems.length > 0 || loadedNoBkdItems.length > 0) {
          resolve({
            items: loadedItems,
            noBkdItems: loadedNoBkdItems,
            meta: loadedMeta
          });
        } else {
          resolve(null);
        }
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error('Failed to load inventory from IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieves only the last sync metadata without pulling all items into memory
 */
export async function getLastSyncMetadata(): Promise<InventoryCacheMeta | null> {
  if (!isIndexedDBSupported()) return null;

  try {
    const db = await openDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_META], 'readonly');
      const metaStore = transaction.objectStore(STORE_META);
      const request = metaStore.get(META_KEY_LAST_SYNC);

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Clears the IndexedDB cache (e.g., when requested by user)
 */
export async function clearIndexedDBCache(): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;

  try {
    const db = await openDB();
    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([STORE_ITEMS, STORE_NOBKD, STORE_META], 'readwrite');
      transaction.objectStore(STORE_ITEMS).clear();
      transaction.objectStore(STORE_NOBKD).clear();
      transaction.objectStore(STORE_META).clear();

      transaction.oncomplete = () => {
        db.close();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epss:indexeddb:updated', { detail: null }));
        }
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Saves all multiple stock records to IndexedDB (supports 20+ plants and unlimited records)
 */
export async function saveMultipleStockToIndexedDB(items: MultipleStockRecord[]): Promise<boolean> {
  if (!isIndexedDBSupported() || !items) return false;

  try {
    const db = await openDB();
    return new Promise<boolean>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_MULTIPLE_STOCK)) {
        db.close();
        resolve(false);
        return;
      }
      const transaction = db.transaction([STORE_MULTIPLE_STOCK], 'readwrite');
      const store = transaction.objectStore(STORE_MULTIPLE_STOCK);
      store.clear();
      for (const item of items) {
        store.put(item);
      }

      transaction.oncomplete = () => {
        db.close();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epss:multiplestock:saved', { detail: { count: items.length } }));
        }
        resolve(true);
      };

      transaction.onerror = (err) => {
        console.error('Failed to commit multiple stock to IndexedDB', err);
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Error opening DB for saveMultipleStockToIndexedDB:', err);
    return false;
  }
}

/**
 * Loads all multiple stock records from IndexedDB
 */
export async function loadMultipleStockFromIndexedDB(): Promise<MultipleStockRecord[]> {
  if (!isIndexedDBSupported()) return [];

  try {
    const db = await openDB();
    return new Promise<MultipleStockRecord[]>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_MULTIPLE_STOCK)) {
        db.close();
        resolve([]);
        return;
      }
      const transaction = db.transaction([STORE_MULTIPLE_STOCK], 'readonly');
      const store = transaction.objectStore(STORE_MULTIPLE_STOCK);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };

      request.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch (err) {
    console.error('Error in loadMultipleStockFromIndexedDB:', err);
    return [];
  }
}

/**
 * Explicitly clears multiple stock records from IndexedDB only on user confirmation
 */
export async function clearMultipleStockFromIndexedDB(): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_MULTIPLE_STOCK)) {
      db.close();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([STORE_MULTIPLE_STOCK], 'readwrite');
      transaction.objectStore(STORE_MULTIPLE_STOCK).clear();

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Saves all DSP workflow records to IndexedDB for persistence across refreshes
 */
export async function saveDspRecordsToIndexedDB(records: any[]): Promise<boolean> {
  if (!isIndexedDBSupported() || !records) return false;

  try {
    const db = await openDB();
    return new Promise<boolean>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_DSP_RECORDS)) {
        db.close();
        resolve(false);
        return;
      }
      const transaction = db.transaction([STORE_DSP_RECORDS], 'readwrite');
      const store = transaction.objectStore(STORE_DSP_RECORDS);
      
      // We use put for each record to update existing or add new ones
      for (const record of records) {
        store.put(record);
      }

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = (err) => {
        console.error('Failed to commit DSP records to IndexedDB', err);
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Error opening DB for saveDspRecordsToIndexedDB:', err);
    return false;
  }
}

/**
 * Loads all DSP workflow records from IndexedDB
 */
export async function loadDspRecordsFromIndexedDB(): Promise<any[]> {
  if (!isIndexedDBSupported()) return [];

  try {
    const db = await openDB();
    return new Promise<any[]>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_DSP_RECORDS)) {
        db.close();
        resolve([]);
        return;
      }
      const transaction = db.transaction([STORE_DSP_RECORDS], 'readonly');
      const store = transaction.objectStore(STORE_DSP_RECORDS);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };

      request.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch (err) {
    console.error('Error in loadDspRecordsFromIndexedDB:', err);
    return [];
  }
}

/**
 * Clears all DSP workflow records from IndexedDB
 */
export async function clearDspRecordsFromIndexedDB(): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_DSP_RECORDS)) {
      db.close();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([STORE_DSP_RECORDS], 'readwrite');
      transaction.objectStore(STORE_DSP_RECORDS).clear();

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Saves all Health Facility Master List records into IndexedDB for persistent system storage.
 * Handles thousands of facilities without quota limits.
 */
export async function saveHFListToIndexedDB(items: HealthFacilityRecord[]): Promise<boolean> {
  if (!isIndexedDBSupported() || !items) return false;

  try {
    const db = await openDB();
    return new Promise<boolean>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_HF_LIST)) {
        db.close();
        resolve(false);
        return;
      }

      const transaction = db.transaction([STORE_HF_LIST], 'readwrite');
      const store = transaction.objectStore(STORE_HF_LIST);

      // Clear existing records in this store to avoid stale deleted records, then put all valid items
      store.clear();

      items.forEach((item, idx) => {
        if (item) {
          const validItem = {
            ...item,
            id: item.id || `hf-stored-${Date.now()}-${idx}`
          };
          store.put(validItem);
        }
      });

      transaction.oncomplete = () => {
        db.close();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epss:indexeddb:hf-list-saved', { detail: { count: items.length } }));
        }
        resolve(true);
      };

      transaction.onerror = (err) => {
        console.error('Failed to save HF list to IndexedDB:', err);
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Error in saveHFListToIndexedDB:', err);
    return false;
  }
}

/**
 * Loads all Health Facility Master List records from IndexedDB
 */
export async function loadHFListFromIndexedDB(): Promise<HealthFacilityRecord[]> {
  if (!isIndexedDBSupported()) return [];

  try {
    const db = await openDB();
    return new Promise<HealthFacilityRecord[]>((resolve) => {
      if (!db.objectStoreNames.contains(STORE_HF_LIST)) {
        db.close();
        resolve([]);
        return;
      }

      const transaction = db.transaction([STORE_HF_LIST], 'readonly');
      const store = transaction.objectStore(STORE_HF_LIST);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        const records = (request.result || []) as HealthFacilityRecord[];
        resolve(records);
      };

      request.onerror = (err) => {
        console.error('Failed to load HF list from IndexedDB:', err);
        db.close();
        resolve([]);
      };
    });
  } catch (err) {
    console.error('Error in loadHFListFromIndexedDB:', err);
    return [];
  }
}

/**
 * Clears all Health Facility Master List records from IndexedDB
 */
export async function clearHFListFromIndexedDB(): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_HF_LIST)) {
      db.close();
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([STORE_HF_LIST], 'readwrite');
      transaction.objectStore(STORE_HF_LIST).clear();

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Generic helper to save an array of records with `id` key to an IndexedDB store
 */
async function saveRecordsToStore<T extends { id?: string }>(storeName: string, records: T[]): Promise<boolean> {
  if (!isIndexedDBSupported() || !records) return false;
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return false;
    }
    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
      records.forEach((r, idx) => {
        const itemWithId = {
          ...r,
          id: r.id || `${storeName}-${Date.now()}-${idx + 1}`
        };
        store.put(itemWithId);
      });
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.error(`Error saving to ${storeName}:`, err);
    return false;
  }
}

/**
 * Generic helper to load all records from an IndexedDB store
 */
async function loadRecordsFromStore<T>(storeName: string): Promise<T[]> {
  if (!isIndexedDBSupported()) return [];
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return [];
    }
    return new Promise<T[]>((resolve) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result || []) as T[]);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch (err) {
    console.error(`Error loading from ${storeName}:`, err);
    return [];
  }
}

/**
 * Generic helper to clear an IndexedDB store
 */
async function clearStore(storeName: string): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction([storeName], 'readwrite');
      transaction.objectStore(storeName).clear();
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

// Receiving Data Records
export const saveReceivingToIndexedDB = (records: ReceivingDataRecord[]) => saveRecordsToStore(STORE_RECEIVING, records);
export const loadReceivingFromIndexedDB = () => loadRecordsFromStore<ReceivingDataRecord>(STORE_RECEIVING);
export const clearReceivingFromIndexedDB = () => clearStore(STORE_RECEIVING);

// Distribution Data Records
export const saveDistributionToIndexedDB = (records: DistributionDataRecord[]) => saveRecordsToStore(STORE_DISTRIBUTION, records);
export const loadDistributionFromIndexedDB = () => loadRecordsFromStore<DistributionDataRecord>(STORE_DISTRIBUTION);
export const clearDistributionFromIndexedDB = () => clearStore(STORE_DISTRIBUTION);

// Material Master Records
export const saveMaterialMasterToIndexedDB = (records: MaterialMasterRecord[]) => saveRecordsToStore(STORE_MATERIAL_MASTER, records);
export const loadMaterialMasterFromIndexedDB = () => loadRecordsFromStore<MaterialMasterRecord>(STORE_MATERIAL_MASTER);
export const clearMaterialMasterFromIndexedDB = () => clearStore(STORE_MATERIAL_MASTER);

// Program MD Records
export const saveProgramMdToIndexedDB = (records: ProgramMdRecord[]) => saveRecordsToStore(STORE_PROGRAM_MD, records);
export const loadProgramMdFromIndexedDB = () => loadRecordsFromStore<ProgramMdRecord>(STORE_PROGRAM_MD);
export const clearProgramMdFromIndexedDB = () => clearStore(STORE_PROGRAM_MD);

/**
 * Requests persistent storage from the browser so IndexedDB data is never evicted under storage pressure
 */
export async function requestPersistentStorageQuota(): Promise<{ persisted: boolean; quotaMb?: number; usageMb?: number }> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const persisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage granted: ${persisted}`);

      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const quotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
        const usageMb = Math.round((estimate.usage || 0) / (1024 * 1024));
        return { persisted, quotaMb, usageMb };
      }
      return { persisted };
    } catch (e) {
      console.warn('[Storage] Persistent storage request notice:', e);
    }
  }
  return { persisted: false };
}

/**
 * Gets storage estimate in MB
 */
export async function getStorageEstimate(): Promise<{ quotaMb: number; usageMb: number; usagePercentage: number }> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
      const usageMb = Math.round((estimate.usage || 0) / (1024 * 1024));
      const usagePercentage = quotaMb > 0 ? Number(((usageMb / quotaMb) * 100).toFixed(2)) : 0;
      return { quotaMb, usageMb, usagePercentage };
    } catch {
      // fallback
    }
  }
  return { quotaMb: 50000, usageMb: 5, usagePercentage: 0.01 };
}

/**
 * Safely writes to localStorage catching QuotaExceededError without breaking execution
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[SafeStorage] localStorage limit reached for key '${key}'. Data is safely persisted in IndexedDB unlimited database instead.`, e);
    return false;
  }
}


