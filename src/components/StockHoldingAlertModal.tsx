import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  X,
  Clock,
  Download,
  Calendar,
  Building2,
  Warehouse,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Copy,
  Check,
  Bell,
  Search,
  Mail,
  ExternalLink
} from 'lucide-react';
import { ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { calculateStockHoldingDays } from '../data/defaultReceivingData';

export interface StockHoldingAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertRecords: ReceivingDataRecord[];
  totalRecordsCount: number;
  alertThresholdDays: number;
  onUpdateThreshold: (days: number) => void;
  onSelectItem?: (item: ReceivingDataRecord) => void;
  onExportAlerts: () => void;
}

export const StockHoldingAlertModal: React.FC<StockHoldingAlertModalProps> = ({
  isOpen,
  onClose,
  alertRecords,
  totalRecordsCount,
  alertThresholdDays,
  onUpdateThreshold,
  onSelectItem,
  onExportAlerts
}) => {
  const [modalSearch, setModalSearch] = useState('');
  const [modalPlantFilter, setModalPlantFilter] = useState('all');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [desktopNotifyStatus, setDesktopNotifyStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalAlertValuation = alertRecords.reduce((sum, r) => sum + (r.amtInLocCur || 0), 0);
  const totalAlertUnits = alertRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);

  // Calculate max days held and average days held
  let maxDaysHeld = 0;
  let sumDaysHeld = 0;
  alertRecords.forEach((r) => {
    const d = calculateStockHoldingDays(r.postingDate || r.entryDate, r) || 0;
    if (d > maxDaysHeld) maxDaysHeld = d;
    sumDaysHeld += d;
  });
  const avgDaysHeld = alertRecords.length > 0 ? Math.round(sumDaysHeld / alertRecords.length) : 0;

  // Breakdown by plant
  const plantBreakdown = alertRecords.reduce((acc, r) => {
    const p = r.plant || 'Unspecified';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniquePlants = Object.keys(plantBreakdown).sort();

  // Filtered rows for the modal table
  const displayedAlertRecords = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    return alertRecords.filter((r) => {
      const matchPlant = modalPlantFilter === 'all' || r.plant === modalPlantFilter;
      const matchQuery =
        !q ||
        r.purchaseOrder?.toLowerCase().includes(q) ||
        r.material?.toLowerCase().includes(q) ||
        r.materialDescription?.toLowerCase().includes(q) ||
        r.batch?.toLowerCase().includes(q) ||
        r.storageLocation?.toLowerCase().includes(q);
      return matchPlant && matchQuery;
    });
  }, [alertRecords, modalSearch, modalPlantFilter]);

  const thresholdPresets = [30, 60, 90, 120, 180];

  // Automated notification generator: formatted escalation text for QA and Warehouse distribution
  const handleCopyEscalationNotice = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const top5Items = alertRecords.slice(0, 5).map((r, i) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r) || 0;
      return `  ${i + 1}. PO: ${r.purchaseOrder} | Material: ${r.material} - ${r.materialDescription} | Batch: ${r.batch || 'N/A'} | Plant: ${r.plant} | SLoc: ${r.storageLocation} | Posting Date: ${r.postingDate || 'N/A'} | Holding Days: ${days} days (+${days - alertThresholdDays}d over threshold) | Valuation: ETB ${r.amtInLocCur?.toLocaleString() || 0}`;
    }).join('\n');

    const noticeText = [
      `=============================================================`,
      `EPSS INVENTORY STOCK HOLDING ALERT & ESCALATION NOTICE`,
      `Generated: ${todayStr} | SLA Threshold: ${alertThresholdDays} Calendar Days`,
      `=============================================================`,
      `TOTAL CONSIGNMENTS EXCEEDING THRESHOLD: ${alertRecords.length} consignments`,
      `TOTAL VALUATION AT RISK: ETB ${totalAlertValuation.toLocaleString()}`,
      `TOTAL QUANTITY IN DELAY: ${totalAlertUnits.toLocaleString()} units`,
      `MAXIMUM DURATION HELD: ${maxDaysHeld} days (Average: ${avgDaysHeld} days)`,
      `AFFECTED HUBS / PLANTS: ${Object.entries(plantBreakdown).map(([p, c]) => `${p} (${c})`).join(', ')}`,
      ``,
      `SAMPLE CRITICAL CONSIGNMENTS:`,
      top5Items,
      alertRecords.length > 5 ? `  ... and ${alertRecords.length - 5} more consignments exceeding ${alertThresholdDays} days.` : '',
      ``,
      `ACTION REQUIRED:`,
      `1. Warehouse managers to prioritize FIFO/FEFO dispatch for aging stock.`,
      `2. Quality Assurance inspection for lots held > ${alertThresholdDays} days.`,
      `3. Expedite transfer to regional health facilities or demand hubs.`,
      `=============================================================`
    ].filter(Boolean).join('\n');

    try {
      navigator.clipboard.writeText(noticeText);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch {
      // Fallback
      alert('Notification text copied to clipboard!');
    }
  };

  // Browser desktop notification trigger
  const handleTriggerDesktopNotification = async () => {
    if (!('Notification' in window)) {
      setDesktopNotifyStatus('Desktop notifications not supported in this browser.');
      setTimeout(() => setDesktopNotifyStatus(null), 3500);
      return;
    }

    try {
      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        new Notification('🚨 EPSS Stock Holding Alert Triggered', {
          body: `${alertRecords.length} receiving consignments have exceeded the ${alertThresholdDays}-day threshold! Total value: ETB ${totalAlertValuation.toLocaleString()}.`,
          icon: '/favicon.ico'
        });
        setDesktopNotifyStatus('✓ Desktop notification dispatched successfully!');
      } else {
        setDesktopNotifyStatus('Desktop notifications permission denied in browser.');
      }
    } catch (e) {
      setDesktopNotifyStatus('Could not trigger desktop notification.');
    }
    setTimeout(() => setDesktopNotifyStatus(null), 3500);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-rose-200 bg-linear-to-r from-rose-50 via-rose-100/60 to-white flex items-center justify-between">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md animate-pulse shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-rose-950 tracking-tight">
                  Stock Holding Days Automated Alert Center
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase font-mono tracking-wider shadow-2xs">
                  {alertRecords.length} Consignments Exceeding {alertThresholdDays}d Limit
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200/80 text-rose-900 font-mono">
                  Auto-updated {new Date().toISOString().split('T')[0]}
                </span>
              </div>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                Automated alert highlights goods receipts held longer than the {alertThresholdDays}-day threshold with notification triggers and escalation workflows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Close Alert Center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Threshold Adjustment Card & Notification Action Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-rose-600" />
                <span>Adjust Alert Threshold (Currently: {alertThresholdDays} Days):</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Consignments held past this limit are highlighted in red and trigger automated notifications
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-semibold mr-1">Preset Limits:</span>
              {thresholdPresets.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onUpdateThreshold(days)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer font-mono ${
                    alertThresholdDays === days
                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {days} Days {days === 90 ? '(Standard)' : ''}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs">
                <span className="text-slate-400 text-[11px]">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={alertThresholdDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) onUpdateThreshold(val);
                  }}
                  className="w-14 font-mono font-bold text-slate-800 text-xs text-center focus:outline-hidden"
                />
                <span className="text-slate-400 text-[10px]">days</span>
              </div>
            </div>
          </div>

          {/* Quick Notification Trigger Actions Banner */}
          <div className="bg-linear-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Automated Escalation & Notification Triggers
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Notify warehouse dispatchers and QA officers about {alertRecords.length} aging batches
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyEscalationNotice}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  copiedNotice
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300'
                }`}
                title="Copy structured stock aging memo to clipboard"
              >
                {copiedNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedNotice ? 'Memo Copied!' : 'Copy Escalation Notice'}</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerDesktopNotification}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Trigger a desktop OS notification"
              >
                <Bell className="w-3.5 h-3.5 text-rose-600" />
                <span>Test Desktop Alert</span>
              </button>

              <button
                type="button"
                onClick={onExportAlerts}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Export dedicated CSV of alert items"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Alert CSV</span>
              </button>
            </div>
          </div>

          {desktopNotifyStatus && (
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white font-mono flex items-center justify-between">
              <span>{desktopNotifyStatus}</span>
              <button onClick={() => setDesktopNotifyStatus(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* KPI Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-rose-50/80 border border-rose-300 p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Alert Batches</span>
              </div>
              <div className="text-xl font-black text-rose-950 font-mono mt-0.5">
                {alertRecords.length}
                <span className="text-[11px] font-normal text-rose-700 ml-1">
                  ({totalRecordsCount > 0 ? ((alertRecords.length / totalRecordsCount) * 100).toFixed(1) : 0}% of ledger)
                </span>
              </div>
              <div className="text-[10px] text-rose-800 mt-0.5 font-medium">
                Exceeding {alertThresholdDays} days
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600" />
                <span>Valuation at Risk</span>
              </div>
              <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                {formatCurrency(totalAlertValuation)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Total ETB tied up in aging stock
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Package className="w-3 h-3 text-purple-600" />
                <span>Units in Alert</span>
              </div>
              <div className="text-xl font-black text-purple-800 font-mono mt-0.5">
                {formatNumber(totalAlertUnits)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Total physical items affected
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Max / Avg Days Held</span>
              </div>
              <div className="text-lg font-black text-amber-700 font-mono mt-0.5">
                {maxDaysHeld}d <span className="text-xs font-normal text-slate-500">/ {avgDaysHeld}d avg</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Oldest batch held for {maxDaysHeld} days
              </div>
            </div>
          </div>

          {/* Plant Distribution Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Affected Plants ({uniquePlants.length}):</span>
            </span>
            {uniquePlants.map((plant) => (
              <button
                key={plant}
                type="button"
                onClick={() => setModalPlantFilter(modalPlantFilter === plant ? 'all' : plant)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                  modalPlantFilter === plant
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-900 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                <span>{plant}: {plantBreakdown[plant]}</span>
              </button>
            ))}
            {modalPlantFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setModalPlantFilter('all')}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
              >
                Show all plants
              </button>
            )}
          </div>

          {/* Table Search & Filter Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alert items by PO, Material, Description, Batch, SLoc..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-rose-400"
              />
              {modalSearch && (
                <button
                  onClick={() => setModalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Showing <strong>{displayedAlertRecords.length}</strong> of {alertRecords.length} alert consignments
            </div>
          </div>

          {/* Table of Alert Items with Red Highlighting */}
          <div className="border-2 border-rose-300 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 py-2.5 bg-rose-100/70 border-b border-rose-200 flex items-center justify-between">
              <span className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Critical Consignments Exceeding {alertThresholdDays} Days Limit</span>
              </span>
              <span className="text-[11px] font-bold text-rose-800 font-mono">
                Highlighted in Red | Click row to inspect
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 border-x border-slate-200 text-center">#</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 whitespace-nowrap">Purchase Order</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 whitespace-nowrap">Material</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 min-w-[200px]">Description</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 whitespace-nowrap">Batch</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 text-center whitespace-nowrap">Plant / SLoc</th>
                    <th className="py-2.5 px-3 border-x border-slate-200 text-center whitespace-nowrap">Posting Date</th>
                    {/* Stock Holding Days highlighted in red */}
                    <th className="py-2.5 px-3 border-x border-rose-300 text-center whitespace-nowrap bg-rose-200/90 text-rose-950 font-black">
                      Stock Holding Days (Over Limit)
                    </th>
                    <th className="py-2.5 px-3 border-x border-slate-200 text-right whitespace-nowrap">Amt. in Loc. Cur.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 text-[11px] bg-white">
                  {displayedAlertRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                        No alert records matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedAlertRecords.map((r, idx) => {
                      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r) || 0;
                      const daysOver = days - alertThresholdDays;
                      return (
                        <tr
                          key={r.id || idx}
                          onClick={() => {
                            onSelectItem?.(r);
                            onClose();
                          }}
                          className="hover:bg-rose-100/70 transition cursor-pointer bg-rose-50/40"
                          title="Click to view full record details"
                        >
                          <td className="py-2 px-3 border-x border-slate-200 text-center text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="py-2 px-3 border-x border-slate-200 whitespace-nowrap font-bold text-teal-700">{r.purchaseOrder}</td>
                          <td className="py-2 px-3 border-x border-slate-200 whitespace-nowrap font-bold text-slate-900">{r.material}</td>
                          <td className="py-2 px-3 border-x border-slate-200 font-sans max-w-xs truncate text-slate-800 font-medium" title={r.materialDescription}>
                            {r.materialDescription}
                          </td>
                          <td className="py-2 px-3 border-x border-slate-200 whitespace-nowrap text-slate-600">{r.batch || '-'}</td>
                          <td className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap text-slate-700">
                            {r.plant} • {r.storageLocation}
                          </td>
                          <td className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap text-slate-700">
                            {r.postingDate || '-'}
                          </td>
                          {/* Stock Holding Days Cell in Red */}
                          <td className="py-2 px-3 border-x border-rose-300 text-center whitespace-nowrap bg-rose-100/80">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-200 text-rose-950 border border-rose-400 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse" />
                              <span>{days} Days</span>
                              <span className="text-[10px] font-bold text-rose-800 font-sans">
                                (+{daysOver}d over limit)
                              </span>
                            </span>
                          </td>
                          <td className="py-2 px-3 border-x border-slate-200 text-right whitespace-nowrap font-bold text-emerald-600">
                            {formatCurrency(r.amtInLocCur)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Threshold set to <strong className="text-slate-800">{alertThresholdDays} days</strong>. Stock holding days auto-update dynamically each calendar day.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyEscalationNotice}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>Copy Escalation Notice</span>
            </button>
            <button
              type="button"
              onClick={onExportAlerts}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>Download Alert CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
            >
              Close Alert Center
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
