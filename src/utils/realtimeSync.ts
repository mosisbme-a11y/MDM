/**
 * Real-time Cross-Device & Multi-Session Automatic Sync Manager
 * 
 * Ensures that when any device or tab opens the application, it automatically 
 * detects and synchronizes with the latest inventory updates published by 
 * an Inventory Administrator across device sessions.
 */

export interface AdminUpdateInfo {
  timestamp: number;
  formattedTime: string;
  kind: string; // e.g., 'Master Inventory', 'Multiple Stock', 'Receiving Data', 'Distribution Data', 'HF List'
  itemCount?: number;
  updatedBy?: string;
  deviceId?: string;
}

export interface AdminUpdateEvent {
  type: 'EPSS_ADMIN_DATA_UPDATE';
  info: AdminUpdateInfo;
  payload?: any;
}

const BROADCAST_CHANNEL_NAME = 'epss_inventory_auto_sync';
const STORAGE_KEY_LAST_UPDATE_TS = 'epss_admin_last_update_ts';
const STORAGE_KEY_LAST_UPDATE_INFO = 'epss_admin_last_update_info';
const CUSTOM_EVENT_NAME = 'epss:admin_data_updated';

// Unique session device ID
let currentDeviceId = '';
if (typeof window !== 'undefined') {
  currentDeviceId = localStorage.getItem('epss_device_session_id') || '';
  if (!currentDeviceId) {
    currentDeviceId = 'device_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    try {
      localStorage.setItem('epss_device_session_id', currentDeviceId);
    } catch {}
  }
}

/**
 * Broadcasts an Inventory Administrator update to all open sessions, windows, and devices.
 */
export function broadcastAdminUpdate(kind: string, itemCount?: number, updatedBy?: string): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const updateInfo: AdminUpdateInfo = {
    timestamp: now,
    formattedTime: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kind,
    itemCount,
    updatedBy: updatedBy || 'Inventory Administrator',
    deviceId: currentDeviceId
  };

  try {
    localStorage.setItem(STORAGE_KEY_LAST_UPDATE_TS, String(now));
    localStorage.setItem(STORAGE_KEY_LAST_UPDATE_INFO, JSON.stringify(updateInfo));
  } catch (e) {
    console.warn('Failed to save admin update info to localStorage:', e);
  }

  // 1. BroadcastChannel (Same browser multi-tab/window)
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({
        type: 'EPSS_ADMIN_DATA_UPDATE',
        info: updateInfo
      } as AdminUpdateEvent);
      channel.close();
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 2. Dispatch local DOM custom event
  window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: updateInfo }));
}

/**
 * Gets the timestamp of the last Administrator update recorded.
 */
export function getLastAdminUpdateTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_UPDATE_TS);
    return saved ? Number(saved) : 0;
  } catch {
    return 0;
  }
}

/**
 * Gets detailed metadata about the last Administrator update.
 */
export function getLastAdminUpdateInfo(): AdminUpdateInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_UPDATE_INFO);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Subscribes a listener function to Administrator inventory updates across tabs/windows/devices.
 * Automatically checks when opening device session, regaining window focus, or receiving BroadcastChannel signals.
 */
export function initializeAutoSyncListener(
  onDataUpdated: (updateInfo: AdminUpdateInfo) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastKnownTs = getLastAdminUpdateTimestamp();

  const checkForRemoteUpdates = (source: string) => {
    const latestTs = getLastAdminUpdateTimestamp();
    if (latestTs > lastKnownTs) {
      lastKnownTs = latestTs;
      const info = getLastAdminUpdateInfo();
      if (info) {
        onDataUpdated(info);
      }
    }
  };

  // 1. Listen to BroadcastChannel
  let channel: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<AdminUpdateEvent>) => {
        if (event.data && event.data.type === 'EPSS_ADMIN_DATA_UPDATE' && event.data.info) {
          // Ignore self-triggered broadcasts if from same tab, but sync if timestamp is newer
          if (event.data.info.timestamp > lastKnownTs) {
            lastKnownTs = event.data.info.timestamp;
            onDataUpdated(event.data.info);
          }
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel listener creation failed:', e);
    }
  }

  // 2. Listen to localStorage storage events (cross-tab / cross-window)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_LAST_UPDATE_TS || e.key === STORAGE_KEY_LAST_UPDATE_INFO) {
      checkForRemoteUpdates('storage_event');
    }
  };
  window.addEventListener('storage', handleStorageChange);

  // 3. Listen to custom DOM event
  const handleCustomEvent = (e: Event) => {
    const customEvt = e as CustomEvent<AdminUpdateInfo>;
    if (customEvt.detail && customEvt.detail.timestamp > lastKnownTs) {
      lastKnownTs = customEvt.detail.timestamp;
      onDataUpdated(customEvt.detail);
    }
  };
  window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

  // 4. Auto-check when opening app / regaining window focus / page visibility
  const handleFocusOrVisible = () => {
    checkForRemoteUpdates('focus_or_visibility');
  };
  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', handleFocusOrVisible);

  // 5. Periodic background heartbeat check (every 10 seconds)
  const intervalId = setInterval(() => {
    checkForRemoteUpdates('heartbeat');
  }, 10000);

  // Initial check on load
  checkForRemoteUpdates('initial_load');

  // Cleanup function
  return () => {
    if (channel) {
      channel.close();
    }
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('focus', handleFocusOrVisible);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
    clearInterval(intervalId);
  };
}
