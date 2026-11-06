import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Truck,
  ClipboardPaste,
  FileText,
  Trash2,
  Info,
  Check,
  Building2,
  Layers,
  ArrowRight,
  Copy,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DistributionDataRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  DISTRIBUTION_DATA_COLUMNS,
  parseDistributionDataRows,
  downloadDistributionDataTemplateCSV,
  downloadDistributionDataTemplateExcel,
  generateDistributionDataCSVText
} from '../data/defaultDistributionData';

export interface DistributionDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadDistributionData: (records: DistributionDataRecord[], mode: 'replace' | 'append') => void;
  initialRecordsCount?: number;
}

export const DistributionDataUploadModal: React.FC<DistributionDataUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadDistributionData,
  initialRecordsCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<DistributionDataRecord[]>([]);
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
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        setErrorMsg('The selected spreadsheet does not contain any valid data rows.');
        setParsedRecords([]);
        setIsProcessing(false);
        return;
      }

      const detected = Object.keys(rawRows[0] || {});
      setDetectedColumns(detected);

      const items = parseDistributionDataRows(rawRows, f.name);
      if (items.length === 0) {
        setErrorMsg('Could not parse any valid distribution data rows. Please ensure your file includes at least "Material Code" or "Material Descr".');
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
      setErrorMsg('Please paste some CSV or tabular content into the text area.');
      return;
    }

    setIsProcessing(true);
    try {
      const lines = pastedText.trim().split('\n');
      if (lines.length < 2) {
        setErrorMsg('Pasted text must contain at least a header row and one data row.');
        setIsProcessing(false);
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
      setDetectedColumns(headers);

      const rawRows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        rawRows.push(rowObj);
      }

      const items = parseDistributionDataRows(rawRows, 'Clipboard Paste');
      if (items.length === 0) {
        setErrorMsg('Could not parse valid distribution records from pasted text.');
        setParsedRecords([]);
      } else {
        setParsedRecords(items);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse pasted text: ${err.message}`);
      setParsedRecords([]);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleConfirmUpload = () => {
    if (parsedRecords.length === 0) return;
    onUploadDistributionData(parsedRecords, uploadMode);
    onClose();
  };

  const totalNetValue = parsedRecords.reduce((sum, r) => sum + (r.netValue || 0), 0);
  const totalQuantity = parsedRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Truck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Distribution Data Upload & Integration (18 Columns)</h2>
              <p className="text-xs text-emerald-200">
                Import official regional distribution, customer deliveries, and POD status records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center space-x-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Spreadsheet (.xlsx / .csv)</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center space-x-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'paste'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste Tabular Data</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Templates & Instructions */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 space-y-1">
                <p className="font-semibold text-emerald-950">Supported 18 Distribution Columns:</p>
                <p className="text-emerald-800">
                  Plant, Sales Org Descr, Customer Name, Material Code, Material Descr, Quantity, Unit, Net Value, Manufacturer Descr, Batch, Wbs Element Descr, Material Type Descr, Region Descr, Zone Descr, Woreda Descr, POD status, Delivery Date, POD Numbers.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={downloadDistributionDataTemplateExcel}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel Template</span>
              </button>
              <button
                onClick={downloadDistributionDataTemplateCSV}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV Template</span>
              </button>
            </div>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv,.tsv"
                  className="hidden"
                />
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform mb-4 shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  {file ? file.name : 'Click to browse or drag & drop your distribution spreadsheet'}
                </h3>
                <p className="text-xs text-slate-500">
                  Supports Excel (.xlsx, .xls) or CSV files with the 18 required columns
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Paste Tabular Data */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Paste Tabular Spreadsheet Content (Tab or Comma Separated with Header Row)
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Plant\tSales Org Descr\tCustomer Name\tMaterial Code\tMaterial Descr\tQuantity\tUnit\tNet Value\t...\nAA01\tEPSS Central Hub Sales\tTikur Anbessa Hospital\tMAT-100234\tUltrasound Machine\t5\tEA\t16250000\t...`}
                  rows={8}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleParsePastedText}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors shadow-md flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Parse Pasted Records</span>
                </button>
              </div>
            </div>
          )}


          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-800 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsing Results Preview */}
          {parsedRecords.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/80 p-4 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Successfully Parsed {formatNumber(parsedRecords.length)} Distribution Records</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Total Quantity: <strong className="text-slate-900">{formatNumber(totalQuantity)} units</strong> | Total Net Value: <strong className="text-slate-900">{formatCurrency(totalNetValue)}</strong>
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold text-slate-700">Import Mode:</span>
                  <select
                    value={uploadMode}
                    onChange={(e: any) => setUploadMode(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="replace">Replace Existing ({initialRecordsCount} records)</option>
                    <option value="append">Append to Existing</option>
                  </select>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0">
                      <th className="p-2.5 font-semibold">Plant</th>
                      <th className="p-2.5 font-semibold">Customer Name</th>
                      <th className="p-2.5 font-semibold">Material Code & Desc</th>
                      <th className="p-2.5 font-semibold text-right">Qty</th>
                      <th className="p-2.5 font-semibold text-right">Net Value</th>
                      <th className="p-2.5 font-semibold">Region</th>
                      <th className="p-2.5 font-semibold">POD Status</th>
                      <th className="p-2.5 font-semibold">Delivery Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRecords.slice(0, 50).map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{r.plant}</td>
                        <td className="p-2.5 font-medium text-slate-900 max-w-[200px] truncate">{r.customerName}</td>
                        <td className="p-2.5 text-slate-700 max-w-[220px] truncate">
                          <span className="font-mono font-semibold text-emerald-800 mr-1">{r.materialCode}</span>
                          {r.materialDescr}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{formatNumber(r.quantity)} {r.unit}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">{formatCurrency(r.netValue)}</td>
                        <td className="p-2.5 text-slate-600">{r.regionDescr}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {r.podStatus}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">{r.deliveryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmUpload}
            disabled={parsedRecords.length === 0 || isProcessing}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
              parsedRecords.length > 0 && !isProcessing
                ? 'bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Import {formatNumber(parsedRecords.length)} Records</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
