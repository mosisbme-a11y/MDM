import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Boxes,
  ClipboardPaste,
  FileText,
  Trash2,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MultipleStockRecord } from '../types';
import { downloadCSV, formatCurrency, formatNumber } from '../utils/formatters';
import { uploadAndRecordFile } from '../utils/fileUploadService';
import { supabase } from '../lib/supabase';

export interface MultipleStockUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadMultipleStockData: (items: MultipleStockRecord[], mode: 'replace' | 'append', files?: { name: string, url: string }[]) => void;
  initialItems?: MultipleStockRecord[];
  initialFileName?: string;
}

export function parseMultipleStockRows(rawRows: any[], sourceName: string = 'Upload'): MultipleStockRecord[] {
  if (!rawRows || rawRows.length === 0) return [];

  const cleanKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const items: MultipleStockRecord[] = [];
  const timestamp = Date.now();

  const getStr = (rowMap: Record<string, any>, keys: string[], fallback: string = ''): string => {
    for (const k of keys) {
      if (rowMap[k] !== undefined && rowMap[k] !== null && String(rowMap[k]).trim() !== '') {
        return String(rowMap[k]).trim();
      }
    }
    return fallback;
  };

  const getNum = (rowMap: Record<string, any>, keys: string[], fallback: number = 0): number => {
    for (const k of keys) {
      if (rowMap[k] !== undefined && rowMap[k] !== null && String(rowMap[k]).trim() !== '') {
        const val = rowMap[k];
        if (typeof val === 'number') return isNaN(val) ? fallback : val;
        const cleaned = String(val).replace(/,/g, '').trim();
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return fallback;
  };

  rawRows.forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const hasAnyContent = Object.values(row).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!hasAnyContent) return;

    const rowMap: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      rowMap[cleanKey(k)] = row[k];
    });

    // 1. Material
    const rawMaterial = getStr(rowMap, [
      'material',
      'materialcode',
      'materialno',
      'materialnumber',
      'matnr',
      'itemcode',
      'productcode',
      'sapcode',
      'sku',
      'code'
    ], '');
    const material = rawMaterial || `MAT-${String(index + 1).padStart(5, '0')}`;

    // 2. Material Description
    const rawDesc = getStr(rowMap, [
      'materialdescription',
      'materialdesc',
      'itemdescription',
      'itemdesc',
      'product',
      'productname',
      'description',
      'devicename',
      'item'
    ], '');
    const materialDescription = rawDesc || `Medical Device Equipment (${material})`;

    // 3. Plant
    const plant = getStr(rowMap, [
      'plant',
      'plantcode',
      'deliveringplant',
      'hub',
      'branch',
      'location'
    ], 'HO01').toUpperCase();

    // 4. Storage Location
    const storageLocation = getStr(rowMap, [
      'storagelocation',
      'storageloc',
      'storage_location',
      'warehouse',
      'wh',
      'sloc',
      'location',
      'store'
    ], 'Central Store');

    // 5. Special Stock Type / Funding Stream (RDF vs HP)
    // Excel SAP EPSS Standard:
    // 'Q' under Special Stock Type = Health Program (HP)
    // Blank under Special Stock Type = Revolving Drug Fund (RDF)
    const rawSpecialStock = getStr(rowMap, [
      'specialstocktype',
      'special_stock_type',
      'specialstock',
      'stocktype',
      'special'
    ], '').trim();

    let specialStockType = '';
    if (rawSpecialStock.toUpperCase() === 'Q' || rawSpecialStock.toUpperCase().startsWith('Q') || /\b(hp|health\s*program|program|project)\b/i.test(rawSpecialStock)) {
      specialStockType = 'Q';
    } else {
      // Excel Standard: Blank / empty under Special Stock Type represents Revolving Drug Fund (RDF)
      specialStockType = '';
    }

    // 6. Unrestricted Stock
    const unrestrictedStock = getNum(rowMap, [
      'unrestrictedstock',
      'unrestricted',
      'unrestrictedqty',
      'unrestrictedquantity',
      'qty',
      'quantity',
      'available',
      'availablestock',
      'soh'
    ], 0);

    // 7. Stock in Quality Inspection
    const stockInQualityInspection = getNum(rowMap, [
      'stockinqualityinspection',
      'stockinqualityinsp',
      'qualityinspection',
      'qualityinspectionstock',
      'inspection',
      'qi',
      'qistock'
    ], 0);

    // 8. Blocked Stock
    const blockedStock = getNum(rowMap, [
      'blockedstock',
      'blocked',
      'blockedqty',
      'quarantine',
      'quarantinedstock'
    ], 0);

    // If completely blank on material, desc, and all stocks, skip this row
    if (!rawMaterial && !rawDesc && unrestrictedStock === 0 && stockInQualityInspection === 0 && blockedStock === 0) {
      return;
    }

    // 9. Current Value of Unrestricted Stock
    const currentValueOfUnrestrictedStock = getNum(rowMap, [
      'currentvalueofunrestrictedstock',
      'currentvalueofunrestricted',
      'valueofunrestrictedstock',
      'valueofunrestricted',
      'unrestrictedvalue',
      'totalamount',
      'totalvalue',
      'valuation'
    ], unrestrictedStock > 0 ? unrestrictedStock * 45000 : 0);

    // 10. Inventory Valuation Type
    const inventoryValuationType = getStr(rowMap, [
      'inventoryvaluationtype',
      'invvaluationtype',
      'valuationtype',
      'valtype',
      'valuation'
    ], 'Moving Average (V)');

    // 11. Material Group Name
    const materialGroupName = getStr(rowMap, [
      'materialgroupname',
      'materialgroup',
      'groupname',
      'productgroup',
      'category',
      'matkl',
      'materialtype'
    ], 'General Medical Devices');

    // 12. Value of Blocked Stock
    const valueOfBlockedStock = getNum(rowMap, [
      'valueofblockedstock',
      'valueofblocked',
      'blockedvalue',
      'blockedval',
      'quarantinevalue'
    ], blockedStock > 0 ? blockedStock * 45000 : 0);

    // 13. Value of Stock in Quality Inspection
    const valueOfStockInQualityInspection = getNum(rowMap, [
      'valueofstockinqualityinspection',
      'valueofstockinqualityinsp',
      'qualityinspectionvalue',
      'valueofinsp',
      'inspectionvalue',
      'qivalue'
    ], stockInQualityInspection > 0 ? stockInQualityInspection * 45000 : 0);

    // 14. WBS Element / Project / RDF Number
    const wbsElement = getStr(rowMap, [
      'wbselement',
      'wbs',
      'wbselem',
      'projectwbs',
      'project',
      'wbsnumber',
      'rdfnumber',
      'hpnumber',
      'rdfno',
      'hpno',
      'rdf',
      'hp'
    ], 'WBS-EPSS-2026');

    items.push({
      id: `mstock-${crypto.randomUUID()}`,
      material,
      materialDescription,
      plant,
      storageLocation,
      specialStockType,
      unrestrictedStock,
      stockInQualityInspection,
      blockedStock,
      currentValueOfUnrestrictedStock,
      inventoryValuationType,
      materialGroupName,
      valueOfBlockedStock,
      valueOfStockInQualityInspection,
      wbsElement,
      uploadedAt: new Date().toISOString(),
      sourceFile: sourceName
    });
  });

  return items;
}

