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
  ArrowUpDown,
  Share2,
  FileText,
  Mail,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MultipleStockRecord, DspWorkflowRecord, HealthFacilityRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { 
  DspRequestTemplateRow, 
  DSP_REQUEST_TEMPLATE_COLUMNS, 
  DEFAULT_DSP_REQUEST_TEMPLATE_ROWS,
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
  // Load saved template rows from localStorage or defaults
  const [templateRows, setTemplateRows] = useState<DspRequestTemplateRow[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_request_template_rows');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading template rows:', e);
    }
    return DEFAULT_DSP_REQUEST_TEMPLATE_ROWS;
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetSourceFilter, setBudgetSourceFilter] = useState('all');
  const [yellowTheme, setYellowTheme] = useState<'vibrant' | 'classic'>('vibrant');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DspRequestTemplateRow>>({});
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStockImportModalOpen, setIsStockImportModalOpen] = useState(false);
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  
  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedUploadRows, setParsedUploadRows] = useState<DspRequestTemplateRow[]>([]);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

  // Stock Import State
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockDefaultBudget, setStockDefaultBudget] = useState('WB');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Row Form State
  const [newRowData, setNewRowData] = useState<Omit<DspRequestTemplateRow, 'id' | 'srNo'>>({
    material: '',
    materialDescription: '',
    qty: 1,
    totalAmount: 0,
    valuationTypeDesc: '',
    wbsElement: '',
    budgetSource: 'WB',
    requestDate: new Date().toISOString().slice(0, 10),
    dspRequestTo: 'MOH'
  });

  // Save to localStorage whenever rows change
  useEffect(() => {
    try {
      localStorage.setItem('epss_dsp_request_template_rows', JSON.stringify(templateRows));
    } catch (e) {
      console.error('Error saving template rows:', e);
    }
  }, [templateRows]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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
    setEditFormData({ ...row });
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
          totalAmount: Number(editFormData.totalAmount) || r.totalAmount
        } as DspRequestTemplateRow;
      }
      return r;
    }));
    setEditingRowId(null);
    setEditFormData({});
    showToast('✓ Material row updated successfully');
  };

  const handleDeleteRow = (rowId: string) => {
    if (window.confirm('Are you sure you want to delete this material row from the DSP request?')) {
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
      srNo: templateRows.length + 1
    };
    setTemplateRows(prev => [...prev, newRow]);
    showToast('Row duplicated');
  };

  // Add New Row Submit
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
      totalAmount: Number(newRowData.totalAmount) || 0
    };
    setTemplateRows(prev => [...prev, newRow]);
    setIsAddModalOpen(false);
    setNewRowData({
      material: '',
      materialDescription: '',
      qty: 1,
      totalAmount: 0,
      valuationTypeDesc: '',
      wbsElement: '',
      budgetSource: 'WB',
      requestDate: new Date().toISOString().slice(0, 10),
      dspRequestTo: 'MOH'
    });
    showToast('✓ New material row added to DSP request');
  };

  // Reset to original image template
  const handleResetToDefaultTemplate = () => {
    if (window.confirm('Reset DSP Request to original template format?')) {
      setTemplateRows(DEFAULT_DSP_REQUEST_TEMPLATE_ROWS);
      showToast('✓ Restored to default template format');
    }
  };

  // Parse Excel / CSV Upload
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
      // Excel (.xlsx, .xls)
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
      // Flexible key lookup
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
      const requestDate = String(getVal(['Request Date', 'Date', 'Posting Date']) || new Date().toISOString().slice(0, 10)).trim();
      const dspRequestTo = String(getVal(['DSP request to', 'DSP Request To', 'Target', 'DSP Target', 'Recipient']) || 'MOH').trim();

      if (material || materialDescription) {
        mappedRows.push({
          id: `uploaded-row-${idx}-${Date.now()}`,
          srNo: idx + 1,
          material: material || `MAT-${1000 + idx}`,
          materialDescription: materialDescription || 'Medical Equipment Item',
          qty,
          totalAmount,
          valuationTypeDesc: valuationTypeDesc || 'Standard Valuation',
          wbsElement: wbsElement || 'SDG-ME-23-001',
          budgetSource: budgetSource || 'WB',
          requestDate,
          dspRequestTo: dspRequestTo || 'MOH'
        });
      }
    });

    if (mappedRows.length === 0) {
      setUploadError('Could not find recognizable material columns. Please check that headers match the template.');
      return;
    }

    setParsedUploadRows(mappedRows);
  };

  const handleApplyUpload = () => {
    if (parsedUploadRows.length === 0) return;

    if (uploadMode === 'replace') {
      const renumbered = parsedUploadRows.map((r, idx) => ({ ...r, srNo: idx + 1 }));
      setTemplateRows(renumbered);
      showToast(`✓ Loaded ${renumbered.length} material rows from template file`);
    } else {
      const offset = templateRows.length;
      const renumbered = parsedUploadRows.map((r, idx) => ({ ...r, srNo: offset + idx + 1 }));
      setTemplateRows(prev => [...prev, ...renumbered]);
      showToast(`✓ Appended ${renumbered.length} material rows to DSP request`);
    }

    setIsUploadModalOpen(false);
    setParsedUploadRows([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Import from Multiple Stock
  const filteredMultipleStock = useMemo(() => {
    return multipleStockItems.filter(item => {
      const q = stockSearchQuery.toLowerCase();
      return (
        item.material.toLowerCase().includes(q) ||
        item.materialDescription.toLowerCase().includes(q) ||
        (item.wbsElement && item.wbsElement.toLowerCase().includes(q)) ||
        (item.inventoryValuationType && item.inventoryValuationType.toLowerCase().includes(q))
      );
    });
  }, [multipleStockItems, stockSearchQuery]);

  const handleToggleStockItem = (id: string) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllStock = () => {
    if (selectedStockIds.length === filteredMultipleStock.length) {
      setSelectedStockIds([]);
    } else {
      setSelectedStockIds(filteredMultipleStock.map(s => s.id));
    }
  };

  const handleApplyStockImport = () => {
    const selected = multipleStockItems.filter(s => selectedStockIds.includes(s.id));
    if (selected.length === 0) {
      alert('Please select at least one stock device');
      return;
    }

    const offset = templateRows.length;
    const newItems: DspRequestTemplateRow[] = selected.map((s, idx) => ({
      id: `stock-import-${s.id}-${Date.now()}`,
      srNo: offset + idx + 1,
      material: s.material,
      materialDescription: s.materialDescription,
      qty: s.unrestrictedStock > 0 ? s.unrestrictedStock : 1,
      totalAmount: s.currentValueOfUnrestrictedStock || 0,
      valuationTypeDesc: s.inventoryValuationType || 'Standard',
      wbsElement: s.wbsElement || 'SDG-ME-23-001',
      budgetSource: stockDefaultBudget || 'WB',
      requestDate: new Date().toISOString().slice(0, 10),
      dspRequestTo: 'MOH'
    }));

    setTemplateRows(prev => [...prev, ...newItems]);
    setIsStockImportModalOpen(false);
    setSelectedStockIds([]);
    showToast(`✓ Imported ${newItems.length} items from Multiple Stock`);
  };

  // Transmit DSP Request to MOH
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
      subject: `DSP Request to MOH: Equipment Allocation Request (${templateRows.length} Materials)`,
      status: 'Submitted & Pending',
      dateSubmitted: new Date().toISOString().slice(0, 10),
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
      notes: `Generated via 10-Column Standard DSP Request Template. Budget Sources: ${uniqueBudgetSources.join(', ') || 'WB'}`
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

      {/* Top Header Card matching Screenshot {8B4F9ED6-4660-4B68-AD79-0040583FA57D}.png */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Exactly the pill from {8B4F9ED6-4660-4B68-AD79-0040583FA57D}.png */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EBF1F6] border border-[#D5E1EC] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8292A2]" />
              <span className="text-xs md:text-sm font-black text-[#1E3A5F] tracking-tight">
                DSP Request to MOH
              </span>
            </div>

            <div className="hidden sm:block">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Stage 1.1 • Standard Quota Allocation Template
              </div>
              <div className="text-xs font-semibold text-slate-700">
                EPSS Head Office ➔ Ministry of Health (PMD Directorate)
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => downloadDspRequestTemplateExcel(templateRows)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Download formatted Excel (.xlsx) file with orange headers and yellow rows"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Template (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => downloadDspRequestCSV(templateRows)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Download CSV file"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Upload template Excel or CSV file"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Upload Template</span>
            </button>

            {multipleStockItems.length > 0 && (
              <button
                type="button"
                onClick={() => setIsStockImportModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Import items directly from Multiple Stock"
              >
                <Package className="w-3.5 h-3.5 text-cyan-600" />
                <span>Import from Stock</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Material Row</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTransmitModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Transmit to MOH</span>
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Material Items</span>
            <span className="text-sm font-black text-slate-900 font-mono">{totals.lineItemsCount} Rows</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Requested Qty</span>
            <span className="text-sm font-black text-cyan-800 font-mono">{formatNumber(totals.totalQty)} Units</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Valuation (ETB)</span>
            <span className="text-sm font-black text-emerald-700 font-mono">{formatCurrency(totals.totalValuation)}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Recipient</span>
              <span className="text-xs font-black text-indigo-700 truncate block">Ministry of Health (MOH)</span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaultTemplate}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer ml-1"
              title="Reset table to initial screenshot template values"
            >
              Reset
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

      {/* THE OFFICIAL 10-COLUMN TEMPLATE TABLE MATCHING SCREENSHOT {639F1CC2-A50D-439A-93C3-F49D8E836963}.png */}
      <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-text">
            {/* Orange Header with Italic Bold Black Text matching {639F1CC2-A50D-439A-93C3-F49D8E836963}.png */}
            <thead>
              <tr className="bg-[#FFA500] text-black italic font-bold text-xs md:text-sm border-b-2 border-black">
                <th className="py-2.5 px-3 text-center border-r border-black min-w-[60px] whitespace-nowrap">
                  Sr. No
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

            {/* Bright Yellow Data Rows matching {639F1CC2-A50D-439A-93C3-F49D8E836963}.png */}
            <tbody className={yellowTheme === 'vibrant' ? 'bg-[#FFFF00]' : 'bg-[#FEF08A]'}>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-black font-bold border-b border-black">
                    No matching material rows found. Click "Add Material Row" or "Reset" to reload template.
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
                            value={editFormData.requestDate ?? ''}
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
                      {/* 1. Sr. No */}
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

                      {/* 9. Request Date */}
                      <td className="py-2 px-3 text-center border-r border-black font-mono text-[11px]">
                        {row.requestDate || ''}
                      </td>

                      {/* 10. DSP request to */}
                      <td className="py-2 px-3 text-center border-r border-black font-bold">
                        {row.dspRequestTo || 'MOH'}
                      </td>

                      {/* Row Action Buttons */}
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

              {/* Authentic Spreadsheet Yellow Empty Grid Rows matching screenshot {639F1CC2-A50D-439A-93C3-F49D8E836963}.png */}
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
                  <span className="font-bold text-amber-300 font-mono">{totals.lineItemsCount}</span> Equipment Items • Allocated to <span className="font-bold text-white">Ministry of Health (MOH)</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Submitting Criteria & Institutional Workflow Footnote */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong className="text-slate-800">10-Column Standard Compliant:</strong> Fits MOH PMD medical equipment allocation protocol.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span>Excel Template: <strong className="text-slate-800">Verified</strong></span>
          <span>•</span>
          <span>Target Directorate: <strong className="text-slate-800">MOH PMD</strong></span>
          <span>•</span>
          <span>Issuing Authority: <strong className="text-slate-800">EPSS Head Office</strong></span>
        </div>
      </div>

      {/* MODAL 1: ADD MATERIAL ROW */}
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
                    Request Date
                  </label>
                  <input
                    type="date"
                    value={newRowData.requestDate}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, requestDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    DSP Request To
                  </label>
                  <input
                    type="text"
                    value={newRowData.dspRequestTo}
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

      {/* MODAL 2: UPLOAD TEMPLATE FILE */}
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
              {/* Dropzone */}
              <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center bg-indigo-50/30 hover:bg-indigo-50/50 transition">
                <FileSpreadsheet className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Select Excel file (.xlsx) or CSV
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Expected Headers: Sr. No, Material, Material Description, Qty, Total Amount, Valuation Type Desc, WBS Element, Budget Source, Request Date, DSP request to
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
                      ✓ Successfully parsed {parsedUploadRows.length} material rows
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

                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-bold text-slate-600">
                        <tr>
                          <th className="p-1.5">#</th>
                          <th className="p-1.5">Material</th>
                          <th className="p-1.5">Description</th>
                          <th className="p-1.5 text-right">Qty</th>
                          <th className="p-1.5 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedUploadRows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="p-1.5 font-mono">{i + 1}</td>
                            <td className="p-1.5 font-mono font-bold">{r.material}</td>
                            <td className="p-1.5 truncate max-w-[180px]">{r.materialDescription}</td>
                            <td className="p-1.5 text-right font-bold">{r.qty}</td>
                            <td className="p-1.5 text-right font-mono">{formatCurrency(r.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedUploadRows.length > 5 && (
                      <div className="p-1.5 text-center text-slate-400 font-bold bg-slate-50">
                        + {parsedUploadRows.length - 5} more rows...
                      </div>
                    )}
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

      {/* MODAL 3: IMPORT FROM MULTIPLE STOCK */}
      {isStockImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Import from Multiple Stock</h3>
                  <p className="text-[11px] text-slate-400">Populate DSP request with active warehouse equipment inventory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    placeholder="Search stock by code, description, WBS..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Assign Budget Source:</span>
                  <select
                    value={stockDefaultBudget}
                    onChange={(e) => setStockDefaultBudget(e.target.value)}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                  >
                    <option value="WB">WB (World Bank)</option>
                    <option value="MOH">MOH PMD</option>
                    <option value="Global Fund">Global Fund</option>
                    <option value="Treasury">Government Treasury</option>
                    <option value="GAVI">GAVI Alliance</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStockIds.length > 0 && selectedStockIds.length === filteredMultipleStock.length}
                          onChange={handleSelectAllStock}
                          className="cursor-pointer"
                        />
                      </th>
                      <th className="p-2">Material Code</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Unrestricted Qty</th>
                      <th className="p-2 text-right">Current Value (ETB)</th>
                      <th className="p-2">WBS Element</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMultipleStock.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No stock devices found matching search.
                        </td>
                      </tr>
                    ) : (
                      filteredMultipleStock.map((s) => {
                        const isSelected = selectedStockIds.includes(s.id);
                        return (
                          <tr
                            key={s.id}
                            onClick={() => handleToggleStockItem(s.id)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-cyan-50/70 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStockItem(s.id)}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-900">{s.material}</td>
                            <td className="p-2 truncate max-w-[200px] text-slate-800">{s.materialDescription}</td>
                            <td className="p-2 text-right font-mono font-bold text-cyan-800">
                              {formatNumber(s.unrestrictedStock)}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(s.currentValueOfUnrestrictedStock)}
                            </td>
                            <td className="p-2 font-mono text-[11px] text-slate-600">{s.wbsElement || 'SDG-ME-23'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">
                  {selectedStockIds.length} items selected for import
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsStockImportModalOpen(false)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedStockIds.length === 0}
                    onClick={handleApplyStockImport}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
                  >
                    Import Selected ({selectedStockIds.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: TRANSMIT DSP REQUEST TO MOH */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Transmit DSP Request to MOH</h3>
                  <p className="text-[11px] text-slate-400">Institutional transmittal via standard 10-column Excel dossier</p>
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
                  <span className="text-indigo-600 font-mono">10 COLUMNS VERIFIED</span>
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
                    <span className="text-slate-400 block text-[10px]">RECIPIENT</span>
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
                  Transmitting registers this request into the DSP Workflow lifecycle, logs the official reference number, and alerts MOH technical evaluators.
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
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-amber-300 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Official Transmittal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
