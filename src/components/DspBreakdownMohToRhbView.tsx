import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Send, 
  CheckCircle2, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3,
  X,
  Check,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Share2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Paperclip,
  PackagePlus,
  Globe,
  Lock,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  FileText,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord } from '../types';
import { pushCentralMasterData } from '../utils/centralSyncService';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';
import { saveDspRecordsToIndexedDB } from '../utils/indexedDbCache';
import { getAccessToken } from '../utils/googleWorkspace';

const TODAY_ISO_DATE = new Date().toISOString().split('T')[0];

export const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Central Ethiopia',
  'Dire Dawa',
  'Gambella',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'South Ethiopia',
  'South West Ethiopia',
  'SNNPR',
  'Tigray'
];

interface MatrixRow {
  id: string;
  sn: number;
  date: string;
  region: string;
  budgetSource: string;
  quantities: Record<string, number>; // colId -> quantity
}

interface MatrixColumn {
  id: string;
  materialCode: string;
  description: string;
}

interface Props {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  multipleStockItems?: MultipleStockRecord[];
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

export const DspBreakdownMohToRhbView: React.FC<Props> = ({
  records,
  setRecords,
  multipleStockItems = [],
  onSelectSubTab,
  onTriggerCloudSync
}) => {
  // 1. Columns (Materials)
  const [columns, setColumns] = useState<MatrixColumn[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_2_2_columns');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Auto-extract exact equipment items from transmitted DSP payload
      const storedRec = localStorage.getItem('epss_dsp_received_epss_rows') || localStorage.getItem('epss_dsp_received_moh_rows') || localStorage.getItem('epss_dsp_request_template_rows');
      if (storedRec) {
        const parsedRec = JSON.parse(storedRec);
        if (Array.isArray(parsedRec) && parsedRec.length > 0) {
          const extracted: MatrixColumn[] = [];
          const seen = new Set<string>();
          parsedRec.forEach((item: any, idx: number) => {
            const code = item.material || item.materialCode || `MAT-${1000 + idx}`;
            const desc = item.materialDescription || item.description || item.deviceName || 'Medical Equipment Unit';
            const key = `${code}|${desc}`;
            if (!seen.has(key)) {
              seen.add(key);
              extracted.push({
                id: `mat-rec-${idx}-${code}`,
                materialCode: code,
                description: desc
              });
            }
          });
          if (extracted.length > 0) return extracted;
        }
      }
    } catch {}
    return [
      { id: 'mat-1', materialCode: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon' },
      { id: 'mat-2', materialCode: '403-XRRD-0101', description: 'Bed - Patient, Fowler, Adult' },
      { id: 'mat-3', materialCode: '403-XRRB-0101N', description: 'Bowel - With Stand, Stainless Steel.' },
      { id: 'mat-4', materialCode: '403-XRRD-0101-001', description: 'Cold box' },
      { id: 'mat-5', materialCode: '401-WICU-0101N', description: 'Couch - Delivery' },
      { id: 'mat-6', materialCode: '401-WICU-0101N', description: 'Couch - Examination' }
    ];
  });

