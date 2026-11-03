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
  Boxes,
  Upload,
  FileSpreadsheet,
  Download,
  FileDown,
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Trash2,
  Plus,
  Package,
  Split,
  AlertTriangle,
  Warehouse,
  Info,
  X,
  FileText,
  Check,
  Zap,
  ChevronDown,
  ChevronUp,
  Building2,
  SlidersHorizontal,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PieChart,
  BarChart3
} from 'lucide-react';
import { MultipleStockRecord, PlantSummary } from '../types';
import { downloadCSV, formatCurrency, formatNumber } from '../utils/formatters';
import { MultipleStockUploadModal, parseMultipleStockRows, parseMultipleStockWorkbook } from './MultipleStockUploadModal';
import { DashboardViewMultipleStockAnalytics } from './DashboardViewMultipleStockAnalytics';

interface MultipleStockViewProps {
  items: MultipleStockRecord[];
  plants?: PlantSummary[];
  onSelectItem?: (item: MultipleStockRecord) => void;
  onFilterPlant?: (plantCode: string) => void;
  onClearAllMultipleStockData?: () => void;
  onUploadMultipleStockData?: (items: MultipleStockRecord[], mode?: 'replace' | 'append') => void;
  onAddMultipleStockItem?: (item: MultipleStockRecord) => void;
  onUpdateMultipleStockItem?: (item: MultipleStockRecord) => void;
  onDeleteMultipleStockItem?: (id: string) => void;
  onOpenMultiUploadModal?: () => void;
  isAdmin?: boolean;
}

interface StagedFileSummary {
  name: string;
  count: number;
  sizeStr?: string;
}

interface PendingStagedBatch {
  files: StagedFileSummary[];
  items: MultipleStockRecord[];
  totalCount: number;
  timestamp: number;
}

