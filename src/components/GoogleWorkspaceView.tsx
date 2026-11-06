import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  Tag, 
  FileText, 
  Send, 
  HelpCircle, 
  Sparkles, 
  Eye, 
  Paperclip,
  Check,
  AlertCircle,
  Copy,
  Sliders
} from 'lucide-react';
import {
  MaintenanceCalendarEvent,
  DeviceDocument,
  AlertNotification,
  MedicalDeviceItem,
  NoBkdItem
} from '../types';
import { 
  loadGmailTemplates, 
  saveGmailTemplates, 
  resetGmailTemplatesToDefaults, 
  formatGmailSubject, 
  formatGmailBody,
  DEFAULT_GMAIL_SUBJECT_TEMPLATE,
  DEFAULT_GMAIL_BODY_TEMPLATE
} from '../utils/gmailTemplates';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface GoogleWorkspaceViewProps {
  items: MedicalDeviceItem[];
  events: MaintenanceCalendarEvent[];
  documents: DeviceDocument[];
  alerts: AlertNotification[];
  onAddEvent: (event: MaintenanceCalendarEvent) => void;
  onSendAlert: (alert: AlertNotification) => void;
  onAddDocument: (doc: DeviceDocument) => void;
  selectedDeviceForAction?: MedicalDeviceItem | null;
  setItems?: React.Dispatch<React.SetStateAction<MedicalDeviceItem[]>>;
  noBkdItems?: NoBkdItem[];
  setNoBkdItems?: React.Dispatch<React.SetStateAction<NoBkdItem[]>>;
  isAdmin?: boolean;
  selectedSheetTabNames: string[];
  setSelectedSheetTabNames: React.Dispatch<React.SetStateAction<string[]>>;
  setAvailableSheetTitles?: React.Dispatch<React.SetStateAction<string[]>>;
}

