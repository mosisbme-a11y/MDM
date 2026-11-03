import React, { useState, useMemo } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  Package,
  RotateCcw,
  Filter,
  Layers,
  PieChart as PieChartIcon,
  List,
  CircleDot,
  SlidersHorizontal,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  Upload,
  Calendar,
  CalendarRange,
  TrendingUp,
  Download,
  Trash2,
  Sparkles,
  Plus,
  Info,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { MedicalDeviceItem, PlantSummary } from '../types';
import { formatNumber, formatCurrency, downloadCSV } from '../utils/formatters';
import { MultipleDataUploadModal, UploadedBatchInfo } from './MultipleDataUploadModal';

export interface TotalDeliveryPerformanceSectionProps {
  items: MedicalDeviceItem[];
  plants?: PlantSummary[];
  onFilterStatus: (status: string) => void;
  onNavigateTab: (tab: string) => void;
  language?: string;
  onUploadBatchesGlobal?: (batches: UploadedBatchInfo[]) => void;
  isAdmin?: boolean;
}

// Time Range Presets
export type TimeRangePreset =
  | 'all'
  | 'last30'
  | 'last90'
  | 'ytd'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'custom';

// Helper to determine Procurement Package from medical device item attributes
export function getItemPackage(item: MedicalDeviceItem): string {
  const desc = (item.materialDescription || '').toLowerCase();
  const mat = (item.material || '').toLowerCase();

  // Package 1: Imaging & Radiology
  if (
    desc.includes('x-ray') ||
    desc.includes('ultrasound') ||
    desc.includes('ct ') ||
    desc.includes('radiology') ||
    desc.includes('mri') ||
    desc.includes('c-arm') ||
    desc.includes('scanner')
  ) {
    return 'Package 1: Imaging & Radiology';
  }

  // Package 2: ICU & Life Support
  if (
    desc.includes('ventilator') ||
    desc.includes('monitor') ||
    desc.includes('defibrillator') ||
    desc.includes('infusion') ||
    desc.includes('syringe pump') ||
    desc.includes('anesthesia') ||
    desc.includes('oxygen')
  ) {
    return 'Package 2: ICU & Life Support';
  }

  // Package 3: Laboratory & Diagnostics
  if (
    desc.includes('centrifuge') ||
    desc.includes('microscope') ||
    desc.includes('analyzer') ||
    desc.includes('incubator') ||
    desc.includes('autoclave') ||
    desc.includes('spectro') ||
    desc.includes('lab') ||
    desc.includes('test')
  ) {
    return 'Package 3: Laboratory & Diagnostics';
  }

  // Package 4: Surgical & Theatre
  if (
    desc.includes('surgical') ||
    desc.includes('theatre') ||
    desc.includes('electrosurgical') ||
    desc.includes('suction') ||
    desc.includes('operating') ||
    desc.includes('endoscop') ||
    desc.includes('forceps')
  ) {
    return 'Package 4: Surgical & Theatre';
  }

  // Package 5: Maternal, Neonatal & Child Health
  if (
    desc.includes('infant') ||
    desc.includes('neonatal') ||
    desc.includes('warmer') ||
    desc.includes('phototherapy') ||
    desc.includes('fetal') ||
    desc.includes('delivery') ||
    desc.includes('maternal') ||
    desc.includes('resuscitation')
  ) {
    return 'Package 5: Maternal & Neonatal Health';
  }

  // Package 6: General Medical Equipment
  return 'Package 6: General Medical Equipment';
}

// Helper to determine if an item is RDF (Revolving Drug Fund) vs Program/Grant
export function isItemRDF(item: MedicalDeviceItem): boolean {
  const wbs = (item.wbsElement || '').toUpperCase();
  const source = (item.budgetSource || '').toUpperCase();
  const stock = (item.stockType || '').toUpperCase();

  if (wbs.includes('RDF') || source.includes('RDF') || source.includes('REVOLVING')) {
    return true;
  }
  if (stock.includes('UNRESTRICTED') && !source.includes('GLOBAL') && !source.includes('UNICEF') && !source.includes('UNFPA')) {
    return true;
  }
  return false;
}

