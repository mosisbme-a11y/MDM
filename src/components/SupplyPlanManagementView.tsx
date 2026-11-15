import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  Download,
  Search,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Boxes,
  ClipboardList,
  ShoppingCart,
  FileCheck2,
  CalendarClock,
  Filter,
  RotateCcw,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplyPlanRecord } from '../types';
import { formatNumber, downloadCSV } from '../utils/formatters';

interface SupplyPlanManagementViewProps {
  records?: SupplyPlanRecord[];
  onUploadRecords?: (records: SupplyPlanRecord[], mode: 'append' | 'replace', fileName?: string) => void;
  onClearRecords?: () => void;
  onAddRecord?: (record: SupplyPlanRecord) => void;
  onUpdateRecord?: (record: SupplyPlanRecord) => void;
  onDeleteRecord?: (id: string) => void;
  isAdmin?: boolean;
}

type SupplyPlanFieldKey =
  | 'sn'
  | 'materialCode'
  | 'materialDescription'
  | 'unit'
  | 'annualDemand'
  | 'stockOnHand'
  | 'committedQuantity'
  | 'deliveredQuantity'
  | 'unmetDemand'
  | 'stockOutItems'
  | 'tenderQty'
  | 'tenderPo'
  | 'tenderStatus'
  | 'rootCauseForRetendering'
  | 'pipelineQty'
  | 'contractPo'
  | 'contractStatus'
  | 'rootCauseForPend'
  | 'responsibleBody'
  | 'edd'
  | 'remark';

const POSITIONAL_KEYS: SupplyPlanFieldKey[] = [
  'sn',
  'materialCode',
  'materialDescription',
  'unit',
  'annualDemand',
  'stockOnHand',
  'committedQuantity',
  'deliveredQuantity',
  'unmetDemand',
  'stockOutItems',
  'tenderQty',
  'tenderPo',
  'tenderStatus',
  'rootCauseForRetendering',
  'pipelineQty',
  'contractPo',
  'contractStatus',
  'rootCauseForPend',
  'responsibleBody',
  'edd',
  'remark'
];

const GROUP_ROW_EXPORT = [
  'MD CDSS Supply Plan', '', '', '',
  'Demand Status', '', '', '', '', '',
  'Tender Status', '', '', '',
  'Contract Status', '', '', '',
  'Action Plan', '',
  ''
];

const SUB_HEADER_ROW_EXPORT = [
  'S. N',
  'Material Code',
  'Material Description',
  'Unit',
  'Annual Demand',
  'Stock On Hand',
  'Committed Quantity',
  'Delivered Quantity',
  'Unmet Demand',
  'Stock Out Items',
  'Qty',
  'PO',
  'Status',
  'Root cause For Retendering',
  'Pipeline Qty',
  'PO',
  'Status',
  'Root cause for Pend',
  'Responsible Body',
  'EDD',
  'Remark'
];

const normalizeSpace = (val: unknown): string =>
  String(val ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCompact = (val: unknown): string =>
  normalizeSpace(val)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const formatCellString = (rawVal: unknown, formattedVal?: unknown): string => {
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return normalizeSpace(formattedVal ?? '');
  }
  if (typeof rawVal === 'number') {
    if (!Number.isFinite(rawVal)) return '';
    // Avoid scientific notation for PO numbers or codes
    if (Math.abs(rawVal) >= 1e6 && Number.isInteger(rawVal)) {
      return rawVal.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
    }
    return String(rawVal);
  }
  const fStr = normalizeSpace(formattedVal ?? '');
  if (fStr && !/^#+$/.test(fStr)) {
    return fStr;
  }
  return normalizeSpace(rawVal);
};

const formatPoString = (rawVal: unknown, formattedVal?: unknown): string => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return '';
  if (typeof rawVal === 'number') {
    if (!Number.isFinite(rawVal)) return '';
    return Math.round(rawVal).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
  }
  const rawStr = normalizeSpace(rawVal);
  if (rawStr && !/^#+$/.test(rawStr)) return rawStr;
  const fStr = normalizeSpace(formattedVal ?? '');
  return /^#+$/.test(fStr) ? '' : fStr;
};

