import React, { useEffect, useRef, useState } from 'react';
import { CloudUpload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SUPABASE_SYNC_EVENT, SupabaseSyncEventDetail } from '../utils/centralSyncService';

/**
 * Small status pill: "Syncing to Supabase..." -> "Synced to Supabase".
 * Driven by events fired from pushCentralMasterData, so every upload/edit shows it.
 */
export const SupabaseSyncBadge: React.FC = () => {
  const [status, setStatus] = useState<SupabaseSyncEventDetail | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<SupabaseSyncEventDetail>).detail;
      if (!detail) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setStatus(detail);
      if (detail.state === 'synced') {
        hideTimer.current = setTimeout(() => setStatus(null), 5000);
      }
    };
    window.addEventListener(SUPABASE_SYNC_EVENT, onEvent);
    return () => {
      window.removeEventListener(SUPABASE_SYNC_EVENT, onEvent);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!status) return null;

  const base =
    'fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold border select-none max-w-sm';

  if (status.state === 'syncing') {
    return (
      <div className={`${base} bg-slate-900 text-cyan-300 border-cyan-500/40`} role="status">
        <div className="relative flex items-center justify-center w-5 h-5">
          <CloudUpload className="w-4 h-4" />
          <div className="absolute inset-0 border-2 border-cyan-400 rounded-full animate-ping opacity-75" />
        </div>
        <div className="flex gap-0.5 overflow-hidden mx-1">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i} 
              className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" 
              style={{ animationDelay: `${i * 0.2}s` }} 
            />
          ))}
        </div>
        <span>
          Syncing to Supabase...{status.pending > 1 ? ` (${status.pending} uploads)` : ''}
        </span>
      </div>
    );
  }

  if (status.state === 'synced') {
    return (
      <div className={`${base} bg-slate-900 text-emerald-300 border-emerald-500/40`} role="status">
        <CheckCircle2 className="w-4 h-4" />
        <span>
          Synced to Supabase{status.version ? ` (v${status.version})` : ''}
        </span>
      </div>
    );
  }

  if (status.state === 'error') {
    const retrying = status.willRetry;
    return (
      <div
        className={`${base} bg-slate-900 ${retrying ? 'text-amber-300 border-amber-500/40' : 'text-red-300 border-red-500/50'} cursor-pointer`}
        role="alert"
        onClick={() => setStatus(null)}
        title="Click to dismiss"
      >
        {retrying ? (
          <CloudUpload className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
        )}
        <div className="flex flex-col">
          <span>
            {retrying
              ? `Sync failed, retrying automatically (attempt ${status.attempt ?? 1})...`
              : 'Sync to Supabase failed. Changes are NOT saved to the server.'}
          </span>
          {status.message && <span className="font-normal opacity-80 break-words">{status.message}</span>}
        </div>
      </div>
    );
  }

  return null;
};
