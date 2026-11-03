import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Building2,
  Search,
  Download,
  Filter,
  Layers,
  MapPin,
  Hospital,
  ChevronDown,
  ChevronUp,
  Package,
  FileSpreadsheet,
  ArrowRight,
  PlusCircle,
  Eye,
  CheckCircle2,
  Trash2,
  Upload,
  Globe,
  ShieldCheck,
  X,
  Plus,
  RefreshCw,
  Zap,
  Check,
  AlertTriangle,
  Loader2,
  FileCheck,
  BarChart3,
  PieChart
} from 'lucide-react';
import { HealthFacilityRecord, PlantSummary } from '../types';
import { downloadCSV } from '../utils/formatters';
import { HFListUploadModal, parseHealthFacilityRows, parseHealthFacilityWorkbook } from './HFListUploadModal';
import { ALL_ETHIOPIAN_REGIONS } from './RegionBreakdownMatrixTable';
import { uploadAndRecordFile } from '../utils/fileUploadService';
import { ETHIOPIAN_HEALTH_FACILITIES_7500 } from '../data/ethiopianHealthFacilities7500';

const REGION_BAR_COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky / Cyan
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#d97706', // Amber
  '#2563eb', // Blue
  '#e11d48', // Rose
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#8b5cf6', // Purple
  '#0891b2', // Cyan-600
  '#65a30d', // Lime
];

interface HFListViewProps {
  items: HealthFacilityRecord[];
  plants?: PlantSummary[];
  onSelectItem?: (item: HealthFacilityRecord) => void;
  onFilterPlant?: (plantCode: string) => void;
  onClearAllHFData?: () => void;
  onUploadHFData?: (items: HealthFacilityRecord[], mode: 'replace' | 'append', files?: { name: string, url: string }[]) => void;
  onAddFacility?: (facility: HealthFacilityRecord) => void;
  onDeleteFacility?: (id: string) => void;
  isAdmin?: boolean;
}

