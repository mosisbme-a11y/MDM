import React, { useState, useMemo } from 'react';
import {
  X,
  Clock,
  Building2,
  Filter,
  Search,
  Download,
  FileDown,
  FileText,
  Printer,
  Upload,
  AlertTriangle,
  ArrowUpRight,
  Package,
  Layers,
  Sparkles,
  ChevronRight,
  Send,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface NonMovingModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  onOpenMultiUpload?: () => void;
  onTransferItem?: (item: MedicalDeviceItem) => void;
}

export const NonMovingModal: React.FC<NonMovingModalProps> = ({
  isOpen,
  onClose,
  items,
  onOpenMultiUpload,
  onTransferItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [rdfFilter, setRdfFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [stagnancyPeriodFilter, setStagnancyPeriodFilter] = useState('all');
  const [selectedActionItem, setSelectedActionItem] = useState<MedicalDeviceItem | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Base list of all non-moving items
  const allNonMovingItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.isNonMoving === true ||
        item.sohStatus === 'Non-Moving Stock' ||
        item.fyaEpSSNoBkdStatus?.toLowerCase().includes('non-moving') ||
        ((item as any).operationalStatus && (item as any).operationalStatus.toLowerCase().includes('non-moving'))
    );
  }, [items]);

  // Distinct filter lists
  const branchList = useMemo(() => {
    return Array.from(new Set(allNonMovingItems.map((i) => i.plantName).filter(Boolean))).sort();
  }, [allNonMovingItems]);

  const rdfList = useMemo(() => {
    return Array.from(new Set(allNonMovingItems.map((i) => i.rdfNumber || i.wbsElement).filter(Boolean))).sort();
  }, [allNonMovingItems]);

  const programList = useMemo(() => {
    return Array.from(new Set(allNonMovingItems.map((i) => i.programName).filter(Boolean))).sort();
  }, [allNonMovingItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allNonMovingItems.filter((item) => {
      // Branch filter
      if (branchFilter !== 'all' && item.plantName !== branchFilter) {
        return false;
      }
      // RDF filter
      if (rdfFilter !== 'all' && (item.rdfNumber !== rdfFilter && item.wbsElement !== rdfFilter)) {
        return false;
      }
      // Program filter
      if (programFilter !== 'all' && item.programName !== programFilter) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = item.materialDescription?.toLowerCase().includes(q);
        const matchesCode = item.material?.toLowerCase().includes(q);
        const matchesBatch = item.batch?.toLowerCase().includes(q);
        const matchesPlant = item.plantName?.toLowerCase().includes(q);
        const matchesProgram = item.programName?.toLowerCase().includes(q);
        const matchesRdf = (item.rdfNumber || item.wbsElement)?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesCode && !matchesBatch && !matchesPlant && !matchesProgram && !matchesRdf) {
          return false;
        }
      }
      return true;
    });
  }, [allNonMovingItems, branchFilter, rdfFilter, programFilter, searchQuery]);

  // Key metrics
  const totalUnits = useMemo(() => filteredItems.reduce((acc, i) => acc + (Number(i.qty) || 0), 0), [filteredItems]);
  const totalValuation = useMemo(
    () => filteredItems.reduce((acc, i) => acc + (Number(i.totalAmount) || (Number(i.qty) || 0) * (i.unitPrice || 0)), 0),
    [filteredItems]
  );
  const totalLineItems = filteredItems.length;
  const affectedBranchesCount = useMemo(() => new Set(filteredItems.map((i) => i.plantName)).size, [filteredItems]);
  const affectedProgramsCount = useMemo(() => new Set(filteredItems.map((i) => i.programName)).size, [filteredItems]);

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('ETHIOPIAN PHARMACEUTICALS SUPPLY SERVICE (EPSS)', 14, 16);
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9);
    doc.text('NON-MOVING MEDICAL DEVICE INVENTORY AUDIT & REDISTRIBUTION REPORT', 14, 23);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${now} | Total Non-Moving Units: ${formatNumber(totalUnits)} | Capital Tied: ${formatCurrency(totalValuation)} ETB`, 14, 29);
    doc.text(`Active Filters: Branch [${branchFilter}] | RDF [${rdfFilter}] | Program [${programFilter}]`, 14, 34);

    const headers = [['#', 'Material Description', 'SAP Code', 'Branch / Hub', 'Qty', 'Unit Price', 'Total ETB', 'RDF Number', 'Program', 'Directive']];
    const body = filteredItems.map((item, idx) => [
      idx + 1,
      item.materialDescription,
      item.material,
      item.plantName || 'Central Hub',
      item.qty,
      formatNumber(item.unitPrice || 0),
      formatNumber(item.totalAmount || (item.qty * (item.unitPrice || 0))),
      item.rdfNumber || item.wbsElement || 'RDF-N/A',
      item.programName || 'General Healthcare',
      item.nextAction || 'Inter-branch Transfer'
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [254, 243, 199] }
    });

    doc.save(`EPSS_Non_Moving_Items_Report_${Date.now()}.pdf`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Material Description', 'SAP Code', 'Branch', 'Quantity', 'Unit Price (ETB)', 'Total Amount (ETB)', 'RDF Number', 'Program', 'Batch', 'Recommended Action'];
    const rows = filteredItems.map((item) => [
      `"${(item.materialDescription || '').replace(/"/g, '""')}"`,
      `"${item.material}"`,
      `"${item.plantName}"`,
      item.qty,
      item.unitPrice || 0,
      item.totalAmount || (item.qty * (item.unitPrice || 0)),
      `"${item.rdfNumber || item.wbsElement || ''}"`,
      `"${item.programName || ''}"`,
      `"${item.batch || ''}"`,
      `"${item.nextAction || 'Regional Redistribution'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EPSS_NonMoving_Inventory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyDirective = (item: MedicalDeviceItem, directive: string) => {
    setActionSuccessMsg(`Action "${directive}" initiated for "${item.materialDescription}" (${item.plantName}).`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-amber-200/80 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg sm:text-xl tracking-tight text-white">
                  NON-MOVING MEDICAL DEVICE INVENTORY AUDIT
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-amber-900 shadow-xs">
                  Branch • RDF • Program Filtered
                </span>
              </div>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Targeted identification of stagnant devices, capital at risk, and actionable redistribution workflows across EPSS hubs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenMultiUpload && (
              <button
                type="button"
                onClick={() => {
                  onOpenMultiUpload();
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 shadow-xs transition cursor-pointer flex items-center gap-1.5"
                title="Upload multiple datasets for non-moving analysis"
              >
                <Upload className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Upload Multi-Data for Analysis</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-black/20 hover:bg-black/30 border border-white/30 shadow-xs transition cursor-pointer flex items-center gap-1.5"
              title="Export formatted PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-black/20 hover:bg-black/30 border border-white/30 shadow-xs transition cursor-pointer flex items-center gap-1.5"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-amber-50/60 border-b border-amber-100 text-xs">
          <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Non-Moving Units</span>
            <div className="text-xl font-black text-amber-950 mt-0.5">{formatNumber(totalUnits)}</div>
            <span className="text-[10px] text-amber-700 font-semibold">{totalLineItems} distinct line items</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Stagnant Capital Tied</span>
            <div className="text-xl font-black text-amber-950 mt-0.5">{formatCurrency(totalValuation, true)}</div>
            <span className="text-[10px] text-slate-500 font-medium">ETB Valuation</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Affected Branches</span>
            <div className="text-xl font-black text-amber-950 mt-0.5">{affectedBranchesCount}</div>
            <span className="text-[10px] text-slate-500 font-medium">Regional Hubs</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Funding Programs</span>
            <div className="text-xl font-black text-amber-950 mt-0.5">{affectedProgramsCount}</div>
            <span className="text-[10px] text-slate-500 font-medium">Active Programs</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Redistribution Triage</span>
            <div className="text-xl font-black text-emerald-700 mt-0.5">High Priority</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Immediate MoH review</span>
          </div>
        </div>

        {/* Action toast inside modal if triggered */}
        {actionSuccessMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filters Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device description, SAP code, batch, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none text-xs cursor-pointer"
              >
                <option value="all">All Branches ({branchList.length})</option>
                {branchList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* RDF Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={rdfFilter}
                onChange={(e) => setRdfFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none text-xs cursor-pointer"
              >
                <option value="all">All RDFs ({rdfList.length})</option>
                {rdfList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Program Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none text-xs cursor-pointer"
              >
                <option value="all">All Programs ({programList.length})</option>
                {programList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {(branchFilter !== 'all' || rdfFilter !== 'all' || programFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setBranchFilter('all');
                  setRdfFilter('all');
                  setProgramFilter('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Table View of Non-Moving Items */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Medical Device / SAP Code</th>
                <th className="py-3 px-4">Branch / Hub</th>
                <th className="py-3 px-4 text-center">Stagnant Qty</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Total ETB</th>
                <th className="py-3 px-4">RDF Number</th>
                <th className="py-3 px-4">Program</th>
                <th className="py-3 px-4">Recommended Redistribution Action</th>
                <th className="py-3 px-4 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-2 border border-amber-200">
                      <Clock className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-800 text-sm">No non-moving items match the selected criteria</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Try clearing or changing the Branch, RDF, or Program filters above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.materialDescription}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <span>Code: {item.material}</span>
                        <span>•</span>
                        <span>Batch: {item.batch || 'LOT-2026'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{item.plantName || 'Central Hub'}</div>
                      <div className="text-[10px] text-slate-400">{item.plant || 'HO01'} / {item.wh || 'WH1'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                        {item.qty} Units
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {formatCurrency(item.unitPrice || 0)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-900">
                      {formatCurrency(item.totalAmount || (item.qty * (item.unitPrice || 0)))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] font-bold border border-slate-200">
                        {item.rdfNumber || item.wbsElement || 'RDF-2026'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200">
                        {item.programName || 'General Healthcare'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] font-medium text-slate-700">
                        {item.nextAction || 'Inter-branch Transfer to General Hospital'}
                      </div>
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                        {item.wayOfIntervention || 'Redistribute Stock'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyDirective(item, 'Transfer to Regional Hospital')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition cursor-pointer"
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyDirective(item, 'Flag for QA Review')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                        >
                          QA Audit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-medium">
            Showing <strong className="text-slate-900">{filteredItems.length}</strong> non-moving device records • Total Stagnant Valuation:{' '}
            <strong className="text-amber-800 font-mono font-bold">{formatCurrency(totalValuation)} ETB</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            >
              Close Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