const formatEddString = (rawVal: unknown, formattedVal?: unknown): string => {
  const fStr = normalizeSpace(formattedVal ?? '');
  if (fStr && !/^#+$/.test(fStr)) return fStr;
  if (typeof rawVal === 'number' && rawVal > 20000 && rawVal < 80000) {
    // Convert Excel serial date
    const parsed = XLSX.SSF.parse_date_code(rawVal);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  return normalizeSpace(rawVal);
};

const parseStrictNumber = (val: unknown): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const s = normalizeSpace(val);
  if (!s) return 0;
  // Support "(258)" negative accounting format
  const isParensNegative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[,()$\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return isParensNegative ? -Math.abs(n) : n;
};

const parseOptionalNumber = (val: unknown): number | '' => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : '';
  const s = normalizeSpace(val);
  if (!s || s === '-') return '';
  const isParensNegative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[,()$\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return '';
  return isParensNegative ? -Math.abs(n) : n;
};

function expandGroupRowWithMerges(
  ws: XLSX.WorkSheet | null,
  rawGroupRow: any[],
  colCount: number,
  groupHeaderIdx: number
): string[] {
  const result = new Array<string>(colCount).fill('');
  for (let c = 0; c < colCount; c++) {
    result[c] = normalizeSpace(rawGroupRow[c] ?? '');
  }
  if (ws && Array.isArray(ws['!merges'])) {
    for (const m of ws['!merges']) {
      if (m.s.r <= groupHeaderIdx && m.e.r >= groupHeaderIdx) {
        const startLabel = normalizeSpace(rawGroupRow[m.s.c] ?? '');
        if (startLabel) {
          for (let c = m.s.c; c <= Math.min(m.e.c, colCount - 1); c++) {
            if (!result[c]) result[c] = startLabel;
          }
        }
      }
    }
  }
  // Forward-fill known Excel group header spans if workbook lacked !merges (e.g., CSV)
  let currentGroup = '';
  for (let c = 0; c < colCount; c++) {
    const val = result[c];
    if (val) {
      currentGroup = val;
    } else if (currentGroup && !/remark/i.test(currentGroup)) {
      result[c] = currentGroup;
    }
  }
  return result;
}

function mapColumnsFromHeaders(
  subHeaders: string[],
  groupHeaders: string[]
): Map<number, SupplyPlanFieldKey> {
  const map = new Map<number, SupplyPlanFieldKey>();
  const usedKeys = new Set<SupplyPlanFieldKey>();

  const assign = (colIdx: number, key: SupplyPlanFieldKey) => {
    if (!usedKeys.has(key)) {
      map.set(colIdx, key);
      usedKeys.add(key);
      return true;
    }
    return false;
  };

  for (let c = 0; c < subHeaders.length; c++) {
    const sub = normalizeCompact(subHeaders[c]);
    const grp = normalizeCompact(groupHeaders[c] || '');
    if (!sub) continue;

    if (sub === 'sn' || sub === 'sno' || sub === 'serialno' || sub === 'serialnumber' || sub === 'no') {
      assign(c, 'sn');
    } else if (sub.includes('materialcode') || sub === 'code' || sub === 'matcode') {
      assign(c, 'materialCode');
    } else if (sub.includes('materialdesc') || sub.includes('itemdesc') || sub === 'description') {
      assign(c, 'materialDescription');
    } else if (sub === 'unit' || sub === 'uom') {
      assign(c, 'unit');
    } else if (sub.includes('annualdemand') || (sub.includes('annual') && sub.includes('demand'))) {
      assign(c, 'annualDemand');
    } else if (sub.includes('stockonhand') || sub === 'soh') {
      assign(c, 'stockOnHand');
    } else if (sub.includes('committed') || sub.includes('committe')) {
      assign(c, 'committedQuantity');
    } else if (sub.includes('delivered') || sub.includes('delivere')) {
      assign(c, 'deliveredQuantity');
    } else if (sub.includes('unmet')) {
      assign(c, 'unmetDemand');
    } else if (sub.includes('stockout')) {
      assign(c, 'stockOutItems');
    } else if (sub.includes('pipelineqty') || sub === 'pipeline') {
      assign(c, 'pipelineQty');
    } else if (sub === 'qty' || sub === 'quantity' || sub === 'tenderqty') {
      assign(c, 'tenderQty');
    } else if (sub === 'po' || sub === 'ponumber' || sub === 'pono') {
      if (grp.includes('contract')) {
        assign(c, 'contractPo');
      } else if (grp.includes('tender')) {
        assign(c, 'tenderPo');
      } else if (!usedKeys.has('tenderPo')) {
        assign(c, 'tenderPo');
      } else {
        assign(c, 'contractPo');
      }
    } else if (sub === 'tenderpo') {
      assign(c, 'tenderPo');
    } else if (sub === 'contractpo') {
      assign(c, 'contractPo');
    } else if (sub === 'status') {
      if (grp.includes('contract')) {
        assign(c, 'contractStatus');
      } else if (grp.includes('tender')) {
        assign(c, 'tenderStatus');
      } else if (!usedKeys.has('tenderStatus')) {
        assign(c, 'tenderStatus');
      } else {
        assign(c, 'contractStatus');
      }
    } else if (sub === 'tenderstatus') {
      assign(c, 'tenderStatus');
    } else if (sub === 'contractstatus') {
      assign(c, 'contractStatus');
    } else if (sub.includes('retender') || (sub.includes('rootcause') && grp.includes('tender'))) {
      assign(c, 'rootCauseForRetendering');
    } else if (sub.includes('pend') || (sub.includes('rootcause') && grp.includes('contract'))) {
      assign(c, 'rootCauseForPend');
    } else if (sub.includes('rootcause')) {
      if (!usedKeys.has('rootCauseForRetendering')) assign(c, 'rootCauseForRetendering');
      else assign(c, 'rootCauseForPend');
    } else if (sub.includes('responsible')) {
      assign(c, 'responsibleBody');
    } else if (sub === 'edd' || sub.includes('estimateddelivery')) {
      assign(c, 'edd');
    } else if (sub.includes('remark') || sub.includes('note')) {
      assign(c, 'remark');
    }
  }

  return map;
}

function findHeaderRowIndex(aoa: any[][]): { subHeaderIdx: number; groupHeaderIdx: number } {
  const limit = Math.min(aoa.length, 20);
  let bestIdx = -1;
  let bestScore = 0;

  for (let r = 0; r < limit; r++) {
    const row = aoa[r] || [];
    const tokens = row.map(cell => normalizeCompact(cell));
    let score = 0;
    for (const t of tokens) {
      if (!t) continue;
      if (t.includes('materialcode')) score += 3;
      if (t.includes('materialdesc')) score += 3;
      if (t.includes('annualdemand')) score += 3;
      if (t.includes('stockonhand')) score += 2;
      if (t.includes('committed')) score += 2;
      if (t.includes('delivered')) score += 2;
      if (t.includes('unmet')) score += 2;
      if (t.includes('stockout')) score += 2;
      if (t.includes('pipeline')) score += 2;
      if (t.includes('responsible')) score += 2;
      if (t === 'edd') score += 2;
      if (t.includes('remark')) score += 2;
      if (t === 'sn' || t === 'unit' || t === 'qty' || t === 'po' || t === 'status') score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }

  if (bestIdx >= 0 && bestScore >= 4) {
    const prevIdx = bestIdx - 1;
    let groupHeaderIdx = -1;
    if (prevIdx >= 0) {
      const prevText = (aoa[prevIdx] || []).map(c => normalizeCompact(c)).join(' ');
      if (
        prevText.includes('supplyplan') ||
        prevText.includes('demandstatus') ||
        prevText.includes('tenderstatus') ||
        prevText.includes('contractstatus') ||
        prevText.includes('actionplan')
      ) {
        groupHeaderIdx = prevIdx;
      }
    }
    return { subHeaderIdx: bestIdx, groupHeaderIdx };
  }

  return { subHeaderIdx: -1, groupHeaderIdx: -1 };
}

function parseSupplyPlanMatrix(
  rawAoa: any[][],
  formattedAoa: any[][],
  ws: XLSX.WorkSheet | null,
  sourceFile?: string
): { records: SupplyPlanRecord[]; matchedHeaderCount: number; headerDetected: boolean } {
  const { subHeaderIdx, groupHeaderIdx } = findHeaderRowIndex(rawAoa);
  const maxCols = Math.max(
    21,
    ...rawAoa.slice(0, 25).map(r => (Array.isArray(r) ? r.length : 0))
  );

  let colMap: Map<number, SupplyPlanFieldKey>;
  let dataStartRow = 0;
  let headerDetected = false;

  if (subHeaderIdx >= 0) {
    headerDetected = true;
    const subHeaders = (rawAoa[subHeaderIdx] || []).map((c, idx) =>
      normalizeSpace(c || formattedAoa[subHeaderIdx]?.[idx] || '')
    );
    const rawGroupRow = groupHeaderIdx >= 0 ? rawAoa[groupHeaderIdx] || [] : [];
    const groupHeaders = groupHeaderIdx >= 0
      ? expandGroupRowWithMerges(ws, rawGroupRow, maxCols, groupHeaderIdx)
      : new Array<string>(maxCols).fill('');

    colMap = mapColumnsFromHeaders(subHeaders, groupHeaders);

    // Also fill any unmapped columns in 0..20 when sheet clearly matches standard 21-column order
    if (colMap.size >= 8 && (colMap.get(0) === 'sn' || colMap.get(1) === 'materialCode')) {
      for (let c = 0; c < POSITIONAL_KEYS.length; c++) {
        if (!colMap.has(c)) {
          const fallbackKey = POSITIONAL_KEYS[c];
          const alreadyAssigned = Array.from(colMap.values()).includes(fallbackKey);
          if (!alreadyAssigned) {
            colMap.set(c, fallbackKey);
          }
        }
      }
    }
    dataStartRow = subHeaderIdx + 1;
  } else {
    // Positional fallback: check if row 0 is a group row or header-less rows
    colMap = new Map<number, SupplyPlanFieldKey>();
    POSITIONAL_KEYS.forEach((k, idx) => colMap.set(idx, k));
    dataStartRow = 0;
  }

  const nowIso = new Date().toISOString();
  const records: SupplyPlanRecord[] = [];

  for (let r = dataStartRow; r < rawAoa.length; r++) {
    const rawRow = rawAoa[r] || [];
    const fmtRow = formattedAoa[r] || [];

    // Build key -> cell index lookup
    const getRaw = (key: SupplyPlanFieldKey): { raw: unknown; fmt: unknown } => {
      for (const [colIdx, mappedKey] of colMap.entries()) {
        if (mappedKey === key) {
          return { raw: rawRow[colIdx], fmt: fmtRow[colIdx] };
        }
      }
      return { raw: '', fmt: '' };
    };

    const snCell = getRaw('sn');
    const codeCell = getRaw('materialCode');
    const descCell = getRaw('materialDescription');
    const unitCell = getRaw('unit');
    const annualCell = getRaw('annualDemand');
    const sohCell = getRaw('stockOnHand');
    const committedCell = getRaw('committedQuantity');
    const deliveredCell = getRaw('deliveredQuantity');
    const unmetCell = getRaw('unmetDemand');
    const stockOutCell = getRaw('stockOutItems');
    const tenderQtyCell = getRaw('tenderQty');
    const tenderPoCell = getRaw('tenderPo');
    const tenderStatusCell = getRaw('tenderStatus');
    const retenderCell = getRaw('rootCauseForRetendering');
    const pipelineQtyCell = getRaw('pipelineQty');
    const contractPoCell = getRaw('contractPo');
    const contractStatusCell = getRaw('contractStatus');
    const pendCell = getRaw('rootCauseForPend');
    const respCell = getRaw('responsibleBody');
    const eddCell = getRaw('edd');
    const remarkCell = getRaw('remark');

    const materialCode = formatCellString(codeCell.raw, codeCell.fmt);
    const materialDescription = formatCellString(descCell.raw, descCell.fmt);
    const snStr = formatCellString(snCell.raw, snCell.fmt);
    const unit = formatCellString(unitCell.raw, unitCell.fmt);
    const tenderStatus = formatCellString(tenderStatusCell.raw, tenderStatusCell.fmt);
    const contractStatus = formatCellString(contractStatusCell.raw, contractStatusCell.fmt);
    const responsibleBody = formatCellString(respCell.raw, respCell.fmt);

    // Skip empty spacer rows or repeated total/header rows
    const rowTextLower = `${snStr} ${materialCode} ${materialDescription}`.trim().toLowerCase();
    if (
      !materialCode &&
      !materialDescription &&
      !tenderStatus &&
      !contractStatus &&
      !responsibleBody
    ) {
      continue;
    }
    if (
      rowTextLower === 's. n material code material description' ||
      /^total\b/i.test(materialCode) ||
      /^grand\s*total\b/i.test(materialDescription) ||
      /^total\b/i.test(snStr)
    ) {
      continue;
    }

    const rawStockOut = formatCellString(stockOutCell.raw, stockOutCell.fmt);
    const annualDemand = parseStrictNumber(annualCell.raw ?? annualCell.fmt);
    const stockOnHand = parseStrictNumber(sohCell.raw ?? sohCell.fmt);
    const committedQuantity = parseStrictNumber(committedCell.raw ?? committedCell.fmt);
    const deliveredQuantity = parseStrictNumber(deliveredCell.raw ?? deliveredCell.fmt);
    const unmetDemand = parseStrictNumber(unmetCell.raw ?? unmetCell.fmt);

    const record: SupplyPlanRecord = {
      id: `sp-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 7)}`,
      sn: snStr || records.length + 1,
      materialCode,
      materialDescription,
      unit,
      annualDemand,
      stockOnHand,
      committedQuantity,
      deliveredQuantity,
      unmetDemand,
      stockOutItems: rawStockOut,
      tenderQty: parseOptionalNumber(tenderQtyCell.raw ?? tenderQtyCell.fmt),
      tenderPo: formatPoString(tenderPoCell.raw, tenderPoCell.fmt),
      tenderStatus,
      rootCauseForRetendering: formatCellString(retenderCell.raw, retenderCell.fmt),
      pipelineQty: parseOptionalNumber(pipelineQtyCell.raw ?? pipelineQtyCell.fmt),
      contractPo: formatPoString(contractPoCell.raw, contractPoCell.fmt),
      contractStatus,
      rootCauseForPend: formatCellString(pendCell.raw, pendCell.fmt),
      responsibleBody,
      edd: formatEddString(eddCell.raw, eddCell.fmt),
      remark: formatCellString(remarkCell.raw, remarkCell.fmt),
      uploadedAt: nowIso,
      sourceFile: sourceFile || 'Uploaded Sheet'
    };

    records.push(record);
  }

  return {
    records,
    matchedHeaderCount: colMap.size,
    headerDetected
  };
}

function pickBestSupplyPlanSheet(wb: XLSX.WorkBook): string {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const preview = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true }).slice(0, 15);
    const { subHeaderIdx } = findHeaderRowIndex(preview);
    if (subHeaderIdx >= 0) return name;
  }
  const byName = wb.SheetNames.find(n => /supply\s*plan|cdss/i.test(n));
  return byName || wb.SheetNames[0] || '';
}