export const HFListView: React.FC<HFListViewProps> = ({
  items,
  plants = [],
  onSelectItem,
  onFilterPlant,
  onClearAllHFData,
  onUploadHFData,
  onAddFacility,
  onDeleteFacility,
  isAdmin = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedOwnership, setSelectedOwnership] = useState<string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFacilityModal, setActiveFacilityModal] = useState<HealthFacilityRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Direct file browser picker refs and state
  const directFileInputRef = useRef<HTMLInputElement>(null);
  const [stagedParsedItems, setStagedParsedItems] = useState<HealthFacilityRecord[]>([]);
  const [stagedFileName, setStagedFileName] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');

  // Auto-record immediately toggle setting (default: true for instant recording)
  const [autoRecordImmediate, setAutoRecordImmediate] = useState<boolean>(() => {
    const saved = localStorage.getItem('epss_hf_auto_record');
    return saved === null ? true : saved === 'true';
  });

  // Pending multiple upload batch confirmation state (for review before save)
  const [pendingBatch, setPendingBatch] = useState<{
    files: { name: string; count: number; sizeStr?: string }[];
    items: HealthFacilityRecord[];
    totalCount: number;
    timestamp: number;
  } | null>(null);

  const [isPreviewBatchExpanded, setIsPreviewBatchExpanded] = useState(false);

  // Regional bar graph display options
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [isPlantChartVisible, setIsPlantChartVisible] = useState(true);
  const [chartViewMode, setChartViewMode] = useState<'bar' | 'ranked'>('bar');

  // Region Drilldown Expansion State
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [regionDrilldownSearch, setRegionDrilldownSearch] = useState<Record<string, string>>({});

  // Success / notification alert toast
  const [uploadToast, setUploadToast] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (uploadToast) {
      const t = setTimeout(() => setUploadToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [uploadToast]);

  // Read a single file asynchronously
  const readFileAsync = (file: File): Promise<HealthFacilityRecord[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      if (file.name.endsWith('.json')) {
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const parsed = JSON.parse(text);
            const rawRows = Array.isArray(parsed) ? parsed : parsed.items || parsed.facilities || [];
            const items = parseHealthFacilityRows(rawRows, file.name);
            resolve(items);
          } catch (err) {
            console.error('Failed to parse JSON file:', err);
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file);
      } else {
        // Excel (.xlsx, .xls) or CSV (.csv)
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            const items = parseHealthFacilityWorkbook(wb, file.name);
            resolve(items);
          } catch (err) {
            console.error('Failed to process spreadsheet:', err);
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Directly handle file selection from the browser picker (supports multiple files at once)
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessingFiles(true);
    setProcessingStatusText(`Reading ${files.length} file(s)... Parsing Health Facility records...`);

    const allItems: HealthFacilityRecord[] = [];
    const fileSummaries: { name: string; count: number; sizeStr?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingStatusText(`Processing ${i + 1} of ${files.length}: ${file.name}...`);
      const items = await readFileAsync(file);
      if (items.length > 0) {
        allItems.push(...items);
        fileSummaries.push({
          name: file.name,
          count: items.length,
          sizeStr: formatFileSize(file.size)
        });
        uploadAndRecordFile(file, 'HF Master List', items.length);
      }
    }

    setIsProcessingFiles(false);
    setProcessingStatusText('');
    e.target.value = '';

    if (allItems.length === 0) {
      setUploadToast({
        type: 'error',
        message: '⚠️ No valid Health Facility records found in the selected file(s). Please verify file column headers.'
      });
      return;
    }

    if (autoRecordImmediate) {
      // MODE 1: IMMEDIATELY RECORD AND SAVE DATA TO MEMORY & STORAGE
      if (onUploadHFData) {
        // Files were already stored in Supabase Storage above (uploadAndRecordFile)
        const uploadedFiles: { name: string, url: string }[] = [];
        onUploadHFData(allItems, 'append', uploadedFiles);
      }
      setUploadToast({
        type: 'success',
        message: `✓ Immediately recorded & saved ${allItems.length} facilities from ${files.length} file(s)! Synced to Supabase.`
      });
    } else {
      // MODE 2: DISPLAY MULTIPLE UPLOAD CONFIRMATION CARD FOR 1-CLICK SAVE
      setPendingBatch({
        files: fileSummaries,
        items: allItems,
        totalCount: allItems.length,
        timestamp: Date.now()
      });
      setIsPreviewBatchExpanded(false);
    }
  };

  // Opens native OS file picker reliably and immediately
  const handleOpenBrowserFilePicker = () => {
    if (directFileInputRef.current) {
      directFileInputRef.current.value = '';
      directFileInputRef.current.click();
    }
  };

  const handleCommitPendingBatch = (mode: 'append' | 'replace') => {
    if (!pendingBatch) return;
    if (onUploadHFData) {
      onUploadHFData(pendingBatch.items, mode);
    }
    setUploadToast({
      type: 'success',
      message: `✓ Confirmed & saved ${pendingBatch.totalCount} facilities from ${pendingBatch.files.length} file(s) (${
        mode === 'append' ? 'Appended & Merged' : 'Fresh List'
      })!`
    });
    setPendingBatch(null);
  };

  const toggleAutoRecord = () => {
    const next = !autoRecordImmediate;
    setAutoRecordImmediate(next);
    localStorage.setItem('epss_hf_auto_record', String(next));
    setUploadToast({
      type: 'info',
      message: next
        ? '⚡ Instant Auto-Record Enabled: Uploaded spreadsheets are recorded immediately into HF List.'
        : '📋 Review & Confirm Mode Enabled: Uploaded files will show a confirmation card before saving.'
    });
  };

  // New Facility Form State
  const [newFacility, setNewFacility] = useState<Omit<HealthFacilityRecord, 'id'>>({
    customer: '',
    customerDescription: '',
    facilityType: 'Hospital',
    deliveringPlant: 'HO01',
    ownershipCode: 'GOV',
    ownershipDescription: 'Public / Government',
    region: 'Addis Ababa',
    zoneCode: 'Z-01',
    zoneDescription: 'Central Zone',
    woreda: 'W-01',
    woredaDescription: 'Woreda 01'
  });

  const [selectedFacilityType, setSelectedFacilityType] = useState<string>('all');

  // Filter only valid records matching the 10 fields
  const validRecords = useMemo(() => {
    return items.filter((it) => it && (it.customer || it.customerDescription));
  }, [items]);

  // Unique Filter Lists
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    ALL_ETHIOPIAN_REGIONS.forEach((reg) => set.add(reg));
    validRecords.forEach((f) => {
      if (f.region) set.add(f.region.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [validRecords]);

  // Count of facilities per region for dropdown option badges and tooltips
  const regionFacilityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    validRecords.forEach((f) => {
      const reg = f.region?.trim() || '';
      if (reg) {
        map[reg] = (map[reg] || 0) + 1;
      }
    });
    return map;
  }, [validRecords]);

  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    validRecords.forEach((f) => {
      if (f.deliveringPlant) set.add(f.deliveringPlant);
    });
    return Array.from(set).sort();
  }, [validRecords]);

  const uniqueOwnerships = useMemo(() => {
    const set = new Set<string>();
    validRecords.forEach((f) => {
      if (f.ownershipDescription) set.add(f.ownershipDescription);
    });
    return Array.from(set).sort();
  }, [validRecords]);

  const uniqueFacilityTypes = useMemo(() => {
    const set = new Set<string>();
    validRecords.forEach((f) => {
      if (f.facilityType) set.add(f.facilityType);
    });
    return Array.from(set).sort();
  }, [validRecords]);

  // Regional distribution analytics data for the bar graph (Number of HF per region)
  const regionChartData = useMemo(() => {
    const counts: Record<string, { count: number; plants: Set<string>; ownerships: Set<string> }> = {};

    ALL_ETHIOPIAN_REGIONS.forEach((reg) => {
      counts[reg] = { count: 0, plants: new Set(), ownerships: new Set() };
    });

    validRecords.forEach((f) => {
      const reg = f.region?.trim() || 'Unassigned';
      if (!counts[reg]) {
        counts[reg] = { count: 0, plants: new Set(), ownerships: new Set() };
      }
      counts[reg].count += 1;
      if (f.deliveringPlant) counts[reg].plants.add(f.deliveringPlant);
      if (f.ownershipCode) counts[reg].ownerships.add(f.ownershipCode);
    });

    const total = validRecords.length || 1;

    return Object.entries(counts)
      .map(([region, data]) => ({
        region,
        count: data.count,
        percentage: Number(((data.count / total) * 100).toFixed(1)),
        plantsCount: data.plants.size,
        ownershipsCount: data.ownerships.size
      }))
      .sort((a, b) => b.count - a.count);
  }, [validRecords]);

  const topRegion = useMemo(() => {
    return regionChartData.length > 0 ? regionChartData[0] : null;
  }, [regionChartData]);

  const avgHfsPerRegion = useMemo(() => {
    if (regionChartData.length === 0) return '0';
    return (validRecords.length / regionChartData.length).toFixed(1);
  }, [validRecords.length, regionChartData.length]);

  // Plant distribution analytics data for the Circle Graph (Number of HF served by Plant)
  const plantCircleChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    validRecords.forEach((f) => {
      const plant = f.deliveringPlant?.trim() || 'Unassigned';
      counts[plant] = (counts[plant] || 0) + 1;
    });

    const total = validRecords.length || 1;
    const colors = [
      '#059669', '#0284c7', '#4f46e5', '#7c3aed', '#d97706',
      '#2563eb', '#e11d48', '#0d9488', '#ea580c', '#8b5cf6',
      '#0891b2', '#65a30d', '#db2777', '#38bdf8'
    ];

    return Object.entries(counts)
      .map(([plant, count], idx) => ({
        plant,
        count,
        percentage: Number(((count / total) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.count - a.count);
  }, [validRecords]);

  // Custom rich tooltip for the Regional Bar Graph
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200 p-3 rounded-xl shadow-lg text-xs space-y-1 font-sans">
          <div className="font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            <span>{data.region}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-700 pt-0.5">
            <span className="text-slate-500">Total Facilities:</span>
            <span className="font-bold text-emerald-600 font-mono">{data.count.toLocaleString()} HFs</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-700">
            <span className="text-slate-500">Share of Registry:</span>
            <span className="font-semibold text-cyan-700 font-mono">{data.percentage}%</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-700">
            <span className="text-slate-500">Serving Plants:</span>
            <span className="font-medium text-slate-800">{data.plantsCount} Hub(s)</span>
          </div>
          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
            Click bar to filter facility list below
          </div>
        </div>
      );
    }
    return null;
  };

  // Filtered facilities
  const filteredFacilities = useMemo(() => {
    return validRecords.filter((f) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (f.customer && f.customer.toLowerCase().includes(q)) ||
        (f.customerDescription && f.customerDescription.toLowerCase().includes(q)) ||
        (f.facilityType && f.facilityType.toLowerCase().includes(q)) ||
        (f.deliveringPlant && f.deliveringPlant.toLowerCase().includes(q)) ||
        (f.ownershipCode && f.ownershipCode.toLowerCase().includes(q)) ||
        (f.ownershipDescription && f.ownershipDescription.toLowerCase().includes(q)) ||
        (f.region && f.region.toLowerCase().includes(q)) ||
        (f.zoneCode && f.zoneCode.toLowerCase().includes(q)) ||
        (f.zoneDescription && f.zoneDescription.toLowerCase().includes(q)) ||
        (f.woreda && f.woreda.toLowerCase().includes(q)) ||
        (f.woredaDescription && f.woredaDescription.toLowerCase().includes(q));

      const matchesRegion =
        selectedRegion === 'all' ||
        (f.region && f.region.trim().toLowerCase() === selectedRegion.trim().toLowerCase());
      const matchesPlant = selectedPlant === 'all' || f.deliveringPlant === selectedPlant;
      const matchesOwnership = selectedOwnership === 'all' || f.ownershipDescription === selectedOwnership;
      const matchesFacilityType = selectedFacilityType === 'all' || f.facilityType === selectedFacilityType;

      return matchesSearch && matchesRegion && matchesPlant && matchesOwnership && matchesFacilityType;
    });
  }, [validRecords, searchQuery, selectedRegion, selectedPlant, selectedOwnership, selectedFacilityType]);

  // Export CSV with exact attributes including Facility Type
  const handleExportCSV = () => {
    if (filteredFacilities.length === 0) return;
    const data = filteredFacilities.map((f, idx) => ({
      '#': idx + 1,
      'Customer': f.customer,
      'Customer Description': f.customerDescription,
      'Facility Type': f.facilityType || 'Hospital',
      'Delivering Plant': f.deliveringPlant,
      'Ownership Code': f.ownershipCode,
      'Ownership Description': f.ownershipDescription,
      'Region': f.region,
      'Zone Code': f.zoneCode,
      'Zone Description': f.zoneDescription,
      'Woreda': f.woreda,
      'Woreda Description': f.woredaDescription
    }));
    downloadCSV(`EPSS_HF_List_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  const handleCreateFacilitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacility.customer.trim() || !newFacility.customerDescription.trim()) return;

    const record: HealthFacilityRecord = {
      id: `hf-${Date.now()}`,
      ...newFacility,
      uploadedAt: new Date().toISOString()
    };

    if (onAddFacility) {
      onAddFacility(record);
    } else if (onUploadHFData) {
      onUploadHFData([record], 'append');
    }

    setIsAddModalOpen(false);
    setNewFacility({
      customer: '',
      customerDescription: '',
      deliveringPlant: 'HO01',
      ownershipCode: 'GOV',
      ownershipDescription: 'Public / Government',
      region: 'Addis Ababa',
      zoneCode: 'Z-01',
      zoneDescription: 'Central Zone',
      woreda: 'W-01',
      woredaDescription: 'Woreda 01'
    });
  };

  return (
    <div className="space-y-4">
      {/* Off-screen Native Browser File Input - Triggers file selection immediately across all browsers and iframes */}
      <input
        id="hf-browser-file-picker"
        type="file"
        ref={directFileInputRef}
        onChange={handleDirectFileUpload}
        multiple
        accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          opacity: 0,
          width: '1px',
          height: '1px',
          pointerEvents: 'none'
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Upload Toast Banner */}
      {uploadToast && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            uploadToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : uploadToast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-cyan-50 border-cyan-200 text-cyan-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : uploadToast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-cyan-600 shrink-0" />
            )}
            <span>{uploadToast.message}</span>
          </div>
          <button
            onClick={() => setUploadToast(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-800 cursor-pointer ml-3"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessingFiles && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2.5 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span>{processingStatusText || 'Reading spreadsheet files and parsing Health Facility records...'}</span>
        </div>
      )}

      {/* Multiple Upload Confirmation & Staging Card */}
      {pendingBatch && (
        <div className="bg-gradient-to-r from-emerald-50/90 via-cyan-50/80 to-white border-2 border-emerald-300 rounded-2xl p-4 shadow-md space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Multiple Upload Ingested — Ready to Confirm & Save
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                    {pendingBatch.files.length} File{pendingBatch.files.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Detected <strong className="text-emerald-700">{pendingBatch.totalCount.toLocaleString()}</strong> health facility records matching the 10 standard schema attributes.
                </p>
              </div>
            </div>

            {/* Confirmation Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleCommitPendingBatch('append')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                title="Append and merge new records with any existing health facilities"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Append ({pendingBatch.totalCount})</span>
              </button>

              <button
                onClick={() => handleCommitPendingBatch('replace')}
                className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                title="Replace all current records and start fresh with these uploaded files"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Confirm & Replace All</span>
              </button>

              <button
                onClick={() => setPendingBatch(null)}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
                title="Dismiss and discard this upload batch"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Files Breakdown Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Batch Files:
            </span>
            {pendingBatch.files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs text-slate-800 shadow-2xs font-mono"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={f.name}>
                  {f.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {f.count} records
                </span>
                {f.sizeStr && <span className="text-[10px] text-slate-400">({f.sizeStr})</span>}
              </div>
            ))}

            <button
              onClick={() => setIsPreviewBatchExpanded(!isPreviewBatchExpanded)}
              className="ml-auto text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{isPreviewBatchExpanded ? 'Hide Batch Preview' : 'Show Preview Rows'}</span>
              {isPreviewBatchExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible Staging Preview Table */}
          {isPreviewBatchExpanded && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs mt-2">
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Staging Preview (Top {Math.min(6, pendingBatch.items.length)} of {pendingBatch.totalCount} Facilities)</span>
                <span className="text-emerald-700 font-mono">10 Standard Schema Columns</span>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2">Customer</th>
                      <th className="py-1.5 px-2">Customer Description</th>
                      <th className="py-1.5 px-2">Delivering Plant</th>
                      <th className="py-1.5 px-2">Ownership</th>
                      <th className="py-1.5 px-2">Region</th>
                      <th className="py-1.5 px-2">Zone</th>
                      <th className="py-1.5 px-2">Woreda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {pendingBatch.items.slice(0, 6).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1 px-2 font-bold text-cyan-700">{item.customer}</td>
                        <td className="py-1 px-2 font-sans font-medium text-slate-800">{item.customerDescription}</td>
                        <td className="py-1 px-2 text-slate-700">{item.deliveringPlant}</td>
                        <td className="py-1 px-2 text-slate-700">{item.ownershipDescription}</td>
                        <td className="py-1 px-2 text-slate-700">{item.region}</td>
                        <td className="py-1 px-2 text-slate-700">{item.zoneDescription}</td>
                        <td className="py-1 px-2 text-slate-700">{item.woredaDescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 shadow-2xs">
            <Hospital className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                Health Facility (HF) Master List
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                {validRecords.length} Facilities On Record
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Customer Directory, Delivering Plant Mappings, Ownership Categories & Regional Administrative Hierarchy
            </p>
          </div>
        </div>

        {/* Toolbar Buttons & Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Record Mode Switch */}
          <button
            type="button"
            onClick={toggleAutoRecord}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              autoRecordImmediate
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={
              autoRecordImmediate
                ? 'Instant Auto-Save is ON: Selecting files records them immediately into HF List.'
                : 'Review & Confirm is ON: Selecting files lets you review and confirm before saving.'
            }
          >
            <Zap className={`w-3.5 h-3.5 ${autoRecordImmediate ? 'text-emerald-600 fill-emerald-600' : 'text-slate-400'}`} />
            <span>{autoRecordImmediate ? 'Auto-Save: Instant' : 'Auto-Save: Confirm First'}</span>
          </button>

          {/* Main Upload - Admin Only */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleOpenBrowserFilePicker}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="Browse your computer to upload HF spreadsheet (.xlsx, .csv) immediately. Supports multiple file selection."
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New HF Data</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStagedParsedItems([]);
                  setStagedFileName(null);
                  setIsUploadModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Open modal for drag & drop, tabular paste, or downloading template"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import Options</span>
              </button>

            </>
          )}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Facility</span>
          </button>

          {onClearAllHFData && (
            <div className="relative">
              {showClearConfirm ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 p-1 rounded-xl shadow-xs">
                  <span className="text-[11px] font-bold text-rose-800 px-1.5">Remove all records?</span>
                  <button
                    onClick={() => {
                      onClearAllHFData();
                      setShowClearConfirm(false);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition cursor-pointer"
                  >
                    Confirm Clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-rose-200 shadow-2xs"
                  title="Remove all data under listed HF List"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Clear All HF Data</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredFacilities.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export HF List</span>
          </button>
        </div>
      </div>

      {/* Metric Cards - 10-Field Schema Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Registered Customers</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{validRecords.length.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Health Facilities & Centers</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <Hospital className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Delivering Plants</div>
            <div className="text-xl font-black text-cyan-600 mt-0.5 font-mono">{uniquePlants.length.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Supplying EPSS Hubs</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Administrative Regions</div>
            <div className="text-xl font-black text-indigo-600 mt-0.5 font-mono">{uniqueRegions.length.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Regional Health Bureaus</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Ownership Categories</div>
            <div className="text-xl font-black text-amber-600 mt-0.5 font-mono">{uniqueOwnerships.length.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Public, Private, NGO & Federal</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Number of HF Served by Plant - Circle Graph Analytics Section */}
      <div id="hf-plant-circle-chart-section" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-2xs">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Analysis: Number of Health Facilities (HF) Served by Plant
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  {plantCircleChartData.length} Delivering Plants
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Circular distribution analysis of health facilities assigned and served per delivering plant hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlantChartVisible(!isPlantChartVisible)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
              title={isPlantChartVisible ? 'Collapse Chart' : 'Expand Chart'}
            >
              {isPlantChartVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isPlantChartVisible && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            {/* Circle Graph (Donut SVG) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    let cumulativePercent = 0;
                    const radius = 38;
                    const circumference = 2 * Math.PI * radius;
                    return plantCircleChartData.map((slice, idx) => {
                      const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                      cumulativePercent += slice.percentage;
                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="18"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-500 hover:opacity-90 cursor-pointer"
                        >
                          <title>{`${slice.plant}: ${slice.count} HFs (${slice.percentage}%)`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total HFs</span>
                  <span className="text-2xl font-black text-slate-900">{validRecords.length.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold text-emerald-700">Delivering Plants</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 text-center">Hover segments for plant allocation details</p>
            </div>

            {/* Plant Legend & Breakdown */}
            <div className="lg:col-span-7 space-y-2.5 max-h-72 overflow-y-auto pr-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Plant Breakdown ({plantCircleChartData.length} Delivering Hubs)
              </div>
              {plantCircleChartData.map((slice) => {
                const isPlantSelected = selectedPlant === slice.plant;
                return (
                  <div
                    key={slice.plant}
                    onClick={() => {
                      setSelectedPlant(prev => (prev === slice.plant ? 'all' : slice.plant));
                      if (onFilterPlant) onFilterPlant(slice.plant);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                      isPlantSelected ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: slice.color }} />
                      <div>
                        <div className="font-bold text-slate-900 font-mono">{slice.plant}</div>
                        <div className="text-[10px] text-slate-500">{slice.count.toLocaleString()} Health Facilities Served</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(slice.percentage, 3)}%`, backgroundColor: slice.color }} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 min-w-[45px] text-right">{slice.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Number of HF Per Region - Bar Graph Section */}
      <div id="hf-regional-bar-chart-section" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Number of Health Facilities (HF) Per Region
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                  {regionChartData.length} Regions
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Facility density across Regional Health Bureaus • Click any bar to filter list
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedRegion !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedRegion('all')}
                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                title="Reset region filter to show all"
              >
                <span>Filter: {selectedRegion}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Toggle View Mode: Columns vs Horizontal Ranked list */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setChartViewMode('bar')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  chartViewMode === 'bar'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bar Graph
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('ranked')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  chartViewMode === 'ranked'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ranked List
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsChartVisible(!isChartVisible)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
              title={isChartVisible ? 'Collapse Chart' : 'Expand Chart'}
            >
              {isChartVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isChartVisible && (
          <>
            {/* Quick Summary Pill Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total HF Nationwide</div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{validRecords.length.toLocaleString()}</div>
                </div>
                <Hospital className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Leading Region</div>
                  <div className="font-bold text-indigo-700 text-sm mt-0.5 truncate max-w-[120px]">
                    {topRegion ? topRegion.region : 'None'}
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200">
                  {topRegion ? `${topRegion.count} HFs` : '-'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Leading Share</div>
                  <div className="font-mono font-bold text-cyan-700 text-sm mt-0.5">
                    {topRegion ? `${topRegion.percentage}%` : '0%'}
                  </div>
                </div>
                <Globe className="w-4 h-4 text-cyan-600" />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Avg HF / Region</div>
                  <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">{avgHfsPerRegion}</div>
                </div>
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Main Bar Chart Rendering */}
            {validRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Hospital className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No regional data available to graph</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Upload a spreadsheet or add facilities above to generate the regional breakdown.</p>
              </div>
            ) : chartViewMode === 'bar' ? (
              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regionChartData}
                    margin={{ top: 16, right: 16, left: -10, bottom: 36 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedRegion = state.activePayload[0].payload?.region;
                        if (clickedRegion) {
                          setSelectedRegion((prev) => (prev === clickedRegion ? 'all' : clickedRegion));
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="region"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Facilities"
                      radius={[6, 6, 0, 0]}
                      className="cursor-pointer"
                    >
                      {regionChartData.map((entry, index) => {
                        const isSelected = selectedRegion === entry.region;
                        const isAnySelected = selectedRegion !== 'all';
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={REGION_BAR_COLORS[index % REGION_BAR_COLORS.length]}
                            opacity={isSelected ? 1 : isAnySelected ? 0.35 : 0.88}
                            stroke={isSelected ? '#0f172a' : undefined}
                            strokeWidth={isSelected ? 2 : 0}
                            onClick={() => {
                              setSelectedRegion((prev) => (prev === entry.region ? 'all' : entry.region));
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              /* Ranked Horizontal List View */
              <div className="space-y-2 pt-1 max-h-72 overflow-y-auto pr-1">
                {regionChartData.map((item, idx) => {
                  const isSelected = selectedRegion === item.region;
                  const maxCount = regionChartData[0]?.count || 1;
                  const widthPercent = Math.max(6, (item.count / maxCount) * 100);
                  const color = REGION_BAR_COLORS[idx % REGION_BAR_COLORS.length];

                  return (
                    <div
                      key={item.region}
                      onClick={() => setSelectedRegion((prev) => (prev === item.region ? 'all' : item.region))}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-[160px] sm:min-w-[200px]">
                        <span className="w-5 font-mono text-[11px] font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">{item.region}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {item.plantsCount} Supplying Plant(s)
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 mx-2 sm:mx-4">
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${widthPercent}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <div className="font-mono font-bold text-slate-900">
                          {item.count.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans">HFs</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{item.percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Interactive Region Drilldown & Facility Explorer Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Regional Drilldown & Facility Explorer
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono">
                  {regionChartData.length} Regions Available
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Expand any region below to view and filter the exact health facilities associated with that region from the master list
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const allExpanded = regionChartData.reduce((acc, r) => ({ ...acc, [r.region]: true }), {});
                setExpandedRegions(allExpanded);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Expand All Regions
            </button>
            <button
              type="button"
              onClick={() => setExpandedRegions({})}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Region Drilldown Accordion List */}
        <div className="space-y-3">
          {regionChartData.map((regItem, regIdx) => {
            const isExpanded = !!expandedRegions[regItem.region];
            const regionHfs = validRecords.filter(f => f.region === regItem.region);
            const searchQ = (regionDrilldownSearch[regItem.region] || '').toLowerCase().trim();
            const filteredRegionHfs = regionHfs.filter(f => {
              if (!searchQ) return true;
              return (
                (f.customer && f.customer.toLowerCase().includes(searchQ)) ||
                (f.customerDescription && f.customerDescription.toLowerCase().includes(searchQ)) ||
                (f.deliveringPlant && f.deliveringPlant.toLowerCase().includes(searchQ)) ||
                (f.zoneDescription && f.zoneDescription.toLowerCase().includes(searchQ)) ||
                (f.woredaDescription && f.woredaDescription.toLowerCase().includes(searchQ)) ||
                (f.ownershipDescription && f.ownershipDescription.toLowerCase().includes(searchQ))
              );
            });

            const color = REGION_BAR_COLORS[regIdx % REGION_BAR_COLORS.length];

            return (
              <div
                key={regItem.region}
                className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-cyan-300 shadow-md bg-cyan-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Region Accordion Header */}
                <div
                  onClick={() => {
                    setExpandedRegions(prev => ({ ...prev, [regItem.region]: !prev[regItem.region] }));
                  }}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">
                          {regItem.region}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {regItem.count.toLocaleString()} Health Facilities ({regItem.percentage}%)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 font-medium">
                        <span>{regItem.plantsCount} Supplying Plant(s)</span>
                        <span>•</span>
                        <span>{regItem.ownershipsCount} Ownership Categories</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegion(regItem.region);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition flex items-center gap-1 border border-emerald-200 cursor-pointer"
                      title={`Filter main table to show only ${regItem.region}`}
                    >
                      <Filter className="w-3 h-3 text-emerald-600" />
                      <span>Filter Main Table</span>
                    </button>

                    <div className="p-1.5 rounded-xl bg-slate-100 text-slate-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Drilldown Content */}
                {isExpanded && (
                  <div className="border-t border-cyan-200 bg-white p-4 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative w-full sm:w-72">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder={`Search within ${regItem.region}...`}
                          value={regionDrilldownSearch[regItem.region] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRegionDrilldownSearch(prev => ({ ...prev, [regItem.region]: val }));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">
                          Showing <strong className="text-cyan-700 font-mono">{filteredRegionHfs.length}</strong> of {regionHfs.length} HFs in {regItem.region}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (filteredRegionHfs.length === 0) return;
                            const csvData = filteredRegionHfs.map((f, i) => ({
                              '#': i + 1,
                              'Customer': f.customer,
                              'Customer Description': f.customerDescription,
                              'Delivering Plant': f.deliveringPlant,
                              'Ownership Code': f.ownershipCode,
                              'Ownership Description': f.ownershipDescription,
                              'Region': f.region,
                              'Zone Code': f.zoneCode,
                              'Zone Description': f.zoneDescription,
                              'Woreda': f.woreda,
                              'Woreda Description': f.woredaDescription
                            }));
                            downloadCSV(`EPSS_HF_Drilldown_${regItem.region.replace(/\s+/g, '_')}.csv`, csvData);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                          <span>Export Region CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Filtered Region Health Facilities Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0 text-[11px] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-2.5 w-8 text-center">#</th>
                            <th className="py-2 px-3">Customer ID</th>
                            <th className="py-2 px-3">Facility Name / Description</th>
                            <th className="py-2 px-2.5 text-center">Plant</th>
                            <th className="py-2 px-2.5 text-center">Ownership</th>
                            <th className="py-2 px-3">Zone</th>
                            <th className="py-2 px-3">Woreda</th>
                            <th className="py-2 px-2.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {filteredRegionHfs.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                                No health facility records found matching "{regionDrilldownSearch[regItem.region]}" in {regItem.region}.
                              </td>
                            </tr>
                          ) : (
                            filteredRegionHfs.map((hf, hfIdx) => (
                              <tr key={hf.id || hfIdx} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-2.5 text-center font-mono text-[11px] text-slate-400">
                                  {hfIdx + 1}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-cyan-700 whitespace-nowrap">
                                  {hf.customer}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  <div className="flex items-center gap-1.5">
                                    <Hospital className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{hf.customerDescription}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-700">
                                  {hf.deliveringPlant || 'HO01'}
                                </td>
                                <td className="py-2 px-2.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {hf.ownershipCode || 'GOV'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {hf.zoneDescription || hf.zoneCode || '-'}
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {hf.woredaDescription || hf.woreda || '-'}
                                </td>
                                <td className="py-2 px-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setActiveFacilityModal && setActiveFacilityModal(hf)}
                                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                    title="View full facility details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Customer, Description, Plant, Zone, Woreda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Region Filter Dropdown */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
              selectedRegion !== 'all'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200/60 text-indigo-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${selectedRegion !== 'all' ? 'text-indigo-600' : 'text-slate-500'}`} />
            <label htmlFor="hf-region-dropdown" className={`font-semibold shrink-0 ${selectedRegion !== 'all' ? 'text-indigo-900' : 'text-slate-600'}`}>
              Region:
            </label>
            <select
              id="hf-region-dropdown"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className={`bg-transparent text-xs rounded px-1 py-0.5 focus:outline-hidden cursor-pointer ${
                selectedRegion !== 'all' ? 'font-bold text-indigo-950' : 'text-slate-800'
              }`}
            >
              <option value="all">
                All Regions ({uniqueRegions.length} regions • {validRecords.length} HFs)
              </option>
              {uniqueRegions.map((reg) => {
                const count = regionFacilityCounts[reg] || 0;
                return (
                  <option key={reg} value={reg}>
                    {reg} ({count} {count === 1 ? 'HF' : 'HFs'})
                  </option>
                );
              })}
            </select>
            {selectedRegion !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedRegion('all')}
                className="p-0.5 rounded-full hover:bg-indigo-200/80 text-indigo-700 transition cursor-pointer"
                title="Reset region filter to All Regions"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Plant Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Plant:</span>
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2 py-1.5 focus:outline-hidden focus:bg-white focus:border-cyan-500 cursor-pointer font-mono"
            >
              <option value="all">All Plants ({uniquePlants.length})</option>
              {uniquePlants.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </select>
          </div>

          {/* Ownership Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Ownership:</span>
            <select
              value={selectedOwnership}
              onChange={(e) => setSelectedOwnership(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2 py-1.5 focus:outline-hidden focus:bg-white focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Ownerships ({uniqueOwnerships.length})</option>
              {uniqueOwnerships.map((ow) => (
                <option key={ow} value={ow}>
                  {ow}
                </option>
              ))}
            </select>
          </div>

          {/* Facility Type Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Type:</span>
            <select
              value={selectedFacilityType}
              onChange={(e) => setSelectedFacilityType(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2 py-1.5 focus:outline-hidden focus:bg-white focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Types ({uniqueFacilityTypes.length})</option>
              {uniqueFacilityTypes.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>

          {(selectedRegion !== 'all' || selectedPlant !== 'all' || selectedOwnership !== 'all' || selectedFacilityType !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedRegion('all');
                setSelectedPlant('all');
                setSelectedOwnership('all');
                setSelectedFacilityType('all');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Active Region Filter Information Banner */}
      {selectedRegion !== 'all' && (
        <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-indigo-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shadow-2xs">
              <MapPin className="w-4 h-4" />
            </span>
            <span>
              Region Filter Active: <span className="font-bold text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">{selectedRegion}</span>
              {' '}— Displaying <strong className="font-bold text-emerald-700">{filteredFacilities.length}</strong> of <span className="font-semibold text-slate-700">{validRecords.length}</span> total health facilities
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedRegion('all')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
          >
            <X className="w-3 h-3" />
            <span>Show All Regions</span>
          </button>
        </div>
      )}

      {/* Master Health Facilities Table with the 10 Standard Labels */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 whitespace-nowrap">Customer</th>
                <th className="py-3 px-4 min-w-[220px]">Customer Description</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Delivering Plant</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Ownership Code</th>
                <th className="py-3 px-4 whitespace-nowrap">Ownership Description</th>
                <th className="py-3 px-3 whitespace-nowrap">Region</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Zone Code</th>
                <th className="py-3 px-3 whitespace-nowrap">Zone Description</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Woreda</th>
                <th className="py-3 px-3 whitespace-nowrap">Woreda Description</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Cloud Sync</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Hospital className="w-6 h-6" />
                      </div>
                      {validRecords.length > 0 ? (
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">
                            No Facilities Match Selected Filter Criteria
                          </h4>
                          <p className="text-xs text-slate-500 max-w-lg mx-auto">
                            No health facilities found matching
                            {selectedRegion !== 'all' ? ` Region "${selectedRegion}"` : ''}
                            {selectedPlant !== 'all' ? ` Plant "${selectedPlant}"` : ''}
                            {selectedOwnership !== 'all' ? ` Ownership "${selectedOwnership}"` : ''}
                            {selectedFacilityType !== 'all' ? ` Type "${selectedFacilityType}"` : ''}
                            {searchQuery ? ` Search "${searchQuery}"` : ''}.
                          </p>
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRegion('all');
                                setSelectedPlant('all');
                                setSelectedOwnership('all');
                                setSelectedFacilityType('all');
                                setSearchQuery('');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Reset Filter & Show All Facilities</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">
                            No Health Facility Records on File
                          </h4>
                          <p className="text-xs text-slate-500 max-w-lg mx-auto">
                            Previous records have been removed. Ready to ingest new data formatted with the 10 standard labels:
                            Customer, Customer Description, Delivering Plant, Ownership Code, Ownership Description, Region, Zone Code, Zone Description, Woreda, Woreda Description.
                          </p>
                        </div>
                      )}
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenBrowserFilePicker}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                          title="Open browser to choose your Excel or CSV file immediately"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload New HF Data</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStagedParsedItems([]);
                            setStagedFileName(null);
                            setIsUploadModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Import Options / Paste</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-4 h-4 text-cyan-600" />
                          <span>Add Facility Manually</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((facility, idx) => {
                  const syncStatus = facility.syncStatus || 'synced';
                  return (
                    <tr key={facility.id || idx} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 font-mono font-bold text-cyan-700 whitespace-nowrap">
                        {facility.customer}
                      </td>

                      {/* Customer Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              syncStatus === 'pending'
                                ? 'bg-amber-500 animate-ping'
                                : syncStatus === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500 shadow-xs shadow-emerald-400/50'
                            }`}
                            title={
                              syncStatus === 'pending'
                                ? 'Pending sync with Supabase'
                                : syncStatus === 'offline'
                                ? 'Stored locally / offline'
                                : 'Successfully synced with Supabase backend'
                            }
                          />
                          <Hospital className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{facility.customerDescription}</span>
                        </div>
                      </td>

                      {/* Delivering Plant */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {facility.deliveringPlant || 'HO01'}
                        </span>
                      </td>

                      {/* Ownership Code */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {facility.ownershipCode || 'GOV'}
                        </span>
                      </td>

                      {/* Ownership Description */}
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap text-xs">
                        {facility.ownershipDescription || 'Public / Government'}
                      </td>

                      {/* Region */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                          {facility.region}
                        </span>
                      </td>

                      {/* Zone Code */}
                      <td className="py-3 px-3 text-center font-mono text-slate-500 whitespace-nowrap">
                        {facility.zoneCode || '-'}
                      </td>

                      {/* Zone Description */}
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {facility.zoneDescription || '-'}
                      </td>

                      {/* Woreda */}
                      <td className="py-3 px-3 text-center font-mono text-slate-500 whitespace-nowrap">
                        {facility.woreda || '-'}
                      </td>

                      {/* Woreda Description */}
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {facility.woredaDescription || '-'}
                      </td>

                      {/* Cloud Sync */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            syncStatus === 'pending'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : syncStatus === 'offline'
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                          title={
                            syncStatus === 'pending'
                              ? 'Health facility record pending write to Supabase'
                              : syncStatus === 'offline'
                              ? 'Offline health facility record saved locally'
                              : 'Health facility record verified and active on Supabase'
                          }
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              syncStatus === 'pending'
                                ? 'bg-amber-500 animate-pulse'
                                : syncStatus === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span>{syncStatus === 'pending' ? 'Pending' : syncStatus === 'offline' ? 'Offline' : 'Synced'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setActiveFacilityModal(facility)}
                          className="p-1 rounded-md text-slate-500 hover:text-cyan-700 hover:bg-slate-100 transition cursor-pointer"
                          title="View Complete Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteFacility && (
                          <button
                            onClick={() => onDeleteFacility(facility.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Details Modal */}
      {activeFacilityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <Hospital className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Health Facility Details
                  </h3>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeFacilityModal.customerDescription}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveFacilityModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Customer Code</div>
                  <div className="font-mono font-bold text-cyan-700 text-sm mt-0.5">
                    {activeFacilityModal.customer}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Delivering Plant</div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {activeFacilityModal.deliveringPlant}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Ownership</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-100 text-emerald-800 text-xs">
                    {activeFacilityModal.ownershipCode}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {activeFacilityModal.ownershipDescription}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Region</div>
                  <div className="font-bold text-slate-900 mt-0.5">{activeFacilityModal.region}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Zone Code & Name</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    <span className="font-mono text-cyan-700">[{activeFacilityModal.zoneCode}]</span>{' '}
                    {activeFacilityModal.zoneDescription}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Woreda Code & Description</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  <span className="font-mono text-cyan-700">[{activeFacilityModal.woreda}]</span>{' '}
                  {activeFacilityModal.woredaDescription}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setActiveFacilityModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Facility Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Add Health Facility Record
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    Enter the 10 standard schema attributes
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFacilitySubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1000214"
                    value={newFacility.customer}
                    onChange={(e) => setNewFacility({ ...newFacility, customer: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Delivering Plant *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HO01"
                    value={newFacility.deliveringPlant}
                    onChange={(e) => setNewFacility({ ...newFacility, deliveringPlant: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tikur Anbessa Specialized Hospital"
                  value={newFacility.customerDescription}
                  onChange={(e) => setNewFacility({ ...newFacility, customerDescription: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ownership Code</label>
                  <input
                    type="text"
                    placeholder="e.g. GOV, PUB, PRV"
                    value={newFacility.ownershipCode}
                    onChange={(e) => setNewFacility({ ...newFacility, ownershipCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ownership Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Public / Federal Referral"
                    value={newFacility.ownershipDescription}
                    onChange={(e) => setNewFacility({ ...newFacility, ownershipDescription: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Region *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addis Ababa, Oromia, Amhara"
                  value={newFacility.region}
                  onChange={(e) => setNewFacility({ ...newFacility, region: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Zone Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Z-LID"
                    value={newFacility.zoneCode}
                    onChange={(e) => setNewFacility({ ...newFacility, zoneCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Zone Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Lideta Sub-City"
                    value={newFacility.zoneDescription}
                    onChange={(e) => setNewFacility({ ...newFacility, zoneDescription: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Woreda</label>
                  <input
                    type="text"
                    placeholder="e.g. W-08"
                    value={newFacility.woreda}
                    onChange={(e) => setNewFacility({ ...newFacility, woreda: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Woreda Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Lideta Woreda 08"
                    value={newFacility.woredaDescription}
                    onChange={(e) => setNewFacility({ ...newFacility, woredaDescription: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 -mx-4 -mb-4 bg-slate-50 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Health Facility Master Data Modal - Admin Only */}
      {isAdmin && isUploadModalOpen && (
        <HFListUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setStagedParsedItems([]);
            setStagedFileName(null);
          }}
          onUploadHFData={(data, mode) => {
            if (onUploadHFData) {
              onUploadHFData(data, mode);
            }
          }}
          initialItems={stagedParsedItems}
          initialFileName={stagedFileName || undefined}
        />
      )}
    </div>
  );
};
