// Google OAuth access token for Gmail (send DSP / breakdown emails) using Google Identity Services.
// No Firebase involved. Requires an OAuth "Web application" Client ID in VITE_GOOGLE_CLIENT_ID
// (Google Cloud Console -> APIs & Services -> Credentials; add your site URL under Authorized JavaScript origins).

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify'
].join(' ');
const TOKEN_STORAGE_KEY = 'epss_google_oauth_access_token';
const EXPIRY_STORAGE_KEY = 'epss_google_oauth_access_token_exp';

let isSigningIn = false;

const readStored = (): string | null => {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const exp = Number(localStorage.getItem(EXPIRY_STORAGE_KEY) || 0);
    if (token && exp > Date.now()) return token;
  } catch {}
  return null;
};

let cachedAccessToken: string | null = readStored();

function loadGis(): Promise<any> {
  const w = window as any;
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve((window as any).google));
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in script')));
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export const googleSignIn = async (): Promise<{ accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Sign-in already in progress, ignoring extra request.');
    return null;
  }
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured: set VITE_GOOGLE_CLIENT_ID.');
  }
  isSigningIn = true;
  try {
    const google = await loadGis();
    return await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        prompt: 'consent',
        callback: (resp: any) => {
          if (resp?.error || !resp?.access_token) {
            reject(new Error(resp?.error_description || resp?.error || 'Failed to get Google access token'));
            return;
          }
          cachedAccessToken = resp.access_token;
          try {
            localStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);
            localStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60_000));
          } catch {}
          resolve({ accessToken: resp.access_token });
        },
        error_callback: (err: any) => {
          // popup closed / blocked: not an error worth surfacing
          console.warn('Google sign-in cancelled:', err?.type || err);
          resolve(null);
        }
      });
      client.requestAccessToken();
    });
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  cachedAccessToken = readStored();
  return cachedAccessToken;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch {}
};

export const logout = async () => {
  clearCachedAccessToken();
};
