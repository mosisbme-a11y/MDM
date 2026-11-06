/**
 * Tiny IndexedDB key-value store used by centralSyncService to keep downloaded dataset chunks
 * on this device. After a hard refresh the app can show the last known data immediately and then
 * only download the chunks that changed on the server.
 *
 * Every function fails silently (private mode, quota, blocked DB) - the cache is an optimisation only.
 */
const DB_NAME = 'epss-sync-cache';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function cacheGet<T = any>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Loads every entry whose key starts with `prefix` in a single cursor pass. */
export async function cacheGetAllWithPrefix<T = any>(prefix: string): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const db = await openDb();
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        out.set(String(cursor.key), cursor.value as T);
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

export async function cacheSetMany(entries: [string, any][]): Promise<void> {
  if (!entries.length) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const [k, v] of entries) store.put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Deletes every entry with the prefix, except keys listed in `keep`. */
export async function cacheDeleteWithPrefix(prefix: string, keep?: Set<string>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
      const req = store.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (!keep || !keep.has(String(cursor.key))) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function cacheClearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
