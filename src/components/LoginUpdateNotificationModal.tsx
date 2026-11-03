import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Database,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock,
  UserCheck,
  FileSpreadsheet,
  Truck,
  Building2,
  Boxes
} from 'lucide-react';
import { EPSSLogo } from './EPSSLogo';
import { CentralSyncStatus } from '../utils/centralSyncService';

interface LoginUpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: CentralSyncStatus | null;
  onRefreshData?: () => Promise<void>;
  isRefreshing?: boolean;
  userName?: string;
}

export const LoginUpdateNotificationModal: React.FC<LoginUpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onRefreshData,
  isRefreshing = false,
  userName = 'Authorized User'
}) => {
  if (!isOpen) return null;

  const formattedDate = syncStatus?.lastUpdated
    ? new Date(syncStatus.lastUpdated).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Live Synchronized';

  const counts = syncStatus?.counts || {
    items: 0,
    multipleStock: 0,
    receiving: 0,
    distribution: 0,
    materialMaster: 0,
    hfList: 0
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 px-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white rounded-lg shadow-xs">
                <EPSSLogo size="sm" variant="mark-only" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
                  EPSS Central System Link
                </span>
                <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>Master Data Synchronized</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                    Live Multi-Browser Sync
                  </span>
                </h3>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[10px] text-blue-200">Central Version</span>
              <span className="font-mono font-bold text-xs bg-blue-900/60 px-2 py-0.5 rounded border border-blue-400/30">
                v{syncStatus?.version || 1}.0
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Welcome User Notification Callout */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-blue-950">
                Welcome back, {userName}!
              </div>
              <p className="text-blue-800/90 mt-0.5 leading-relaxed">
                Your browser session is now connected directly to the EPSS central repository. 
                Any updates, additions, or edits made here or on any other computer/browser are synchronized in real-time.
              </p>
            </div>
          </div>

          {/* Sync Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-[11px] uppercase tracking-wide">Last Central Update</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {formattedDate}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                Type: {syncStatus?.updateKind || 'Central Data Sync'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-[11px] uppercase tracking-wide">Published By</span>
              </div>
              <div className="font-bold text-slate-900 text-sm truncate">
                {syncStatus?.lastUpdatedBy || 'Inventory Administrator'}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Identical across all browsers</span>
              </div>
            </div>
          </div>

          {/* Active Central Records Breakdown */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Synchronized Master Records in Central Store:</span>
              <span className="text-blue-600 font-semibold lowercase">no browser variance</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Master Devices</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.items}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Stock Ledger</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.multipleStock}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Goods Receipt (GR)</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.receiving}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Distribution (POD)</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.distribution}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Health Facilities</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.hfList}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Material Master</div>
                  <div className="font-bold text-slate-900 text-sm">{counts.materialMaster}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          {onRefreshData ? (
            <button
              type="button"
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Re-Syncing...' : 'Force Re-Sync Central Data'}</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition cursor-pointer hover:translate-y-[-0.5px]"
          >
            <span>Acknowledge & Access Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
