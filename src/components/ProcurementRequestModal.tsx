import React, { useState } from 'react';
import { Mail, X, Check, Copy, ExternalLink, Send } from 'lucide-react';
import { MedicalDeviceItem } from '../types';

interface ProcurementRequestModalProps {
  selectedItem: MedicalDeviceItem | 'BULK' | null;
  onClose: () => void;
  filteredLowStockItems: MedicalDeviceItem[];
  recipient?: string;
  onRecipientChange?: (r: string) => void;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL';
  onPriorityChange?: (p: 'CRITICAL' | 'HIGH' | 'NORMAL') => void;
  reorderQty?: number;
  onReorderQtyChange?: (q: number) => void;
  note?: string;
  onNoteChange?: (n: string) => void;
  copiedSuccess?: boolean;
  onCopiedSuccessChange?: (c: boolean) => void;
  onToast?: (msg: string) => void;
}

export const ProcurementRequestModal: React.FC<ProcurementRequestModalProps> = ({
  selectedItem,
  onClose,
  filteredLowStockItems,
  recipient = 'procurement@epss.gov.et',
  onRecipientChange,
  priority = 'CRITICAL',
  onPriorityChange,
  reorderQty = 20,
  onReorderQtyChange,
  note = '',
  onNoteChange,
  copiedSuccess = false,
  onCopiedSuccessChange,
  onToast
}) => {
  const [localRecipient, setLocalRecipient] = useState(recipient);
  const [localPriority, setLocalPriority] = useState(priority);
  const [localQty, setLocalQty] = useState(reorderQty);
  const [localNote, setLocalNote] = useState(note);
  const [localCopied, setLocalCopied] = useState(copiedSuccess);

  if (!selectedItem) return null;

  const activeRecipient = onRecipientChange ? recipient : localRecipient;
  const setRecipient = (r: string) => {
    if (onRecipientChange) onRecipientChange(r);
    else setLocalRecipient(r);
  };

  const activePriority = onPriorityChange ? priority : localPriority;
  const setPriorityVal = (p: 'CRITICAL' | 'HIGH' | 'NORMAL') => {
    if (onPriorityChange) onPriorityChange(p);
    else setLocalPriority(p);
  };

  const activeQty = onReorderQtyChange ? reorderQty : localQty;
  const setQty = (q: number) => {
    if (onReorderQtyChange) onReorderQtyChange(q);
    else setLocalQty(q);
  };

  const activeNote = onNoteChange ? note : localNote;
  const setNoteVal = (n: string) => {
    if (onNoteChange) onNoteChange(n);
    else setLocalNote(n);
  };

  const isCopied = onCopiedSuccessChange ? copiedSuccess : localCopied;
  const setCopied = (c: boolean) => {
    if (onCopiedSuccessChange) onCopiedSuccessChange(c);
    else setLocalCopied(c);
  };

  const isBulk = selectedItem === 'BULK';

  const getEmailSubject = () => {
    return isBulk
      ? `[PROCUREMENT REQUEST - ${activePriority}] Bulk Low Stock Reorder (${filteredLowStockItems.length} Devices)`
      : `[PROCUREMENT REQUEST - ${activePriority}] Low Stock Reorder: ${selectedItem.materialDescription}`;
  };

  const getEmailBody = () => {
    if (isBulk) {
      return `EPSS PROCUREMENT BULK REORDER REQUEST\nPriority: ${activePriority}\n\nThe following ${filteredLowStockItems.length} medical devices are below threshold:\n` +
        filteredLowStockItems.map((i, idx) => `${idx + 1}. ${i.materialDescription} (Code: ${i.material}) - Current Stock: ${i.qty} units @ ${i.plantName}`).join('\n') +
        `\n\nNotes: ${activeNote || 'N/A'}\n\nEPSS Inventory Administration`;
    } else {
      return `EPSS PROCUREMENT REORDER REQUEST\nPriority: ${activePriority}\nItem: ${selectedItem.materialDescription} (Code: ${selectedItem.material})\nCurrent Stock: ${selectedItem.qty} units\nHub Location: ${selectedItem.plantName}\nRequested Quantity: ${activeQty} units\nNotes: ${activeNote || 'N/A'}\n\nEPSS Inventory Administration`;
    }
  };

  const handleCopy = () => {
    const text = `Subject: ${getEmailSubject()}\n\n${getEmailBody()}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (onToast) onToast('Reorder email text copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleMailto = () => {
    const mailto = `mailto:${encodeURIComponent(activeRecipient)}?subject=${encodeURIComponent(getEmailSubject())}&body=${encodeURIComponent(getEmailBody())}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-rose-950 px-6 py-4 flex items-center justify-between border-b border-rose-900">
          <div className="flex items-center gap-2.5 text-white">
            <Mail className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                {isBulk
                  ? `Bulk Procurement Reorder Request (${filteredLowStockItems.length} Items)`
                  : 'Trigger Procurement Request Email'}
              </h3>
              <p className="text-[11px] text-rose-200">
                Draft & dispatch official reorder request to EPSS Procurement Department
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-rose-300 hover:text-white hover:bg-rose-900 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Recipient Email:</label>
              <input
                type="email"
                value={activeRecipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Priority Level:</label>
              <select
                value={activePriority}
                onChange={(e: any) => setPriorityVal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-900 font-semibold"
              >
                <option value="CRITICAL">🔴 Critical (Immediate Reorder)</option>
                <option value="HIGH">🟠 High (Stock Depleting)</option>
                <option value="NORMAL">🔵 Routine Replenishment</option>
              </select>
            </div>
          </div>

          {!isBulk && (
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Recommended Reorder Quantity:</label>
              <input
                type="number"
                min="1"
                value={activeQty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Additional Justification / Notes:</label>
            <textarea
              rows={3}
              value={activeNote}
              onChange={(e) => setNoteVal(e.target.value)}
              placeholder="e.g. Critical ICU requirement, donor funding expiring soon..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-800">Generated Email Draft Preview:</label>
              <span className="text-[10px] text-slate-400 font-mono">auto-formatted</span>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800 select-all">
              {getEmailBody()}
            </pre>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{isCopied ? 'Copied to Clipboard' : 'Copy Email Text'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleMailto}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Open Mail Client</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
