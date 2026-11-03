import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Package,
  ClipboardPaste,
  FileText,
  Trash2,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MaterialMasterRecord } from '../types';
import { downloadCSV, formatCurrency } from '../utils/formatters';
import { uploadAndRecordFile } from '../utils/fileUploadService';

export interface MaterialMasterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadMaterialMasterData: (items: MaterialMasterRecord[], mode: 'replace' | 'append', files?: { name: string, url: string }[]) => void;
  initialItems?: MaterialMasterRecord[];
  initialFileName?: string;
}

export const DEFAULT_SAMPLE_MATERIAL_RECORDS: Omit<MaterialMasterRecord, 'id'>[] = [
  {
    product: 'Ultrasound Machine, Doppler Color 4D with Convex & Linear Probes',
    material: 'MAT-100234',
    plant: 'AA01',
    productType: 'Medical Equipment',
    productGroup: 'Diagnostic Imaging'
  },
  {
    product: 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive',
    material: 'MAT-100235',
    plant: 'HO01',
    productType: 'Life Support Device',
    productGroup: 'Critical Care & ICU'
  },
  {
    product: 'Digital X-Ray System, Ceiling-Suspended High Frequency 50kW',
    material: 'MAT-100236',
    plant: 'HW01',
    productType: 'Radiology Equipment',
    productGroup: 'Diagnostic Imaging'
  },
  {
    product: 'Automated Clinical Chemistry Analyzer, 400 Tests/Hour Throughput',
    material: 'MAT-100237',
    plant: 'BD01',
    productType: 'Laboratory Equipment',
    productGroup: 'Clinical Chemistry'
  },
  {
    product: 'Surgical Operating Light, Dual Ceiling Dome LED with HD Camera',
    material: 'MAT-100238',
    plant: 'MK01',
    productType: 'Operating Theatre',
    productGroup: 'Surgical Infrastructure'
  },
  {
    product: 'Multi-Parameter Patient Monitor, 12.1 Inch Color TFT with ECG/SpO2/NIBP',
    material: 'MAT-100239',
    plant: 'AD01',
    productType: 'Monitoring Device',
    productGroup: 'Patient Monitoring'
  },
  {
    product: 'Steam Sterilizer Autoclave, 250L Horizontal High Pressure',
    material: 'MAT-100240',
    plant: 'DR01',
    productType: 'Sterilization Device',
    productGroup: 'Infection Prevention'
  },
  {
    product: 'Infant Incubator with Servo Humidity & Temperature Control',
    material: 'MAT-100241',
    plant: 'JJ01',
    productType: 'Neonatal Care',
    productGroup: 'Maternal & Child Health'
  }
];

