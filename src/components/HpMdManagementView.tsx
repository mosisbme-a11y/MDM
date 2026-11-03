import React, { useState, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  FileText,
  Truck,
  CheckCircle2,
  Download,
  Upload,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  X,
  Layers,
  Sparkles,
  BarChart2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProgramMdRecord, MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

interface HpMdManagementViewProps {
  currentSubTab?: string;
  onSelectSubTab?: (subTab: any) => void;
  items?: MedicalDeviceItem[];
  programMdRecords?: ProgramMdRecord[];
  onUploadProgramMdData?: (records: ProgramMdRecord[], mode?: 'append' | 'replace') => void;
  onClearProgramMdData?: () => void;
  onAddProgramMdRecord?: (record: ProgramMdRecord) => void;
  onUpdateProgramMdRecord?: (record: ProgramMdRecord) => void;
  onDeleteProgramMdRecord?: (id: string) => void;
  isAdmin?: boolean;
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const HpMdManagementView: React.FC<HpMdManagementViewProps> = ({
  currentSubTab = 'hp-procurement-request-list',
  onSelectSubTab,
  items = [],
  programMdRecords = [],
  onUploadProgramMdData,
  onClearProgramMdData,
  onAddProgramMdRecord,
  onUpdateProgramMdRecord,
  onDeleteProgramMdRecord,
  isAdmin = false,
  onSelectItem
}) => {
  // Pure real records: no fallback to previous default dummy records
  const activeRecords = useMemo(() => {
    return programMdRecords || [];
  }, [programMdRecords]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProgramMdRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Upload modal options
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewParsedRecords, setPreviewParsedRecords] = useState<ProgramMdRecord[]>([]);
  const [rawPastedText, setRawPastedText] = useState('');
  const [activeUploadTab, setActiveUploadTab] = useState<'file' | 'paste'>('file');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single item form state
  const [formData, setFormData] = useState<Omit<ProgramMdRecord, 'id'>>({
    sapPo: '',
    itemDescription: '',
    unit: 'PCS',
    quantity: 1,
    deliveryAmountEtb: 0,
    supplier: '',
    deviceOwner: '',
    currentStatus: 'Active',
    managementApproach: '',
    requestYear: new Date().getFullYear().toString()
  });

  // Extract unique filter dropdown values
  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => r.currentStatus && set.add(r.currentStatus));
    return Array.from(set).sort();
  }, [activeRecords]);

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => r.requestYear && set.add(String(r.requestYear)));
    return Array.from(set).sort().reverse();
  }, [activeRecords]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => r.supplier && set.add(r.supplier));
    return Array.from(set).sort();
  }, [activeRecords]);

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => r.deviceOwner && set.add(r.deviceOwner));
    return Array.from(set).sort();
  }, [activeRecords]);

  // Filtered Program MD Records
  const filteredRecords = useMemo(() => {
    return activeRecords.filter(r => {
      const matchSearch =
        !searchTerm ||
        r.sapPo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.itemDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.deviceOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.managementApproach?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.currentStatus?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || r.currentStatus === statusFilter;
      const matchYear = yearFilter === 'all' || String(r.requestYear) === yearFilter;
      const matchSupplier = supplierFilter === 'all' || r.supplier === supplierFilter;
      const matchOwner = ownerFilter === 'all' || r.deviceOwner === ownerFilter;

      return matchSearch && matchStatus && matchYear && matchSupplier && matchOwner;
    });
  }, [activeRecords, searchTerm, statusFilter, yearFilter, supplierFilter, ownerFilter]);

  // Metrics calculations
  const totalQuantity = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [filteredRecords]);

  const totalDeliveryAmount = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + (Number(curr.deliveryAmountEtb) || 0), 0);
  }, [filteredRecords]);

  // Helper to parse rows into standard ProgramMdRecord format
  const parseRowsToProgramMdRecords = (rows: any[], fileName?: string): ProgramMdRecord[] => {
    const records: ProgramMdRecord[] = [];

    rows.forEach((row, idx) => {
      if (!row || typeof row !== 'object') return;

      const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

      let sapPo = '';
      let itemDescription = '';
      let unit = 'PCS';
      let quantity = 0;
      let deliveryAmountEtb = 0;
      let supplier = '';
      let deviceOwner = '';
      let currentStatus = 'Active';
      let managementApproach = '';
      let requestYear: string | number = new Date().getFullYear();

      Object.keys(row).forEach(rawKey => {
        const norm = normalizeKey(rawKey);
        const val = row[rawKey];
        if (val === undefined || val === null) return;

        if (norm.includes('sappo') || norm.includes('ponumber') || norm === 'po' || norm.includes('purchaseorder') || norm.includes('sap')) {
          sapPo = String(val).trim();
        } else if (norm.includes('itemdescription') || norm.includes('materialdescription') || norm === 'description' || norm === 'item') {
          itemDescription = String(val).trim();
        } else if (norm === 'unit' || norm === 'uom' || norm.includes('unitofmeasure')) {
          unit = String(val).trim();
        } else if (norm.includes('quantity') || norm === 'qty') {
          quantity = Number(val) || 0;
        } else if (norm.includes('deliveryamount') || norm.includes('amountinetb') || norm.includes('etb') || norm.includes('deliverycost') || norm.includes('totalamount') || norm === 'amount') {
          deliveryAmountEtb = Number(val) || 0;
        } else if (norm.includes('supplier') || norm.includes('vendor')) {
          supplier = String(val).trim();
        } else if (norm.includes('deviceowner') || norm.includes('owner') || norm.includes('facility') || norm.includes('healthfacility') || norm.includes('hospital')) {
          deviceOwner = String(val).trim();
        } else if (norm.includes('currentstatus') || norm === 'status' || norm === 'stage') {
          currentStatus = String(val).trim();
        } else if (norm.includes('managementapproach') || norm.includes('approach') || norm.includes('strategy')) {
          managementApproach = String(val).trim();
        } else if (norm.includes('requestyear') || norm === 'year' || norm.includes('reqyear')) {
          requestYear = String(val).trim();
        }
      });

      // Push parsed row for validation
      if (itemDescription || sapPo || supplier || deviceOwner) {
        records.push({
          id: `pmd-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          sapPo: sapPo,
          itemDescription: itemDescription || 'Medical Device Equipment Requisition',
          unit: unit || 'PCS',
          quantity: quantity,
          deliveryAmountEtb: deliveryAmountEtb || 0,
          supplier: supplier,
          deviceOwner: deviceOwner || 'Health Facility',
          currentStatus: currentStatus || 'Active',
          managementApproach: managementApproach || 'Standard Procurement',
          requestYear: requestYear || new Date().getFullYear().toString(),
          uploadedAt: new Date().toISOString(),
          sourceFile: fileName || 'Uploaded File'
        });
      }
    });

    return records;
  };

  // Handle File Upload Change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          setUploadError('The selected spreadsheet appears to be empty.');
          return;
        }

        const parsed = parseRowsToProgramMdRecords(rows, file.name);
        if (parsed.length === 0) {
          setUploadError('Could not find valid columns. Required columns: SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, Request Year.');
          return;
        }

        setPreviewParsedRecords(parsed);
      } catch (err: any) {
        setUploadError(`Failed to parse file: ${err.message || err}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Handle Paste Parse
  const handleParsePastedText = () => {
    if (!rawPastedText.trim()) return;
    setUploadError(null);

    const lines = rawPastedText.trim().split('\n');
    if (lines.length < 2) {
      setUploadError('Pasted text must include a header row and at least one data row.');
      return;
    }

    const headers = lines[0].split('\t').map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t').map(v => v.trim());
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    const parsed = parseRowsToProgramMdRecords(rows, 'Pasted Data');
    if (parsed.length === 0) {
      setUploadError('Could not parse pasted data. Ensure columns match the 10 standard Program MD headers.');
      return;
    }

    setPreviewParsedRecords(parsed);
  };

  // Confirm Upload
  const handleConfirmUpload = () => {
    if (previewParsedRecords.length === 0) return;
    if (onUploadProgramMdData) {
      onUploadProgramMdData(previewParsedRecords, uploadMode);
    }
    setIsUploadModalOpen(false);
    setPreviewParsedRecords([]);
    setRawPastedText('');
    setUploadError(null);
  };

  // Export CSV/Excel
  const handleExportData = (type: 'csv' | 'excel') => {
    const exportRows = filteredRecords.map(r => ({
      'SAP PO': r.sapPo,
      'Item Description': r.itemDescription,
      'Unit': r.unit,
      'Quantity': r.quantity,
      'Delivery Amount in ETB': r.deliveryAmountEtb,
      'Supplier': r.supplier,
      'Device Owner': r.deviceOwner,
      'Current Status': r.currentStatus,
      'Management Approach': r.managementApproach,
      'Request Year': r.requestYear
    }));

    if (type === 'csv') {
      downloadCSV(`Program_MD_Records_${new Date().toISOString().slice(0, 10)}.csv`, exportRows);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Program MD');
      XLSX.writeFile(workbook, `Program_MD_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  // Download standard 10-column Excel template
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'SAP PO': 'PO-450012345',
        'Item Description': 'Example Ultrasound System 4D',
        'Unit': 'UNIT',
        'Quantity': 2,
        'Delivery Amount in ETB': 8500000,
        'Supplier': 'Example Medical Equipment Supplier',
        'Device Owner': 'Example Specialized Hospital',
        'Current Status': 'PO Issued',
        'Management Approach': 'Central Turnkey Procurement',
        'Request Year': new Date().getFullYear().toString()
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Program MD Template');
    XLSX.writeFile(workbook, `Program_MD_Template_10_Columns.xlsx`);
  };

  // Single Record Form Submit
  const handleSaveFormRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemDescription || !formData.sapPo) return;

    if (editingRecord) {
      const updatedRecord: ProgramMdRecord = {
        ...editingRecord,
        ...formData
      };
      if (onUpdateProgramMdRecord) onUpdateProgramMdRecord(updatedRecord);
    } else {
      const newRecord: ProgramMdRecord = {
        id: `pmd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...formData,
        uploadedAt: new Date().toISOString()
      };
      if (onAddProgramMdRecord) onAddProgramMdRecord(newRecord);
    }

    setIsAddModalOpen(false);
    setEditingRecord(null);
    setFormData({
      sapPo: '',
      itemDescription: '',
      unit: 'PCS',
      quantity: 1,
      deliveryAmountEtb: 0,
      supplier: '',
      deviceOwner: '',
      currentStatus: 'Active',
      managementApproach: '',
      requestYear: new Date().getFullYear().toString()
    });
  };

  const handleEditClick = (rec: ProgramMdRecord) => {
    setEditingRecord(rec);
    setFormData({
      sapPo: rec.sapPo,
      itemDescription: rec.itemDescription,
      unit: rec.unit,
      quantity: rec.quantity,
      deliveryAmountEtb: rec.deliveryAmountEtb,
      supplier: rec.supplier,
      deviceOwner: rec.deviceOwner,
      currentStatus: rec.currentStatus,
      managementApproach: rec.managementApproach,
      requestYear: rec.requestYear
    });
    setIsAddModalOpen(true);
  };

  const activeTab = currentSubTab || 'hp-procurement-request-list';

  return (
    <div className="space-y-4 pb-12">
      {/* Main Content Area */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        {/* Actions Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Spreadsheet</span>
            </button>

            <button
              onClick={() => {
                setEditingRecord(null);
                setFormData({
                  sapPo: '',
                  itemDescription: '',
                  unit: 'PCS',
                  quantity: 1,
                  deliveryAmountEtb: 0,
                  supplier: '',
                  deviceOwner: '',
                  currentStatus: 'Active',
                  managementApproach: '',
                  requestYear: new Date().getFullYear().toString()
                });
                setIsAddModalOpen(true);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Record</span>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Download 10-column Excel template"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Template</span>
            </button>

            <button
              onClick={() => handleExportData('excel')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => handleExportData('csv')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>Export CSV</span>
            </button>

            {activeRecords.length > 0 && onClearProgramMdData && (
              <button
                onClick={() => setIsClearConfirmOpen(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Records</span>
              </button>
            )}
          </div>

          {activeRecords.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
              <span>Qty: <strong className="text-slate-900 font-bold">{formatNumber(totalQuantity)}</strong></span>
              <span>&bull;</span>
              <span>Total: <strong className="text-emerald-700 font-bold font-mono">{formatCurrency(totalDeliveryAmount)}</strong></span>
            </div>
          )}
        </div>
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="relative min-w-[280px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search SAP PO, Description, Supplier, Device Owner, Status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500 uppercase">Filters:</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Statuses ({uniqueStatuses.length})</option>
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Request Year Filter */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Request Years ({uniqueYears.length})</option>
              {uniqueYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Supplier Filter */}
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-hidden focus:border-blue-500 max-w-[160px] truncate"
            >
              <option value="all">All Suppliers ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Device Owner Filter */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-hidden focus:border-blue-500 max-w-[160px] truncate"
            >
              <option value="all">All Device Owners ({uniqueOwners.length})</option>
              {uniqueOwners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            {(statusFilter !== 'all' || yearFilter !== 'all' || supplierFilter !== 'all' || ownerFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setYearFilter('all');
                  setSupplierFilter('all');
                  setOwnerFilter('all');
                }}
                className="px-2.5 py-1.5 text-xs text-rose-600 font-bold hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Counter Banner */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
          <span>
            Showing <strong className="text-slate-900 font-bold">{filteredRecords.length.toLocaleString()}</strong> of {activeRecords.length.toLocaleString()} Program MD records
          </span>
          <span>
            Filtered Total Value: <strong className="text-emerald-700 font-bold">{formatCurrency(totalDeliveryAmount)}</strong>
          </span>
        </div>

        {/* EXACT 10-COLUMN DATA TABLE */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5 font-bold tracking-tight">SAP PO</th>
                <th className="py-3 px-3.5 font-bold tracking-tight min-w-[220px]">Item Description</th>
                <th className="py-3 px-3.5 text-center font-bold tracking-tight">Unit</th>
                <th className="py-3 px-3.5 text-right font-bold tracking-tight">Quantity</th>
                <th className="py-3 px-3.5 text-right font-bold tracking-tight">Delivery Amount in ETB</th>
                <th className="py-3 px-3.5 font-bold tracking-tight">Supplier</th>
                <th className="py-3 px-3.5 font-bold tracking-tight">Device Owner</th>
                <th className="py-3 px-3.5 text-center font-bold tracking-tight">Current Status</th>
                <th className="py-3 px-3.5 font-bold tracking-tight">Management Approach</th>
                <th className="py-3 px-3.5 text-center font-bold tracking-tight">Request Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium bg-white">
              {activeRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">No Program MD Records</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        No records recorded yet. Upload an Excel or CSV spreadsheet matching the 10 columns: SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, and Request Year.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => setIsUploadModalOpen(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Spreadsheet</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingRecord(null);
                            setFormData({
                              sapPo: '',
                              itemDescription: '',
                              unit: 'PCS',
                              quantity: 1,
                              deliveryAmountEtb: 0,
                              supplier: '',
                              deviceOwner: '',
                              currentStatus: 'Active',
                              managementApproach: '',
                              requestYear: new Date().getFullYear().toString()
                            });
                            setIsAddModalOpen(true);
                          }}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Add Record</span>
                        </button>
                        <button
                          onClick={handleDownloadTemplate}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Template</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No Program MD records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">{rec.sapPo}</td>
                    <td className="py-3 px-3.5 text-slate-900 font-semibold">{rec.itemDescription}</td>
                    <td className="py-3 px-3.5 text-center font-mono text-slate-600 uppercase text-[11px]">{rec.unit || 'PCS'}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">{formatNumber(rec.quantity)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(rec.deliveryAmountEtb)}</td>
                    <td className="py-3 px-3.5 text-slate-700 font-medium">{rec.supplier || 'N/A'}</td>
                    <td className="py-3 px-3.5 text-slate-900 font-semibold">{rec.deviceOwner || 'N/A'}</td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block whitespace-nowrap ${
                        rec.currentStatus?.toLowerCase().includes('delivered') || rec.currentStatus?.toLowerCase().includes('installed') || rec.currentStatus?.toLowerCase().includes('completed')
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : rec.currentStatus?.toLowerCase().includes('transit') || rec.currentStatus?.toLowerCase().includes('clearance')
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : rec.currentStatus?.toLowerCase().includes('issued') || rec.currentStatus?.toLowerCase().includes('active')
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {rec.currentStatus || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 text-[11px]">{rec.managementApproach || 'Standard'}</td>
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-700">{rec.requestYear}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Program MD Dataset</h3>
                  <p className="text-xs text-slate-500">Supports `.xlsx`, `.csv` with exact 10 standard Program MD headers.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPreviewParsedRecords([]);
                  setUploadError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Data Import Strategy:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('append')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    uploadMode === 'append' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Append to Existing Records
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('replace')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    uploadMode === 'replace' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Replace All Existing
                </button>
              </div>
            </div>

            {/* Upload Method Tabs */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
              <button
                onClick={() => setActiveUploadTab('file')}
                className={`pb-2 border-b-2 cursor-pointer ${activeUploadTab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
              >
                Choose Excel / CSV File
              </button>
              <button
                onClick={() => setActiveUploadTab('paste')}
                className={`pb-2 border-b-2 cursor-pointer ${activeUploadTab === 'paste' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
              >
                Paste TSV / Excel Rows
              </button>
            </div>

            {activeUploadTab === 'file' ? (
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition bg-slate-50/50">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 mb-1">Click to select or drag & drop spreadsheet file</p>
                <p className="text-[11px] text-slate-400 mb-4">Accepts Excel (.xlsx, .xls) and CSV (.csv) files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Browse File</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={rawPastedText}
                  onChange={(e) => setRawPastedText(e.target.value)}
                  placeholder="Paste copied table rows directly from Excel or Google Sheets (including tab-separated headers)..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
                <button
                  onClick={handleParsePastedText}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Parse Pasted Rows
                </button>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Preview of Parsed Records */}
            {previewParsedRecords.length > 0 && (() => {
              return (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between text-xs font-bold gap-2">
                    <span className="text-slate-800">Preview ({previewParsedRecords.length} Total Rows):</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="p-2">SAP PO</th>
                          <th className="p-2">Item Description</th>
                          <th className="p-2">Unit</th>
                          <th className="p-2 text-right">Quantity</th>
                          <th className="p-2 text-right">Delivery ETB</th>
                          <th className="p-2">Supplier</th>
                          <th className="p-2">Device Owner</th>
                          <th className="p-2">Current Status</th>
                          <th className="p-2">Management Approach</th>
                          <th className="p-2">Request Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewParsedRecords.slice(0, 15).map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 font-mono font-bold text-amber-700">
                              {p.sapPo || <span className="text-slate-400 italic font-normal">N/A</span>}
                            </td>
                            <td className="p-2 text-slate-900 truncate max-w-[130px]">{p.itemDescription}</td>
                            <td className="p-2 font-mono text-[10px]">{p.unit}</td>
                            <td className="p-2 text-right font-mono">{p.quantity}</td>
                            <td className="p-2 text-right font-mono text-emerald-700">{formatCurrency(p.deliveryAmountEtb)}</td>
                            <td className="p-2 truncate max-w-[110px]">{p.supplier || <span className="text-slate-400 italic font-normal">N/A</span>}</td>
                            <td className="p-2 truncate max-w-[100px]">{p.deviceOwner}</td>
                            <td className="p-2">{p.currentStatus}</td>
                            <td className="p-2 truncate max-w-[100px]">{p.managementApproach}</td>
                            <td className="p-2 font-mono text-[10px]">{p.requestYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewParsedRecords.length > 15 && (
                      <div className="p-2 text-center text-slate-500 text-[11px] bg-slate-50 border-t border-slate-200 font-medium">
                        + {previewParsedRecords.length - 15} more parsed records...
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPreviewParsedRecords([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={previewParsedRecords.length === 0}
                onClick={handleConfirmUpload}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save & Import {previewParsedRecords.length} Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT SINGLE RECORD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingRecord ? 'Edit Program MD Record' : 'Add New Program MD Record'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFormRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">1. SAP PO *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-450012891"
                    value={formData.sapPo}
                    onChange={(e) => setFormData(prev => ({ ...prev, sapPo: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">2. Item Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.5T MRI Scanner Unit"
                    value={formData.itemDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, itemDescription: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">3. Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. SET, PCS, UNIT"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">4. Quantity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">5. Delivery Amount in ETB</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.deliveryAmountEtb}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAmountEtb: Number(e.target.value) || 0 }))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">6. Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. Siemens Healthineers"
                    value={formData.supplier}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">7. Device Owner</label>
                  <input
                    type="text"
                    placeholder="e.g. Black Lion Hospital"
                    value={formData.deviceOwner}
                    onChange={(e) => setFormData(prev => ({ ...prev, deviceOwner: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">8. Current Status</label>
                  <input
                    type="text"
                    placeholder="e.g. PO Issued, In Transit, Delivered"
                    value={formData.currentStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentStatus: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">9. Management Approach</label>
                  <input
                    type="text"
                    placeholder="e.g. Turnkey Procurement"
                    value={formData.managementApproach}
                    onChange={(e) => setFormData(prev => ({ ...prev, managementApproach: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">10. Request Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026"
                    value={formData.requestYear}
                    onChange={(e) => setFormData(prev => ({ ...prev, requestYear: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRecord ? 'Save Changes' : 'Create Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE RECORD CONFIRMATION MODAL */}
      {deletingRecordId && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Program MD Record?</h3>
              <p className="text-xs text-slate-500 mt-1">This action will remove the record permanently from the Program MD registry.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingRecordId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteProgramMdRecord && deletingRecordId) {
                    onDeleteProgramMdRecord(deletingRecordId);
                  }
                  setDeletingRecordId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL RECORDS CONFIRMATION MODAL */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clear All Program MD Records?</h3>
              <p className="text-xs text-slate-500 mt-1">This will erase all uploaded and recorded Program MD entries. This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onClearProgramMdData) onClearProgramMdData();
                  setIsClearConfirmOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
