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
  AlertTriangle,
  Filter
} from 'lucide-react';
import { AgreementProcurementRecord } from '../types';
import {
  AgreementProcurementHudPanel,
  INITIAL_SOURCE_DATA_MODAL_STATE,
  SourceDataModalState,
  extractRecordYear,
  formatAmountCell,
  isRecordDelivered
} from './AgreementProcurementHudPanel';

interface AgreementProcurementStatusViewProps {
  records: AgreementProcurementRecord[];
  onUploadData?: (records: AgreementProcurementRecord[], mode?: 'append' | 'replace') => void;
  onClearData?: () => void;
  onAddRecord?: (record: AgreementProcurementRecord) => void;
  onUpdateRecord?: (record: AgreementProcurementRecord) => void;
  onDeleteRecord?: (id: string) => void;
  isAdmin?: boolean;
}

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
  const [sourceDataModal, setSourceDataModal] = useState<SourceDataModalState>(
    INITIAL_SOURCE_DATA_MODAL_STATE
  );

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
      const y = extractRecordYear(r);
      if (y && y !== 'Unspecified') set.add(y);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
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
      if (yearFilter !== 'all' && extractRecordYear(rec) !== yearFilter) return false;
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

  const totals = useMemo(() => {
    let totalContract = 0;
    let totalAdvance = 0;
    let totalAmount = 0;
    let deliveredCount = 0;
    let notDeliveredCount = 0;

    filteredRecords.forEach((r) => {
      totalContract += Number(r.totalContractValue) || 0;
      totalAdvance += Number(r.advancePayment) || 0;
      totalAmount += Number(r.amount) || 0;
      if (isRecordDelivered(r.fulfillmentStatus)) {
        deliveredCount += 1;
      } else {
        notDeliveredCount += 1;
      }
    });

    return {
      totalContract,
      totalAdvance,
      totalAmount,
      deliveredCount,
      notDeliveredCount
    };
  }, [filteredRecords]);

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

      {/* Dark HUD KPI Cards & Dual-Axis Annual Stacked Performance Chart */}
      <AgreementProcurementHudPanel
        records={records}
        yearFilter={yearFilter}
        onYearFilterChange={setYearFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        sourceDataModal={sourceDataModal}
        setSourceDataModal={setSourceDataModal}
      />

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
                  <tr
                    key={rec.id}
                    onDoubleClick={() => {
                      const recYear = extractRecordYear(rec);
                      setSourceDataModal({
                        isOpen: true,
                        title: `Source Data: ${rec.facilityName || 'Procurement Record'}`,
                        subtitle: 'Exact source row metadata and matching Agreement Year records.',
                        yearFilter: recYear === 'Unspecified' ? 'all' : recYear,
                        statusScope: 'all',
                        focusMetric: 'record',
                        searchQuery: '',
                        selectedRecord: rec
                      });
                    }}
                    title="Double-click row to show source data"
                    className="hover:bg-amber-50/40 transition cursor-pointer"
                  >
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