  // 2. Rows (Regions)
  const [rows, setRows] = useState<MatrixRow[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_2_2_rows');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { 
        id: 'row-1', 
        sn: 1, 
        date: TODAY_ISO_DATE, 
        region: 'Oromia', 
        budgetSource: '', 
        quantities: { 'mat-1': 10, 'mat-2': 10, 'mat-3': 10, 'mat-4': 10, 'mat-5': 10, 'mat-6': 10 } 
      },
      { 
        id: 'row-2', 
        sn: 2, 
        date: TODAY_ISO_DATE, 
        region: 'Amhara', 
        budgetSource: '', 
        quantities: { 'mat-1': 5, 'mat-2': 5, 'mat-3': 5, 'mat-4': 5, 'mat-5': 5, 'mat-6': 5 } 
      }
    ];
  });

  // Search & Modals State
  const [searchQuery, setSearchQuery] = useState('');
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  const [isImportItemsModalOpen, setIsImportItemsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  
  const [selectedNewRegion, setSelectedNewRegion] = useState<string>(ETHIOPIAN_REGIONS[0]);
  const [newRowBudgetSource, setNewRowBudgetSource] = useState<string>('');

  // Letter Upload State
  const letterInputRef = useRef<HTMLInputElement>(null);
  const [uploadedLetter, setUploadedLetter] = useState<File | null>(null);

  // Email State
  const [emailTo, setEmailTo] = useState('rhb.logistics@moh.gov.et');
  const [emailCc, setEmailCc] = useState('pmd@moh.gov.et, epss-med-equip@epss.gov.et');
  const [emailSubject, setEmailSubject] = useState(`Official Regional Allocation Breakdown Request: MOH to RHBs [${TODAY_ISO_DATE}]`);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // WhatsApp State
  const [waPhone, setWaPhone] = useState('+251911234567');
  const [waCopied, setWaCopied] = useState(false);

  // Security Verification State for Submission
  const [approvedRegions, setApprovedRegions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ETHIOPIAN_REGIONS.forEach(r => { initial[r] = true; });
    return initial;
  });
  const [securitySealConfirmed, setSecuritySealConfirmed] = useState(true);
  const [auditClearancePassed, setAuditClearancePassed] = useState(true);

  // Import Items Selection State
  const [importSource, setImportSource] = useState<'received' | 'stock' | 'custom'>('received');
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<string[]>([]);
  const [customMaterialCode, setCustomMaterialCode] = useState('');
  const [customMaterialDesc, setCustomMaterialDesc] = useState('');

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    localStorage.setItem('epss_dsp_2_2_columns', JSON.stringify(columns));
    localStorage.setItem('epss_dsp_2_2_rows', JSON.stringify(rows));

    const timer = setTimeout(() => {
      pushCentralMasterData({
        dsp22Columns: columns,
        dsp22Rows: rows,
        updatedBy: 'RHB Regional Breakdown Manager',
        updateKind: `Update Regional Matrix (${rows.length} Regions, ${columns.length} Items)`
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [columns, rows]);

  // Extract available items to import from received records or stock
  const availableReceivedItems = useMemo(() => {
    const list: Array<{ id: string; materialCode: string; description: string; qty: number; source: string }> = [];
    
    try {
      const storedRec = localStorage.getItem('epss_dsp_received_epss_rows') || localStorage.getItem('epss_dsp_request_template_rows');
      if (storedRec) {
        const parsed = JSON.parse(storedRec);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any, idx: number) => {
            list.push({
              id: `rec-import-${idx}-${item.material || item.id}`,
              materialCode: item.material || item.materialCode || `MAT-${1000 + idx}`,
              description: item.materialDescription || item.description || 'Medical Device',
              qty: item.qty || item.quantity || 10,
              source: 'Transmitted DSP Payload'
            });
          });
        }
      }
    } catch {}

    records.forEach(rec => {
      if (rec.itemsIncluded && rec.itemsIncluded.length > 0) {
        rec.itemsIncluded.forEach((it, idx) => {
          if (!list.some(l => l.materialCode === it.material && l.description === it.description)) {
            list.push({
              id: `dsp-rec-${rec.id}-${idx}`,
              materialCode: it.material,
              description: it.description,
              qty: it.quantity,
              source: `Ref: ${rec.dspRefNumber}`
            });
          }
        });
      }
    });

    return list;
  }, [records]);

  const availableStockItems = useMemo(() => {
    return multipleStockItems.map(s => ({
      id: `stock-${s.id}`,
      materialCode: s.material,
      description: s.materialDescription,
      qty: s.unrestrictedStock,
      source: `Stock - WBS: ${s.wbsElement || 'General'}`
    }));
  }, [multipleStockItems]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rows.filter(r => 
      r.region.toLowerCase().includes(q) || 
      r.budgetSource.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const totals = useMemo(() => {
    const colTotals: Record<string, number> = {};
    columns.forEach(c => {
      colTotals[c.id] = rows.reduce((sum, r) => sum + (r.quantities[c.id] || 0), 0);
    });
    return colTotals;
  }, [columns, rows]);

  const totalUnitsAll = useMemo(() => {
    return Object.values(totals).reduce((a, b) => a + b, 0);
  }, [totals]);

  const handleUpdateQuantity = (rowId: string, colId: string, val: number) => {
    setRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, quantities: { ...r.quantities, [colId]: val } } : r
    ));
  };

  // Add specific region row
  const handleAddSelectedRegionRow = (regionName: string) => {
    if (rows.some(r => r.region.toLowerCase() === regionName.toLowerCase())) {
      showToast(`⚠️ ${regionName} is already added in the table.`);
      return;
    }

    const defaultQty: Record<string, number> = {};
    columns.forEach(c => { defaultQty[c.id] = 10; });

    const newRow: MatrixRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sn: rows.length + 1,
      date: TODAY_ISO_DATE,
      region: regionName,
      budgetSource: newRowBudgetSource || '',
      quantities: defaultQty
    };

    setRows(prev => [...prev, newRow]);
    showToast(`✓ Added ${regionName} row to breakdown matrix.`);
  };

  // One-click Add ALL 15 Ethiopian Regions
  const handleAddAll15EthiopianRegions = () => {
    const existingRegions = new Set(rows.map(r => r.region.toLowerCase()));
    const missing = ETHIOPIAN_REGIONS.filter(r => !existingRegions.has(r.toLowerCase()));

    if (missing.length === 0) {
      showToast('All 15 Ethiopian Regions are already present in the matrix table.');
      return;
    }

    const defaultQty: Record<string, number> = {};
    columns.forEach(c => { defaultQty[c.id] = 10; });

    const newRows: MatrixRow[] = missing.map((reg, idx) => ({
      id: `row-all-${idx}-${Date.now()}`,
      sn: rows.length + idx + 1,
      date: TODAY_ISO_DATE,
      region: reg,
      budgetSource: newRowBudgetSource || '',
      quantities: { ...defaultQty }
    }));

    setRows(prev => [...prev, ...newRows]);
    showToast(`✓ Populated all ${missing.length} missing Ethiopian Regions!`);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, sn: i + 1 })));
    showToast('Region row removed.');
  };

  const handleRemoveColumn = (colId: string) => {
    if (columns.length <= 1) {
      alert('The breakdown table must have at least 1 material column.');
      return;
    }
    setColumns(prev => prev.filter(c => c.id !== colId));
    showToast('Equipment column removed.');
  };

  // Import Selected Items into Columns
  const handleApplyImportedItems = () => {
    if (importSource === 'custom') {
      if (!customMaterialCode.trim() || !customMaterialDesc.trim()) {
        alert('Please enter both Material Code and Description.');
        return;
      }
      const newCol: MatrixColumn = {
        id: `mat-custom-${Date.now()}`,
        materialCode: customMaterialCode.trim(),
        description: customMaterialDesc.trim()
      };
      setColumns(prev => [...prev, newCol]);
      setCustomMaterialCode('');
      setCustomMaterialDesc('');
      setIsImportItemsModalOpen(false);
      showToast(`✓ Added custom item "${newCol.description}" as column.`);
      return;
    }

    const sourceList = importSource === 'received' ? availableReceivedItems : availableStockItems;
    const selectedItems = sourceList.filter(s => selectedImportItemIds.includes(s.id));

    if (selectedItems.length === 0) {
      alert('Please select at least one item to import.');
      return;
    }

    const newCols: MatrixColumn[] = selectedItems.map((item, idx) => ({
      id: `mat-imported-${Date.now()}-${idx}`,
      materialCode: item.materialCode,
      description: item.description
    }));

    setColumns(prev => {
      const existingCodes = new Set(prev.map(c => c.materialCode + '|' + c.description));
      const filteredNew = newCols.filter(c => !existingCodes.has(c.materialCode + '|' + c.description));
      return [...prev, ...filteredNew];
    });

    setRows(prevRows => prevRows.map(row => {
      const updatedQty = { ...row.quantities };
      newCols.forEach((col, idx) => {
        const itemObj = selectedItems[idx];
        updatedQty[col.id] = Math.max(1, Math.round((itemObj?.qty || 10) / Math.max(1, prevRows.length)));
      });
      return { ...row, quantities: updatedQty };
    }));

    setIsImportItemsModalOpen(false);
    setSelectedImportItemIds([]);
    showToast(`✓ Imported ${newCols.length} equipment items into Breakdown Matrix!`);
  };

  const handleDownloadExcel = () => {
    const header1 = ['S/N', 'Date', 'Region', 'Budget Source', ...columns.map(c => c.description)];
    const header2 = ['', '', '', '', ...columns.map(c => c.materialCode)];
    const data = filteredRows.map(r => [
      r.sn,
      r.date,
      r.region,
      r.budgetSource,
      ...columns.map(c => r.quantities[c.id] || 0)
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header1, header2, ...data]);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, 
      ...columns.map(() => ({ wch: 25 }))
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DSP_Breakdown_Template');
    XLSX.writeFile(workbook, `DSP_Breakdown_Request_MOH_to_RHB_${TODAY_ISO_DATE}.xlsx`);
    showToast('✓ Excel Breakdown Matrix downloaded!');
  };

  // EMAIL & WHATSAPP TEXT GENERATION
  const emailBodyText = useMemo(() => {
    const regionSummary = rows.map((r, i) => `${i + 1}. ${r.region} | Budget: ${r.budgetSource} | Date: ${r.date}`).join('\n');
    const itemSummary = columns.map((c, i) => `${i + 1}. [${c.materialCode}] ${c.description} — Total Quota: ${formatNumber(totals[c.id] || 0)} Units`).join('\n');

    return `Dear Regional Health Bureau Leadership & Health Program Directors,

Please find attached the official Regional Medical Equipment Quota Allocation Breakdown Request from Ministry of Health (MOH) PMD Directorate.

Targeted Regions (${rows.length}):
${regionSummary}

Allocated Medical Equipment Items (${columns.length}):
${itemSummary}

SUMMARY:
• Total Targeted Regions: ${rows.length} RHBs
• Total Equipment Groups: ${columns.length} Items
• Total Allocated Units: ${formatNumber(totalUnitsAll)} Units
• Issuance Date: ${TODAY_ISO_DATE}
• Protocol: Official MOH Regional Breakdown Quota Matrix (Sub-step 2.2)

${uploadedLetter ? `Attached Official Covering Letter: ${uploadedLetter.name}\n` : ''}Attached: Official Regional Quota Breakdown Excel Dossier.

Issued by:
Ministry of Health (PMD Directorate)
Authorized Directorate Desk`;
  }, [rows, columns, totals, totalUnitsAll, uploadedLetter]);

  const handleSendViaEmail = async () => {
    setIsSendingEmail(true);
    try {
      handleDownloadExcel();
      const token = await getAccessToken();
      if (token) {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: btoa(
              `To: ${emailTo}\r\n` +
              `Cc: ${emailCc}\r\n` +
              `Subject: ${emailSubject}\r\n` +
              `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
              emailBodyText
            )
          })
        });
        if (res.ok) {
          showToast(`✓ Official Breakdown Request sent via Gmail to ${emailTo}!`);
          setIsEmailModalOpen(false);
          return;
        }
      }

      const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCc)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyText)}`;
      window.location.href = mailtoUrl;
      showToast(`✓ Excel downloaded & mail client launched for ${emailTo}`);
      setIsEmailModalOpen(false);
    } catch (err) {
      console.error('Email send error:', err);
      window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyText)}`;
      showToast(`Excel downloaded. Opened default email client.`);
      setIsEmailModalOpen(false);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const whatsAppMessage = useMemo(() => {
    const regionSummary = rows.map((r, i) => `• *${r.region}* (Budget: ${r.budgetSource})`).join('\n');
    const itemSummary = columns.map((c, i) => `• *${c.description}* (${c.materialCode}): *${formatNumber(totals[c.id] || 0)} Units*`).join('\n');

    return `*🏥 MINISTRY OF HEALTH (MOH) — ETHIOPIA*
*OFFICIAL REGIONAL BREAKDOWN REQUEST TO RHBs*
*Issuance Date:* ${TODAY_ISO_DATE}
*Issuing Body:* MOH PMD Directorate

*TARGETED REGIONAL HEALTH BUREAUS (${rows.length}):*
${regionSummary}

*ALLOCATED MEDICAL DEVICES (${columns.length}):*
${itemSummary}

*TOTAL ALLOCATION:* 
• Total Units: *${formatNumber(totalUnitsAll)} Units*
• Protocol: Standard MOH Regional Quota Matrix (Sub-step 2.2)
${uploadedLetter ? `• Attached Covering Letter: *${uploadedLetter.name}*\n` : ''}`;
  }, [rows, columns, totals, totalUnitsAll, uploadedLetter]);

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(whatsAppMessage);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 3000);
    showToast('✓ WhatsApp message copied to clipboard');
  };

  const handleOpenWhatsAppWeb = () => {
    handleDownloadExcel();
    const cleanPhone = waPhone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;
    window.open(url, '_blank');
    showToast(`✓ Opened WhatsApp Web with Breakdown Request payload & downloaded Excel`);
    setIsWhatsAppModalOpen(false);
  };

  // Submit to RHBs with Regional Security Authorization
  const handleTransmit = () => {
    const targetedActiveRegions = rows.map(r => r.region).filter(r => approvedRegions[r] !== false);

    if (targetedActiveRegions.length === 0) {
      alert('Security Verification Error: At least one region must be authorized and approved for submission.');
      return;
    }

    if (!securitySealConfirmed) {
      alert('Security Verification Required: Please confirm official ministerial stamp & signatory verification before submitting.');
      return;
    }

    const year = new Date().getFullYear();
    const randNum = Math.floor(100 + Math.random() * 900);
    const refNum = `MOH/PMD-BRK/${year}/${randNum}`;
    const officialLetterRef = `MOH/LET/${year}/${Math.floor(1000 + Math.random() * 9000)}`;

    const totalQty = Object.values(totals).reduce((sum, v) => sum + v, 0);

    const activeDspName = localStorage.getItem('epss_dsp_request_dsp_name') || 'DSP 2026 - MCH Equipment Allocation';

    const newRecord: DspWorkflowRecord = {
      id: `dsp-brk-tx-${Date.now()}`,
      dspRefNumber: refNum,
      stage: 'moh-osp-management',
      subStage: '2.2',
      stageTitle: 'MOH OSP Management',
      senderOrg: 'Ministry of Health (PMD Directorate)',
      recipientOrg: targetedActiveRegions.join(', ') + ' Regional Health Bureaus',
      dspName: activeDspName,
      subject: `DSP [${activeDspName}]: Authorized Regional Breakdown Request to RHB (${columns.length} Materials)`,
      status: 'Submitted & Pending',
      dateSubmitted: TODAY_ISO_DATE,
      totalDevices: columns.length,
      totalQuantity: totalQty,
      totalValuationETB: totalQty * 250000,
      targetedRegions: targetedActiveRegions,
      targetedFacilitiesCount: rows.length,
      officialLetterRef: officialLetterRef,
      signatory: 'Dr. Bethlehem (MOH PMD Directorate)',
      signatoryRole: 'Director, PMD Directorate',
      itemsIncluded: columns.map(c => ({
        material: c.materialCode,
        description: c.description,
        quantity: totals[c.id] || 0,
        plant: 'AA01 Central'
      })),
      notes: `Secured & Authorized Transmission via Horizontal Matrix. Verified for ${targetedActiveRegions.length} Ethiopian Regions.${uploadedLetter ? ` Official Letter: ${uploadedLetter.name}` : ''}`
    };

    setRecords(prev => [newRecord, ...prev]);
    saveDspRecordsToIndexedDB([newRecord, ...records]);
    
    if (onTriggerCloudSync) {
      onTriggerCloudSync(`✓ Secured Breakdown Request ${refNum} transmitted to ${targetedActiveRegions.length} Ethiopian Regions!`, {
        type: 'CREATE',
        title: `Breakdown Request ${refNum}`,
        payload: newRecord
      });
    }

    setIsTransmitModalOpen(false);
    showToast(`✓ Breakdown Request ${refNum} submitted for security approved regions (${targetedActiveRegions.length})!`);
    if (onSelectSubTab) onSelectSubTab('moh-osp-management');
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

      {/* Top Banner */}
      <div className="bg-[#0B1527] border border-[#0B1527] rounded-2xl p-4 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1E3A5F] border border-[#2D4D75] shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <span className="text-xs md:text-sm font-black text-white tracking-tight uppercase">
                DSP Breakdown Request to RHB
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-900">
                {rows.length} Regions
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span>MOH PMD Directorate ➔ Regional Health Bureaus</span>
                <span className="text-emerald-400 font-mono font-bold">• All 15 Ethiopian Regions Active</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">
                Official Quota Breakdown Matrix Template (Sub-step 2.2)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Official Covering Letter Button */}
            <input 
              type="file" 
              ref={letterInputRef}
              id="rhb-breakdown-letter-upload" 
              className="hidden" 
              accept=".pdf,.doc,.docx,image/*" 
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setUploadedLetter(file);
                if (file) {
                  showToast(`✓ Official Request Letter attached: ${file.name}`);
                }
              }}
            />
            <button
              type="button"
              onClick={() => letterInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs border ${
                uploadedLetter 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 font-black' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Upload signed Official Breakdown Request Letter (PDF / DOC)"
            >
              <Paperclip className="w-3.5 h-3.5 text-amber-400" />
              <span>{uploadedLetter ? 'Letter Attached' : 'Upload Letter'}</span>
            </button>

            {/* Send via Email Button */}
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Send DSP Breakdown Request via email to RHBs"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send via Email</span>
            </button>

            {/* Send via WhatsApp Button */}
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Send DSP Breakdown Request via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>

            {/* Import Equipment Items / Columns Button */}
            <button
              type="button"
              onClick={() => setIsImportItemsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Import equipment items from received payload or stock as matrix columns"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Import Columns ({columns.length})</span>
            </button>

            {/* Download Excel */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>

            {/* Submit to RHBs with Security Verification */}
            <button
              type="button"
              onClick={() => setIsTransmitModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to RHBs</span>
            </button>
          </div>
        </div>

        {/* Attached Letter Status Card */}
        {uploadedLetter && (
          <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50/90 border border-amber-300 rounded-xl text-xs mt-2 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-950 font-medium">
              <FileText className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Official Request Letter Attached:</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200">{uploadedLetter.name}</span>
              <span className="text-[10px] text-amber-800 font-bold">({(uploadedLetter.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setUploadedLetter(null);
                if (letterInputRef.current) letterInputRef.current.value = '';
                showToast('Official Request Letter removed');
              }}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        )}
      </div>

      {/* Matrix Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Regions or Budget Sources..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Add Region Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedNewRegion}
              onChange={(e) => setSelectedNewRegion(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {ETHIOPIAN_REGIONS.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddSelectedRegionRow(selectedNewRegion)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="Add row for selected Ethiopian region"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Region</span>
            </button>
          </div>

          {/* Add All 15 Ethiopian Regions One-Click Button */}
          <button
            type="button"
            onClick={handleAddAll15EthiopianRegions}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Populate all 15 Ethiopian Regions in the table automatically"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Add All 15 Ethiopian Regions</span>
          </button>
        </div>
      </div>

      {/* The Horizontal Matrix Template Table */}
      <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-text">
            <thead>
              {/* Header 1: Material Descriptions */}
              <tr className="bg-orange-100 border-b border-slate-300 text-slate-900 font-bold">
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[50px]">S/N</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[100px] italic">Date</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[180px]">
                  Region (Ethiopian Regions List)
                </th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[120px] bg-orange-400 text-white uppercase">
                  Budget Source
                </th>
                {columns.map(col => (
                  <th key={col.id} className="py-1.5 px-2 text-left border-r border-slate-300 min-w-[180px] bg-orange-100 font-medium leading-tight align-bottom relative group">
                    <div className="flex items-start justify-between gap-1">
                      <span>{col.description}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(col.id)}
                        className="p-0.5 rounded text-rose-600 hover:bg-rose-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Column"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center w-12 bg-slate-100">Action</th>
              </tr>
              {/* Header 2: Material Codes */}
              <tr className="bg-white border-b border-slate-400 text-slate-600 font-mono text-[10px]">
                <th className="border-r border-slate-200"></th>
                <th className="border-r border-slate-200"></th>
                <th className="border-r border-slate-200 font-sans text-[10px] text-slate-400 px-2 text-left font-bold uppercase">
                  15 Regions
                </th>
                <th className="border-r border-slate-200 font-sans text-[10px] text-indigo-700 px-2 text-left font-bold">
                  Funding
                </th>
                {columns.map(col => (
                  <th key={`${col.id}-code`} className="py-1 px-2 text-left border-r border-slate-300 font-bold text-slate-900">
                    {col.materialCode}
                  </th>
                ))}
                <th className="bg-slate-50"></th>
              </tr>
            </thead>
            <tbody className="bg-blue-50/20">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 5} className="py-10 text-center font-bold text-slate-600">
                    No region rows added yet. Click "Add All 15 Ethiopian Regions" or select a region above.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-slate-200 hover:bg-white transition-colors group">
                    {/* S/N */}
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500 font-bold">
                      {row.sn}
                    </td>

                    {/* Date */}
                    <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px]">
                      <input 
                        type="date" 
                        value={row.date} 
                        onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, date: e.target.value } : r))}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-[11px]"
                      />
                    </td>

                    {/* Region Selector (Full Ethiopian Regions Dropdown) */}
                    <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                      <select
                        value={row.region}
                        onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, region: e.target.value } : r))}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-xs text-slate-900 cursor-pointer"
                      >
                        {ETHIOPIAN_REGIONS.map(reg => (
                          <option key={reg} value={reg}>{reg}</option>
                        ))}
                      </select>
                    </td>

                    {/* Budget Source */}
                    <td className="py-2 px-3 border-r border-slate-200 bg-blue-50/80 font-black text-indigo-700">
                      <input 
                        type="text" 
                        value={row.budgetSource} 
                        onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, budgetSource: e.target.value } : r))}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-indigo-700 uppercase"
                      />
                    </td>

                    {/* Quantities per Material Column */}
                    {columns.map(col => (
                      <td key={col.id} className="py-2 px-2 border-r border-slate-200 text-center">
                        <input 
                          type="number"
                          min="0"
                          value={row.quantities[col.id] ?? 0}
                          onChange={(e) => handleUpdateQuantity(row.id, col.id, parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-center font-mono font-bold text-slate-900 text-xs"
                        />
                      </td>
                    ))}

                    {/* Actions */}
                    <td className="py-2 px-2 text-center bg-slate-50">
                      <button 
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                        title="Remove Region Row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {/* Total Row Footer */}
              <tr className="bg-slate-900 text-white font-black text-[11px]">
                <td colSpan={4} className="py-2.5 px-4 text-right uppercase tracking-widest text-amber-400 font-mono">
                  Total Regional Allocation Quota ({rows.length} Regions):
                </td>
                {columns.map(col => (
                  <td key={`${col.id}-total`} className="py-2.5 px-2 text-center border-r border-slate-700 font-mono text-cyan-300 font-black">
                    {formatNumber(totals[col.id])}
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            This breakdown template maps medical devices across all <strong className="text-slate-900">15 Ethiopian Regions</strong>. You can import equipment columns directly from transmitted stock or custom material codes.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-200 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition cursor-pointer text-[11px] flex items-center gap-1"
          >
            <Mail className="w-3 h-3" />
            <span>Email RHBs</span>
          </button>
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-200 text-emerald-700 border border-emerald-200 rounded-lg font-bold transition cursor-pointer text-[11px] flex items-center gap-1"
          >
            <MessageCircle className="w-3 h-3" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: IMPORT / SELECT EQUIPMENT COLUMNS */}
      {isImportItemsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">Import Equipment Items into Matrix Columns</h3>
                  <p className="text-[11px] text-slate-400">Select items from transmitted DSP payload, stock ledger, or enter custom item</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportItemsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setImportSource('received')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  importSource === 'received' 
                    ? 'bg-cyan-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Transmitted DSP Payload ({availableReceivedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setImportSource('stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  importSource === 'stock' 
                    ? 'bg-cyan-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Multiple Stock Ledger ({availableStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => setImportSource('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  importSource === 'custom' 
                    ? 'bg-cyan-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                + Custom Item Entry
              </button>
            </div>

            {/* Source Selection Content */}
            {importSource === 'custom' ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Add Custom Material Column</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Material Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 403-XRRD-0101"
                      value={customMaterialCode}
                      onChange={(e) => setCustomMaterialCode(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Material Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Anesthesia machine with monitor"
                      value={customMaterialDesc}
                      onChange={(e) => setCustomMaterialDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl bg-slate-50/50 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5 text-center w-10">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            const list = importSource === 'received' ? availableReceivedItems : availableStockItems;
                            if (e.target.checked) setSelectedImportItemIds(list.map(l => l.id));
                            else setSelectedImportItemIds([]);
                          }}
                          className="rounded accent-cyan-600 cursor-pointer"
                        />
                      </th>
                      <th className="p-2.5">Material Code</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Available Qty</th>
                      <th className="p-2.5">Source Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(importSource === 'received' ? availableReceivedItems : availableStockItems).map((item) => {
                      const isSelected = selectedImportItemIds.includes(item.id);
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => {
                            setSelectedImportItemIds(prev => 
                              prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={`hover:bg-cyan-50/50 cursor-pointer transition ${isSelected ? 'bg-cyan-50' : ''}`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded accent-cyan-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{item.materialCode}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{item.description}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-cyan-800">{formatNumber(item.qty)}</td>
                          <td className="p-2.5 text-slate-500 font-mono text-[10px]">{item.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportItemsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyImportedItems}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Apply Equipment Columns</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND VIA EMAIL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send DSP Breakdown Request via Email</h3>
                  <p className="text-[11px] text-slate-400">Transmit official regional breakdown matrix Excel dossier to RHBs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">To (Official RHB Logistics Email)</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CC (MOH & EPSS Directorate)</label>
                  <input
                    type="text"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Body Preview</label>
                <textarea
                  rows={6}
                  readOnly
                  value={emailBodyText}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-indigo-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="font-bold text-xs">DSP_Breakdown_Request_MOH_to_RHB_{TODAY_ISO_DATE}.xlsx</div>
                    <div className="text-[10px] text-indigo-600">Regional Matrix Template ({rows.length} Regions, {columns.length} Items)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Download
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={handleSendViaEmail}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingEmail ? 'Sending...' : 'Send via Gmail / Mail Client'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND VIA WHATSAPP */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send DSP Breakdown Request via WhatsApp</h3>
                  <p className="text-[11px] text-slate-400">Instant dispatch of regional breakdown matrix payload</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Phone Number (WhatsApp)</label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-700">Formatted Message Payload</label>
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="text-emerald-700 font-bold flex items-center gap-1 hover:underline cursor-pointer text-[11px]"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{waCopied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  readOnly
                  value={whatsAppMessage}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-emerald-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="font-bold text-xs">Excel Matrix Auto-Download</div>
                    <div className="text-[10px] text-emerald-700">Excel dossier will download automatically upon opening WhatsApp Web</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppWeb}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Open WhatsApp Web</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: TRANSMIT TO RHBs WITH SECURITY & ETHIOPIAN REGIONS VERIFICATION */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-900 text-amber-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Security Authorization & Regional Verification Check
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Institutional Quota Dispatch Authorization to Regional Health Bureaus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransmitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Security Verification Protocol Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 space-y-2">
              <div className="flex items-center justify-between font-bold text-xs uppercase tracking-tight">
                <span className="flex items-center gap-1.5 text-indigo-900">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Security Clearance Protocol (MOH PMD Directorate)</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 font-mono text-[10px]">
                  ENCRYPTED TRANSMITTAL
                </span>
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                For security and audit purposes, please verify all 15 Ethiopian Regions authorized to receive this breakdown quota letter. Only checked regions will be granted access in Stage 3.
              </p>
            </div>

            {/* ALL 15 ETHIOPIAN REGIONS VERIFICATION GRID */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="uppercase tracking-wider text-[11px]">
                  Targeted Ethiopian Regions Authorization Grid ({Object.values(approvedRegions).filter(Boolean).length}/15 Approved)
                </span>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      ETHIOPIAN_REGIONS.forEach(r => { all[r] = true; });
                      setApprovedRegions(all);
                    }}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    Select All 15
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const activeInTable = new Set(rows.map(r => r.region.toLowerCase()));
                      const filtered: Record<string, boolean> = {};
                      ETHIOPIAN_REGIONS.forEach(r => { filtered[r] = activeInTable.has(r.toLowerCase()); });
                      setApprovedRegions(filtered);
                    }}
                    className="text-cyan-700 font-bold hover:underline cursor-pointer"
                  >
                    Only Table Rows ({rows.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                {ETHIOPIAN_REGIONS.map((reg) => {
                  const isApproved = approvedRegions[reg] !== false;
                  const isPresentInTable = rows.some(r => r.region.toLowerCase() === reg.toLowerCase());

                  return (
                    <label 
                      key={reg}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        isApproved
                          ? isPresentInTable
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                            : 'bg-white border-slate-300 text-slate-800'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={(e) => {
                            setApprovedRegions(prev => ({ ...prev, [reg]: e.target.checked }));
                          }}
                          className="rounded accent-emerald-600 cursor-pointer"
                        />
                        <span className="truncate">{reg}</span>
                      </div>
                      {isPresentInTable && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-200 text-emerald-900 shrink-0">
                          Table
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Official Covering Letter Upload */}
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Paperclip className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-950">Official Ministerial Covering Letter</div>
                  <div className="text-[10px] text-amber-800 font-medium">Attach signed breakdown authorization document (PDF/DOC)</div>
                </div>
              </div>
              <input 
                type="file" 
                id="letter-upload-security" 
                className="hidden" 
                onChange={(e) => setUploadedLetter(e.target.files?.[0] || null)}
              />
              <label 
                htmlFor="letter-upload-security"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black cursor-pointer shadow-2xs transition-colors shrink-0"
              >
                {uploadedLetter ? 'Letter Attached' : 'Attach Letter PDF'}
              </label>
            </div>

            {/* Security Sign-off Toggles */}
            <div className="space-y-2 pt-1 border-t border-slate-100 text-xs font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={securitySealConfirmed}
                  onChange={(e) => setSecuritySealConfirmed(e.target.checked)}
                  className="rounded accent-emerald-600 cursor-pointer"
                />
                <span>Confirm Official Ministerial Stamp & Signatory Verification Seal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={auditClearancePassed}
                  onChange={(e) => setAuditClearancePassed(e.target.checked)}
                  className="rounded accent-emerald-600 cursor-pointer"
                />
                <span>Audit Clearance: Grant access only to security-approved Regional Health Bureaus</span>
              </label>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransmitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransmit}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-amber-300 rounded-xl font-black transition cursor-pointer flex items-center gap-2 shadow-md text-xs uppercase tracking-widest"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Confirm & Submit to RHBs</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
