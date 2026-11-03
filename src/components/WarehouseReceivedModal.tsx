import React, { useState } from 'react';
import {
  Warehouse,
  Calendar,
  Search,
  X,
  FileSpreadsheet,
  Download,
  ExternalLink,
  PackageCheck,
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { MedicalDeviceItem, ReceivingDataRecord } from '../types';
import { formatNumber, formatCurrency, downloadCSV } from '../utils/formatters';
import { calculateStockHoldingDays } from '../data/defaultReceivingData';

interface WarehouseReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: MedicalDeviceItem[];
  receivingRecords?: ReceivingDataRecord[];
  onNavigateToReceivingLedger?: () => void;
  search: string;
  onSearchChange: (s: string) => void;
  poFilter: string;
  onPoChange: (s: string) => void;
  pkgFilter?: string;
  onPkgChange?: (s: string) => void;
  rdfFilter?: string;
  onRdfChange?: (s: string) => void;
  progFilter?: string;
  onProgChange?: (s: string) => void;
  plantFilter?: string;
  onPlantChange?: (s: string) => void;
  supplierFilter?: string;
  onSupplierChange?: (s: string) => void;
  movementFilter?: string;
  onMovementChange?: (s: string) => void;
  poList: string[];
  pkgList?: string[];
  rdfList?: string[];
  progList?: string[];
  plantList?: string[];
  supplierList?: string[];
  movementList?: string[];
  stats: {
    units: number;
    valuation: number;
    lineItems: number;
    percentageUnits: number | string;
    isReceivingData?: boolean;
    supplierCount?: number;
    plantCount?: number;
  };
  datePreset: string;
  startDate: string;
  endDate: string;
}

