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

let cachedAccessToken: string | null = null;
let cachedExpiry: number = 0;
let isSigningIn = false;

const readStored = (): string | null => {
  if (cachedAccessToken && cachedExpiry > Date.now()) {
    return cachedAccessToken;
  }
  return null;
};

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
          cachedExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60_000;
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
  return readStored();
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  cachedExpiry = 0;
};

export const logout = async () => {
  clearCachedAccessToken();
};