/**
 * Universal multi-sheet and title-aware parser for Multiple Stock Workbooks
 */
export function parseMultipleStockWorkbook(wb: XLSX.WorkBook, sourceName: string = 'Upload'): MultipleStockRecord[] {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
  const allRecords: MultipleStockRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // First scan row arrays to handle any top title banner or metadata rows
    const aoo = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!aoo || aoo.length === 0) continue;

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(10, aoo.length); r++) {
      const row = aoo[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
      if (
        rowStr.includes('material') ||
        rowStr.includes('plant') ||
        rowStr.includes('unrestricted') ||
        rowStr.includes('storage') ||
        rowStr.includes('stock') ||
        rowStr.includes('wbs')
      ) {
        headerRowIdx = r;
        break;
      }
    }

    let records: MultipleStockRecord[] = [];
    if (headerRowIdx !== -1) {
      const headers = aoo[headerRowIdx].map((h) => String(h || '').trim());
      const dataRows = aoo.slice(headerRowIdx + 1);
      const objects: any[] = [];
      dataRows.forEach((row) => {
        if (!Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;
        const obj: Record<string, any> = {};
        headers.forEach((h, colIdx) => {
          if (h && colIdx < row.length) {
            obj[h] = row[colIdx];
          }
        });
        objects.push(obj);
      });
      records = parseMultipleStockRows(objects, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    } else {
      const rawRows = XLSX.utils.sheet_to_json<any>(ws);
      records = parseMultipleStockRows(rawRows, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    }

    if (records.length > 0) {
      allRecords.push(...records);
    }
  }

  return allRecords;
}

export const DEFAULT_SAMPLE_RECORDS: Omit<MultipleStockRecord, 'id'>[] = [];

export const MultipleStockUploadModal: React.FC<MultipleStockUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadMultipleStockData,
  initialItems,
  initialFileName
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'instructions'>('upload');
  const [parsedItems, setParsedItems] = useState<MultipleStockRecord[]>(initialItems || []);
  const [fileName, setFileName] = useState<string>(initialFileName || '');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, url: string }[]>([]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    try {
      const fileRecord = await uploadAndRecordFile(file, 'Inventory', 0);
      if (fileRecord) {
        setUploadedFiles([{ name: file.name, url: fileRecord.downloadUrl }]);
      }
    } catch (err) {
      console.warn('File upload to storage failed:', err);
    }


    const reader = new FileReader();

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.ods');

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const records = parseMultipleStockRows(json, file.name);
          if (records.length === 0) {
            setErrorMessage('No valid rows found in the uploaded Excel sheet. Please verify column headers.');
            return;
          }

          setParsedItems(records);
          setFileName(file.name);
          setActiveTab('preview');
          setSuccessMessage(`✓ Successfully loaded ${records.length} records from ${file.name}!`);
          setIsProcessing(false);
          uploadAndRecordFile(file, 'Multiple Stock', records.length);
        } catch (err: any) {
          setErrorMessage(`Failed to parse Excel file: ${err.message || 'Unknown error'}`);
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV or Text
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const records = parseMultipleStockRows(json, file.name);
          if (records.length === 0) {
            setErrorMessage('No valid rows found in the CSV file. Please verify headers.');
            setIsProcessing(false);
            return;
          }

          setParsedItems(records);
          setFileName(file.name);
          setActiveTab('preview');
          setSuccessMessage(`✓ Successfully loaded ${records.length} records from ${file.name}!`);
          setIsProcessing(false);
          uploadAndRecordFile(file, 'Multiple Stock', records.length);
        } catch (err: any) {
          setErrorMessage(`Failed to parse CSV file: ${err.message || 'Unknown error'}`);
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
      "Material": "e.g. MAT-100234",
      "Material Description": "e.g. Ultrasound Machine, Doppler Color 4D",
      "Plant": "AA01",
      "Storage Location": "Central Store A1",
      "Special Stock Type": "Q",
      "Unrestricted Stock": 10,
      "Stock in Quality Inspection": 0,
      "Blocked Stock": 0,
      "Current Value of Unrestricted Stock": 500000,
      "Inventory Valuation Type": "Moving Average (V)",
      "Material Group Name": "Diagnostic Imaging",
      "Value of Blocked Stock": 0,
      "Value of Stock in Quality Inspection": 0,
      "WBS Element": "WBS-EPSS-IMAG-01"
    }];
    downloadCSV(`EPSS_Multiple_Stock_Template_${new Date().toISOString().split("T")[0]}.csv`, templateData);
  };

  const handleConfirmUpload = () => {
    if (parsedItems.length === 0) {
      setErrorMessage('No records to upload. Please browse or select an Excel or CSV file.');
      return;
    }
    onUploadMultipleStockData(parsedItems, uploadMode, uploadedFiles);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-indigo-200">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide uppercase">
                Multiple Stock & Multi-Batch Data Ingestion
              </h3>
              <p className="text-xs text-indigo-200">
                Upload your Excel or CSV spreadsheet containing multi-plant inventories, storage locations, and special stock types
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Mode Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. Select & Upload File</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>2. Preview Data ({parsedItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'instructions'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Column Schema Guide</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase">
                  Click to Browse or Drag & Drop your Multiple Stock Spreadsheet
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Supports Excel (.xlsx, .xls) and CSV (.csv) files. Automatically maps Material, Plant, Storage Location, Unrestricted Stock, Blocked Stock, and WBS Element.
                </p>
                <div className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md inline-flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Select Spreadsheet File</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .ods"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Upload Mode Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-900 uppercase">Multiple Stock Ingestion Mode</div>
                  <p className="text-[11px] text-slate-500">Choose how incoming records should be integrated into your Multiple Stock matrix</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode('replace')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      uploadMode === 'replace'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>Replace All Current Records</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('append')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      uploadMode === 'append'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>Append & Merge with Existing</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900">
                    Parsed Multiple Stock Preview {fileName ? `(${fileName})` : ''}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Showing {parsedItems.length.toLocaleString()} records ready for saving into Multiple Stock matrix.
                  </p>
                </div>
                {parsedItems.length > 0 && (
                  <button
                    onClick={() => { setParsedItems([]); setFileName(''); }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Preview</span>
                  </button>
                )}
              </div>

              {parsedItems.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No records parsed yet.</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Upload Spreadsheet File
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 whitespace-nowrap">
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5">Material Description</th>
                        <th className="p-2.5">Plant</th>
                        <th className="p-2.5">Storage Location</th>
                        <th className="p-2.5">Special Stock Type</th>
                        <th className="p-2.5 text-right">Unrestricted Stock</th>
                        <th className="p-2.5 text-right">Stock in Quality Inspection</th>
                        <th className="p-2.5 text-right">Blocked Stock</th>
                        <th className="p-2.5 text-right">Current Value of Unrestricted Stock</th>
                        <th className="p-2.5">Inventory Valuation Type</th>
                        <th className="p-2.5">Material Group Name</th>
                        <th className="p-2.5 text-right">Value of Blocked Stock</th>
                        <th className="p-2.5 text-right">Value of Stock in Quality Inspection</th>
                        <th className="p-2.5">WBS Element</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px] whitespace-nowrap">
                      {parsedItems.map((item, idx) => (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-indigo-700">{item.material}</td>
                          <td className="p-2.5 font-sans font-medium text-slate-900 truncate max-w-[200px]" title={item.materialDescription}>{item.materialDescription}</td>
                          <td className="p-2.5 font-bold text-slate-800">{item.plant}</td>
                          <td className="p-2.5 text-slate-600">{item.storageLocation}</td>
                          <td className="p-2.5 text-slate-600">
                            {item.specialStockType === 'Q' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Q (HP)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Blank (RDF)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">{formatNumber(item.unrestrictedStock)}</td>
                          <td className="p-2.5 text-right text-amber-600">{formatNumber(item.stockInQualityInspection)}</td>
                          <td className="p-2.5 text-right text-rose-600">{formatNumber(item.blockedStock)}</td>
                          <td className="p-2.5 text-right text-slate-800">{formatCurrency(item.currentValueOfUnrestrictedStock)}</td>
                          <td className="p-2.5 text-slate-600 font-sans text-[10px]">{item.inventoryValuationType}</td>
                          <td className="p-2.5 text-slate-600 font-sans">{item.materialGroupName}</td>
                          <td className="p-2.5 text-right text-slate-700">{formatCurrency(item.valueOfBlockedStock)}</td>
                          <td className="p-2.5 text-right text-slate-700">{formatCurrency(item.valueOfStockInQualityInspection)}</td>
                          <td className="p-2.5 text-slate-600 text-[10px]">{item.wbsElement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h4 className="font-bold text-indigo-900 mb-1 uppercase tracking-wide">Required Column Headers for Multiple Stock</h4>
                <p className="text-slate-600">
                  Your uploaded Excel or CSV file should include the following columns for seamless parsing and inventory matrix integration:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">1. Material / Material Code</div>
                  <p className="text-slate-500 text-[11px]">SKU or code identifying the medical device (e.g., MAT-100234).</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">2. Material Description</div>
                  <p className="text-slate-500 text-[11px]">Full clinical name or item description.</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">3. Plant</div>
                  <p className="text-slate-500 text-[11px]">Delivering plant or regional hub code (e.g., HO01, AA01, AD01).</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">4. Storage Location</div>
                  <p className="text-slate-500 text-[11px]">Warehouse or bin location within the plant.</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">5. Special Stock Type</div>
                  <p className="text-slate-500 text-[11px]">Funding stream rule: <strong>Q</strong> = Health Program (HP), and <strong>Blank</strong> = Revolving Drug Fund (RDF).</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">6-8. Stock Quantities</div>
                  <p className="text-slate-500 text-[11px]">Unrestricted Stock, Stock in Quality Inspection, and Blocked Stock numbers.</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">9-12. Financial Valuation</div>
                  <p className="text-slate-500 text-[11px]">Current Value of Unrestricted Stock, Valuation Type, Material Group Name, and Value of Blocked Stock.</p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">13-14. Inspection Value & WBS</div>
                  <p className="text-slate-500 text-[11px]">Value of Stock in Quality Inspection and WBS Element code.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {parsedItems.length > 0 ? (
              <span className="text-emerald-700 font-bold">✓ {parsedItems.length} records staged for import</span>
            ) : (
              <span>No file loaded yet. Select or browse file.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={parsedItems.length === 0}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg cursor-pointer ${
                parsedItems.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Apply & Save to Multiple Stock ({parsedItems.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
