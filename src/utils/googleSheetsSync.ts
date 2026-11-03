import { MedicalDeviceItem, NoBkdItem, MaintenanceCalendarEvent, DeviceDocument, AlertNotification } from '../types';
import { 
  parseSheetRowsToMedicalDevices, 
  parseSheetRowsToNoBkdItems,
  parseSheetRowsToCalendarEvents,
  parseSheetRowsToDocuments,
  parseSheetRowsToAlerts
} from './googleSheetsParser';
import { recordSyncLatency } from './syncHealthService';

const QUOTA_COOLDOWN_KEY = 'epss_google_quota_cooldown_until';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for spreadsheet sheet tab titles

interface CachedTitles {
  titles: string[];
  spreadsheetTitle: string;
  expiresAt: number;
}

const titlesMemoryCache = new Map<string, CachedTitles>();

/**
 * Returns seconds remaining in quota cooldown, or 0 if active/clear.
 */
export function getQuotaCooldownRemaining(): number {
  try {
    const raw = localStorage.getItem(QUOTA_COOLDOWN_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (isNaN(until) || until <= Date.now()) {
      localStorage.removeItem(QUOTA_COOLDOWN_KEY);
      return 0;
    }
    return Math.ceil((until - Date.now()) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Sets a quota cooldown period (defaults to 65 seconds to allow Google's 60s per-minute quota window to fully reset).
 */
export function setQuotaCooldown(seconds: number = 65): void {
  try {
    const until = Date.now() + seconds * 1000;
    localStorage.setItem(QUOTA_COOLDOWN_KEY, String(until));
  } catch {
    // ignore
  }
}

/**
 * Clears any active quota cooldown.
 */
export function clearQuotaCooldown(): void {
  try {
    localStorage.removeItem(QUOTA_COOLDOWN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Checks whether an error or HTTP response indicates Google Sheets API rate limit / quota exceeded.
 */
export function isQuotaExceededError(errorOrMessage: any, status?: number): boolean {
  if (status === 429) return true;
  const msg = String(errorOrMessage?.message || errorOrMessage || '').toLowerCase();
  return (
    msg.includes('quota exceeded') ||
    msg.includes('rate_limit_exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('read requests per minute') ||
    msg.includes('user rate limit exceeded')
  );
}

/**
 * Fetches the tab titles for a spreadsheet, using a 5-minute cache to avoid burning read quota.
 */
export async function fetchSpreadsheetTabTitles(
  spreadsheetId: string,
  token: string,
  forceRefresh: boolean = false
): Promise<{ titles: string[]; spreadsheetTitle: string }> {
  // Check memory cache
  const cached = titlesMemoryCache.get(spreadsheetId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { titles: cached.titles, spreadsheetTitle: cached.spreadsheetTitle };
  }

  // Check localStorage cache
  if (!forceRefresh) {
    try {
      const localCachedRaw = localStorage.getItem(`epss_tab_titles_${spreadsheetId}`);
      if (localCachedRaw) {
        const localCached: CachedTitles = JSON.parse(localCachedRaw);
        if (localCached.expiresAt > Date.now() && Array.isArray(localCached.titles) && localCached.titles.length > 0) {
          titlesMemoryCache.set(spreadsheetId, localCached);
          return { titles: localCached.titles, spreadsheetTitle: localCached.spreadsheetTitle || 'Google Spreadsheet' };
        }
      }
    } catch {
      // ignore
    }
  }

  // Check quota cooldown
  const remaining = getQuotaCooldownRemaining();
  if (remaining > 0) {
    throw new Error(`Google API quota cooldown active: please wait ${remaining}s for Google's quota window to reset.`);
  }

  // Fetch properties.title and sheets.properties.title field to minimize payload and processing
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const errMsg = errorBody.error?.message || `HTTP ${res.status}`;
    if (isQuotaExceededError(errMsg, res.status)) {
      setQuotaCooldown(65);
      throw new Error(`Google Sheets read quota exceeded. Cooldown active for 65s.`);
    }
    throw new Error(errMsg);
  }

  const metaData = await res.json();
  const spreadsheetTitle = metaData.properties?.title || 'Google Spreadsheet';
  const titles: string[] = (metaData.sheets || [])
    .map((s: any) => s.properties?.title)
    .filter((t: any): t is string => Boolean(t));

  const finalTitles = titles.length > 0 ? titles : ['Sheet1'];

  // Update memory & localStorage cache
  const cacheObj: CachedTitles = {
    titles: finalTitles,
    spreadsheetTitle,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  titlesMemoryCache.set(spreadsheetId, cacheObj);
  try {
    localStorage.setItem(`epss_tab_titles_${spreadsheetId}`, JSON.stringify(cacheObj));
  } catch {
    // ignore
  }

  return { titles: finalTitles, spreadsheetTitle };
}

export interface BatchPullResult {
  success: boolean;
  spreadsheetTitle?: string;
  items: MedicalDeviceItem[];
  noBkdItems?: NoBkdItem[];
  events?: MaintenanceCalendarEvent[];
  documents?: DeviceDocument[];
  alerts?: AlertNotification[];
  availableSheetTitles?: string[];
  tabCount: number;
  latencyMs?: number;
  error?: string;
  isQuotaError?: boolean;
}

/**
 * Batches the retrieval of all requested sheet tabs in a SINGLE Google Sheets API request (`values:batchGet`),
 * preventing multiple individual HTTP calls from exhausting the 60 requests/minute Google quota.
 */
export async function batchPullMedicalDevices(
  spreadsheetId: string,
  token: string,
  selectedSheetTabNames: string[] = ['all'],
  forceRefreshTitles: boolean = false,
  ignoredSheetTabs: string[] = []
): Promise<BatchPullResult> {
  const cooldownSec = getQuotaCooldownRemaining();
  if (cooldownSec > 0) {
    return {
      success: false,
      items: [],
      tabCount: 0,
      error: `Google Sheets API read quota is resting (Google allows 60 req/min). Cooldown expires in ${cooldownSec}s. Please wait before retrying.`,
      isQuotaError: true
    };
  }

  try {
    // 1. Get tab titles (cached where possible)
    const { titles, spreadsheetTitle } = await fetchSpreadsheetTabTitles(spreadsheetId, token, forceRefreshTitles);
    
    // Always include breakdown, schedule, docs, and alert sheets to keep dashboard counts accurate
    const breakdownRegex = /no\s*bkd|no\s*breakdown|2\.|breakdown\s*status|moh\s*breakdown|lack\s*of\s*breakdown/i;
    const scheduleRegex = /schedule|calendar|event|maintenance/i;
    const documentRegex = /doc|manual|spec|technical/i;
    const alertRegex = /alert|notification|warning/i;
    
    const extraTitles = titles.filter(t => 
      breakdownRegex.test(t) || 
      scheduleRegex.test(t) || 
      documentRegex.test(t) || 
      alertRegex.test(t)
    );
    
    const inventoryTitles = selectedSheetTabNames.includes('all')
        ? titles.filter(t => !breakdownRegex.test(t) && !scheduleRegex.test(t) && !documentRegex.test(t) && !alertRegex.test(t) && !ignoredSheetTabs.includes(t))
        : titles.filter((t) => selectedSheetTabNames.some(selected => selected.toLowerCase() === t.toLowerCase()) && !ignoredSheetTabs.includes(t));
    
    const sheetsToQuery = Array.from(new Set([...inventoryTitles, ...extraTitles]));
    if (sheetsToQuery.length === 0 && titles.length > 0) {
      sheetsToQuery.push(titles[0]);
    }

    // 2. Build multi-range query for values:batchGet (ALL tabs in 1 single HTTP GET request)
    const rangesParam = sheetsToQuery
      .map((title) => `ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:ZZ`)}`)
      .join('&');

    const batchGetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}&majorDimension=ROWS`;

    const startTime = performance.now();
    const res = await fetch(batchGetUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `HTTP ${res.status}`;
      if (isQuotaExceededError(msg, res.status)) {
        setQuotaCooldown(65);
        return {
          success: false,
          items: [],
          tabCount: 0,
          error: `Google Sheets API read quota exceeded (Google limit: 60 reads/minute per user). Automatic 65s cooldown enabled.`,
          isQuotaError: true
        };
      }
      return {
        success: false,
        items: [],
        tabCount: 0,
        error: `Google Sheets API error: ${msg}`
      };
    }

    const data = await res.json();
    const latencyMs = Math.max(15, Math.round(performance.now() - startTime));
    recordSyncLatency(latencyMs, spreadsheetTitle);
    const valueRanges: Array<{ range?: string; values?: any[][] }> = data.valueRanges || [];

    let aggregatedDevices: MedicalDeviceItem[] = [];
    let aggregatedNoBkdItems: NoBkdItem[] = [];
    let aggregatedEvents: MaintenanceCalendarEvent[] = [];
    let aggregatedDocuments: DeviceDocument[] = [];
    let aggregatedAlerts: AlertNotification[] = [];

    // 3. Map each range's values to its corresponding sheet tab
    valueRanges.forEach((rangeObj, idx) => {
      const values = rangeObj.values;
      if (!values || values.length <= 1) return;

      // Match tab title from range string (e.g. "'Master Inventory SOH'!A1:ZZ")
      let sheetTitle = sheetsToQuery[idx] || 'Master SOH';
      if (rangeObj.range) {
        const rawRangeTitle = rangeObj.range.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
        const found = sheetsToQuery.find((t) => t.toLowerCase() === rawRangeTitle.toLowerCase());
        if (found) sheetTitle = found;
      }

      // 4. Route values to the correct parser based on sheet title
      if (/no\s*bkd|no\s*breakdown|2\.|breakdown\s*status|moh\s*breakdown|lack\s*of\s*breakdown/i.test(sheetTitle)) {
         const parsed = parseSheetRowsToNoBkdItems(values);
         if (parsed.length > 0) aggregatedNoBkdItems.push(...parsed);
      } else if (/schedule|calendar|event|maintenance/i.test(sheetTitle)) {
         const parsed = parseSheetRowsToCalendarEvents(values);
         if (parsed.length > 0) aggregatedEvents.push(...parsed);
      } else if (/doc|manual|spec|technical/i.test(sheetTitle)) {
         const parsed = parseSheetRowsToDocuments(values);
         if (parsed.length > 0) aggregatedDocuments.push(...parsed);
      } else if (/alert|notification|warning/i.test(sheetTitle)) {
         const parsed = parseSheetRowsToAlerts(values);
         if (parsed.length > 0) aggregatedAlerts.push(...parsed);
      } else {
        const parsed = parseSheetRowsToMedicalDevices(values, sheetTitle);
        if (parsed.length > 0) {
          if (/dsp/i.test(sheetTitle)) {
            parsed.forEach((p) => (p.hasDSP = true));
          }
          if (/distribution|hub\s*to\s*h/i.test(sheetTitle)) {
            parsed.forEach((p) => {
              p.sheetTabSource = sheetTitle;
              if (!p.deliveryStatus) {
                p.deliveryStatus = 'In Transit';
              }
            });
          }
          aggregatedDevices.push(...parsed);
        }
      }
    });

    if (aggregatedDevices.length === 0 && aggregatedNoBkdItems.length === 0 && aggregatedEvents.length === 0) {
      return {
        success: true,
        items: [],
        noBkdItems: [],
        events: [],
        documents: [],
        alerts: [],
        availableSheetTitles: titles,
        tabCount: sheetsToQuery.length,
        error: 'No valid data rows were found in the selected sheet tab(s).'
      };
    }

    // 4. Ensure unique composite keys across all tabs
    const uniqueMap = new Map<string, MedicalDeviceItem>();
    aggregatedDevices.forEach((item) => {
      const key = uniqueMap.has(item.id) ? `${item.sheetTabSource || 'tab'}::${item.id}` : item.id;
      uniqueMap.set(key, { ...item, id: key });
    });

    const masterItems = Array.from(uniqueMap.values());
    const dspMasterItems = masterItems.filter(d => d.hasDSP);
    
    // If no separate no-breakdown sheet or to ensure breakdown status is powered by master data Items Have DSP?
    if (aggregatedNoBkdItems.length === 0 && dspMasterItems.length > 0) {
      aggregatedNoBkdItems = dspMasterItems.map((d: any, idx: number) => ({
        id: d.id || `DSP-BKD-${idx + 1}`,
        code: d.material || '',
        description: d.materialDescription || 'DSP Item',
        qty: d.qty || 1,
        unit: 'EA',
        plant: d.plant || 'HO01',
        storageLocation: d.wh || d.storageLocation || 'HOM6',
        wbsElement: d.wbsElement || d.budgetSource || 'N/A',
        batch: d.batch || '',
        expiryDate: d.expiryDate || '',
        mohApprovalStatus: d.fyaEpSSNoBkdStatus?.includes('Approved') ? 'Approved' : d.fyaEpSSNoBkdStatus?.includes('Reject') ? 'Rejected' : 'Pending',
        remark: d.nextAction || d.wayOfIntervention || 'DSP Active Delivery - Master Inventory SOH'
      }));
    }

    return {
      success: true,
      items: masterItems,
      noBkdItems: aggregatedNoBkdItems,
      events: aggregatedEvents,
      documents: aggregatedDocuments,
      alerts: aggregatedAlerts,
      availableSheetTitles: titles,
      tabCount: sheetsToQuery.length,
      latencyMs
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setQuotaCooldown(65);
      return {
        success: false,
        items: [],
        tabCount: 0,
        error: `Google Sheets read quota exceeded. Cooldown active for 65s.`,
        isQuotaError: true
      };
    }
    return {
      success: false,
      items: [],
      tabCount: 0,
      error: err.message || 'Unknown error pulling spreadsheet data'
    };
  }
}

/**
 * Scans all spreadsheets in the user's Google Drive and aggregates exact live medical device items and records.
 */
export async function aggregateAllDriveSpreadsheets(token: string): Promise<BatchPullResult> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&orderBy=modifiedTime desc&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id, name)",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.files || data.files.length === 0) {
      return {
        success: false,
        items: [],
        tabCount: 0,
        error: 'No Google Sheets spreadsheets found in Google Drive.'
      };
    }

    let allItems: MedicalDeviceItem[] = [];
    let allNoBkdItems: NoBkdItem[] = [];
    let allEvents: MaintenanceCalendarEvent[] = [];
    let allDocuments: DeviceDocument[] = [];
    let allAlerts: AlertNotification[] = [];
    let totalTabs = 0;

    for (const file of data.files) {
      try {
        const pullRes = await batchPullMedicalDevices(file.id, token, ['all'], true);
        if (pullRes.success) {
          if (pullRes.items) allItems.push(...pullRes.items);
          if (pullRes.noBkdItems) allNoBkdItems.push(...pullRes.noBkdItems);
          if (pullRes.events) allEvents.push(...pullRes.events);
          if (pullRes.documents) allDocuments.push(...pullRes.documents);
          if (pullRes.alerts) allAlerts.push(...pullRes.alerts);
          totalTabs += pullRes.tabCount || 0;
        }
      } catch (e) {
        console.warn(`Failed to pull from spreadsheet ${file.name} (${file.id}):`, e);
      }
    }

    // Deduplicate items by ID
    const uniqueMap = new Map<string, MedicalDeviceItem>();
    allItems.forEach((item) => {
      const key = uniqueMap.has(item.id) ? `drive::${item.id}::${Math.random().toString(36).substring(2, 7)}` : item.id;
      uniqueMap.set(key, { ...item, id: key });
    });

    return {
      success: true,
      items: Array.from(uniqueMap.values()),
      noBkdItems: allNoBkdItems,
      events: allEvents,
      documents: allDocuments,
      alerts: allAlerts,
      tabCount: totalTabs
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      tabCount: 0,
      error: err.message || 'Failed to aggregate Google Drive spreadsheets.'
    };
  }
}

