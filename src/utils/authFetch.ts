import { getAccessToken } from '../lib/supabase';

/**
 * Makes every request to this app's own /api/* endpoints carry the Supabase access token,
 * so the server can verify who is calling. Also makes <a href="/api/download-file/..."> links
 * work (a plain link can not send an Authorization header, so we fetch it ourselves).
 * Call once at startup.
 */
export function installAuthFetch(): void {
  const w = window as any;
  if (w.__epssAuthFetchInstalled) return;
  w.__epssAuthFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const isOwnApi = (input: RequestInfo | URL): boolean => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const url = new URL(raw, window.location.origin);
      return url.origin === window.location.origin && url.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  };

  Object.defineProperty(window, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isOwnApi(input)) return originalFetch(input, init);
      const token = await getAccessToken();
      if (!token) return originalFetch(input, init);

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return originalFetch(input, { ...init, headers });
    },
    writable: true,
    configurable: true
  });

  // Download links to files stored on the server
  document.addEventListener(
    'click',
    async (event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/api/download-file/')) return;

      event.preventDefault();
      try {
        const res = await window.fetch(href);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = decodeURIComponent(href.split('/').pop() || 'download');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (err) {
        console.warn('Could not download file:', err);
        alert('Could not download this file. Please sign in again and retry.');
      }
    },
    true
  );
}
