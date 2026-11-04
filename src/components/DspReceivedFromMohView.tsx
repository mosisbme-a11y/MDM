import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Calendar,
  Sparkles,
  Clock,
  Send,
  FileCheck,
  RefreshCw,
  AlertCircle,
  Trash2,
  Printer,
  ChevronRight,
  Check,
  ShieldCheck,
  Mail,
  MessageCircle,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { 
  DspRequestTemplateRow, 
  DSP_REQUEST_TEMPLATE_COLUMNS, 
  TODAY_ISO_DATE,
  isProgramHpStockItem,
  buildDspTemplateRowsFromStock
} from '../data/defaultDspRequestTemplateData';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';
import { saveDspRecordsToIndexedDB } from '../utils/indexedDbCache';

interface DspReceivedFromMohViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  multipleStockItems?: MultipleStockRecord[];
  subStageTarget?: '1.2' | '2.1';
  onSelectSubTab?: (tab: EpssSubTab) => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

export const DspReceivedFromMohView: React.FC<DspReceivedFromMohViewProps> = ({
  records,
  setRecords,
  multipleStockItems = [],
  subStageTarget = '1.2',
  onSelectSubTab,
  onTriggerCloudSync
}) => {
  const is21 = subStageTarget === '2.1';
  const storageRowsKey = is21 ? 'epss_dsp_received_epss_rows' : 'epss_dsp_received_moh_rows';
  const targetSubStage = is21 ? '2.1' : '1.2';
  const targetStage = is21 ? 'moh-osp-management' : 'head-office-dsp';

  // Find official received record for target subStage
  const receivedRecord = useMemo(() => {
    return records.find(r => {
      const sub = canonicalizeSubStage(r.subStage, r.stage);
      return sub === targetSubStage && r.stage === targetStage;
    });
  }, [records, targetSubStage, targetStage]);

  // Load the exact received rows (from localStorage, receivedRecord, or empty)
  const [receivedRows, setReceivedRows] = useState<DspRequestTemplateRow[]>(() => {
    try {
      const stored = localStorage.getItem(storageRowsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r, i) => ({
            ...r,
            srNo: i + 1,
            requestDate: r.requestDate || TODAY_ISO_DATE,
            dspRequestTo: r.dspRequestTo || 'MOH'
          }));
        }
      }
    } catch (e) {
      console.warn(`Failed to parse ${storageRowsKey}:`, e);
    }

    // If records has items from a non-sample target record
    if (receivedRecord && receivedRecord.itemsIncluded && receivedRecord.itemsIncluded.length > 0 && !receivedRecord.id.includes('sample')) {
      return receivedRecord.itemsIncluded.map((it: any, idx: number) => ({
        id: `rec-item-${idx}`,
        srNo: idx + 1,
        material: it.material,
        materialDescription: it.description,
        qty: it.quantity || 1,
        totalAmount: it.totalAmount || (it.quantity * 250000),
        valuationTypeDesc: it.valuationTypeDesc || 'Standard Price (S)',
        wbsElement: it.wbsElement || 'SDG-ME-23-001-011',
        budgetSource: it.budgetSource || 'WB',
        requestDate: it.requestDate || receivedRecord.dateSubmitted || TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
    }

    return [];
  });

  // Re-sync if receivedRecord changes
  useEffect(() => {
    if (receivedRecord && receivedRecord.itemsIncluded && receivedRecord.itemsIncluded.length > 0 && !receivedRecord.id.includes('sample')) {
      const mapped = receivedRecord.itemsIncluded.map((it: any, idx: number) => ({
        id: `rec-item-${idx}`,
        srNo: idx + 1,
        material: it.material,
        materialDescription: it.description,
        qty: it.quantity || 1,
        totalAmount: it.totalAmount || (it.quantity * 250000),
        valuationTypeDesc: it.valuationTypeDesc || 'Standard Price (S)',
        wbsElement: it.wbsElement || 'SDG-ME-23-001-011',
        budgetSource: it.budgetSource || 'WB',
        requestDate: it.requestDate || receivedRecord.dateSubmitted || TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
      setReceivedRows(mapped);
      try {
        localStorage.setItem(storageRowsKey, JSON.stringify(mapped));
      } catch {}
    }
  }, [receivedRecord, storageRowsKey]);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute Totals
  const totals = useMemo(() => {
    const totalQty = receivedRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalValuation = receivedRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const uniqueBudgets = Array.from(new Set(receivedRows.map(r => r.budgetSource).filter(Boolean)));
    return {
      lineItemsCount: receivedRows.length,
      totalQty,
      totalValuation,
      uniqueBudgets
    };
  }, [receivedRows]);

  // Filtered rows for search & budget
  const filteredRows = useMemo(() => {
    return receivedRows.filter(row => {
      const matchSearch =
        row.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.materialDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.wbsElement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.valuationTypeDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.budgetSource.toLowerCase().includes(searchQuery.toLowerCase());

      const matchBudget = budgetFilter === 'all' || row.budgetSource.toLowerCase() === budgetFilter.toLowerCase();
      return matchSearch && matchBudget;
    });
  }, [receivedRows, searchQuery, budgetFilter]);

  // One-click helper to quick-transmit and store from 1.1 if needed
  const handleQuickTransmitCurrentFrom11 = () => {
    let sourceRows: DspRequestTemplateRow[] = [];
    try {
      const stored = localStorage.getItem('epss_dsp_request_template_rows');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) sourceRows = parsed;
      }
    } catch {}

    if (sourceRows.length === 0) {
      sourceRows = buildDspTemplateRowsFromStock(multipleStockItems, TODAY_ISO_DATE);
    }

    const refNum = `EPSS/MD-DSP/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`;
    const mohReceivedRef = `MOH/PMD-DSP/${new Date().getFullYear()}/${String(Math.floor(200 + Math.random() * 800))}`;

    const newRecord11: DspWorkflowRecord = {
      id: `dsp-dossier-${Date.now()}`,
      dspRefNumber: refNum,
      stage: 'head-office-dsp',
      subStage: '1.1',
      stageTitle: 'Head Office DSP Management',
      senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      subject: `DSP Request to MOH: Program (HP) Equipment Allocation Request (${sourceRows.length} Materials)`,
      status: 'Submitted & Pending',
      dateSubmitted: TODAY_ISO_DATE,
      totalDevices: sourceRows.length,
      totalQuantity: sourceRows.reduce((acc, r) => acc + (r.qty || 0), 0),
      totalValuationETB: sourceRows.reduce((acc, r) => acc + (r.totalAmount || 0), 0),
      targetedRegions: ['Oromia', 'Amhara', 'Sidama', 'Somali'],
      targetedFacilitiesCount: 14,
      officialLetterRef: `EPSS/LET/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000))}`,
      signatory: 'Mosisa (Authorized User)',
      signatoryRole: 'Directorate Technical Lead',
      itemsIncluded: sourceRows.map(r => ({
        material: r.material,
        description: r.materialDescription,
        quantity: r.qty,
        plant: 'AA01 Central',
        allocatedFacility: 'MOH Approved Allocation',
        valuationTypeDesc: r.valuationTypeDesc,
        wbsElement: r.wbsElement,
        budgetSource: r.budgetSource,
        requestDate: r.requestDate,
        dspRequestTo: r.dspRequestTo,
        totalAmount: r.totalAmount
      })),
      notes: `Transmitted via 10-Column Standard DSP Request Template linked with Multiple Stock (Program HP).`
    };

    const newRecord12: DspWorkflowRecord = {
      id: `dsp-moh-received-${Date.now()}`,
      dspRefNumber: mohReceivedRef,
      stage: 'head-office-dsp',
      subStage: '1.2',
      stageTitle: 'Head Office DSP Management',
      senderOrg: 'Ministry of Health (PMD Directorate)',
      recipientOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      subject: `DSP Received from MOH: Official Allocation Endorsement for ${refNum} (${sourceRows.length} Program HP Items)`,
      status: 'Endorsed & Approved',
      dateSubmitted: TODAY_ISO_DATE,
      approvedDate: TODAY_ISO_DATE,
      actionTakenDate: TODAY_ISO_DATE,
      actionTakenBy: 'Dr. Bethlehem (MOH PMD Directorate)',
      actionType: 'Endorsed & Approved',
      actionLetterRef: `MOH/PMD/ACT/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`,
      actionNotes: `National priority allocation endorsed for all ${sourceRows.length} Program (HP) equipment items as requested by EPSS.`,
      turnaroundDays: 0,
      totalDevices: sourceRows.length,
      totalQuantity: sourceRows.reduce((acc, r) => acc + (r.qty || 0), 0),
      totalValuationETB: sourceRows.reduce((acc, r) => acc + (r.totalAmount || 0), 0),
      targetedRegions: ['Oromia', 'Amhara', 'Sidama', 'Somali'],
      targetedFacilitiesCount: 14,
      officialLetterRef: `MOH/LET/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000))}`,
      signatory: 'Dr. Bethlehem (MOH PMD Directorate)',
      signatoryRole: 'PMD Directorate Director',
      itemsIncluded: sourceRows.map(r => ({
        material: r.material,
        description: r.materialDescription,
        quantity: r.qty,
        plant: 'AA01 Central',
        allocatedFacility: 'MOH Approved Distribution Quota',
        valuationTypeDesc: r.valuationTypeDesc,
        wbsElement: r.wbsElement,
        budgetSource: r.budgetSource,
        requestDate: r.requestDate,
        dspRequestTo: r.dspRequestTo,
        totalAmount: r.totalAmount
      })),
      notes: `Transmitted from EPSS HO and received/endorsed by MOH PMD Directorate. Exact ${sourceRows.length} line items stored.`
    };

    // Store in localStorage
    localStorage.setItem('epss_dsp_received_moh_rows', JSON.stringify(sourceRows));
    localStorage.setItem('epss_dsp_received_moh_record', JSON.stringify(newRecord12));
    setReceivedRows(sourceRows);

    // Update records state: clear previous default for 1.2
    setRecords(prev => {
      const filtered = prev.filter(r => {
        const sub = canonicalizeSubStage(r.subStage, r.stage);
        // Clear old sample or previous 1.2 records
        if (sub === '1.2') return false;
        return true;
      });
      const updated = [newRecord11, newRecord12, ...filtered];
      saveDspRecordsToIndexedDB(updated);
      return updated;
    });

    if (onTriggerCloudSync) {
      onTriggerCloudSync(`DSP Request ${refNum} transmitted to MOH & stored exact inside DSP Received from MOH (1.2)`, {
        type: 'CREATE',
        title: `DSP Received from MOH: ${mohReceivedRef}`,
        payload: newRecord12
      });
    }

    showToast(`✓ Stored exact ${sourceRows.length} transmitted items inside DSP Received from MOH & cleared previous default!`);
  };

  // Clear received records and reset
  const handleClearReceivedData = () => {
    localStorage.removeItem(storageRowsKey);
    localStorage.removeItem(is21 ? 'epss_dsp_received_epss_record' : 'epss_dsp_received_moh_record');
    setReceivedRows([]);
    setRecords(prev => {
      const filtered = prev.filter(r => canonicalizeSubStage(r.subStage, r.stage) !== targetSubStage);
      saveDspRecordsToIndexedDB(filtered);
      return filtered;
    });
    showToast('✓ Received DSP data cleared');
  };

  // Excel Export
  const handleDownloadExcel = () => {
    const exportData = receivedRows.map((r, idx) => ({
      'S/N': idx + 1,
      'Material': r.material,
      'Material Description': r.materialDescription,
      'Qty': r.qty,
      'Total Amount': r.totalAmount,
      'Valuation Type Desc': r.valuationTypeDesc,
      'WBS Element': r.wbsElement,
      'Budget Source': r.budgetSource,
      'Request Date': r.requestDate || TODAY_ISO_DATE,
      'DSP Received From': 'Ministry of Health (PMD Directorate)',
      'Status': 'Endorsed & Approved'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 8 },  // S/N
      { wch: 18 }, // Material
      { wch: 44 }, // Material Description
      { wch: 10 }, // Qty
      { wch: 20 }, // Total Amount
      { wch: 24 }, // Valuation Type Desc
      { wch: 22 }, // WBS Element
      { wch: 16 }, // Budget Source
      { wch: 16 }, // Request Date
      { wch: 32 }, // DSP Received From
      { wch: 22 }  // Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DSP_Received_from_MOH');
    XLSX.writeFile(workbook, `DSP_Received_from_MOH_Program_HP_${TODAY_ISO_DATE}.xlsx`);
    showToast('✓ Downloaded DSP Received from MOH Excel');
  };

  // CSV Export
  const handleDownloadCSV = () => {
    const headers = [...DSP_REQUEST_TEMPLATE_COLUMNS, 'MOH Status'].join(',');
    const lines = receivedRows.map((r, idx) => {
      const esc = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      return [
        idx + 1,
        esc(r.material),
        esc(r.materialDescription),
        r.qty,
        r.totalAmount,
        esc(r.valuationTypeDesc),
        esc(r.wbsElement),
        esc(r.budgetSource),
        esc(r.requestDate || TODAY_ISO_DATE),
        esc('Ministry of Health (PMD Directorate)'),
        esc('Endorsed & Approved')
      ].join(',');
    });

    const csvContent = [headers, ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DSP_Received_from_MOH_${TODAY_ISO_DATE}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded CSV');
  };

  // Print Dossier View
  const handlePrintDossier = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Card featuring EXACT pill button from user screenshot _04C3EE6A-184D-4123-86F4-25891B98DD8C__9cb01a11.png */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* EXACT PILL BUTTON FROM USER SCREENSHOT _04C3EE6A-184D-4123-86F4-25891B98DD8C__9cb01a11.png */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#EBF1F6] border border-[#D5E1EC] shadow-sm ring-1 ring-cyan-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8292A2] shrink-0" />
              <span className="text-xs md:text-sm font-black text-[#1E3A5F] tracking-tight">
                {is21 ? 'DSP Received from EPSS' : 'DSP Received from MOH'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-[#1E3A5F] text-white">
                {receivedRows.length}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {is21 ? 'Sub-step 2.1: Official Incoming Transmittal Quota from EPSS HO' : 'Sub-step 1.2: Official MOH Ministerial Endorsement & Response'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Exact Transmitted Data Stored
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                {is21 ? 'EPSS Head Office (Medical Equipment Directorate) ➔ Ministry of Health (PMD Directorate)' : 'Ministry of Health (PMD Directorate) ➔ EPSS Head Office (Medical Equipment Directorate)'}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Return to 1.1 DSP Request to MOH */}
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-ho-1-1')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1527] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200 shadow-2xs"
              title="Return to Sub-Step 1.1: DSP Request to MOH"
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>• DSP Request to MOH</span>
            </button>

            {/* Download Excel */}
            <button
              type="button"
              disabled={receivedRows.length === 0}
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Download official received Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel</span>
            </button>

            {/* Print Official Receipt */}
            <button
              type="button"
              disabled={receivedRows.length === 0}
              onClick={handlePrintDossier}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Print official ministerial response dossier"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Proceed to Stage 1.3: Map HF to Hubs */}
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-ho-1-3-1')}
              className="px-3.5 py-1.5 rounded-xl bg-[#0B1527] hover:bg-[#111f38] text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
              title="Advance to Sub-Step 1.3: Map HF to Hubs based on Master Data"
            >
              <span>Proceed to 1.3 Map HF</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State vs Active Data */}
      {receivedRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Awaiting DSP Request Transmission to MOH
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              The previous default mock items (Ultrasound, Ventilator, X-Ray) have been cleared. Once you click <strong className="text-slate-800">"Send to MOH"</strong> from Sub-Step 1.1, the exact 10-column materials you transmitted will appear here inside <strong className="text-slate-800">• DSP Received from MOH</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-ho-1-1')}
              className="px-4 py-2 rounded-xl bg-[#0B1527] hover:bg-[#111f38] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span>Go to Sub-Step 1.1: DSP Request to MOH</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleQuickTransmitCurrentFrom11}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
              title="Instantly transmit current Program (HP) items from stock and populate 1.2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Transmit & Store Current Stock Items Now</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metric Confirmation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  Materials Endorsed
                </div>
                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
                  {totals.lineItemsCount} Items
                </div>
                <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Exact Transmitted Copy
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  Total Allocated Units
                </div>
                <div className="text-xl font-black text-cyan-700 mt-0.5 font-mono">
                  {formatNumber(totals.totalQty)} Units
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Priority Health Program (HP)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  Total Budget Valuation
                </div>
                <div className="text-xl font-black text-emerald-600 mt-0.5 font-mono">
                  {formatCurrency(totals.totalValuation)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Sources: {totals.uniqueBudgets.join(', ') || 'WB'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  MOH Response Ref & SLA
                </div>
                <div className="text-xs font-mono font-black text-amber-700 mt-0.5 truncate">
                  {receivedRecord?.dspRefNumber || `MOH/PMD-DSP/${new Date().getFullYear()}/042`}
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Date: {receivedRecord?.dateSubmitted || TODAY_ISO_DATE} • Turnaround: 0d (Instant)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search material code, description, WBS, budget..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Budget Sources</option>
                {totals.uniqueBudgets.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleClearReceivedData}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Clear received data and revert to empty"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* EXACT 10-COLUMN TABLE MATCHING THE TRANSMITTED STANDARD TEMPLATE */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3 bg-gradient-to-r from-[#0B1527] to-[#1E3A5F] text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  DSP Received from MOH — Stored Transmitted Allocation ({filteredRows.length} Line Items)
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
                  MOH PMD Endorsed
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                Official Letter: <span className="text-amber-300 font-mono font-bold">{receivedRecord?.officialLetterRef || 'MOH/LET/2026/782'}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F59E0B] text-slate-950 font-black uppercase text-[11px] tracking-wider border-b-2 border-amber-600 select-none">
                    <th className="py-3 px-3 text-center border-r border-amber-500/80 w-12">S/N</th>
                    <th className="py-3 px-3 border-r border-amber-500/80">Material</th>
                    <th className="py-3 px-3 border-r border-amber-500/80">Material Description</th>
                    <th className="py-3 px-3 border-r border-amber-500/80 text-right">Qty</th>
                    <th className="py-3 px-3 border-r border-amber-500/80 text-right">Total Amount (ETB)</th>
                    <th className="py-3 px-3 border-r border-amber-500/80">Valuation Type Desc</th>
                    <th className="py-3 px-3 border-r border-amber-500/80">WBS Element</th>
                    <th className="py-3 px-3 border-r border-amber-500/80 text-center">Budget Source</th>
                    <th className="py-3 px-3 border-r border-amber-500/80 text-center">Request Date</th>
                    <th className="py-3 px-3 border-r border-amber-500/80 text-center">Received From</th>
                    <th className="py-3 px-3 text-center">MOH Endorsement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 font-medium text-slate-800">
                  {filteredRows.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={row.id || idx}
                        className={`transition-colors ${
                          isEven ? 'bg-[#FEF9C3]/60 hover:bg-[#FEF08A]/80' : 'bg-[#FEF08A]/40 hover:bg-[#FEF08A]/80'
                        }`}
                      >
                        {/* 1. S/N */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 border-r border-amber-200/50">
                          {idx + 1}
                        </td>

                        {/* 2. Material */}
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-900 border-r border-amber-200/50 whitespace-nowrap">
                          {row.material}
                        </td>

                        {/* 3. Material Description */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-amber-200/50 min-w-[240px]">
                          {row.materialDescription}
                        </td>

                        {/* 4. Qty */}
                        <td className="py-2.5 px-3 text-right font-mono font-black text-cyan-900 border-r border-amber-200/50 whitespace-nowrap">
                          {formatNumber(row.qty)}
                        </td>

                        {/* 5. Total Amount */}
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-900 border-r border-amber-200/50 whitespace-nowrap">
                          {formatCurrency(row.totalAmount)}
                        </td>

                        {/* 6. Valuation Type Desc */}
                        <td className="py-2.5 px-3 font-medium text-slate-700 border-r border-amber-200/50 whitespace-nowrap">
                          {row.valuationTypeDesc}
                        </td>

                        {/* 7. WBS Element */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 border-r border-amber-200/50 whitespace-nowrap">
                          {row.wbsElement}
                        </td>

                        {/* 8. Budget Source */}
                        <td className="py-2.5 px-3 text-center border-r border-amber-200/50 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300">
                            {row.budgetSource}
                          </span>
                        </td>

                        {/* 9. Request Date */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-amber-200/50 whitespace-nowrap">
                          {row.requestDate}
                        </td>

                        {/* 10. Received From */}
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 border-r border-amber-200/50 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#1E3A5F] text-white">
                            MOH PMD
                          </span>
                        </td>

                        {/* 11. MOH Endorsement Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer with Totals */}
                <tfoot>
                  <tr className="bg-[#F59E0B] text-slate-950 font-black text-xs border-t-2 border-amber-600">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider border-r border-amber-500">
                      Total Allocated Summary:
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-950 border-r border-amber-500">
                      {formatNumber(totals.totalQty)} Units
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-950 border-r border-amber-500">
                      {formatCurrency(totals.totalValuation)}
                    </td>
                    <td colSpan={6} className="py-3 px-3 text-slate-900 text-[11px] font-semibold">
                      ✓ Official ministerial allocation quota ratified by Ministry of Health (PMD Directorate)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Workflow Pipeline Action Callout */}
          <div className="bg-gradient-to-r from-slate-900 to-[#1E3A5F] text-white p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-400 text-slate-950">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Ready for Next Head Office & Regional Operations
                </h4>
                <p className="text-[11px] text-slate-200 mt-0.5">
                  With MOH approval stored, you can map health facilities to EPSS branch hubs or initiate the regional breakdown matrix request to Regional Health Bureaus (RHBs).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectSubTab?.('dsp-ho-1-3-1')}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <span>Sub-Step 1.3: Map HF to Hubs</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onSelectSubTab?.('dsp-moh-2-2')}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <span>Stage 2: Regional Breakdown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
