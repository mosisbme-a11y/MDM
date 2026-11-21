import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Clock,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Building2,
  FileText,
  Filter,
  ArrowUpRight,
  BarChart3,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { AgreementProcurementRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface AgreementProcurementStatusViewProps {
  records: AgreementProcurementRecord[];
  onUploadData?: (records: AgreementProcurementRecord[], mode?: 'append' | 'replace') => void;
  onClearData?: () => void;
  onAddRecord?: (record: AgreementProcurementRecord) => void;
  onUpdateRecord?: (record: AgreementProcurementRecord) => void;
  onDeleteRecord?: (id: string) => void;
  isAdmin?: boolean;
}

const formatAmountCell = (val: number | null | undefined): string => {
  if (val === null || val === undefined || Number.isNaN(val)) return '';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseNullableNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const str = String(raw).replace(/,/g, '').replace(/ETB/gi, '').trim();
  if (!str || str === '-') return null;
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatExcelDateCell = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && raw > 10000 && raw < 80000) {
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
  return String(raw).trim();
};

const normalizeHeaderKey = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]/g, '');

const getFieldValue = (rowObj: Record<string, unknown>, candidates: string[]): unknown => {
  const entries = Object.entries(rowObj);
  for (const cand of candidates) {
    const exact = entries.find(([k]) => normalizeHeaderKey(k) === cand);
    if (exact && exact[1] !== undefined && exact[1] !== null && String(exact[1]).trim() !== '') {
      return exact[1];
    }
  }
  for (const cand of candidates) {
    const partial = entries.find(([k]) => normalizeHeaderKey(k).includes(cand));
    if (partial && partial[1] !== undefined && partial[1] !== null && String(partial[1]).trim() !== '') {
      return partial[1];
    }
  }
  return undefined;
};

