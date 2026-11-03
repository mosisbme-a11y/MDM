import React, { useState } from 'react';
import {
  Printer,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Info,
  Maximize2,
  Monitor,
  Eye
} from 'lucide-react';
import { InventorySummary, MedicalDeviceItem, AuthUser, PrintReportConfig } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface PrintLandscapeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config?: PrintReportConfig) => void;
  summary: InventorySummary;
  items: MedicalDeviceItem[];
  currentUser?: AuthUser | null;
  spreadsheetTitle?: string;
}

export const PrintLandscapeConfirmModal: React.FC<PrintLandscapeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  summary,
  items,
  currentUser,
  spreadsheetTitle
}) => {
  if (!isOpen) return null;

  const [confirmedOrientation, setConfirmedOrientation] = useState(true);
  const [rememberPreference, setRememberPreference] = useState(false);
  
  // Quick pre-configuration of sections
  const [includeValuation, setIncludeValuation] = useState(true);
  const [includeOperationalStatus, setIncludeOperationalStatus] = useState(true);
  const [includeInstallationStatus, setIncludeInstallationStatus] = useState(true);
  const [includeRegionalHubs, setIncludeRegionalHubs] = useState(true);
  const [includeFundingSource, setIncludeFundingSource] = useState(true);
  const [showConfigOptions, setShowConfigOptions] = useState(false);

  const totalItemsCount = summary.totalItemsCount || items.length || 0;
  const totalQuantity = summary.totalQuantity || items.reduce((acc, i) => acc + (Number(i.qty) || 1), 0);
  const totalValuation = summary.totalValuationETB || items.reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0);
  const activePlantsCount = summary.plantCount || Array.from(new Set(items.map(i => i.plant || 'Central'))).length || 21;

  const handleProceed = () => {
    if (rememberPreference) {
      try {
        sessionStorage.setItem('epss_skip_print_confirm', 'true');
      } catch {}
    }
    onConfirm({
      includeValuation,
      includeOperationalStatus,
      includeInstallationStatus,
      includeRegionalHubs,
      includeFundingSource
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto transform transition-all">
        
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 border-b border-slate-700/80 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner shrink-0">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Printer Settings Verification
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Compass className="w-3 h-3 text-amber-400" />
                    Landscape Required
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white mt-1 uppercase tracking-tight">
                  Landscape Print Configuration Check
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ensure printer orientation is configured for multi-column inventory datasets
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto max-h-[72vh] space-y-5 text-slate-800">
          
          {/* Real-time Dataset Scope Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-cyan-700" />
                Active Dataset Scope & Dimensions
              </span>
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                {currentUser?.name || 'mosisbme@gmail.com'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Line Items</span>
                <span className="text-sm sm:text-base font-black text-slate-900 font-mono">
                  {formatNumber(totalItemsCount)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Master records</span>
              </div>
              
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Units</span>
                <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">
                  {formatNumber(totalQuantity)}
                </span>
                <span className="text-[9px] text-emerald-600 block mt-0.5">Physical equipment</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Valuation</span>
                <span className="text-sm sm:text-base font-black text-cyan-800 font-mono">
                  {formatCurrency(totalValuation, true)}
                </span>
                <span className="text-[9px] text-cyan-600 block mt-0.5">National stock</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Columns / Warehouses</span>
                <span className="text-sm sm:text-base font-black text-purple-800 font-mono">
                  14 Cols • {activePlantsCount} Hubs
                </span>
                <span className="text-[9px] text-purple-600 block mt-0.5">Wide structure</span>
              </div>
            </div>
          </div>

          {/* Side-by-Side Visual Orientation Guide */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Orientation Layout Comparison
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Portrait (Restricted) */}
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-rose-800 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <X className="w-4 h-4 text-rose-600" />
                      Portrait Mode (210 mm)
                    </span>
                    <span className="text-[10px] bg-rose-200 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                      Not Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-1.5 leading-relaxed">
                    Inventory tables with 14 columns (such as SAP item codes, plant codes, serial numbers, and WBS grants) will be <strong>compressed or clipped</strong>.
                  </p>
                </div>

                <div className="mt-3 bg-white p-2 rounded-lg border border-rose-200 text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1.5">
                  <div className="w-8 h-11 bg-rose-100 border border-rose-300 rounded-sm flex items-center justify-center text-[8px] text-rose-700 font-bold">
                    210 mm
                  </div>
                  <span>Columns Truncated ✂️</span>
                </div>
              </div>

              {/* Landscape (Recommended) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border-2 border-emerald-400/80 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between text-emerald-900 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Landscape Mode (297 mm)
                    </span>
                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">
                      Optimal & Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-1.5 leading-relaxed">
                    Full 297mm width allows <strong>all 14 inventory columns, KPI summary cards, hub valuations, and installation badges</strong> to render cleanly across pages.
                  </p>
                </div>

                <div className="mt-3 bg-white p-2 rounded-lg border border-emerald-300 text-[10px] text-slate-600 font-mono flex items-center justify-center gap-1.5">
                  <div className="w-12 h-8 bg-emerald-100 border border-emerald-400 rounded-sm flex items-center justify-center text-[8px] text-emerald-800 font-bold">
                    297 mm
                  </div>
                  <span className="text-emerald-800 font-bold">✓ Full 14 Columns Fit</span>
                </div>
              </div>

            </div>
          </div>

          {/* 4-Step Printer Settings Checklist */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                Browser & Printer Setup Checklist
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Browser Print Dialog (Ctrl + P)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-start gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="w-5 h-5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-bold text-white block text-[11px]">Orientation: Landscape</span>
                  <p className="text-[10px] text-slate-300 mt-0.5">Select <strong>Landscape</strong> in your browser print window.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="w-5 h-5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-bold text-white block text-[11px]">Paper Size: A4 / Letter</span>
                  <p className="text-[10px] text-slate-300 mt-0.5">Standard A4 (210×297mm) or US Letter format.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="w-5 h-5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-bold text-white block text-[11px]">Enable Background Graphics</span>
                  <p className="text-[10px] text-slate-300 mt-0.5">Check <strong>"Background graphics"</strong> so KPI badges and colors print.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="w-5 h-5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <span className="font-bold text-white block text-[11px]">Scale: Fit to Page Width</span>
                  <p className="text-[10px] text-slate-300 mt-0.5">Set Scale to <strong>Default / 90%-100%</strong> with Minimum Margins.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Section Selection Toggle */}
          <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowConfigOptions(!showConfigOptions)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer select-none"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-cyan-700" />
                Customize Report Sections to Include
              </span>
              <span className="text-[11px] text-cyan-700 hover:underline">
                {showConfigOptions ? 'Hide Options ▲' : 'Show Section Toggles ▼'}
              </span>
            </button>

            {showConfigOptions && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeValuation}
                    onChange={(e) => setIncludeValuation(e.target.checked)}
                    className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                  />
                  <span>Total Valuation</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeOperationalStatus}
                    onChange={(e) => setIncludeOperationalStatus(e.target.checked)}
                    className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                  />
                  <span>Operational Status</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeInstallationStatus}
                    onChange={(e) => setIncludeInstallationStatus(e.target.checked)}
                    className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                  />
                  <span>Installation Stages</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeRegionalHubs}
                    onChange={(e) => setIncludeRegionalHubs(e.target.checked)}
                    className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                  />
                  <span>Regional Hubs</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeFundingSource}
                    onChange={(e) => setIncludeFundingSource(e.target.checked)}
                    className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                  />
                  <span>Funding Sources</span>
                </label>
              </div>
            )}
          </div>

          {/* User Confirmation Checkbox */}
          <div className="p-3 bg-cyan-50/60 rounded-2xl border border-cyan-200 flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedOrientation}
                onChange={(e) => setConfirmedOrientation(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-700 border-cyan-400 focus:ring-cyan-500 cursor-pointer accent-cyan-700"
              />
              <span className="text-xs font-bold text-slate-800">
                I understand and confirm printer orientation should be set to <u>Landscape</u> for proper formatting.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberPreference}
                onChange={(e) => setRememberPreference(e.target.checked)}
                className="rounded text-slate-600 border-slate-300 focus:ring-slate-500 cursor-pointer"
              />
              <span>Don't show this orientation confirmation again for this browser session</span>
            </label>
          </div>

        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition cursor-pointer"
          >
            Cancel & Return
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={!confirmedOrientation}
              onClick={handleProceed}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition cursor-pointer ${
                confirmedOrientation
                  ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 active:scale-98'
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Proceed to Print Report Modal</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
