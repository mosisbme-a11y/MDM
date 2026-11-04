import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  Save, 
  X, 
  Copy, 
  Package, 
  Layers, 
  Building2, 
  Calendar, 
  Check, 
  Share2,
  FileText,
  Mail,
  MessageCircle,
  ExternalLink,
  Link2,
  ShieldCheck,
  Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MultipleStockRecord, DspWorkflowRecord, HealthFacilityRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { 
  DspRequestTemplateRow, 
  DSP_REQUEST_TEMPLATE_COLUMNS, 
  DEFAULT_DSP_REQUEST_TEMPLATE_ROWS,
  TODAY_ISO_DATE,
  isProgramHpStockItem,
  buildDspTemplateRowsFromStock,
  downloadDspRequestTemplateExcel,
  downloadDspRequestCSV,
  generateDspRequestExcelBlob
} from '../data/defaultDspRequestTemplateData';
import { saveDspRecordsToIndexedDB } from '../utils/indexedDbCache';
import { getAccessToken, googleSignIn } from '../utils/googleWorkspace';
import { loadGmailTemplates, formatGmailSubject, formatGmailBody } from '../utils/gmailTemplates';

interface DspRequestMohTemplateViewProps {
  multipleStockItems?: MultipleStockRecord[];
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems?: HealthFacilityRecord[];
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
  onOpenDspRequestModal?: () => void;
}