export const AgreementProcurementStatusView: React.FC<AgreementProcurementStatusViewProps> = ({
  records,
  onUploadData,
  onClearData,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  isAdmin = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chartType, setChartType] = useState<'stacked' | 'grouped' | 'linesOnly' | 'valueOnly'>('stacked');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [rawPasteText, setRawPasteText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AgreementProcurementRecord | null>(null);
  const [formState, setFormState] = useState({
    agreementYear: '',
    executionDate: '',
    facilityName: '',
    totalContractValue: '',
    advancePayment: '',
    amount: '',
    deliveryDate: '',
    fulfillmentStatus: 'Not Delivered'
  });

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.agreementYear) set.add(String(r.agreementYear).trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.fulfillmentStatus) set.add(r.fulfillmentStatus.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter((rec) => {
      if (yearFilter !== 'all' && String(rec.agreementYear).trim() !== yearFilter) return false;
      if (statusFilter !== 'all' && rec.fulfillmentStatus.trim() !== statusFilter) return false;
      if (q) {
        const hay = [
          rec.agreementYear,
          rec.executionDate,
          rec.facilityName,
          rec.deliveryDate,
          rec.fulfillmentStatus
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, yearFilter, statusFilter, searchQuery]);

    const isRecordDelivered = (statusRaw: string): boolean => {
      const st = (statusRaw || '').trim().toLowerCase();
      if (!st) return false;
      const isNegative = /\b(not\s+delivered|undelivered|pending|cancelled|canceled|in\s+transit)\b/.test(st);
      if (isNegative) return false;
      return st === 'delivered' || /\b(delivered|completed|received|fulfilled)\b/.test(st);
    };

    const extractRecordYear = (rec: AgreementProcurementRecord): string => {
      const yrRaw = (rec.agreementYear || '').trim();
      const yrMatch = yrRaw.match(/\b(20\d\d|19\d\d)\b/);
      if (yrMatch) return yrMatch[1];
      if (yrRaw) return yrRaw;
      const execRaw = (rec.executionDate || '').trim();
      const execMatch = execRaw.match(/\b(20\d\d|19\d\d)\b/);
      if (execMatch) return execMatch[1];
      return 'Unspecified';
    };

    const getDeliveredValueForRecord = (rec: AgreementProcurementRecord): number => {
      if (rec.totalContractValue !== null && rec.totalContractValue !== undefined) {
        return Number(rec.totalContractValue) || 0;
      }
      if (rec.advancePayment !== null && rec.advancePayment !== undefined) {
        return Number(rec.advancePayment) || 0;
      }
      return Number(rec.amount) || 0;
    };

    const totals = useMemo(() => {
      let totalContract = 0;
      let totalAdvance = 0;
      let totalAmount = 0;
      let deliveredValue = 0;
      let deliveredCount = 0;
      let notDeliveredCount = 0;
      const facilitiesSet = new Set<string>();

      filteredRecords.forEach((r) => {
        totalContract += Number(r.totalContractValue) || 0;
        totalAdvance += Number(r.advancePayment) || 0;
        totalAmount += Number(r.amount) || 0;
        if (r.facilityName && r.facilityName.trim()) {
          facilitiesSet.add(r.facilityName.trim());
        }
        if (isRecordDelivered(r.fulfillmentStatus)) {
          deliveredCount += 1;
          deliveredValue += getDeliveredValueForRecord(r);
        } else {
          notDeliveredCount += 1;
        }
      });

      const totalLines = filteredRecords.length;
      const deliveryRate = totalLines > 0 ? Math.round((deliveredCount / totalLines) * 100) : 0;

      return {
        totalContract,
        totalAdvance,
        totalAmount,
        deliveredValue,
        deliveredCount,
        notDeliveredCount,
        totalLines,
        deliveryRate,
        facilitiesCount: facilitiesSet.size
      };
    }, [filteredRecords]);

    const annualChartData = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      const baseRecords = records.filter((rec) => {
        if (statusFilter !== 'all' && rec.fulfillmentStatus.trim() !== statusFilter) return false;
        if (q) {
          const hay = [
            rec.agreementYear,
            rec.executionDate,
            rec.facilityName,
            rec.deliveryDate,
            rec.fulfillmentStatus
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const grouped: Record<
        string,
        {
          deliveredValue: number;
          totalContractValue: number;
          advancePayment: number;
          deliveredLines: number;
          totalLines: number;
          pendingLines: number;
          facilities: Set<string>;
        }
      > = {};

      baseRecords.forEach((rec) => {
        const year = extractRecordYear(rec);
        if (!grouped[year]) {
          grouped[year] = {
            deliveredValue: 0,
            totalContractValue: 0,
            advancePayment: 0,
            deliveredLines: 0,
            totalLines: 0,
            pendingLines: 0,
            facilities: new Set<string>()
          };
        }

        grouped[year].totalLines += 1;
        grouped[year].totalContractValue += Number(rec.totalContractValue) || 0;
        grouped[year].advancePayment += Number(rec.advancePayment) || 0;

        if (isRecordDelivered(rec.fulfillmentStatus)) {
          grouped[year].deliveredLines += 1;
          grouped[year].deliveredValue += getDeliveredValueForRecord(rec);
        } else {
          grouped[year].pendingLines += 1;
        }

        if (rec.facilityName && rec.facilityName.trim()) {
          grouped[year].facilities.add(rec.facilityName.trim());
        }
      });

      return Object.entries(grouped)
        .map(([year, d]) => {
          const pendingLines = Math.max(0, d.totalLines - d.deliveredLines);
          const deliveryRate = d.totalLines > 0 ? Math.round((d.deliveredLines / d.totalLines) * 100) : 0;
          return {
            year,
            deliveredValue: d.deliveredValue,
            totalContractValue: d.totalContractValue,
            advancePayment: d.advancePayment,
            deliveredLines: d.deliveredLines,
            pendingLines,
            totalLines: d.totalLines,
            deliveryRate,
            facilitiesCount: d.facilities.size,
            facilitiesList: Array.from(d.facilities).slice(0, 6).join(', ')
          };
        })
        .sort((a, b) => {
          const na = Number(a.year);
          const nb = Number(b.year);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.year.localeCompare(b.year);
        });
    }, [records, searchQuery, statusFilter]);

    const formatYAxisValue = (value: number) => {
      if (value === 0) return '0';
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
      return value.toString();
    };

  const parseRawRowsToRecords = (rows: Record<string, unknown>[], sourceName: string): AgreementProcurementRecord[] => {
    const nowIso = new Date().toISOString();
    const parsed: AgreementProcurementRecord[] = [];

    rows.forEach((rawRow, idx) => {
      const agreementYearVal = getFieldValue(rawRow, ['agreementyear', 'year']);
      const executionDateVal = getFieldValue(rawRow, ['executiondate', 'execdate']);
      const facilityNameVal = getFieldValue(rawRow, ['facilityname', 'facility', 'healthfacility']);
      const totalContractVal = getFieldValue(rawRow, ['totalcontractvalue', 'contractvalue', 'totalvalue']);
      const advancePaymentVal = getFieldValue(rawRow, ['advancepayment', 'advance']);
      const amountVal = getFieldValue(rawRow, ['amount', 'remainingamount', 'balance']);
      const deliveryDateVal = getFieldValue(rawRow, ['deliverydate', 'delivereddate']);
      const fulfillmentStatusVal = getFieldValue(rawRow, ['fulfillmentstatus', 'deliverystatus', 'status']);

      const facilityName = facilityNameVal !== undefined ? String(facilityNameVal).trim() : '';
      const agreementYear = agreementYearVal !== undefined ? String(agreementYearVal).trim() : '';
      const executionDate = formatExcelDateCell(executionDateVal);
      const deliveryDate = formatExcelDateCell(deliveryDateVal);
      const fulfillmentStatus = fulfillmentStatusVal !== undefined ? String(fulfillmentStatusVal).trim().replace(/\s+/g, ' ') : '';

      const totalContractValue = parseNullableNumber(totalContractVal);
      const advancePayment = parseNullableNumber(advancePaymentVal);
      const amount = parseNullableNumber(amountVal);

      // Skip completely blank or summary-total rows
      if (
        !facilityName &&
        !agreementYear &&
        !executionDate &&
        totalContractValue === null &&
        advancePayment === null &&
        amount === null
      ) {
        return;
      }
      if (facilityName.toLowerCase() === 'total' || agreementYear.toLowerCase() === 'total') {
        return;
      }

      parsed.push({
        id: `apr-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        agreementYear,
        executionDate,
        facilityName,
        totalContractValue,
        advancePayment,
        amount,
        deliveryDate,
        fulfillmentStatus,
        uploadedAt: nowIso,
        sourceFile: sourceName
      });
    });

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
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
        const parsed = parseRawRowsToRecords(jsonRows, file.name);
        if (parsed.length === 0) {
          setUploadError(
            'No valid rows found. Please verify headers: S/N, Agreement Year, Execution Date, Facility Name, Total Contract Value, Advance Payment, Amount, Delivery Date, Fulfillment Status.'
          );
          return;
        }
        onUploadData?.(parsed, uploadMode);
        setIsUploadOpen(false);
      } catch (err) {
        console.error('Failed to parse Agreement Procurement file:', err);
        setUploadError('Failed to parse Excel/CSV file. Make sure it is a valid .xlsx, .xls, or .csv spreadsheet.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handlePasteUpload = () => {
    setUploadError(null);
    const trimmed = rawPasteText.trim();
    if (!trimmed) {
      setUploadError('Please paste spreadsheet rows first.');
      return;
    }

    try {
      const wb = XLSX.read(trimmed, { type: 'string' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const parsed = parseRawRowsToRecords(jsonRows, 'Pasted Table Data');
      if (parsed.length === 0) {
        setUploadError(
          'Could not detect columns. Include the header row: S/N, Agreement Year, Execution Date, Facility Name, Total Contract Value, Advance Payment, Amount, Delivery Date, Fulfillment Status.'
        );
        return;
      }
      onUploadData?.(parsed, uploadMode);
      setRawPasteText('');
      setIsUploadOpen(false);
    } catch {
      setUploadError('Could not parse pasted text. Copy directly from Excel including column headers.');
    }
  };

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'S/N': 1,
        'Agreement Year': '2012',
        'Execution Date': '2012',
        'Facility Name': 'BGRHB',
        'Total Contract Value': '',
        'Advance Payment': 3580000,
        'Amount': '',
        'Delivery Date': '',
        'Fulfillment Status': 'Not Delivered'
      },
      {
        'S/N': 2,
        'Agreement Year': '2012',
        'Execution Date': '29/10/2012',
        'Facility Name': 'Ambo University',
        'Total Contract Value': 65000000,
        'Advance Payment': 82354461.96,
        'Amount': 0,
        'Delivery Date': '',
        'Fulfillment Status': 'Delivered'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreement_Procurement_Status');
    XLSX.writeFile(wb, 'Agreement_Procurement_Status_Template.xlsx');
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    const rows = filteredRecords.map((r, idx) => ({
      'S/N': idx + 1,
      'Agreement Year': r.agreementYear,
      'Execution Date': r.executionDate,
      'Facility Name': r.facilityName,
      'Total Contract Value': r.totalContractValue ?? '',
      'Advance Payment': r.advancePayment ?? '',
      'Amount': r.amount ?? '',
      'Delivery Date': r.deliveryDate,
      'Fulfillment Status': r.fulfillmentStatus
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreement_Procurement_Status');
    XLSX.writeFile(wb, `Agreement_Procurement_Status_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      'S/N',
      'Agreement Year',
      'Execution Date',
      'Facility Name',
      'Total Contract Value',
      'Advance Payment',
      'Amount',
      'Delivery Date',
      'Fulfillment Status'
    ];
    const lines = filteredRecords.map((r, idx) =>
      [
        idx + 1,
        `"${(r.agreementYear || '').replace(/"/g, '""')}"`,
        `"${(r.executionDate || '').replace(/"/g, '""')}"`,
        `"${(r.facilityName || '').replace(/"/g, '""')}"`,
        r.totalContractValue ?? '',
        r.advancePayment ?? '',
        r.amount ?? '',
        `"${(r.deliveryDate || '').replace(/"/g, '""')}"`,
        `"${(r.fulfillmentStatus || '').replace(/"/g, '""')}"`
      ].join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Agreement_Procurement_Status_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setFormState({
      agreementYear: new Date().getFullYear().toString(),
      executionDate: '',
      facilityName: '',
      totalContractValue: '',
      advancePayment: '',
      amount: '',
      deliveryDate: '',
      fulfillmentStatus: 'Not Delivered'
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (rec: AgreementProcurementRecord) => {
    setEditingRecord(rec);
    setFormState({
      agreementYear: rec.agreementYear || '',
      executionDate: rec.executionDate || '',
      facilityName: rec.facilityName || '',
      totalContractValue: rec.totalContractValue !== null && rec.totalContractValue !== undefined ? String(rec.totalContractValue) : '',
      advancePayment: rec.advancePayment !== null && rec.advancePayment !== undefined ? String(rec.advancePayment) : '',
      amount: rec.amount !== null && rec.amount !== undefined ? String(rec.amount) : '',
      deliveryDate: rec.deliveryDate || '',
      fulfillmentStatus: rec.fulfillmentStatus || 'Not Delivered'
    });
    setIsFormModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.facilityName.trim()) return;

    const payload: AgreementProcurementRecord = {
      id: editingRecord?.id || `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agreementYear: formState.agreementYear.trim(),
      executionDate: formState.executionDate.trim(),
      facilityName: formState.facilityName.trim(),
      totalContractValue: parseNullableNumber(formState.totalContractValue),
      advancePayment: parseNullableNumber(formState.advancePayment),
      amount: parseNullableNumber(formState.amount),
      deliveryDate: formState.deliveryDate.trim(),
      fulfillmentStatus: formState.fulfillmentStatus.trim(),
      uploadedAt: editingRecord?.uploadedAt || new Date().toISOString(),
      sourceFile: editingRecord?.sourceFile || 'Manual Entry'
    };

    if (editingRecord) {
      onUpdateRecord?.(payload);
    } else {
      onAddRecord?.(payload);
    }
    setIsFormModalOpen(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-600 shadow-2xs">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Agreement Procurement Status</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {records.length} {records.length === 1 ? 'Record' : 'Records'}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Uploaded contract &amp; procurement tracking columns: <strong>S/N, Agreement Year, Execution Date, Facility Name, Total Contract Value, Advance Payment, Amount, Delivery Date, Fulfillment Status</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              setIsUploadOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Template (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredRecords.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-600" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
          {isAdmin && records.length > 0 && onClearData && (
            <button
              type="button"
              onClick={onClearData}
              className="px-2.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
              title="Clear uploaded records"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards & Dual-Axis Annual Stacked Performance Chart */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Agreement Procurement Performance
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider font-mono">
                Stacked Performance
              </span>
              {yearFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setYearFilter('all')}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition cursor-pointer flex items-center gap-1"
                  title="Clear year filter"
                >
                  <span>Year: {yearFilter}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Annual Analysis: Total Contract Value, Total Advanced Payment &amp; Total Line of Facility per Agreement Year.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartType('stacked')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                chartType === 'stacked'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
              title="Stacked Graph: Stacks delivered and pending facility lines to equal Total Line of Facility, alongside Contract Value & Advanced Payment"
            >
              <Layers className="w-3 h-3" />
              <span>Stacked</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('grouped')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                chartType === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Grouped
            </button>
            <button
              type="button"
              onClick={() => setChartType('linesOnly')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                chartType === 'linesOnly'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Facility Lines
            </button>
            <button
              type="button"
              onClick={() => setChartType('valueOnly')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                chartType === 'valueOnly'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-600'
              }`}
            >
              Value Only
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setYearFilter('all');
              setStatusFilter('all');
            }}
            className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-2xl border border-indigo-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition active:scale-[0.99] group"
            title="Show all uploaded facility lines"
          >
            <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Line of Facility</p>
                <ArrowUpRight className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-lg font-black text-slate-900 tabular-nums truncate">
                  {formatNumber(totals.totalLines)}
                </p>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {formatNumber(totals.facilitiesCount)} Facilities
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              const deliveredOpt = uniqueStatuses.find((s) => s.trim().toLowerCase() === 'delivered');
              if (deliveredOpt) {
                setStatusFilter((prev) => (prev === deliveredOpt ? 'all' : deliveredOpt));
              }
            }}
            className="bg-gradient-to-br from-sky-50/80 to-white p-4 rounded-2xl border border-sky-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-sky-300 hover:shadow-md transition active:scale-[0.99] group"
            title="Filter table to Delivered lines"
          >
            <div className="p-3 rounded-xl bg-sky-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Delivered of Facility</p>
                <ArrowUpRight className="w-3 h-3 text-sky-400 group-hover:text-sky-600 transition-colors" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-lg font-black text-sky-900 tabular-nums truncate">
                  {formatNumber(totals.deliveredCount)}
                </p>
                <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {totals.deliveryRate}% Delivered
                </span>
              </div>
            </div>
          </div>

          <div
            className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center gap-3.5 hover:border-emerald-300 hover:shadow-md transition group"
            title={`Exact Total Contract Value: ${formatAmountCell(totals.totalContract)}`}
          >
            <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Contract Value</p>
                <ArrowUpRight className="w-3 h-3 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <p className="text-lg font-black text-emerald-900 mt-0.5 tabular-nums truncate">
                {formatCurrency(totals.totalContract, true)}
              </p>
            </div>
          </div>

          <div
            className="bg-gradient-to-br from-teal-50/80 to-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center gap-3.5 hover:border-teal-300 hover:shadow-md transition group"
            title={`Exact Total Advanced Payment: ${formatAmountCell(totals.totalAdvance)}`}
          >
            <div className="p-3 rounded-xl bg-teal-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Advanced Payment</p>
                <ArrowUpRight className="w-3 h-3 text-teal-400 group-hover:text-teal-600 transition-colors" />
              </div>
              <p className="text-lg font-black text-teal-900 mt-0.5 tabular-nums truncate">
                {formatCurrency(totals.totalAdvance, true)}
              </p>
            </div>
          </div>
        </div>

        {/* Stacked Combo Chart Container */}
        <div className="h-80 sm:h-96 w-full bg-slate-50/30 rounded-2xl p-4 border border-slate-100/80 shadow-inner relative overflow-hidden flex flex-col justify-between">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />

          {/* Legend Bar */}
          <div className="relative z-10 flex items-center gap-3 sm:gap-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-white/95 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs flex-wrap mb-2">
            {chartType !== 'linesOnly' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-2xs" />
                  <span className="text-emerald-900 font-extrabold">Total Contract Value</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-teal-500 shadow-2xs" />
                  <span className="text-teal-900 font-extrabold">Total Advanced Payment</span>
                </div>
              </>
            )}
            {chartType !== 'valueOnly' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-sky-600 shadow-2xs" />
                  <span className="text-sky-900 font-extrabold">Delivered of Facility</span>
                </div>
                {chartType === 'stacked' && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-sky-300 shadow-2xs" />
                    <span className="text-slate-600">Pending Lines (Stacked to Total)</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-indigo-600 border-t-2 border-indigo-600 border-dashed" />
                  <span className="text-indigo-900 font-extrabold">Total Line of Facility</span>
                </div>
              </>
            )}
          </div>

          {annualChartData.length === 0 ? (
            <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center bg-white/70 rounded-xl border border-dashed border-slate-300">
              <FileSpreadsheet className="w-7 h-7 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-700">Upload Excel / CSV to populate Annual Procurement Performance</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chart automatically groups your records by Agreement Year, Total Contract Value, Total Advanced Payment &amp; Total Line of Facility.
              </p>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={annualChartData}
                  margin={{ top: 15, right: 15, left: 15, bottom: 5 }}
                  style={{ cursor: 'pointer' }}
                  onClick={(state: any) => {
                    const clickedYear = state?.activePayload?.[0]?.payload?.year || state?.activeLabel;
                    if (clickedYear && clickedYear !== 'Unspecified') {
                      setYearFilter((prev) => (prev === String(clickedYear) ? 'all' : String(clickedYear)));
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  {chartType !== 'linesOnly' && (
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: '#059669', fontWeight: 800 }}
                      tickFormatter={(val) => formatYAxisValue(Number(val) || 0)}
                      axisLine={false}
                      tickLine={false}
                    />
                  )}
                  {chartType !== 'valueOnly' && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: '#0284c7', fontWeight: 800 }}
                      tickFormatter={(val) => formatNumber(Number(val) || 0)}
                      axisLine={false}
                      tickLine={false}
                    />
                  )}
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2.5 min-w-[270px]">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                            <span className="font-black text-slate-900 text-sm">Year {label} Performance</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {d.deliveryRate}% Delivered
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                              <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                                <span>Total Contract Value:</span>
                              </span>
                              <span className="text-emerald-800 font-black text-xs font-mono">
                                {formatCurrency(d.totalContractValue, true)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-teal-50/70 border border-teal-100">
                              <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 shrink-0" />
                                <span>Total Advanced Payment:</span>
                              </span>
                              <span className="text-teal-800 font-black text-xs font-mono">
                                {formatCurrency(d.advancePayment, true)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-indigo-50/70 border border-indigo-100">
                              <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 shrink-0" />
                                <span>Total Line of Facility:</span>
                              </span>
                              <span className="text-indigo-900 font-black text-xs font-mono">
                                {formatNumber(d.totalLines)} Lines ({formatNumber(d.facilitiesCount)} Facilities)
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-sky-50/70 border border-sky-100">
                              <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 shrink-0" />
                                <span>Delivered of Facility:</span>
                              </span>
                              <span className="text-sky-800 font-black text-xs font-mono">
                                {formatNumber(d.deliveredLines)} Lines
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                              <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-sky-300 shrink-0" />
                                <span>Pending Lines:</span>
                              </span>
                              <span className="text-slate-800 font-black text-xs font-mono">
                                {formatNumber(d.pendingLines)} Lines
                              </span>
                            </div>

                            <div className="pt-1">
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(0, d.deliveryRate))}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {d.facilitiesList && (
                            <div className="pt-1 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Facilities ({d.facilitiesCount}):
                              </span>
                              <p className="text-[11px] font-medium text-slate-700 truncate max-w-[245px]" title={d.facilitiesList}>
                                {d.facilitiesList}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  {chartType !== 'linesOnly' && (
                    <Bar
                      yAxisId="left"
                      dataKey="totalContractValue"
                      name="Total Contract Value"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      barSize={chartType === 'stacked' ? 24 : 22}
                      onClick={(data: any) => {
                        const y = data?.payload?.year || data?.year;
                        if (y && y !== 'Unspecified') setYearFilter((prev) => (prev === String(y) ? 'all' : String(y)));
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}

                  {chartType !== 'linesOnly' && (
                    <Bar
                      yAxisId="left"
                      dataKey="advancePayment"
                      name="Total Advanced Payment"
                      fill="#14b8a6"
                      radius={[6, 6, 0, 0]}
                      barSize={chartType === 'stacked' ? 24 : 22}
                      onClick={(data: any) => {
                        const y = data?.payload?.year || data?.year;
                        if (y && y !== 'Unspecified') setYearFilter((prev) => (prev === String(y) ? 'all' : String(y)));
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}

                  {chartType !== 'valueOnly' && (
                    <Bar
                      yAxisId={chartType === 'linesOnly' ? 'left' : 'right'}
                      dataKey="deliveredLines"
                      name="Delivered of Facility"
                      fill="#0284c7"
                      radius={chartType === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                      barSize={chartType === 'stacked' ? 30 : 22}
                      stackId={chartType === 'stacked' ? 'lines' : undefined}
                      onClick={(data: any) => {
                        const y = data?.payload?.year || data?.year;
                        if (y && y !== 'Unspecified') setYearFilter((prev) => (prev === String(y) ? 'all' : String(y)));
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}

                  {chartType === 'stacked' && (
                    <Bar
                      yAxisId="right"
                      dataKey="pendingLines"
                      name="Pending Lines (Stacked to Total)"
                      fill="#93c5fd"
                      radius={[6, 6, 0, 0]}
                      barSize={30}
                      stackId="lines"
                      onClick={(data: any) => {
                        const y = data?.payload?.year || data?.year;
                        if (y && y !== 'Unspecified') setYearFilter((prev) => (prev === String(y) ? 'all' : String(y)));
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}

                  {chartType === 'grouped' && (
                    <Bar
                      yAxisId="right"
                      dataKey="totalLines"
                      name="Total Line of Facility"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      barSize={22}
                      onClick={(data: any) => {
                        const y = data?.payload?.year || data?.year;
                        if (y && y !== 'Unspecified') setYearFilter((prev) => (prev === String(y) ? 'all' : String(y)));
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}

                  {chartType !== 'valueOnly' && (
                    <Line
                      yAxisId={chartType === 'linesOnly' ? 'left' : 'right'}
                      type="monotone"
                      dataKey="totalLines"
                      name="Total Line of Facility"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      strokeDasharray="4 4"
                      dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff' }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facility name, year, execution date, status..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filter:</span>
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Agreement Years</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Fulfillment Statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 9-Column Table matching exact uploaded schema */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="py-3 px-3 border-r border-slate-300 text-center w-14">S/N</th>
                <th className="py-3 px-3 border-r border-slate-300 whitespace-nowrap">Agreement Year</th>
                <th className="py-3 px-3 border-r border-slate-300 whitespace-nowrap">Execution Date</th>
                <th className="py-3 px-3 border-r border-slate-300 min-w-[220px]">Facility Name</th>
                <th className="py-3 px-3 border-r border-slate-300 text-right whitespace-nowrap">Total Contract Value</th>
                <th className="py-3 px-3 border-r border-slate-300 text-right whitespace-nowrap">Advance Payment</th>
                <th className="py-3 px-3 border-r border-slate-300 text-right whitespace-nowrap">Amount</th>
                <th className="py-3 px-3 border-r border-slate-300 whitespace-nowrap">Delivery Date</th>
                <th className="py-3 px-3 border-r border-slate-300 whitespace-nowrap">Fulfillment Status</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.map((rec, idx) => {
                const statusLower = (rec.fulfillmentStatus || '').trim().toLowerCase();
                const isDelivered = statusLower === 'delivered';
                const isNotDelivered = statusLower.includes('not delivered');

                return (
                  <tr key={rec.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-900 whitespace-nowrap">
                      {rec.agreementYear || ''}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                      {rec.executionDate || ''}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
                      {rec.facilityName}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-900 whitespace-nowrap">
                      {formatAmountCell(rec.totalContractValue)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-900 whitespace-nowrap">
                      {formatAmountCell(rec.advancePayment)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-900 whitespace-nowrap">
                      {formatAmountCell(rec.amount)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                      {rec.deliveryDate || ''}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                      {rec.fulfillmentStatus ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isNotDelivered
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {rec.fulfillmentStatus}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer transition"
                          title="Edit row"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord?.(rec.id)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-amber-300 font-mono border-r border-slate-700">
                    TOTAL ({filteredRecords.length} Records):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-300 border-r border-slate-700 whitespace-nowrap">
                    {formatAmountCell(totals.totalContract)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-cyan-300 border-r border-slate-700 whitespace-nowrap">
                    {formatAmountCell(totals.totalAdvance)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-300 border-r border-slate-700 whitespace-nowrap">
                    {formatAmountCell(totals.totalAmount)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 text-left text-[11px] text-slate-300 font-mono">
                    {totals.deliveredCount} Delivered • {totals.notDeliveredCount} Not Delivered
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 && (
          <div className="py-16 text-center space-y-3 bg-slate-50/50">
            <FileSpreadsheet className="w-10 h-10 text-amber-500/70 mx-auto" />
            <div className="text-sm font-bold text-slate-800">
              {records.length === 0
                ? 'No Agreement Procurement Status Data Uploaded Yet'
                : 'No Records Match Your Filters'}
            </div>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              {records.length === 0
                ? 'Upload your Excel (.xlsx / .xls) or CSV file with columns: S/N, Agreement Year, Execution Date, Facility Name, Total Contract Value, Advance Payment, Amount, Delivery Date, and Fulfillment Status.'
                : 'Try adjusting your search keywords, Agreement Year, or Fulfillment Status filter.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {records.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      setIsUploadOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Procurement File</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Template</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setYearFilter('all');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Excel / CSV / Paste Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Agreement Procurement Status</h3>
                  <p className="text-xs text-slate-500">Upload spreadsheet matching your exact procurement columns</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Replace / Append Mode + Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 pl-1">Import Mode:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setUploadMode('replace')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    uploadMode === 'replace'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Replace Table
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('append')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    uploadMode === 'append'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Append Rows
                </button>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  uploadTab === 'file' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Upload Excel / CSV File
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('paste')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  uploadTab === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Paste From Excel
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadTab === 'file' ? (
              <div className="space-y-3">
                <label className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50 hover:bg-amber-50/30 transition text-center group">
                  <div className="p-3 rounded-full bg-white shadow-xs group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Click to browse Excel (.xlsx / .xls) or CSV</span>
                    <span className="text-[11px] text-slate-500">Uploaded rows appear immediately inside Agreement Procurement Status</span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold block">Expected Columns:</span>
                  <p className="leading-relaxed">
                    S/N, Agreement Year, Execution Date, Facility Name, Total Contract Value, Advance Payment, Amount, Delivery Date, Fulfillment Status
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  rows={8}
                  placeholder={`Paste copied Excel rows including headers:\nS/N\tAgreement Year\tExecution Date\tFacility Name\tTotal Contract Value\tAdvance Payment\tAmount\tDelivery Date\tFulfillment Status`}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handlePasteUpload}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-xs"
                >
                  Parse &amp; Display Pasted Rows
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Row Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRecord ? 'Edit Procurement Status Row' : 'Add Procurement Status Row'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agreement Year</label>
                  <input
                    type="text"
                    value={formState.agreementYear}
                    onChange={(e) => setFormState((s) => ({ ...s, agreementYear: e.target.value }))}
                    placeholder="e.g. 2014"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Execution Date</label>
                  <input
                    type="text"
                    value={formState.executionDate}
                    onChange={(e) => setFormState((s) => ({ ...s, executionDate: e.target.value }))}
                    placeholder="e.g. 29/10/2012"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Facility Name *</label>
                <input
                  type="text"
                  required
                  value={formState.facilityName}
                  onChange={(e) => setFormState((s) => ({ ...s, facilityName: e.target.value }))}
                  placeholder="e.g. Ambo University"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Contract Value</label>
                  <input
                    type="text"
                    value={formState.totalContractValue}
                    onChange={(e) => setFormState((s) => ({ ...s, totalContractValue: e.target.value }))}
                    placeholder="e.g. 65000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Advance Payment</label>
                  <input
                    type="text"
                    value={formState.advancePayment}
                    onChange={(e) => setFormState((s) => ({ ...s, advancePayment: e.target.value }))}
                    placeholder="e.g. 3580000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount</label>
                  <input
                    type="text"
                    value={formState.amount}
                    onChange={(e) => setFormState((s) => ({ ...s, amount: e.target.value }))}
                    placeholder="e.g. 0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Date</label>
                  <input
                    type="text"
                    value={formState.deliveryDate}
                    onChange={(e) => setFormState((s) => ({ ...s, deliveryDate: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fulfillment Status</label>
                  <input
                    type="text"
                    value={formState.fulfillmentStatus}
                    onChange={(e) => setFormState((s) => ({ ...s, fulfillmentStatus: e.target.value }))}
                    placeholder="Delivered or Not Delivered"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer"
                >
                  {editingRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