const EMPTY_FORM_RECORD: Omit<SupplyPlanRecord, 'id'> = {
  sn: '',
  materialCode: '',
  materialDescription: '',
  unit: 'Each',
  annualDemand: 0,
  stockOnHand: 0,
  committedQuantity: 0,
  deliveredQuantity: 0,
  unmetDemand: 0,
  stockOutItems: 'No',
  tenderQty: '',
  tenderPo: '',
  tenderStatus: '',
  rootCauseForRetendering: '',
  pipelineQty: '',
  contractPo: '',
  contractStatus: '',
  rootCauseForPend: '',
  responsibleBody: '',
  edd: '',
  remark: ''
};

export const SupplyPlanManagementView: React.FC<SupplyPlanManagementViewProps> = ({
  records = [],
  onUploadRecords,
  onClearRecords,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  isAdmin = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockOutFilter, setStockOutFilter] = useState<'all' | 'Yes' | 'No'>('all');
  const [tenderStatusFilter, setTenderStatusFilter] = useState<string>('all');
  const [contractStatusFilter, setContractStatusFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<SupplyPlanRecord[]>([]);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add / Edit / Dossier / Clear confirmations
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SupplyPlanRecord | null>(null);
  const [formState, setFormState] = useState<Omit<SupplyPlanRecord, 'id'>>(EMPTY_FORM_RECORD);
  const [inspectRecord, setInspectRecord] = useState<SupplyPlanRecord | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Filter options derived from uploaded records
  const uniqueTenderStatuses = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => { if (r.tenderStatus) s.add(r.tenderStatus.trim()); });
    return Array.from(s).sort();
  }, [records]);

  const uniqueContractStatuses = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => { if (r.contractStatus) s.add(r.contractStatus.trim()); });
    return Array.from(s).sort();
  }, [records]);

  const uniqueResponsibleBodies = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => { if (r.responsibleBody) s.add(r.responsibleBody.trim()); });
    return Array.from(s).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter(r => {
      if (stockOutFilter !== 'all') {
        const val = (r.stockOutItems || '').trim().toLowerCase();
        if (stockOutFilter === 'Yes' && val !== 'yes') return false;
        if (stockOutFilter === 'No' && val !== 'no') return false;
      }
      if (tenderStatusFilter !== 'all' && (r.tenderStatus || '').trim() !== tenderStatusFilter) {
        return false;
      }
      if (contractStatusFilter !== 'all' && (r.contractStatus || '').trim() !== contractStatusFilter) {
        return false;
      }
      if (responsibleFilter !== 'all' && (r.responsibleBody || '').trim() !== responsibleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(r.sn ?? '').toLowerCase().includes(q) ||
        (r.materialCode || '').toLowerCase().includes(q) ||
        (r.materialDescription || '').toLowerCase().includes(q) ||
        (r.unit || '').toLowerCase().includes(q) ||
        (r.tenderPo || '').toLowerCase().includes(q) ||
        (r.tenderStatus || '').toLowerCase().includes(q) ||
        (r.rootCauseForRetendering || '').toLowerCase().includes(q) ||
        (r.contractPo || '').toLowerCase().includes(q) ||
        (r.contractStatus || '').toLowerCase().includes(q) ||
        (r.rootCauseForPend || '').toLowerCase().includes(q) ||
        (r.responsibleBody || '').toLowerCase().includes(q) ||
        (r.edd || '').toLowerCase().includes(q) ||
        (r.remark || '').toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, stockOutFilter, tenderStatusFilter, contractStatusFilter, responsibleFilter]);

  const totals = useMemo(() => {
    let annualDemand = 0;
    let stockOnHand = 0;
    let committedQuantity = 0;
    let deliveredQuantity = 0;
    let unmetDemand = 0;
    let stockOutYesCount = 0;
    let tenderQty = 0;
    let pipelineQty = 0;

    filteredRecords.forEach(r => {
      annualDemand += Number(r.annualDemand) || 0;
      stockOnHand += Number(r.stockOnHand) || 0;
      committedQuantity += Number(r.committedQuantity) || 0;
      deliveredQuantity += Number(r.deliveredQuantity) || 0;
      unmetDemand += Number(r.unmetDemand) || 0;
      if ((r.stockOutItems || '').trim().toLowerCase() === 'yes') {
        stockOutYesCount += 1;
      }
      if (typeof r.tenderQty === 'number') tenderQty += r.tenderQty;
      if (typeof r.pipelineQty === 'number') pipelineQty += r.pipelineQty;
    });

    return {
      annualDemand,
      stockOnHand,
      committedQuantity,
      deliveredQuantity,
      unmetDemand,
      stockOutYesCount,
      tenderQty,
      pipelineQty
    };
  }, [filteredRecords]);

  // Parse selected sheet of loaded workbook
  const parseWorkbookSheet = (wb: XLSX.WorkBook, sheetName: string, fileName: string) => {
    setParseError(null);
    setParseNotice(null);
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setParsedPreview([]);
      setParseError(`Sheet "${sheetName}" could not be read.`);
      return;
    }
    const rawAoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
    const formattedAoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
    const result = parseSupplyPlanMatrix(rawAoa, formattedAoa, ws, fileName);

    if (result.records.length === 0) {
      setParsedPreview([]);
      setParseError('No supply plan data rows were detected in this sheet. Verify the MD CDSS Supply Plan headers and rows.');
      return;
    }

    setParsedPreview(result.records);
    setParseNotice(
      result.headerDetected
        ? `Detected 21-column MD CDSS Supply Plan headers (${result.matchedHeaderCount} mapped columns) and ${result.records.length} data rows.`
        : `Parsed ${result.records.length} rows using positional 21-column MD CDSS Supply Plan layout.`
    );
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setParseError(null);
    setParseNotice(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const bestSheet = pickBestSupplyPlanSheet(wb);
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(bestSheet);
      parseWorkbookSheet(wb, bestSheet, file.name);
    } catch (err: any) {
      setParsedPreview([]);
      setParseError(err?.message || 'Failed to read spreadsheet file.');
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookRef) {
      parseWorkbookSheet(workbookRef, sheetName, selectedFileName || 'Uploaded Sheet');
    }
  };

  const handleParsePastedText = (text: string) => {
    setPastedText(text);
    setParseError(null);
    setParseNotice(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedPreview([]);
      return;
    }
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
    const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
    const aoa = lines.map(line =>
      delimiter === '\t'
        ? line.split('\t')
        : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'))
    );
    const result = parseSupplyPlanMatrix(aoa, aoa, null, 'Pasted Table');
    if (result.records.length === 0) {
      setParsedPreview([]);
      setParseError('Could not extract Supply Plan rows from pasted text.');
      return;
    }
    setParsedPreview(result.records);
    setParseNotice(`Parsed ${result.records.length} rows from pasted data.`);
  };

  const handleConfirmUpload = () => {
    if (parsedPreview.length === 0) return;
    onUploadRecords?.(parsedPreview, uploadMode, selectedFileName || 'MD CDSS Supply Plan');
    setIsUploadModalOpen(false);
    setParsedPreview([]);
    setWorkbookRef(null);
    setSheetNames([]);
    setSelectedSheet('');
    setSelectedFileName('');
    setPastedText('');
    setParseNotice(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadOfficialTemplate = () => {
    const sampleRow = [
      1,
      '401-BEDP-',
      'Bed - Patient,',
      'Each',
      620,
      96,
      305,
      47,
      -258,
      'No',
      1173,
      '4500012345',
      'Sent to CMD',
      '',
      372,
      '4500012345',
      'Waiting',
      '',
      'PMD & CMD',
      'End of January',
      ''
    ];
    const ws = XLSX.utils.aoa_to_sheet([GROUP_ROW_EXPORT, SUB_HEADER_ROW_EXPORT, sampleRow]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 0, c: 9 } },
      { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } },
      { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
      { s: { r: 0, c: 18 }, e: { r: 0, c: 19 } }
    ];
    ws['!cols'] = [
      { wch: 7 },  // S. N
      { wch: 15 }, // Material Code
      { wch: 28 }, // Material Description
      { wch: 8 },  // Unit
      { wch: 14 }, // Annual Demand
      { wch: 14 }, // Stock On Hand
      { wch: 16 }, // Committed Quantity
      { wch: 16 }, // Delivered Quantity
      { wch: 14 }, // Unmet Demand
      { wch: 14 }, // Stock Out Items
      { wch: 10 }, // Qty
      { wch: 16 }, // PO
      { wch: 18 }, // Status
      { wch: 24 }, // Root cause For Retendering
      { wch: 13 }, // Pipeline Qty
      { wch: 16 }, // PO
      { wch: 18 }, // Status
      { wch: 22 }, // Root cause for Pend
      { wch: 18 }, // Responsible Body
      { wch: 16 }, // EDD
      { wch: 20 }  // Remark
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MD CDSS Supply Plan');
    XLSX.writeFile(wb, 'MD_CDSS_Supply_Plan_Template.xlsx');
  };

  const handleExportExcel = () => {
    const dataRows = filteredRecords.map((r, idx) => [
      r.sn !== '' && r.sn !== undefined ? r.sn : idx + 1,
      r.materialCode,
      r.materialDescription,
      r.unit,
      r.annualDemand,
      r.stockOnHand,
      r.committedQuantity,
      r.deliveredQuantity,
      r.unmetDemand,
      r.stockOutItems,
      r.tenderQty === '' ? '' : r.tenderQty,
      r.tenderPo,
      r.tenderStatus,
      r.rootCauseForRetendering,
      r.pipelineQty === '' ? '' : r.pipelineQty,
      r.contractPo,
      r.contractStatus,
      r.rootCauseForPend,
      r.responsibleBody,
      r.edd,
      r.remark
    ]);
    const ws = XLSX.utils.aoa_to_sheet([GROUP_ROW_EXPORT, SUB_HEADER_ROW_EXPORT, ...dataRows]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 0, c: 9 } },
      { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } },
      { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
      { s: { r: 0, c: 18 }, e: { r: 0, c: 19 } }
    ];
    ws['!cols'] = [
      { wch: 7 }, { wch: 15 }, { wch: 30 }, { wch: 9 },
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 11 }, { wch: 16 }, { wch: 18 }, { wch: 24 },
      { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 22 },
      { wch: 18 }, { wch: 16 }, { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MD CDSS Supply Plan');
    XLSX.writeFile(wb, `MD_CDSS_Supply_Plan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const csvRows = filteredRecords.map((r, idx) => ({
      'S. N': r.sn !== '' && r.sn !== undefined ? r.sn : idx + 1,
      'Material Code': r.materialCode,
      'Material Description': r.materialDescription,
      'Unit': r.unit,
      'Annual Demand': r.annualDemand,
      'Stock On Hand': r.stockOnHand,
      'Committed Quantity': r.committedQuantity,
      'Delivered Quantity': r.deliveredQuantity,
      'Unmet Demand': r.unmetDemand,
      'Stock Out Items': r.stockOutItems,
      'Tender Qty': r.tenderQty,
      'Tender PO': r.tenderPo,
      'Tender Status': r.tenderStatus,
      'Root cause For Retendering': r.rootCauseForRetendering,
      'Pipeline Qty': r.pipelineQty,
      'Contract PO': r.contractPo,
      'Contract Status': r.contractStatus,
      'Root cause for Pend': r.rootCauseForPend,
      'Responsible Body': r.responsibleBody,
      'EDD': r.edd,
      'Remark': r.remark
    }));
    downloadCSV(`MD_CDSS_Supply_Plan_${new Date().toISOString().split('T')[0]}.csv`, csvRows);
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setFormState({
      ...EMPTY_FORM_RECORD,
      sn: records.length + 1
    });
    setIsAddEditOpen(true);
  };

  const openEditModal = (rec: SupplyPlanRecord) => {
    setEditingRecord(rec);
    const { id: _id, uploadedAt: _up, sourceFile: _sf, ...rest } = rec;
    setFormState(rest);
    setIsAddEditOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      onUpdateRecord?.({
        ...editingRecord,
        ...formState
      });
    } else {
      onAddRecord?.({
        id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...formState,
        uploadedAt: new Date().toISOString(),
        sourceFile: 'Manual Entry'
      });
    }
    setIsAddEditOpen(false);
    setEditingRecord(null);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStockOutFilter('all');
    setTenderStatusFilter('all');
    setContractStatusFilter('all');
    setResponsibleFilter('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    stockOutFilter !== 'all' ||
    tenderStatusFilter !== 'all' ||
    contractStatusFilter !== 'all' ||
    responsibleFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Top Banner & Action Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                MD CDSS Supply Plan Management
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 font-mono">
                {records.length} {records.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              21-column structured tracking across Demand Status, Tender Status, Contract Status, Action Plan, and Remarks.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setParseError(null);
              setParseNotice(null);
              setIsUploadModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel / CSV</span>
          </button>

          <button
            onClick={handleDownloadOfficialTemplate}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
            <span>Download Template</span>
          </button>

          {records.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel</span>
              </button>
              <button
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
                  onClick={() => {
                    onClearRecords();
                    setConfirmClearAll(false);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Supply Items</span>
            <Boxes className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">{formatNumber(filteredRecords.length)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">of {records.length} uploaded</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Annual Demand</span>
            <ClipboardList className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">{formatNumber(totals.annualDemand)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">SOH: {formatNumber(totals.stockOnHand)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Delivered Qty</span>
            <PackageCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-teal-700 mt-1 tabular-nums">{formatNumber(totals.deliveredQuantity)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Committed: {formatNumber(totals.committedQuantity)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Unmet / Stock Out</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-700 mt-1 tabular-nums">{formatNumber(totals.unmetDemand)}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">{totals.stockOutYesCount} Stock-Out (Yes)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Tender Qty</span>
            <ShoppingCart className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-black text-sky-700 mt-1 tabular-nums">{formatNumber(totals.tenderQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active tender volume</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Pipeline Qty</span>
            <FileCheck2 className="w-4 h-4 text-lime-700" />
          </div>
          <div className="text-xl font-black text-lime-800 mt-1 tabular-nums">{formatNumber(totals.pipelineQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contract pipeline</div>
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
            placeholder="Search material code, description, PO, status, root cause, body, EDD, remark..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={stockOutFilter}
            onChange={(e) => setStockOutFilter(e.target.value as 'all' | 'Yes' | 'No')}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="all">Stock Out: All</option>
            <option value="Yes">Stock Out: Yes</option>
            <option value="No">Stock Out: No</option>
          </select>

          <select
            value={tenderStatusFilter}
            onChange={(e) => setTenderStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 max-w-[180px]"
          >
            <option value="all">Tender Status: All</option>
            {uniqueTenderStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={contractStatusFilter}
            onChange={(e) => setContractStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 max-w-[180px]"
          >
            <option value="all">Contract Status: All</option>
            {uniqueContractStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 max-w-[180px]"
          >
            <option value="all">Responsible Body: All</option>
            {uniqueResponsibleBodies.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Exact 21-Column Two-Tier Supply Plan Matrix Table */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              {/* TIER 1: GROUP HEADERS */}
              <tr className="border-b border-slate-400 font-extrabold text-slate-950 text-center">
                <th
                  colSpan={4}
                  className="py-2 px-3 bg-amber-300 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  MD CDSS Supply Plan
                </th>
                <th
                  colSpan={6}
                  className="py-2 px-3 bg-emerald-100 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  Demand Status
                </th>
                <th
                  colSpan={4}
                  className="py-2 px-3 bg-sky-200 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  Tender Status
                </th>
                <th
                  colSpan={4}
                  className="py-2 px-3 bg-lime-200 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  Contract Status
                </th>
                <th
                  colSpan={2}
                  className="py-2 px-3 bg-blue-300 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  Action Plan
                </th>
                <th
                  colSpan={1}
                  className="py-2 px-3 bg-amber-200 border-r border-slate-400 tracking-wide whitespace-nowrap"
                >
                  &nbsp;
                </th>
                <th
                  rowSpan={2}
                  className="py-2 px-2.5 bg-slate-100 border-b border-slate-400 text-[11px] font-bold text-slate-700 text-center whitespace-nowrap"
                >
                  Actions
                </th>
              </tr>

              {/* TIER 2: EXACT 21 SUB-COLUMN HEADERS */}
              <tr className="border-b-2 border-slate-400 text-[11px] font-bold text-slate-950">
                {/* Group 1: MD CDSS Supply Plan (Pink/Rose Tint) */}
                <th className="py-2 px-2.5 bg-rose-100 border-r border-slate-300 text-center whitespace-nowrap">S. N</th>
                <th className="py-2 px-2.5 bg-rose-100 border-r border-slate-300 text-left whitespace-nowrap">Material Code</th>
                <th className="py-2 px-2.5 bg-rose-100 border-r border-slate-300 text-left min-w-[200px]">Material Description</th>
                <th className="py-2 px-2.5 bg-rose-100 border-r border-slate-400 text-left whitespace-nowrap">Unit</th>

                {/* Group 2: Demand Status (Pale Green Tint) */}
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-300 text-right whitespace-nowrap">Annual Demand</th>
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-300 text-right whitespace-nowrap">Stock On Hand</th>
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-300 text-right whitespace-nowrap">Committed Quantity</th>
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-300 text-right whitespace-nowrap">Delivered Quantity</th>
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-300 text-right whitespace-nowrap">Unmet Demand</th>
                <th className="py-2 px-2.5 bg-emerald-50 border-r border-slate-400 text-center whitespace-nowrap">Stock Out Items</th>

                {/* Group 3: Tender Status (Light Sky Tint) */}
                <th className="py-2 px-2.5 bg-sky-100 border-r border-slate-300 text-right whitespace-nowrap">Qty</th>
                <th className="py-2 px-2.5 bg-sky-100 border-r border-slate-300 text-left whitespace-nowrap">PO</th>
                <th className="py-2 px-2.5 bg-sky-100 border-r border-slate-300 text-left whitespace-nowrap min-w-[130px]">Status</th>
                <th className="py-2 px-2.5 bg-sky-100 border-r border-slate-400 text-left min-w-[160px]">Root cause For Retendering</th>

                {/* Group 4: Contract Status (Light Lime Tint) */}
                <th className="py-2 px-2.5 bg-lime-100/70 border-r border-slate-300 text-right whitespace-nowrap">Pipeline Qty</th>
                <th className="py-2 px-2.5 bg-lime-100/70 border-r border-slate-300 text-left whitespace-nowrap">PO</th>
                <th className="py-2 px-2.5 bg-lime-100/70 border-r border-slate-300 text-left whitespace-nowrap min-w-[130px]">Status</th>
                <th className="py-2 px-2.5 bg-lime-100/70 border-r border-slate-400 text-left min-w-[150px]">Root cause for Pend</th>

                {/* Group 5: Action Plan (Blue Tint) */}
                <th className="py-2 px-2.5 bg-blue-200/80 border-r border-slate-300 text-left whitespace-nowrap">Responsible Body</th>
                <th className="py-2 px-2.5 bg-blue-200/80 border-r border-slate-400 text-left whitespace-nowrap">EDD</th>

                {/* Remark */}
                <th className="py-2 px-2.5 bg-amber-200 border-r border-slate-400 text-left min-w-[150px]">Remark</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-900">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={22} className="py-12 px-6 text-center bg-slate-50/70">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        No Supply Plan Data Uploaded Yet
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Upload your MD CDSS Supply Plan Excel or CSV file matching the 21 two-tier columns (MD CDSS Supply Plan, Demand Status, Tender Status, Contract Status, Action Plan, and Remark) to populate this table.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          onClick={() => setIsUploadModalOpen(true)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Supply Plan</span>
                        </button>
                        <button
                          onClick={handleDownloadOfficialTemplate}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Template (.xlsx)</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={22} className="py-10 text-center text-slate-500">
                    No Supply Plan rows match the active search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const isStockOutYes = (row.stockOutItems || '').trim().toLowerCase() === 'yes';
                  const isStockOutNo = (row.stockOutItems || '').trim().toLowerCase() === 'no';
                  const isTenderSentTo = /sent\s*to/i.test(row.tenderStatus || '');
                  const isContractSentTo = /sent\s*to|delivered|completed/i.test(row.contractStatus || '');

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 transition-colors border-b border-slate-200"
                    >
                      <td className="py-2 px-2.5 border-r border-slate-200 text-center font-mono text-slate-700 tabular-nums">
                        {row.sn !== '' && row.sn !== undefined ? row.sn : idx + 1}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.materialCode || '—'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 font-medium text-slate-900">
                        {row.materialDescription || '—'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-slate-700 whitespace-nowrap">
                        {row.unit || '—'}
                      </td>

                      {/* Demand Status */}
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {formatNumber(row.annualDemand)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {formatNumber(row.stockOnHand)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {formatNumber(row.committedQuantity)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {formatNumber(row.deliveredQuantity)}
                      </td>
                      <td
                        className={`py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold tabular-nums ${
                          row.unmetDemand < 0 ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {formatNumber(row.unmetDemand)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center whitespace-nowrap">
                        {row.stockOutItems ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isStockOutYes
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isStockOutNo
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.stockOutItems}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Tender Status */}
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {row.tenderQty === '' || row.tenderQty === undefined ? '' : formatNumber(row.tenderQty)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                        {row.tenderPo}
                      </td>
                      <td
                        className={`py-2 px-2.5 border-r border-slate-200 font-semibold whitespace-nowrap ${
                          isTenderSentTo ? 'bg-emerald-100/80 text-emerald-900' : 'text-slate-800'
                        }`}
                      >
                        {row.tenderStatus}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-slate-700">
                        {row.rootCauseForRetendering}
                      </td>

                      {/* Contract Status */}
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                        {row.pipelineQty === '' || row.pipelineQty === undefined ? '' : formatNumber(row.pipelineQty)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                        {row.contractPo}
                      </td>
                      <td
                        className={`py-2 px-2.5 border-r border-slate-200 font-semibold whitespace-nowrap ${
                          isContractSentTo ? 'bg-emerald-100/80 text-emerald-900' : 'text-slate-800'
                        }`}
                      >
                        {row.contractStatus}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-slate-700">
                        {row.rootCauseForPend}
                      </td>

                      {/* Action Plan */}
                      <td className="py-2 px-2.5 border-r border-slate-200 font-semibold text-slate-800 whitespace-nowrap">
                        {row.responsibleBody}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-slate-800 whitespace-nowrap">
                        {row.edd}
                      </td>

                      {/* Remark */}
                      <td className="py-2 px-2.5 border-r border-slate-300 text-slate-700">
                        {row.remark}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setInspectRecord(row)}
                            title="View Full Dossier"
                            className="p-1 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(row)}
                                title="Edit Row"
                                className="p-1 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteRecord?.(row.id)}
                                title="Delete Row"
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-extrabold text-slate-900">
                  <td colSpan={4} className="py-2.5 px-3 border-r border-slate-300 text-right uppercase text-[11px] tracking-wider">
                    Totals ({filteredRecords.length} Items):
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.annualDemand)}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.stockOnHand)}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.committedQuantity)}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.deliveredQuantity)}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono text-rose-700 tabular-nums">
                    {formatNumber(totals.unmetDemand)}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 text-center text-[11px]">
                    {totals.stockOutYesCount} Yes
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.tenderQty)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-2.5 border-r border-slate-300" />
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums">
                    {formatNumber(totals.pipelineQty)}
                  </td>
                  <td colSpan={7} className="py-2.5 px-2.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Upload Excel / CSV / Paste Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Upload MD CDSS Supply Plan Data
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Supports the exact 21-column two-tier Excel (.xlsx/.xls) or CSV format
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Source Tabs + Mode Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setUploadTab('file')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      uploadTab === 'file'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Upload Excel / CSV File
                  </button>
                  <button
                    onClick={() => setUploadTab('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      uploadTab === 'paste'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Paste from Excel
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">Import Mode:</span>
                  <select
                    value={uploadMode}
                    onChange={(e) => setUploadMode(e.target.value as 'replace' | 'append')}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  >
                    <option value="replace">Replace Existing Supply Plan</option>
                    <option value="append">Append to Existing Records</option>
                  </select>
                </div>
              </div>

              {uploadTab === 'file' ? (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 rounded-2xl p-6 cursor-pointer transition">
                    <Upload className="w-7 h-7 text-indigo-600 mb-2" />
                    <span className="text-xs font-bold text-slate-800">
                      {selectedFileName ? `Selected: ${selectedFileName}` : 'Click to select MD CDSS Supply Plan (.xlsx, .xls, .csv)'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Automatically reads merged group headers (MD CDSS Supply Plan, Demand Status, Tender Status, Contract Status, Action Plan, Remark)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                  </label>

                  {sheetNames.length > 1 && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-slate-700">Worksheet Tab:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                      >
                        {sheetNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => handleParsePastedText(e.target.value)}
                    placeholder="Copy the 21 columns (including the headers) directly from Excel and paste here..."
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              )}

              {parseNotice && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{parseNotice}</span>
                </div>
              )}

              {parseError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Preview (Showing first {Math.min(10, parsedPreview.length)} of {parsedPreview.length} rows)</span>
                    <span className="font-mono text-indigo-700">21 Columns Mapped</span>
                  </div>
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                          <th className="py-1.5 px-2 border-r border-slate-200">S. N</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Material Code</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Material Description</th>
                          <th className="py-1.5 px-2 border-r border-slate-200">Unit</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Annual Demand</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">SOH</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Committed</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Delivered</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Unmet</th>
                          <th className="py-1.5 px-2 border-r border-slate-200">Stock Out</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Tender Qty</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Tender PO</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Tender Status</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-right">Pipeline Qty</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Contract PO</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Contract Status</th>
                          <th className="py-1.5 px-2 border-r border-slate-200 text-left">Responsible Body</th>
                          <th className="py-1.5 px-2 text-left">EDD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.slice(0, 10).map((row) => (
                          <tr key={row.id}>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-center font-mono">{row.sn}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 font-mono">{row.materialCode}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100">{row.materialDescription}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-center">{row.unit}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.annualDemand}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.stockOnHand}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.committedQuantity}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.deliveredQuantity}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.unmetDemand}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-center">{row.stockOutItems}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.tenderQty}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 font-mono">{row.tenderPo}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100">{row.tenderStatus}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 text-right font-mono">{row.pipelineQty}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100 font-mono">{row.contractPo}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100">{row.contractStatus}</td>
                            <td className="py-1.5 px-2 border-r border-slate-100">{row.responsibleBody}</td>
                            <td className="py-1.5 px-2">{row.edd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={parsedPreview.length === 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save {parsedPreview.length > 0 ? `${parsedPreview.length} Rows` : 'Supply Plan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supply Plan Row Modal */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveForm}
            className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingRecord ? `Edit Supply Plan Item: ${editingRecord.materialCode}` : 'Add Supply Plan Item'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Group 1: MD CDSS Supply Plan */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">MD CDSS Supply Plan</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">S. N</label>
                    <input
                      type="text"
                      value={formState.sn}
                      onChange={e => setFormState({ ...formState, sn: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Material Code</label>
                    <input
                      type="text"
                      value={formState.materialCode}
                      onChange={e => setFormState({ ...formState, materialCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Material Description</label>
                    <input
                      type="text"
                      required
                      value={formState.materialDescription}
                      onChange={e => setFormState({ ...formState, materialDescription: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={formState.unit}
                      onChange={e => setFormState({ ...formState, unit: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Demand Status */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider">Demand Status</div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Annual Demand</label>
                    <input
                      type="number"
                      value={formState.annualDemand}
                      onChange={e => setFormState({ ...formState, annualDemand: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Stock On Hand</label>
                    <input
                      type="number"
                      value={formState.stockOnHand}
                      onChange={e => setFormState({ ...formState, stockOnHand: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Committed Qty</label>
                    <input
                      type="number"
                      value={formState.committedQuantity}
                      onChange={e => setFormState({ ...formState, committedQuantity: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Delivered Qty</label>
                    <input
                      type="number"
                      value={formState.deliveredQuantity}
                      onChange={e => setFormState({ ...formState, deliveredQuantity: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Unmet Demand</label>
                    <input
                      type="number"
                      value={formState.unmetDemand}
                      onChange={e => setFormState({ ...formState, unmetDemand: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Stock Out Items</label>
                    <select
                      value={formState.stockOutItems}
                      onChange={e => setFormState({ ...formState, stockOutItems: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 3: Tender Status */}
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                <div className="text-[11px] font-extrabold text-sky-900 uppercase tracking-wider">Tender Status</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Qty</label>
                    <input
                      type="number"
                      value={formState.tenderQty}
                      onChange={e => setFormState({ ...formState, tenderQty: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">PO</label>
                    <input
                      type="text"
                      value={formState.tenderPo}
                      onChange={e => setFormState({ ...formState, tenderPo: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <input
                      type="text"
                      value={formState.tenderStatus}
                      onChange={e => setFormState({ ...formState, tenderStatus: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Root cause For Retendering</label>
                    <input
                      type="text"
                      value={formState.rootCauseForRetendering}
                      onChange={e => setFormState({ ...formState, rootCauseForRetendering: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Contract Status */}
              <div className="p-3.5 rounded-xl bg-lime-50/70 border border-lime-200 space-y-3">
                <div className="text-[11px] font-extrabold text-lime-900 uppercase tracking-wider">Contract Status</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pipeline Qty</label>
                    <input
                      type="number"
                      value={formState.pipelineQty}
                      onChange={e => setFormState({ ...formState, pipelineQty: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">PO</label>
                    <input
                      type="text"
                      value={formState.contractPo}
                      onChange={e => setFormState({ ...formState, contractPo: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <input
                      type="text"
                      value={formState.contractStatus}
                      onChange={e => setFormState({ ...formState, contractStatus: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Root cause for Pend</label>
                    <input
                      type="text"
                      value={formState.rootCauseForPend}
                      onChange={e => setFormState({ ...formState, rootCauseForPend: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Group 5: Action Plan & Remark */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
                <div className="text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">Action Plan & Remark</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Responsible Body</label>
                    <input
                      type="text"
                      value={formState.responsibleBody}
                      onChange={e => setFormState({ ...formState, responsibleBody: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">EDD</label>
                    <input
                      type="text"
                      value={formState.edd}
                      onChange={e => setFormState({ ...formState, edd: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Remark</label>
                    <input
                      type="text"
                      value={formState.remark}
                      onChange={e => setFormState({ ...formState, remark: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                {editingRecord ? 'Save Changes' : 'Add Supply Plan Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full 21-Column Row Dossier Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Supply Plan Item Dossier — {inspectRecord.materialCode || inspectRecord.sn}
                </h3>
                <p className="text-[11px] text-slate-500">{inspectRecord.materialDescription}</p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                <div><span className="text-[10px] font-bold text-slate-500 block">S. N</span><span className="font-mono font-bold">{inspectRecord.sn}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">MATERIAL CODE</span><span className="font-mono font-bold">{inspectRecord.materialCode || '—'}</span></div>
                <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold text-slate-500 block">UNIT</span><span className="font-semibold">{inspectRecord.unit || '—'}</span></div>
                <div className="col-span-2 sm:col-span-4"><span className="text-[10px] font-bold text-slate-500 block">MATERIAL DESCRIPTION</span><span className="font-bold text-slate-900">{inspectRecord.materialDescription}</span></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                <div><span className="text-[10px] font-bold text-slate-500 block">ANNUAL DEMAND</span><span className="font-mono font-bold">{formatNumber(inspectRecord.annualDemand)}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">STOCK ON HAND</span><span className="font-mono font-bold">{formatNumber(inspectRecord.stockOnHand)}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">COMMITTED QUANTITY</span><span className="font-mono font-bold">{formatNumber(inspectRecord.committedQuantity)}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">DELIVERED QUANTITY</span><span className="font-mono font-bold">{formatNumber(inspectRecord.deliveredQuantity)}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">UNMET DEMAND</span><span className="font-mono font-bold text-rose-700">{formatNumber(inspectRecord.unmetDemand)}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">STOCK OUT ITEMS</span><span className="font-bold">{inspectRecord.stockOutItems || '—'}</span></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-extrabold text-sky-900 uppercase">Tender Status</div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">QTY</span><span className="font-mono font-bold">{inspectRecord.tenderQty === '' ? '—' : formatNumber(inspectRecord.tenderQty)}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">PO</span><span className="font-mono">{inspectRecord.tenderPo || '—'}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">STATUS</span><span className="font-semibold">{inspectRecord.tenderStatus || '—'}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">ROOT CAUSE FOR RETENDERING</span><span>{inspectRecord.rootCauseForRetendering || '—'}</span></div>
                </div>

                <div className="bg-lime-50/70 border border-lime-200 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-extrabold text-lime-900 uppercase">Contract Status</div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">PIPELINE QTY</span><span className="font-mono font-bold">{inspectRecord.pipelineQty === '' ? '—' : formatNumber(inspectRecord.pipelineQty)}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">PO</span><span className="font-mono">{inspectRecord.contractPo || '—'}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">STATUS</span><span className="font-semibold">{inspectRecord.contractStatus || '—'}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-500 block">ROOT CAUSE FOR PEND</span><span>{inspectRecord.rootCauseForPend || '—'}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                <div><span className="text-[10px] font-bold text-slate-500 block">RESPONSIBLE BODY</span><span className="font-semibold">{inspectRecord.responsibleBody || '—'}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">EDD</span><span className="font-semibold">{inspectRecord.edd || '—'}</span></div>
                <div><span className="text-[10px] font-bold text-slate-500 block">REMARK</span><span>{inspectRecord.remark || '—'}</span></div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              {isAdmin && (
                <button
                  onClick={() => {
                    const target = inspectRecord;
                    setInspectRecord(null);
                    openEditModal(target);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  Edit Row
                </button>
              )}
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
