import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  ClipboardPaste,
  FileText,
  Trash2,
  Sparkles,
  Info,
  Check,
  Building2,
  Layers,
  ArrowRight,
  Copy,
  Clock,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  RECEIVING_DATA_COLUMNS,
  DEFAULT_RECEIVING_DATA_RECORDS,
  parseReceivingDataRows,
  calculateStockHoldingDays,
  downloadReceivingDataTemplateCSV,
  downloadReceivingDataTemplateExcel,
  generateReceivingDataCSVText
} from '../data/defaultReceivingData';

export interface ReceivingDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadReceivingData: (records: ReceivingDataRecord[], mode: 'replace' | 'append') => void;
  initialRecordsCount?: number;
}

export const ReceivingDataUploadModal: React.FC<ReceivingDataUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadReceivingData,
  initialRecordsCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ReceivingDataRecord[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [copiedCSV, setCopiedCSV] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const processFile = async (f: File) => {
    setFile(f);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

      if (rawRows.length === 0) {
        setErrorMsg('The selected spreadsheet does not contain any valid data rows.');
        setParsedRecords([]);
        setIsProcessing(false);
        return;
      }

      // Collect detected column headers from first non-empty row
      const detected = Object.keys(rawRows[0] || {});
      setDetectedColumns(detected);

      const items = parseReceivingDataRows(rawRows, f.name);
      if (items.length === 0) {
        setErrorMsg('Could not parse any valid receiving data rows. Please ensure your file includes at least "Material" or "Material Description".');
        setParsedRecords([]);
      } else {
        setParsedRecords(items);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse file: ${err.message || 'Unknown format error'}`);
      setParsedRecords([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParsePastedText = () => {
    setErrorMsg(null);
    if (!pastedText.trim()) {
      setErrorMsg('Please paste some CSV or tabular Excel content into the text area.');
      return;
    }

    setIsProcessing(true);
    try {
      const lines = pastedText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setErrorMsg('Pasted content must include at least a header row and one data row.');
        setIsProcessing(false);
        return;
      }

      // Detect delimiter: tab or comma
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';

      // Parse CSV/TSV lines
      const splitLine = (line: string): string[] => {
        if (delimiter === '\t') {
          return line.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
        }
        // Basic CSV split respecting quotes
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"(.*)"$/, '$1'));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^"(.*)"$/, '$1'));
        return result;
      };

      const headers = splitLine(lines[0]);
      setDetectedColumns(headers);

      const rawRows = lines.slice(1).map(line => {
        const values = splitLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        return row;
      });

      const items = parseReceivingDataRows(rawRows, 'Pasted Clipboard Data');
      if (items.length === 0) {
        setErrorMsg('Could not parse any valid receiving data rows. Check header column names.');
        setParsedRecords([]);
      } else {
        setParsedRecords(items);
      }
    } catch (err: any) {
      setErrorMsg(`Error parsing pasted data: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleCopySampleCSV = async () => {
    const csv = generateReceivingDataCSVText();
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedCSV(true);
      setTimeout(() => setCopiedCSV(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleConfirmUpload = () => {
    if (parsedRecords.length === 0) return;
    onUploadReceivingData(parsedRecords, uploadMode);
    onClose();
  };

  // Metrics on parsed records
  const totalQty = parsedRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalValuation = parsedRecords.reduce((sum, r) => sum + (r.amtInLocCur || 0), 0);
  const plantCount = new Set(parsedRecords.map(r => r.plant)).size;
  const poCount = new Set(parsedRecords.map(r => r.purchaseOrder)).size;

  const missingColumns = RECEIVING_DATA_COLUMNS.filter(col => {
    const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !detectedColumns.some(d => d.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-linear-to-r from-teal-50/70 via-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Upload Inbound Receiving Data (GRN)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 uppercase font-mono">
                  13 SAP Columns Supported
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Import SAP MM Goods Receipt transactions, GRN delivery notes, and warehouse intake ledgers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Tab Selector & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setActiveTab('upload'); setErrorMsg(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload File (.xlsx / .csv)</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('paste'); setErrorMsg(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'paste'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste Table Data</span>
              </button>


            </div>

            {/* Template Download Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={downloadReceivingDataTemplateExcel}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                title="Download 22-column formatted Excel template"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>Excel Template</span>
              </button>

              <button
                type="button"
                onClick={downloadReceivingDataTemplateCSV}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                title="Download 22-column CSV template"
              >
                <Download className="w-3 h-3 text-slate-600" />
                <span>CSV Template</span>
              </button>

              <button
                type="button"
                onClick={handleCopySampleCSV}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition flex items-center gap-1 cursor-pointer"
                title="Copy sample CSV content to clipboard"
              >
                {copiedCSV ? <Check className="w-3 h-3 text-teal-600" /> : <Copy className="w-3 h-3 text-teal-600" />}
                <span>{copiedCSV ? 'Copied!' : 'Copy Sample'}</span>
              </button>
            </div>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/30 hover:bg-teal-50/60 transition rounded-xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-2.5"
              >
                <div className="p-3 bg-teal-100 text-teal-700 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to browse or drag & drop receiving spreadsheet
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv, .tsv)
                  </p>
                </div>
                {file && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-teal-200 rounded-lg text-xs font-mono text-teal-800 shadow-2xs mt-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                    <span>{file.name}</span>
                    <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Paste Data */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Paste Excel Table or CSV with 13 SAP Columns (including Posting Date):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Headers must be included in the first row
                  </span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Purchase order\tReference\tMaterial\tMaterial Description\tBatch\tQuantity\tStorage Location\tAmt.in Loc.Cur.\tMovement Type\tSpecial Stock\tWBS Element\tPlant\tPosting Date\n4500128940\tREF-2026-001\tMAT-100234\tUltrasound Machine Doppler Color 4D\tBATCH-A01\t15\tSL01\t48750000\t101\tQ\tET-MOH-GF-2026-01\tAA01\t2024-03-10`}
                  rows={6}
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 leading-relaxed"
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Parse Pasted Content</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview & Analysis of Parsed Records */}
          {parsedRecords.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span>Validation & Inbound Intake Preview ({parsedRecords.length} Rows)</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  {detectedColumns.length} Columns Detected
                </span>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Items</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-0.5">{parsedRecords.length} Rows</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Received Units</div>
                  <div className="text-base font-black text-teal-700 font-mono mt-0.5">{formatNumber(totalQty)} Units</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Intake Value</div>
                  <div className="text-base font-black text-emerald-600 font-mono mt-0.5">{formatCurrency(totalValuation)}</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Receiving Plants / POs</div>
                  <div className="text-base font-black text-purple-700 font-mono mt-0.5">{plantCount} Plants • {poCount} POs</div>
                </div>
              </div>

              {/* Column Mapping Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>SAP Goods Receipt 13-Column Mapping Status:</span>
                  <span className="text-[10px] text-teal-600 font-normal">
                    {RECEIVING_DATA_COLUMNS.length - missingColumns.length} / {RECEIVING_DATA_COLUMNS.length} Matched
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {RECEIVING_DATA_COLUMNS.map((col) => {
                    const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const isMatched = detectedColumns.some(d => d.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
                    return (
                      <span
                        key={col}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1 ${
                          isMatched
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 font-semibold'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isMatched ? <Check className="w-2.5 h-2.5 text-teal-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                        <span>{col}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3 border-x border-slate-200 text-center">#</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap">Purchase order</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap">Reference</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap">Material</th>
                      <th className="py-2 px-3 border-x border-slate-200 min-w-[180px]">Material Description</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap">Batch</th>
                      <th className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap">Qty</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap">Storage Location</th>
                      <th className="py-2 px-3 border-x border-slate-200 text-right whitespace-nowrap">Amt. in Loc. Cur.</th>
                      <th className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap">Mvt</th>
                      <th className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap">Plant</th>
                      <th className="py-2 px-3 border-x border-slate-200 whitespace-nowrap bg-amber-50/50 text-amber-900 font-extrabold">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>Posting Date (Excel Source)</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 border-x border-slate-200 text-center whitespace-nowrap bg-teal-50/60 text-teal-900 font-extrabold">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-teal-600" />
                          <span>Stock Holding Days</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                    {parsedRecords.slice(0, 10).map((r, idx) => {
                      const days = calculateStockHoldingDays(r.postingDate, r);
                      return (
                        <tr key={idx} className="hover:bg-teal-50/30 transition">
                          <td className="py-1.5 px-3 border-x border-slate-200 text-center text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap font-bold text-teal-700">{r.purchaseOrder}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap text-slate-600">{r.reference || '-'}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap font-semibold text-slate-800">{r.material}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 max-w-xs truncate font-sans text-slate-900 font-medium" title={r.materialDescription}>{r.materialDescription}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap text-slate-600">{r.batch || '-'}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 text-center font-bold text-slate-900">{r.quantity}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap text-slate-600">{r.storageLocation}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 text-right font-bold text-emerald-600">{formatCurrency(r.amtInLocCur)}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 text-center">
                            <span className="px-1.5 py-0.5 rounded-sm bg-teal-50 text-teal-700 text-[10px] border border-teal-100">
                              {r.movementType}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 border-x border-slate-200 text-center text-slate-700">{r.plant}</td>
                          <td className="py-1.5 px-3 border-x border-slate-200 whitespace-nowrap bg-amber-50/20" title={r.postingDay ? `Exact Date: Day ${r.postingDay}, Month ${r.postingMonth}, Year ${r.postingYear}` : 'Posting Date'}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{r.postingDate || '-'}</span>
                              {r.postingDay && r.postingMonth && r.postingYear && (
                                <span className="text-[9px] font-sans px-1.5 py-0.2 rounded-xs bg-amber-100 text-amber-800 border border-amber-200">
                                  D{r.postingDay}/M{r.postingMonth}/Y{r.postingYear}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-3 border-x border-slate-200 text-center whitespace-nowrap bg-teal-50/20">
                            {days !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  days <= 30
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : days <= 90
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : days <= 180
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{days} Days</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">No Date</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsedRecords.length > 10 && (
                <div className="text-[11px] text-slate-500 text-center font-mono">
                  + {parsedRecords.length - 10} additional rows will be imported
                </div>
              )}

              {/* Upload Mode: Replace vs Append */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800">Import Mode:</div>
                  <div className="text-[11px] text-slate-500">
                    {initialRecordsCount > 0 ? `Currently ${initialRecordsCount} records stored in receiving ledger` : 'No prior receiving records'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="replace"
                      checked={uploadMode === 'replace'}
                      onChange={() => setUploadMode('replace')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-semibold">Replace Existing</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="append"
                      checked={uploadMode === 'append'}
                      onChange={() => setUploadMode('append')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-semibold">Append & Merge</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {parsedRecords.length > 0 ? (
              <span className="font-medium text-teal-800">
                Ready to commit {parsedRecords.length} receiving records ({uploadMode === 'replace' ? 'Fresh Ledger' : 'Append'})
              </span>
            ) : (
              <span>Upload file, paste data, or click 'Load Demo Dataset' to preview</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={parsedRecords.length === 0 || isProcessing}
              onClick={handleConfirmUpload}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                parsedRecords.length > 0 && !isProcessing
                  ? 'bg-teal-600 hover:bg-teal-500 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm & Commit ({parsedRecords.length})</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