export const WarehouseReceivedModal: React.FC<WarehouseReceivedModalProps> = ({
  isOpen,
  onClose,
  items = [],
  receivingRecords = [],
  onNavigateToReceivingLedger,
  search,
  onSearchChange,
  poFilter,
  onPoChange,
  pkgFilter = 'all',
  onPkgChange,
  rdfFilter = 'all',
  onRdfChange,
  progFilter = 'all',
  onProgChange,
  plantFilter = 'all',
  onPlantChange,
  supplierFilter = 'all',
  onSupplierChange,
  movementFilter = 'all',
  onMovementChange,
  poList,
  pkgList = [],
  rdfList = [],
  progList = [],
  plantList = [],
  supplierList = [],
  movementList = [],
  stats,
  datePreset,
  startDate,
  endDate
}) => {
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<ReceivingDataRecord | null>(null);

  if (!isOpen) return null;

  const isReceivingDataActive = receivingRecords && receivingRecords.length > 0;

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    if (isReceivingDataActive) {
      const exportRows = receivingRecords.map(r => ({
        'Entry Date': r.entryDate,
        'Purchase order': r.purchaseOrder,
        'Material': r.material,
        'Material Description': r.materialDescription,
        'Quantity': r.quantity,
        'Base Unit of Measure': r.baseUnitOfMeasure,
        'Storage Location': r.storageLocation,
        'Amt.in Loc.Cur.': r.amtInLocCur,
        'Movement Type': r.movementType,
        'User Name': r.userName,
        'Valuation Type': r.valuationType,
        'Special Stock': r.specialStock,
        'WBS Element': r.wbsElement,
        'Supplier': r.supplier,
        'Plant': r.plant,
        'Movement Type Text': r.movementTypeText,
        'Qty in unit of entry': r.qtyInUnitOfEntry,
        'Unit of Entry': r.unitOfEntry,
        'Document Date': r.documentDate,
        'Time of Entry': r.timeOfEntry,
        'Material Doc. Year': r.materialDocYear,
        'Currency': r.currency
      }));
      downloadCSV(`EPSS_Total_Items_Received_${timestamp}.csv`, exportRows);
    } else {
      const exportRows = items.map(item => ({
        'Material Description': item.materialDescription,
        'Code': item.material,
        'Plant': item.plant,
        'Plant Name': item.plantName,
        'Quantity': item.qty,
        'Valuation (ETB)': item.totalAmount || (item.qty * (item.unitPrice || 0)),
        'PO Number': item.poNumber || 'N/A',
        'Package': item.procurementPackage || 'N/A'
      }));
      downloadCSV(`EPSS_Delivered_Items_${timestamp}.csv`, exportRows);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-cyan-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 via-cyan-800 to-indigo-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <PackageCheck className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold uppercase tracking-tight">
                  TOTAL ITEM RECEIVED AT WAREHOUSE
                </h3>
                {isReceivingDataActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-400/20 text-teal-200 border border-teal-300/30">
                    SAP Goods Receipt Ledger (22 Columns)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-cyan-100 flex-wrap">
                <span>
                  Physical custody intake tracking powered by receiving data transactions
                </span>
                {datePreset !== 'all' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/15 border border-white/10 text-[10px] font-bold">
                    <Calendar className="w-3 h-3 text-cyan-200" />
                    <span>
                      {datePreset === 'custom'
                        ? `${startDate || 'Start'} to ${endDate || 'End'}`
                        : datePreset === '7d'
                        ? 'Last 7 Days'
                        : datePreset === '30d'
                        ? 'Last 30 Days'
                        : 'Last 90 Days'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/20"
              title="Export current view to CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-200" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            {onNavigateToReceivingLedger && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToReceivingLedger();
                }}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Open full 22-column Receiving Data ledger"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open 22-Col Ledger</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-teal-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest mb-0.5">
                Total Units Received
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {formatNumber(stats.units)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Physical devices</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-0.5">
                Line Items / GRNs
              </span>
              <span className="text-2xl font-black text-blue-900 font-mono">
                {formatNumber(stats.lineItems)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Receipt line transactions</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-0.5">
                Total Intake Valuation
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                {formatCurrency(stats.valuation, true)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Local currency (ETB)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">
                Hub & Supplier Scope
              </span>
              <span className="text-base sm:text-lg font-black text-indigo-900">
                {stats.supplierCount ? `${stats.supplierCount} Vendors • ` : ''}{stats.plantCount || stats.percentageUnits}% Hubs
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Warehouse destinations</span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isReceivingDataActive ? "Search Material, PO, Supplier..." : "Search description, code..."}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 text-slate-800"
              />
            </div>
            <select
              value={poFilter}
              onChange={(e) => onPoChange(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
            >
              <option value="all">All Purchase Orders</option>
              {poList.map((po) => <option key={po} value={po}>PO: {po}</option>)}
            </select>

            {isReceivingDataActive ? (
              <>
                {plantList.length > 0 && onPlantChange && (
                  <select
                    value={plantFilter}
                    onChange={(e) => onPlantChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All Receiving Plants</option>
                    {plantList.map((p) => <option key={p} value={p}>Plant: {p}</option>)}
                  </select>
                )}
                {supplierList.length > 0 && onSupplierChange && (
                  <select
                    value={supplierFilter}
                    onChange={(e) => onSupplierChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All Suppliers</option>
                    {supplierList.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {movementList.length > 0 && onMovementChange && (
                  <select
                    value={movementFilter}
                    onChange={(e) => onMovementChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All Movement Types</option>
                    {movementList.map((m) => <option key={m} value={m}>Mvt {m}</option>)}
                  </select>
                )}
              </>
            ) : (
              <>
                {pkgList.length > 0 && onPkgChange && (
                  <select
                    value={pkgFilter}
                    onChange={(e) => onPkgChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All Packages</option>
                    {pkgList.map((pkg) => <option key={pkg} value={pkg}>{pkg}</option>)}
                  </select>
                )}
                {rdfList.length > 0 && onRdfChange && (
                  <select
                    value={rdfFilter}
                    onChange={(e) => onRdfChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All RDFs</option>
                    {rdfList.map((rdf) => <option key={rdf} value={rdf}>{rdf}</option>)}
                  </select>
                )}
                {progList.length > 0 && onProgChange && (
                  <select
                    value={progFilter}
                    onChange={(e) => onProgChange(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  >
                    <option value="all">All Programs</option>
                    {progList.map((prog) => <option key={prog} value={prog}>{prog}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {isReceivingDataActive ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <th className="px-3.5 py-2.5">Entry Date & Time</th>
                  <th className="px-3.5 py-2.5">Material & Description</th>
                  <th className="px-3.5 py-2.5">Hub / Storage Loc</th>
                  <th className="px-3.5 py-2.5 text-center">Received Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Amt. in Loc. Cur. (ETB)</th>
                  <th className="px-3.5 py-2.5">PO & Supplier</th>
                  <th className="px-3.5 py-2.5">Movement Type</th>
                  <th className="px-3.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {receivingRecords.length > 0 ? (
                  receivingRecords.slice(0, 150).map((rec) => (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedRecordDetail(rec)}
                      className="hover:bg-cyan-50/50 text-[11px] text-slate-700 transition cursor-pointer"
                    >
                      <td className="px-3.5 py-2 font-mono whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{rec.entryDate}</div>
                        <div className="text-[10px] text-slate-400">{rec.timeOfEntry || '08:00:00'}</div>
                      </td>
                      <td className="px-3.5 py-2 max-w-[280px]">
                        <div className="font-semibold text-slate-900 truncate" title={rec.materialDescription}>
                          {rec.materialDescription}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">{rec.material}</div>
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 text-[10px] mr-1">
                          {rec.plant}
                        </span>
                        <span className="text-[10px] text-slate-500">{rec.storageLocation}</span>
                      </td>
                      <td className="px-3.5 py-2 text-center whitespace-nowrap">
                        <span className="font-extrabold text-cyan-800 text-xs font-mono">{rec.quantity}</span>{' '}
                        <span className="text-[10px] text-slate-400">{rec.baseUnitOfMeasure}</span>
                      </td>
                      <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(rec.amtInLocCur, true)}
                      </td>
                      <td className="px-3.5 py-2 max-w-[200px]">
                        <div className="font-semibold text-cyan-700 font-mono text-[10px]">
                          PO: {rec.purchaseOrder}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={rec.supplier}>
                          {rec.supplier}
                        </div>
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rec.movementType} - {rec.movementTypeText}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecordDetail(rec);
                          }}
                          className="px-2 py-1 rounded text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No matching receiving records found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="px-4 py-2.5">Material Description</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Hub / Warehouse</th>
                  <th className="px-4 py-2.5">Qty</th>
                  <th className="px-4 py-2.5 text-right">Valuation (ETB)</th>
                  <th className="px-4 py-2.5">PO / Package</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.slice(0, 100).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 text-[11px] text-slate-700">
                      <td className="px-4 py-2 font-semibold text-slate-900">{item.materialDescription}</td>
                      <td className="px-4 py-2 font-mono text-slate-500">{item.material}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold">{item.plantName}</span>
                          <span className="text-[10px] text-slate-400">{item.plant}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-bold">{item.qty}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalAmount || (item.qty * (item.unitPrice || 0)), true)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col text-[10px]">
                          <span className="font-semibold text-cyan-700">PO: {item.poNumber || 'N/A'}</span>
                          <span className="text-slate-500">Pkg: {item.procurementPackage || 'N/A'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No matching received items found in warehouse custody.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {((isReceivingDataActive ? receivingRecords.length : items.length) > 100) && (
            <div className="p-3 text-center text-[10px] text-slate-400 font-medium border-t border-slate-100">
              Showing top records. Use search and dropdown filters to narrow down.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>
              Showing {formatNumber(isReceivingDataActive ? receivingRecords.length : items.length)} of {formatNumber(stats.lineItems)} transactions
            </span>
            {isReceivingDataActive && (
              <span className="text-slate-400">• Movement: 101 Goods Receipt standard ledger</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToReceivingLedger && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToReceivingLedger();
                }}
                className="px-4 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
              >
                Go to Receiving Data Ledger
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Drilldown modal for single record */}
      {selectedRecordDetail && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">SAP Goods Receipt Record Inspection</h4>
                <p className="text-[11px] text-slate-400">PO: {selectedRecordDetail.purchaseOrder} • GRN Year: {selectedRecordDetail.materialDocYear}</p>
              </div>
              <button
                onClick={() => setSelectedRecordDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Material Description</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedRecordDetail.materialDescription}</div>
                <div className="text-xs font-mono text-slate-500 mt-0.5">Code: {selectedRecordDetail.material}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Received Quantity</span>
                  <span className="text-base font-extrabold text-cyan-800 font-mono mt-0.5 block">
                    {selectedRecordDetail.quantity} {selectedRecordDetail.baseUnitOfMeasure}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Valuation in Loc. Cur.</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono mt-0.5 block">
                    {formatCurrency(selectedRecordDetail.amtInLocCur, true)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Movement Type</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {selectedRecordDetail.movementType} ({selectedRecordDetail.movementTypeText})
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Plant & Storage Loc</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    Plant {selectedRecordDetail.plant} • {selectedRecordDetail.storageLocation}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Posting Date (Excel Source)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-slate-800">
                      {selectedRecordDetail.postingDate || selectedRecordDetail.entryDate || '-'}
                    </span>
                    {selectedRecordDetail.postingDay && selectedRecordDetail.postingMonth && selectedRecordDetail.postingYear && (
                      <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                        Day {selectedRecordDetail.postingDay} • Month {selectedRecordDetail.postingMonth} • Year {selectedRecordDetail.postingYear}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-teal-50/70 p-2.5 rounded-xl border border-teal-200">
                  <span className="text-[10px] text-teal-800 uppercase font-bold block">Stock Holding Days</span>
                  <span className="font-bold text-teal-900 mt-0.5 font-mono block">
                    {(() => {
                      const days = calculateStockHoldingDays(selectedRecordDetail.postingDate || selectedRecordDetail.entryDate, selectedRecordDetail);
                      return days !== null ? `${days} Days (${days <= 30 ? '<30d Fresh' : days <= 90 ? '31-90d Active' : days <= 180 ? '91-180d Watch' : '>180d Aging'})` : 'N/A';
                    })()}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Logged By (User)</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{selectedRecordDetail.userName || 'System'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">WBS Element</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{selectedRecordDetail.wbsElement || 'N/A'}</span>
                </div>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedRecordDetail(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
