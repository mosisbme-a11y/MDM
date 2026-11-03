import React, { useState, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Check, 
  MapPin, 
  Database, 
  Plus, 
  FileSpreadsheet, 
  Layers, 
  Info, 
  AlertCircle,
  Wrench,
  FileText,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Download
} from 'lucide-react';
import { MedicalDeviceItem, NoBkdItem, DeviceDocument } from '../types';

interface HFMasterDataRegionalUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  onApplyMappings: (mappings: Record<string, string>) => void;
  documents?: DeviceDocument[];
  onAddDocument?: (doc: DeviceDocument) => void;
  onBulkUploadBreakdowns?: (breakdowns: NoBkdItem[]) => void;
}

const REGION_OPTIONS = [
  'Addis Ababa',
  'Oromia',
  'Amhara',
  'Tigray',
  'Somali',
  'Sidama',
  'Afar',
  'Southern Ethiopia',
  'South West Ethiopia',
  'Central Ethiopia',
  'Benishangul-Gumuz',
  'Gambela',
  'Harari',
  'Dire Dawa',
  'Ethiopia'
];

export const HFMasterDataRegionalUploadModal: React.FC<HFMasterDataRegionalUploadModalProps> = ({
  isOpen,
  onClose,
  items,
  onApplyMappings,
  documents = [],
  onAddDocument,
  onBulkUploadBreakdowns
}) => {
  // Main Tab selection: 'mapping' | 'breakdowns' | 'summaries'
  const [activeTab, setActiveTab] = useState<'mapping' | 'breakdowns' | 'summaries'>('mapping');

  // TAB 1 (Mapping) State
  const [activeSubTab, setActiveSubTab] = useState<'interactive' | 'paste'>('interactive');
  const [selectedRegion, setSelectedRegion] = useState('Addis Ababa');
  const [customRegion, setCustomRegion] = useState('');
  const [checkedFacilities, setCheckedFacilities] = useState<Record<string, boolean>>({});
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // TAB 2 (MOH Breakdown Upload) State
  const [breakdownPasteText, setBreakdownPasteText] = useState('');
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [targetBreakdownHub, setTargetBreakdownHub] = useState('HO01');

  // TAB 3 (MOH Regional Summary Upload) State
  const [summaryRegion, setSummaryRegion] = useState('Addis Ababa');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [summaryLink, setSummaryLink] = useState('https://drive.google.com/');
  const [summaryRefNumber, setSummaryRefNumber] = useState('');
  const [summaryUploadFeedback, setSummaryUploadFeedback] = useState<string | null>(null);
  const [summarySearchQuery, setSummarySearchQuery] = useState('');
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);

  // Extract unique facilities (plants) from items
  const uniqueFacilities = useMemo(() => {
    const facilitiesMap: Record<string, { plant: string; plantName: string; count: number; currentRegion: string }> = {};
    items.forEach((item) => {
      if (!facilitiesMap[item.plant]) {
        facilitiesMap[item.plant] = {
          plant: item.plant,
          plantName: item.plantName || item.plant,
          count: 0,
          currentRegion: item.additionalAttributes?.region || 'Ethiopia'
        };
      }
      facilitiesMap[item.plant].count += item.qty;
    });
    return Object.values(facilitiesMap).sort((a, b) => b.count - a.count);
  }, [items]);

  // Extract the list of Regional Summaries uploaded in documents
  const regionalSummaryDocs = useMemo(() => {
    return documents.filter((doc) => 
      doc.type === 'Regional Breakdown Report' || 
      doc.title.toUpperCase().includes('REGIONAL SUMMARY') ||
      doc.title.toUpperCase().includes('MOH REPORT SUMMARY')
    );
  }, [documents]);

  if (!isOpen) return null;

  const currentRegionToAssign = selectedRegion === 'custom' ? customRegion.trim() : selectedRegion;

  // Handle Tab 1 - Interactive Mapping
  const handleInteractiveSubmit = () => {
    const mappings: Record<string, string> = {};
    let count = 0;
    
    uniqueFacilities.forEach((facility) => {
      if (checkedFacilities[facility.plant]) {
        mappings[facility.plant] = currentRegionToAssign || 'Ethiopia';
        count++;
      }
    });

    if (count === 0) {
      alert('Please select at least one health facility to map.');
      return;
    }

    onApplyMappings(mappings);
    setCheckedFacilities({});
    onClose();
  };

  // Handle Tab 1 - Paste Mapping
  const handlePasteSubmit = () => {
    setPasteError(null);
    if (!pasteText.trim()) {
      setPasteError('Please enter some regional mapping data.');
      return;
    }

    const lines = pasteText.split('\n');
    const mappings: Record<string, string> = {};
    let parsedCount = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[\t,;|]+/);
      if (parts.length >= 2) {
        const facilityKey = parts[0].trim();
        const regionValue = parts[1].trim();
        if (facilityKey && regionValue) {
          mappings[facilityKey] = regionValue;
          parsedCount++;
        }
      }
    });

    if (parsedCount === 0) {
      setPasteError('Could not parse any valid facility-to-region rows. Format: "FacilityName, RegionName"');
      return;
    }

    onApplyMappings(mappings);
    setPasteText('');
    onClose();
  };

  // Handle Tab 2 - Bulk Breakdown Upload
  const handleBreakdownPasteSubmit = () => {
    setBreakdownError(null);
    if (!breakdownPasteText.trim()) {
      setBreakdownError('Please paste breakdown logs to upload.');
      return;
    }

    if (!onBulkUploadBreakdowns) {
      setBreakdownError('Bulk breakdown uploading is disabled in the current session.');
      return;
    }

    const lines = breakdownPasteText.split('\n');
    const parsedBreakdowns: NoBkdItem[] = [];
    const timestamp = Date.now();

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Columns: ItemCode, Description, Quantity, Hub, Remark
      const parts = trimmed.split(/[\t,;|]+/);
      if (parts.length >= 2) {
        const code = parts[0].trim();
        const description = parts[1].trim();
        const qty = parts[2] ? parseInt(parts[2].trim(), 10) || 1 : 1;
        const plant = parts[3] ? parts[3].trim() : targetBreakdownHub;
        const remark = parts[4] ? parts[4].trim() : 'MOH reported breakdown event';

        parsedBreakdowns.push({
          id: `MOH-BKD-${timestamp}-${index + 1}`,
          code,
          description,
          qty,
          unit: 'Units',
          plant,
          storageLocation: 'MOH Defect Area',
          wbsElement: 'MOH Allocation Plan',
          remark,
          mohApprovalStatus: 'Pending'
        });
      }
    });

    if (parsedBreakdowns.length === 0) {
      setBreakdownError('No valid breakdown logs could be parsed. Please check the delimiter structure (tabs or commas). Format: "ItemCode, ItemDescription, Quantity, HubName, Remarks"');
      return;
    }

    onBulkUploadBreakdowns(parsedBreakdowns);
    setBreakdownPasteText('');
    onClose();
  };

  // Handle Tab 3 - Upload Summary Document
  const handleSummaryUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSummaryUploadFeedback(null);

    if (!summaryTitle.trim()) {
      setSummaryUploadFeedback('Error: Report Summary Title is required.');
      return;
    }

    if (!onAddDocument) {
      setSummaryUploadFeedback('Error: Document upload actions are unavailable in this view.');
      return;
    }

    const referenceNo = summaryRefNumber.trim() || `MOH-REP-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDoc: DeviceDocument = {
      id: `DOC-SUMM-${Date.now()}`,
      title: `${summaryTitle} [Region: ${summaryRegion}]`,
      deviceModel: 'Regional Hub Aggregations',
      type: 'Regional Breakdown Report',
      fileSize: '1.4 MB',
      lastUpdated: new Date().toISOString().slice(0, 10),
      driveLink: summaryLink.trim() || 'https://drive.google.com/',
      manufacturer: 'MOH / EPSS Health Systems',
      category: 'Breakdown Reports',
      referenceNumber: referenceNo,
      issuedDate: new Date().toISOString().slice(0, 10),
      status: 'Approved',
      recipientFacility: `${summaryRegion} MOH Bureau`,
      notes: summaryNotes.trim() || `Official MOH Summary mapping for ${summaryRegion}`
    };

    onAddDocument(newDoc);
    setSummaryTitle('');
    setSummaryNotes('');
    setSummaryRefNumber('');
    setSummaryUploadFeedback('Success! Region summary uploaded and archived successfully under MOH reports.');
    
    // Clear success banner after 3 seconds
    setTimeout(() => {
      setSummaryUploadFeedback(null);
    }, 3500);
  };

  const handleToggleSelectAll = () => {
    const allChecked = uniqueFacilities.every((f) => checkedFacilities[f.plant]);
    if (allChecked) {
      setCheckedFacilities({});
    } else {
      const next: Record<string, boolean> = {};
      uniqueFacilities.forEach((f) => {
        next[f.plant] = true;
      });
      setCheckedFacilities(next);
    }
  };

  const filteredSummaryDocs = regionalSummaryDocs.filter(doc => 
    doc.title.toLowerCase().includes(summarySearchQuery.toLowerCase()) ||
    doc.notes?.toLowerCase().includes(summarySearchQuery.toLowerCase()) ||
    doc.recipientFacility?.toLowerCase().includes(summarySearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight uppercase">
                HF MASTER DATA: MOH Administrative Center
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Manage regional mappings, MoH breakdown data, and regional report summaries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1 shrink-0 gap-1 font-sans">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-2xl transition cursor-pointer ${
              activeTab === 'mapping'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>Region Mappings</span>
          </button>
          
          <button
            onClick={() => setActiveTab('breakdowns')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-2xl transition cursor-pointer ${
              activeTab === 'breakdowns'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Wrench className="w-4 h-4 text-indigo-400" />
            <span>MOH Breakdowns</span>
          </button>

          <button
            onClick={() => setActiveTab('summaries')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-2xl transition cursor-pointer ${
              activeTab === 'summaries'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>MOH Region Summaries</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-white">
          
          {/* TAB 1: REGIONAL FACILITY MAPPING */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="flex border-b border-slate-100 bg-slate-50 p-1.5 rounded-2xl gap-1">
                <button
                  onClick={() => setActiveSubTab('interactive')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                    activeSubTab === 'interactive'
                      ? 'bg-white text-cyan-950 border border-slate-200/60 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Interactive Assigner</span>
                </button>
                <button
                  onClick={() => setActiveSubTab('paste')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                    activeSubTab === 'paste'
                      ? 'bg-white text-cyan-950 border border-slate-200/60 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bulk Excel / CSV Paste</span>
                </button>
              </div>

              {activeSubTab === 'interactive' ? (
                <div className="space-y-4">
                  <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-2xl flex items-start gap-3 text-xs text-cyan-950">
                    <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Interactive Assigner:</span> Check multiple health facilities (hubs) from your database, choose a region, and assign them all at once!
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      Select Region to Assign:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {REGION_OPTIONS.map((region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setSelectedRegion(region)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold text-left transition cursor-pointer border ${
                            selectedRegion === region
                              ? 'bg-cyan-50 text-cyan-950 border-cyan-300 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {region}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedRegion('custom')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold text-left transition cursor-pointer border ${
                          selectedRegion === 'custom'
                            ? 'bg-cyan-50 text-cyan-950 border-cyan-300 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        + Custom Region
                      </button>
                    </div>

                    {selectedRegion === 'custom' && (
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="Type custom region name..."
                          value={customRegion}
                          onChange={(e) => setCustomRegion(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                      <span>Select Health Facilities / Hubs ({uniqueFacilities.length})</span>
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-cyan-600 hover:underline cursor-pointer"
                      >
                        {uniqueFacilities.every((f) => checkedFacilities[f.plant]) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {uniqueFacilities.map((facility) => {
                        const isChecked = !!checkedFacilities[facility.plant];
                        return (
                          <label
                            key={facility.plant}
                            className={`flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition cursor-pointer text-xs ${
                              isChecked ? 'bg-cyan-50/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setCheckedFacilities((prev) => ({
                                    ...prev,
                                    [facility.plant]: e.target.checked
                                  }));
                                }}
                                className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                              />
                              <div className="flex flex-col py-1">
                                <span className="font-bold text-slate-800">{facility.plant}</span>
                                <span className="text-[10px] text-slate-400">{facility.plantName}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-100">
                              {facility.currentRegion}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-950">
                    <span className="font-bold">Excel Copy-Paste:</span> Paste columns from your spreadsheet.
                    <div className="mt-1 font-semibold text-[11px] text-emerald-800">
                      Format: <code className="bg-emerald-100/60 px-1 rounded font-mono">FacilityName, RegionName</code> (one row per line).
                    </div>
                  </div>

                  {pasteError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-950 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{pasteError}</span>
                    </div>
                  )}

                  <textarea
                    placeholder="Example:&#10;Addis Ababa Regional Hub, Addis Ababa&#10;Hawassa Regional Hub, Southern Ethiopia&#10;Mekelle Regional Hub, Tigray"
                    rows={6}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 font-mono focus:outline-none focus:bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MOH BREAKDOWN MULTI-UPLOAD */}
          {activeTab === 'breakdowns' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">MOH Bulk Breakdown Importer:</span> Upload multi-record breakdown registers sent by the Ministry of Health to regional hubs.
                  <div className="mt-1 font-semibold text-[11px] text-indigo-800">
                    Expected columns: <code className="bg-indigo-100/60 px-1 rounded font-mono">MaterialCode, MaterialDescription, Quantity, HubCode, Remarks</code>
                  </div>
                </div>
              </div>

              {breakdownError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-950 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{breakdownError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Default Destination Hub (used if Hub is omitted in pasted text):
                  </label>
                  <select
                    value={targetBreakdownHub}
                    onChange={(e) => setTargetBreakdownHub(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none"
                  >
                    {uniqueFacilities.map((f) => (
                      <option key={f.plant} value={f.plant}>
                        {f.plant} - {f.plantName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Paste Breakdown Rows (tab-delimited Excel rows or comma-separated values):
                </label>
                <textarea
                  placeholder="Example:&#10;10001092&#9;Ventilator ICU Complete&#9;2&#9;Addis Ababa Hub&#9;High-pressure gas line failure&#10;10001402&#9;Defibrillator Bifocal&#9;1&#9;Hawassa Hub&#9;Faulty battery pack replacement required"
                  rows={8}
                  value={breakdownPasteText}
                  onChange={(e) => setBreakdownPasteText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 font-mono focus:outline-none focus:bg-white transition"
                />
              </div>
            </div>
          )}

          {/* TAB 3: REGIONAL SUMMARY REPORT UPLOAD */}
          {activeTab === 'summaries' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">MOH Regional Report Summarizer:</span> Upload and archive detailed regional medical device SOH summary reports to MoH.
                </div>
              </div>

              {summaryUploadFeedback && (
                <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
                  summaryUploadFeedback.includes('Error') 
                    ? 'bg-rose-50 border border-rose-100 text-rose-950' 
                    : 'bg-emerald-50 border border-emerald-100 text-emerald-950'
                }`}>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">{summaryUploadFeedback}</span>
                </div>
              )}

              {/* Upload Form */}
              <form onSubmit={handleSummaryUploadSubmit} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200/60 pb-1.5">
                  📁 Create Regional Summary Report
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Target Region:</label>
                    <select
                      value={summaryRegion}
                      onChange={(e) => setSummaryRegion(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      {REGION_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Official Reference Number:</label>
                    <input
                      type="text"
                      placeholder="e.g. MOH/MDI/2026-90"
                      value={summaryRefNumber}
                      onChange={(e) => setSummaryRefNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Report Summary Title:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q3 SOH Breakdown and Inventory Audit Report"
                    value={summaryTitle}
                    onChange={(e) => setSummaryTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Google Drive Document Link:</label>
                    <input
                      type="text"
                      placeholder="https://drive.google.com/..."
                      value={summaryLink}
                      onChange={(e) => setSummaryLink(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Report Metadata (Optional File Info):</label>
                    <div className="text-[11px] bg-white border border-slate-200 text-slate-500 rounded-xl px-3 py-2 flex items-center justify-between">
                      <span>File Format: <strong>PDF Document</strong></span>
                      <span>Target size: <strong>~1.4 MB</strong></span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Key Summary Highlights / Executive Notes:</label>
                  <textarea
                    rows={3}
                    placeholder="Summarize the regional breakdown findings for MOH (e.g. 'Functional items: 231, Total defective: 14. Severe ICU downtime detected in Addis Ababa Hub. Main spare parts dispatch required immediately.')"
                    value={summaryNotes}
                    onChange={(e) => setSummaryNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition cursor-pointer shadow-sm"
                  >
                    + Add to Regional Summary Archive
                  </button>
                </div>
              </form>

              {/* Uploaded Summaries List */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    📂 Archived MOH Regional Summaries ({filteredSummaryDocs.length})
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search archived summaries..."
                      value={summarySearchQuery}
                      onChange={(e) => setSummarySearchQuery(e.target.value)}
                      className="pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none w-44"
                    />
                  </div>
                </div>

                {filteredSummaryDocs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No matching regional MOH summary reports found. Try adding a new summary above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {filteredSummaryDocs.map((doc) => (
                      <div key={doc.id} className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-300 hover:shadow-xs transition space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 line-clamp-1">
                                {doc.title}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Ref: {doc.referenceNumber || 'N/A'} • {doc.lastUpdated}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                            MOH Copy
                          </span>
                        </div>
                        
                        {doc.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl">
                            "{doc.notes}"
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-400 font-medium">
                          <span>Recipient: <strong>{doc.recipientFacility}</strong></span>
                          <a 
                            href={doc.driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-600 hover:underline font-bold flex items-center gap-0.5"
                          >
                            <Download className="w-3 h-3" /> Download Report
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
          >
            Close Portal
          </button>
          
          {activeTab === 'mapping' && (
            activeSubTab === 'interactive' ? (
              !isConfirmingSubmit ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingSubmit(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-600 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Submit Mapping</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">Confirm Mapping?</span>
                  <button onClick={() => setIsConfirmingSubmit(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Back</button>
                  <button onClick={handleInteractiveSubmit} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl">Confirm & Apply</button>
                </div>
              )
            ) : (
              !isConfirmingSubmit ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingSubmit(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Submit Bulk Map</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">Confirm Bulk Mapping?</span>
                  <button onClick={() => setIsConfirmingSubmit(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Back</button>
                  <button onClick={handlePasteSubmit} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl">Confirm & Upload</button>
                </div>
              )
            )
          )}

          {activeTab === 'breakdowns' && (
            !isConfirmingSubmit ? (
              <button
                type="button"
                onClick={() => setIsConfirmingSubmit(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-600 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Submit Breakdown Logs</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">Confirm Ingestion?</span>
                <button onClick={() => setIsConfirmingSubmit(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Back</button>
                <button onClick={handleBreakdownPasteSubmit} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl">Confirm & Import</button>
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
};