export const GoogleWorkspaceView: React.FC<GoogleWorkspaceViewProps> = () => {
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [previewHasLetter, setPreviewHasLetter] = useState(false);
  const [activeInput, setActiveInput] = useState<'subject' | 'body' | null>('body');
  const [copiedText, setCopiedText] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Load stored templates on mount
  useEffect(() => {
    const loaded = loadGmailTemplates();
    setSubjectTemplate(loaded.customSubject);
    setBodyTemplate(loaded.customBody);
    setOfficialEmail(loaded.officialEmail);
    setCcEmail(loaded.ccEmail);
  }, []);

  const handleSave = () => {
    saveGmailTemplates(subjectTemplate, bodyTemplate, officialEmail, ccEmail);
    setSaveNotification('Gmail email templates and recipient settings saved successfully!');
    setTimeout(() => setSaveNotification(null), 3500);
  };

  const handleReset = () => {
    const defaults = resetGmailTemplatesToDefaults();
    setSubjectTemplate(defaults.subject);
    setBodyTemplate(defaults.body);
    setSaveNotification('Templates reset to factory defaults.');
    setTimeout(() => setSaveNotification(null), 3000);
  };

  const insertVariableTag = (tag: string) => {
    if (activeInput === 'subject') {
      const input = subjectRef.current;
      if (input) {
        const start = input.selectionStart || subjectTemplate.length;
        const end = input.selectionEnd || subjectTemplate.length;
        const newText = subjectTemplate.slice(0, start) + tag + subjectTemplate.slice(end);
        setSubjectTemplate(newText);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setSubjectTemplate(prev => prev + ' ' + tag);
      }
    } else {
      const textarea = bodyRef.current;
      if (textarea) {
        const start = textarea.selectionStart || bodyTemplate.length;
        const end = textarea.selectionEnd || bodyTemplate.length;
        const newText = bodyTemplate.slice(0, start) + tag + bodyTemplate.slice(end);
        setBodyTemplate(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setBodyTemplate(prev => prev + ' ' + tag);
      }
    }
  };

  // Sample data for rendering real live preview
  const sampleVars = {
    date: new Date().toISOString().split('T')[0],
    count: 8,
    qty: formatNumber(1450),
    valuation: formatCurrency(3850000),
    hasLetter: previewHasLetter
  };

  const renderedSubject = formatGmailSubject(subjectTemplate, sampleVars);
  const renderedBody = formatGmailBody(bodyTemplate, sampleVars);

  const handleOpenTestGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(officialEmail || '')}&cc=${encodeURIComponent(ccEmail)}&su=${encodeURIComponent(renderedSubject)}&body=${encodeURIComponent(renderedBody)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleCopyPreview = () => {
    const fullText = `Subject: ${renderedSubject}\n\n${renderedBody}`;
    navigator.clipboard.writeText(fullText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-600/30 border border-indigo-400/30 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-bold text-white">Gmail Template & Workspace Settings</h1>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle size={12} /> Gmail Data Transmission Always Enabled
                </span>
                <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-medium">
                  Drive & Sheets Integrations Disabled
                </span>
              </div>
              <p className="text-sm text-slate-300 max-w-2xl">
                Define pre-written subject lines and email body templates with dynamic variable tags (`{`date`}`, `{`count`}`, `{`qty`}`, `{`valuation`}`). Saved settings automatically apply when sending DSP inventory files through Gmail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save size={16} /> Save Templates
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Reset to factory default templates"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        </div>

        {/* Success Toast Banner */}
        {saveNotification && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{saveNotification}</span>
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Card 1: Default Recipients */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Default Recipient Coordinates</h2>
              </div>
              <span className="text-xs text-slate-400">Pre-populates Gmail composer</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Recipient Email (`To:`)
                </label>
                <input
                  type="email"
                  value={officialEmail}
                  onChange={(e) => setOfficialEmail(e.target.value)}
                  placeholder="e.g. mosisbme@gmail.com"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default CC Email (`Cc:`)
                </label>
                <input
                  type="email"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="e.g. audit_inventory@epss.gov.et"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Email Subject & Body Template Configuration */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Gmail Message & Subject Templates</h2>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-medium">
                Auto-Formatted
              </span>
            </div>

            {/* Variable Insertion Pills Bar */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" /> Click to Insert Variable Placeholder:
                </span>
                <span className="text-[11px] text-slate-400">
                  Target: {activeInput === 'subject' ? 'Subject Input' : 'Message Body'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '{date}', label: '{date} (Today)' },
                  { tag: '{count}', label: '{count} (Item Count)' },
                  { tag: '{qty}', label: '{qty} (Total Qty)' },
                  { tag: '{valuation}', label: '{valuation} (Value ETB)' },
                  { tag: '{letter_note}', label: '{letter_note} (Letter Status)' }
                ].map((item) => (
                  <button
                    key={item.tag}
                    onClick={() => insertVariableTag(item.tag)}
                    type="button"
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-mono font-medium rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>+</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Template Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Custom Gmail Subject Line Template
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInput('subject')}
                  className={`text-[11px] px-2 py-0.5 rounded ${activeInput === 'subject' ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {activeInput === 'subject' ? '• Active Field' : 'Select'}
                </button>
              </div>
              <input
                ref={subjectRef}
                type="text"
                value={subjectTemplate}
                onFocus={() => setActiveInput('subject')}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                placeholder="e.g. Official DSP Request: EPSS to MOH - {date}"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Body Template Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Pre-Written Gmail Email Body Template
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInput('body')}
                  className={`text-[11px] px-2 py-0.5 rounded ${activeInput === 'body' ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {activeInput === 'body' ? '• Active Field' : 'Select'}
                </button>
              </div>
              <textarea
                ref={bodyRef}
                rows={9}
                value={bodyTemplate}
                onFocus={() => setActiveInput('body')}
                onChange={(e) => setBodyTemplate(e.target.value)}
                placeholder="Write pre-written message body with variable placeholders..."
                className="w-full px-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono leading-relaxed"
              />
            </div>

            {/* Action buttons footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenTestGmail}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <Send size={14} className="text-indigo-600" /> Launch Test Gmail Composer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} /> Save Templates
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Live Preview & Variable Reference Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Card: Live Real-Time Rendering Preview */}
          <div className="bg-slate-900 rounded-2xl p-5 text-slate-100 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Live Rendered Gmail Preview</h3>
              </div>
              <button
                onClick={handleCopyPreview}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedText ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedText ? 'Copied' : 'Copy Preview'}</span>
              </button>
            </div>

            {/* Interactive Preview Controls */}
            <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50 text-xs">
              <span className="text-slate-300">Simulate Covering Letter:</span>
              <button
                type="button"
                onClick={() => setPreviewHasLetter(!previewHasLetter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewHasLetter 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {previewHasLetter ? '✓ Letter PDF Attached' : '✗ No Letter (Default)'}
              </button>
            </div>

            {/* Mock Gmail Window Component */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
              
              {/* Window Header */}
              <div className="bg-slate-900 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-slate-400 font-medium ml-2">Gmail Draft Preview</span>
                </div>
                <span className="text-[10px] text-slate-500">Live Sample Data</span>
              </div>

              {/* Envelope Headers */}
              <div className="p-3.5 space-y-2 border-b border-slate-800/80 bg-slate-900/40 font-mono text-[11px]">
                <div className="flex">
                  <span className="text-slate-500 w-16 shrink-0">To:</span>
                  <span className="text-slate-200 truncate">{officialEmail || '—'}</span>
                </div>
                {ccEmail && (
                  <div className="flex">
                    <span className="text-slate-500 w-16 shrink-0">Cc:</span>
                    <span className="text-slate-300 truncate">{ccEmail}</span>
                  </div>
                )}
                <div className="flex pt-1 border-t border-slate-800/60">
                  <span className="text-indigo-400 font-bold w-16 shrink-0">Subject:</span>
                  <span className="text-white font-semibold break-words">{renderedSubject}</span>
                </div>
              </div>

              {/* Body Text */}
              <div className="p-3.5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {renderedBody}
              </div>

              {/* Simulated Binary Attachments Bar */}
              <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 flex-wrap text-[10px]">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Paperclip size={11} className="text-indigo-400" /> Attached Binary Files:
                </span>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                  📊 DSP_Request_MOH_{sampleVars.date}.xlsx (38.2 KB)
                </span>
                {previewHasLetter && (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                    📄 Official_Cover_Letter.pdf (142 KB)
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* Card: Placeholder Variable Cheat Sheet */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Variable Placeholder Guide</h3>
            </div>

            <p className="text-xs text-slate-500">
              When creating a request in `DSPRequestModal`, these placeholders automatically expand into real stock values:
            </p>

            <div className="space-y-2 text-xs">
              {[
                { var: '{date}', desc: 'Current transmission date', sample: sampleVars.date },
                { var: '{count}', desc: 'Number of selected inventory line items', sample: '8 items' },
                { var: '{qty}', desc: 'Total aggregate stock equipment quantity', sample: sampleVars.qty },
                { var: '{valuation}', desc: 'Total monetary stock valuation (ETB)', sample: sampleVars.valuation },
                { var: '{letter_note}', desc: 'Note appended if covering letter is not uploaded', sample: 'Note: No covering letter attached.' }
              ].map((item) => (
                <div key={item.var} className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 flex items-start justify-between gap-2">
                  <div>
                    <code className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                      {item.var}
                    </code>
                    <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shrink-0">
                    {item.sample}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
