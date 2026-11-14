import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  Search,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  Calendar,
  Sparkles,
  Clock,
  ShieldCheck,
  FolderArchive,
  FileText,
  Paperclip,
  Eye,
  X,
  Check,
  Printer,
  Trash2,
  ChevronDown,
  MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  DspRequestTemplateRow,
  DSP_REQUEST_TEMPLATE_COLUMNS,
  TODAY_ISO_DATE,
  buildDspTemplateRowsFromStock
} from '../data/defaultDspRequestTemplateData';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';

interface DspReceivedFromMohViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  multipleStockItems?: MultipleStockRecord[];
  subStageTarget?: '1.2' | '2.1';
  onSelectSubTab?: (tab: EpssSubTab) => void;
  onProceedToMapHf?: (dossier: DspWorkflowRecord) => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

interface MatrixColumnView {
  id: string;
  name: string;
  code: string;
}

interface MatrixRowView {
  id: string;
  date?: string;
  region: string;
  zone: string;
  woreda: string;
  healthFacility: string;
  packages: string;
  quantities: Record<string, number>;
}

export const DspReceivedFromMohView: React.FC<DspReceivedFromMohViewProps> = ({
  records,
  setRecords,
  multipleStockItems = [],
  subStageTarget = '1.2',
  onSelectSubTab,
  onProceedToMapHf,
  onTriggerCloudSync
}) => {
  const is21 = subStageTarget === '2.1';
  const targetSubStage = is21 ? '2.1' : '1.2';

  // Strictly filter dossiers for ONLY the target directional sub-step (no cross-stage bleed or mock defaults)
  const receivedRecords = useMemo(() => {
    return records
      .filter(r => canonicalizeSubStage(r.subStage, r.stage) === targetSubStage)
      .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records, targetSubStage]);

  const [selectedDossierId, setSelectedDossierId] = useState<string>('');
  const [showArchiveMatrix, setShowArchiveMatrix] = useState(!is21);

  useEffect(() => {
    setShowArchiveMatrix(!is21);
  }, [is21]);

  useEffect(() => {
    if (receivedRecords.length > 0 && !receivedRecords.some(r => r.id === selectedDossierId)) {
      setSelectedDossierId(receivedRecords[0].id);
    } else if (receivedRecords.length === 0 && selectedDossierId) {
      setSelectedDossierId('');
    }
  }, [receivedRecords, selectedDossierId]);

  const activeRecord = useMemo(() => {
    return receivedRecords.find(r => r.id === selectedDossierId) || receivedRecords[0] || null;
  }, [receivedRecords, selectedDossierId]);

  // ---------------------------------------------------------------------------
  // 2.1 (EPSS -> MOH): Exact 10-column rows from activeRecord.itemsIncluded
  // ---------------------------------------------------------------------------
  const [receivedRows21, setReceivedRows21] = useState<DspRequestTemplateRow[]>([]);

  useEffect(() => {
    if (!is21) {
      setReceivedRows21([]);
      return;
    }
    if (activeRecord && activeRecord.itemsIncluded && activeRecord.itemsIncluded.length > 0) {
      const mapped: DspRequestTemplateRow[] = activeRecord.itemsIncluded.map((it: any, idx: number) => ({
        id: `rec-item-${idx}-${activeRecord.id}`,
        srNo: idx + 1,
        material: it.material,
        materialDescription: it.description || it.materialDescription || 'Medical Equipment',
        qty: Number(it.quantity ?? it.qty ?? 0),
        totalAmount: Number(it.totalAmount ?? 0),
        valuationTypeDesc: it.valuationTypeDesc || 'Standard Price (S)',
        wbsElement: it.wbsElement || '-',
        budgetSource: it.budgetSource || 'WB',
        requestDate: it.requestDate || activeRecord.dateSubmitted || TODAY_ISO_DATE,
        dspRequestTo: it.dspRequestTo || activeRecord.recipientOrg || 'Ministry of Health (PMD Directorate)'
      }));
      setReceivedRows21(mapped);
    } else {
      setReceivedRows21([]);
    }
  }, [is21, activeRecord]);

  // ---------------------------------------------------------------------------
  // 1.2 (MOH -> EPSS): Exact Health Facility Breakdown Matrix sent from 2.5
  // ---------------------------------------------------------------------------
  const mohMatrixData = useMemo<{
    date: string;
    columns: MatrixColumnView[];
    rows: MatrixRowView[];
  }>(() => {
    if (is21 || !activeRecord) {
      return { date: TODAY_ISO_DATE, columns: [], rows: [] };
    }
    const source = activeRecord.stage4MatrixData || activeRecord.facilityMatrixData;
    if (!source) {
      return { date: activeRecord.dateSubmitted || TODAY_ISO_DATE, columns: [], rows: [] };
    }
    return {
      date: source.date || activeRecord.dateSubmitted || TODAY_ISO_DATE,
      columns: (source.columns || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code
      })),
      rows: (source.rows || []).map((r: any, idx: number) => ({
        id: r.id || `moh-hf-row-${idx}`,
        date: r.date || source.date || activeRecord.dateSubmitted || TODAY_ISO_DATE,
        region: r.region || 'Unspecified',
        zone: r.zone || '-',
        woreda: r.woreda || '-',
        healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
        packages: r.packages || 'MCH',
        quantities: r.quantities || {}
      }))
    };
  }, [is21, activeRecord]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [regionFilter12, setRegionFilter12] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFolderModal, setSelectedFolderModal] = useState<any | null>(null);
  const [transmittedFolderList, setTransmittedFolderList] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Totals for 2.1 (EPSS -> MOH)
  const totals21 = useMemo(() => {
    const totalQty = receivedRows21.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalValuation = receivedRows21.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const uniqueBudgets = Array.from(new Set(receivedRows21.map(r => r.budgetSource).filter(Boolean)));
    return {
      lineItemsCount: receivedRows21.length,
      totalQty,
      totalValuation,
      uniqueBudgets
    };
  }, [receivedRows21]);

  const filteredRows21 = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return receivedRows21.filter(row => {
      const matchSearch =
        !q ||
        row.material.toLowerCase().includes(q) ||
        row.materialDescription.toLowerCase().includes(q) ||
        row.wbsElement.toLowerCase().includes(q) ||
        row.valuationTypeDesc.toLowerCase().includes(q) ||
        row.budgetSource.toLowerCase().includes(q);

      const matchBudget = budgetFilter === 'all' || row.budgetSource.toLowerCase() === budgetFilter.toLowerCase();
      return matchSearch && matchBudget;
    });
  }, [receivedRows21, searchQuery, budgetFilter]);

  // Totals & Filters for 1.2 (MOH -> EPSS Matrix)
  const uniqueRegions12 = useMemo(() => {
    return Array.from(new Set(mohMatrixData.rows.map(r => r.region).filter(Boolean))).sort();
  }, [mohMatrixData.rows]);

  const filteredMatrixRows12 = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return mohMatrixData.rows.filter(r => {
      const matchRegion = regionFilter12 === 'all' || r.region === regionFilter12;
      const matchSearch =
        !q ||
        r.region.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.woreda.toLowerCase().includes(q) ||
        r.healthFacility.toLowerCase().includes(q) ||
        r.packages.toLowerCase().includes(q);
      return matchRegion && matchSearch;
    });
  }, [mohMatrixData.rows, regionFilter12, searchQuery]);

  const matrix12ColumnTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    mohMatrixData.columns.forEach(c => {
      sums[c.id] = filteredMatrixRows12.reduce((acc, r) => acc + (Number(r.quantities[c.id]) || 0), 0);
    });
    return sums;
  }, [mohMatrixData.columns, filteredMatrixRows12]);

  const matrix12GrandTotal = useMemo(() => {
    return Object.values(matrix12ColumnTotals).reduce((a, b) => a + b, 0);
  }, [matrix12ColumnTotals]);

  // ---------------------------------------------------------------------------
  // Covering Letter Downloads / Uploads
  // ---------------------------------------------------------------------------
  const handleDownloadDossierLetter = (dossier: DspWorkflowRecord | null) => {
    if (!dossier) return;
    const isMohToEpss = !is21;
    const linesText = isMohToEpss && mohMatrixData.rows.length > 0
      ? mohMatrixData.rows
          .map((r, i) => {
            const rowSum = mohMatrixData.columns.reduce((s, c) => s + (Number(r.quantities[c.id]) || 0), 0);
            return `${i + 1}. ${r.region} | ${r.zone} | ${r.woreda} | ${r.healthFacility} (${r.packages}) — ${rowSum} Units`;
          })
          .join('\n')
      : (dossier.itemsIncluded || [])
          .map(
            (it: any, i: number) =>
              `${i + 1}. [${it.material}] ${it.description} — Qty: ${it.quantity} | Valuation: ${it.valuationTypeDesc || 'Standard'} | WBS: ${it.wbsElement || '-'} | Budget: ${it.budgetSource || 'WB'} | Total: ${formatCurrency(it.totalAmount || 0)}`
          )
          .join('\n');

    const content = `FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
${isMohToEpss ? 'MINISTRY OF HEALTH (MOH) — PMD DIRECTORATE' : 'ETHIOPIAN PHARMACEUTICALS SUPPLY SERVICE (EPSS) — HEAD OFFICE'}
OFFICIAL DOSSIER RECORD
================================================================================
DSP Reference Number: ${dossier.dspRefNumber}
DSP Dossier Name: ${dossier.dspName || dossier.subject}
Official Letter Ref: ${dossier.officialLetterRef || '-'}
Submission Date: ${dossier.dateSubmitted || TODAY_ISO_DATE}
Sender Organization: ${dossier.senderOrg}
Recipient Organization: ${dossier.recipientOrg}
Authorized Signatory: ${dossier.signatory} (${dossier.signatoryRole})
Official Status: ${dossier.status}

SUMMARY METRICS:
- Total Equipment Types: ${dossier.totalDevices || (dossier.itemsIncluded?.length || 0)}
- Total Allocation Quantity: ${formatNumber(dossier.totalQuantity || 0)} Units
- Targeted Facilities: ${dossier.targetedFacilitiesCount || mohMatrixData.rows.length} Facilities
- Targeted Regions: ${(dossier.targetedRegions || []).join(', ') || 'National'}

TRANSMITTED DATA PAYLOAD:
${linesText || 'No line items.'}

Note: ${dossier.notes || 'Official transmitted dossier.'}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DSP_Official_Dossier_${dossier.dspRefNumber.replace(/[\/\s]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded Official Dossier Summary (${dossier.dspRefNumber})`);
  };

  const handleUploadDirectLetterToFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const year = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newFolderRecord = {
      id: `folder-uploaded-${Date.now()}`,
      dspRefNumber: activeRecord?.dspRefNumber || `MOH/LET/${year}/${randNum}`,
      officialLetterRef: `MOH/LET/${year}/${randNum}`,
      dateTransmitted: TODAY_ISO_DATE,
      senderOrg: 'Ministry of Health (PMD Directorate)',
      recipientOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      signatory: activeRecord?.signatory || 'MOH Authorized Officer',
      signatoryRole: activeRecord?.signatoryRole || 'PMD Directorate',
      subject: `Official Covering Letter: ${file.name}`,
      totalDevices: mohMatrixData.columns.length,
      totalQuantity: matrix12GrandTotal,
      totalValuationETB: activeRecord?.totalValuationETB || 0,
      letterFileName: file.name,
      letterFileSize: `${(file.size / 1024).toFixed(1)} KB`,
      notes: 'Uploaded official MOH covering letter attachment.'
    };

    setTransmittedFolderList(prev => [newFolderRecord, ...prev]);
    showToast(`✓ Stored "${file.name}" inside Official Letter Folder!`);
  };

  const handleDownloadFolderLetter = (folder: any) => {
    const content = `OFFICIAL TRANSMITTED COVERING LETTER DOSSIER
Reference: ${folder.officialLetterRef}
DSP Reference: ${folder.dspRefNumber}
Date: ${folder.dateTransmitted}
Sender: ${folder.senderOrg}
Recipient: ${folder.recipientOrg}
Signatory: ${folder.signatory} (${folder.signatoryRole})
Subject: ${folder.subject}
Attachment: ${folder.letterFileName}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = folder.letterFileName || `Official_Letter_${folder.officialLetterRef.replace(/[\/\s]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded ${folder.letterFileName || 'Official Letter'}`);
  };

  // ---------------------------------------------------------------------------
  // Simulate 1.1 -> 2.1 (ONLY in 2.1 view, preserving existing dossiers)
  // ---------------------------------------------------------------------------
  const handleQuickTransmitCurrentFrom11 = () => {
    const allStockHp = buildDspTemplateRowsFromStock(multipleStockItems, TODAY_ISO_DATE);
    const sourceRows = allStockHp.slice(0, 5);
    if (sourceRows.length === 0) {
      showToast('No stock items available in Program HP stock.');
      return;
    }

    const refNum = `EPSS/MD-DSP/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`;
    const dspNameValue = `DSP ${new Date().getFullYear()} - National Medical Equipment Request`;

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
      targetedRegions: ['National'],
      targetedFacilitiesCount: 0,
      officialLetterRef: `EPSS/LET/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000))}`,
      signatory: 'EPSS HO Directorate',
      signatoryRole: 'Directorate Technical Lead',
      itemsIncluded: sourceRows.map(r => ({
        material: r.material,
        description: r.materialDescription,
        quantity: r.qty,
        plant: 'HO01 Central',
        valuationTypeDesc: r.valuationTypeDesc,
        wbsElement: r.wbsElement,
        budgetSource: r.budgetSource,
        requestDate: r.requestDate,
        dspRequestTo: r.dspRequestTo,
        totalAmount: r.totalAmount
      })),
      notes: 'Transmitted via 10-Column Standard EPSS-to-MOH DSP Request Template.'
    };

    const newRecord21: DspWorkflowRecord = {
      ...newRecord11,
      id: `dsp-moh-received-21-${Date.now()}`,
      stage: 'moh-osp-management',
      subStage: '2.1',
      stageTitle: 'MOH DSP Management',
      subject: `DSP [${dspNameValue}]: Received from EPSS (${sourceRows.length} Items)`
    };

    setRecords(prev => [newRecord11, newRecord21, ...prev]);
    setSelectedDossierId(newRecord21.id);

    onTriggerCloudSync?.(
      `DSP Request ${refNum} stored in 1.1 & 2.1 (EPSS -> MOH)`,
      {
        type: 'CREATE',
        title: `DSP Received from EPSS: ${refNum}`,
        payload: newRecord21
      }
    );

    showToast(`✓ Stored exact ${sourceRows.length} EPSS->MOH items as "${dspNameValue}"!`);
  };

  // Clear current subStage records
  const handleClearReceivedData = () => {
    setRecords(prev => prev.filter(r => canonicalizeSubStage(r.subStage, r.stage) !== targetSubStage));
    setSelectedDossierId('');
    showToast(`✓ Cleared ${is21 ? '2.1 Received from EPSS' : '1.2 Received from MOH'} dossiers`);
  };

  // ---------------------------------------------------------------------------
  // Exports (Direction-Specific!)
  // ---------------------------------------------------------------------------
  const handleDownloadExcel = () => {
    if (is21) {
      // Exact 10-Column EPSS -> MOH Excel Export
      const exportData = receivedRows21.map((r, idx) => ({
        'S/N': idx + 1,
        'Material': r.material,
        'Material Description': r.materialDescription,
        'Qty': r.qty,
        'Total Amount': r.totalAmount,
        'Valuation Type Desc': r.valuationTypeDesc,
        'WBS Element': r.wbsElement,
        'Budget Source': r.budgetSource,
        'Request Date': r.requestDate || TODAY_ISO_DATE,
        'DSP Request to': r.dspRequestTo || 'Ministry of Health (PMD Directorate)'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 44 },
        { wch: 10 },
        { wch: 18 },
        { wch: 24 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 32 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DSP_Received_from_EPSS');
      XLSX.writeFile(workbook, `DSP_Received_from_EPSS_${TODAY_ISO_DATE}.xlsx`);
      showToast('✓ Downloaded 10-Column DSP Received from EPSS Excel');
      return;
    }

    // 1.2 (MOH -> EPSS): Exact Two-Tier Health Facility Breakdown Matrix Export
    const cols = mohMatrixData.columns;
    const headerRow1 = [
      'S/N',
      'Date',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packages',
      ...cols.map(c => c.name),
      'Total'
    ];
    const headerRow2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      'List of Packages',
      ...cols.map(c => c.code),
      ''
    ];
    const bodyRows = filteredMatrixRows12.map((r, idx) => {
      const rowTotal = cols.reduce((s, c) => s + (Number(r.quantities[c.id]) || 0), 0);
      return [
        idx + 1,
        r.date || mohMatrixData.date,
        r.region,
        r.zone,
        r.woreda,
        r.healthFacility,
        r.packages,
        ...cols.map(c => Number(r.quantities[c.id]) || 0),
        rowTotal
      ];
    });
    const footerRow = [
      '',
      '',
      'TOTAL',
      '',
      '',
      `${filteredMatrixRows12.length} Facilities`,
      '',
      ...cols.map(c => matrix12ColumnTotals[c.id] || 0),
      matrix12GrandTotal
    ];

    const ws = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...bodyRows, footerRow]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 13 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 34 },
      { wch: 16 },
      ...cols.map(() => ({ wch: 20 })),
      { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MOH_to_EPSS_HF_Matrix');
    XLSX.writeFile(wb, `DSP_Received_from_MOH_HF_Matrix_${TODAY_ISO_DATE}.xlsx`);
    showToast('✓ Downloaded MOH to EPSS Health Facility Matrix Excel');
  };

  const handleDownloadCSV = () => {
    const esc = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    if (is21) {
      const headers = DSP_REQUEST_TEMPLATE_COLUMNS.join(',');
      const lines = receivedRows21.map((r, idx) =>
        [
          idx + 1,
          esc(r.material),
          esc(r.materialDescription),
          r.qty,
          r.totalAmount,
          esc(r.valuationTypeDesc),
          esc(r.wbsElement),
          esc(r.budgetSource),
          esc(r.requestDate || TODAY_ISO_DATE),
          esc(r.dspRequestTo || 'Ministry of Health (PMD Directorate)')
        ].join(',')
      );
      const csvContent = [headers, ...lines].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSP_Received_from_EPSS_${TODAY_ISO_DATE}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✓ Downloaded 10-Column CSV');
      return;
    }

    const cols = mohMatrixData.columns;
    const row1 = [
      'S/N',
      'Date',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packages',
      ...cols.map(c => c.name),
      'Total'
    ];
    const row2 = ['', '', '', '', '', '', 'List of Packages', ...cols.map(c => c.code), ''];
    const dataLines = filteredMatrixRows12.map((r, idx) => {
      const rowTotal = cols.reduce((s, c) => s + (Number(r.quantities[c.id]) || 0), 0);
      return [
        idx + 1,
        esc(r.date || mohMatrixData.date),
        esc(r.region),
        esc(r.zone),
        esc(r.woreda),
        esc(r.healthFacility),
        esc(r.packages),
        ...cols.map(c => Number(r.quantities[c.id]) || 0),
        rowTotal
      ].join(',');
    });
    const csvContent = [row1.map(esc).join(','), row2.map(esc).join(','), ...dataLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DSP_Received_from_MOH_Matrix_${TODAY_ISO_DATE}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded MOH to EPSS Matrix CSV');
  };

  const handlePrintDossier = () => {
    window.print();
  };

  const hasExportableData = is21
    ? receivedRows21.length > 0
    : mohMatrixData.rows.length > 0 || (activeRecord?.itemsIncluded?.length || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0B1527] text-white shadow-md border border-slate-800">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b] shrink-0" />
              <span className="text-xs md:text-sm font-black tracking-wide uppercase text-white">
                {is21 ? 'RECEIVED FROM EPSS' : 'RECEIVED FROM MOH'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-950">
                {receivedRecords.length}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {is21 ? '2.1 EPSS → MOH Official Request Dossiers' : '1.2 MOH → EPSS Health Facility Breakdown Dossiers'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  1-to-1 Exact Sent Data
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                {activeRecord
                  ? `Active Dossier: ${activeRecord.dspName || activeRecord.dspRefNumber}`
                  : is21
                  ? 'Awaiting DSP Request from EPSS HO (1.1)'
                  : 'Awaiting Aggregated Breakdown Matrix from MOH (2.5)'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectSubTab?.(is21 ? 'dsp-ho-1-1' : 'dsp-moh-2-5')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1527] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-4 border-slate-300 shadow-[0_4px_0_rgb(203,213,225)] active:border-b-0 active:translate-y-[4px]"
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span className="uppercase font-black">
                {is21 ? '1.1 DSP Request to MOH' : '2.5 MOH Submission'}
              </span>
            </button>

            <button
              type="button"
              disabled={!hasExportableData}
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-4 border-emerald-800 shadow-[0_4px_0_rgb(6,95,70)] active:border-b-0 active:translate-y-[4px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="uppercase font-black">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!is21 && activeRecord && onProceedToMapHf) {
                  onProceedToMapHf(activeRecord);
                } else {
                  onSelectSubTab?.(is21 ? 'dsp-moh-2-2' : 'dsp-ho-1-3-1');
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#0B1527] hover:bg-[#111f38] text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer border-b-4 border-[#050B15] shadow-[0_4px_0_rgb(5,11,21)] active:border-b-0 active:translate-y-[4px]"
            >
              <span className="uppercase font-black">
                Proceed to {is21 ? '2.2 Request to RHB' : '1.3.1 Map HF to Hub'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 2.1: RECEIVED FROM EPSS (EPSS -> MOH 10-COLUMN REQUEST DOSSIERS) */}
      {/* ===================================================================== */}
      {is21 ? (
        <div className="space-y-4">
          {/* Collapsed-by-default Archive Bar */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowArchiveMatrix(!showArchiveMatrix)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <FolderArchive className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  DSP Dossier Archive (Received from EPSS)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                  {receivedRecords.length} Dossiers
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 shrink-0 font-bold ml-2">
                <span>{showArchiveMatrix ? 'Hide Matrix' : 'View Matrix'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showArchiveMatrix ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showArchiveMatrix && (
              <div className="p-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-end pb-1">
                  <button
                    type="button"
                    onClick={handleQuickTransmitCurrentFrom11}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Received DSP (1.1 ➔ 2.1)</span>
                  </button>
                </div>

                {receivedRecords.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-600 font-bold">No DSP Dossiers received from EPSS yet.</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Send a DSP Request from Sub-step 1.1 (DSP Request to MOH) to inspect its exact 10-column line items here.
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectSubTab?.('dsp-ho-1-1')}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black uppercase cursor-pointer"
                    >
                      Go to 1.1 DSP Request to MOH
                    </button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md bg-slate-50/30 p-1">
                    <table className="w-full border-collapse text-left text-xs bg-white rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-[#0B1527] text-white font-black uppercase text-[10px] tracking-widest select-none">
                          <th className="py-4 px-4 w-12 text-center border-r border-white/10">S/N</th>
                          <th className="py-4 px-6 border-r border-white/10">Date</th>
                          <th className="py-4 px-6 border-r border-white/10">Dsp Name &amp; Ref</th>
                          <th className="py-4 px-6 border-r border-white/10">Items / Units</th>
                          <th className="py-4 px-6 border-r border-white/10">Status</th>
                          <th className="py-4 px-4 w-28 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {receivedRecords.map((rec, idx) => {
                          const isSelected = activeRecord?.id === rec.id;
                          return (
                            <tr
                              key={rec.id}
                              onClick={() => setSelectedDossierId(rec.id)}
                              className={`cursor-pointer transition-all group ${
                                isSelected ? 'bg-amber-50/80 border-l-4 border-l-amber-500' : 'hover:bg-indigo-50/50'
                              }`}
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
                                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-black uppercase text-slate-900 leading-tight tracking-tight">
                                      {rec.dspName || rec.subject}
                                    </span>
                                    <span className="text-[10px] font-mono text-indigo-700 font-bold">{rec.dspRefNumber}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 border-r border-slate-50 font-mono">
                                <span className="font-black text-slate-900">{rec.totalDevices || rec.itemsIncluded?.length || 0} Items</span>
                                <span className="text-[10px] text-cyan-800 font-bold block">{formatNumber(rec.totalQuantity || 0)} Units</span>
                              </td>
                              <td className="py-4 px-6 border-r border-slate-50">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  {rec.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-400 text-slate-950 rounded-lg font-black text-[10px] uppercase">
                                    <Check className="w-3.5 h-3.5" />
                                    Selected
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDossierId(rec.id);
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase shadow-sm cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Select</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2.1 Selected Dossier Exact 10-Column Table (EPSS -> MOH ONLY) */}
          {activeRecord ? (
            <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-[#0B1527] p-5 text-white border-b-2 border-amber-400 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-amber-400 rounded-2xl text-slate-950 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        EXACT EPSS ➔ MOH REQUEST DOSSIER (10-COLUMN FORMAT)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase">
                        {activeRecord.status}
                      </span>
                    </div>
                    <h3 className="text-base font-black uppercase text-white">
                      {activeRecord.dspName || activeRecord.subject}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-300 mt-1">
                      <span>Ref: <strong className="text-amber-300 font-mono">{activeRecord.dspRefNumber}</strong></span>
                      <span>Letter: <strong className="text-white font-mono">{activeRecord.officialLetterRef}</strong></span>
                      <span>Date: <strong className="text-white font-mono">{activeRecord.dateSubmitted}</strong></span>
                      <span>From: <strong className="text-white">{activeRecord.senderOrg}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadDossierLetter(activeRecord)}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={receivedRows21.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (10-Col)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    disabled={receivedRows21.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintDossier}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer border border-slate-700"
                    title="Print Dossier"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/70 border-b border-slate-200">
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Materials Requested</div>
                    <div className="text-xl font-black text-slate-900 font-mono">{totals21.lineItemsCount} Items</div>
                  </div>
                  <Layers className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Total Quantity</div>
                    <div className="text-xl font-black text-cyan-700 font-mono">{formatNumber(totals21.totalQty)} Units</div>
                  </div>
                  <Building2 className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Total Budget Valuation</div>
                    <div className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(totals21.totalValuation)}</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white border-b border-slate-200 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search material code, description, WBS, budget..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={budgetFilter}
                    onChange={(e) => setBudgetFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 cursor-pointer"
                  >
                    <option value="all">All Budget Sources</option>
                    {totals21.uniqueBudgets.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <span className="text-xs font-bold text-slate-500 font-mono px-2">
                    {filteredRows21.length} of {receivedRows21.length} Rows
                  </span>
                </div>
              </div>

              {/* EXACT 10-COLUMN EPSS -> MOH TABLE */}
              <div className="overflow-x-auto bg-slate-50/50 p-1">
                <table className="w-full border-collapse text-xs select-text bg-white rounded-2xl overflow-hidden border border-slate-900 shadow-md">
                  <thead>
                    <tr className="bg-[#FFA500] text-black italic font-bold text-xs md:text-sm border-b-2 border-black">
                      <th className="py-2.5 px-3 text-center border-r border-black min-w-[50px]">S/N</th>
                      <th className="py-2.5 px-3 text-left border-r border-black min-w-[140px] font-mono">Material</th>
                      <th className="py-2.5 px-3 text-left border-r border-black min-w-[260px]">Material Description</th>
                      <th className="py-2.5 px-3 text-right border-r border-black min-w-[70px]">Qty</th>
                      <th className="py-2.5 px-3 text-right border-r border-black min-w-[140px]">Total Amount</th>
                      <th className="py-2.5 px-3 text-left border-r border-black min-w-[170px]">Valuation Type Desc</th>
                      <th className="py-2.5 px-3 text-left border-r border-black min-w-[170px] font-mono">WBS Element</th>
                      <th className="py-2.5 px-3 text-center border-r border-black min-w-[120px]">Budget Source</th>
                      <th className="py-2.5 px-3 text-center border-r border-black min-w-[120px]">Request Date</th>
                      <th className="py-2.5 px-3 text-center min-w-[150px]">DSP Request to</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredRows21.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 font-bold border-b border-slate-200">
                          No materials found in this transmitted EPSS dossier.
                        </td>
                      </tr>
                    ) : (
                      filteredRows21.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-amber-50/60 transition-all border-b border-slate-200">
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-700">{idx + 1}</td>
                          <td className="py-3 px-3 border-r border-slate-200 font-mono font-black text-indigo-950">{row.material}</td>
                          <td className="py-3 px-3 border-r border-slate-200 font-bold text-slate-900">{row.materialDescription}</td>
                          <td className="py-3 px-3 border-r border-slate-200 text-right font-mono font-black text-cyan-800 text-sm">{formatNumber(row.qty)}</td>
                          <td className="py-3 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">{formatCurrency(row.totalAmount)}</td>
                          <td className="py-3 px-3 border-r border-slate-200 font-medium text-slate-700">{row.valuationTypeDesc}</td>
                          <td className="py-3 px-3 border-r border-slate-200 font-mono text-xs font-bold text-slate-800">{row.wbsElement}</td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-black uppercase">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-[10px]">
                              {row.budgetSource}
                            </span>
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-mono text-slate-600">{row.requestDate}</td>
                          <td className="py-3 px-3 text-center font-bold text-amber-900 bg-amber-50/50">{row.dspRequestTo}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs">
                      <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-amber-400 font-mono">
                        Total ({filteredRows21.length} Line Items):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-cyan-300 font-black">{formatNumber(totals21.totalQty)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400 font-black">{formatCurrency(totals21.totalValuation)}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-black text-slate-700">No DSP Requests Received from EPSS Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Transmit a 10-column DSP request from Sub-step 1.1 (DSP Request to MOH) to populate MOH&apos;s incoming dossier archive here.
              </p>
              <button
                type="button"
                onClick={() => onSelectSubTab?.('dsp-ho-1-1')}
                className="px-4 py-2 rounded-xl bg-[#0B1527] text-amber-300 text-xs font-black uppercase cursor-pointer"
              >
                Go to 1.1 DSP Request to MOH
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW 1.2: RECEIVED FROM MOH (MOH -> EPSS HEALTH FACILITY MATRIX)      */
        /* ===================================================================== */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs p-4 space-y-5">
          {/* Archive Header & List */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-xs">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Official Dossier Archive — Received from MOH</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-400 text-slate-950 uppercase">
                      {receivedRecords.length} DOSSIERS
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Exact Health Facility Breakdown Matrices transmitted from MOH PMD Directorate (Sub-step 2.5) to EPSS Head Office.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="dossier-direct-letter-upload"
                  className="hidden"
                  onChange={handleUploadDirectLetterToFolder}
                />
                <label
                  htmlFor="dossier-direct-letter-upload"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-[10px] uppercase flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Upload Covering Letter</span>
                </label>

                {receivedRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearReceivedData}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear 1.2</span>
                  </button>
                )}
              </div>
            </div>

            {transmittedFolderList.length > 0 && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="text-[11px] font-black uppercase text-indigo-950">
                  Uploaded Covering Letters ({transmittedFolderList.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {transmittedFolderList.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderModal(folder)}
                      className="p-2.5 bg-white border border-indigo-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-indigo-50"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{folder.letterFileName}</div>
                        <div className="text-[10px] font-mono text-indigo-700">{folder.officialLetterRef} • {folder.letterFileSize}</div>
                      </div>
                      <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receivedRecords.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-black text-slate-700">No MOH Breakdown Dossiers Received Yet (Sub-step 1.2)</p>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  When MOH submits the aggregated Health Facility Breakdown Matrix from Sub-step 2.5 (<strong>Send to EPSS</strong>), the exact submitted Health Facility Breakdown table will appear here automatically.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectSubTab?.('dsp-moh-2-5')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase cursor-pointer"
                >
                  Go to 2.5 DSP Aggr. Submitted to EPSS
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full border-collapse text-left text-xs bg-white">
                  <thead>
                    <tr className="bg-[#0B1527] text-white font-black uppercase text-[10px] tracking-widest select-none">
                      <th className="py-3 px-3 w-10 text-center border-r border-white/10">S/N</th>
                      <th className="py-3 px-3 border-r border-white/10">Date</th>
                      <th className="py-3 px-4 border-r border-white/10">Dossier Name &amp; Ref</th>
                      <th className="py-3 px-3 border-r border-white/10">MOH Signatory</th>
                      <th className="py-3 px-3 border-r border-white/10">Regions</th>
                      <th className="py-3 px-3 border-r border-white/10 text-right">Facilities / Units</th>
                      <th className="py-3 px-3 border-r border-white/10 text-center">Status</th>
                      <th className="py-3 px-3 text-center w-36">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {receivedRecords.map((rec, idx) => {
                      const isSelected = activeRecord?.id === rec.id;
                      const facCount =
                        rec.stage4MatrixData?.rows?.length ||
                        rec.facilityMatrixData?.rows?.length ||
                        rec.targetedFacilitiesCount ||
                        0;
                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedDossierId(rec.id)}
                          className={`cursor-pointer transition-all ${
                            isSelected ? 'bg-amber-50/80 border-l-4 border-l-amber-500' : 'hover:bg-indigo-50/40'
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-bold text-slate-500 font-mono border-r border-slate-100">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-600 border-r border-slate-100 whitespace-nowrap">
                            {rec.dateSubmitted}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-100">
                            <div className="font-black text-slate-900 uppercase">{rec.dspName || rec.subject}</div>
                            <div className="text-[10px] font-mono text-indigo-700 font-bold">{rec.dspRefNumber} • {rec.officialLetterRef}</div>
                          </td>
                          <td className="py-3 px-3 border-r border-slate-100 text-[11px]">
                            <div className="font-bold text-slate-900">{rec.signatory}</div>
                            <div className="text-[10px] text-slate-500">{rec.signatoryRole}</div>
                          </td>
                          <td className="py-3 px-3 border-r border-slate-100 text-[11px]">
                            {(rec.targetedRegions || []).join(', ') || '-'}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-100 text-right font-mono">
                            <span className="font-black text-slate-900">{facCount} HFs</span>
                            <span className="text-[10px] text-cyan-800 font-bold block">{formatNumber(rec.totalQuantity || 0)} Units</span>
                          </td>
                          <td className="py-3 px-3 border-r border-slate-100 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadDossierLetter(rec);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                                title="Download Summary"
                              >
                                <Download className="w-3 h-3 text-amber-600" />
                              </button>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                                  <Check className="w-3 h-3" />
                                  Selected
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDossierId(rec.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected 1.2 Dossier: Exact MOH -> EPSS Health Facility Breakdown Matrix */}
          {activeRecord && (
            <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-[#0B1527] p-6 text-white border-b-2 border-amber-400">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-amber-400 rounded-2xl text-slate-950 shadow-lg shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                          EXACT MOH ➔ EPSS HEALTH FACILITY BREAKDOWN MATRIX
                        </span>
                        <span className="px-3 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase">
                          {activeRecord.status}
                        </span>
                      </div>
                      <h3 className="text-base md:text-lg font-black uppercase tracking-wide leading-tight text-white">
                        {activeRecord.dspName || activeRecord.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-300 mt-1.5">
                        <span>Ref: <strong className="text-amber-300 font-mono">{activeRecord.dspRefNumber}</strong></span>
                        <span>Letter: <strong className="text-white font-mono">{activeRecord.officialLetterRef}</strong></span>
                        <span>Signatory: <strong className="text-white">{activeRecord.signatory} ({activeRecord.signatoryRole})</strong></span>
                        <span>Date: <strong className="text-white font-mono">{activeRecord.dateSubmitted}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadDossierLetter(activeRecord)}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Summary</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      disabled={mohMatrixData.rows.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel Matrix</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      disabled={mohMatrixData.rows.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintDossier}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer border border-slate-700"
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Strip for MOH -> EPSS Matrix */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/70 border-b border-slate-200">
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Health Facilities</div>
                    <div className="text-xl font-black text-slate-900 font-mono">{filteredMatrixRows12.length} HFs</div>
                  </div>
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Equipment Types</div>
                    <div className="text-xl font-black text-purple-700 font-mono">{mohMatrixData.columns.length} Cols</div>
                  </div>
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Total Allocated Units</div>
                    <div className="text-xl font-black text-emerald-600 font-mono">
                      {formatNumber(mohMatrixData.rows.length > 0 ? matrix12GrandTotal : activeRecord.totalQuantity || 0)}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Regions Covered</div>
                    <div className="text-xl font-black text-amber-700 font-mono">
                      {uniqueRegions12.length || activeRecord.targetedRegions?.length || 0} Regions
                    </div>
                  </div>
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
              </div>

              {/* Filter & Search Bar */}
              {mohMatrixData.rows.length > 0 && (
                <div className="bg-white border-b border-slate-200 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search region, zone, woreda, health facility, package..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={regionFilter12}
                      onChange={(e) => setRegionFilter12(e.target.value)}
                      className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 cursor-pointer"
                    >
                      <option value="all">All Regions ({uniqueRegions12.length})</option>
                      {uniqueRegions12.map(reg => (
                        <option key={reg} value={reg}>{reg}</option>
                      ))}
                    </select>
                    <span className="text-xs font-bold text-slate-500 font-mono px-2">
                      {filteredMatrixRows12.length} of {mohMatrixData.rows.length} Facilities
                    </span>
                  </div>
                </div>
              )}

              {/* TWO-TIER HEALTH FACILITY BREAKDOWN MATRIX TABLE */}
              {mohMatrixData.rows.length > 0 ? (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto bg-white">
                  <table className="w-full text-left border-collapse select-text text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="font-bold">
                        <th className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2.5 text-center w-10">S/N</th>
                        <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[100px]">Date</th>
                        <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[110px]">Region</th>
                        <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px]">Zone</th>
                        <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[100px]">Woreda</th>
                        <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[220px]">Name of health facility</th>
                        <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px] text-center">List of Packages</th>
                        {mohMatrixData.columns.map(col => (
                          <th key={col.id} className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2 text-center min-w-[130px] leading-tight font-semibold">
                            {col.name}
                          </th>
                        ))}
                        <th className="bg-[#fde047] text-slate-900 font-black border border-slate-400 py-2 px-3 text-center min-w-[75px]">Total</th>
                      </tr>
                      <tr className="text-[10px]">
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-2"></th>
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                        <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                        <th className="bg-[#dbeafe] text-slate-800 italic border border-slate-400 py-1 px-2 text-center font-normal">List of Packages</th>
                        {mohMatrixData.columns.map(col => (
                          <th key={`code-${col.id}`} className="bg-white text-slate-800 font-mono border border-slate-400 py-1 px-2 text-center font-bold">
                            {col.code}
                          </th>
                        ))}
                        <th className="bg-[#fde047] border border-slate-400 py-1 px-2 text-center font-mono">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrixRows12.map((row, idx) => {
                        const rowSum = mohMatrixData.columns.reduce(
                          (acc, c) => acc + (Number(row.quantities[c.id]) || 0),
                          0
                        );
                        return (
                          <tr key={row.id || idx} className={idx % 2 === 0 ? 'bg-white hover:bg-amber-50/40' : 'bg-slate-50/70 hover:bg-amber-50/40'}>
                            <td className="py-2 px-2.5 border border-slate-300 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 border border-slate-300 font-mono text-slate-600">{row.date || mohMatrixData.date}</td>
                            <td className="py-2 px-3 border border-slate-300 font-semibold text-slate-900">{row.region}</td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-700">{row.zone}</td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-700 font-mono text-[11px]">{row.woreda}</td>
                            <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">{row.healthFacility}</td>
                            <td className="py-2 px-3 border border-slate-300 bg-[#eff6ff] text-indigo-900 font-bold text-center">{row.packages}</td>
                            {mohMatrixData.columns.map(col => (
                              <td key={`${row.id}-${col.id}`} className="py-2 px-2 border border-slate-300 text-center font-mono font-bold text-slate-800">
                                {Number(row.quantities[col.id]) || 0}
                              </td>
                            ))}
                            <td className="py-2 px-3 border border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/60">
                              {formatNumber(rowSum)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs">
                        <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-amber-400 font-mono">
                          TOTAL ({filteredMatrixRows12.length} Health Facilities):
                        </td>
                        {mohMatrixData.columns.map(col => (
                          <td key={`tot-${col.id}`} className="py-3 px-2 text-center font-mono text-amber-300 border-r border-slate-700">
                            {formatNumber(matrix12ColumnTotals[col.id] || 0)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-center font-mono text-emerald-400 bg-slate-950 text-sm">
                          {formatNumber(matrix12GrandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-6">
                  <div className="text-xs font-bold text-slate-600 mb-2">Transmitted Equipment Summary (No Facility Matrix Rows Attached):</div>
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2.5 border-r border-slate-200 w-12 text-center">S/N</th>
                        <th className="p-2.5 border-r border-slate-200 font-mono">Material Code</th>
                        <th className="p-2.5 border-r border-slate-200">Material Description</th>
                        <th className="p-2.5 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(activeRecord.itemsIncluded || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-indigo-900">{it.material}</td>
                          <td className="p-2.5 border-r border-slate-200 font-medium text-slate-900">{it.description}</td>
                          <td className="p-2.5 text-right font-mono font-black text-cyan-800">{formatNumber(it.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Uploaded Covering Letter Modal */}
          {selectedFolderModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl p-5 space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">Official Letter Envelope</span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedFolderModal.subject}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFolderModal(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                  <div><strong>Ref:</strong> {selectedFolderModal.officialLetterRef}</div>
                  <div><strong>Date:</strong> {selectedFolderModal.dateTransmitted}</div>
                  <div><strong>Signatory:</strong> {selectedFolderModal.signatory} ({selectedFolderModal.signatoryRole})</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadFolderLetter(selectedFolderModal)}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Download Attachment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFolderModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PIPELINE FOOTER */}
      {activeRecord && (
        <div className="bg-gradient-to-r from-[#0B1527] to-[#1E3A5F] text-white p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-400 text-slate-950 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.15em] text-amber-400">
                {is21 ? 'Ready for Regional Quota Breakdown (2.2)' : 'Ready for Hub Mapping (1.3.1)'}
              </h4>
              <p className="text-xs text-slate-300 font-medium">
                {is21
                  ? 'Exact EPSS request dossier stored. Proceed to Sub-step 2.2 to allocate exact item quotas across regions.'
                  : 'Exact MOH Health Facility Breakdown Matrix stored. Proceed to Sub-step 1.3.1 to map each health facility to its delivering EPSS Hub.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!is21 && activeRecord && onProceedToMapHf) {
                onProceedToMapHf(activeRecord);
              } else {
                onSelectSubTab?.(is21 ? 'dsp-moh-2-2' : 'dsp-ho-1-3-1');
              }
            }}
            className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0"
          >
            <span>Proceed to {is21 ? '2.2 Request to RHB' : '1.3.1 Map HF to Hub'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
