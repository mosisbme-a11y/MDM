import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileDown,
  X,
  Package,
  CircleDollarSign,
  Building2,
  AlertCircle,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { InventorySummary, MedicalDeviceItem, AuthUser, PrintReportConfig } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { EPSSLogo } from './EPSSLogo';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: InventorySummary;
  items: MedicalDeviceItem[];
  currentUser?: AuthUser | null;
  spreadsheetTitle?: string;
  initialConfig?: PrintReportConfig;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  items,
  currentUser,
  spreadsheetTitle,
  initialConfig
}) => {
  if (!isOpen) return null;

  const [includeValuation, setIncludeValuation] = useState(initialConfig?.includeValuation ?? true);
  const [includeOperationalStatus, setIncludeOperationalStatus] = useState(initialConfig?.includeOperationalStatus ?? true);
  const [includeInstallationStatus, setIncludeInstallationStatus] = useState(initialConfig?.includeInstallationStatus ?? true);
  const [includeRegionalHubs, setIncludeRegionalHubs] = useState(initialConfig?.includeRegionalHubs ?? true);
  const [includeFundingSource, setIncludeFundingSource] = useState(initialConfig?.includeFundingSource ?? true);
  const [includeSelectedStats, setIncludeSelectedStats] = useState(true);

  const selectedStats = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        totalUnits: acc.totalUnits + (item.unrestrictedStock || 0),
        totalValuation: acc.totalValuation + (item.currentValueOfUnrestrictedStock || 0),
        count: acc.count + 1,
      }),
      { totalUnits: 0, totalValuation: 0, count: 0 }
    );
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  const functionalCount = summary.statusSummary?.functional ?? 0;
  const defectiveCount = summary.statusSummary?.defective ?? 0;
  const needsSpareCount = summary.statusSummary?.needsSpare ?? 0;
  const nonMovingCount = summary.statusSummary?.nonMoving ?? 0;
  const totalQty = summary.totalQuantity || 1;

  // Compute top hubs
  const topHubs = [...(summary.plants || [])]
    .map((h: any) => ({
      plant: h.plant || h.code || 'HUB',
      name: h.name || h.code || 'EPSS Hub',
      totalAmount: Number(h.totalAmount ?? h.value ?? 0),
      totalQty: Number(h.totalQty ?? h.qty ?? 0),
      itemsCount: Number(h.itemsCount ?? 0)
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  // Compute installation status metrics
  const installationMetrics = summary.installationStatusMetrics || {
    'Installed': { units: 0, lineItems: 0, valuation: 0 },
    'Not Installed': { units: 0, lineItems: 0, valuation: 0 },
    'Pending Installation': { units: 0, lineItems: 0, valuation: 0 },
    'Under Commissioning': { units: 0, lineItems: 0, valuation: 0 },
    'Site Assessment': { units: 0, lineItems: 0, valuation: 0 }
  };

  const reportDate = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  // Reset section counter inside render flow to dynamically assign numbers to active sections
  let sectionCounter = 1;
  const getSectionNumber = (included: boolean) => {
    if (!included) return '';
    return `${sectionCounter++}. `;
  };

  const activeCardsCount = 
    1 + 
    (includeValuation ? 1 : 0) + 
    (includeRegionalHubs ? 1 : 0) + 
    (includeOperationalStatus ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Global CSS style override for paper print */}
      <style>{`
        @page {
          size: landscape;
          margin: 10mm 10mm 10mm 10mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-summary-report, #printable-summary-report * {
            visibility: visible !important;
          }
          #printable-summary-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Action Header (Screen only) */}
        <div className="no-print bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Print Inventory Executive Report
                </h2>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                  Landscape Configured (A4/Letter)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Formatted printer-friendly summary page with live valuation & distribution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report Now</span>
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition cursor-pointer shadow-sm"
              title="Export all dashboard charts and summary tables into a single offline PDF document"
            >
              <FileDown className="w-4 h-4" />
              <span>Export PDF Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Customization Options Panel (Screen only, excluded from print) */}
        <div className="no-print bg-slate-50 border-b border-slate-200 px-8 py-3.5 shrink-0 select-none">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Configure Report Sections & Metrics
              </span>
              <span className="text-[10px] text-slate-500 italic font-medium">
                Uncheck to exclude metric sections from final printed / exported PDF report
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeValuation}
                  onChange={(e) => setIncludeValuation(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Total Asset Valuation</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOperationalStatus}
                  onChange={(e) => setIncludeOperationalStatus(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Operational & Defect Status</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInstallationStatus}
                  onChange={(e) => setIncludeInstallationStatus(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Installation Stage Breakdown</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRegionalHubs}
                  onChange={(e) => setIncludeRegionalHubs(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Regional Hubs & Warehouses</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFundingSource}
                  onChange={(e) => setIncludeFundingSource(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Funding Sources (WBS/Grants)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSelectedStats}
                  onChange={(e) => setIncludeSelectedStats(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 border-slate-300 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <span>Selected Items Summary</span>
              </label>
            </div>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 overflow-y-auto space-y-6" id="printable-summary-report">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-300 shrink-0">
                <EPSSLogo size="md" variant="mark-only" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                  ETHIOPIAN PHARMACEUTICAL SUPPLY SERVICE (EPSS)
                </h1>
                <h2 className="text-sm font-bold text-cyan-800 uppercase tracking-wide mt-0.5">
                  National Medical Device Inventory Summary Report
                </h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Generated on: <span className="font-semibold text-slate-700">{reportDate}</span>
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right text-[11px] text-slate-600 border-l sm:border-l-0 sm:border-r border-slate-200 pl-3 sm:pl-0 sm:pr-3">
              <p className="font-bold text-slate-900">Official Audit Document</p>
              <p>Prepared by: {currentUser?.name || 'Mosisa Berhanu'}</p>
              <p className="text-[10px] text-slate-500">{currentUser?.role || 'Inventory Administrator'}</p>
              {spreadsheetTitle && (
                <p className="text-[10px] text-cyan-700 font-mono mt-0.5">Source: {spreadsheetTitle}</p>
              )}
            </div>
          </div>

          {/* Selected Report Statistics (Dynamic from selected items) */}
          {includeSelectedStats && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Selected Items Summary</span>
                <span className="text-[10px] font-normal text-slate-500 italic">
                  Calculated from {selectedStats.count} items selected for this report
                </span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition hover:shadow-md">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Units (Unrestricted)</p>
                    <p className="text-xl font-black text-slate-900 font-mono mt-0.5">{formatNumber(selectedStats.totalUnits)}</p>
                    <p className="text-[9px] text-slate-400 font-medium">Sum of all selected line item quantities</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition hover:shadow-md">
                  <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 shrink-0">
                    <CircleDollarSign className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Asset Valuation</p>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-0.5">
                      <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(selectedStats.totalValuation, true)}</p>
                      <p className="text-[10px] text-slate-500 font-mono hidden sm:block">({formatCurrency(selectedStats.totalValuation)})</p>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5 sm:mt-0">Market value of selected unrestricted stock</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Metric Overview Cards */}
          <div className={`grid gap-3 ${
            activeCardsCount === 4 ? 'grid-cols-2 sm:grid-cols-4' :
            activeCardsCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
            activeCardsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Stock Quantity
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {formatNumber(summary.totalQuantity)}
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                {formatNumber(summary.totalItemsCount)} Master Line Items
              </span>
            </div>

            {includeValuation && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Asset Valuation
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                  {formatCurrency(summary.totalValuationETB, true)}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  {formatCurrency(summary.totalValuationETB)}
                </span>
              </div>
            )}

            {includeRegionalHubs && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Regional Hubs
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                  {summary.plantCount || 21} Warehouses
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Central & Branch Facilities
                </span>
              </div>
            )}

            {includeOperationalStatus && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Breakdown Required
                </span>
                <div className="text-xl font-bold text-amber-950 mt-1 font-mono">
                  {summary.noBkdCount || 0} Items
                </div>
                <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">
                  MoH Schedule Pending
                </span>
              </div>
            )}
          </div>

          {/* Operational Status Breakdown */}
          {includeOperationalStatus && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>{getSectionNumber(includeOperationalStatus)}Operational & Stock Status Distribution</span>
                <span className="text-[10px] font-normal text-slate-500">Unit Share & Catalog Lines</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span>Functional / Usable</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-base font-bold font-mono text-emerald-950 mt-1">
                    {formatNumber(functionalCount)} <span className="text-xs font-normal text-emerald-800">units</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    {((functionalCount / totalQty) * 100).toFixed(1)}% of inventory
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <div className="flex items-center justify-between font-bold text-rose-900">
                    <span>Defective / Faulty</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <div className="text-base font-bold font-mono text-rose-950 mt-1">
                    {formatNumber(defectiveCount)} <span className="text-xs font-normal text-rose-800">units</span>
                  </div>
                  <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                    {((defectiveCount / totalQty) * 100).toFixed(1)}% of inventory
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center justify-between font-bold text-purple-900">
                    <span>Needs Spare Parts</span>
                    <Wrench className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-base font-bold font-mono text-purple-950 mt-1">
                    {formatNumber(needsSpareCount)} <span className="text-xs font-normal text-purple-800">units</span>
                  </div>
                  <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                    {((needsSpareCount / totalQty) * 100).toFixed(1)}% of inventory
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>Non-Moving Stock</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-base font-bold font-mono text-amber-950 mt-1">
                    {formatNumber(nonMovingCount)} <span className="text-xs font-normal text-amber-800">units</span>
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                    {((nonMovingCount / totalQty) * 100).toFixed(1)}% of inventory
                  </div>
                </div>
              </div>

              {/* Visual Distribution Bar */}
              <div className="pt-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Visual Operational Share
                </span>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${(functionalCount / totalQty) * 100}%` }}
                    title={`Functional: ${((functionalCount / totalQty) * 100).toFixed(1)}%`}
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{ width: `${(defectiveCount / totalQty) * 100}%` }}
                    title={`Defective: ${((defectiveCount / totalQty) * 100).toFixed(1)}%`}
                  />
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${(needsSpareCount / totalQty) * 100}%` }}
                    title={`Needs Spare: ${((needsSpareCount / totalQty) * 100).toFixed(1)}%`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${(nonMovingCount / totalQty) * 100}%` }}
                    title={`Non-Moving: ${((nonMovingCount / totalQty) * 100).toFixed(1)}%`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Installation Status Distribution */}
          {includeInstallationStatus && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                {getSectionNumber(includeInstallationStatus)}Installation Status Breakdown
              </h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] bg-slate-50">
                    <th className="py-2 px-3">Installation Stage</th>
                    <th className="py-2 px-3 text-right">Equipment Units</th>
                    <th className="py-2 px-3 text-right">Line Items</th>
                    <th className="py-2 px-3 text-right">Asset Valuation (ETB)</th>
                    <th className="py-2 px-3 text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {Object.entries(installationMetrics)
                    .filter(([_, m]) => (m.units || 0) > 0 || (m.lineItems || 0) > 0)
                    .map(([stage, m]) => {
                    const pct = Math.round(((m.units || 0) / totalQty) * 100) || 0;
                    return (
                      <tr key={stage} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{stage}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNumber(m.units)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{formatNumber(m.lineItems)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(m.valuation, true)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-cyan-800">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Regional Hubs Breakdown */}
          {includeRegionalHubs && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                {getSectionNumber(includeRegionalHubs)}Top Regional Warehouses & Distribution Hubs
              </h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] bg-slate-50">
                    <th className="py-2 px-3">Hub Code</th>
                    <th className="py-2 px-3">Warehouse Facility Name</th>
                    <th className="py-2 px-3 text-right">Catalog Line Items</th>
                    <th className="py-2 px-3 text-right">Total Units</th>
                    <th className="py-2 px-3 text-right">Total Valuation (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {topHubs.map((hub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold font-mono text-slate-900">{hub.plant}</td>
                      <td className="py-2 px-3">{hub.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{formatNumber(hub.itemsCount)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatNumber(hub.totalQty)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(hub.totalAmount, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Account / Budget Source Breakdown */}
          {includeFundingSource && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                {getSectionNumber(includeFundingSource)}Account / Funding Source Distribution
              </h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] bg-slate-50">
                    <th className="py-2 px-3">WBS Element / Budget Source</th>
                    <th className="py-2 px-3 text-right">Equipment Units</th>
                    <th className="py-2 px-3 text-right">Line Items</th>
                    <th className="py-2 px-3 text-right">Asset Valuation (ETB)</th>
                    <th className="py-2 px-3 text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {Object.entries(summary.accountSummary || {})
                    .sort((a, b) => b[1].valuation - a[1].valuation)
                    .map(([acct, m], idx) => {
                    const pct = Math.round(((m.units || 0) / totalQty) * 100) || 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{acct}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNumber(m.units)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{formatNumber(m.lineItems)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(m.valuation, true)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-cyan-800">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Verification & Sign-off Footer */}
          <div className="border-t-2 border-slate-200 pt-6 mt-8">
            <div className="grid grid-cols-3 gap-6 text-[10px] text-slate-600 text-center">
              <div>
                <p className="font-bold text-slate-900 uppercase mb-8">Prepared By</p>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-semibold text-slate-800">{currentUser?.name || 'Mosisa Berhanu'}</p>
                <p className="text-slate-500">EPSS Inventory Specialist</p>
              </div>

              <div>
                <p className="font-bold text-slate-900 uppercase mb-8">Verified By</p>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-semibold text-slate-800">MoH / EPSS Director</p>
                <p className="text-slate-500">Quality & Audit Assurance</p>
              </div>

              <div>
                <p className="font-bold text-slate-900 uppercase mb-8">Official Stamp & Date</p>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</p>
                <p className="text-slate-500">EPSS Central Repository</p>
              </div>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-6 uppercase tracking-widest">
              End-to-End Medical Device Management System • Confidential Official Document
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