export function parseMaterialMasterRows(rawRows: any[], sourceName: string = 'Upload'): MaterialMasterRecord[] {
  if (!rawRows || rawRows.length === 0) return [];

  const cleanKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const items: MaterialMasterRecord[] = [];
  const timestamp = Date.now();

  rawRows.forEach((row, index) => {
    console.log('[MaterialMaster] Processing row:', index, row);
    if (!row || typeof row !== 'object') return;
    const hasAnyContent = Object.values(row).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!hasAnyContent) return;

    const rowMap: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      rowMap[cleanKey(k)] = row[k];
    });
    console.log('[MaterialMaster] RowMap:', rowMap);

    const getStr = (keys: string[], fallback: string = ''): string => {
      for (const k of keys) {
        if (rowMap[k] !== undefined && rowMap[k] !== null && String(rowMap[k]).trim() !== '') {
          return String(rowMap[k]).trim();
        }
      }
      return fallback;
    };

    const getNum = (keys: string[], fallback: number = 0): number => {
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

    // 1. Product (Item Description / Product Name)
    const product = getStr([
      'product',
      'productname',
      'itemdescription',
      'materialdescription',
      'description',
      'itemname',
      'item',
      'devicename',
      'devicedescription',
      'equipmentname',
      'equipment',
      'name'
    ], `Medical Device Product ${index + 1}`);

    // 2. Material Code (Material / Code / SKU)
    const material = getStr([
      'materialcode',
      'material',
      'materialno',
      'materialnumber',
      'matnr',
      'itemcode',
      'productcode',
      'code',
      'sku',
      'id'
    ], `MAT-${String(index + 1).padStart(5, '0')}`);

    // 3. Plant (Hub / Plant Code)
    const plant = getStr([
      'plant',
      'plantcode',
      'deliveringplant',
      'hub',
      'branch',
      'location'
    ], 'HO01').toUpperCase();

    // 4. Product Type
    const productType = getStr([
      'producttype',
      'type',
      'materialtype',
      'itemtype',
      'categorytype',
      'devicetype'
    ], 'Medical Device');

    // 5. Product Group
    const productGroup = getStr([
      'productgroup',
      'group',
      'materialgroup',
      'materialgroupname',
      'groupname',
      'devicegroup',
      'clinicalcategory',
      'category',
      'deviceclass'
    ], 'Diagnostic & Therapeutic');

    // Optional metadata if present in spreadsheet
    const manufacturer = getStr(['manufacturer', 'brand', 'make', 'vendor'], 'Standard Certified');
    const model = getStr(['model', 'modelspec', 'spec', 'specification'], '-');
    const unit = getStr(['unit', 'uom', 'unitofmeasure'], 'EA').toUpperCase();
    const wh = getStr(['warehouse', 'wh', 'storagelocation'], 'Central Store');
    const qty = getNum(['qty', 'quantity', 'stock', 'units'], 1);
    const unitPrice = getNum(['unitprice', 'price', 'unitcost', 'cost'], 0);
    const totalAmount = getNum(['totalamount', 'total', 'valuation'], qty * unitPrice);
    const sohStatus = getStr(['sohstatus', 'status'], 'Stock on Hand (Active)');
    const batch = getStr(['batch', 'batchno', 'lot'], `LOT-${index + 1}`);
    const expiryDate = getStr(['expirydate', 'expiry'], '2030-12-31');
    const wbsElement = getStr(['wbselement', 'wbs'], 'WBS-EPSS-MD');

    items.push({
      id: `mat-${timestamp}-${index}-${Math.random().toString(36).substr(2, 6)}`,
      product,
      material,
      plant,
      productType,
      productGroup,
      uploadedAt: new Date().toISOString(),
      sourceFile: sourceName
    });
  });

  return items;
}

/**
 * Universal multi-sheet and title-aware parser for Material Master Workbooks
 */
export function parseMaterialMasterWorkbook(wb: XLSX.WorkBook, sourceName: string = 'Upload'): MaterialMasterRecord[] {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
  const allRecords: MaterialMasterRecord[] = [];

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
        rowStr.includes('product') ||
        rowStr.includes('material') ||
        rowStr.includes('plant') ||
        rowStr.includes('type') ||
        rowStr.includes('group')
      ) {
        headerRowIdx = r;
        break;
      }
    }

    let records: MaterialMasterRecord[] = [];
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
      records = parseMaterialMasterRows(objects, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    } else {
      const rawRows = XLSX.utils.sheet_to_json<any>(ws);
      records = parseMaterialMasterRows(rawRows, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    }

    if (records.length > 0) {
      allRecords.push(...records);
    }
  }

  return allRecords;
}