// Helper to extract specific Health Program
export function getItemProgram(item: MedicalDeviceItem): string {
  const wbs = (item.wbsElement || '').toUpperCase();
  const src = (item.budgetSource || '').toUpperCase();

  if (wbs.includes('RDF') || src.includes('RDF') || src.includes('REVOLVING')) return 'RDF (Revolving Drug Fund)';
  if (wbs.startsWith('GF') || src.includes('GLOBAL FUND')) return 'Global Fund (GF)';
  if (wbs.startsWith('MNCH') || wbs.startsWith('UNICEF') || src.includes('UNICEF')) return 'UNICEF / MNCH Program';
  if (wbs.startsWith('UNFPA') || src.includes('UNFPA')) return 'UNFPA Reproductive Health';
  if (wbs.startsWith('MOH') || wbs.startsWith('MOF') || wbs.startsWith('SDG') || src.includes('TREASURY')) return 'MOH / Government Treasury';
  if (wbs.startsWith('CONS') || wbs.startsWith('RTI') || wbs.startsWith('PSM')) return 'Health System Strengthening (HSS/PSM)';
  return 'Other Specialized Health Programs';
}

// Helper to resolve an authentic or user-assigned date for any item
export function resolveItemDate(item: MedicalDeviceItem, index: number = 0): string {
  if (item.deliveryDate && item.deliveryDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return item.deliveryDate;
  }
  if (item.dispatchDate && item.dispatchDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return item.dispatchDate;
  }
  const tf = (item.timeFrame || '').toLowerCase();
  if (tf.includes('q1') || tf.includes('jan') || tf.includes('feb') || tf.includes('mar')) {
    return '2026-02-15';
  }
  if (tf.includes('q2') || tf.includes('apr') || tf.includes('may') || tf.includes('jun')) {
    return '2026-05-15';
  }
  if (tf.includes('q3') || tf.includes('jul') || tf.includes('aug') || tf.includes('sep')) {
    return '2026-08-15';
  }
  if (tf.includes('q4') || tf.includes('oct') || tf.includes('nov') || tf.includes('dec')) {
    return '2026-11-15';
  }

  // Deterministic spread across Jan - Sep 2026 using item ID hash
  const str = item.id || item.material || String(index);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const month = (positiveHash % 9) + 1;
  const day = (positiveHash % 26) + 1;
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  return `2026-${monthStr}-${dayStr}`;
}

// Circular SVG Progress Ring Component
interface CircleProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

