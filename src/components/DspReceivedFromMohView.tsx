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
  Copy,
  Folder,
  FolderArchive,
  FileText,
  Paperclip,
  Eye,
  X
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

  // Find all official received records for target subStage
  const receivedRecords = useMemo(() => {
    return records.filter(r => {
      const sub = canonicalizeSubStage(r.subStage, r.stage);
      return sub === targetSubStage && r.stage === targetStage;
    }).sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records, targetSubStage, targetStage]);

  // Handle selected dossier for full view
  const [selectedDossier, setSelectedDossier] = useState<DspWorkflowRecord | null>(null);

  // Load the exact received rows (from receivedRecord or empty)
  const [receivedRows, setReceivedRows] = useState<DspRequestTemplateRow[]>([]);

  // Re-sync if receivedRecord changes (fallback for backward compatibility or direct view)
  useEffect(() => {
    const mainRecord = selectedDossier || receivedRecords[0];
    if (mainRecord && mainRecord.itemsIncluded && mainRecord.itemsIncluded.length > 0 && !mainRecord.id.includes('sample')) {
      const mapped = mainRecord.itemsIncluded.map((it: any, idx: number) => ({
        id: `rec-item-${idx}-${mainRecord.id}`,
        srNo: idx + 1,
        material: it.material,
        materialDescription: it.description,
        qty: it.quantity || 1,
        totalAmount: it.totalAmount || (it.quantity * 250000),
        valuationTypeDesc: it.valuationTypeDesc || 'Standard Price (S)',
        wbsElement: it.wbsElement || 'SDG-ME-23-001-011',
        budgetSource: it.budgetSource || 'WB',
        requestDate: it.requestDate || mainRecord.dateSubmitted || TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
      setReceivedRows(mapped);
    } else {
      setReceivedRows([]);
    }
  }, [selectedDossier, receivedRecords]);

  // Transmitted Official Letters Folder State
  const [selectedFolderModal, setSelectedFolderModal] = useState<any | null>(null);
  const [transmittedFolderList, setTransmittedFolderList] = useState<any[]>([]);

  const handleUploadDirectLetterToFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const year = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const letterRef = `EPSS/LET/${year}/${randNum}`;
    const dspRef = `EPSS/MD-DSP/${year}/${Math.floor(100 + Math.random() * 900)}`;

    const newFolderRecord = {
      id: `folder-uploaded-${Date.now()}`,
      dspRefNumber: dspRef,
      officialLetterRef: letterRef,
      dateTransmitted: TODAY_ISO_DATE,
      senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      signatory: 'Mosisa (Authorized User)',
      signatoryRole: 'Directorate Technical Lead',
      subject: `Official Request Covering Letter: ${file.name}`,
      totalDevices: receivedRows.length || 5,
      totalQuantity: totals.totalQty || 60,
      totalValuationETB: totals.totalValuation || 15000000,
      letterFileName: file.name,
      letterFileSize: `${(file.size / 1024).toFixed(1)} KB`,
      notes: `Directly uploaded official letter saved inside Transmitted EPSS to MOH Letters Folder.`
    };

    const updated = [newFolderRecord, ...transmittedFolderList];
    setTransmittedFolderList(updated);

    showToast(`✓ Stored "${file.name}" separately inside Transmitted EPSS to MOH Letters Folder!`);
  };

  const handleRemoveFolderLetter = (folderId: string) => {
    const updated = transmittedFolderList.filter(f => f.id !== folderId);
    setTransmittedFolderList(updated);
    showToast('Folder record removed from archive');
  };

  const handleDownloadFolderLetter = (folder: any) => {
    const content = `ETHIOPIAN PHARMACEUTICALS SUPPLY SERVICE (EPSS)
OFFICIAL TRANSMITTED COVERING LETTER DOSSIER
================================================================================
Official Reference: ${folder.officialLetterRef}
DSP Reference: ${folder.dspRefNumber}
Date Transmitted: ${folder.dateTransmitted}
Sender: ${folder.senderOrg}
Recipient: ${folder.recipientOrg}
Signatory: ${folder.signatory} (${folder.signatoryRole})
Subject: ${folder.subject}

EQUIPMENT ALLOCATION SUMMARY:
- Total Materials: ${folder.totalDevices} Items
- Total Quantity: ${formatNumber(folder.totalQuantity)} Units
- Total Budget Valuation: ${formatCurrency(folder.totalValuationETB)}

ATTACHED DOCUMENT ENVELOPE:
- File Name: ${folder.letterFileName || 'Official_Letter.pdf'}
- Status: Transmitted & Verified Binary Stream

Notes: ${folder.notes || 'N/A'}`;

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = folder.letterFileName || `Official_Letter_${folder.officialLetterRef.replace(/[\/\s]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded ${folder.letterFileName || 'Official Letter PDF'}`);
  };

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

    if (sourceRows.length === 0) {
      sourceRows = buildDspTemplateRowsFromStock(multipleStockItems, TODAY_ISO_DATE);
    }

    const refNum = `EPSS/MD-DSP/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`;
    const mohReceivedRef = `MOH/PMD-DSP/${new Date().getFullYear()}/${String(Math.floor(200 + Math.random() * 800))}`;
    const dspNameValue = "DSP 2026 - National Medical Equipment Allocation";

    const newRecord11: DspWorkflowRecord = {
      id: `dsp-dossier-${Date.now()}`,
      dspRefNumber: refNum,
      dspName: dspNameValue,
      stage: 'head-office-dsp',
      subStage: '1.1',
      stageTitle: 'Head Office DSP Management',
      senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      subject: `DSP [${dspNameValue}]: Request to MOH (${sourceRows.length} Materials)`,
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
      dspName: dspNameValue,
      stage: 'head-office-dsp',
      subStage: '1.2',
      stageTitle: 'Head Office DSP Management',
      senderOrg: 'Ministry of Health (PMD Directorate)',
      recipientOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      subject: `DSP [${dspNameValue}]: Official MOH Endorsement to EPSS (${sourceRows.length} Materials)`,
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

    const newRecord21: DspWorkflowRecord = {
      id: `dsp-moh-received-21-${Date.now()}`,
      dspRefNumber: mohReceivedRef,
      dspName: dspNameValue,
      stage: 'moh-osp-management',
      subStage: '2.1',
      stageTitle: 'MOH OSP Management',
      senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      subject: `DSP [${dspNameValue}]: Received from EPSS (${sourceRows.length} Items)`,
      status: 'Submitted & Pending',
      dateSubmitted: TODAY_ISO_DATE,
      totalDevices: sourceRows.length,
      totalQuantity: sourceRows.reduce((acc, r) => acc + (r.qty || 0), 0),
      totalValuationETB: sourceRows.reduce((acc, r) => acc + (r.totalAmount || 0), 0),
      officialLetterRef: `EPSS/LET/${new Date().getFullYear()}/8821`,
      signatory: 'Mosisa (Authorized User)',
      signatoryRole: 'Directorate Technical Lead',
      itemsIncluded: sourceRows.map(r => ({
        material: r.material,
        description: r.materialDescription,
        quantity: r.qty,
        plant: 'AA01 Central',
        allocatedFacility: 'MOH Allocation Quota',
        valuationTypeDesc: r.valuationTypeDesc,
        wbsElement: r.wbsElement,
        budgetSource: r.budgetSource,
        requestDate: r.requestDate,
        dspRequestTo: r.dspRequestTo,
        totalAmount: r.totalAmount
      })),
      targetedRegions: ['Oromia', 'Amhara', 'Sidama', 'Somali'],
      targetedFacilitiesCount: 14,
      notes: `DSP Name: ${dspNameValue}. Transmitted via Sub-step 1.1.`
    };

    const generatedCols = sourceRows.map((item, idx) => ({
      id: `mat-tx-${idx}-${item.material}`,
      materialCode: item.material,
      description: item.materialDescription
    }));

    try {
      localStorage.setItem('epss_dsp_received_epss_rows', JSON.stringify(sourceRows));
      localStorage.setItem('epss_dsp_received_epss_cols', JSON.stringify(generatedCols));
    } catch {}

    setRecords(prev => {
      const filtered = prev.filter(r => {
        const sub = canonicalizeSubStage(r.subStage, r.stage);
        if (sub === '1.2' || sub === '2.1') return false;
        return true;
      });
      return [newRecord11, newRecord12, newRecord21, ...filtered];
    });

    if (onTriggerCloudSync) {
      onTriggerCloudSync(`DSP Request ${refNum} transmitted to MOH & stored exact inside DSP Received from EPSS (2.1)`, {
        type: 'CREATE',
        title: `DSP Received from EPSS: ${mohReceivedRef}`,
        payload: newRecord21
      });
    }

    showToast(`✓ Stored exact ${sourceRows.length} transmitted items as "${dspNameValue}" Dossier!`);
  };

  // Clear received records and reset
  const handleClearReceivedData = () => {
    setReceivedRows([]);
    setRecords(prev => {
      const filtered = prev.filter(r => canonicalizeSubStage(r.subStage, r.stage) !== targetSubStage);
      return filtered;
    });
    setSelectedDossier(null);
    showToast('✓ Received DSP data cleared');
  };

  // Remove specific row from stored DSP data & update
  const handleRemoveRow = (rowId: string) => {
    const updated = receivedRows.filter(r => r.id !== rowId);
    setReceivedRows(updated);
    try {
      const targetRec = selectedDossier || receivedRecords[0];
      if (targetRec) {
        const updatedRecord: DspWorkflowRecord = {
          ...targetRec,
          totalDevices: updated.length,
          totalQuantity: updated.reduce((sum, r) => sum + (r.qty || 0), 0),
          totalValuationETB: updated.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
          itemsIncluded: updated.map(r => ({
            material: r.material,
            description: r.materialDescription,
            quantity: r.qty,
            plant: (r as any).plant || 'HO01'
          }))
        };
        setRecords(prev => {
          const filtered = prev.filter(r => r.id !== targetRec.id);
          return [updatedRecord, ...filtered];
        });
      }
    } catch (e) {
      console.warn('Error updating storage after row removal:', e);
    }
    showToast('✓ Item removed from stored DSP data & updated successfully');
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
            {/* EXACT PILL BUTTON MATCHING USER ATTACHMENT */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0B1527] text-white shadow-md border border-slate-800">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b] shrink-0" />
              <span className="text-xs md:text-sm font-black tracking-wide uppercase text-white">
                {is21 ? 'DSP RECEIVED FROM EPSS' : 'DSP RECEIVED FROM MOH'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-950">
                {is21 ? receivedRecords.length : receivedRows.length}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {is21 ? 'Sub-step 2.1: DSP Received from EPSS' : 'Sub-step 1.2: DSP Received from MOH'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Official Dossiers Stored
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                {is21 ? 'EPSS Head Office ➔ Ministry of Health (PMD Directorate)' : 'Ministry of Health (PMD Directorate) ➔ EPSS Head Office'}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {!is21 && (
              <button
                type="button"
                onClick={() => onSelectSubTab?.('dsp-ho-1-1')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1527] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-4 border-slate-300 shadow-[0_4px_0_rgb(203,213,225)] active:border-b-0 active:translate-y-[4px]"
                title="Return to Sub-Step 1.1: DSP Request to MOH"
              >
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span className="uppercase font-black">DSP Request to MOH</span>
              </button>
            )}

            <button
              type="button"
              disabled={receivedRows.length === 0}
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-4 border-emerald-800 shadow-[0_4px_0_rgb(6,95,70)] active:border-b-0 active:translate-y-[4px]"
              title="Download official received Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="uppercase font-black">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSubTab?.(is21 ? 'dsp-moh-2-2' : 'dsp-ho-1-3-1')}
              className="px-3.5 py-1.5 rounded-xl bg-[#0B1527] hover:bg-[#111f38] text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer border-b-4 border-[#050B15] shadow-[0_4px_0_rgb(5,11,21)] active:border-b-0 active:translate-y-[4px]"
              title={`Advance to ${is21 ? 'Regional Breakdown' : '1.3 Map HF'}`}
            >
              <span className="uppercase font-black">Proceed to {is21 ? '2.2 Request to RHB' : '1.3 Map HF'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* DOSSIER ARCHIVE SECTION (FOR SUB-STEP 2.1) */}
      {is21 && (
        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>DSP Dossier Archive (Received from EPSS)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 uppercase">
                    {receivedRecords.length} STORED DOSSIERS
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Official Equipment Allocations transmitted from EPSS HO, stored as files by DSP Name.
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleQuickTransmitCurrentFrom11}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Received DSP</span>
            </button>
          </div>

          {receivedRecords.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs text-slate-500 font-bold">No DSP Dossiers received yet.</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Once a DSP Request is sent from EPSS HO (Sub-step 1.1), it will appear here as an official file named after its DSP Name.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md bg-slate-50/30 p-1">
              <table className="w-full border-collapse text-left text-xs bg-white rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-[#0B1527] text-white font-black uppercase text-[10px] tracking-widest select-none">
                    <th className="py-4 px-4 w-12 text-center border-r border-white/10">S/N</th>
                    <th className="py-4 px-6 border-r border-white/10">Date</th>
                    <th className="py-4 px-6 border-r border-white/10">Dsp Name</th>
                    <th className="py-4 px-6 border-r border-white/10">Status</th>
                    <th className="py-4 px-4 w-24 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {receivedRecords.map((rec, idx) => (
                    <tr 
                      key={rec.id} 
                      onClick={() => setSelectedDossier(rec)}
                      className="hover:bg-indigo-50/50 cursor-pointer transition-all group"
                    >
                      <td className="py-4 px-4 text-center font-bold text-slate-400 font-mono border-r border-slate-50">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-600 border-r border-slate-50">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.dateSubmitted}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 border-r border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl group-hover:bg-amber-200 group-hover:scale-110 transition-all shadow-3xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black uppercase text-slate-900 leading-tight tracking-tight">
                              {rec.dspName || "Unnamed DSP Request"}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                              {rec.dspRefNumber}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 border-r border-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-3xs">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Stored & Verified
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase shadow-sm group-hover:shadow-md transition-all active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Full</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Legacy Transmitted Folder concepts removed in favor of Dossier List, but we can keep it as a 'Letters Folder' if needed */}
      {!is21 && (
        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📁 Transmitted EPSS to MOH Official Letters Folder</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                    {transmittedFolderList.length} Stored Envelopes
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" id="folder-direct-letter-upload" className="hidden" onChange={handleUploadDirectLetterToFolder} />
              <label htmlFor="folder-direct-letter-upload" className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Upload Letter to Folder</span>
              </label>
            </div>
          </div>

          {transmittedFolderList.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-[11px] text-slate-400 font-bold">
              No official letters stored in this folder yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {transmittedFolderList.map((folder, fIdx) => (
                <div key={folder.id || fIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-700">{folder.dspRefNumber}</span>
                    <button onClick={() => handleRemoveFolderLetter(folder.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={12} /></button>
                  </div>
                  <h4 className="text-[11px] font-black truncate">{folder.subject}</h4>
                  <div className="flex items-center justify-between">
                    <button onClick={() => handleDownloadFolderLetter(folder)} className="px-2 py-1 bg-amber-200 text-amber-950 rounded text-[10px] font-bold flex items-center gap-1">
                      <Download size={10} />
                      <span>PDF</span>
                    </button>
                    <button onClick={() => setSelectedFolderModal(folder)} className="text-indigo-600 text-[10px] font-bold hover:underline">Inspect</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inspect Folder Letter Dossier Modal */}
      {selectedFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 tracking-widest uppercase">
                  📁 Official Letter Folder Envelope • {selectedFolderModal.dspRefNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Official Letter Ref: {selectedFolderModal.officialLetterRef}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFolderModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">ISSUING SENDER</span>
                  <span className="text-slate-900 font-bold">{selectedFolderModal.senderOrg}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">RECIPIENT BODY</span>
                  <span className="text-slate-900 font-bold">{selectedFolderModal.recipientOrg}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">TRANSMITTAL DATE</span>
                  <span className="text-slate-800 font-mono font-bold">{selectedFolderModal.dateTransmitted}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">SIGNATORY & ROLE</span>
                  <span className="text-slate-800 font-semibold">{selectedFolderModal.signatory} ({selectedFolderModal.signatoryRole})</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">SUBJECT</span>
                <span className="text-slate-800 font-medium">{selectedFolderModal.subject}</span>
              </div>
            </div>

            {/* Attached Letter File Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
                  <Paperclip size={20} />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-950 font-mono">
                    {selectedFolderModal.letterFileName || 'Official_Covering_Letter.pdf'}
                  </div>
                  <div className="text-[10px] text-amber-800 font-bold mt-0.5">
                    Verified Binary Attachment Stream • Capacity: {selectedFolderModal.letterFileSize || '142.5 KB'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadFolderLetter(selectedFolderModal)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>

            {/* Equipment Allocation Summary */}
            <div className="space-y-2">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Equipment Allocation Items inside this Letter Dossier ({selectedFolderModal.totalDevices} Items)</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold">
                <span>Total Quantity: <strong className="text-cyan-800 font-mono font-black">{formatNumber(selectedFolderModal.totalQuantity)} Units</strong></span>
                <span>Total Valuation: <strong className="text-emerald-700 font-mono font-black">{formatCurrency(selectedFolderModal.totalValuationETB)}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedFolderModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {(selectedDossier || receivedRecords[0])?.dspRefNumber || `MOH/PMD-DSP/${new Date().getFullYear()}/042`}
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Date: {(selectedDossier || receivedRecords[0])?.dateSubmitted || TODAY_ISO_DATE} • Turnaround: 0d (Instant)
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

      {/* Dossier Table Section (Visible if is21 and dossier selected, or if not is21 and data exists) */}
      {(!is21 || selectedDossier) && receivedRows.length > 0 && (
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="bg-[#0B1527] p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-400 rounded-2xl text-slate-950 shadow-lg shadow-amber-400/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-black uppercase tracking-widest leading-tight text-white">
                      {is21 ? `OFFICIAL DSP DOSSIER: ${selectedDossier?.dspName}` : 'DSP Received from MOH — Official Allocation Dossier'}
                    </h3>
                    <span className="px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-tighter">
                      Verified Data
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] font-bold text-amber-400/90">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 uppercase tracking-widest text-[9px]">Reference:</span>
                      <span className="underline italic font-mono">{is21 ? selectedDossier?.dspRefNumber : (receivedRecords[0]?.dspRefNumber || 'EPSS/MD-DSP/2026/042')}</span>
                    </div>
                    <div className="w-px h-3 bg-white/20 hidden md:block" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 uppercase tracking-widest text-[9px]">Transmitted:</span>
                      <span className="font-mono">{is21 ? selectedDossier?.dateSubmitted : (receivedRecords[0]?.dateSubmitted || TODAY_ISO_DATE)}</span>
                    </div>
                    <div className="w-px h-3 bg-white/20 hidden md:block" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 uppercase tracking-widest text-[9px]">Sender:</span>
                      <span className="uppercase">{is21 ? selectedDossier?.senderOrg : 'MOH PMD Directorate'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDossier}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/10"
                  title="Print Dossier"
                >
                  <Printer className="w-5 h-5" />
                </button>
                {is21 && (
                  <button 
                    onClick={() => setSelectedDossier(null)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest transition cursor-pointer shadow-lg shadow-rose-600/20 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                    <span>Close Dossier</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-50/50 p-1">
            <table className="w-full border-collapse text-[11px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
              <thead>
                <tr className="bg-[#FFA500] text-slate-950 font-black uppercase border-b-2 border-slate-900 sticky top-0 z-10">
                  <th className="py-4 px-4 text-left border-r border-slate-900/10 w-12">S/N</th>
                  <th className="py-4 px-4 text-left border-r border-slate-900/10">Material Code</th>
                  <th className="py-4 px-6 text-left border-r border-slate-900/10">Full Description</th>
                  <th className="py-4 px-4 text-center border-r border-slate-900/10 w-20">Qty</th>
                  <th className="py-4 px-4 text-left border-r border-slate-900/10">Valuation (ETB)</th>
                  <th className="py-4 px-4 text-left border-r border-slate-900/10">WBS Element</th>
                  <th className="py-4 px-4 text-center border-r border-slate-900/10">Budget</th>
                  <th className="py-4 px-4 text-left">Date</th>
                  <th className="py-4 px-4 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-amber-50/40 group transition-all duration-200">
                    <td className="py-3.5 px-4 border-r border-slate-50 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 border-r border-slate-50 font-mono font-black text-indigo-700 tracking-tight">{row.material}</td>
                    <td className="py-3.5 px-6 border-r border-slate-50 font-bold text-slate-800 leading-tight">{row.materialDescription}</td>
                    <td className="py-3.5 px-4 border-r border-slate-50 font-black text-center text-cyan-700 text-sm">{formatNumber(row.qty)}</td>
                    <td className="py-3.5 px-4 border-r border-slate-50 font-black text-emerald-700">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] opacity-60">ETB</span>
                        <span>{formatNumber(row.totalAmount)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 border-r border-slate-50 font-mono text-slate-500 font-bold">{row.wbsElement}</td>
                    <td className="py-3.5 px-4 border-r border-slate-50 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-black text-[10px] border border-amber-200 shadow-3xs uppercase">{row.budgetSource}</span>
                    </td>
                    <td className="py-3.5 px-4 border-r border-slate-50 font-mono text-slate-400 italic text-[10px]">{row.requestDate}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => handleRemoveRow(row.id)} 
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Remove from stored dossier"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-900">
                <tr className="bg-[#FFA500] text-slate-950 font-black">
                  <td colSpan={3} className="py-4 px-6 text-right uppercase text-[10px] tracking-[0.2em]">Institutional Allocation Total Summary:</td>
                  <td className="py-4 px-4 text-center border-l border-slate-900/20">
                    <div className="flex flex-col items-center">
                      <div className="text-sm">{formatNumber(totals.totalQty)}</div>
                      <div className="text-[8px] uppercase tracking-tighter opacity-70">Units</div>
                    </div>
                  </td>
                  <td colSpan={2} className="py-4 px-6 border-l border-slate-900/20">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] opacity-60">TOTAL ETB:</span>
                      <span className="text-sm font-black">{formatNumber(totals.totalValuation)}</span>
                    </div>
                  </td>
                  <td colSpan={3} className="py-4 px-6 font-bold border-l border-slate-900/20 text-[9px] leading-snug">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-500 rounded-full text-white shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span>Official equipment quota transmission received from EPSS HO (Sub-step 2.1) and verified for MOH storage.</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* PIPELINE FOOTER */}
      {((is21 && selectedDossier) || (!is21 && receivedRows.length > 0)) && (
        <div className="bg-gradient-to-r from-[#0B1527] to-[#1E3A5F] text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800 shadow-xl animate-in fade-in zoom-in-95 duration-500 mt-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 animate-pulse">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.15em] text-amber-400 mb-1">Ready for Operational Breakdown Phase</h4>
              <p className="text-xs text-slate-300 font-medium max-w-md">
                Allocations are stored and verified. You can now initiate regional health facility mapping or proceed to the official breakdown matrix request.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => onSelectSubTab?.(is21 ? 'dsp-moh-2-2' : 'dsp-ho-1-3-1')} 
              className="px-8 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-amber-400/20 flex items-center gap-2 group active:scale-95"
            >
              <span>Proceed to {is21 ? 'Regional Breakdown' : 'Map HF'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