export const MaterialMasterUploadModal: React.FC<MaterialMasterUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadMaterialMasterData,
  initialItems = [],
  initialFileName
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [parsedItems, setParsedItems] = useState<MaterialMasterRecord[]>(initialItems);
  const [currentFileName, setCurrentFileName] = useState<string | null>(initialFileName || null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, url: string }[]>([]);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setCurrentFileName(file.name);

    try {
      uploadAndRecordFile(file, 'Material Master', 0);
    } catch (err) {
      console.warn('Material Master file disk save bypassed:', err);
    }

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          const rawRows = Array.isArray(parsed) ? parsed : parsed.items || parsed.materials || [];
          const rows = parseMaterialMasterRows(rawRows, file.name);
          if (rows.length === 0) {
            setErrorMsg('No valid Material Master records found in the JSON file.');
          } else {
            setParsedItems(rows);
            uploadAndRecordFile(file, 'Material Master', rows.length);
          }
        } catch (err: any) {
          setErrorMsg('Failed to parse JSON file: ' + err.message);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    } else {
      // Excel (.xlsx, .xls) or CSV
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const rows = parseMaterialMasterWorkbook(wb, file.name);
          if (rows.length === 0) {
            setErrorMsg('No valid rows recognized in this sheet. Please check the template format.');
          } else {
            setParsedItems(rows);
            uploadAndRecordFile(file, 'Material Master', rows.length);
          }
        } catch (err: any) {
          setErrorMsg('Failed to process spreadsheet file: ' + err.message);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleProcessPastedText = () => {
    setErrorMsg(null);
    if (!pasteContent.trim()) {
      setErrorMsg('Please paste text or table rows first.');
      return;
    }

    try {
      const lines = pasteContent.trim().split('\n');
      if (lines.length < 2) {
        setErrorMsg('Pasted data should have a header line and at least one row.');
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

      const rawRows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rawRows.push(rowObj);
      }

      const rows = parseMaterialMasterRows(rawRows, 'Clipboard Paste');
      if (rows.length === 0) {
        setErrorMsg('Could not detect valid material master columns from pasted content.');
      } else {
        setParsedItems(rows);
        setCurrentFileName('Clipboard Data');
      }
    } catch (err: any) {
      setErrorMsg('Failed to parse pasted data: ' + err.message);
    }
  };

  const handleDownloadSample = (format: 'xlsx' | 'csv') => {
    // Standard 5-column template conforming directly to Material Master schema:
    // Product, Material Code, Plant, Product Type, Product Group
    const sampleData = [
      {
        'Product': 'Ultrasound Machine, Doppler Color 4D with Convex & Linear Probes',
        'Material Code': 'MAT-100234',
        'Plant': 'AA01',
        'Product Type': 'Medical Equipment',
        'Product Group': 'Diagnostic Imaging'
      },
      {
        'Product': 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive',
        'Material Code': 'MAT-100235',
        'Plant': 'HO01',
        'Product Type': 'Life Support Device',
        'Product Group': 'Critical Care & ICU'
      },
      {
        'Product': 'Digital X-Ray System, Ceiling-Suspended High Frequency 50kW',
        'Material Code': 'MAT-100236',
        'Plant': 'HW01',
        'Product Type': 'Radiology Equipment',
        'Product Group': 'Diagnostic Imaging'
      },
      {
        'Product': 'Automated Clinical Chemistry Analyzer, 400 Tests/Hour Throughput',
        'Material Code': 'MAT-100237',
        'Plant': 'BD01',
        'Product Type': 'Laboratory Equipment',
        'Product Group': 'Clinical Chemistry'
      },
      {
        'Product': 'Surgical Operating Light, Dual Ceiling Dome LED with HD Camera',
        'Material Code': 'MAT-100238',
        'Plant': 'MK01',
        'Product Type': 'Operating Theatre',
        'Product Group': 'Surgical Infrastructure'
      },
      {
        'Product': 'Multi-Parameter Patient Monitor, 12.1 Inch Color TFT with ECG/SpO2/NIBP',
        'Material Code': 'MAT-100239',
        'Plant': 'AD01',
        'Product Type': 'Monitoring Device',
        'Product Group': 'Patient Monitoring'
      },
      {
        'Product': 'Steam Sterilizer Autoclave, 250L Horizontal High Pressure',
        'Material Code': 'MAT-100240',
        'Plant': 'DR01',
        'Product Type': 'Sterilization Device',
        'Product Group': 'Infection Prevention'
      },
      {
        'Product': 'Infant Incubator with Servo Humidity & Temperature Control',
        'Material Code': 'MAT-100241',
        'Plant': 'JJ01',
        'Product Type': 'Neonatal Care',
        'Product Group': 'Maternal & Child Health'
      }
    ];

    if (format === 'csv') {
      downloadCSV('EPSS_Material_Master_Template.csv', sampleData);
    } else {
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Material Master');
      XLSX.writeFile(wb, 'EPSS_Material_Master_Template.xlsx');
    }
  };

  const handleConfirmUpload = () => {
    if (parsedItems.length === 0) return;
    onUploadMaterialMasterData(parsedItems, uploadMode, uploadedFiles);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-cyan-900 via-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shadow-inner">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  Upload Material Master Data
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/30 text-cyan-200 border border-cyan-400/40">
                  Excel / CSV / Direct Paste
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Bulk import medical device codes, descriptions, categories, specifications, and valuation records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Format Selection Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('file')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Spreadsheet File (XLSX / CSV)</span>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Copy & Paste Data</span>
            </button>
          </div>

          {/* Sample template download */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Download Standard Template:</span>
            <button
              onClick={() => handleDownloadSample('xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition cursor-pointer"
              title="Download clean formatted Excel (.xlsx) Material Master template"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => handleDownloadSample('csv')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              title="Download CSV format template"
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'file' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-cyan-500 bg-cyan-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-cyan-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3 shadow-inner">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">
                Drag & Drop your Material Master spreadsheet here
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Supports Excel (.xlsx, .xls) and CSV (.csv) files. Automatic column matching for Material Code, Description, Category, Manufacturer, Unit, Quantity, Price, and Plant.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Browse Files on Computer</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Paste Tab-Delimited or Comma-Delimited Table Rows:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPasteContent('')}
                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Text
                </button>
              </div>
              <textarea
                rows={6}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Material Code&#9;Material Description&#9;Category&#9;Manufacturer&#9;Unit&#9;Qty&#9;Unit Price&#9;Total Valuation&#10;MAT-100234&#9;Ultrasound Machine 4D&#9;Imaging&#9;GE Healthcare&#9;SET&#9;10&#9;2500000&#9;25000000"
                className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Process Pasted Rows</span>
              </button>
            </div>
          )}

          {/* Parsed Preview Section */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-cyan-50/80 p-3.5 rounded-xl border border-cyan-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-cyan-950 flex items-center gap-2">
                      <span>Ready to Import: {parsedItems.length.toLocaleString()} Material Master Items</span>
                      {currentFileName && (
                        <span className="text-[10px] font-mono bg-cyan-200/70 text-cyan-900 px-1.5 py-0.2 rounded font-semibold truncate max-w-[200px]">
                          {currentFileName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-cyan-800 mt-0.5 flex items-center gap-3">
                    </div>
                  </div>
                </div>

                {/* Import Mode Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-700">Mode:</span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="replace"
                      checked={uploadMode === 'replace'}
                      onChange={() => setUploadMode('replace')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Replace All</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer ml-1">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="append"
                      checked={uploadMode === 'append'}
                      onChange={() => setUploadMode('append')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Append / Add</span>
                  </label>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Material Code</th>
                      <th className="py-2 px-3">Plant</th>
                      <th className="py-2 px-3">Product Type</th>
                      <th className="py-2 px-3">Product Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {parsedItems.slice(0, 50).map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-medium text-slate-900 truncate max-w-xs">{row.product}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-cyan-900">{row.material}</td>
                        <td className="py-1.5 px-3 font-mono text-cyan-700">{row.plant}</td>
                        <td className="py-1.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                            {row.productType}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-700 font-medium">
                          {row.productGroup}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedItems.length > 50 && (
                <p className="text-[11px] text-slate-500 text-center italic">
                  Showing first 50 of {parsedItems.length.toLocaleString()} items in preview. All will be imported upon confirmation.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-cyan-600" />
            <span>Master records are stored in browser memory & local offline storage.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedItems.length === 0 || isProcessing}
              onClick={handleConfirmUpload}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                parsedItems.length > 0 && !isProcessing
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white hover:shadow'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {uploadMode === 'replace'
                  ? `Confirm & Auto-Save (Replace with ${parsedItems.length.toLocaleString()} Items)`
                  : `Confirm & Auto-Save (Append ${parsedItems.length.toLocaleString()} Items)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