const CircleProgressRing: React.FC<CircleProgressProps> = ({
  percentage,
  size = 100,
  strokeWidth = 8,
  color = '#10b981',
  bgColor = '#e2e8f0',
  children
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform origin-center">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
};

export const TotalDeliveryPerformanceSection: React.FC<TotalDeliveryPerformanceSectionProps> = ({
  items,
  plants = [],
  onFilterStatus,
  onNavigateTab,
  language = 'en',
  onUploadBatchesGlobal,
  isAdmin = false
}) => {
  // Multi-upload Modal & Batches State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadedBatches, setUploadedBatches] = useState<UploadedBatchInfo[]>([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all'); // 'all' | 'default' | batchId

  // Time Ranging State
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-01-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-17');
  const [showTimelineTrend, setShowTimelineTrend] = useState<boolean>(true);

  // Filter states
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<string>('all');
  const [selectedRdf, setSelectedRdf] = useState<string>('all'); // 'all' | 'rdf' | 'non-rdf'
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'circles' | 'table'>('circles');

  // Compute active date boundaries based on timePreset
  const activeDateRange = useMemo(() => {
    switch (timePreset) {
      case 'last30':
        return { start: '2026-08-18', end: '2026-09-17', label: 'Last 30 Days (Aug 18 - Sep 17, 2026)' };
      case 'last90':
        return { start: '2026-06-19', end: '2026-09-17', label: 'Last 90 Days (Jun 19 - Sep 17, 2026)' };
      case 'ytd':
        return { start: '2026-01-01', end: '2026-09-17', label: 'Year to Date 2026 (Jan 01 - Sep 17, 2026)' };
      case 'q1':
        return { start: '2026-01-01', end: '2026-03-31', label: 'Q1 2026 (Jan 01 - Mar 31, 2026)' };
      case 'q2':
        return { start: '2026-04-01', end: '2026-06-30', label: 'Q2 2026 (Apr 01 - Jun 30, 2026)' };
      case 'q3':
        return { start: '2026-07-01', end: '2026-09-30', label: 'Q3 2026 (Jul 01 - Sep 30, 2026)' };
      case 'q4':
        return { start: '2026-10-01', end: '2026-12-31', label: 'Q4 2026 (Oct 01 - Dec 31, 2026)' };
      case 'custom':
        return {
          start: customStartDate || '2025-01-01',
          end: customEndDate || '2026-12-31',
          label: `Custom: ${customStartDate} to ${customEndDate}`
        };
      case 'all':
      default:
        return { start: '2025-01-01', end: '2026-12-31', label: 'All Dates (Full Timeline)' };
    }
  }, [timePreset, customStartDate, customEndDate]);

  // Merge base inventory items with all uploaded batch items
  const combinedItemsPool = useMemo(() => {
    let pool: MedicalDeviceItem[] = [];

    if (selectedBatchFilter === 'all') {
      pool = [...items];
      uploadedBatches.forEach((batch) => {
        pool = pool.concat(batch.items);
      });
    } else if (selectedBatchFilter === 'default') {
      pool = [...items];
    } else {
      const matchBatch = uploadedBatches.find((b) => b.id === selectedBatchFilter);
      if (matchBatch) {
        pool = [...matchBatch.items];
      } else {
        pool = [...items];
      }
    }

    return pool;
  }, [items, uploadedBatches, selectedBatchFilter]);

  // Extract all distinct branches from the combined pool
  const availableBranches = useMemo(() => {
    const branchMap = new Map<string, { name: string; count: number }>();
    combinedItemsPool.forEach((item) => {
      const key = item.plantName || item.plant || 'Central Hub';
      
      // Exclude values that look like material codes or non-hub numeric strings
      const isMaterialCode = /^\d+$/.test(key.trim()) || key.trim().length <= 5;
      if (isMaterialCode) {
        return; // Exclude raw material codes
      }
      
      const existing = branchMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        branchMap.set(key, { name: key, count: 1 });
      }
    });
    
    // Sort by count descending and slice to use only 20 hubs
    return Array.from(branchMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [combinedItemsPool]);

  // Packages list
  const availablePackages = [
    'Package 1: Imaging & Radiology',
    'Package 2: ICU & Life Support',
    'Package 3: Laboratory & Diagnostics',
    'Package 4: Surgical & Theatre',
    'Package 5: Maternal & Neonatal Health',
    'Package 6: General Medical Equipment'
  ];

  // Programs list
  const availablePrograms = [
    'RDF (Revolving Drug Fund)',
    'Global Fund (GF)',
    'UNICEF / MNCH Program',
    'MOH / Government Treasury',
    'UNFPA Reproductive Health',
    'Health System Strengthening (HSS/PSM)',
    'Other Specialized Health Programs'
  ];

  // Check if any filter is active
  const hasActiveFilters =
    selectedBranch !== 'all' ||
    selectedPackage !== 'all' ||
    selectedRdf !== 'all' ||
    selectedProgram !== 'all' ||
    timePreset !== 'all' ||
    selectedBatchFilter !== 'all';

  const resetFilters = () => {
    setSelectedBranch('all');
    setSelectedPackage('all');
    setSelectedRdf('all');
    setSelectedProgram('all');
    setTimePreset('all');
    setSelectedBatchFilter('all');
  };

  // Filter items based on active criteria including TIME RANGING
  const filteredItems = useMemo(() => {
    return combinedItemsPool.filter((item, idx) => {
      // 1. Time Ranging Filter
      if (timePreset !== 'all') {
        const itemDate = resolveItemDate(item, idx);
        if (itemDate < activeDateRange.start || itemDate > activeDateRange.end) {
          return false;
        }
      }

      // 2. Branch filter
      if (selectedBranch !== 'all') {
        const branchKey = item.plantName || item.plant;
        if (branchKey !== selectedBranch) return false;
      }

      // 3. Package filter
      if (selectedPackage !== 'all') {
        const pkg = getItemPackage(item);
        if (pkg !== selectedPackage) return false;
      }

      // 4. RDF filter
      if (selectedRdf === 'rdf') {
        if (!isItemRDF(item)) return false;
      } else if (selectedRdf === 'non-rdf') {
        if (isItemRDF(item)) return false;
      }

      // 5. Program filter
      if (selectedProgram !== 'all') {
        const prog = getItemProgram(item);
        if (prog !== selectedProgram) return false;
      }

      return true;
    });
  }, [
    combinedItemsPool,
    timePreset,
    activeDateRange,
    selectedBranch,
    selectedPackage,
    selectedRdf,
    selectedProgram
  ]);

  // Calculate delivery metrics from filtered items
  const deliveryMetrics = useMemo(() => {
    const counts: Record<string, { units: number; lineItems: number; valuation: number }> = {
      'Delivered & Dispatched': { units: 0, lineItems: 0, valuation: 0 },
      'In Transit': { units: 0, lineItems: 0, valuation: 0 },
      'Port Customs Clearance': { units: 0, lineItems: 0, valuation: 0 },
      'Dispatch Pending': { units: 0, lineItems: 0, valuation: 0 },
      'Manufacturer Factory': { units: 0, lineItems: 0, valuation: 0 }
    };

    let totalUnitsCount = 0;
    let totalLineItemsCount = 0;
    let totalValuationCount = 0;

    filteredItems.forEach((item) => {
      const status = item.deliveryStatus || 'Delivered & Dispatched';
      const units = Number(item.qty) || 0;
      const val = units * (item.unitPrice || 0);

      if (!counts[status]) {
        counts[status] = { units: 0, lineItems: 0, valuation: 0 };
      }

      counts[status].units += units;
      counts[status].lineItems += 1;
      counts[status].valuation += val;

      totalUnitsCount += units;
      totalLineItemsCount += 1;
      totalValuationCount += val;
    });

    const stageMeta: Record<
      string,
      { color: string; bgTrack: string; icon: React.ReactNode; label: string; textClass: string }
    > = {
      'Delivered & Dispatched': {
        color: '#10b981',
        bgTrack: '#d1fae5',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        label: 'Delivered & Dispatched',
        textClass: 'text-emerald-700'
      },
      'In Transit': {
        color: '#3b82f6',
        bgTrack: '#dbeafe',
        icon: <Truck className="w-5 h-5 text-blue-600" />,
        label: 'In Transit',
        textClass: 'text-blue-700'
      },
      'Port Customs Clearance': {
        color: '#f59e0b',
        bgTrack: '#fef3c7',
        icon: <Building2 className="w-5 h-5 text-amber-600" />,
        label: 'Port Customs Clearance',
        textClass: 'text-amber-700'
      },
      'Dispatch Pending': {
        color: '#8b5cf6',
        bgTrack: '#ede9fe',
        icon: <Clock className="w-5 h-5 text-purple-600" />,
        label: 'Dispatch Pending',
        textClass: 'text-purple-700'
      },
      'Manufacturer Factory': {
        color: '#64748b',
        bgTrack: '#f1f5f9',
        icon: <Package className="w-5 h-5 text-slate-600" />,
        label: 'Manufacturer Factory',
        textClass: 'text-slate-700'
      }
    };

    const list = Object.entries(counts).map(([name, data]) => {
      const percentage = totalUnitsCount > 0 ? Math.round((data.units / totalUnitsCount) * 100) : 0;
      return {
        name,
        units: data.units,
        lineItems: data.lineItems,
        valuation: data.valuation,
        percentage,
        meta: stageMeta[name] || stageMeta['Manufacturer Factory']
      };
    });

    const deliveredUnits = counts['Delivered & Dispatched'].units;
    const overallPerformanceRate =
      totalUnitsCount > 0 ? Number(((deliveredUnits / totalUnitsCount) * 100).toFixed(1)) : 0;

    return {
      list,
      totalUnits: totalUnitsCount,
      totalLineItems: totalLineItemsCount,
      totalValuation: totalValuationCount,
      overallPerformanceRate
    };
  }, [filteredItems]);

  // Longitudinal Time Series Aggregation (Monthly Delivery Velocity & Performance)
  const timeSeriesData = useMemo(() => {
    const monthBuckets: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        delivered: number;
        inTransit: number;
        customs: number;
        pending: number;
        totalUnits: number;
        deliveryRate: number;
        valuation: number;
      }
    > = {};

    const months = [
      { key: '2026-01', label: 'Jan 2026' },
      { key: '2026-02', label: 'Feb 2026' },
      { key: '2026-03', label: 'Mar 2026' },
      { key: '2026-04', label: 'Apr 2026' },
      { key: '2026-05', label: 'May 2026' },
      { key: '2026-06', label: 'Jun 2026' },
      { key: '2026-07', label: 'Jul 2026' },
      { key: '2026-08', label: 'Aug 2026' },
      { key: '2026-09', label: 'Sep 2026' },
      { key: '2026-10', label: 'Oct 2026' },
      { key: '2026-11', label: 'Nov 2026' },
      { key: '2026-12', label: 'Dec 2026' }
    ];

    months.forEach((m) => {
      monthBuckets[m.key] = {
        monthKey: m.key,
        monthLabel: m.label,
        delivered: 0,
        inTransit: 0,
        customs: 0,
        pending: 0,
        totalUnits: 0,
        deliveryRate: 0,
        valuation: 0
      };
    });

    // Populate using filtered items (or active pool)
    filteredItems.forEach((item, idx) => {
      const d = resolveItemDate(item, idx);
      const mKey = d.slice(0, 7); // YYYY-MM
      const bucket = monthBuckets[mKey];
      if (bucket) {
        const u = Number(item.qty) || 1;
        const val = u * (item.unitPrice || 0);
        const status = item.deliveryStatus || 'Delivered & Dispatched';

        if (status === 'Delivered & Dispatched') bucket.delivered += u;
        else if (status === 'In Transit') bucket.inTransit += u;
        else if (status === 'Port Customs Clearance') bucket.customs += u;
        else bucket.pending += u;

        bucket.totalUnits += u;
        bucket.valuation += val;
      }
    });

    // Compute rates and filter out empty trailing months if not in range
    return Object.values(monthBuckets)
      .filter((b) => {
        if (timePreset === 'all') {
          return b.totalUnits > 0 || ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].includes(b.monthKey);
        }
        // Check if month falls inside activeDateRange
        const mStart = `${b.monthKey}-01`;
        const mEnd = `${b.monthKey}-31`;
        return mEnd >= activeDateRange.start && mStart <= activeDateRange.end;
      })
      .map((b) => ({
        ...b,
        deliveryRate: b.totalUnits > 0 ? Number(((b.delivered / b.totalUnits) * 100).toFixed(1)) : 0,
        valuationM: Number((b.valuation / 1_000_000).toFixed(2))
      }));
  }, [filteredItems, timePreset, activeDateRange]);

  // Branch Delivery Comparison (Top 6 Hubs with mini circles in active time range)
  const branchComparison = useMemo(() => {
    const hubMap: Record<string, { name: string; totalUnits: number; deliveredUnits: number }> = {};

    filteredItems.forEach((item) => {
      const hubName = (item.plantName || item.plant || 'Central Hub')
        .replace(' Regional Hub', '')
        .replace(' Central Hub', '');
      if (!hubMap[hubName]) {
        hubMap[hubName] = { name: hubName, totalUnits: 0, deliveredUnits: 0 };
      }
      const u = Number(item.qty) || 0;
      hubMap[hubName].totalUnits += u;
      if (item.deliveryStatus === 'Delivered & Dispatched' || !item.deliveryStatus) {
        hubMap[hubName].deliveredUnits += u;
      }
    });

    return Object.values(hubMap)
      .map((h) => ({
        ...h,
        rate: h.totalUnits > 0 ? Number(((h.deliveredUnits / h.totalUnits) * 100).toFixed(0)) : 0
      }))
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 6);
  }, [filteredItems]);

  // Recharts Donut Data
  const donutData = useMemo(() => {
    return deliveryMetrics.list
      .filter((s) => s.units > 0)
      .map((s) => ({
        name: s.name,
        value: s.units,
        percentage: s.percentage,
        color: s.meta.color
      }));
  }, [deliveryMetrics]);

  // Handle batches received from MultipleDataUploadModal
  const handleBatchesUploaded = (newBatches: UploadedBatchInfo[]) => {
    setUploadedBatches((prev) => [...prev, ...newBatches]);
    if (onUploadBatchesGlobal) {
      onUploadBatchesGlobal(newBatches);
    }
  };

  // Remove a batch
  const handleRemoveBatch = (batchId: string) => {
    setUploadedBatches((prev) => prev.filter((b) => b.id !== batchId));
    if (selectedBatchFilter === batchId) {
      setSelectedBatchFilter('all');
    }
  };

  // Export Filtered Time Analysis CSV
  const handleExportTimeAnalysis = () => {
    const exportRows = filteredItems.map((item, idx) => ({
      'Record ID': item.id,
      'Material Code': item.material,
      'Description': item.materialDescription,
      'Branch': item.plantName,
      'Delivery Status': item.deliveryStatus || 'Delivered & Dispatched',
      'Assigned Date': resolveItemDate(item, idx),
      'Quantity': item.qty,
      'Unit Price (ETB)': item.unitPrice,
      'Total Amount (ETB)': item.totalAmount,
      'Package': getItemPackage(item),
      'Funding Mechanism': isItemRDF(item) ? 'RDF' : 'Non-RDF',
      'Health Program': getItemProgram(item),
      'Data Batch': item.uploadBatchName || 'Default EPSS Master Inventory'
    }));

    downloadCSV(
      `EPSS_Delivery_Performance_TimeAnalysis_${activeDateRange.start}_to_${activeDateRange.end}.csv`,
      exportRows
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      {/* ========================================================================= */}
      {/* 1. Header with Multi-Data Upload Button & View Mode Switcher */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0 shadow-2xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-900">
                Total Delivery Performance & Logistics Snapshot
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Distribution
              </span>
              {uploadedBatches.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>{uploadedBatches.length} Batches Loaded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-dataset analytics with customizable time ranging across Branch, Package, Revolving Drug Fund (RDF), and Health Programs.
            </p>
          </div>
        </div>

        {/* Action Controls: Multi-Upload & View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          {/* Upload Multiple Data in One Button - Admin Only */}
          {isAdmin && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-xs flex items-center gap-2 transition cursor-pointer"
              title="Upload multiple datasets (Excel, CSV, JSON) for comparative time ranging analysis"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Multiple Data</span>
              {uploadedBatches.length > 0 && (
                <span className="bg-white/25 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  +{uploadedBatches.length}
                </span>
              )}
            </button>
          )}

          {/* Export Filtered Time Analysis CSV */}
          <button
            onClick={handleExportTimeAnalysis}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Download CSV export of currently active time range"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* View Mode Switcher (Circles View vs Table View) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('circles')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'circles'
                  ? 'bg-white text-cyan-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5 text-cyan-600" />
              <span>Circles View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-cyan-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-slate-600" />
              <span>Detailed Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TIME RANGING CONTROLS (Requested for Time-Based Delivery Analysis)     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-cyan-50/70 via-blue-50/50 to-slate-50 p-4 rounded-xl border border-cyan-200/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-950 uppercase tracking-wider">
            <CalendarRange className="w-4 h-4 text-cyan-600" />
            <span>Time Ranging Analysis for Total Delivery Performance</span>
          </div>
          <div className="text-[11px] font-semibold text-cyan-800 bg-cyan-100/70 px-2.5 py-0.5 rounded-full border border-cyan-200">
            {activeDateRange.label}
          </div>
        </div>

        {/* Time Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Presets:</span>
          </span>

          {[
            { id: 'all', label: 'All Dates' },
            { id: 'last30', label: 'Last 30 Days' },
            { id: 'last90', label: 'Last 90 Days' },
            { id: 'ytd', label: 'YTD 2026' },
            { id: 'q1', label: 'Q1 2026' },
            { id: 'q2', label: 'Q2 2026' },
            { id: 'q3', label: 'Q3 2026' },
            { id: 'q4', label: 'Q4 2026' },
            { id: 'custom', label: 'Custom Range' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setTimePreset(preset.id as TimeRangePreset)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                timePreset === preset.id
                  ? 'bg-cyan-700 text-white shadow-xs font-bold'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {/* Toggle Timeline Chart */}
          <button
            onClick={() => setShowTimelineTrend(!showTimelineTrend)}
            className={`ml-auto px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
              showTimelineTrend
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3 h-3 text-blue-600" />
            <span>{showTimelineTrend ? 'Hide Trend Chart' : 'Show Trend Chart'}</span>
          </button>
        </div>

        {/* Custom Start & End Date Pickers (Shown if 'custom' is active) */}
        {timePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-cyan-100 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Start Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="font-mono text-slate-800 outline-hidden bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">End Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="font-mono text-slate-800 outline-hidden bg-transparent"
              />
            </div>
            <span className="text-[11px] text-slate-500 italic">
              Delivery metrics and circular progress will compute specifically for shipments within this custom date span.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. UPLOADED BATCHES STRIP (When Multiple Datasets are Uploaded)            */}
      {/* ========================================================================= */}
      {uploadedBatches.length > 0 && (
        <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Multi-Source Data Ingestion ({uploadedBatches.length} Uploaded Datasets)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 transition cursor-pointer hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>Upload More Datasets</span>
              </button>
              <button
                onClick={() => {
                  setUploadedBatches([]);
                  setSelectedBatchFilter('all');
                }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition cursor-pointer hover:underline"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All Batches</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedBatchFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedBatchFilter === 'all'
                  ? 'bg-purple-700 text-white shadow-2xs font-bold'
                  : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/50'
              }`}
            >
              All Data Sources Combined ({formatNumber(combinedItemsPool.length)})
            </button>

            <button
              onClick={() => setSelectedBatchFilter('default')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedBatchFilter === 'default'
                  ? 'bg-purple-700 text-white shadow-2xs font-bold'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Default Inventory ({formatNumber(items.length)})
            </button>

            {uploadedBatches.map((batch) => (
              <div
                key={batch.id}
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedBatchFilter === batch.id
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-white text-purple-950 border border-purple-200 hover:bg-purple-100/40'
                }`}
              >
                <button
                  onClick={() => setSelectedBatchFilter(batch.id)}
                  className="cursor-pointer text-left truncate max-w-[200px]"
                  title={batch.batchName}
                >
                  {batch.batchName} ({batch.itemCount})
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveBatch(batch.id);
                  }}
                  className="w-4 h-4 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                  title="Remove this batch"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CRITERIA FILTERS: Branch, Package, RDF, Program                         */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
            <span>Delivery Performance Criteria Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition cursor-pointer hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Branch / Regional Hub Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-cyan-600" />
              <span>Branch (Regional Hub)</span>
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Branches ({availableBranches.length} Hubs)</option>
                {availableBranches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({formatNumber(b.count)})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. Package Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Package className="w-3 h-3 text-indigo-600" />
              <span>Procurement Package</span>
            </label>
            <div className="relative">
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Packages (Packages 1 - 6)</option>
                {availablePackages.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 3. RDF Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>RDF (Revolving Drug Fund)</span>
            </label>
            <div className="relative">
              <select
                value={selectedRdf}
                onChange={(e) => setSelectedRdf(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Funding Mechanisms</option>
                <option value="rdf">RDF Only (Revolving Drug Fund)</option>
                <option value="non-rdf">Non-RDF (Program / Direct Grants)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 4. Program Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-600" />
              <span>Health Program</span>
            </label>
            <div className="relative">
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Health Programs</option>
                {availablePrograms.map((prog) => (
                  <option key={prog} value={prog}>
                    {prog}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filter Summary Breadcrumb Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Scope Matching: <strong>{formatNumber(filteredItems.length)}</strong> Line Items (
              <strong>{formatNumber(deliveryMetrics.totalUnits)}</strong> Units)
            </span>
            {hasActiveFilters && (
              <span className="bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded text-[10px]">
                Filters Active
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span className="text-cyan-700 font-medium">Window: {activeDateRange.label}</span>
          </div>
          <div className="text-slate-500 font-mono">
            Filtered Valuation: <strong>ETB {(deliveryMetrics.totalValuation / 1_000_000).toFixed(1)}M</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TIME-SERIES DELIVERY PERFORMANCE TREND CHART                           */}
      {/* ========================================================================= */}
      {showTimelineTrend && timeSeriesData.length > 0 && (
        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Delivery Performance & Volume Velocity Over Time</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Monthly distribution throughput (bars) compared with live Total Delivery Index rate % (line).
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                <span>Delivered Units</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500"></span>
                <span>In Transit</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span>Customs Port</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-emerald-600 rounded-full"></span>
                <span className="text-emerald-700 font-bold">Delivery Rate %</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis
                  yAxisId="units"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatNumber(v)}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#10b981' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[170px]">
                          <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
                            <span>{label}</span>
                            <span className="text-emerald-400 font-black">{d.deliveryRate}% Delivered</span>
                          </div>
                          <div className="text-emerald-300 flex justify-between">
                            <span>Delivered:</span>
                            <span className="font-bold">{formatNumber(d.delivered)} units</span>
                          </div>
                          <div className="text-blue-300 flex justify-between">
                            <span>In Transit:</span>
                            <span className="font-bold">{formatNumber(d.inTransit)} units</span>
                          </div>
                          <div className="text-amber-300 flex justify-between">
                            <span>Customs Port:</span>
                            <span className="font-bold">{formatNumber(d.customs)} units</span>
                          </div>
                          <div className="text-purple-300 flex justify-between">
                            <span>Pending Factory:</span>
                            <span className="font-bold">{formatNumber(d.pending)} units</span>
                          </div>
                          <div className="text-slate-400 pt-1 border-t border-slate-800 flex justify-between font-mono text-[10px]">
                            <span>Period Valuation:</span>
                            <span>ETB {d.valuationM}M</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="units" dataKey="delivered" stackId="stack" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="units" dataKey="inTransit" stackId="stack" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="units" dataKey="customs" stackId="stack" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="units" dataKey="pending" stackId="stack" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="deliveryRate"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CIRCLES VIEW: Prominent Radial Progress & Circular Gauges               */}
      {/* ========================================================================= */}
      {viewMode === 'circles' && (
        <div className="space-y-6">
          {/* Top Hero Performance Gauge Block */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 p-6 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Column: Hero Circular Gauge */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <CircleProgressRing
                percentage={deliveryMetrics.overallPerformanceRate}
                size={148}
                strokeWidth={12}
                color="#10b981"
                bgColor="#1e293b"
              >
                <span className="text-3xl font-black tracking-tight text-white">
                  {deliveryMetrics.overallPerformanceRate}%
                </span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                  Delivered
                </span>
              </CircleProgressRing>

              <div className="text-center sm:text-left space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Target Benchmark: 85.0%</span>
                </div>
                <h4 className="text-xl font-bold text-white">
                  Total Delivery Performance Index
                </h4>
                <p className="text-xs text-slate-300 max-w-md">
                  {deliveryMetrics.overallPerformanceRate >= 85
                    ? 'Excellent delivery velocity! High volume of devices have completed physical transit and reached end facilities.'
                    : deliveryMetrics.overallPerformanceRate >= 65
                    ? 'Standard logistics throughput. Ongoing clearances and pipeline transports require active monitoring.'
                    : 'Dispatch bottleneck detected. Accelerate customs clearances and warehouse dispatch releases.'}
                </p>
                <div className="text-[11px] text-cyan-300 font-mono pt-1">
                  Active Analysis Window: {activeDateRange.label}
                </div>
              </div>
            </div>

            {/* Right Column: Hero Metrics Badges */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 min-w-[130px]">
                <div className="text-[10px] font-bold text-slate-300 uppercase">Completed Units</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5">
                  {formatNumber(deliveryMetrics.list.find((s) => s.name === 'Delivered & Dispatched')?.units || 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {deliveryMetrics.list.find((s) => s.name === 'Delivered & Dispatched')?.percentage}% of window
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 min-w-[130px]">
                <div className="text-[10px] font-bold text-slate-300 uppercase">In Pipeline</div>
                <div className="text-lg font-black text-amber-400 mt-0.5">
                  {formatNumber(
                    deliveryMetrics.totalUnits -
                      (deliveryMetrics.list.find((s) => s.name === 'Delivered & Dispatched')?.units || 0)
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Transit + Port + Pending
                </div>
              </div>
            </div>
          </div>

          {/* Circular Donut Breakdown & Top Hubs Mini-Circles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Donut Chart with Circular Legend */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <PieChartIcon className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Circular Logistics Share Breakdown</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Proportional Volume</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">
                  Visual delivery ratio across all pipeline milestones for the active filter set.
                </p>
              </div>

              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={(entry: any) => `${entry.percentage || Math.round((entry.percent || 0) * 100)}%`}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${formatNumber(Number(value))} Units`, 'Units']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-[11px] font-medium text-slate-700">{value}</span>
                      )}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Regional Hub Delivery Mini-Circles Comparison */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Top Branch Performance Circles</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Regional Hubs</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">
                  Quick circular delivery progress comparison across key EPSS branches.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {branchComparison.map((hub) => (
                  <div
                    key={hub.name}
                    onClick={() => setSelectedBranch(hub.name)}
                    className="bg-white p-3 rounded-xl border border-slate-200 hover:border-cyan-400 transition cursor-pointer flex flex-col items-center text-center shadow-2xs hover:shadow-xs group"
                    title={`Click to filter by ${hub.name}`}
                  >
                    <CircleProgressRing
                      percentage={hub.rate}
                      size={58}
                      strokeWidth={5}
                      color={hub.rate >= 80 ? '#10b981' : hub.rate >= 60 ? '#3b82f6' : '#f59e0b'}
                      bgColor="#e2e8f0"
                    >
                      <span className="text-[11px] font-black text-slate-800">
                        {hub.rate}%
                      </span>
                    </CircleProgressRing>
                    <span className="text-xs font-bold text-slate-800 mt-2 truncate w-full group-hover:text-cyan-700">
                      {hub.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatNumber(hub.totalUnits)} units
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[10px] text-slate-500 text-center">
                Select any branch circle above to focus the delivery dashboard on that specific hub.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. DETAILED TABLE VIEW (Tabular Breakdown)                                */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 font-bold uppercase text-[10px] tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Delivery Stage Status</th>
                <th className="py-3 px-4 text-right">Units</th>
                <th className="py-3 px-4 text-right">Line Items</th>
                <th className="py-3 px-4 text-right">Valuation (Millions ETB)</th>
                <th className="py-3 px-4 text-right">Share (%)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveryMetrics.list.map((stage) => {
                return (
                  <tr key={stage.name} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2.5">
                      {stage.meta.icon}
                      <span>{stage.name}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatNumber(stage.units)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatNumber(stage.lineItems)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ETB {((stage.valuation || 0) / 1_000_000).toFixed(2)}M
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-800">{stage.percentage}%</span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${stage.percentage}%`, backgroundColor: stage.meta.color }}
                            className="h-full rounded-full"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          onFilterStatus(stage.name === 'Delivered & Dispatched' ? 'functional' : 'all');
                          onNavigateTab('inventory');
                        }}
                        className="text-[10px] font-bold text-cyan-600 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Multiple Data Upload Modal - Admin Only */}
      {isAdmin && isUploadModalOpen && (
        <MultipleDataUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadBatches={handleBatchesUploaded}
          existingBatchCount={uploadedBatches.length}
        />
      )}
    </div>
  );
};