export const DspRequestMohTemplateView: React.FC<DspRequestMohTemplateViewProps> = ({
  multipleStockItems = [],
  records,
  setRecords,
  hfListItems = [],
  onTriggerCloudSync,
  onOpenDspRequestModal
}) => {
  // Filter multipleStockItems to ONLY Program (HP) items
  const programHpStockItems = useMemo(() => {
    return (multipleStockItems || []).filter(isProgramHpStockItem);
  }, [multipleStockItems]);

  // Track if live linked to Multiple Stock
  const [isLinkedToStock, setIsLinkedToStock] = useState<boolean>(() => {
    const stored = localStorage.getItem('epss_dsp_request_is_linked_stock');
    return stored !== null ? stored === 'true' : true;
  });

  // Load saved template rows from localStorage or generate from Program HP stock
  const [templateRows, setTemplateRows] = useState<DspRequestTemplateRow[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_request_template_rows');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure auto-filled today date and MOH target
          return parsed.map((r, i) => ({
            ...r,
            srNo: i + 1,
            requestDate: r.requestDate || TODAY_ISO_DATE,
            dspRequestTo: r.dspRequestTo || 'MOH'
          }));
        }
      }
    } catch (e) {
      console.error('Error loading template rows:', e);
    }
    return buildDspTemplateRowsFromStock(multipleStockItems, TODAY_ISO_DATE);
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetSourceFilter, setBudgetSourceFilter] = useState('all');
  const [yellowTheme, setYellowTheme] = useState<'vibrant' | 'classic'>('vibrant');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DspRequestTemplateRow>>({});
  
  // Modals for Sending & Operations
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStockImportModalOpen, setIsStockImportModalOpen] = useState(false);

  // Email state
  const [emailTo, setEmailTo] = useState('pmd@moh.gov.et');
  const [emailCc, setEmailCc] = useState('epss-med-equip@epss.gov.et');
  const [emailSubject, setEmailSubject] = useState(`Official DSP Request: EPSS to MOH - Priority Program (HP) Equipment Allocation [${TODAY_ISO_DATE}]`);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // WhatsApp state
  const [waPhone, setWaPhone] = useState('+251911234567');
  const [waCopied, setWaCopied] = useState(false);

  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedUploadRows, setParsedUploadRows] = useState<DspRequestTemplateRow[]>([]);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

  // Stock Import Search State
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [stockDefaultBudget, setStockDefaultBudget] = useState('WB');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Row Form State with auto-filled date and MOH
  const [newRowData, setNewRowData] = useState<Omit<DspRequestTemplateRow, 'id' | 'srNo'>>({
    material: '',
    materialDescription: '',
    qty: 1,
    totalAmount: 0,
    valuationTypeDesc: 'Siemens Healthineers',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'WB',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  });

  // Save to localStorage whenever rows change
  useEffect(() => {
    try {
      localStorage.setItem('epss_dsp_request_template_rows', JSON.stringify(templateRows));
      localStorage.setItem('epss_dsp_request_is_linked_stock', String(isLinkedToStock));
    } catch (e) {
      console.error('Error saving template rows:', e);
    }
  }, [templateRows, isLinkedToStock]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronize with Multiple Stock (Program HP items only)
  const handleSyncWithMultipleStock = () => {
    const updated = buildDspTemplateRowsFromStock(multipleStockItems, TODAY_ISO_DATE);
    setTemplateRows(updated);
    setIsLinkedToStock(true);
    showToast(`✓ Linked & updated with ${updated.length} Program (HP) items from Multiple Stock`);
  };

  // Unique budget sources for filter
  const uniqueBudgetSources = useMemo(() => {
    const set = new Set<string>();
    templateRows.forEach(r => {
      if (r.budgetSource && r.budgetSource.trim()) {
        set.add(r.budgetSource.trim());
      }
    });
    return Array.from(set);
  }, [templateRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return templateRows.filter(r => {
      const matchSearch = 
        r.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.materialDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.wbsElement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.valuationTypeDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.budgetSource.toLowerCase().includes(searchQuery.toLowerCase());

      const matchBudget = budgetSourceFilter === 'all' || r.budgetSource === budgetSourceFilter;

      return matchSearch && matchBudget;
    });
  }, [templateRows, searchQuery, budgetSourceFilter]);

  // Aggregated totals
  const totals = useMemo(() => {
    const totalQty = templateRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalValuation = templateRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    return {
      lineItemsCount: templateRows.length,
      totalQty,
      totalValuation
    };
  }, [templateRows]);

  // Inline edit handlers
  const handleStartEdit = (row: DspRequestTemplateRow) => {
    setEditingRowId(row.id);
    setEditFormData({ 
      ...row,
      requestDate: row.requestDate || TODAY_ISO_DATE,
      dspRequestTo: row.dspRequestTo || 'MOH'
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleSaveEdit = (rowId: string) => {
    setTemplateRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          ...editFormData,
          qty: Number(editFormData.qty) || r.qty,
          totalAmount: Number(editFormData.totalAmount) || r.totalAmount,
          requestDate: editFormData.requestDate || TODAY_ISO_DATE,
          dspRequestTo: editFormData.dspRequestTo || 'MOH'
        } as DspRequestTemplateRow;
      }
      return r;
    }));
    setEditingRowId(null);
    setEditFormData({});
    showToast('✓ Material row updated successfully');
  };

  const handleDeleteRow = (rowId: string) => {
    if (window.confirm('Delete this material item from the DSP Request?')) {
      setTemplateRows(prev => {
        const updated = prev.filter(r => r.id !== rowId).map((r, idx) => ({
          ...r,
          srNo: idx + 1
        }));
        return updated;
      });
      showToast('Material row removed');
    }
  };

  const handleDuplicateRow = (row: DspRequestTemplateRow) => {
    const newRow: DspRequestTemplateRow = {
      ...row,
      id: `dsp-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      srNo: templateRows.length + 1,
      requestDate: TODAY_ISO_DATE,
      dspRequestTo: 'MOH'
    };
    setTemplateRows(prev => [...prev, newRow]);
    showToast('Row duplicated');
  };

  // Add New Row Submit (auto-fills Request Date and DSP request to)
  const handleAddNewRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRowData.material || !newRowData.materialDescription) {
      alert('Material Code and Description are required');
      return;
    }
    const newRow: DspRequestTemplateRow = {
      ...newRowData,
      id: `dsp-row-${Date.now()}`,
      srNo: templateRows.length + 1,
      qty: Number(newRowData.qty) || 1,
      totalAmount: Number(newRowData.totalAmount) || 0,
      requestDate: newRowData.requestDate || TODAY_ISO_DATE,
      dspRequestTo: 'MOH'
    };
    setTemplateRows(prev => [...prev, newRow]);
    setIsAddModalOpen(false);
    setNewRowData({
      material: '',
      materialDescription: '',
      qty: 1,
      totalAmount: 0,
      valuationTypeDesc: 'Siemens Healthineers',
      wbsElement: 'SDG-ME-23-001-011',
      budgetSource: 'WB',
      requestDate: TODAY_ISO_DATE,
      dspRequestTo: 'MOH'
    });
    showToast('✓ New Program (HP) material added to DSP Request');
  };

  // Reset to default Program HP items
  const handleResetToDefaultTemplate = () => {
    if (window.confirm('Reset DSP Request table to original 5 Program (HP) items?')) {
      const resetRows = DEFAULT_DSP_REQUEST_TEMPLATE_ROWS.map(r => ({
        ...r,
        requestDate: TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
      setTemplateRows(resetRows);
      setIsLinkedToStock(true);
      showToast('✓ Restored to default 5 Program (HP) items');
    }
  };

  // Excel / CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      reader.onload = (event) => {
        try {
          const csvText = event.target?.result as string;
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              processUploadedData(results.data);
            },
            error: (err: any) => {
              setUploadError(`CSV Parse Error: ${err.message}`);
            }
          });
        } catch (err: any) {
          setUploadError(`Failed to read CSV: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          processUploadedData(jsonData);
        } catch (err: any) {
          setUploadError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processUploadedData = (rows: any[]) => {
    if (!rows || rows.length === 0) {
      setUploadError('Uploaded file contains no data rows.');
      return;
    }

    const mappedRows: DspRequestTemplateRow[] = [];

    rows.forEach((row, idx) => {
      const getVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          for (const rowKey of Object.keys(row)) {
            if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
              return row[rowKey];
            }
          }
        }
        return '';
      };

      const material = String(getVal(['Material', 'Material Code', 'Item Code', 'Item No', 'Material Number']) || '').trim();
      const materialDescription = String(getVal(['Material Description', 'Description', 'Item Description', 'Equipment Name']) || '').trim();
      const qty = Number(getVal(['Qty', 'Quantity', 'Unrestricted Stock', 'Stock Qty'])) || 1;
      const totalAmount = Number(getVal(['Total Amount', 'Amount', 'Total Value', 'Current Value (ETB)', 'Total Price'])) || 0;
      const valuationTypeDesc = String(getVal(['Valuation Type Desc', 'Valuation Type', 'Manufacturer', 'Supplier', 'Make']) || '').trim();
      const wbsElement = String(getVal(['WBS Element', 'WBS', 'Project Code', 'Grant Ref']) || '').trim();
      const budgetSource = String(getVal(['Budget Source', 'Funding Source', 'Donor', 'Budget']) || 'WB').trim();
      const requestDate = String(getVal(['Request Date', 'Date']) || TODAY_ISO_DATE).trim();
      const dspRequestTo = String(getVal(['DSP request to', 'DSP Request To', 'Target', 'DSP Target', 'Recipient']) || 'MOH').trim();

      if (material || materialDescription) {
        mappedRows.push({
          id: `uploaded-row-${idx}-${Date.now()}`,
          srNo: idx + 1,
          material: material || `MAT-${1000 + idx}`,
          materialDescription: materialDescription || 'Medical Equipment Item',
          qty,
          totalAmount,
          valuationTypeDesc: valuationTypeDesc || 'Siemens Healthineers',
          wbsElement: wbsElement || 'SDG-ME-23-001-011',
          budgetSource: budgetSource || 'WB',
          requestDate: requestDate || TODAY_ISO_DATE,
          dspRequestTo: dspRequestTo || 'MOH'
        });
      }
    });

    if (mappedRows.length === 0) {
      setUploadError('Could not find recognizable material columns. Headers must follow: S/N, Material, Material Description, Qty, Total Amount, Valuation Type Desc, WBS Element, Budget Source, Request Date, DSP request to');
      return;
    }

    setParsedUploadRows(mappedRows);
  };

  const handleApplyUpload = () => {
    if (parsedUploadRows.length === 0) return;

    if (uploadMode === 'replace') {
      const renumbered = parsedUploadRows.map((r, idx) => ({ 
        ...r, 
        srNo: idx + 1,
        requestDate: r.requestDate || TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
      setTemplateRows(renumbered);
      showToast(`✓ Loaded ${renumbered.length} rows from file into DSP Request template`);
    } else {
      const offset = templateRows.length;
      const renumbered = parsedUploadRows.map((r, idx) => ({ 
        ...r, 
        srNo: offset + idx + 1,
        requestDate: r.requestDate || TODAY_ISO_DATE,
        dspRequestTo: 'MOH'
      }));
      setTemplateRows(prev => [...prev, ...renumbered]);
      showToast(`✓ Appended ${renumbered.length} rows to DSP Request template`);
    }

    setIsUploadModalOpen(false);
    setParsedUploadRows([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Stock Import filtering - strictly Program (HP) items
  const filteredStockForImport = useMemo(() => {
    return programHpStockItems.filter(item => {
      const q = stockSearchQuery.toLowerCase();
      return (
        item.material.toLowerCase().includes(q) ||
        item.materialDescription.toLowerCase().includes(q) ||
        (item.wbsElement && item.wbsElement.toLowerCase().includes(q)) ||
        (item.inventoryValuationType && item.inventoryValuationType.toLowerCase().includes(q))
      );
    });
  }, [programHpStockItems, stockSearchQuery]);

  const handleToggleStockItem = (id: string) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllStock = () => {
    if (selectedStockIds.length === filteredStockForImport.length) {
      setSelectedStockIds([]);
    } else {
      setSelectedStockIds(filteredStockForImport.map(s => s.id));
    }
  };

  const handleApplyStockImport = () => {
    const selected = programHpStockItems.filter(s => selectedStockIds.includes(s.id));
    if (selected.length === 0) {
      alert('Please select at least one Program (HP) stock device');
      return;
    }

    const offset = templateRows.length;
    const newItems: DspRequestTemplateRow[] = selected.map((s, idx) => ({
      id: `stock-hp-import-${s.id}-${Date.now()}`,
      srNo: offset + idx + 1,
      material: s.material,
      materialDescription: s.materialDescription,
      qty: s.unrestrictedStock > 0 ? s.unrestrictedStock : 1,
      totalAmount: s.currentValueOfUnrestrictedStock || 0,
      valuationTypeDesc: s.inventoryValuationType || 'Standard Price (S)',
      wbsElement: s.wbsElement || 'SDG-ME-23-001',
      budgetSource: stockDefaultBudget || 'WB',
      requestDate: TODAY_ISO_DATE,
      dspRequestTo: 'MOH'
    }));

    setTemplateRows(prev => [...prev, ...newItems]);
    setIsStockImportModalOpen(false);
    setSelectedStockIds([]);
    showToast(`✓ Imported ${newItems.length} Program (HP) items into DSP Request`);
  };

  // 1. SEND OPTION: EMAIL DISPATCH
  const emailBodyText = useMemo(() => {
    const lines = templateRows.map((r, i) => 
      `${i + 1}. [${r.material}] ${r.materialDescription} | Qty: ${r.qty} | Value: ETB ${r.totalAmount.toLocaleString()} | WBS: ${r.wbsElement} | Budget: ${r.budgetSource} | Date: ${r.requestDate} | Target: ${r.dspRequestTo}`
    ).join('\n');

    return `Dear Ministry of Health (MOH) PMD Directorate,

Please find attached the official DSP Request for priority Health Program (HP) medical equipment allocation.

Allocated Program (HP) Line Items (${templateRows.length}):
${lines}

SUMMARY:
• Total Items: ${totals.lineItemsCount} Materials
• Total Quantity: ${formatNumber(totals.totalQty)} Units
• Total Budget Valuation: ${formatCurrency(totals.totalValuation)}
• Request Date: ${TODAY_ISO_DATE}
• Transmittal Channel: Official EPSS to MOH DSP Request Protocol

Attached: Official 10-Column DSP Allocation Excel Dossier (${DSP_REQUEST_TEMPLATE_COLUMNS.join(', ')}).

Issued by:
EPSS Head Office (Medical Equipment Directorate)
Authorized Directorate Desk`;
  }, [templateRows, totals]);

  const handleSendViaEmail = async () => {
    setIsSendingEmail(true);
    try {
      // Generate the Excel blob to attach or download
      const { blob, fileName } = generateDspRequestExcelBlob(templateRows);
      
      // Try Google Workspace sign in / access token if available
      const token = await getAccessToken();
      if (token) {
        // Send via Gmail API if user connected Google Workspace
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
          setEmailSuccess(true);
          showToast(`✓ Official DSP Request sent via Gmail to ${emailTo}!`);
          setTimeout(() => {
            setIsEmailModalOpen(false);
            setEmailSuccess(false);
          }, 2000);
          return;
        }
      }

      // Fallback: download Excel and open mailto link
      downloadDspRequestTemplateExcel(templateRows);
      const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCc)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyText)}`;
      window.location.href = mailtoUrl;
      showToast(`✓ Excel downloaded & mail client launched for ${emailTo}`);
      setIsEmailModalOpen(false);
    } catch (err: any) {
      console.error('Email send error:', err);
      downloadDspRequestTemplateExcel(templateRows);
      window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyText)}`;
      showToast(`Excel downloaded. Opened default email client.`);
      setIsEmailModalOpen(false);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 2. SEND OPTION: WHATSAPP DISPATCH
  const whatsAppMessage = useMemo(() => {
    const lines = templateRows.map((r, i) => 
      `*${i + 1}. ${r.material}* — ${r.materialDescription}\n   • Qty: *${formatNumber(r.qty)}* | Value: *ETB ${formatNumber(r.totalAmount)}*\n   • WBS: ${r.wbsElement} | Budget: ${r.budgetSource}\n   • Request Date: ${r.requestDate} | DSP Request to: *${r.dspRequestTo}*`
    ).join('\n\n');

    return `*🏥 ETHIOPIAN PHARMACEUTICAL SUPPLY SERVICE (EPSS)*\n*OFFICIAL DSP REQUEST TO MOH (PROGRAM HP)*\n*Request Date:* ${TODAY_ISO_DATE}\n*DSP Request To:* MOH PMD Directorate\n\n*ALLOCATED PROGRAM (HP) MEDICAL EQUIPMENT (${templateRows.length}):*\n${lines}\n\n*TOTAL ALLOCATION:* \n• Total Items: *${totals.lineItemsCount}*\n• Total Requested Qty: *${formatNumber(totals.totalQty)} Units*\n• Total Valuation: *${formatCurrency(totals.totalValuation)}*\n• Protocol: Standard 10-Column EPSS Quota Allocation`;
  }, [templateRows, totals]);

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(whatsAppMessage);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 3000);
    showToast('✓ WhatsApp message copied to clipboard');
  };

  const handleOpenWhatsAppWeb = () => {
    downloadDspRequestTemplateExcel(templateRows);
    const cleanPhone = waPhone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;
    window.open(url, '_blank');
    showToast(`✓ Opened WhatsApp Web with DSP Request payload & downloaded Excel`);
    setIsWhatsAppModalOpen(false);
  };

  // 3. SEND OPTION: DIRECT TRANSMIT TO MOH
  const handleTransmitDspRequest = () => {
    const refNum = `EPSS/MD-DSP/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`;
    const newRecord: DspWorkflowRecord = {
      id: `dsp-dossier-${Date.now()}`,
      dspRefNumber: refNum,
      stage: 'head-office-dsp',
      subStage: '1.1',
      stageTitle: 'Head Office DSP Management',
      senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      subject: `DSP Request to MOH: Program (HP) Equipment Allocation Request (${templateRows.length} Materials)`,
      status: 'Submitted & Pending',
      dateSubmitted: TODAY_ISO_DATE,
      totalDevices: templateRows.length,
      totalQuantity: totals.totalQty,
      totalValuationETB: totals.totalValuation,
      targetedRegions: ['Oromia', 'Amhara', 'Sidama', 'Somali'],
      targetedFacilitiesCount: 14,
      officialLetterRef: `EPSS/LET/${new Date().getFullYear()}/${String(Math.floor(1000 + Math.random() * 9000))}`,
      signatory: 'Mosisa (Authorized User)',
      signatoryRole: 'Directorate Technical Lead',
      itemsIncluded: templateRows.map(r => ({
        material: r.material,
        description: r.materialDescription,
        quantity: r.qty,
        plant: 'AA01 Central',
        allocatedFacility: 'Regional Allocation Quota'
      })),
      notes: `Generated via 10-Column Standard DSP Request Template linked with Multiple Stock (Program HP). Budget Sources: ${uniqueBudgetSources.join(', ') || 'WB'}`
    };

    setRecords(prev => {
      const updated = [newRecord, ...prev];
      saveDspRecordsToIndexedDB(updated);
      return updated;
    });

    if (onTriggerCloudSync) {
      onTriggerCloudSync(`Official DSP Request ${refNum} transmitted to MOH`, {
        type: 'CREATE',
        title: `DSP Request ${refNum}`,
        payload: newRecord
      });
    }

    setIsTransmitModalOpen(false);
    showToast(`✓ Official DSP Request ${refNum} transmitted to MOH PMD Directorate!`);
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

      {/* Top Banner Card featuring EXACT button from user screenshot _F5CEE97D-E190-4DB3-8E28-46C308C4EDEB__9d85d2b5.png */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* EXACT PILL BUTTON FROM USER SCREENSHOT _F5CEE97D-E190-4DB3-8E28-46C308C4EDEB__9d85d2b5.png */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0B1527] border border-[#0B1527] shadow-md ring-2 ring-amber-400/50">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 animate-pulse" />
              <span className="text-xs md:text-sm font-black text-white tracking-tight">
                DSP Request to MOH
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-[#F59E0B] text-slate-950">
                {templateRows.length}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Linked with Multiple Stock (Program HP Only)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Auto-fill Active
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                EPSS Head Office ➔ Ministry of Health (PMD Directorate)
              </div>
            </div>
          </div>

          {/* Action Toolbar with Email, WhatsApp, Send to MOH */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Send via Email Button */}
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Send DSP Request via official email to MOH"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send via Email</span>
            </button>

            {/* Send via WhatsApp Button */}
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Send DSP Request via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>

            {/* Send to MOH (Direct Institutional Transmittal) */}
            <button
              type="button"
              onClick={() => setIsTransmitModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
              title="Confirm official DSP Request transmittal to MOH PMD Directorate"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Send to MOH</span>
            </button>

            {/* Sync from Multiple Stock (Program HP) */}
            <button
              type="button"
              onClick={handleSyncWithMultipleStock}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Sync table with latest Multiple Stock Program (HP) items"
            >
              <RefreshCw className="w-3 h-3 text-cyan-600" />
              <span>Sync HP Stock ({programHpStockItems.length})</span>
            </button>

            {/* Download Template Excel */}
            <button
              type="button"
              onClick={() => downloadDspRequestTemplateExcel(templateRows)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Download formatted Excel (.xlsx) file with orange headers and yellow rows"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            {/* Add Row Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer shadow-xs"
              title="Add Material Row"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Program (HP) Items</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-black text-slate-900 font-mono">{totals.lineItemsCount}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">HP Only</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Requested Qty</span>
            <span className="text-base font-black text-cyan-800 font-mono mt-0.5 block">{formatNumber(totals.totalQty)} Units</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Valuation (ETB)</span>
            <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">{formatCurrency(totals.totalValuation)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Recipient (Auto)</span>
              <span className="text-xs font-black text-indigo-700 block mt-0.5">MOH (Ministry of Health)</span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaultTemplate}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer"
              title="Reset table to 5 standard Program (HP) items"
            >
              Reset 5
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Material Code, Description, WBS Element, Valuation..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={budgetSourceFilter}
              onChange={(e) => setBudgetSourceFilter(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">All Budget Sources ({uniqueBudgetSources.length})</option>
              {uniqueBudgetSources.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-500">Theme:</span>
          <button
            type="button"
            onClick={() => setYellowTheme('vibrant')}
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer border ${
              yellowTheme === 'vibrant'
                ? 'bg-[#FFFF00] text-black border-black shadow-2xs font-mono'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            Vibrant Yellow
          </button>
          <button
            type="button"
            onClick={() => setYellowTheme('classic')}
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer border ${
              yellowTheme === 'classic'
                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs font-mono'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            Soft Yellow
          </button>
        </div>
      </div>

      {/* THE OFFICIAL 10-COLUMN TEMPLATE TABLE MATCHING USER REQUEST & SCREENSHOT {639F1CC2-A50D-439A-93C3-F49D8E836963}.png */}
      <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-text">
            {/* Orange Header with Italic Bold Black Text */}
            <thead>
              <tr className="bg-[#FFA500] text-black italic font-bold text-xs md:text-sm border-b-2 border-black">
                <th className="py-2.5 px-3 text-center border-r border-black min-w-[60px] whitespace-nowrap">
                  S/N
                </th>
                <th className="py-2.5 px-3 text-left border-r border-black min-w-[140px] whitespace-nowrap font-mono">
                  Material
                </th>
                <th className="py-2.5 px-3 text-left border-r border-black min-w-[260px]">
                  Material Description
                </th>
                <th className="py-2.5 px-3 text-right border-r border-black min-w-[70px] whitespace-nowrap">
                  Qty
                </th>
                <th className="py-2.5 px-3 text-right border-r border-black min-w-[140px] whitespace-nowrap">
                  Total Amount
                </th>
                <th className="py-2.5 px-3 text-left border-r border-black min-w-[170px] whitespace-nowrap">
                  Valuation Type Desc
                </th>
                <th className="py-2.5 px-3 text-left border-r border-black min-w-[170px] whitespace-nowrap font-mono">
                  WBS Element
                </th>
                <th className="py-2.5 px-3 text-center border-r border-black min-w-[120px] whitespace-nowrap">
                  Budget Source
                </th>
                <th className="py-2.5 px-3 text-center border-r border-black min-w-[120px] whitespace-nowrap">
                  Request Date
                </th>
                <th className="py-2.5 px-3 text-center border-r border-black min-w-[130px] whitespace-nowrap">
                  DSP request to
                </th>
                <th className="py-2.5 px-2 text-center min-w-[80px] text-[10px] not-italic font-sans uppercase bg-[#FF9000] border-l border-black">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Bright Yellow Data Rows matching screenshot */}
            <tbody className={yellowTheme === 'vibrant' ? 'bg-[#FFFF00]' : 'bg-[#FEF08A]'}>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-black font-bold border-b border-black">
                    No matching Program (HP) rows found. Click "Sync HP Stock" or "Reset 5" to reload.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isEditing = editingRowId === row.id;

                  if (isEditing) {
                    return (
                      <tr key={row.id} className="bg-amber-100 border-b border-black text-black">
                        <td className="p-1.5 text-center border-r border-black font-mono font-bold">
                          {row.srNo}
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.material ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, material: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.materialDescription ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, materialDescription: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs font-medium"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="number"
                            value={editFormData.qty ?? 1}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, qty: Number(e.target.value) }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs font-bold text-right"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.totalAmount ?? 0}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, totalAmount: Number(e.target.value) }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs font-bold text-right font-mono"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.valuationTypeDesc ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, valuationTypeDesc: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.wbsElement ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, wbsElement: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.budgetSource ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, budgetSource: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs text-center font-bold"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="date"
                            value={editFormData.requestDate ?? TODAY_ISO_DATE}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, requestDate: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs text-center"
                          />
                        </td>
                        <td className="p-1 border-r border-black">
                          <input
                            type="text"
                            value={editFormData.dspRequestTo ?? 'MOH'}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, dspRequestTo: e.target.value }))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-400 rounded text-xs text-center font-bold"
                          />
                        </td>
                        <td className="p-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(row.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                              title="Save Changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={row.id} 
                      className="border-b border-black text-black font-medium hover:brightness-95 transition-all group"
                    >
                      {/* 1. S/N */}
                      <td className="py-2 px-3 text-center border-r border-black font-mono font-bold">
                        {row.srNo}
                      </td>

                      {/* 2. Material */}
                      <td className="py-2 px-3 text-left border-r border-black font-mono font-bold">
                        {row.material}
                      </td>

                      {/* 3. Material Description */}
                      <td className="py-2 px-3 text-left border-r border-black font-semibold">
                        {row.materialDescription}
                      </td>

                      {/* 4. Qty */}
                      <td className="py-2 px-3 text-right border-r border-black font-mono font-bold">
                        {row.qty}
                      </td>

                      {/* 5. Total Amount */}
                      <td className="py-2 px-3 text-right border-r border-black font-mono font-bold">
                        {row.totalAmount > 0 
                          ? Number(row.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '0.00'}
                      </td>

                      {/* 6. Valuation Type Desc */}
                      <td className="py-2 px-3 text-left border-r border-black font-medium">
                        {row.valuationTypeDesc}
                      </td>

                      {/* 7. WBS Element */}
                      <td className="py-2 px-3 text-left border-r border-black font-mono text-[11px]">
                        {row.wbsElement}
                      </td>

                      {/* 8. Budget Source */}
                      <td className="py-2 px-3 text-center border-r border-black font-bold">
                        {row.budgetSource}
                      </td>

                      {/* 9. Request Date (Auto-filled with today) */}
                      <td className="py-2 px-3 text-center border-r border-black font-mono text-[11px]">
                        {row.requestDate || TODAY_ISO_DATE}
                      </td>

                      {/* 10. DSP request to (Auto-filled with MOH) */}
                      <td className="py-2 px-3 text-center border-r border-black font-bold text-slate-950">
                        {row.dspRequestTo || 'MOH'}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-1 text-center bg-yellow-200/50">
                        <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(row)}
                            className="p-1 hover:bg-black/10 rounded cursor-pointer text-slate-800"
                            title="Edit Row"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateRow(row)}
                            className="p-1 hover:bg-black/10 rounded cursor-pointer text-slate-800"
                            title="Duplicate Row"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 hover:bg-rose-600 hover:text-white rounded cursor-pointer text-rose-800"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Authentic Spreadsheet Yellow Empty Grid Rows */}
              {[1, 2, 3, 4, 5].map((emptyIdx) => (
                <tr key={`empty-${emptyIdx}`} className="border-b border-black h-7">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>

            {/* Total Row Footer */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-black">
                <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-amber-400 font-mono">
                  Total Requested Allocation:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-cyan-300 border-x border-slate-700">
                  {formatNumber(totals.totalQty)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-400 border-r border-slate-700">
                  {formatCurrency(totals.totalValuation)}
                </td>
                <td colSpan={6} className="py-2.5 px-3 text-[11px] text-slate-300 font-normal">
                  <span className="font-bold text-amber-300 font-mono">{totals.lineItemsCount}</span> Program (HP) Materials • Destination: <span className="font-bold text-white">Ministry of Health (MOH)</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* FOOTER CALLOUT WITH SEND SUMMARY */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong className="text-slate-800">Auto-Filled Fields:</strong> Request Date is set to today (<strong>{TODAY_ISO_DATE}</strong>) and DSP Request To is locked to <strong>MOH</strong>.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <Mail className="w-3 h-3" />
            <span>Email MOH</span>
          </button>
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <MessageCircle className="w-3 h-3" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTransmitModalOpen(true)}
            className="px-2.5 py-1 bg-slate-900 hover:bg-black text-amber-300 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
          >
            <Send className="w-3 h-3 text-amber-400" />
            <span>Submit Dossier</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: SEND VIA EMAIL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send DSP Request via Email</h3>
                  <p className="text-[11px] text-slate-400">Transmit official 10-column Excel dossier to MOH PMD Directorate</p>
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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">To (Official MOH Email)</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CC (EPSS Directorate)</label>
                  <input
                    type="email"
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
                    <div className="font-bold text-xs">DSP_Request_to_MOH_Program_HP_{TODAY_ISO_DATE}.xlsx</div>
                    <div className="text-[10px] text-indigo-600">10 Columns Standard Template ({templateRows.length} Items)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadDspRequestTemplateExcel(templateRows)}
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingEmail ? 'Dispatching...' : 'Dispatch Email to MOH'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND VIA WHATSAPP */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send DSP Request via WhatsApp</h3>
                  <p className="text-[11px] text-slate-400">Share Program (HP) equipment quota directly to MOH WhatsApp Desk</p>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">MOH WhatsApp Contact / Phone Number</label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+251911234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">Formatted Message Payload</label>
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {waCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{waCopied ? 'Copied!' : 'Copy Message'}</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  readOnly
                  value={whatsAppMessage}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-center justify-between">
                <div>
                  <span className="font-bold block">10-Column Excel Sheet Auto-Generated</span>
                  <span className="text-[10px] text-emerald-700">Will be downloaded automatically when launching WhatsApp Web</span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadDspRequestTemplateExcel(templateRows)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Download Excel
                </button>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Launch WhatsApp Web</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND TO MOH (DIRECT INSTITUTIONAL TRANSMITTAL) */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send DSP Request to MOH</h3>
                  <p className="text-[11px] text-slate-400">Institutional quota submission to Ministry of Health PMD Directorate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransmitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-500 font-bold uppercase text-[10px]">
                  <span>Payload Details</span>
                  <span className="text-amber-600 font-mono font-bold">PROGRAM (HP) DEDICATED</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">TOTAL ITEMS</span>
                    <span className="font-bold text-slate-900">{totals.lineItemsCount} Materials</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">REQUESTED UNITS</span>
                    <span className="font-bold text-cyan-800">{formatNumber(totals.totalQty)} Units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">TOTAL VALUATION</span>
                    <span className="font-black text-emerald-700">{formatCurrency(totals.totalValuation)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DESTINATION</span>
                    <span className="font-bold text-slate-900">MOH PMD Directorate</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Dossier Ready for Official Endorsement</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Submitting generates an official transmittal reference number (e.g. EPSS/MD-DSP/2026/042) and registers this request into the DSP pipeline with status "Submitted & Pending".
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransmitModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransmitDspRequest}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-amber-300 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Transmittal to MOH</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD MATERIAL ROW */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Add Material to DSP Request</h3>
                  <p className="text-[11px] text-slate-400">Append new equipment row matching template layout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewRow} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Material Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 403-XRRD-0101"
                    value={newRowData.material}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, material: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Valuation Type Desc
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Siemens Healthineers"
                    value={newRowData.valuationTypeDesc}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, valuationTypeDesc: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Material Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anesthesia machine - with Patient mon"
                  value={newRowData.materialDescription}
                  onChange={(e) => setNewRowData(prev => ({ ...prev, materialDescription: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Quantity (Qty) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRowData.qty}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, qty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Total Amount (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 16568693.19"
                    value={newRowData.totalAmount || ''}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, totalAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    WBS Element
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SDG-ME-23-001-011"
                    value={newRowData.wbsElement}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, wbsElement: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Budget Source
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WB / MOH / Treasury"
                    value={newRowData.budgetSource}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, budgetSource: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Request Date (Auto Today)
                  </label>
                  <input
                    type="date"
                    value={newRowData.requestDate || TODAY_ISO_DATE}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, requestDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    DSP Request To (Auto MOH)
                  </label>
                  <input
                    type="text"
                    value={newRowData.dspRequestTo || 'MOH'}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, dspRequestTo: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black transition cursor-pointer shadow-xs"
                >
                  Insert Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: UPLOAD TEMPLATE FILE */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Upload DSP Request Template</h3>
                  <p className="text-[11px] text-slate-400">Import Excel (.xlsx) or CSV following the 10-column schema</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setParsedUploadRows([]);
                  setUploadError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center bg-indigo-50/30 hover:bg-indigo-50/50 transition">
                <FileSpreadsheet className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Select Excel file (.xlsx) or CSV
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Headers: S/N, Material, Material Description, Qty, Total Amount, Valuation Type Desc, WBS Element, Budget Source, Request Date, DSP request to
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="template-upload-input"
                />
                <label
                  htmlFor="template-upload-input"
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs text-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse File</span>
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium">{uploadError}</span>
                </div>
              )}

              {parsedUploadRows.length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      ✓ Parsed {parsedUploadRows.length} rows (Date & MOH auto-filled)
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="uploadMode"
                          checked={uploadMode === 'replace'}
                          onChange={() => setUploadMode('replace')}
                        />
                        <span className="text-[11px] font-bold">Replace Current</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="uploadMode"
                          checked={uploadMode === 'append'}
                          onChange={() => setUploadMode('append')}
                        />
                        <span className="text-[11px] font-bold">Append</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => downloadDspRequestTemplateExcel()}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Blank 10-Col Template</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setParsedUploadRows([]);
                      setUploadError(null);
                    }}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={parsedUploadRows.length === 0}
                    onClick={handleApplyUpload}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
                  >
                    Apply to Table ({parsedUploadRows.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
