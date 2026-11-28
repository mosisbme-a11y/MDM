import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileText,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  Filter,
  RotateCcw,
  Package,
  DollarSign,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { ContractManagementRecord, ContractTrackingStatus, EpssSubTab } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

export const CONTRACT_TRACKING_STATUSES: ContractTrackingStatus[] = [
  'Under Production',
  'Shipped',
  'Arrived Djibouti',
  'Original Document Received',
  'Under Taking Letter and Marin Time',
  'Mojo Dry Port',
  'Custom Assessment',
  'Paid Tax',
  'EFDA Apply',
  'Send Declaration to EPSS',
  'Inbound Create',
  'Deliver To WOS'
];

const EXACT_HEADERS = [
  'S/N',
  'Material code',
  'Material Description',
  'Unit',
  'Quantity',
  'Unit Price',
  'Total Price',
  'PO',
  'Supplier',
  'Contract Signing',
  'PG',
  'Payment Status',
  'LC opening',
  'Status'
] as const;

interface ContractManagementViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (subTab: EpssSubTab) => void;
  items?: any[];
  onSelectItem?: (item: any) => void;
  records?: ContractManagementRecord[];
  onUploadRecords?: (records: ContractManagementRecord[], mode?: 'append' | 'replace', fileName?: string) => void;
  onClearRecords?: () => void;
  onAddRecord?: (record: ContractManagementRecord) => void;
  onUpdateRecord?: (record: ContractManagementRecord) => void;
  onDeleteRecord?: (id: string) => void;
  isAdmin?: boolean;
}

const normalizeHeaderKey = (h: unknown): string =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const cleanCellText = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    if (Math.abs(raw) >= 1e6 && Number.isInteger(raw)) {
      return raw.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
    }
    return String(raw);
  }
  return String(raw).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const formatDateOrText = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(raw);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const dd = String(parsed.d).padStart(2, '0');
        const mm = String(parsed.m).padStart(2, '0');
        return `${dd}/${mm}/${parsed.y}`;
      }
    } catch {
      // fall through
    }
  }
  return cleanCellText(raw);
};

const parseNullableNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/,/g, '').replace(/ETB|USD|EUR/gi, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const canonicalizeStatus = (raw: unknown): string => {
  const txt = cleanCellText(raw);
  if (!txt) return 'Under Production';
  const compact = normalizeHeaderKey(txt);
  const matched = CONTRACT_TRACKING_STATUSES.find((s) => normalizeHeaderKey(s) === compact);
  if (matched) return matched;
  if (compact.includes('underproduction')) return 'Under Production';
  if (compact === 'shipped' || compact.includes('shipped')) return 'Shipped';
  if (compact.includes('djibouti')) return 'Arrived Djibouti';
  if (compact.includes('originaldoc')) return 'Original Document Received';
  if (compact.includes('undertaking') || compact.includes('marintime') || compact.includes('maritime')) {
    return 'Under Taking Letter and Marin Time';
  }
  if (compact.includes('mojo')) return 'Mojo Dry Port';
  if (compact.includes('customassess')) return 'Custom Assessment';
  if (compact.includes('paidtax')) return 'Paid Tax';
  if (compact.includes('efda')) return 'EFDA Apply';
  if (compact.includes('declaration')) return 'Send Declaration to EPSS';
  if (compact.includes('inbound')) return 'Inbound Create';
  if (compact.includes('wos') || compact.includes('delivertowos')) return 'Deliver To WOS';
  return txt;
};

const getStatusBadgeStyle = (status: string): string => {
  const norm = normalizeHeaderKey(status);
  if (norm === 'delivertowos') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (norm === 'inboundcreate' || norm === 'senddeclarationtoepss') return 'bg-teal-100 text-teal-900 border-teal-300';
  if (norm === 'efdaapply' || norm === 'paidtax' || norm === 'customassessment') return 'bg-amber-100 text-amber-900 border-amber-300';
  if (norm === 'mojodryport' || norm === 'undertakingletterandmarintime' || norm === 'originaldocumentreceived') {
    return 'bg-sky-100 text-sky-900 border-sky-300';
  }
  if (norm === 'arriveddjibouti' || norm === 'shipped') return 'bg-indigo-100 text-indigo-900 border-indigo-300';
  return 'bg-slate-100 text-slate-800 border-slate-300';
};

const EMPTY_FORM = {
  sn: '',
  materialCode: '',
  materialDescription: '',
  unit: '',
  quantity: '',
  unitPrice: '',
  totalPrice: '',
  po: '',
  supplier: '',
  contractSigning: '',
  pg: '',
  paymentStatus: '',
  lcOpening: '',
  status: 'Under Production'
};

export const ContractManagementView: React.FC<ContractManagementViewProps> = ({
  records = [],
  onUploadRecords,
  onClearRecords,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  isAdmin = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [rawPasteText, setRawPasteText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ContractManagementRecord | null>(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.supplier && r.supplier.trim()) set.add(r.supplier.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CONTRACT_TRACKING_STATUSES.forEach((s) => {
      counts[s] = 0;
    });
    records.forEach((r) => {
      const canonical = canonicalizeStatus(r.status);
      counts[canonical] = (counts[canonical] || 0) + 1;
    });
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter((rec) => {
      const recStatus = canonicalizeStatus(rec.status);
      if (statusFilter !== 'all' && recStatus !== statusFilter) return false;
      if (supplierFilter !== 'all' && rec.supplier.trim() !== supplierFilter) return false;
      if (q) {
        const hay = [
          rec.sn,
          rec.materialCode,
          rec.materialDescription,
          rec.unit,
          rec.po,
          rec.supplier,
          rec.contractSigning,
          rec.pg,
          rec.paymentStatus,
          rec.lcOpening,
          recStatus
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, statusFilter, supplierFilter, searchQuery]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let deliveredWos = 0;
    let inClearanceOrPort = 0;
    const poSet = new Set<string>();

    filteredRecords.forEach((r) => {
      const qty = Number(r.quantity) || 0;
      const unitP = Number(r.unitPrice) || 0;
      const totP = r.totalPrice !== null && r.totalPrice !== undefined ? Number(r.totalPrice) || 0 : qty * unitP;
      totalQty += qty;
      totalAmount += totP;
      if (r.po && r.po.trim()) poSet.add(r.po.trim());
      const st = canonicalizeStatus(r.status);
      if (st === 'Deliver To WOS') deliveredWos += 1;
      if (
        st === 'Arrived Djibouti' ||
        st === 'Original Document Received' ||
        st === 'Under Taking Letter and Marin Time' ||
        st === 'Mojo Dry Port' ||
        st === 'Custom Assessment' ||
        st === 'Paid Tax' ||
        st === 'EFDA Apply' ||
        st === 'Send Declaration to EPSS'
      ) {
        inClearanceOrPort += 1;
      }
    });

    return {
      totalQty,
      totalAmount,
      uniquePos: poSet.size,
      deliveredWos,
      inClearanceOrPort
    };
  }, [filteredRecords]);

  const parseAoaToRecords = (aoa: unknown[][], sourceName: string): ContractManagementRecord[] => {
    if (!aoa || aoa.length === 0) return [];

    // Locate header row among first 8 rows
    let headerIdx = -1;
    let colMap: Record<string, number> = {};

    const matchKey = (norm: string): string | null => {
      if (norm === 'sn' || norm === 'srno' || norm === 'sno' || norm === 'no') return 'sn';
      if (norm === 'materialcode' || norm === 'matcode' || norm === 'itemcode' || norm === 'code') return 'materialCode';
      if (norm === 'materialdescription' || norm === 'itemdescription' || norm === 'description' || norm === 'materialdescr') return 'materialDescription';
      if (norm === 'unit' || norm === 'uom' || norm === 'baseunit') return 'unit';
      if (norm === 'quantity' || norm === 'qty') return 'quantity';
      if (norm === 'unitprice' || norm === 'price') return 'unitPrice';
      if (norm === 'totalprice' || norm === 'totalamount' || norm === 'totalvalue' || norm === 'amount') return 'totalPrice';
      if (norm === 'po' || norm === 'ponumber' || norm === 'purchaseorder') return 'po';
      if (norm === 'supplier' || norm === 'vendor') return 'supplier';
      if (norm === 'contractsigning' || norm === 'contractsigndate' || norm === 'signingdate') return 'contractSigning';
      if (norm === 'pg' || norm === 'performanceguarantee') return 'pg';
      if (norm === 'paymentstatus' || norm === 'payment') return 'paymentStatus';
      if (norm === 'lcopening' || norm === 'lcstatus' || norm === 'lc') return 'lcOpening';
      if (norm === 'status' || norm === 'deliverystatus' || norm === 'trackingstatus') return 'status';
      return null;
    };

    for (let r = 0; r < Math.min(aoa.length, 8); r++) {
      const row = aoa[r] || [];
      const found: Record<string, number> = {};
      row.forEach((cell, idx) => {
        const key = matchKey(normalizeHeaderKey(cell));
        if (key && found[key] === undefined) {
          found[key] = idx;
        }
      });
      if (Object.keys(found).length >= 4) {
        headerIdx = r;
        colMap = found;
        break;
      }
    }

    // Fallback positional mapping matching exact 14-column layout
    if (headerIdx === -1) {
      headerIdx = 0;
      colMap = {
        sn: 0,
        materialCode: 1,
        materialDescription: 2,
        unit: 3,
        quantity: 4,
        unitPrice: 5,
        totalPrice: 6,
        po: 7,
        supplier: 8,
        contractSigning: 9,
        pg: 10,
        paymentStatus: 11,
        lcOpening: 12,
        status: 13
      };
    }

    const nowIso = new Date().toISOString();
    const parsed: ContractManagementRecord[] = [];
    const startRow = headerIdx === 0 && Object.keys(colMap).length === 14 && matchKey(normalizeHeaderKey(aoa[0]?.[1])) === null ? 0 : headerIdx + 1;

    for (let r = startRow; r < aoa.length; r++) {
      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const getVal = (field: string) => (colMap[field] !== undefined ? row[colMap[field]] : undefined);

      const materialCode = cleanCellText(getVal('materialCode'));
      const materialDescription = cleanCellText(getVal('materialDescription'));
      const unit = cleanCellText(getVal('unit'));
      const quantity = parseNullableNumber(getVal('quantity'));
      const unitPrice = parseNullableNumber(getVal('unitPrice'));
      const rawTotal = parseNullableNumber(getVal('totalPrice'));
      const totalPrice = rawTotal !== null ? rawTotal : quantity !== null && unitPrice !== null ? quantity * unitPrice : null;
      const po = cleanCellText(getVal('po'));
      const supplier = cleanCellText(getVal('supplier'));
      const contractSigning = formatDateOrText(getVal('contractSigning'));
      const pg = cleanCellText(getVal('pg'));
      const paymentStatus = cleanCellText(getVal('paymentStatus'));
      const lcOpening = formatDateOrText(getVal('lcOpening'));
      const statusRaw = cleanCellText(getVal('status'));
      const snVal = cleanCellText(getVal('sn'));

      // Skip blank lines or total summary rows
      if (
        !materialCode &&
        !materialDescription &&
        !po &&
        !supplier &&
        quantity === null &&
        unitPrice === null &&
        totalPrice === null &&
        !statusRaw
      ) {
        continue;
      }
      if (
        materialCode.toLowerCase() === 'total' ||
        materialDescription.toLowerCase() === 'total' ||
        snVal.toLowerCase() === 'total'
      ) {
        continue;
      }

      parsed.push({
        id: `cm-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
        sn: snVal || parsed.length + 1,
        materialCode,
        materialDescription,
        unit,
        quantity,
        unitPrice,
        totalPrice,
        po,
        supplier,
        contractSigning,
        pg,
        paymentStatus,
        lcOpening,
        status: canonicalizeStatus(statusRaw),
        uploadedAt: nowIso,
        sourceFile: sourceName
      });
    }

    return parsed;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) {
          setUploadError('Could not read the uploaded file.');
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          setUploadError('The uploaded workbook contains no sheets.');
          return;
        }
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' });
        const parsed = parseAoaToRecords(aoa, file.name);
        if (parsed.length === 0) {
          setUploadError('No contract rows found. Please make sure the sheet uses the 14-column Contract Management format.');
          return;
        }
        onUploadRecords?.(parsed, uploadMode, file.name);
        setIsUploadModalOpen(false);
      } catch (err: any) {
        setUploadError(err?.message || 'Failed to parse the uploaded file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePasteImport = () => {
    setUploadError(null);
    const lines = rawPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setUploadError('Please paste tab-separated or comma-separated rows from Excel first.');
      return;
    }
    const aoa = lines.map((line) => (line.includes('\t') ? line.split('\t') : line.split(',')));
    const parsed = parseAoaToRecords(aoa, 'Pasted Table');
    if (parsed.length === 0) {
      setUploadError('Could not detect valid contract rows from the pasted text.');
      return;
    }
    onUploadRecords?.(parsed, uploadMode, 'Pasted Table');
    setRawPasteText('');
    setIsUploadModalOpen(false);
  };

  const handleDownloadTemplate = () => {
    const aoa: unknown[][] = [
      [...EXACT_HEADERS],
      ...CONTRACT_TRACKING_STATUSES.map((st, idx) => [
        idx + 1,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        st
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 32 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 32 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contract Management');
    XLSX.writeFile(wb, `Contract_Management_Template.xlsx`);
  };

  const handleExportExcel = () => {
    const aoa: unknown[][] = [
      [...EXACT_HEADERS],
      ...filteredRecords.map((r, idx) => [
        r.sn || idx + 1,
        r.materialCode || '',
        r.materialDescription || '',
        r.unit || '',
        r.quantity ?? '',
        r.unitPrice ?? '',
        r.totalPrice ?? (r.quantity !== null && r.unitPrice !== null ? r.quantity * r.unitPrice : ''),
        r.po || '',
        r.supplier || '',
        r.contractSigning || '',
        r.pg || '',
        r.paymentStatus || '',
        r.lcOpening || '',
        r.status || ''
      ]),
      [
        '',
        'TOTAL',
        `${filteredRecords.length} Item(s)`,
        '',
        totals.totalQty,
        '',
        totals.totalAmount,
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 32 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 32 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contract Management');
    XLSX.writeFile(wb, `Contract_Management_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const rowsForCsv = filteredRecords.map((r, idx) => ({
      'S/N': r.sn || idx + 1,
      'Material code': r.materialCode || '',
      'Material Description': r.materialDescription || '',
      'Unit': r.unit || '',
      'Quantity': r.quantity ?? '',
      'Unit Price': r.unitPrice ?? '',
      'Total Price': r.totalPrice ?? (r.quantity !== null && r.unitPrice !== null ? r.quantity * r.unitPrice : ''),
      'PO': r.po || '',
      'Supplier': r.supplier || '',
      'Contract Signing': r.contractSigning || '',
      'PG': r.pg || '',
      'Payment Status': r.paymentStatus || '',
      'LC opening': r.lcOpening || '',
      'Status': r.status || ''
    }));
    downloadCSV(`Contract_Management_${new Date().toISOString().split('T')[0]}.csv`, rowsForCsv);
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setFormState({
      ...EMPTY_FORM,
      sn: String(records.length + 1)
    });
    setIsFormOpen(true);
  };

  const openEditModal = (rec: ContractManagementRecord) => {
    setEditingRecord(rec);
    setFormState({
      sn: rec.sn !== undefined ? String(rec.sn) : '',
      materialCode: rec.materialCode || '',
      materialDescription: rec.materialDescription || '',
      unit: rec.unit || '',
      quantity: rec.quantity !== null && rec.quantity !== undefined ? String(rec.quantity) : '',
      unitPrice: rec.unitPrice !== null && rec.unitPrice !== undefined ? String(rec.unitPrice) : '',
      totalPrice: rec.totalPrice !== null && rec.totalPrice !== undefined ? String(rec.totalPrice) : '',
      po: rec.po || '',
      supplier: rec.supplier || '',
      contractSigning: rec.contractSigning || '',
      pg: rec.pg || '',
      paymentStatus: rec.paymentStatus || '',
      lcOpening: rec.lcOpening || '',
      status: canonicalizeStatus(rec.status)
    });
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseNullableNumber(formState.quantity);
    const unitP = parseNullableNumber(formState.unitPrice);
    const rawTot = parseNullableNumber(formState.totalPrice);
    const totP = rawTot !== null ? rawTot : qty !== null && unitP !== null ? qty * unitP : null;

    const payload: ContractManagementRecord = {
      id: editingRecord?.id || `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sn: formState.sn.trim() || (editingRecord ? editingRecord.sn : records.length + 1),
      materialCode: formState.materialCode.trim(),
      materialDescription: formState.materialDescription.trim(),
      unit: formState.unit.trim(),
      quantity: qty,
      unitPrice: unitP,
      totalPrice: totP,
      po: formState.po.trim(),
      supplier: formState.supplier.trim(),
      contractSigning: formState.contractSigning.trim(),
      pg: formState.pg.trim(),
      paymentStatus: formState.paymentStatus.trim(),
      lcOpening: formState.lcOpening.trim(),
      status: formState.status || 'Under Production',
      uploadedAt: editingRecord?.uploadedAt || new Date().toISOString(),
      sourceFile: editingRecord?.sourceFile || 'Manual Entry'
    };

    if (editingRecord) {
      onUpdateRecord?.(payload);
    } else {
      onAddRecord?.(payload);
    }
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const handleInlineStatusChange = (rec: ContractManagementRecord, nextStatus: string) => {
    onUpdateRecord?.({
      ...rec,
      status: nextStatus
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSupplierFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Contract Management
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 font-mono">
                {records.length} {records.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              14-column contract, LC, payment, customs clearance, and WOS delivery tracking across 12 pipeline stages.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              setIsUploadModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
            <span>Download Template</span>
          </button>

          {records.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          )}

          {isAdmin && records.length > 0 && onClearRecords && (
            confirmClearAll ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-bold text-rose-800">Clear all {records.length}?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearRecords();
                    setConfirmClearAll(false);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Contract Lines</span>
            <FileText className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">{formatNumber(filteredRecords.length)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{formatNumber(totals.uniquePos)} PO(s)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Quantity</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">{formatNumber(totals.totalQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contracted units</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Price</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1 tabular-nums">{formatCurrency(totals.totalAmount)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Filtered contract value</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Port / WOS Progress</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
            {formatNumber(totals.deliveredWos)} <span className="text-xs font-bold text-emerald-700">WOS</span>
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{formatNumber(totals.inClearanceOrPort)} in Port / Customs</div>
        </div>
      </div>

      {/* 12-Stage Status Pipeline Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Status Pipeline (12 Stages)
          </span>
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Show All Statuses
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CONTRACT_TRACKING_STATUSES.map((st, idx) => {
            const active = statusFilter === st;
            const count = statusCounts[st] || 0;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(active ? 'all' : st)}
                className={`text-left p-2 rounded-xl border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-50 border-cyan-500 ring-1 ring-cyan-400'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${count > 0 ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-1 leading-tight line-clamp-2">
                  {st}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search material code, description, PO, supplier, PG, LC opening, status..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-600 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-cyan-600"
          >
            <option value="all">Status: All (12 Stages)</option>
            {CONTRACT_TRACKING_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-cyan-600"
          >
            <option value="all">Supplier: All</option>
            {uniqueSuppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>

          {(searchQuery || statusFilter !== 'all' || supplierFilter !== 'all') && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Exact 14-Column Contract Management Table */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                <th className="p-2.5 font-bold border-r border-slate-300 text-center whitespace-nowrap">S/N</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">Material code</th>
                <th className="p-2.5 font-bold border-r border-slate-300 min-w-[210px]">Material Description</th>
                <th className="p-2.5 font-bold border-r border-slate-300 text-center whitespace-nowrap">Unit</th>
                <th className="p-2.5 font-bold border-r border-slate-300 text-right whitespace-nowrap">Quantity</th>
                <th className="p-2.5 font-bold border-r border-slate-300 text-right whitespace-nowrap">Unit Price</th>
                <th className="p-2.5 font-bold border-r border-slate-300 text-right whitespace-nowrap">Total Price</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">PO</th>
                <th className="p-2.5 font-bold border-r border-slate-300 min-w-[160px]">Supplier</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">Contract Signing</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">PG</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">Payment Status</th>
                <th className="p-2.5 font-bold border-r border-slate-300 whitespace-nowrap">LC opening</th>
                <th className="p-2.5 font-bold border-r border-slate-300 min-w-[230px]">Status</th>
                {isAdmin && <th className="p-2.5 font-bold text-center whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 15 : 14} className="p-10 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="text-sm font-bold text-slate-800">
                        {records.length === 0 ? 'No Contract Management Records Yet' : 'No Contracts Match Your Filters'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {records.length === 0
                          ? 'Upload an Excel/CSV file, download the 14-column official template, or add a contract row manually.'
                          : 'Clear or adjust your search and status filters to view matching contract records.'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {records.length === 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsUploadModalOpen(true)}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Excel / CSV</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadTemplate}
                              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Download Template</span>
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={openAddModal}
                                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Row</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const rowTotal =
                    rec.totalPrice !== null && rec.totalPrice !== undefined
                      ? rec.totalPrice
                      : rec.quantity !== null && rec.unitPrice !== null
                      ? rec.quantity * rec.unitPrice
                      : null;
                  const currentStatus = canonicalizeStatus(rec.status);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-slate-600">
                        {rec.sn || idx + 1}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {rec.materialCode || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">
                        {rec.materialDescription || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center text-slate-700 whitespace-nowrap">
                        {rec.unit || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {rec.quantity !== null && rec.quantity !== undefined ? formatNumber(rec.quantity) : '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right font-mono text-slate-700 whitespace-nowrap">
                        {rec.unitPrice !== null && rec.unitPrice !== undefined ? formatNumber(rec.unitPrice) : '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                        {rowTotal !== null ? formatNumber(rowTotal) : '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                        {rec.po || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-slate-800 font-medium">
                        {rec.supplier || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                        {rec.contractSigning || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                        {rec.pg || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                        {rec.paymentStatus || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                        {rec.lcOpening || '-'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200">
                        {isAdmin && onUpdateRecord ? (
                          <select
                            value={currentStatus}
                            onChange={(e) => handleInlineStatusChange(rec, e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-[11px] font-bold italic cursor-pointer focus:outline-hidden ${getStatusBadgeStyle(currentStatus)}`}
                          >
                            {CONTRACT_TRACKING_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                            {!CONTRACT_TRACKING_STATUSES.includes(currentStatus as ContractTrackingStatus) && (
                              <option value={currentStatus}>{currentStatus}</option>
                            )}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold italic ${getStatusBadgeStyle(currentStatus)}`}>
                            {currentStatus}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 transition cursor-pointer"
                              title="Edit contract row"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord?.(rec.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 transition cursor-pointer"
                              title="Delete contract row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                  <td colSpan={4} className="p-2.5 border-r border-slate-300 text-right uppercase text-[11px] tracking-wider">
                    Total ({filteredRecords.length} Line Items)
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-right font-mono">
                    {formatNumber(totals.totalQty)}
                  </td>
                  <td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 border-r border-slate-300 text-right font-mono text-emerald-800">
                    {formatNumber(totals.totalAmount)}
                  </td>
                  <td colSpan={isAdmin ? 8 : 7} className="p-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Upload / Paste Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Upload Contract Management Data</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    uploadTab === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Excel / CSV File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('paste')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    uploadTab === 'paste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Paste from Excel
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="font-bold text-slate-700">Import Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={uploadMode === 'replace'}
                    onChange={() => setUploadMode('replace')}
                  />
                  <span>Replace existing</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={uploadMode === 'append'}
                    onChange={() => setUploadMode('append')}
                  />
                  <span>Append to existing</span>
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadTab === 'file' ? (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 bg-slate-50">
                  <FileSpreadsheet className="w-9 h-9 text-indigo-600 mx-auto" />
                  <div className="text-xs text-slate-700 font-medium">
                    Select an <span className="font-bold">.xlsx</span>, <span className="font-bold">.xls</span>, or{' '}
                    <span className="font-bold">.csv</span> file with the 14 Contract Management columns.
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={7}
                    value={rawPasteText}
                    onChange={(e) => setRawPasteText(e.target.value)}
                    placeholder="Copy rows directly from Excel (14 columns: S/N, Material code, Material Description, Unit, Quantity, Unit Price, Total Price, PO, Supplier, Contract Signing, PG, Payment Status, LC opening, Status) and paste here..."
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteImport}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Import Pasted Rows</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Row Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingRecord ? 'Edit Contract Row' : 'Add Contract Row'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">S/N</label>
                  <input
                    type="text"
                    value={formState.sn}
                    onChange={(e) => setFormState({ ...formState, sn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Material code</label>
                  <input
                    type="text"
                    required
                    value={formState.materialCode}
                    onChange={(e) => setFormState({ ...formState, materialCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formState.unit}
                    onChange={(e) => setFormState({ ...formState, unit: e.target.value })}
                    placeholder="e.g. PCS, SET"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Material Description</label>
                <input
                  type="text"
                  required
                  value={formState.materialDescription}
                  onChange={(e) => setFormState({ ...formState, materialDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={formState.quantity}
                    onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Price</label>
                  <input
                    type="number"
                    step="any"
                    value={formState.unitPrice}
                    onChange={(e) => setFormState({ ...formState, unitPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Price (auto if blank)</label>
                  <input
                    type="number"
                    step="any"
                    value={formState.totalPrice}
                    onChange={(e) => setFormState({ ...formState, totalPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PO</label>
                  <input
                    type="text"
                    value={formState.po}
                    onChange={(e) => setFormState({ ...formState, po: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formState.supplier}
                    onChange={(e) => setFormState({ ...formState, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contract Signing</label>
                  <input
                    type="text"
                    value={formState.contractSigning}
                    onChange={(e) => setFormState({ ...formState, contractSigning: e.target.value })}
                    placeholder="Date / Status"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PG</label>
                  <input
                    type="text"
                    value={formState.pg}
                    onChange={(e) => setFormState({ ...formState, pg: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
                  <input
                    type="text"
                    value={formState.paymentStatus}
                    onChange={(e) => setFormState({ ...formState, paymentStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">LC opening</label>
                  <input
                    type="text"
                    value={formState.lcOpening}
                    onChange={(e) => setFormState({ ...formState, lcOpening: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formState.status}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  {CONTRACT_TRACKING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {editingRecord ? 'Save Changes' : 'Add Contract Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
