import React, { useState } from 'react';
import { Clock, X, Check, Copy, ExternalLink, Send } from 'lucide-react';
import { MedicalDeviceItem } from '../types';

export interface ExpiringItemDetail extends MedicalDeviceItem {
  daysRemaining: number;
  expiryUrgency: 'expired' | 'critical' | 'warning' | 'notice';
  formattedExpiry: string;
}

interface ExpiryNotificationModalProps {
  selectedItem: any;
  onClose: () => void;
  filteredExpiringItems: ExpiringItemDetail[];
  expiryFilterDays: number;
  recipient?: string;
  onRecipientChange?: (r: string) => void;
  note?: string;
  onNoteChange?: (n: string) => void;
  copiedSuccess?: boolean;
  onCopiedSuccessChange?: (c: boolean) => void;
  onToast?: (msg: string) => void;
}

export const ExpiryNotificationModal: React.FC<ExpiryNotificationModalProps> = ({
  selectedItem,
  onClose,
  filteredExpiringItems,
  expiryFilterDays,
  recipient = 'quality.assurance@epss.gov.et',
  onRecipientChange,
  note = '',
  onNoteChange,
  copiedSuccess = false,
  onCopiedSuccessChange,
  onToast
}) => {
  const [localRecipient, setLocalRecipient] = useState(recipient);
  const [localNote, setLocalNote] = useState(note);
  const [localCopied, setLocalCopied] = useState(copiedSuccess);

  if (!selectedItem) return null;

  const activeRecipient = onRecipientChange ? recipient : localRecipient;
  const setRecipient = (r: string) => {
    if (onRecipientChange) onRecipientChange(r);
    else setLocalRecipient(r);
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

  const isBulk = selectedItem === 'BULK_EXPIRY';

  const getEmailSubject = () => {
    return isBulk
      ? `[QA URGENT - EXPIRY NOTICE] Bulk Shelf-Life Alert (${filteredExpiringItems.length} Batches)`
      : `[QA URGENT - EXPIRY NOTICE] Expiring Batch: ${selectedItem.materialDescription}`;
  };

  const getEmailBody = () => {
    if (isBulk) {
      return `EPSS QUALITY ASSURANCE BULK EXPIRY NOTICE\nHorizon: Within ${expiryFilterDays} Days\nTotal Expiring Items: ${filteredExpiringItems.length}\n\nList of Expiring Batches:\n` +
        filteredExpiringItems.map((i, idx) => `${idx + 1}. ${i.materialDescription} (Code: ${i.material}) - Batch: ${i.batch || 'N/A'} - Exp: ${i.formattedExpiry || i.expiryDate} - Qty: ${i.qty} @ ${i.plantName}`).join('\n') +
        `\n\nNotes: ${activeNote || 'N/A'}\n\nEPSS Quality Assurance Department`;
    } else {
      return `EPSS QUALITY ASSURANCE EXPIRY NOTICE\nDevice: ${selectedItem.materialDescription}\nMaterial Code: ${selectedItem.material}\nBatch Number: ${selectedItem.batch || 'N/A'}\nExpiry Date: ${selectedItem.formattedExpiry || selectedItem.expiryDate}\nCurrent Stock: ${selectedItem.qty} units\nHub Location: ${selectedItem.plantName || selectedItem.plant}\n\nNotes: ${activeNote || 'N/A'}\n\nEPSS Quality Assurance Department`;
    }
  };

  const handleCopy = () => {
    const text = `Subject: ${getEmailSubject()}\n\n${getEmailBody()}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (onToast) onToast('Expiry alert text copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleMailto = () => {
    const mailto = `mailto:${encodeURIComponent(activeRecipient)}?subject=${encodeURIComponent(getEmailSubject())}&body=${encodeURIComponent(getEmailBody())}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-amber-200">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Clock className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isBulk
                  ? `QA Expiry Notification (${filteredExpiringItems.length} Batches)`
                  : `QA Expiry Notification: ${selectedItem.materialDescription}`}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Dispatch quality assurance shelf-life advisory to regional warehouse officers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient (QA / Regional Warehouse):
              </label>
              <input
                type="email"
                value={activeRecipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horizon Filter Active:
              </label>
              <div className="px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 font-bold rounded-xl flex items-center justify-between">
                <span>Expiring within {expiryFilterDays} Days</span>
                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] font-mono">
                  {filteredExpiringItems.length} Batches
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quality Assurance Notes & Required Actions:
            </label>
            <textarea
              value={activeNote}
              onChange={(e) => setNoteVal(e.target.value)}
              placeholder="Specify quarantine, rapid redistribution, or laboratory testing instructions..."
              rows={3}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Official Notice Body Preview:</label>
              <span className="text-[10px] text-slate-400 font-mono">auto-formatted</span>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800 select-all">
              {getEmailBody()}
            </pre>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{isCopied ? 'Copied to Clipboard' : 'Copy Notice Text'}</span>
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm cursor-pointer"
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