export const MultipleStockView: React.FC<MultipleStockViewProps> = ({
  items,
  plants = [],
  onSelectItem,
  onFilterPlant,
  onClearAllMultipleStockData,
  onUploadMultipleStockData,
  onAddMultipleStockItem,
  onUpdateMultipleStockItem,
  onDeleteMultipleStockItem,
  onOpenMultiUploadModal,
  isAdmin = false
}) => {
  console.log('MultipleStockView rendering, items count:', items.length);
  // Mode: Auto-Replace Immediate vs Review & Confirm
  const [multipleStockViewMode, setMultipleStockViewMode] = useState<'combined' | 'table' | 'analytics'>('combined');
  const [autoReplaceImmediate, setAutoReplaceImmediate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('epss_multiple_stock_auto_replace');
      return saved !== null ? saved === 'true' : false; // Defaults to FALSE to prevent automatic previous data clearance
    } catch {
      return false;
    }
  });

  // Staged Batch State (Review mode)
  const [pendingBatch, setPendingBatch] = useState<PendingStagedBatch | null>(null);
  const [isPreviewBatchExpanded, setIsPreviewBatchExpanded] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');

  // Upload UI Tab ('file' or 'paste')
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);

  // Toast / Status Notification
  const [uploadToast, setUploadToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Resolve Duplicates Modal & Strategy State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedResolveStrategy, setSelectedResolveStrategy] = useState<'keep-latest' | 'merge-quantities'>('merge-quantities');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedStockType, setSelectedStockType] = useState('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Column Sorting State
  const [sortField, setSortField] = useState<string>('material');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Native Browser File Input Ref
  const directFileInputRef = useRef<HTMLInputElement>(null);

  // Add Single Item Modal State
  const [formMaterial, setFormMaterial] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPlant, setFormPlant] = useState('HO01');
  const [formWh, setFormWh] = useState('Central Store');
  const [formSpecialStock, setFormSpecialStock] = useState('Standard');
  const [formUnrestricted, setFormUnrestricted] = useState('50');
  const [formInspection, setFormInspection] = useState('5');
  const [formBlocked, setFormBlocked] = useState('0');
  const [formValUnres, setFormValUnres] = useState('7500000');
  const [formValType, setFormValType] = useState('Moving Average (V)');
  const [formGroup, setFormGroup] = useState('Diagnostic Imaging');
  const [formValBlocked, setFormValBlocked] = useState('0');
  const [formValInspection, setFormValInspection] = useState('750000');
  const [formWbs, setFormWbs] = useState('WBS-EPSS-2026');

  // Auto-dismiss Toast
  useEffect(() => {
    if (uploadToast) {
      const t = setTimeout(() => setUploadToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [uploadToast]);

  const toggleAutoReplace = () => {
    const next = !autoReplaceImmediate;
    setAutoReplaceImmediate(next);
    try {
      localStorage.setItem('epss_multiple_stock_auto_replace', String(next));
    } catch {
      // ignore
    }
    setUploadToast({
      type: 'info',
      message: next
        ? '✓ Auto-Clear Mode: ON — Uploading files will immediately clear previous data and display new records.'
        : 'ℹ Review Mode: ON — Uploading files will stage records for confirmation before replacing or appending.'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Asynchronously read a spreadsheet file (.xlsx, .xls, .csv, .ods)
  const readFileAsync = (file: File): Promise<MultipleStockRecord[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const isCsv = file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt');

      if (isCsv) {
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const wb = XLSX.read(text, { type: 'string' });
            const parsed = parseMultipleStockWorkbook(wb, file.name);
            resolve(parsed);
          } catch (err) {
            console.error('Failed to parse CSV:', err);
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file);
      } else {
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            const parsed = parseMultipleStockWorkbook(wb, file.name);
            resolve(parsed);
          } catch (err) {
            console.error('Failed to parse spreadsheet:', err);
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsArrayBuffer(file);
      }
    });
  };

  // Directly handle file selection from native browser file picker
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessingFiles(true);
    setProcessingStatusText(`Reading ${files.length} file(s)... Parsing Multiple Stock records across 14 columns...`);

    const allItems: MultipleStockRecord[] = [];
    const fileSummaries: StagedFileSummary[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingStatusText(`Processing ${i + 1} of ${files.length}: ${file.name}...`);
      const itemsParsed = await readFileAsync(file);
      if (itemsParsed.length > 0) {
        allItems.push(...itemsParsed);
        fileSummaries.push({
          name: file.name,
          count: itemsParsed.length,
          sizeStr: formatFileSize(file.size)
        });
      }
    }

    setIsProcessingFiles(false);
    setProcessingStatusText('');
    e.target.value = '';

    if (allItems.length === 0) {
      setUploadToast({
        type: 'error',
        message: '⚠️ No valid Multiple Stock records found in the selected file(s). Please verify column headers match the 14 supported fields.'
      });
      return;
    }

    // Always immediately record and display records in the Recorded Data Table
    if (onUploadMultipleStockData) {
      onUploadMultipleStockData(allItems, 'replace');
    }
    setUploadToast({
      type: 'success',
      message: `✓ Successfully uploaded & recorded ${allItems.length.toLocaleString()} stock records from ${files.length} file(s)! All 14 columns displayed below.`
    });
    setPendingBatch(null);
    setIsUploadPanelOpen(false);
  };

  // Open native OS file picker reliably and immediately
  const handleOpenBrowserFilePicker = () => {
    if (directFileInputRef.current) {
      directFileInputRef.current.value = '';
      directFileInputRef.current.click();
    }
  };

  // Commit Pending Staged Batch
  const handleCommitPendingBatch = (mode: 'replace' | 'append') => {
    if (!pendingBatch) return;
    if (onUploadMultipleStockData) {
      onUploadMultipleStockData(pendingBatch.items, mode);
    }
    const total = pendingBatch.totalCount;
    setPendingBatch(null);
    setIsPreviewBatchExpanded(false);
    setUploadToast({
      type: 'success',
      message: mode === 'replace'
        ? `✓ Successfully replaced ledger with ${total.toLocaleString()} records! Previous data cleared automatically.`
        : `✓ Successfully appended ${total.toLocaleString()} records to existing stock ledger.`
    });
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessingFiles(true);
    setProcessingStatusText(`Processing dropped files...`);

    const allItems: MultipleStockRecord[] = [];
    const fileSummaries: StagedFileSummary[] = [];

    for (const file of files) {
      const itemsParsed = await readFileAsync(file);
      if (itemsParsed.length > 0) {
        allItems.push(...itemsParsed);
        fileSummaries.push({
          name: file.name,
          count: itemsParsed.length,
          sizeStr: formatFileSize(file.size)
        });
      }
    }

    setIsProcessingFiles(false);
    setProcessingStatusText('');

    if (allItems.length === 0) {
      setUploadToast({
        type: 'error',
        message: '⚠️ No valid records found in dropped files. Please verify column headers.'
      });
      return;
    }

    if (autoReplaceImmediate) {
      if (onUploadMultipleStockData) {
        onUploadMultipleStockData(allItems, 'replace');
      }
      setUploadToast({
        type: 'success',
        message: `✓ Successfully uploaded ${allItems.length.toLocaleString()} records! Previous data cleared automatically.`
      });
      setPendingBatch(null);
    } else {
      setPendingBatch({
        files: fileSummaries,
        items: allItems,
        totalCount: allItems.length,
        timestamp: Date.now()
      });
    }
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const headers = [
      'Material',
      'Material Description',
      'Plant',
      'Storage Location',
      'Special Stock Type',
      'Unrestricted Stock',
      'Stock in Quality Inspection',
      'Blocked Stock',
      'Current Value of Unrestricted Stock',
      'Inventory Valuation Type',
      'Material Group Name',
      'Value of Blocked Stock',
      'Value of Stock in Quality Inspection',
      'WBS Element'
    ];

    const sampleRow = [
      'MAT-100234',
      'Ultrasound Machine portable unit with probes',
      'AA01',
      'Central Store',
      '', // Blank in Excel = Revolving Drug Fund (RDF)
      '45',
      '5',
      '2',
      '13500000',
      'Moving Average (V)',
      'Diagnostic Imaging',
      '600000',
      '1500000',
      'WBS-EPSS-2026-DIAG'
    ];

    const sampleRow2 = [
      'MAT-100235',
      'X-Ray Protective Lead Aprons 0.5mm Pb',
      'HO01',
      'Medical Store 2',
      'Q', // Q in Excel = Health Program (HP)
      '120',
      '10',
      '0',
      '1800000',
      'Moving Average (V)',
      'Radiation Safety',
      '0',
      '150000',
      'WBS-EPSS-2026-SAFE'
    ];

    const csvContent = [headers.join(','), sampleRow.join(','), sampleRow2.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Multiple_Stock_Upload_Template_14_Columns.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process Pasted Data
  const handleProcessPastedData = () => {
    if (!pasteContent.trim()) return;

    try {
      const lines = pasteContent.trim().split('\n');
      if (lines.length < 2) {
        setUploadToast({
          type: 'error',
          message: 'Please provide at least one header row and one data row.'
        });
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rawRows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] || '';
        });
        rawRows.push(rowObj);
      }

      const parsed = parseMultipleStockRows(rawRows, 'Pasted Data');
      if (parsed.length === 0) {
        setUploadToast({
          type: 'error',
          message: 'Could not parse records from pasted content. Check your column headers.'
        });
        return;
      }

      if (autoReplaceImmediate) {
        if (onUploadMultipleStockData) {
          onUploadMultipleStockData(parsed, 'replace');
        }
        setPasteContent('');
        setUploadToast({
          type: 'success',
          message: `✓ Successfully parsed & saved ${parsed.length.toLocaleString()} pasted records! Previous records cleared automatically.`
        });
      } else {
        setPendingBatch({
          files: [{ name: 'Pasted Clipboard Data', count: parsed.length }],
          items: parsed,
          totalCount: parsed.length,
          timestamp: Date.now()
        });
        setPasteContent('');
      }
    } catch (err: any) {
      setUploadToast({
        type: 'error',
        message: `Failed to parse pasted text: ${err.message || 'Formatting error'}`
      });
    }
  };

  // Add Single Item Handler
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddMultipleStockItem) return;

    const newItem: MultipleStockRecord = {
      id: `mstock-${crypto.randomUUID()}`,
      material: formMaterial.trim() || `MAT-${Math.floor(100000 + Math.random() * 900000)}`,
      materialDescription: formDesc.trim() || 'Medical Stock Item',
      plant: formPlant.trim().toUpperCase() || 'HO01',
      storageLocation: formWh.trim() || 'Central Store',
      specialStockType: formSpecialStock.trim(), // Blank = RDF, Q = HP
      unrestrictedStock: parseFloat(formUnrestricted) || 0,
      stockInQualityInspection: parseFloat(formInspection) || 0,
      blockedStock: parseFloat(formBlocked) || 0,
      currentValueOfUnrestrictedStock: parseFloat(formValUnres) || 0,
      inventoryValuationType: formValType.trim() || 'Moving Average (V)',
      materialGroupName: formGroup.trim() || 'General Medical Devices',
      valueOfBlockedStock: parseFloat(formValBlocked) || 0,
      valueOfStockInQualityInspection: parseFloat(formValInspection) || 0,
      wbsElement: formWbs.trim() || 'WBS-EPSS-2026',
      uploadedAt: new Date().toISOString(),
      sourceFile: 'Manual Entry'
    };

    onAddMultipleStockItem(newItem);
    setIsAddModalOpen(false);

    // Reset Form
    setFormMaterial('');
    setFormDesc('');
    setFormSpecialStock('');
    setFormUnrestricted('50');
    setFormInspection('5');
    setFormBlocked('0');
    setFormValUnres('7500000');

    setUploadToast({
      type: 'success',
      message: `✓ Added new stock record "${newItem.materialDescription}".`
    });
  };

  // Export Data to CSV
  const handleExportCSV = () => {
    const data = filteredItems.map((item, idx) => {
      const sType = (item.specialStockType || '').trim();
      const isHp = sType.toUpperCase() === 'Q' || sType.toUpperCase().startsWith('Q');
      return {
        '#': idx + 1,
        'Material': item.material,
        'Material Description': item.materialDescription,
        'Plant': item.plant,
        'Storage Location': item.storageLocation,
        'Special Stock Type': isHp ? 'Q' : '',
        'Funding Stream': isHp ? 'Health Program (HP)' : 'Revolving Drug Fund (RDF)',
        'Unrestricted Stock': item.unrestrictedStock,
        'Stock in Quality Inspection': item.stockInQualityInspection,
        'Blocked Stock': item.blockedStock,
        'Current Value of Unrestricted Stock': item.currentValueOfUnrestrictedStock,
        'Inventory Valuation Type': item.inventoryValuationType,
        'Material Group Name': item.materialGroupName,
        'Value of Blocked Stock': item.valueOfBlockedStock,
        'Value of Stock in Quality Inspection': item.valueOfStockInQualityInspection,
        'WBS Element': item.wbsElement
      };
    });
    downloadCSV(`EPSS_Multiple_Stock_Ledger_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.materialDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.material?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.plant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.storageLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.specialStockType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inventoryValuationType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.materialGroupName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.wbsElement?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPlant = selectedPlant === 'all' || item.plant === selectedPlant;
      
      const sType = (item.specialStockType || '').trim();
      const isItemHp = sType.toUpperCase() === 'Q' || sType.toUpperCase().startsWith('Q');
      const isItemRdf = !isItemHp;

      const matchStockType =
        selectedStockType === 'all' ||
        (selectedStockType === 'RDF' && isItemRdf) ||
        (selectedStockType === 'HP' && isItemHp) ||
        (selectedStockType === 'blank' && !sType) ||
        (selectedStockType === 'Q' && isItemHp) ||
        item.specialStockType === selectedStockType;

      return matchSearch && matchPlant && matchStockType;
    });

    return [...filtered].sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];

      if (typeof aVal === 'string' || typeof bVal === 'string') {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' || typeof bVal === 'number') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [items, searchQuery, selectedPlant, selectedStockType, sortField, sortDirection]);

  // Analytics: Total Value & Unique Line Items by RDF & HP
  const totalStockValue = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
    }, 0);
  }, [items]);

  const valueCircleChartData = useMemo(() => {
    const groupVal: Record<string, number> = {};
    items.forEach(item => {
      const g = item.materialGroupName || item.specialStockType || 'General';
      const val = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
      groupVal[g] = (groupVal[g] || 0) + val;
    });
    const total = totalStockValue || 1;
    const colors = ['#0891b2', '#059669', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308'];
    return Object.entries(groupVal)
      .map(([name, val], idx) => ({
        name,
        value: val,
        percentage: Number(((val / total) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [items, totalStockValue]);

  const rdfBarChartData = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    items.forEach(item => {
      const rdf = item.specialStockType || item.wbsElement || 'Standard RDF';
      if (!counts[rdf]) counts[rdf] = new Set();
      counts[rdf].add(item.material || item.id);
    });
    return Object.entries(counts)
      .map(([rdf, set]) => ({
        name: rdf,
        count: set.size
      }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const hpBarChartData = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    items.forEach(item => {
      const hp = item.materialGroupName || item.plant || 'General Program';
      if (!counts[hp]) counts[hp] = new Set();
      counts[hp].add(item.material || item.id);
    });
    return Object.entries(counts)
      .map(([hp, set]) => ({
        name: hp,
        count: set.size
      }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.plant) set.add(i.plant); });
    return Array.from(set).sort();
  }, [items]);

  const uniqueStockTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.specialStockType) set.add(i.specialStockType); });
    return Array.from(set).sort();
  }, [items]);

  // Aggregated KPIs
  const totalUnrestrictedStock = useMemo(() => items.reduce((acc, i) => acc + (i.unrestrictedStock || 0), 0), [items]);
  const totalInspectionStock = useMemo(() => items.reduce((acc, i) => acc + (i.stockInQualityInspection || 0), 0), [items]);
  const totalBlockedStock = useMemo(() => items.reduce((acc, i) => acc + (i.blockedStock || 0), 0), [items]);
  const totalValuationAll = useMemo(
    () => items.reduce((acc, i) => acc + (i.currentValueOfUnrestrictedStock || 0) + (i.valueOfBlockedStock || 0) + (i.valueOfStockInQualityInspection || 0), 0),
    [items]
  );

  const duplicateMaterials = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      if (item.material) {
        counts.set(item.material, (counts.get(item.material) || 0) + 1);
      }
    });
    return new Set(
      items
        .filter(item => item.material && (counts.get(item.material) || 0) > 1)
        .map(item => item.material)
    );
  }, [items]);

  const deduplicatedCounts = useMemo(() => {
    if (duplicateMaterials.size === 0) return { totalDuplicates: 0, uniqueMaterials: items.length, recordsToRemove: 0 };

    const uniqueKeys = new Set<string>();
    items.forEach((item) => {
      const mat = (item.material || '').trim().toUpperCase();
      if (mat) uniqueKeys.add(mat);
      else uniqueKeys.add(item.id);
    });

    return {
      totalDuplicates: duplicateMaterials.size,
      uniqueMaterials: uniqueKeys.size,
      recordsToRemove: items.length - uniqueKeys.size
    };
  }, [duplicateMaterials, items]);

  const handleResolveDuplicates = (strategy: 'keep-latest' | 'merge-quantities') => {
    if (!onUploadMultipleStockData || items.length === 0) return;

    const groups = new Map<string, MultipleStockRecord[]>();
    const itemsWithoutMaterial: MultipleStockRecord[] = [];

    items.forEach((item) => {
      const key = (item.material || '').trim().toUpperCase();
      if (!key) {
        itemsWithoutMaterial.push(item);
      } else {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
    });

    const resolved: MultipleStockRecord[] = [...itemsWithoutMaterial];

    groups.forEach((groupItems) => {
      if (groupItems.length === 1) {
        resolved.push(groupItems[0]);
      } else {
        if (strategy === 'keep-latest') {
          const latestItem = groupItems.reduce((latest, current) => {
            const t1 = new Date(latest.uploadedAt || 0).getTime();
            const t2 = new Date(current.uploadedAt || 0).getTime();
            return t2 > t1 ? current : latest;
          }, groupItems[groupItems.length - 1]);
          resolved.push(latestItem);
        } else {
          const base = { ...groupItems[groupItems.length - 1] };
          let unres = 0;
          let insp = 0;
          let blk = 0;
          let valUnres = 0;
          let valBlk = 0;
          let valInsp = 0;

          groupItems.forEach((it) => {
            unres += Number(it.unrestrictedStock || 0);
            insp += Number(it.stockInQualityInspection || 0);
            blk += Number(it.blockedStock || 0);
            valUnres += Number(it.currentValueOfUnrestrictedStock || 0);
            valBlk += Number(it.valueOfBlockedStock || 0);
            valInsp += Number(it.valueOfStockInQualityInspection || 0);
          });

          base.unrestrictedStock = unres;
          base.stockInQualityInspection = insp;
          base.blockedStock = blk;
          base.currentValueOfUnrestrictedStock = valUnres;
          base.valueOfBlockedStock = valBlk;
          base.valueOfStockInQualityInspection = valInsp;

          resolved.push(base);
        }
      }
    });

    onUploadMultipleStockData(resolved, 'replace');
    setIsResolveModalOpen(false);
    setUploadToast({
      type: 'success',
      message: strategy === 'keep-latest'
        ? `✓ Resolved duplicate materials! Kept latest upload entries (Reduced from ${items.length} to ${resolved.length} records).`
        : `✓ Resolved duplicate materials! Merged stock quantities & valuation totals (Reduced from ${items.length} to ${resolved.length} records).`
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      {/* Native Browser File Input linked to all upload triggers and labels */}
      <input
        id="multiple-stock-browser-file-picker"
        type="file"
        ref={directFileInputRef}
        onChange={handleDirectFileUpload}
        accept=".xlsx,.xls,.csv,.ods"
        multiple
        className="sr-only"
      />



      {/* Duplicate Records Yellow Alert & Resolution Banner */}
      {duplicateMaterials.size > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shadow-2xs shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
                  {duplicateMaterials.size} Duplicate Material Records Detected
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 font-mono">
                  Yellow Highlighted in Table
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Multiple stock entries share identical material codes. Resolve duplicates by keeping latest uploads or merging quantity totals.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Bulk Resolve Duplicates</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DATA TABLE DISPLAY (14 COLUMNS)                                       */}
      {/* ========================================================================= */}
      {(multipleStockViewMode === 'table' || multipleStockViewMode === 'combined') && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden w-full min-w-0 max-w-full">

        {/* Collapsible Drop & Paste Zone - Only visible to Inventory Administrators */}
        {isAdmin && (isUploadPanelOpen || isDragging) && (
          <div className="border-t border-indigo-200 bg-slate-50 p-5 space-y-4 transition-all">
            {/* Upload Mode Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadTab('file')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    uploadTab === 'file'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Browse Spreadsheet (.xlsx, .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('paste')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    uploadTab === 'paste'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste from Clipboard / Excel</span>
                </button>
              </div>

              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>All 14 columns will be recorded & immediately listed</span>
              </div>
            </div>

            {uploadTab === 'file' ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleOpenBrowserFilePicker}
                className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-100/70 scale-[0.99]'
                    : 'border-indigo-300 hover:border-indigo-600 bg-white hover:bg-indigo-50/40 shadow-xs'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Drop Your Excel or CSV File Here, or Click to Browse
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Supports .xlsx, .xls, .csv spreadsheets. Uploaded rows are automatically saved and displayed across all 14 columns.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label
                    htmlFor="multiple-stock-browser-file-picker"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File from Computer</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-600 font-medium">
                  Paste rows directly from Excel or Google Sheets (headers will be matched to the 14 columns):
                </div>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={4}
                  placeholder="Material&#9;Material Description&#9;Plant&#9;Storage Location&#9;Special Stock Type&#9;Unrestricted Stock&#9;Stock in Quality Inspection&#9;Blocked Stock&#9;Current Value of Unrestricted Stock&#9;Inventory Valuation Type&#9;Material Group Name&#9;Value of Blocked Stock&#9;Value of Stock in Quality Inspection&#9;WBS Element"
                  className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPasteContent('')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                  >
                    Clear Text
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPastedData}
                    disabled={!pasteContent.trim()}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Parse & Save Pasted Stock Data</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time processing text */}
        {isProcessingFiles && (
          <div className="m-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-3 text-indigo-900 text-xs font-bold animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span>{processingStatusText || 'Reading spreadsheet and parsing stock records...'}</span>
          </div>
        )}

        {/* Toast Notification */}
        {uploadToast && (
          <div
            className={`mx-4 my-2 p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
              uploadToast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : uploadToast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-indigo-50 border-indigo-300 text-indigo-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {uploadToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : uploadToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
              <span>{uploadToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadToast(null)}
              className="text-slate-400 hover:text-slate-700 ml-3 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-slate-50 border-t border-b border-slate-200 p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Wrapper */}
          <div className="relative w-full md:w-96 flex items-center gap-2 min-w-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by material code, description, warehouse, WBS..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Plant Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">Plant:</span>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Plants ({uniquePlants.length})</option>
                {uniquePlants.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Stock Type Filter */}
            {uniqueStockTypes.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Stock Type:</span>
                <select
                  value={selectedStockType}
                  onChange={(e) => setSelectedStockType(e.target.value)}
                  className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  {uniqueStockTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && items.length > 0 && onClearAllMultipleStockData && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Clear all Multiple Stock records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Stock</span>
              </button>
            )}

            {(searchQuery || selectedPlant !== 'all' || selectedStockType !== 'all') && (
              <button
                type="button"
                onClick={() => { setSelectedPlant('all'); setSelectedStockType('all'); setSearchQuery(''); }}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition cursor-pointer shadow-2xs"
                title="Reset all search filters"
              >
                Reset
              </button>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 ml-auto">
              <span className="font-semibold text-slate-500">Sorted by:</span>
              <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {sortField} ({sortDirection === 'asc' ? 'A→Z' : 'Z→A'})
              </span>
            </div>
          </div>
        </div>

          <div className="overflow-x-auto max-h-[640px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap select-none shadow-2xs">
                  <th className="p-3 w-12 text-center text-slate-500">#</th>
                  
                  {/* Column 1: Material */}
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => handleSort('material')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>1. Material</span>
                      {sortField === 'material' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 2: Material Description */}
                  <th className="p-3 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => handleSort('materialDescription')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>2. Material Description</span>
                      {sortField === 'materialDescription' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 3: Plant */}
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => handleSort('plant')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>3. Plant</span>
                      {sortField === 'plant' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 4: Storage Location */}
                  <th className="p-3 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleSort('storageLocation')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>4. Storage Location</span>
                      {sortField === 'storageLocation' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 5: Special Stock Type */}
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => handleSort('specialStockType')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>5. Special Stock Type</span>
                      {sortField === 'specialStockType' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 6: Unrestricted Stock */}
                  <th className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('unrestrictedStock')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>6. Unrestricted Stock</span>
                      {sortField === 'unrestrictedStock' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 7: Stock in Quality Inspection */}
                  <th className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('stockInQualityInspection')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>7. Stock in Quality Inspection</span>
                      {sortField === 'stockInQualityInspection' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 8: Blocked Stock */}
                  <th className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('blockedStock')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>8. Blocked Stock</span>
                      {sortField === 'blockedStock' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 9: Current Value of Unrestricted Stock */}
                  <th className="p-3 text-right min-w-[170px]">
                    <button
                      type="button"
                      onClick={() => handleSort('currentValueOfUnrestrictedStock')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>9. Current Value of Unrestricted Stock</span>
                      {sortField === 'currentValueOfUnrestrictedStock' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 10: Inventory Valuation Type */}
                  <th className="p-3 min-w-[150px]">
                    <button
                      type="button"
                      onClick={() => handleSort('inventoryValuationType')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>10. Inventory Valuation Type</span>
                      {sortField === 'inventoryValuationType' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 11: Material Group Name */}
                  <th className="p-3 min-w-[160px]">
                    <button
                      type="button"
                      onClick={() => handleSort('materialGroupName')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>11. Material Group Name</span>
                      {sortField === 'materialGroupName' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 12: Value of Blocked Stock */}
                  <th className="p-3 text-right min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleSort('valueOfBlockedStock')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>12. Value of Blocked Stock</span>
                      {sortField === 'valueOfBlockedStock' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 13: Value of Stock in Quality Inspection */}
                  <th className="p-3 text-right min-w-[170px]">
                    <button
                      type="button"
                      onClick={() => handleSort('valueOfStockInQualityInspection')}
                      className="flex items-center justify-end gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer ml-auto"
                    >
                      <span>13. Value of Stock in Quality Inspection</span>
                      {sortField === 'valueOfStockInQualityInspection' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Column 14: WBS Element */}
                  <th className="p-3 min-w-[130px]">
                    <button
                      type="button"
                      onClick={() => handleSort('wbsElement')}
                      className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span>14. WBS Element</span>
                      {sortField === 'wbsElement' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </th>

                  {/* Cloud Sync */}
                  <th className="p-3 text-center min-w-[110px]">Cloud Sync</th>

                  {onDeleteMultipleStockItem && <th className="p-3 text-center w-16">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={onDeleteMultipleStockItem ? 16 : 15} className="py-14 px-4 text-center">
                      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mb-3">
                          <Boxes className="w-6 h-6 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {items.length === 0 ? 'No Multiple Stock Records Recorded Yet' : 'No Matching Stock Records Found'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 text-center">
                          {items.length === 0
                            ? 'Upload your Multiple Stock spreadsheet using the module above or load demo records to display recorded data.'
                            : 'No records match your active search filter. Reset filters to view all recorded rows.'}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <label
                            htmlFor="multiple-stock-browser-file-picker"
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Browse Spreadsheet Now</span>
                          </label>

                          {items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setSelectedPlant('all'); setSelectedStockType('all'); setSearchQuery(''); }}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className={`${duplicateMaterials.has(item.material) ? 'bg-yellow-100' : 'hover:bg-slate-50'} transition group`}>
                      <td className="p-3 text-center text-slate-400 font-sans">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/60 font-mono">
                          {item.material}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-medium text-slate-900 max-w-[280px]" title={item.materialDescription}>
                        <div className="line-clamp-2 leading-snug flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              (item.syncStatus || 'synced') === 'pending'
                                ? 'bg-amber-500 animate-ping'
                                : (item.syncStatus || 'synced') === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500 shadow-xs shadow-emerald-400/50'
                            }`}
                            title={
                              (item.syncStatus || 'synced') === 'pending'
                                ? 'Pending sync with Supabase'
                                : (item.syncStatus || 'synced') === 'offline'
                                ? 'Stored locally / offline'
                                : 'Successfully synced with Supabase backend'
                            }
                          />
                          <span>{item.materialDescription}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px]">
                          {item.plant}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-700">{item.storageLocation}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.specialStockType === 'Project Stock'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : item.specialStockType === 'Consignment'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {item.specialStockType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600 font-mono">
                        {onUpdateMultipleStockItem ? (
                          <input
                            type="number"
                            className="w-full text-right bg-transparent border-b border-dashed border-emerald-300 focus:outline-none focus:border-emerald-600"
                            value={item.unrestrictedStock}
                            onChange={(e) => onUpdateMultipleStockItem({ ...item, unrestrictedStock: Number(e.target.value) })}
                          />
                        ) : (
                          formatNumber(item.unrestrictedStock)
                        )}
                      </td>
                      <td className="p-3 text-right text-amber-600 font-bold font-mono">
                        {onUpdateMultipleStockItem ? (
                          <input
                            type="number"
                            className="w-full text-right bg-transparent border-b border-dashed border-amber-300 focus:outline-none focus:border-amber-600"
                            value={item.stockInQualityInspection}
                            onChange={(e) => onUpdateMultipleStockItem({ ...item, stockInQualityInspection: Number(e.target.value) })}
                          />
                        ) : (
                          formatNumber(item.stockInQualityInspection)
                        )}
                      </td>
                      <td className="p-3 text-right font-bold font-mono">
                        <span className={item.blockedStock > 0 ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : 'text-slate-400'}>
                          {onUpdateMultipleStockItem ? (
                            <input
                              type="number"
                              className="w-full text-right bg-transparent border-b border-dashed border-rose-300 focus:outline-none focus:border-rose-600"
                              value={item.blockedStock}
                              onChange={(e) => onUpdateMultipleStockItem({ ...item, blockedStock: Number(e.target.value) })}
                            />
                          ) : (
                            formatNumber(item.blockedStock)
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-900 font-bold font-mono">
                        {formatCurrency(item.currentValueOfUnrestrictedStock)}
                      </td>
                      <td className="p-3 font-sans text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {item.inventoryValuationType}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-700">{item.materialGroupName}</td>
                      <td className="p-3 text-right text-slate-700 font-mono">
                        {formatCurrency(item.valueOfBlockedStock)}
                      </td>
                      <td className="p-3 text-right text-slate-700 font-mono">
                        {formatCurrency(item.valueOfStockInQualityInspection)}
                      </td>
                      <td className="p-3 font-sans text-[10px]">
                        <span className="font-mono text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.wbsElement}
                        </span>
                      </td>
                      {/* Cloud Sync */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            (item.syncStatus || 'synced') === 'pending'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : (item.syncStatus || 'synced') === 'offline'
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                          title={
                            (item.syncStatus || 'synced') === 'pending'
                              ? 'Stock record pending write to Supabase'
                              : (item.syncStatus || 'synced') === 'offline'
                              ? 'Offline stock record saved locally'
                              : 'Stock record verified and active on Supabase'
                          }
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              (item.syncStatus || 'synced') === 'pending'
                                ? 'bg-amber-500 animate-pulse'
                                : (item.syncStatus || 'synced') === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span>{(item.syncStatus || 'synced') === 'pending' ? 'Pending' : (item.syncStatus || 'synced') === 'offline' ? 'Offline' : 'Synced'}</span>
                        </span>
                      </td>
                      {onDeleteMultipleStockItem && (
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteMultipleStockItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Delete Stock Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ========================================================================= */}
      {/* 2. KPI METRIC SUMMARY CARDS                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Unrestricted Stock</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{formatNumber(totalUnrestrictedStock)}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Units Ready for Distribution</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Quality Inspection</div>
            <div className="text-xl font-black text-indigo-600 mt-0.5 font-mono">{formatNumber(totalInspectionStock)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Units Under Testing</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Split className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Blocked Stock</div>
            <div className="text-xl font-black text-rose-600 mt-0.5 font-mono">{formatNumber(totalBlockedStock)}</div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">Quarantined / Restricted</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Valuation (ETB)</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5 font-mono">{formatCurrency(totalValuationAll)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Across All Plant Locations</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>
      </div>
      </>
      )}

      {/* ========================================================================= */}
      {/* 2. MULTIPLE STOCK VISUAL ANALYTICS DASHBOARD                             */}
      {/* Rendered below the table in Combined mode, or solo in Analytics mode     */}
      {/* ========================================================================= */}
      {(multipleStockViewMode === 'analytics' || multipleStockViewMode === 'combined') && (
        <div id="multiple-stock-analytics-container" className="w-full min-w-0 max-w-full">
          <DashboardViewMultipleStockAnalytics
            multipleStockItems={items}
            onUploadMultipleStockData={onUploadMultipleStockData}
            showHighValuationTable={true}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ADD SINGLE STOCK RECORD MODAL                                          */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-indigo-200">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-wide uppercase">Add Single Stock Record</h3>
                  <p className="text-xs text-indigo-200">Enter stock details for the 14 attributes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Material / SKU Code</label>
                  <input
                    type="text"
                    value={formMaterial}
                    onChange={(e) => setFormMaterial(e.target.value)}
                    placeholder="e.g. MAT-100238"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Material Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="e.g. Surgical Gloves Latex Free 7.5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plant (e.g. HO01, AA01)</label>
                  <input
                    type="text"
                    value={formPlant}
                    onChange={(e) => setFormPlant(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Storage Location / Warehouse</label>
                  <input
                    type="text"
                    value={formWh}
                    onChange={(e) => setFormWh(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Stock Type</label>
                  <input
                    type="text"
                    value={formSpecialStock}
                    onChange={(e) => setFormSpecialStock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unrestricted Stock (Qty)</label>
                  <input
                    type="number"
                    value={formUnrestricted}
                    onChange={(e) => setFormUnrestricted(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quality Inspection (Qty)</label>
                  <input
                    type="number"
                    value={formInspection}
                    onChange={(e) => setFormInspection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Blocked Stock (Qty)</label>
                  <input
                    type="number"
                    value={formBlocked}
                    onChange={(e) => setFormBlocked(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Value of Unrestricted Stock (ETB)</label>
                  <input
                    type="number"
                    value={formValUnres}
                    onChange={(e) => setFormValUnres(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Inventory Valuation Type</label>
                  <input
                    type="text"
                    value={formValType}
                    onChange={(e) => setFormValType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Material Group Name</label>
                  <input
                    type="text"
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">WBS Element</label>
                  <input
                    type="text"
                    value={formWbs}
                    onChange={(e) => setFormWbs(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Stock Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Resolve Duplicates Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shadow-2xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Bulk Resolve Duplicate Records
                  </h3>
                  <p className="text-xs text-slate-600">
                    Found <strong className="text-amber-900">{duplicateMaterials.size} material codes</strong> with duplicate stock entries
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 font-medium">
                Choose a resolution strategy to merge or deduplicate records across the Multiple Stock ledger:
              </div>

              <div className="space-y-3">
                {/* Strategy 1: Merge Quantities */}
                <div
                  onClick={() => setSelectedResolveStrategy('merge-quantities')}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                    selectedResolveStrategy === 'merge-quantities'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolveStrategy"
                    checked={selectedResolveStrategy === 'merge-quantities'}
                    onChange={() => setSelectedResolveStrategy('merge-quantities')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Merge Quantity & Valuation Totals (Recommended)</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md">
                        Preserves Total Stock
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Sums unrestricted stock, quality inspection, blocked stock, and valuations for duplicate entries into a single consolidated record per material.
                    </p>
                  </div>
                </div>

                {/* Strategy 2: Keep Latest Upload */}
                <div
                  onClick={() => setSelectedResolveStrategy('keep-latest')}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                    selectedResolveStrategy === 'keep-latest'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolveStrategy"
                    checked={selectedResolveStrategy === 'keep-latest'}
                    onChange={() => setSelectedResolveStrategy('keep-latest')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Keep Latest Upload / Record</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                        Overwrites Older Duplicates
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Keeps only the most recent entry for each duplicate material code and discards older redundant rows.
                    </p>
                  </div>
                </div>
              </div>

              {/* Deduplication Summary Preview Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Deduplication Summary Preview:</span>
                  <span className="font-mono text-indigo-700 font-black">
                    {items.length} → {deduplicatedCounts.uniqueMaterials} Records
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Duplicate Material Codes Detected:</span>
                  <span className="font-mono font-semibold text-amber-700">{deduplicatedCounts.totalDuplicates} Materials</span>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Redundant Rows to Consolidate:</span>
                  <span className="font-mono font-semibold text-rose-700">-{deduplicatedCounts.recordsToRemove} Rows</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResolveDuplicates(selectedResolveStrategy)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Apply Bulk Resolution ({selectedResolveStrategy === 'keep-latest' ? 'Keep Latest' : 'Merge Quantities'})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DEDICATED MULTIPLE STOCK UPLOAD MODAL - Admin Only                     */}
      {/* ========================================================================= */}
      {isAdmin && isUploadModalOpen && (
        <MultipleStockUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadMultipleStockData={onUploadMultipleStockData || (() => {})}
          initialItems={items}
        />
      )}
    </div>
  );
};
