import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  X,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Send,
  Sliders,
  Database
} from 'lucide-react';
import {
  getSyncHealthSnapshot,
  SyncHealthSnapshot,
  enqueuePendingItem,
  clearPendingQueue,
  flushPendingQueue,
  dequeuePendingItem,
  recordSyncLatency,
  getRegionalSyncStates,
  syncRegionNow,
  RegionSyncState
} from '../utils/syncHealthService';

interface SyncHealthIndicatorProps {
  isSyncing?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export const SyncHealthIndicator: React.FC<SyncHealthIndicatorProps> = ({
  isSyncing = false,
  onRefresh,
  className = ''
}) => {
  const [snapshot, setSnapshot] = useState<SyncHealthSnapshot>(() => getSyncHealthSnapshot());
  const [regionalStates, setRegionalStates] = useState<RegionSyncState[]>(() => getRegionalSyncStates());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Subscribe to sync health changes across window events
  useEffect(() => {
    const updateSnapshot = () => {
      setSnapshot(getSyncHealthSnapshot());
      setRegionalStates(getRegionalSyncStates());
    };

    window.addEventListener('epss:sync_health_updated', updateSnapshot);
    window.addEventListener('online', updateSnapshot);
    window.addEventListener('offline', updateSnapshot);
    window.addEventListener('storage', updateSnapshot);

    // Periodic quick refresh for cooldown countdown
    const timer = setInterval(() => {
      updateSnapshot();
    }, 4000);

    return () => {
      window.removeEventListener('epss:sync_health_updated', updateSnapshot);
      window.removeEventListener('online', updateSnapshot);
      window.removeEventListener('offline', updateSnapshot);
      window.removeEventListener('storage', updateSnapshot);
      clearInterval(timer);
    };
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Color scheme & status helper based on latency and health rating
  const getHealthBadgeConfig = () => {
    if (!snapshot.isOnline) {
      return {
        dotClass: 'bg-slate-400',
        ringClass: 'ring-slate-300',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        latencyColor: 'text-slate-600',
        label: 'Offline',
        description: 'Using IndexedDB offline store'
      };
    }
    if (snapshot.quotaCooldownSeconds > 0) {
      return {
        dotClass: 'bg-amber-500 animate-pulse',
        ringClass: 'ring-amber-300',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        latencyColor: 'text-amber-700',
        label: `Resting (${snapshot.quotaCooldownSeconds}s)`,
        description: 'Google API quota cooldown window'
      };
    }
    if (isSyncing) {
      return {
        dotClass: 'bg-cyan-500 animate-ping',
        ringClass: 'ring-cyan-300',
        badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        latencyColor: 'text-cyan-700',
        label: 'Syncing...',
        description: 'Fetching live batch from Google Sheets'
      };
    }
    if (snapshot.healthRating === 'optimal') {
      return {
        dotClass: 'bg-emerald-500',
        ringClass: 'ring-emerald-400/40',
        badgeBg: 'bg-emerald-50/90 text-emerald-800 border-emerald-200',
        latencyColor: 'text-emerald-700',
        label: 'Optimal',
        description: 'Google Sheets batch response under 400ms'
      };
    }
    if (snapshot.healthRating === 'normal') {
      return {
        dotClass: 'bg-blue-500',
        ringClass: 'ring-blue-400/40',
        badgeBg: 'bg-blue-50/90 text-blue-800 border-blue-200',
        latencyColor: 'text-blue-700',
        label: 'Normal',
        description: 'Standard Google API response speed'
      };
    }
    return {
      dotClass: 'bg-amber-500',
      ringClass: 'ring-amber-400/40',
      badgeBg: 'bg-amber-50/90 text-amber-800 border-amber-200',
      latencyColor: 'text-amber-700',
      label: 'High Latency',
      description: 'Response time exceeded 1200ms'
    };
  };

  const healthConfig = getHealthBadgeConfig();

  const handleFlushQueue = async () => {
    setIsProcessingQueue(true);
    setQueueMessage('Flushing queue to Google Sheets...');
    try {
      const res = await flushPendingQueue();
      setQueueMessage(`✓ Successfully pushed ${res.processedCount} item(s) (Roundtrip: ${res.newLatencyMs}ms).`);
      if (onRefresh) onRefresh();
    } catch {
      setQueueMessage('Error processing queue.');
    } finally {
      setIsProcessingQueue(false);
      setTimeout(() => setQueueMessage(null), 3000);
    }
  };

  const handleAddSampleQueueItem = () => {
    const sampleTitles = [
      'Updated Installation Status: Bellavista 1000 (ICU Ward)',
      'Recorded Calibration Certificate: Mindray DC-70 Ultrasound',
      'Dispatched 4 Oxygen Concentrators to Jimma Hub',
      'Flagged Anesthesia Machine 9100c for Bio-Medical Inspection'
    ];
    const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
    enqueuePendingItem({
      type: 'STATUS_CHANGE',
      title: randomTitle,
      targetSheet: 'Master Inventory SOH'
    });
    setQueueMessage('✓ Added item to pending sync queue.');
    setTimeout(() => setQueueMessage(null), 2500);
  };

  const handleClearQueue = () => {
    clearPendingQueue();
    setQueueMessage('Queue cleared.');
    setTimeout(() => setQueueMessage(null), 2000);
  };

  const handleRemoveSingleItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dequeuePendingItem(id);
  };

  const staleRegions = regionalStates.filter(r => r.isStale);
  const staleCount = staleRegions.length;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Visual Sync Health Trigger Pill */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-slate-300 ${
          staleCount > 0 && snapshot.isOnline
            ? 'bg-amber-50/90 text-amber-900 border-amber-300'
            : healthConfig.badgeBg
        }`}
        title="Click to view Google Sheets Sync Health, latency analytics, and pending queue manager"
        aria-expanded={isOpen}
      >
        {/* Live Pulse Indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            {isSyncing ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            ) : staleCount > 0 ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            ) : snapshot.healthRating === 'optimal' ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            ) : null}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                staleCount > 0 ? 'bg-amber-500' : healthConfig.dotClass
              } ring-2 ${staleCount > 0 ? 'ring-amber-300/60' : healthConfig.ringClass}`}
            />
          </span>
          <span className="font-bold uppercase tracking-tight text-[10px]">
            Sheets Health:
          </span>
        </div>

        {/* Latency Display */}
        <div className="flex items-center gap-1 font-mono font-bold">
          <Zap className="w-3 h-3 text-cyan-600 shrink-0" />
          <span>{snapshot.lastSyncLatencyMs} ms</span>
        </div>

        {/* Separator */}
        <span className="text-slate-300 font-normal">|</span>

        {/* Pending Items in Queue */}
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="font-medium text-slate-600">Queue:</span>
          <span
            className={`font-mono font-bold px-1.5 py-0.2 rounded-md text-[10px] ${
              snapshot.pendingCount > 0
                ? 'bg-amber-200 text-amber-900 border border-amber-300 font-extrabold'
                : 'bg-white/80 text-slate-700 border border-slate-200'
            }`}
          >
            {snapshot.pendingCount}
          </span>
        </div>

        {/* Stale Regions Alert Badge */}
        {staleCount > 0 && (
          <>
            <span className="text-slate-300 font-normal">|</span>
            <div className="flex items-center gap-1 bg-amber-100 text-amber-950 px-2 py-0.5 rounded-lg text-[9px] font-black border border-amber-300 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{staleCount} STALE NODE{staleCount > 1 ? 'S' : ''}</span>
            </div>
          </>
        )}

        {/* Dropdown Chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-0.5 ${
            isOpen ? 'rotate-180 text-slate-700' : 'group-hover:text-slate-700'
          }`}
        />
      </button>

      {/* Interactive Sync Health & Queue Inspector Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[340px] sm:w-[420px] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5 leading-tight">
                  <span>Google Sheets Sync Health</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700">
                    {healthConfig.label}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time synchronization latency & offline pending queue
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* KPI Analytics Strip */}
          <div className="p-3.5 grid grid-cols-3 gap-2 bg-slate-50 border-b border-slate-100">
            {/* Latency Card */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-600" />
                <span>Round-Trip</span>
              </div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {snapshot.lastSyncLatencyMs}{' '}
                <span className="text-[10px] font-medium text-slate-500">ms</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {snapshot.healthRating === 'optimal'
                  ? '⚡ Fast (<400ms)'
                  : snapshot.healthRating === 'normal'
                  ? 'Standard Speed'
                  : 'High latency'}
              </div>
            </div>

            {/* Pending Queue Count Card */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>Pending Queue</span>
              </div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {snapshot.pendingCount}{' '}
                <span className="text-[10px] font-medium text-slate-500">items</span>
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                {snapshot.pendingCount > 0 ? 'Awaiting push' : 'Fully in-sync'}
              </div>
            </div>

            {/* Google Quota / Safety Card */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Google Quota</span>
              </div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {snapshot.quotaCooldownSeconds > 0 ? (
                  <span className="text-amber-600">{snapshot.quotaCooldownSeconds}s</span>
                ) : (
                  <span className="text-emerald-700">60/min Safe</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                {snapshot.quotaCooldownSeconds > 0 ? 'Cooldown active' : '1 request batch'}
              </div>
            </div>
          </div>

          {/* Sync Metadata Details */}
          <div className="px-3.5 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Last synced at <strong className="text-slate-800">{snapshot.lastSyncFormatted}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-600" />
              <span className="font-medium text-slate-600">IndexedDB Synced</span>
            </div>
          </div>

          {/* Regional Sync Status & 48H Stale Alerts */}
          <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Regional Hub Sync (48h Threshold)
              </span>
              {staleCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {staleCount} Node{staleCount > 1 ? 's' : ''} Stale
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  All Nodes Healthy
                </span>
              )}
            </div>

            {/* List of Stale Regions with interactive sync buttons */}
            {staleCount > 0 && (
              <div className="space-y-1.5 mb-2">
                {staleRegions.map((r) => (
                  <div
                    key={r.region}
                    className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-[11px] text-amber-950 transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-extrabold">{r.region}</span>
                        <span className="text-[10px] text-amber-700 ml-1.5 font-semibold">
                          Offline for {r.hoursSinceLastSync} hrs
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        syncRegionNow(r.region);
                        setQueueMessage(`✓ Synchronized ${r.region} regional data nodes.`);
                        setTimeout(() => setQueueMessage(null), 3000);
                      }}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] rounded-md transition shadow-2xs cursor-pointer flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>Sync Node</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Region Selector for detailed state overview */}
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pt-1">
              {regionalStates.map((r) => (
                <div
                  key={r.region}
                  className={`p-1.5 rounded-lg border flex items-center justify-between text-[10px] ${
                    r.isStale
                      ? 'bg-rose-50 border-rose-200 text-rose-950'
                      : 'bg-white border-slate-100 text-slate-700'
                  }`}
                >
                  <span className="font-bold truncate max-w-[85px]" title={r.region}>
                    {r.region}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono font-bold ${r.isStale ? 'text-rose-600' : 'text-slate-400'}`}>
                      {r.hoursSinceLastSync}h
                    </span>
                    {!r.isStale ? (
                      <button
                        type="button"
                        onClick={() => {
                          syncRegionNow(r.region);
                        }}
                        className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        title={`Force sync ${r.region}`}
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback Message Banner */}
          {queueMessage && (
            <div className="px-3.5 py-2 bg-emerald-50 text-emerald-800 text-xs font-semibold border-b border-emerald-100 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{queueMessage}</span>
            </div>
          )}

          {/* Pending Items in Queue Section */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Queue Items ({snapshot.pendingCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddSampleQueueItem}
                  className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Queue a sample status edit to verify queue persistence"
                >
                  <Plus className="w-3 h-3" />
                  <span>Queue Test Item</span>
                </button>
                {snapshot.pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                    title="Clear queue without pushing"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Queue Item List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {snapshot.pendingCount === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center text-slate-500 space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700 text-xs">
                    All Items Synchronized
                  </p>
                  <p className="text-[11px] text-slate-400">
                    No pending mutations in the queue. Changes made offline or in the field will queue here automatically.
                  </p>
                </div>
              ) : (
                snapshot.pendingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                          {item.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Target Tab: {item.targetSheet || 'Master Inventory SOH'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSingleItem(item.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer shrink-0"
                      title="Remove from queue"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => {
                if (onRefresh) onRefresh();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-cyan-800 bg-cyan-100/70 hover:bg-cyan-100 border border-cyan-300 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Sheets...' : 'Sync All Sheets'}</span>
            </button>

            {snapshot.pendingCount > 0 ? (
              <button
                type="button"
                disabled={isProcessingQueue}
                onClick={handleFlushQueue}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl text-white bg-indigo-700 hover:bg-indigo-800 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isProcessingQueue ? 'Pushing Queue...' : 'Push Queue Now'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Queue Clean &bull; Quota Protected
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
