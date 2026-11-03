import React, { useState, useRef } from 'react';
import {
  X,
  QrCode,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Barcode,
  Package,
  FileCode,
  Layers
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { MedicalDeviceItem } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  onSelectItem: (item: MedicalDeviceItem) => void;
  onApplySearchFilter: (query: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectItem,
  onApplySearchFilter
}) => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedItem, setMatchedItem] = useState<MedicalDeviceItem | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Play audio chime synthesizer on successful match
  const playScanChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6 note
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // AudioContext unsupported or disabled
    }
  };

  // Find matching device from code
  const lookupDevice = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    // Direct or fuzzy matching across Material ID, Batch, WBS, Description, or Item ID
    const match = items.find((item) => {
      const mat = (item.material || '').toLowerCase();
      const batch = (item.batch || '').toLowerCase();
      const wbs = (item.wbsElement || '').toLowerCase();
      const id = (item.id || '').toLowerCase();
      const desc = (item.materialDescription || '').toLowerCase();

      return (
        mat === clean ||
        batch === clean ||
        wbs === clean ||
        id === clean ||
        mat.includes(clean) ||
        clean.includes(mat) ||
        (batch.length > 2 && clean.includes(batch)) ||
        desc.includes(clean)
      );
    });

    setScannedCode(code);
    setMatchedItem(match || null);
    setErrorMessage(null);
    playScanChime();
  };

  // Process uploaded image file through Html5Qrcode offline decoder
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage(null);

    const tempContainerId = 'epss-temp-qr-file-decoder';
    let tempDiv = document.getElementById(tempContainerId);
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = tempContainerId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
    }

    try {
      const html5QrCode = new Html5Qrcode(tempContainerId);
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      lookupDevice(decodedText);
    } catch (err) {
      console.warn('File decode error:', err);
      setErrorMessage(
        'No valid Barcode or QR Code detected in this image. You can enter the equipment material number manually below or try another image.'
      );
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    lookupDevice(manualCodeInput.trim());
  };

  const resetScan = () => {
    setScannedCode(null);
    setMatchedItem(null);
    setErrorMessage(null);
    setManualCodeInput('');
  };

  // Sample quick test barcodes from the real inventory items
  const sampleCodes = [
    { label: 'Ventilator SAP Tag', code: items[0]?.material || '1000109' },
    { label: 'Digital X-Ray GS1 Tag', code: items[1]?.material || '1000214' },
    { label: 'Ultrasound Scanner', code: items[2]?.material || '1000452' },
    { label: 'Infusion Pump Batch', code: items[3]?.batch || 'BATCH-2026-X1' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white flex items-center gap-2">
                Medical Device Barcode & QR Tag Decoder
              </h3>
              <p className="text-[11px] text-slate-400">
                Lookup equipment via barcode image file, SAP tag, or direct material ID
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              resetScan();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* File Upload / Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-cyan-50/40 transition group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {isProcessingFile ? 'Decoding Barcode from Image...' : 'Upload Barcode or QR Tag Image'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Click to select a photo of the equipment barcode, GS1 label, or SAP inventory tag
            </p>
          </div>

          {/* Direct Manual Entry */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Direct Barcode / Material Number Lookup:
            </label>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder="Enter SAP Material ID, Batch, WBS, or Serial Number..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer shrink-0"
              >
                Lookup
              </button>
            </form>
          </div>

          {/* Quick Test Sample Tags */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              <span>Quick Sample Barcodes:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleCodes.map((sample) => (
                <button
                  key={sample.code}
                  type="button"
                  onClick={() => lookupDevice(sample.code)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-cyan-100 text-slate-700 hover:text-cyan-900 border border-slate-200 text-xs transition cursor-pointer font-mono"
                >
                  <FileCode className="w-3 h-3 text-cyan-600" />
                  <span>{sample.label}: <strong className="text-slate-900">{sample.code}</strong></span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* Scanned Result Card */}
          {scannedCode && (
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 transition">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  {matchedItem ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-xs font-bold text-slate-900">
                    Decoded Code: <span className="font-mono text-cyan-700">{scannedCode}</span>
                  </span>
                </div>
                <button
                  onClick={resetScan}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {matchedItem ? (
                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {matchedItem.materialDescription}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Material ID: <strong className="font-mono text-slate-700">{matchedItem.material}</strong> • Batch: {matchedItem.batch || 'N/A'} • Hub: {matchedItem.plantName || matchedItem.plant}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                          Qty: {matchedItem.qty} Units
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 font-mono">
                          Val: {matchedItem.totalAmount?.toLocaleString()} ETB
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
                    <button
                      onClick={() => {
                        onSelectItem(matchedItem);
                        onClose();
                      }}
                      className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>View Full Specifications</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        onApplySearchFilter(matchedItem.material);
                        onClose();
                      }}
                      className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Filter Table
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-600">
                    No exact equipment match found in the current inventory dataset for <strong className="font-mono">{scannedCode}</strong>.
                  </p>
                  <button
                    onClick={() => {
                      onApplySearchFilter(scannedCode);
                      onClose();
                    }}
                    className="mt-3 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Filter Inventory by "{scannedCode}"
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Camera Access: Disabled</span>
          <button
            onClick={() => {
              resetScan();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
