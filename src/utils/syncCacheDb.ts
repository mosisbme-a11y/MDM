/**
 * Browser data caching is DISABLED on purpose: no app data is stored in the browser.
 * All data lives in Supabase and is downloaded fresh from the server on every load.
 * These functions are kept as no-ops so existing imports keep working.
 * On first load they also delete any old "epss-sync-cache" database left by earlier versions.
 */
let purged = false;
function purgeOldCache(): void {
  if (purged) return;
  purged = true;
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('epss-sync-cache');
  } catch {
    // ignore
  }
}

export async function cacheGet<T = any>(_key: string): Promise<T | undefined> {
  purgeOldCache();
  return undefined;
}

export async function cacheGetAllWithPrefix<T = any>(_prefix: string): Promise<Map<string, T>> {
  purgeOldCache();
  return new Map<string, T>();
}

export async function cacheSetMany(_entries: [string, any][]): Promise<void> {
  purgeOldCache();
}

export async function cacheDeleteWithPrefix(_prefix: string, _keep?: Set<string>): Promise<void> {
  purgeOldCache();
}

export async function cacheClearAll(): Promise<void> {
  purgeOldCache();
}
