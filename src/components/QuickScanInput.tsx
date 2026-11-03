import React, { useState, useRef, useEffect } from 'react';
import { Barcode, Search, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { MedicalDeviceItem } from '../types';

interface QuickScanInputProps {
  items: MedicalDeviceItem[];
  onSelectItem: (item: MedicalDeviceItem) => void;
  className?: string;
  variant?: 'sidebar' | 'header';
}

export const QuickScanInput: React.FC<QuickScanInputProps> = ({
  items = [],
  onSelectItem,
  className = '',
  variant = 'sidebar'
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Play audio chime synthesizer on successful match
  const playScanChime = (success: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      if (success) {
        // High double-tone chime
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6 note
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      } else {
        // Low double-buzz chime
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3 note
        osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.08); // A2 note
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      }
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
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
        (clean.length >= 4 && mat.includes(clean)) ||
        (clean.length >= 4 && id.includes(clean))
      );
    });

    if (match) {
      playScanChime(true);
      setSuccessMessage(`Found: ${match.materialDescription.slice(0, 24)}...`);
      setErrorMessage(null);
      setBarcodeInput('');
      
      // Instantly open the device specifications detail modal
      onSelectItem(match);

      // Dismiss success message after 2.5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 2500);
    } else {
      playScanChime(false);
      setErrorMessage(`No device matches barcode "${code}"`);
      setSuccessMessage(null);
      
      // Auto-dismiss error message after 3.5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 3500);
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    lookupDevice(barcodeInput.trim());
  };

  // Listen for keypress to clear error
  useEffect(() => {
    if (barcodeInput.trim().length > 0) {
      setErrorMessage(null);
    }
  }, [barcodeInput]);

  const isHeader = variant === 'header';

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <form onSubmit={handleScanSubmit} className="relative flex items-center">
        <Barcode className={`absolute left-2.5 w-4 h-4 shrink-0 ${isHeader ? 'text-cyan-500' : 'text-cyan-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          placeholder={isHeader ? "Barcode Scan..." : "Quick Scan Barcode..."}
          className={`w-full text-xs placeholder-slate-400 pl-9 pr-14 py-1.5 rounded-lg border focus:outline-hidden transition shadow-inner ${
            isHeader 
              ? 'bg-slate-950/80 text-white border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
              : 'bg-slate-900 text-slate-100 border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
          }`}
          title="Direct numeric barcode lookup field. Supports physical hardware scanners or manual entry."
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {barcodeInput ? (
            <button
              type="submit"
              className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black rounded-md transition cursor-pointer shadow-xs"
            >
              SCAN
            </button>
          ) : (
            <span className="text-[8px] font-mono font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 select-none">
              ENTER
            </span>
          )}
        </div>
      </form>

      {/* Floating Status Feedback Indicators */}
      {errorMessage && (
        <div className="text-[10px] text-rose-400 font-bold bg-rose-950/60 border border-rose-900/60 px-2 py-1 rounded-md flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-900/60 px-2 py-1 rounded-md flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">{successMessage}</span>
        </div>
      )}
    </div>
  );
};
