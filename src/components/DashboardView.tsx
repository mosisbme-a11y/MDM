import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  Wrench,
  Clock,
  CheckCircle2,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
  ShieldAlert,
  Printer,
  Info,
  Calendar,
  FileDown,
  LayoutGrid,
  Columns,
  FileCheck,
  ArrowUpRight,
  Upload,
  BarChart3,
  Sparkles,
  Download,
  Camera,
  Loader2,
  Search,
  X,
  Building2,
  Coins,
  ShieldCheck,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  ShoppingBag
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  CartesianGrid,
  PieChart,
  Pie
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventorySummary, RegionDistribution, MedicalDeviceItem, AuditLogEntry, DeviceDocument, ConfirmedUploadBatch, MultipleStockRecord, ReceivingDataRecord, MaterialMasterRecord, MedicalDeviceAgreement, UploadedAgreementBatch, ProgramMdRecord } from '../types';
import { DEFAULT_MEDICAL_DEVICE_AGREEMENTS } from '../data/defaultAgreements';
import { InventoryCacheMeta } from '../utils/indexedDbCache';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { TotalDeliveryAgreementSection } from './TotalDeliveryAgreementSection';
import { InstallationTaskModal } from './InstallationTaskModal';
import { MultipleDataUploadModal, UploadedBatchInfo } from './MultipleDataUploadModal';
import { NonMovingModal } from './NonMovingModal';
import { SohModal } from './SohModal';
import { WarehouseReceivedModal } from './WarehouseReceivedModal';
import { ExpiryNotificationModal } from './ExpiryNotificationModal';
import { DashboardAnalyticsTab } from './DashboardAnalyticsTab';
import { getReceivingProgramType } from './ReceivingDataAnalyticsSection';
import { DashboardAlertsTab } from './DashboardAlertsTab';
import { DashboardAuditTab } from './DashboardAuditTab';
import { EpssMohWorkflowSection } from './EpssMohWorkflowSection';
import { Language, translations } from '../utils/localization';
import { SyncHealthIndicator } from './SyncHealthIndicator';
import { DashboardViewMultipleStockAnalytics, getRdfHpCategory } from './DashboardViewMultipleStockAnalytics';
import { DashboardFilteredSummaryCard } from './DashboardFilteredSummaryCard';
import { ExportChartsModal } from './ExportChartsModal';
import { exportElementAsPNG } from '../utils/chartExport';

interface DashboardViewProps {
  summary: InventorySummary;
  regionDistribution: RegionDistribution[];
  onNavigateTab: (tab: string) => void;
  onFilterStatus: (status: string) => void;
  onRefresh?: () => void;
  onPrintReport?: () => void;
  onOpenAddDevice?: () => void;
  isAdmin?: boolean;
  isSyncing?: boolean;
  cachedMeta?: InventoryCacheMeta | null;
  spreadsheetTitle?: string;
  selectedSheetTabs: string[];
  items?: MedicalDeviceItem[];
  multipleStockItems?: MultipleStockRecord[];
  onUploadMultipleStockData?: (records: MultipleStockRecord[], mode?: 'append' | 'replace') => void;
  receivingRecords?: ReceivingDataRecord[];
  materialMasterItems: MaterialMasterRecord[];
  onUploadReceivingData?: (records: ReceivingDataRecord[], mode?: 'append' | 'replace') => void;
  programMdRecords?: ProgramMdRecord[];
  isSidebarCollapsed?: boolean;
  language: Language;
  auditLogs?: AuditLogEntry[];
  onOpenThresholdConfig?: () => void;
  onUploadBatches?: (batches: UploadedBatchInfo[], confirmedBatch?: ConfirmedUploadBatch) => void;
  onAddDocument?: (doc: DeviceDocument) => void;
  documents?: DeviceDocument[];
  dashboardPlantFilter: string | string[];
  setDashboardPlantFilter: (val: string | string[]) => void;
  dashboardGroupFilter: string;
  setDashboardGroupFilter: (val: string) => void;
  dashboardStatusFilter: string;
  setDashboardStatusFilter: (val: string) => void;
  dashboardStartDate: string;
  setDashboardStartDate: (val: string) => void;
  dashboardEndDate: string;
  setDashboardEndDate: (val: string) => void;
  dashboardSearchQuery: string;
  setDashboardSearchQuery: (val: string) => void;
  dashboardWbsFilter: string;
  setDashboardWbsFilter: (val: string) => void;
  dashboardStreamFilter?: 'all' | 'RDF' | 'HP';
  setDashboardStreamFilter?: (val: 'all' | 'RDF' | 'HP') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  regionDistribution,
  onNavigateTab,
  onFilterStatus,
  onRefresh,
  onPrintReport,
  onOpenAddDevice,
  isAdmin = false,
  isSyncing,
  cachedMeta,
  items = [],
  multipleStockItems = [],
  onUploadMultipleStockData,
  receivingRecords = [],
  materialMasterItems,
  onUploadReceivingData,
  programMdRecords = [],
  isSidebarCollapsed,
  language,
  auditLogs = [],
  onOpenThresholdConfig,
  onUploadBatches,
  onAddDocument,
  documents = [],
  dashboardPlantFilter,
  setDashboardPlantFilter,
  dashboardGroupFilter,
  setDashboardGroupFilter,
  dashboardStatusFilter,
  setDashboardStatusFilter,
  dashboardStartDate,
  setDashboardStartDate,
  dashboardEndDate,
  setDashboardEndDate,
  dashboardSearchQuery,
  setDashboardSearchQuery,
  dashboardWbsFilter,
  setDashboardWbsFilter,
  dashboardStreamFilter,
  setDashboardStreamFilter
}) => {
  const dynamicTitle = 'EPSS@2026';
  const isMac = typeof window !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const [internalStreamFilter, setInternalStreamFilter] = useState<'all' | 'RDF' | 'HP'>('all');
  const activeStreamFilter = dashboardStreamFilter !== undefined ? dashboardStreamFilter : internalStreamFilter;
  const setActiveStreamFilter = (val: 'all' | 'RDF' | 'HP') => {
    setInternalStreamFilter(val);
    setDashboardStreamFilter?.(val);
  };
  const [activeLayoutTab, setActiveLayoutTab] = useState<'analytics' | 'alerts' | 'audit' | 'agreements'>('analytics');
  const [dashboardAnalyticsMode, setDashboardAnalyticsMode] = useState<'all' | 'multiple-stock' | 'master'>(() => {
    try {
      const saved = localStorage.getItem('epss_dashboard_analytics_mode');
      if (saved === 'all' || saved === 'multiple-stock' || saved === 'master') return saved;
    } catch {}
    return 'all';
  });

  const handleSelectDashboardMode = (mode: 'all' | 'multiple-stock' | 'master') => {
    setDashboardAnalyticsMode(mode);
    try {
      localStorage.setItem('epss_dashboard_analytics_mode', mode);
    } catch {}
  };
  const [isVerticalLayout, setIsVerticalLayout] = useState<boolean>(true);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [isExportChartsModalOpen, setIsExportChartsModalOpen] = useState(false);
  const [isQuickExportingCharts, setIsQuickExportingCharts] = useState(false);

  const selectedPlantList = useMemo(() => {
    if (!dashboardPlantFilter || dashboardPlantFilter === 'all') return [];
    if (Array.isArray(dashboardPlantFilter)) return dashboardPlantFilter;
    if (typeof dashboardPlantFilter === 'string') {
      return dashboardPlantFilter.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [dashboardPlantFilter]);

  const matchesPlantFilter = (plantCode?: string, plantName?: string) => {
    if (selectedPlantList.length === 0 || selectedPlantList.includes('all')) return true;
    return selectedPlantList.some(p =>
      (plantCode && p.toLowerCase() === plantCode.toLowerCase()) ||
      (plantName && p.toLowerCase() === plantName.toLowerCase())
    );
  };

  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plantDropdownRef.current && !plantDropdownRef.current.contains(e.target as Node)) {
        setIsPlantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Receiving Records actively synchronized with unified Dashboard Filters (Plant, Stream, Dates, Search, WBS)
  const filteredReceivingRecords = useMemo(() => {
    let f = receivingRecords;
    if (selectedPlantList.length > 0 && !selectedPlantList.includes('all')) {
      f = f.filter(r => matchesPlantFilter(r.plant, r.plant));
    }
    if (activeStreamFilter !== 'all') {
      f = f.filter(r => getReceivingProgramType(r) === activeStreamFilter);
    }
    if (dashboardStartDate) {
      f = f.filter(r => {
        const d = r.postingDate || r.entryDate || r.documentDate;
        return d && d >= dashboardStartDate;
      });
    }
    if (dashboardEndDate) {
      f = f.filter(r => {
        const d = r.postingDate || r.entryDate || r.documentDate;
        return d && d <= dashboardEndDate;
      });
    }
    if (dashboardSearchQuery.trim()) {
      const q = dashboardSearchQuery.trim().toLowerCase();
      f = f.filter(r =>
        r.material?.toLowerCase().includes(q) ||
        r.materialDescription?.toLowerCase().includes(q) ||
        r.purchaseOrder?.toLowerCase().includes(q) ||
        r.plant?.toLowerCase().includes(q) ||
        r.batch?.toLowerCase().includes(q) ||
        r.wbsElement?.toLowerCase().includes(q) ||
        r.supplier?.toLowerCase().includes(q)
      );
    }
    if (dashboardWbsFilter !== 'all') {
      f = f.filter(r => r.wbsElement === dashboardWbsFilter);
    }
    return f;
  }, [receivingRecords, selectedPlantList, activeStreamFilter, dashboardStartDate, dashboardEndDate, dashboardSearchQuery, dashboardWbsFilter]);

  // Receiving data aggregated stats for chart reporting
  const receivingStatsForExport = useMemo(() => {
    let totalVal = 0;
    let totalUnits = 0;
    let rdfVal = 0;
    let rdfUnits = 0;
    let hpVal = 0;
    let hpUnits = 0;

    (filteredReceivingRecords || []).forEach((rec) => {
      const val = Number(rec.amtInLocCur) || 0;
      const qty = Number(rec.quantity) || 0;
      const isHp = getReceivingProgramType(rec) === 'HP';

      totalVal += val;
      totalUnits += qty;
      if (isHp) {
        hpVal += val;
        hpUnits += qty;
      } else {
        rdfVal += val;
        rdfUnits += qty;
      }
    });

    return {
      totalVal,
      totalUnits,
      rdfVal,
      rdfUnits,
      hpVal,
      hpUnits,
      consignments: filteredReceivingRecords?.length || 0
    };
  }, [filteredReceivingRecords]);

  // Quick 1-click Export Charts handler
  const handleQuickExportCharts = async () => {
    setIsQuickExportingCharts(true);
    try {
      let target = document.getElementById('receiving-bar-and-pie-charts-container');
      if (!target) {
        target =
          document.getElementById('multiple-stock-charts-container') ||
          document.getElementById('dashboard-analytics-charts-grid') ||
          (document.querySelector('.recharts-responsive-container')?.parentElement?.parentElement as HTMLElement);
      }

      if (!target) {
        setIsExportChartsModalOpen(true);
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      await exportElementAsPNG({
        element: target,
        filename: `EPSS_Dashboard_Charts_Report_${dateStr}.png`,
        reportTitle: 'EPSS@2026 - Medical Inventory & Receiving Visualizations',
        reportSubtitle: 'Bar Graph & Pie Chart Operational Intelligence (RDF vs Health Program)',
        metadata: [
          { label: 'Plant Hub', value: dashboardPlantFilter === 'all' || (Array.isArray(dashboardPlantFilter) && dashboardPlantFilter.length === 0) ? 'All EPSS Hubs' : (Array.isArray(dashboardPlantFilter) ? dashboardPlantFilter.join(', ') : dashboardPlantFilter) },
          { label: 'Material Group', value: dashboardGroupFilter === 'all' ? 'All Groups' : dashboardGroupFilter },
          { label: 'Time Horizon', value: dashboardStartDate || 'All Records' }
        ],
        summaryMetrics: [
          { label: 'Total Receiving', value: formatCurrency(receivingStatsForExport.totalVal, true), color: '#38bdf8' },
          { label: 'Physical Units', value: `${formatNumber(receivingStatsForExport.totalUnits)} u`, color: '#34d399' }
        ],
        scale: 2,
        includeHeader: true
      });
    } catch (e) {
      console.error('Quick charts export failed:', e);
      setIsExportChartsModalOpen(true);
    } finally {
      setIsQuickExportingCharts(false);
    }
  };

  const filteredItems = useMemo(() => {
    let f = items;
    if (selectedPlantList.length > 0 && !selectedPlantList.includes('all')) {
      f = f.filter(i => matchesPlantFilter(i.plant, i.plantName));
    }
    if (dashboardGroupFilter !== 'all') {
      f = f.filter(i => i.materialGroupName === dashboardGroupFilter);
    }
    if (dashboardStatusFilter !== 'all') {
      if (dashboardStatusFilter === 'Functional') {
        f = f.filter(i => !i.isNotFunctional && !i.needsSparePart);
      } else if (dashboardStatusFilter === 'Defective') {
        f = f.filter(i => i.isNotFunctional);
      } else if (dashboardStatusFilter === 'Needs Spare Part') {
        f = f.filter(i => i.needsSparePart);
      } else if (dashboardStatusFilter === 'Non-Moving') {
        f = f.filter(i => i.isNonMoving || i.sohStatus === 'Non-Moving Stock');
      } else {
        f = f.filter(i =>
          i.stockType === dashboardStatusFilter ||
          i.installationStatus === dashboardStatusFilter ||
          i.deliveryStatus === dashboardStatusFilter
        );
      }
    }
    if (dashboardStartDate) {
      f = f.filter(i => {
        const d = i.receivingDate || i.docDate || i.deliveryDate;
        return d && d >= dashboardStartDate;
      });
    }
    if (dashboardEndDate) {
      f = f.filter(i => {
        const d = i.receivingDate || i.docDate || i.deliveryDate;
        return d && d <= dashboardEndDate;
      });
    }
    if (dashboardSearchQuery.trim()) {
      const q = dashboardSearchQuery.trim().toLowerCase();
      f = f.filter(i =>
        i.materialDescription?.toLowerCase().includes(q) ||
        i.material?.toLowerCase().includes(q) ||
        i.plantName?.toLowerCase().includes(q) ||
        i.plant?.toLowerCase().includes(q) ||
        i.batch?.toLowerCase().includes(q) ||
        i.wbsElement?.toLowerCase().includes(q)
      );
    }
    if (dashboardWbsFilter !== 'all') {
      f = f.filter(i => i.wbsElement === dashboardWbsFilter);
    }
    if (activeStreamFilter !== 'all') {
      if (activeStreamFilter === 'RDF') {
        f = f.filter(i => (i.specialStockType || (i as any).specialStock || '').trim().toUpperCase() !== 'Q' && !i.wbsElement);
      } else if (activeStreamFilter === 'HP') {
        f = f.filter(i => (i.specialStockType || (i as any).specialStock || '').trim().toUpperCase() === 'Q' || Boolean(i.wbsElement));
      }
    }
    return f;
  }, [items, selectedPlantList, dashboardGroupFilter, dashboardStatusFilter, dashboardStartDate, dashboardEndDate, dashboardSearchQuery, dashboardWbsFilter, activeStreamFilter]);

  const filteredMultipleStockItems = useMemo(() => {
    let f = multipleStockItems;
    if (selectedPlantList.length > 0 && !selectedPlantList.includes('all')) {
      f = f.filter(i => matchesPlantFilter(i.plant, i.plant));
    }
    if (dashboardGroupFilter !== 'all') {
      f = f.filter(i => i.materialGroupName === dashboardGroupFilter);
    }
    if (activeStreamFilter !== 'all') {
      f = f.filter(i => getRdfHpCategory(i) === activeStreamFilter);
    }
    if (dashboardSearchQuery.trim()) {
      const q = dashboardSearchQuery.trim().toLowerCase();
      f = f.filter(i =>
        i.materialDescription?.toLowerCase().includes(q) ||
        i.material?.toLowerCase().includes(q) ||
        i.plant?.toLowerCase().includes(q) ||
        i.storageLocation?.toLowerCase().includes(q) ||
        i.wbsElement?.toLowerCase().includes(q)
      );
    }
    if (dashboardWbsFilter !== 'all') {
      f = f.filter(i => i.wbsElement === dashboardWbsFilter);
    }
    return f;
  }, [multipleStockItems, selectedPlantList, dashboardGroupFilter, activeStreamFilter, dashboardSearchQuery, dashboardWbsFilter]);

  const availableDashboardPlants = useMemo(() => {
    const map = new Map<string, string>();
    if (summary.plants && summary.plants.length > 0) {
      summary.plants.forEach((p: any) => {
        const code = p.plant || p.code || '';
        const name = p.name || p.plantName || p.plant || p.code || '';
        if (code) map.set(code, name);
      });
    }
    items.forEach(i => {
      if (i.plant && !map.has(i.plant)) {
        map.set(i.plant, i.plantName || i.plant);
      }
    });
    multipleStockItems.forEach(i => {
      if (i.plant && !map.has(i.plant)) {
        map.set(i.plant, i.plant);
      }
    });
    receivingRecords.forEach(r => {
      if (r.plant && !map.has(r.plant)) {
        map.set(r.plant, r.plant);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [summary.plants, items, multipleStockItems, receivingRecords]);

  const availableDashboardGroups = useMemo(() => {
    const groups = new Set<string>();
    if (summary.categories) {
      Object.keys(summary.categories).forEach(c => groups.add(c));
    }
    items.forEach(i => {
      if (i.materialGroupName) groups.add(i.materialGroupName);
    });
    multipleStockItems.forEach(i => {
      if (i.materialGroupName) groups.add(i.materialGroupName);
    });
    return Array.from(groups).filter(Boolean).sort();
  }, [summary.categories, items, multipleStockItems]);

  const availableWbsElements = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.wbsElement) set.add(i.wbsElement); });
    multipleStockItems.forEach(i => { if (i.wbsElement) set.add(i.wbsElement); });
    receivingRecords.forEach(r => { if (r.wbsElement) set.add(r.wbsElement); });
    return Array.from(set).filter(Boolean).sort();
  }, [items, multipleStockItems, receivingRecords]);

  const hasActiveFilters = useMemo(() => {
    return (
      dashboardPlantFilter !== 'all' ||
      dashboardGroupFilter !== 'all' ||
      activeStreamFilter !== 'all' ||
      dashboardStatusFilter !== 'all' ||
      (dashboardWbsFilter && dashboardWbsFilter !== 'all') ||
      Boolean(dashboardStartDate) ||
      Boolean(dashboardEndDate) ||
      Boolean(dashboardSearchQuery.trim())
    );
  }, [
    dashboardPlantFilter,
    dashboardGroupFilter,
    activeStreamFilter,
    dashboardStatusFilter,
    dashboardWbsFilter,
    dashboardStartDate,
    dashboardEndDate,
    dashboardSearchQuery
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dashboardPlantFilter !== 'all') count++;
    if (dashboardGroupFilter !== 'all') count++;
    if (activeStreamFilter !== 'all') count++;
    if (dashboardStatusFilter !== 'all') count++;
    if (dashboardWbsFilter && dashboardWbsFilter !== 'all') count++;
    if (dashboardStartDate || dashboardEndDate) count++;
    if (dashboardSearchQuery.trim()) count++;
    return count;
  }, [
    dashboardPlantFilter,
    dashboardGroupFilter,
    activeStreamFilter,
    dashboardStatusFilter,
    dashboardWbsFilter,
    dashboardStartDate,
    dashboardEndDate,
    dashboardSearchQuery
  ]);

  const handleSetDatePreset = (preset: 'all' | '7d' | '30d' | '90d' | 'ytd') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'all') {
      setDashboardStartDate('');
      setDashboardEndDate('');
      return;
    }
    setDashboardEndDate(todayStr);
    const d = new Date(today);
    if (preset === '7d') {
      d.setDate(d.getDate() - 7);
    } else if (preset === '30d') {
      d.setDate(d.getDate() - 30);
    } else if (preset === '90d') {
      d.setDate(d.getDate() - 90);
    } else if (preset === 'ytd') {
      d.setMonth(0, 1);
    }
    setDashboardStartDate(d.toISOString().split('T')[0]);
  };

  const handleResetDashboardFilters = () => {
    setDashboardPlantFilter('all');
    setDashboardGroupFilter('all');
    setActiveStreamFilter('all');
    setDashboardStatusFilter('all');
    setDashboardStartDate('');
    setDashboardEndDate('');
    setDashboardSearchQuery('');
    setDashboardWbsFilter('all');
  };

  const totalQuantity = useMemo(() => summary.totalQuantity || items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0), [summary.totalQuantity, items]);
  const totalValuation = useMemo(() => summary.totalValuationETB || items.reduce((acc, i) => acc + (Number(i.qty || 0) * (Number(i.unitPrice) || 0)), 0), [summary.totalValuationETB, items]);

  // Low Stock Alerts & Procurement State
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [procurementSearch, setProcurementSearch] = useState<string>('');
  const [selectedProcurementItem, setSelectedProcurementItem] = useState<MedicalDeviceItem | 'BULK' | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(20);
  const [procurementEmailRecipient, setProcurementEmailRecipient] = useState<string>('procurement@epss.gov.et');
  const [procurementPriority, setProcurementPriority] = useState<'CRITICAL' | 'HIGH' | 'NORMAL'>('CRITICAL');
  const [procurementNote, setProcurementNote] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [isWarehouseReceivedModalOpen, setIsWarehouseReceivedModalOpen] = useState<boolean>(false);
  const [isSohModalOpen, setIsSohModalOpen] = useState<boolean>(false);
  const [isMultipleUploadModalOpen, setIsMultipleUploadModalOpen] = useState<boolean>(false);
  const [isInstallationModalOpen, setIsInstallationModalOpen] = useState<boolean>(false);
  const [selectedInstallationStatus, setSelectedInstallationStatus] = useState<string>('all');
  const [warehouseReceivedSearch, setWarehouseReceivedSearch] = useState<string>('');
  const [warehouseReceivedPoFilter, setWarehouseReceivedPoFilter] = useState<string>('all');
  const [warehouseReceivedPackageFilter, setWarehouseReceivedPackageFilter] = useState<string>('all');
  const [warehouseReceivedRdfFilter, setWarehouseReceivedRdfFilter] = useState<string>('all');
  const [warehouseReceivedProgramFilter, setWarehouseReceivedProgramFilter] = useState<string>('all');
  const [warehouseReceivedPlantFilter, setWarehouseReceivedPlantFilter] = useState<string>('all');
  const [warehouseReceivedSupplierFilter, setWarehouseReceivedSupplierFilter] = useState<string>('all');
  const [warehouseReceivedMovementFilter, setWarehouseReceivedMovementFilter] = useState<string>('all');
  const [warehouseReceivedDatePreset, setWarehouseReceivedDatePreset] = useState<string>('all');
  const [warehouseReceivedStartDate, setWarehouseReceivedStartDate] = useState<string>('');
  const [warehouseReceivedEndDate, setWarehouseReceivedEndDate] = useState<string>('');
  const [showBarChartDetail, setShowBarChartDetail] = useState<boolean>(true);
  const [agreementChartType, setAgreementChartType] = useState<'stacked' | 'grouped' | 'linesOnly' | 'valueOnly'>('stacked');

  const [sohSearch, setSohSearch] = useState<string>('');
  const [sohBranchFilter, setSohBranchFilter] = useState<string>('all');
  const [sohRdfFilter, setSohRdfFilter] = useState<string>('all');
  const [sohProgramFilter, setSohProgramFilter] = useState<string>('all');

  // Non-Moving Items Filter & Analysis State
  const [isNonMovingModalOpen, setIsNonMovingModalOpen] = useState<boolean>(false);
  const [multiUploadInitialMode, setMultiUploadInitialMode] = useState<'all' | 'nonMoving'>('all');
  const [nonMovingSearch, setNonMovingSearch] = useState<string>('');
  const [nonMovingBranchFilter, setNonMovingBranchFilter] = useState<string>('all');
  const [nonMovingRdfFilter, setNonMovingRdfFilter] = useState<string>('all');
  const [nonMovingProgramFilter, setNonMovingProgramFilter] = useState<string>('all');

  // Derive Low Stock Items
  const lowStockItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const filtered = items.filter((item) => item.qty <= lowStockThreshold);
    if (filtered.length < 3) {
      const sorted = [...items].sort((a, b) => a.qty - b.qty);
      return sorted.slice(0, 8);
    }
    return filtered.sort((a, b) => a.qty - b.qty);
  }, [items, lowStockThreshold]);

  // Load agreements from localStorage or fallback to defaults
  const [agreements] = useState<MedicalDeviceAgreement[]>(() => {
    try {
      localStorage.removeItem('epss_medical_device_agreements');
    } catch {
      // fallback
    }
    return [];
  });

  // Uploaded Multi-Data Batches State (saved in localStorage)
  const [uploadedBatches] = useState<UploadedAgreementBatch[]>(() => {
    try {
      localStorage.removeItem('epss_medical_device_uploaded_batches');
    } catch {
      // fallback
    }
    return [];
  });

  // Aggregate active agreements plus uploaded batches
  const allActiveAgreements = useMemo(() => {
    const batchAccords = uploadedBatches.flatMap((b) => b.agreements);
    return [...agreements, ...batchAccords];
  }, [agreements, uploadedBatches]);

  // Dynamically reconcile live inventory with agreements (matching logic from TotalDeliveryAgreementSection)
  const liveAgreements = useMemo(() => {
    return allActiveAgreements.map((agr) => {
      const keywords = (agr.linkedKeywords || []).map((k) => k.toLowerCase());
      const supplierNorm = (agr.supplier || '').toLowerCase();

      const matchingItems = items.filter((item) => {
        const desc = (item.materialDescription || '').toLowerCase();
        const mfg = (item.manufacturer || '').toLowerCase();
        const issue = (item.contractIssue || '').toLowerCase();
        if (supplierNorm && mfg.includes(supplierNorm.split(' ')[0])) return true;
        if (issue.includes(agr.agreementNumber.toLowerCase())) return true;
        return keywords.some((kw) => desc.includes(kw) || mfg.includes(kw));
      });

      const liveDeliveredFromItems = matchingItems
        .filter((it) => it.deliveryStatus === 'Delivered & Dispatched' || (!it.deliveryStatus && !it.isNotFunctional))
        .reduce((sum, it) => sum + (it.qty || 0), 0);

      const effectiveDelivered = Math.max(agr.deliveredUnits, liveDeliveredFromItems);
      const effectiveDeliveredVal = agr.totalAgreedUnits > 0
        ? Math.round((effectiveDelivered / agr.totalAgreedUnits) * agr.totalContractValueETB)
        : agr.deliveredValueETB;

      return {
        ...agr,
        deliveredUnits: effectiveDelivered,
        deliveredValueETB: effectiveDeliveredVal
      };
    });
  }, [allActiveAgreements, items]);

  // Effective Program MD records (either passed as props or read from localStorage)
  const effectiveProgramMdRecords = useMemo(() => {
    if (programMdRecords && programMdRecords.length > 0) {
      return programMdRecords;
    }
    try {
      const saved = localStorage.getItem('epss_program_md_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }, [programMdRecords]);

  // Annual Delivery Volume and Value for MD Agreements - strictly derived ONLY from what user uploaded for MD Agreement
  const annualDeliveryMetrics = useMemo(() => {
    const annualData: Record<string, {
      deliveredValue: number;
      totalValue: number;
      deliveredLines: number;
      totalLines: number;
      pendingLines: number;
      deviceOwners: Set<string>;
    }> = {};

    const sourcePmd = effectiveProgramMdRecords && effectiveProgramMdRecords.length > 0
      ? effectiveProgramMdRecords
      : (programMdRecords && programMdRecords.length > 0 ? programMdRecords : []);

    // 1. STRICTLY use user-uploaded Program MD 10-column records (The "MD Agreement Update" data)
    if (sourcePmd.length > 0) {
      sourcePmd.forEach((rec) => {
        let year = '2026';
        if (rec.requestYear) {
          const match = String(rec.requestYear).match(/\b(20\d\d|19\d\d)\b/);
          year = match ? match[1] : String(rec.requestYear).trim();
        }
        if (!annualData[year]) {
          annualData[year] = {
            deliveredValue: 0,
            totalValue: 0,
            deliveredLines: 0,
            totalLines: 0,
            pendingLines: 0,
            deviceOwners: new Set()
          };
        }
        const val = Number(rec.deliveryAmountEtb) || 0;
        annualData[year].totalLines += 1;
        annualData[year].totalValue += val;

        const status = (rec.currentStatus || '').toLowerCase();
        const isDelivered = status
          ? (/deliver|receiv|complet|dispatch|closed|done|arrived/i.test(status) ||
             (!/pend|transit|wait|process|order|open|cancel/i.test(status) && val > 0))
          : true;

        if (isDelivered) {
          annualData[year].deliveredLines += 1;
          annualData[year].deliveredValue += val;
        } else {
          annualData[year].pendingLines += 1;
        }

        if (rec.deviceOwner && rec.deviceOwner.trim()) {
          annualData[year].deviceOwners.add(rec.deviceOwner.trim());
        }
        if (rec.supplier && rec.supplier.trim()) {
          annualData[year].deviceOwners.add(rec.supplier.trim());
        }
      });
    } 
    // 2. OR user-uploaded MD Agreement batches
    else if (uploadedBatches && uploadedBatches.length > 0) {
      uploadedBatches.forEach((batch) => {
        (batch.agreements || []).forEach((agr) => {
          const dateStr = agr.contractSignDate || agr.committedDeliveryDate || '';
          let year = '2026';
          if (dateStr) {
            const match = dateStr.match(/\b(20\d\d|19\d\d)\b/);
            if (match) year = match[1];
          }
          if (!annualData[year]) {
            annualData[year] = {
              deliveredValue: 0,
              totalValue: 0,
              deliveredLines: 0,
              totalLines: 0,
              pendingLines: 0,
              deviceOwners: new Set()
            };
          }
          const totalU = Number(agr.totalAgreedUnits) || 1;
          const delivU = Number(agr.deliveredUnits) || 0;
          const totalV = Number(agr.totalContractValueETB) || 0;
          const delivV = Number(agr.deliveredValueETB) || 0;

          annualData[year].totalLines += totalU;
          annualData[year].deliveredLines += delivU;
          annualData[year].pendingLines += Math.max(0, totalU - delivU);
          annualData[year].totalValue += totalV;
          annualData[year].deliveredValue += delivV;

          if (agr.supplier) annualData[year].deviceOwners.add(agr.supplier);
        });
      });
    }
    // STRICT: Do NOT fall back to receiving records, inventory items, or default mock records!

    return Object.entries(annualData)
      .map(([year, data]) => {
        const totalLines = data.totalLines;
        const deliveredLines = data.deliveredLines;
        const pendingLines = Math.max(0, totalLines - deliveredLines);
        const deliveryRate = totalLines > 0 ? Math.round((deliveredLines / totalLines) * 100) : 0;
        const valueDeliveryRate = data.totalValue > 0 ? Math.round((data.deliveredValue / data.totalValue) * 100) : 0;

        return {
          year,
          deliveredValue: data.deliveredValue,
          totalValue: data.totalValue,
          deliveredLines,
          totalLines,
          pendingLines,
          deliveryRate,
          valueDeliveryRate,
          items: deliveredLines,
          deviceOwnerCount: data.deviceOwners.size,
          deviceOwnersList: Array.from(data.deviceOwners).join(', ')
        };
      })
      .sort((a, b) => Number(a.year) - Number(b.year));
  }, [effectiveProgramMdRecords, programMdRecords, uploadedBatches]);

  // Handler to navigate directly to exact uploaded source data for MD agreement
  const handleNavigateToAgreementSource = (year?: string | number) => {
    const yearVal = (year !== undefined && year !== null && String(year).trim() !== '' && String(year) !== 'undefined') ? String(year).trim() : 'all';
    localStorage.setItem('epss_agreement_filter_year', yearVal);
    localStorage.setItem('epss_agreement_filter_view', 'uploaded-10col');
    window.dispatchEvent(new CustomEvent('epss:navigate_agreement_source', { detail: { year: yearVal } }));
    onNavigateTab('agreements');
  };

  const agreementKpiMetrics = useMemo(() => {
    let totalLinesCount = 0;
    let totalDeliveredLinesCount = 0;
    let totalDeliveredVal = 0;
    let totalCommittedBudget = 0;
    const suppliersSet = new Set<string>();

    annualDeliveryMetrics.forEach((m) => {
      totalLinesCount += m.totalLines;
      totalDeliveredLinesCount += m.deliveredLines;
      totalDeliveredVal += m.deliveredValue;
      totalCommittedBudget += m.totalValue;
      if (m.deviceOwnersList) {
        m.deviceOwnersList.split(', ').forEach(s => s && suppliersSet.add(s));
      }
    });

    const overallRate = totalLinesCount > 0 ? Math.round((totalDeliveredLinesCount / totalLinesCount) * 100) : 0;

    return {
      totalRequests: totalLinesCount,
      totalDeliveredLines: totalDeliveredLinesCount,
      totalDeliveredValue: totalDeliveredVal,
      totalCommittedBudget: totalCommittedBudget || totalDeliveredVal,
      overallRate,
      avgDeliveryTime: totalLinesCount > 0 ? '45 Days' : '0 Days',
      supplierCount: suppliersSet.size
    };
  }, [annualDeliveryMetrics]);

  const formatYAxisValue = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const filteredLowStockItems = useMemo(() => {
    if (!procurementSearch.trim()) return lowStockItems;
    const q = procurementSearch.toLowerCase();
    return lowStockItems.filter(
      (i) =>
        i.materialDescription.toLowerCase().includes(q) ||
        i.material.toLowerCase().includes(q) ||
        i.plantName.toLowerCase().includes(q) ||
        i.plant.toLowerCase().includes(q)
    );
  }, [lowStockItems, procurementSearch]);

  // Expiry Notification System State (90-Day Horizon)
  const [expiryFilterDays, setExpiryFilterDays] = useState<number>(90);
  const [expirySearch, setExpirySearch] = useState<string>('');
  const [expiryUrgencyFilter, setExpiryUrgencyFilter] = useState<string>('all');
  const [selectedExpiryItem, setSelectedExpiryItem] = useState<MedicalDeviceItem | 'BULK_EXPIRY' | null>(null);
  const [expiryEmailRecipient, setExpiryEmailRecipient] = useState<string>('quality.assurance@epss.gov.et');
  const [expiryActionNote, setExpiryActionNote] = useState<string>('');
  const [expiryCopiedSuccess, setExpiryCopiedSuccess] = useState<boolean>(false);

  const parseExpiryDays = (expiryStr?: string) => {
    if (!expiryStr || expiryStr.trim() === '' || expiryStr === 'Permanent Asset' || expiryStr === 'N/A') {
      return null;
    }
    const d = new Date(expiryStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const expiringItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const list: Array<MedicalDeviceItem & { daysRemaining: number; expiryUrgency: 'expired' | 'critical' | 'warning' | 'notice'; formattedExpiry: string }> = [];

    items.forEach((item) => {
      const days = parseExpiryDays(item.expiryDate);
      if (days !== null && days <= expiryFilterDays) {
        let expiryUrgency: 'expired' | 'critical' | 'warning' | 'notice' = 'notice';
        if (days < 0) expiryUrgency = 'expired';
        else if (days <= 30) expiryUrgency = 'critical';
        else if (days <= 60) expiryUrgency = 'warning';
        else expiryUrgency = 'notice';

        const parsedD = new Date(item.expiryDate);
        const formattedExpiry = !isNaN(parsedD.getTime())
          ? parsedD.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
          : item.expiryDate;

        list.push({
          ...item,
          daysRemaining: days,
          expiryUrgency,
          formattedExpiry
        });
      }
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [items, expiryFilterDays]);

  const filteredExpiringItems = useMemo(() => {
    return expiringItems.filter((item) => {
      if (expiryUrgencyFilter !== 'all' && item.expiryUrgency !== expiryUrgencyFilter) return false;
      if (!expirySearch.trim()) return true;
      const q = expirySearch.toLowerCase();
      return (
        item.materialDescription.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.batch.toLowerCase().includes(q) ||
        item.plantName.toLowerCase().includes(q) ||
        item.plant.toLowerCase().includes(q)
      );
    });
  }, [expiringItems, expirySearch, expiryUrgencyFilter]);

  const expiryCounts = useMemo(() => {
    let expired = 0;
    let critical = 0;
    let warning = 0;
    let notice = 0;
    expiringItems.forEach(i => {
      if (i.expiryUrgency === 'expired') expired++;
      else if (i.expiryUrgency === 'critical') critical++;
      else if (i.expiryUrgency === 'warning') warning++;
      else if (i.expiryUrgency === 'notice') notice++;
    });
    return { expired, critical, warning, notice, total: expiringItems.length };
  }, [expiringItems]);

  const topManufacturers = (summary.topManufacturers || [])
    .map((m: any) => {
      const name = m.manufacturer || m.name || 'Unspecified';
      return {
        manufacturer: name,
        fullName: name,
        totalAmount: Number(m.totalAmount ?? m.value ?? 0),
        totalQty: Number(m.totalQty ?? m.qty ?? 0)
      };
    })
    .slice(0, 6);

  const functionalCount = summary.statusSummary?.functional ?? (summary.statusSummary as any)?.functionalQty ?? 0;
  const defectiveCount = summary.statusSummary?.defective ?? (summary.statusSummary as any)?.notFunctionalQty ?? 0;
  const functionalLines = summary.statusSummary?.functionalLineItems ?? 0;
  const defectiveLines = summary.statusSummary?.defectiveLineItems ?? 0;

  const [trendMetricMode, setTrendMetricMode] = useState<'all' | 'units' | 'lineItems'>('all');

  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const variance = (i - 3);
    const funcVal = Math.max(0, functionalCount + variance * 24);
    const defVal = Math.max(0, defectiveCount + (i % 2 === 0 ? -3 : 5));
    const funcLinesVal = Math.max(0, functionalLines + variance * 6);
    const defLinesVal = Math.max(0, defectiveLines + (i % 2 === 0 ? -1 : 2));

    return {
      date: dateStr,
      'Functional Units': Math.round(funcVal),
      'Defective Units': Math.round(defVal),
      'Functional Line Items': Math.round(funcLinesVal),
      'Defective Line Items': Math.round(defLinesVal)
    };
  });

  const parseReceivingDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // 1. Filter for Receiving Data (SAP MM Goods Receipt 22 Columns)
  const warehouseReceivedFilteredRecords = useMemo(() => {
    if (!receivingRecords || receivingRecords.length === 0) return [];
    return receivingRecords.filter((rec) => {
      if (warehouseReceivedDatePreset !== 'all') {
        const d = parseReceivingDate(rec.entryDate || rec.documentDate);
        if (!d) return false;

        const now = new Date();
        let maxRecordDate = new Date(0);
        receivingRecords.forEach(r => {
          const rd = parseReceivingDate(r.entryDate || r.documentDate);
          if (rd && rd > maxRecordDate) maxRecordDate = rd;
        });

        const diffDays = Math.abs((now.getTime() - maxRecordDate.getTime()) / (1000 * 60 * 60 * 24));
        const refDate = (maxRecordDate.getTime() > 0 && diffDays > 90) ? maxRecordDate : now;

        if (warehouseReceivedDatePreset === '7d') {
          const d7 = new Date(refDate); d7.setDate(refDate.getDate() - 7);
          if (d < d7) return false;
        } else if (warehouseReceivedDatePreset === '30d') {
          const d30 = new Date(refDate); d30.setDate(refDate.getDate() - 30);
          if (d < d30) return false;
        } else if (warehouseReceivedDatePreset === '90d') {
          const d90 = new Date(refDate); d90.setDate(refDate.getDate() - 90);
          if (d < d90) return false;
        } else if (warehouseReceivedDatePreset === 'custom') {
          if (warehouseReceivedStartDate) {
            const start = new Date(warehouseReceivedStartDate);
            if (d < start) return false;
          }
          if (warehouseReceivedEndDate) {
            const end = new Date(warehouseReceivedEndDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
        }
      }

      if (warehouseReceivedPoFilter !== 'all' && rec.purchaseOrder !== warehouseReceivedPoFilter) return false;
      if (warehouseReceivedPlantFilter !== 'all' && rec.plant !== warehouseReceivedPlantFilter) return false;
      if (warehouseReceivedSupplierFilter !== 'all' && rec.supplier !== warehouseReceivedSupplierFilter) return false;
      if (warehouseReceivedMovementFilter !== 'all' && rec.movementType !== warehouseReceivedMovementFilter) return false;

      if (!warehouseReceivedSearch.trim()) return true;
      const q = warehouseReceivedSearch.toLowerCase();
      return (
        (rec.materialDescription && rec.materialDescription.toLowerCase().includes(q)) ||
        (rec.material && rec.material.toLowerCase().includes(q)) ||
        (rec.purchaseOrder && rec.purchaseOrder.toLowerCase().includes(q)) ||
        (rec.supplier && rec.supplier.toLowerCase().includes(q)) ||
        (rec.plant && rec.plant.toLowerCase().includes(q)) ||
        (rec.storageLocation && rec.storageLocation.toLowerCase().includes(q)) ||
        (rec.wbsElement && rec.wbsElement.toLowerCase().includes(q)) ||
        (rec.userName && rec.userName.toLowerCase().includes(q))
      );
    });
  }, [
    receivingRecords,
    warehouseReceivedSearch,
    warehouseReceivedPoFilter,
    warehouseReceivedPlantFilter,
    warehouseReceivedSupplierFilter,
    warehouseReceivedMovementFilter,
    warehouseReceivedDatePreset,
    warehouseReceivedStartDate,
    warehouseReceivedEndDate
  ]);

  // 2. Filter for legacy Delivered Dispatched Items (Fallback)
  const warehouseReceivedFilteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.deliveryStatus !== 'Delivered & Dispatched') return false;

      if (warehouseReceivedDatePreset !== 'all') {
        if (!item.receivingDate && !item.docDate) return false;
        const itemDateStr = item.receivingDate || item.docDate;
        const itemDate = new Date(itemDateStr || '');
        if (isNaN(itemDate.getTime())) return false;

        const now = new Date();
        if (warehouseReceivedDatePreset === '7d') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (itemDate < sevenDaysAgo) return false;
        } else if (warehouseReceivedDatePreset === '30d') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (itemDate < thirtyDaysAgo) return false;
        } else if (warehouseReceivedDatePreset === '90d') {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(now.getDate() - 90);
          if (itemDate < ninetyDaysAgo) return false;
        } else if (warehouseReceivedDatePreset === 'custom') {
          if (warehouseReceivedStartDate) {
            const start = new Date(warehouseReceivedStartDate);
            if (itemDate < start) return false;
          }
          if (warehouseReceivedEndDate) {
            const end = new Date(warehouseReceivedEndDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
          }
        }
      }

      if (warehouseReceivedPoFilter !== 'all' && item.poNumber !== warehouseReceivedPoFilter) return false;
      if (warehouseReceivedPackageFilter !== 'all' && item.procurementPackage !== warehouseReceivedPackageFilter) return false;
      if (warehouseReceivedRdfFilter !== 'all' && item.rdfNumber !== warehouseReceivedRdfFilter) return false;
      if (warehouseReceivedProgramFilter !== 'all' && item.programName !== warehouseReceivedProgramFilter) return false;

      if (!warehouseReceivedSearch.trim()) return true;
      const q = warehouseReceivedSearch.toLowerCase();
      return (
        item.materialDescription.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.plantName.toLowerCase().includes(q) ||
        item.plant.toLowerCase().includes(q) ||
        (item.poNumber && item.poNumber.toLowerCase().includes(q)) ||
        (item.procurementPackage && item.procurementPackage.toLowerCase().includes(q))
      );
    });
  }, [items, warehouseReceivedSearch, warehouseReceivedPoFilter, warehouseReceivedPackageFilter, warehouseReceivedRdfFilter, warehouseReceivedProgramFilter, warehouseReceivedDatePreset, warehouseReceivedStartDate, warehouseReceivedEndDate]);

  // 3. Consolidated Statistics for Total Item Received
  const warehouseReceivedStats = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      const totalUnitsAll = receivingRecords.reduce((acc, r) => acc + (Number(r.quantity) || Number(r.qtyInUnitOfEntry) || 0), 0) || 1;
      let units = 0;
      let valuation = 0;
      let lineItems = 0;
      const suppliers = new Set<string>();
      const plants = new Set<string>();

      warehouseReceivedFilteredRecords.forEach((r) => {
        const u = Number(r.quantity) || Number(r.qtyInUnitOfEntry) || 0;
        const v = Number(r.amtInLocCur) || 0;
        units += u;
        valuation += v;
        lineItems++;
        if (r.supplier) suppliers.add(r.supplier);
        if (r.plant) plants.add(r.plant);
      });

      const percentageUnits = ((units / totalUnitsAll) * 100).toFixed(1);

      return {
        units,
        valuation,
        lineItems,
        percentageUnits,
        isReceivingData: true,
        supplierCount: suppliers.size,
        plantCount: plants.size
      };
    }

    const totalReceivedUnits = items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').reduce((acc, i) => acc + (Number(i.qty) || 0), 0) || 1;
    let units = 0;
    let valuation = 0;
    let lineItems = 0;

    warehouseReceivedFilteredItems.forEach((item) => {
      const u = Number(item.qty) || 0;
      const v = Number(item.totalAmount) || (u * (Number(item.unitPrice) || 0));
      units += u;
      valuation += v;
      lineItems++;
    });

    const percentageUnits = ((units / totalReceivedUnits) * 100).toFixed(1);

    return {
      units,
      valuation,
      lineItems,
      percentageUnits,
      isReceivingData: false
    };
  }, [receivingRecords, warehouseReceivedFilteredRecords, warehouseReceivedFilteredItems, items]);

  // 4. Warehouse Intake Horizons Bar Data
  const warehouseHorizonBarData = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      const now = new Date();
      let maxRecordDate = new Date(0);
      receivingRecords.forEach(r => {
        const d = parseReceivingDate(r.entryDate || r.documentDate);
        if (d && d > maxRecordDate) maxRecordDate = d;
      });

      const diffDays = Math.abs((now.getTime() - maxRecordDate.getTime()) / (1000 * 60 * 60 * 24));
      const refDate = (maxRecordDate.getTime() > 0 && diffDays > 90) ? maxRecordDate : now;

      const d7 = new Date(refDate); d7.setDate(refDate.getDate() - 7);
      const d30 = new Date(refDate); d30.setDate(refDate.getDate() - 30);
      const d90 = new Date(refDate); d90.setDate(refDate.getDate() - 90);

      let u7 = 0, l7 = 0, v7 = 0;
      let u8to30 = 0, l8to30 = 0, v8to30 = 0;
      let u31to90 = 0, l31to90 = 0, v31to90 = 0;
      let uOlder = 0, lOlder = 0, vOlder = 0;
      let uTotal = 0, lTotal = 0, vTotal = 0;

      let uCumul7 = 0;
      let uCumul30 = 0;
      let uCumul90 = 0;

      receivingRecords.forEach((rec) => {
        const u = Number(rec.quantity) || Number(rec.qtyInUnitOfEntry) || 0;
        const v = Number(rec.amtInLocCur) || 0;
        uTotal += u;
        lTotal += 1;
        vTotal += v;

        const d = parseReceivingDate(rec.entryDate || rec.documentDate);
        if (d) {
          if (d >= d7) {
            u7 += u; l7 += 1; v7 += v;
            uCumul7 += u;
            uCumul30 += u;
            uCumul90 += u;
          } else if (d >= d30) {
            u8to30 += u; l8to30 += 1; v8to30 += v;
            uCumul30 += u;
            uCumul90 += u;
          } else if (d >= d90) {
            u31to90 += u; l31to90 += 1; v31to90 += v;
            uCumul90 += u;
          } else {
            uOlder += u; lOlder += 1; vOlder += v;
          }
          return;
        }
        uOlder += u; lOlder += 1; vOlder += v;
      });

      const barChartSeries = [
        { id: '7d', name: '0-7 Days', label: 'Last 7 Days', units: u7, items: l7, valuation: v7, presetId: '7d' },
        { id: '30d', name: '8-30 Days', label: '8-30 Days', units: u8to30, items: l8to30, valuation: v8to30, presetId: '30d' },
        { id: '90d', name: '31-90 Days', label: '31-90 Days', units: u31to90, items: l31to90, valuation: v31to90, presetId: '90d' },
        { id: 'all', name: '> 90 Days', label: 'Older (>90d)', units: uOlder, items: lOlder, valuation: vOlder, presetId: 'all' }
      ];

      const presets = [
        { id: 'all', label: 'All Time', subtext: 'Complete stock horizon', units: uTotal, percentage: 100 },
        { id: '7d', label: 'Last 7 Days', subtext: 'Weekly intake arrivals', units: uCumul7, percentage: uTotal > 0 ? Math.round((uCumul7 / uTotal) * 100) : 0 },
        { id: '30d', label: 'Last 30 Days', subtext: 'Monthly intake volume', units: uCumul30, percentage: uTotal > 0 ? Math.round((uCumul30 / uTotal) * 100) : 0 },
        { id: '90d', label: 'Last 90 Days', subtext: 'Quarterly intake volume', units: uCumul90, percentage: uTotal > 0 ? Math.round((uCumul90 / uTotal) * 100) : 0 },
        { id: 'custom', label: 'Custom Range', subtext: warehouseReceivedStartDate && warehouseReceivedEndDate ? `${warehouseReceivedStartDate} to ${warehouseReceivedEndDate}` : 'Interactive date filter', units: warehouseReceivedStats.units, percentage: uTotal > 0 ? Math.min(100, Math.round((warehouseReceivedStats.units / uTotal) * 100)) : 0 }
      ];

      return { barChartSeries, presets, totalUnits: uTotal };
    }

    const deliveredItems = items.filter(i => i.deliveryStatus === 'Delivered & Dispatched');
    const now = new Date();
    const d7 = new Date(); d7.setDate(now.getDate() - 7);
    const d30 = new Date(); d30.setDate(now.getDate() - 30);
    const d90 = new Date(); d90.setDate(now.getDate() - 90);

    let u7 = 0, l7 = 0, v7 = 0;
    let u8to30 = 0, l8to30 = 0, v8to30 = 0;
    let u31to90 = 0, l31to90 = 0, v31to90 = 0;
    let uOlder = 0, lOlder = 0, vOlder = 0;
    let uTotal = 0, lTotal = 0, vTotal = 0;

    let uCumul7 = 0;
    let uCumul30 = 0;
    let uCumul90 = 0;

    deliveredItems.forEach((item) => {
      const u = Number(item.qty) || 0;
      const v = Number(item.totalAmount) || (u * (Number(item.unitPrice) || 0));
      uTotal += u;
      lTotal += 1;
      vTotal += v;

      const dateStr = item.receivingDate || item.docDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          if (d >= d7) {
            u7 += u; l7 += 1; v7 += v;
            uCumul7 += u;
            uCumul30 += u;
            uCumul90 += u;
          } else if (d >= d30) {
            u8to30 += u; l8to30 += 1; v8to30 += v;
            uCumul30 += u;
            uCumul90 += u;
          } else if (d >= d90) {
            u31to90 += u; l31to90 += 1; v31to90 += v;
            uCumul90 += u;
          } else {
            uOlder += u; lOlder += 1; vOlder += v;
          }
          return;
        }
      }
      uOlder += u; lOlder += 1; vOlder += v;
    });

    const barChartSeries = [
      { id: '7d', name: '0-7 Days', label: 'Last 7 Days', units: u7, items: l7, valuation: v7, presetId: '7d' },
      { id: '30d', name: '8-30 Days', label: '8-30 Days', units: u8to30, items: l8to30, valuation: v8to30, presetId: '30d' },
      { id: '90d', name: '31-90 Days', label: '31-90 Days', units: u31to90, items: l31to90, valuation: v31to90, presetId: '90d' },
      { id: 'all', name: '> 90 Days', label: 'Older (>90d)', units: uOlder, items: lOlder, valuation: vOlder, presetId: 'all' }
    ];

    const presets = [
      { id: 'all', label: 'All Time', subtext: 'Complete stock horizon', units: uTotal, percentage: 100 },
      { id: '7d', label: 'Last 7 Days', subtext: 'Weekly intake arrivals', units: uCumul7, percentage: uTotal > 0 ? Math.round((uCumul7 / uTotal) * 100) : 0 },
      { id: '30d', label: 'Last 30 Days', subtext: 'Monthly intake volume', units: uCumul30, percentage: uTotal > 0 ? Math.round((uCumul30 / uTotal) * 100) : 0 },
      { id: '90d', label: 'Last 90 Days', subtext: 'Quarterly intake volume', units: uCumul90, percentage: uTotal > 0 ? Math.round((uCumul90 / uTotal) * 100) : 0 },
      { id: 'custom', label: 'Custom Range', subtext: warehouseReceivedStartDate && warehouseReceivedEndDate ? `${warehouseReceivedStartDate} to ${warehouseReceivedEndDate}` : 'Interactive date filter', units: warehouseReceivedStats.units, percentage: uTotal > 0 ? Math.min(100, Math.round((warehouseReceivedStats.units / uTotal) * 100)) : 0 }
    ];

    return { barChartSeries, presets, totalUnits: uTotal };
  }, [items, receivingRecords, summary.totalQuantity, warehouseReceivedStartDate, warehouseReceivedEndDate, warehouseReceivedStats.units]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.setTextColor(8, 145, 178); // cyan-600
    doc.text('EPSS@2026', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Warehouse Received Inventory Report', 14, 28);
    
    doc.setFontSize(9);
    doc.text(`Generated on: ${timestamp}`, 14, 34);

    // Filters Summary
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text('Report Parameters:', 14, 42);
    doc.setFont('helvetica', 'normal');
    
    const filterText = `Date Range: ${warehouseReceivedDatePreset === 'all' ? 'All Time' : 
      warehouseReceivedDatePreset === 'custom' ? `${warehouseReceivedStartDate || 'Any'} to ${warehouseReceivedEndDate || 'Any'}` : 
      warehouseReceivedDatePreset === '7d' ? 'Last 7 Days' : warehouseReceivedDatePreset === '30d' ? 'Last 30 Days' : 'Last 90 Days'}`;
    
    doc.text(filterText, 14, 48);
    
    if (warehouseReceivedPoFilter !== 'all') doc.text(`PO Filter: ${warehouseReceivedPoFilter}`, 14, 53);
    if (warehouseReceivedProgramFilter !== 'all') doc.text(`Program: ${warehouseReceivedProgramFilter}`, 14, 58);

    // Stats Section
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(14, 65, 182, 20, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 16, 72);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Units: ${formatNumber(warehouseReceivedStats.units)}`, 16, 80);
    doc.text(`Line Items: ${formatNumber(warehouseReceivedStats.lineItems)}`, 80, 80);
    doc.text(`Total Valuation: ${formatCurrency(warehouseReceivedStats.valuation, true)}`, 130, 80);

    // Table
    const isReceivingDataActive = receivingRecords && receivingRecords.length > 0;
    const tableData = isReceivingDataActive
      ? warehouseReceivedFilteredRecords.map(r => [
          r.materialDescription,
          r.material,
          `Plant ${r.plant} (${r.storageLocation})`,
          `${r.quantity} ${r.baseUnitOfMeasure}`,
          formatCurrency(r.amtInLocCur, true),
          `PO: ${r.purchaseOrder}`
        ])
      : warehouseReceivedFilteredItems.map(item => [
          item.materialDescription,
          item.material,
          item.plantName,
          item.qty,
          formatCurrency(item.totalAmount || (item.qty * (item.unitPrice || 0)), true),
          item.poNumber || 'N/A'
        ]);

    autoTable(doc, {
      startY: 90,
      head: [['Material Description', 'Code', 'Hub/Warehouse', 'Qty', 'Valuation (ETB)', 'PO']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [8, 145, 178], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 60 },
        4: { halign: 'right' }
      }
    });

    doc.save(`EPSS_Warehouse_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setToastNotification('PDF Report exported successfully!');
    setTimeout(() => setToastNotification(null), 3000);
  };

  const warehouseReceivedPoNumbers = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return Array.from(new Set(receivingRecords.map(r => r.purchaseOrder).filter(Boolean))).sort();
    }
    return Array.from(new Set(items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').map(i => i.poNumber).filter(Boolean) as string[])).sort();
  }, [receivingRecords, items]);

  const warehouseReceivedPlants = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return Array.from(new Set(receivingRecords.map(r => r.plant).filter(Boolean))).sort();
    }
    return [];
  }, [receivingRecords]);

  const warehouseReceivedSuppliers = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return Array.from(new Set(receivingRecords.map(r => r.supplier).filter((s): s is string => Boolean(s)))).sort();
    }
    return [];
  }, [receivingRecords]);

  const warehouseReceivedMovements = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return Array.from(new Set(receivingRecords.map(r => r.movementType).filter(Boolean))).sort();
    }
    return [];
  }, [receivingRecords]);

  const warehouseReceivedPackages = useMemo(() => Array.from(new Set(items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').map(i => i.procurementPackage).filter(Boolean) as string[])).sort(), [items]);
  const warehouseReceivedRdfNumbers = useMemo(() => Array.from(new Set(items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').map(i => i.rdfNumber).filter(Boolean) as string[])).sort(), [items]);
  const warehouseReceivedPrograms = useMemo(() => Array.from(new Set(items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').map(i => i.programName).filter(Boolean) as string[])).sort(), [items]);

  // SOH (Stock On Hand) Analysis Logic
  const sohFilteredItems = useMemo(() => {
    return items.filter((item) => {
      if (sohBranchFilter !== 'all' && item.plantName !== sohBranchFilter) return false;
      if (sohRdfFilter !== 'all' && item.rdfNumber !== sohRdfFilter) return false;
      if (sohProgramFilter !== 'all' && item.programName !== sohProgramFilter) return false;

      if (!sohSearch.trim()) return true;
      const q = sohSearch.toLowerCase();
      return (
        item.materialDescription.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.plantName.toLowerCase().includes(q) ||
        item.wh?.toLowerCase().includes(q)
      );
    });
  }, [items, sohSearch, sohBranchFilter, sohRdfFilter, sohProgramFilter]);

  const sohStats = useMemo(() => {
    let units = 0;
    let valuation = 0;
    let lineItems = 0;
    const branches: Record<string, { units: number; valuation: number; lineItems: number }> = {};

    sohFilteredItems.forEach(item => {
      const u = Number(item.qty) || 0;
      const v = Number(item.totalAmount) || (u * (item.unitPrice || 0));
      
      units += u;
      valuation += v;
      lineItems++;

      const bName = item.plantName || 'Unknown Branch';
      if (!branches[bName]) {
        branches[bName] = { units: 0, valuation: 0, lineItems: 0 };
      }
      branches[bName].units += u;
      branches[bName].valuation += v;
      branches[bName].lineItems++;
    });

    return {
      units,
      valuation,
      lineItems,
      branchCount: Object.keys(branches).length,
      branches: Object.entries(branches).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.units - a.units)
    };
  }, [sohFilteredItems]);

  const sohBranchList = useMemo(() => Array.from(new Set(items.map(i => i.plantName).filter(Boolean) as string[])).sort(), [items]);
  const sohRdfList = useMemo(() => Array.from(new Set(items.map(i => i.rdfNumber).filter(Boolean) as string[])).sort(), [items]);
  const sohProgramList = useMemo(() => Array.from(new Set(items.map(i => i.programName).filter(Boolean) as string[])).sort(), [items]);

  // Multiple Stock Analytics Logic
  const msTotalValue = useMemo(() => {
    return multipleStockItems.reduce((sum, item) => {
      return sum + (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
    }, 0);
  }, [multipleStockItems]);

  const msValueCircleChartData = useMemo(() => {
    const groupVal: Record<string, number> = {};
    multipleStockItems.forEach(item => {
      const g = item.materialGroupName || item.specialStockType || 'General';
      const val = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
      groupVal[g] = (groupVal[g] || 0) + val;
    });
    const total = msTotalValue || 1;
    const colors = ['#0891b2', '#059669', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308'];
    return Object.entries(groupVal)
      .map(([name, val], idx) => ({
        name,
        value: val,
        percentage: Number(((val / total) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [multipleStockItems, msTotalValue]);

  const msRdfBarChartData = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    multipleStockItems.forEach(item => {
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
  }, [multipleStockItems]);

  const msHpBarChartData = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    multipleStockItems.forEach(item => {
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
  }, [multipleStockItems]);

  // Non-Moving Items Selectors
  const nonMovingBaseItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.isNonMoving === true ||
        item.sohStatus === 'Non-Moving Stock' ||
        item.fyaEpSSNoBkdStatus?.toLowerCase().includes('non-moving') ||
        ((item as any).operationalStatus && (item as any).operationalStatus.toLowerCase().includes('non-moving'))
    );
  }, [items]);

  const nonMovingBranchList = useMemo(() => Array.from(new Set(nonMovingBaseItems.map(i => i.plantName).filter(Boolean) as string[])).sort(), [nonMovingBaseItems]);
  const nonMovingRdfList = useMemo(() => Array.from(new Set(nonMovingBaseItems.map(i => i.rdfNumber || i.wbsElement).filter(Boolean) as string[])).sort(), [nonMovingBaseItems]);
  const nonMovingProgramList = useMemo(() => Array.from(new Set(nonMovingBaseItems.map(i => i.programName).filter(Boolean) as string[])).sort(), [nonMovingBaseItems]);

  const nonMovingFilteredItems = useMemo(() => {
    return nonMovingBaseItems.filter((item) => {
      if (nonMovingBranchFilter !== 'all' && item.plantName !== nonMovingBranchFilter) return false;
      if (nonMovingRdfFilter !== 'all' && (item.rdfNumber !== nonMovingRdfFilter && item.wbsElement !== nonMovingRdfFilter)) return false;
      if (nonMovingProgramFilter !== 'all' && item.programName !== nonMovingProgramFilter) return false;

      if (!nonMovingSearch.trim()) return true;
      const q = nonMovingSearch.toLowerCase();
      return (
        item.materialDescription.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.plantName.toLowerCase().includes(q) ||
        item.wh?.toLowerCase().includes(q) ||
        item.batch?.toLowerCase().includes(q)
      );
    });
  }, [nonMovingBaseItems, nonMovingSearch, nonMovingBranchFilter, nonMovingRdfFilter, nonMovingProgramFilter]);

  const nonMovingStats = useMemo(() => {
    let units = 0;
    let valuation = 0;
    let lineItems = 0;
    const branches: Record<string, { units: number; valuation: number; lineItems: number }> = {};
    const programs: Record<string, { units: number; valuation: number; lineItems: number }> = {};
    const rdfs: Record<string, { units: number; valuation: number; lineItems: number }> = {};

    nonMovingFilteredItems.forEach((item) => {
      const u = Number(item.qty) || 0;
      const v = Number(item.totalAmount) || (u * (item.unitPrice || 0));

      units += u;
      valuation += v;
      lineItems++;

      const bName = item.plantName || 'Unknown Branch';
      if (!branches[bName]) branches[bName] = { units: 0, valuation: 0, lineItems: 0 };
      branches[bName].units += u;
      branches[bName].valuation += v;
      branches[bName].lineItems++;

      const pName = item.programName || 'General Healthcare';
      if (!programs[pName]) programs[pName] = { units: 0, valuation: 0, lineItems: 0 };
      programs[pName].units += u;
      programs[pName].valuation += v;
      programs[pName].lineItems++;

      const rName = item.rdfNumber || item.wbsElement || 'N/A';
      if (!rdfs[rName]) rdfs[rName] = { units: 0, valuation: 0, lineItems: 0 };
      rdfs[rName].units += u;
      rdfs[rName].valuation += v;
      rdfs[rName].lineItems++;
    });

    return {
      units,
      valuation,
      lineItems,
      branchCount: Object.keys(branches).length,
      branches: Object.entries(branches).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.units - a.units),
      programs: Object.entries(programs).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.units - a.units),
      rdfs: Object.entries(rdfs).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.units - a.units)
    };
  }, [nonMovingFilteredItems]);

  const COLORS = ['#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#475569'];

  const installationMetrics = summary.installationStatusMetrics || {
    'Installed': { units: 0, lineItems: 0, valuation: 0 },
    'Not Installed': { units: 0, lineItems: 0, valuation: 0 },
    'Pending Installation': { units: 0, lineItems: 0, valuation: 0 },
    'Under Commissioning': { units: 0, lineItems: 0, valuation: 0 },
    'Site Assessment': { units: 0, lineItems: 0, valuation: 0 }
  };

  const installationSummary = summary.installationStatusSummary || {
    'Installed': 0,
    'Not Installed': 0,
    'Pending Installation': 0,
    'Under Commissioning': 0,
    'Site Assessment': 0
  };

  const totalInstQty = Object.values(installationSummary).reduce((a: any, b: any) => a + b, 0) || 1;
  const totalInstLineItems = Object.values(installationMetrics).reduce((a: any, b: any) => a + (b.lineItems || 0), 0) || 1;

  const pieData = Object.entries(installationMetrics).map(([name, data]) => {
    const units = Number(data.units) || 0;
    const lineItems = Number(data.lineItems) || 0;
    const valuation = Number(data.valuation) || 0;
    return {
      name,
      value: units,
      lineItems,
      valuation,
      percentage: Math.round((units / totalInstQty) * 100),
      lineItemPercentage: Math.round((lineItems / totalInstLineItems) * 100)
    };
  });

  const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'];

  // Aggregated Installation Overview
  const installationOverview = useMemo(() => {
    let installedUnits = 0;
    let pendingUnits = 0;
    let commUnits = 0;
    let totalUnits = 0;
    let installedItems = 0;
    const totalItems = items.length;

    if (items && items.length > 0) {
      items.forEach(item => {
        const u = Number(item.qty) || 1;
        const st = item.installationStatus || 'Installed';
        totalUnits += u;
        if (st === 'Installed') {
          installedUnits += u;
          installedItems++;
        } else if (st === 'Pending Installation') {
          pendingUnits += u;
        } else {
          commUnits += u;
        }
      });
    } else {
      installedUnits = installationMetrics['Installed']?.units || 0;
      pendingUnits = installationMetrics['Pending Installation']?.units || 0;
      commUnits = (installationMetrics['Under Commissioning']?.units || 0) + (installationMetrics['Site Assessment']?.units || 0);
      totalUnits = totalInstQty;
      installedItems = installationMetrics['Installed']?.lineItems || 0;
    }

    const percentage = totalUnits > 0 ? Math.round((installedUnits / totalUnits) * 100) : 0;
    const pendingPercentage = totalUnits > 0 ? Math.round((pendingUnits / totalUnits) * 100) : 0;
    const commPercentage = totalUnits > 0 ? Math.round((commUnits / totalUnits) * 100) : 0;

    return {
      totalUnits,
      totalItems,
      installedUnits,
      installedItems,
      pendingUnits,
      pendingPercentage,
      commUnits,
      commPercentage,
      percentage
    };
  }, [items, installationMetrics, totalInstQty]);

  return (
    <div className="space-y-6 pb-12 w-full min-w-0 max-w-full hover:bg-sky-50 transition-colors">
      {/* =========================================================================
          COLLECTED DASHBOARD HEADER & UNIFIED FILTER COMMAND CENTER
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4 w-full">
        {/* Row 1: Header Brand, Record Counters, View Mode Selector, and Export Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-600 text-white shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                  Dashboard Analytics & Stock Intelligence
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-mono shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{(items.length + multipleStockItems.length).toLocaleString()} Live Records</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized dashboard header collecting all multi-plant filters, fund streams, device statuses, and time horizons
              </p>
            </div>
          </div>

          {/* View Mode Tabs + Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectDashboardMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dashboardAnalyticsMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Combined View
              </button>
              <button
                type="button"
                onClick={() => handleSelectDashboardMode('multiple-stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  dashboardAnalyticsMode === 'multiple-stock'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                <span>Multiple Stock</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  dashboardAnalyticsMode === 'multiple-stock' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {filteredMultipleStockItems.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDashboardMode('master')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dashboardAnalyticsMode === 'master'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Master Inventory
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExportChartsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download current chart visualizations as PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Charts</span>
            </button>

            <button
              type="button"
              onClick={handleQuickExportCharts}
              disabled={isQuickExportingCharts}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Instant 1-Click PNG Download"
            >
              {isQuickExportingCharts ? <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> : <Camera className="w-4 h-4 text-teal-600" />}
            </button>
          </div>
        </div>

        {/* Row 2: Collected Filter Controls Bar - Active for All Dashboard Views */}
        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border-2 border-indigo-500/35 shadow-md ring-4 ring-indigo-500/5 space-y-4 transition-all">
          <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-600 text-white shadow-xs shrink-0">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                    Unified Dashboard Filters
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs font-mono">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Active for All Dashboard Views</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Actively synchronized across Multiple Stock, Master Inventory, and Receiving Data Intelligence
                </p>
              </div>
            </div>

            {/* View Scope Controls & Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode Switcher (Active for All Views) */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSelectDashboardMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    dashboardAnalyticsMode === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Show all dashboard views concurrently (Multiple Stock + Master Inventory + Receiving Data)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Views Active</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDashboardMode('multiple-stock')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    dashboardAnalyticsMode === 'multiple-stock'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Multiple Stock Analytics View"
                >
                  Multiple Stock ({filteredMultipleStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDashboardMode('master')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    dashboardAnalyticsMode === 'master'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Master Inventory View"
                >
                  Master Inventory ({filteredItems.length})
                </button>
              </div>

              {/* Quick Time Horizon Presets */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">Horizon:</span>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('all')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    !dashboardStartDate && !dashboardEndDate ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('7d')}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  7D
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('30d')}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  30D
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('90d')}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  90D
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('ytd')}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  YTD
                </button>
              </div>
            </div>
          </div>

          {/* Primary Filter Grid: 6 Comprehensive Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 1. Plant Hub */}
            <div className="space-y-1 relative" ref={plantDropdownRef}>
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>Plant Hub</span>
                {selectedPlantList.length > 0 && (
                  <span className="ml-auto px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-600 text-white font-mono shadow-2xs">
                    {selectedPlantList.length} Active
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => setIsPlantDropdownOpen(!isPlantDropdownOpen)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 shadow-2xs flex items-center justify-between text-left cursor-pointer"
                title="Select multiple plant hubs"
              >
                <span className="truncate">
                  {selectedPlantList.length === 0
                    ? `All Plants & Hubs (${availableDashboardPlants.length})`
                    : selectedPlantList.length === 1
                    ? availableDashboardPlants.find(p => p.code === selectedPlantList[0])?.name || selectedPlantList[0]
                    : `${selectedPlantList.length} Plants Selected`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {/* Multi-Select Dropdown Popup with Visual Indicators/Badges */}
              {isPlantDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-[11px]">
                    <span className="font-bold text-slate-700">Select Plant Hubs (Multi-Select)</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDashboardPlantFilter('all')}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setDashboardPlantFilter([])}
                        className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    <div
                      onClick={() => setDashboardPlantFilter('all')}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                        selectedPlantList.length === 0 ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>All Plants & Hubs ({availableDashboardPlants.length})</span>
                      {selectedPlantList.length === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                          Active
                        </span>
                      )}
                    </div>
                    {availableDashboardPlants.map((p) => {
                      const isSelected = selectedPlantList.includes(p.code);
                      return (
                        <div
                          key={p.code}
                          onClick={() => {
                            let next: string[];
                            if (isSelected) {
                              next = selectedPlantList.filter(c => c !== p.code);
                            } else {
                              next = [...selectedPlantList, p.code];
                            }
                            setDashboardPlantFilter(next.length === 0 ? 'all' : next);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 pointer-events-none"
                            />
                            <span className="truncate">{p.name ? `${p.name} (${p.code})` : p.code}</span>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs shrink-0 flex items-center gap-1">
                              <span>✓ Active</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Material Group */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Material Group</span>
              </label>
              <select
                value={dashboardGroupFilter}
                onChange={(e) => setDashboardGroupFilter(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 shadow-2xs truncate"
                title="Filter by Material Group / Category"
              >
                <option value="all">All Groups ({availableDashboardGroups.length})</option>
                {availableDashboardGroups.map((g: string) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Fund Stream (RDF vs HP) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Coins className="w-3 h-3 text-slate-400" />
                <span>Fund Stream</span>
              </label>
              <select
                value={activeStreamFilter}
                onChange={(e) => setActiveStreamFilter(e.target.value as 'all' | 'RDF' | 'HP')}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 shadow-2xs"
                title="Filter by Fund Stream (Revolving Drug Fund vs Health Program)"
              >
                <option value="all">All Funds (RDF & HP)</option>
                <option value="RDF">RDF — Revolving Drug Fund</option>
                <option value="HP">HP — Health Program (Q Stock)</option>
              </select>
            </div>

            {/* 4. Equipment Operational Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <span>Device Status</span>
              </label>
              <select
                value={dashboardStatusFilter}
                onChange={(e) => setDashboardStatusFilter(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 shadow-2xs"
                title="Filter by Operational Status"
              >
                <option value="all">All Statuses</option>
                <option value="Functional">Functional (Active)</option>
                <option value="Defective">Defective (Faulty)</option>
                <option value="Needs Spare Part">Needs Spare Part</option>
                <option value="Non-Moving">Non-Moving Stock</option>
              </select>
            </div>

            {/* 5. WBS Element */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                <span>WBS Element</span>
              </label>
              <select
                value={dashboardWbsFilter}
                onChange={(e) => setDashboardWbsFilter(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 shadow-2xs truncate"
                title="Filter by WBS Element / Project"
              >
                <option value="all">All WBS Elements</option>
                {availableWbsElements.map((w: string) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Live Search */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Search className="w-3 h-3 text-slate-400" />
                <span>Search</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={dashboardSearchQuery}
                  onChange={(e) => setDashboardSearchQuery(e.target.value)}
                  placeholder="Material, PO, batch..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-2.5 pr-7 py-1.5 focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs placeholder:text-slate-400"
                />
                {dashboardSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDashboardSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Custom Date Horizon Inputs & Results Counter */}
          <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Custom Dates:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">From</span>
              <input
                type="date"
                value={dashboardStartDate}
                onChange={(e) => setDashboardStartDate(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 shadow-2xs"
                title="Start Date"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">To</span>
              <input
                type="date"
                value={dashboardEndDate}
                onChange={(e) => setDashboardEndDate(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 shadow-2xs"
                title="End Date"
              />
            </div>

            {/* Filter Stats Badge & Double-Click Feature Tip */}
            <div className="ml-auto flex items-center gap-2.5 flex-wrap">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                <span>💡 Double-click any chart or card to view source data</span>
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Active Matching: <strong className="text-indigo-600 font-bold">{filteredItems.length.toLocaleString()}</strong> devices &bull;{' '}
                <strong className="text-indigo-600 font-bold">{filteredMultipleStockItems.length.toLocaleString()}</strong> stock records &bull;{' '}
                <strong className="text-teal-600 font-bold">{filteredReceivingRecords.length.toLocaleString()}</strong> receiving entries
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Active Filters Pill Bar & Reset Button */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-indigo-500" />
              <span>Active Filters ({activeFilterCount}):</span>
            </span>

            {selectedPlantList.length > 0 && (
              selectedPlantList.map((code) => {
                const plantObj = availableDashboardPlants.find(p => p.code === code);
                const displayName = plantObj ? (plantObj.name ? `${plantObj.name} (${code})` : code) : code;
                return (
                  <span key={code} className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>Plant: {displayName}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-600 text-white font-mono">Active</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = selectedPlantList.filter(c => c !== code);
                        setDashboardPlantFilter(next.length === 0 ? 'all' : next);
                      }}
                      className="hover:text-indigo-900 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })
            )}

            {dashboardGroupFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                <span>Group: {dashboardGroupFilter}</span>
                <button type="button" onClick={() => setDashboardGroupFilter('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {activeStreamFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <span>Fund: {activeStreamFilter === 'RDF' ? 'RDF (Blank Stock)' : 'HP (Q Stock / Grants)'}</span>
                <button type="button" onClick={() => setActiveStreamFilter('all')} className="hover:text-emerald-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {dashboardStatusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <span>Status: {dashboardStatusFilter}</span>
                <button type="button" onClick={() => setDashboardStatusFilter('all')} className="hover:text-amber-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {dashboardWbsFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                <span>WBS: {dashboardWbsFilter}</span>
                <button type="button" onClick={() => setDashboardWbsFilter('all')} className="hover:text-purple-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(dashboardStartDate || dashboardEndDate) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 px-2.5 py-0.5 rounded-full">
                <span>Date: {dashboardStartDate || 'Start'} to {dashboardEndDate || 'Now'}</span>
                <button type="button" onClick={() => { setDashboardStartDate(''); setDashboardEndDate(''); }} className="hover:text-cyan-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {dashboardSearchQuery && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full">
                <span>Search: "{dashboardSearchQuery}"</span>
                <button type="button" onClick={() => setDashboardSearchQuery('')} className="hover:text-slate-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetDashboardFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              title="Reset all applied filters back to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
        {/* Dashboard Perspective Tabs - High discoverability for specific modules */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full sm:w-max">
          <button
            onClick={() => setActiveLayoutTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeLayoutTab === 'analytics' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Core Analytics</span>
          </button>
          <button
            onClick={() => setActiveLayoutTab('agreements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeLayoutTab === 'agreements' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>MD Agreements</span>
          </button>

          <button
            onClick={() => setActiveLayoutTab('alerts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeLayoutTab === 'alerts' ? 'bg-white text-rose-700 shadow-sm border border-rose-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Risk Alerts</span>
          </button>
          <button
            onClick={() => setActiveLayoutTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeLayoutTab === 'audit' ? 'bg-white text-teal-700 shadow-sm border border-teal-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Audit Ledger</span>
          </button>
        </div>
      </div>
 
      {/* 1. MD Agreement Management Summary Chart - High Visibility Section */}
      {(activeLayoutTab === 'analytics' || activeLayoutTab === 'agreements') && (
        <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm space-y-4 mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">
                  MD Agreement Management
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider font-mono shadow-2xs">
                  Stacked Performance
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Annual Stacked Performance Analysis: Total Delivered of Line, Total Line of Item & Total Delivered Value Item per Year.
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Stacked Chart Display Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAgreementChartType('stacked')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    agreementChartType === 'stacked'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                  title="Stacked Graph: Stacks delivered of line and remaining lines to equal Total Line of Item, alongside Delivered Value"
                >
                  <Layers className="w-3 h-3" />
                  <span>Stacked</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAgreementChartType('grouped')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    agreementChartType === 'grouped'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                  title="Grouped Side-by-Side View"
                >
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setAgreementChartType('linesOnly')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    agreementChartType === 'linesOnly'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                  title="Focus on Line Items (Delivered vs Total Lines)"
                >
                  Lines Only
                </button>
                <button
                  type="button"
                  onClick={() => setAgreementChartType('valueOnly')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    agreementChartType === 'valueOnly'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-emerald-600'
                  }`}
                  title="Focus on Total Delivered Value (ETB)"
                >
                  Value Only
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateToAgreementSource('all')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer active:scale-95"
                title="Open exact uploaded 10-column MD Agreement dataset in Procurement Management"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Exact Source Data</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row of Summary KPI Cards based strictly on user uploaded MD Agreement data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div 
              onClick={() => handleNavigateToAgreementSource('all')}
              className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-2xl border border-indigo-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition active:scale-[0.99] group"
              title="Click to view all line items in 10-column MD table"
            >
              <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Line of Item</p>
                  <ArrowUpRight className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-lg font-black text-slate-900 truncate">{formatNumber(agreementKpiMetrics.totalRequests)}</p>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded-full">
                    Total Lines
                  </span>
                </div>
              </div>
            </div>

            <div 
              onClick={() => handleNavigateToAgreementSource('all')}
              className="bg-gradient-to-br from-sky-50/80 to-white p-4 rounded-2xl border border-sky-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-sky-300 hover:shadow-md transition active:scale-[0.99] group"
              title="Click to view delivered lines in 10-column MD table"
            >
              <div className="p-3 rounded-xl bg-sky-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Delivered of Line</p>
                  <ArrowUpRight className="w-3 h-3 text-sky-400 group-hover:text-sky-600 transition-colors" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-lg font-black text-sky-900 truncate">{formatNumber(agreementKpiMetrics.totalDeliveredLines)}</p>
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded-full">
                    {agreementKpiMetrics.overallRate}% Delivered
                  </span>
                </div>
              </div>
            </div>

            <div 
              onClick={() => handleNavigateToAgreementSource('all')}
              className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition active:scale-[0.99] group"
              title="Click to view delivered values in 10-column MD table"
            >
              <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Delivered Value (ETB)</p>
                  <ArrowUpRight className="w-3 h-3 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <p className="text-lg font-black text-emerald-900 mt-0.5 truncate">{formatCurrency(agreementKpiMetrics.totalDeliveredValue || agreementKpiMetrics.totalCommittedBudget, true)}</p>
              </div>
            </div>

            <div 
              onClick={() => handleNavigateToAgreementSource('all')}
              className="bg-gradient-to-br from-teal-50/80 to-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center gap-3.5 cursor-pointer hover:border-teal-300 hover:shadow-md transition active:scale-[0.99] group"
              title="Click to view suppliers and facilities in 10-column MD table"
            >
              <div className="p-3 rounded-xl bg-teal-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Suppliers & Facilities</p>
                  <ArrowUpRight className="w-3 h-3 text-teal-400 group-hover:text-teal-600 transition-colors" />
                </div>
                <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{formatNumber(agreementKpiMetrics.supplierCount)} Sources</p>
              </div>
            </div>
          </div>
          
          <div className="h-80 sm:h-96 w-full bg-slate-50/30 rounded-2xl p-4 border border-slate-100/80 shadow-inner relative overflow-hidden flex flex-col justify-between">
            {/* Decorative background grid effect */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            {/* Interactive Legend Badges for all 3 Dimensions */}
            <div className="relative z-10 flex items-center gap-3 sm:gap-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-white/90 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs flex-wrap mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-2xs" />
                <span className="text-emerald-900 font-extrabold">Total Delivered Value (ETB)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-sky-600 shadow-2xs" />
                <span className="text-sky-900 font-extrabold">Total Delivered of Line</span>
              </div>
              {agreementChartType === 'stacked' && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-sky-300 shadow-2xs" />
                  <span className="text-slate-600">Pending Lines (Stacked to Total)</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-indigo-600 border-t-2 border-indigo-600 border-dashed" />
                <span className="text-indigo-900 font-extrabold">Total Line of Item</span>
              </div>
            </div>

            {annualDeliveryMetrics.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-white/70 rounded-xl border border-dashed border-slate-300">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-2 shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wide">No MD Agreement Data Uploaded Yet</p>
                <p className="text-[11px] text-slate-500 max-w-md mt-1 font-medium leading-relaxed">
                  Upload your real <strong>MD Agreement Excel file</strong> or <strong>Program MD 10-column dataset</strong> in MD Agreement Management to automatically visualize total annual delivery values (ETB) and line of items.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('agreements')}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Upload MD Agreement Data</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={annualDeliveryMetrics} 
                    margin={{ top: 15, right: 15, left: 15, bottom: 5 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(state: any) => {
                      const yearVal = state?.activePayload?.[0]?.payload?.year || state?.activeLabel;
                      handleNavigateToAgreementSource(yearVal || 'all');
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    {agreementChartType !== 'linesOnly' && (
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 10, fill: '#059669', fontWeight: 800 }}
                        tickFormatter={(val) => `${formatYAxisValue(val)}`}
                        axisLine={false}
                        tickLine={false}
                      />
                    )}
                    {agreementChartType !== 'valueOnly' && (
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 10, fill: '#0284c7', fontWeight: 800 }}
                        tickFormatter={(val) => `${formatNumber(val)}`}
                        axisLine={false}
                        tickLine={false}
                      />
                    )}
                    <Tooltip 
                      cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2.5 min-w-[250px]">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                                <span className="font-black text-slate-900 text-sm">Year {label} Performance</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Stacked View
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {/* 1. Total Delivered Value Item per Year */}
                                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                                  <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                                    <span>Total Delivered Value:</span>
                                  </span>
                                  <span className="text-emerald-800 font-black text-xs font-mono">{formatCurrency(data.deliveredValue, true)}</span>
                                </div>

                                {/* 2. Total Delivered of Line */}
                                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-sky-50/70 border border-sky-100">
                                  <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 shrink-0" />
                                    <span>Total Delivered of Line:</span>
                                  </span>
                                  <span className="text-sky-800 font-black text-xs font-mono">{formatNumber(data.deliveredLines)} Lines</span>
                                </div>

                                {/* 3. Total Line of Item */}
                                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-indigo-50/70 border border-indigo-100">
                                  <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 shrink-0" />
                                    <span>Total Line of Item:</span>
                                  </span>
                                  <span className="text-indigo-900 font-black text-xs font-mono">{formatNumber(data.totalLines)} Lines</span>
                                </div>

                                {/* Delivery Progress Bar */}
                                <div className="pt-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                    <span>Line Delivery Completion</span>
                                    <span className="text-indigo-600 font-mono font-bold">{data.deliveryRate}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-500" 
                                      style={{ width: `${Math.min(100, Math.max(0, data.deliveryRate))}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {data.deviceOwnersList && (
                                <div className="pt-1.5 border-t border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Owners / Suppliers ({data.deviceOwnerCount}):
                                  </span>
                                  <p className="text-[11px] font-medium text-slate-700 truncate max-w-[230px] mt-0.5" title={data.deviceOwnersList}>
                                    {data.deviceOwnersList}
                                  </p>
                                </div>
                              )}

                              <div 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleNavigateToAgreementSource(label); 
                                }}
                                className="pt-2 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center justify-between gap-1 border-t border-slate-100 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/90 px-2.5 py-1.5 rounded-xl transition shadow-2xs mt-1"
                              >
                                <span>🔍 View Year {label} Exact Source Data</span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* 1. Total Delivered Value Item per Year (ETB) */}
                    {agreementChartType !== 'linesOnly' && (
                      <Bar 
                        yAxisId="left" 
                        dataKey="deliveredValue" 
                        name="Total Delivered Value Item per Year (ETB)" 
                        fill="#10b981" 
                        radius={[6, 6, 0, 0]} 
                        barSize={agreementChartType === 'stacked' ? 36 : 28}
                        stackId={agreementChartType === 'stacked' ? 'value' : undefined}
                        animationDuration={1500}
                        onClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        onDoubleClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {/* 2. Total Delivered of Line (Sky Blue - Stacked base) */}
                    {agreementChartType !== 'valueOnly' && (
                      <Bar 
                        yAxisId={agreementChartType === 'linesOnly' ? 'left' : 'right'} 
                        dataKey="deliveredLines" 
                        name="Total Delivered of Line" 
                        fill="#0284c7" 
                        radius={agreementChartType === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]} 
                        barSize={agreementChartType === 'stacked' ? 36 : 28}
                        stackId={agreementChartType === 'stacked' ? 'lines' : undefined}
                        animationDuration={1500}
                        onClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        onDoubleClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {/* 3. Pending Line of Item (Stacked on top of Total Delivered of Line to reach Total Line of Item) */}
                    {agreementChartType === 'stacked' && (
                      <Bar 
                        yAxisId="right" 
                        dataKey="pendingLines" 
                        name="Pending Line of Item (to Total)" 
                        fill="#93c5fd" 
                        radius={[6, 6, 0, 0]} 
                        barSize={36}
                        stackId="lines"
                        animationDuration={1500}
                        onClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        onDoubleClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {/* Grouped Mode: Total Line of Item separate bar */}
                    {agreementChartType === 'grouped' && (
                      <Bar 
                        yAxisId="right" 
                        dataKey="totalLines" 
                        name="Total Line of Item" 
                        fill="#6366f1" 
                        radius={[6, 6, 0, 0]} 
                        barSize={28}
                        animationDuration={1500}
                        onClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {/* 4. Total Line of Item - Trendline across years */}
                    {agreementChartType !== 'valueOnly' && (
                      <Line 
                        yAxisId={agreementChartType === 'linesOnly' ? 'left' : 'right'} 
                        type="monotone" 
                        dataKey="totalLines" 
                        name="Total Line of Item" 
                        stroke="#4f46e5" 
                        strokeWidth={3} 
                        strokeDasharray="4 4"
                        dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff' }}
                        animationDuration={2000}
                        onClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        onDoubleClick={(data: any) => { 
                          const yearVal = data?.payload?.year || data?.year;
                          handleNavigateToAgreementSource(yearVal);
                        }}
                        className="cursor-pointer"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
      


      {/* 3. Dashboard Risk Alerts & Expiry Monitoring */}
      {activeLayoutTab === 'alerts' && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           <DashboardAlertsTab 
             items={filteredItems}
             onNavigateTab={onNavigateTab}
             lowStockThreshold={lowStockThreshold}
             setLowStockThreshold={setLowStockThreshold}
             procurementSearch={procurementSearch}
             setProcurementSearch={setProcurementSearch}
             filteredLowStockItems={filteredLowStockItems}
             setSelectedProcurementItem={setSelectedProcurementItem}
             expiryFilterDays={expiryFilterDays}
             setExpiryFilterDays={setExpiryFilterDays}
             expirySearch={expirySearch}
             setExpirySearch={setExpirySearch}
             expiryUrgencyFilter={expiryUrgencyFilter}
             setExpiryUrgencyFilter={setExpiryUrgencyFilter}
             filteredExpiringItems={filteredExpiringItems}
             setSelectedExpiryItem={setSelectedExpiryItem}
             expiryCounts={expiryCounts}
           />
        </div>
      )}

      {/* 4. Dashboard System Audit Ledger */}
      {activeLayoutTab === 'audit' && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           <DashboardAuditTab 
             auditLogs={auditLogs}
           />
        </div>
      )}

       {/* Mode 1: Multiple Stock Analytics Only */}
      {activeLayoutTab === 'analytics' && dashboardAnalyticsMode === 'multiple-stock' && (
        <DashboardViewMultipleStockAnalytics
          multipleStockItems={filteredMultipleStockItems}
          onUploadMultipleStockData={onUploadMultipleStockData}
          isSidebarCollapsed={isSidebarCollapsed}
          hideWhenEmpty={false}
          hideUpload={!isAdmin}
          showHighValuationTable={false}
          plantFilter={dashboardPlantFilter}
          onPlantFilterChange={setDashboardPlantFilter}
          groupFilter={dashboardGroupFilter}
          onGroupFilterChange={setDashboardGroupFilter}
          streamFilter={activeStreamFilter}
          onStreamFilterChange={setActiveStreamFilter}
        />
      )}

      {/* Mode 2: Combined View - Multiple Stock Analytics Dashboard prominently rendered at the TOP of Dashboard View! */}
      {activeLayoutTab === 'analytics' && dashboardAnalyticsMode === 'all' && (
        <DashboardViewMultipleStockAnalytics
          multipleStockItems={filteredMultipleStockItems}
          onUploadMultipleStockData={onUploadMultipleStockData}
          isSidebarCollapsed={isSidebarCollapsed}
          hideWhenEmpty={false}
          hideUpload={!isAdmin}
          showHighValuationTable={false}
          plantFilter={dashboardPlantFilter}
          onPlantFilterChange={setDashboardPlantFilter}
          groupFilter={dashboardGroupFilter}
          onGroupFilterChange={setDashboardGroupFilter}
          streamFilter={activeStreamFilter}
          onStreamFilterChange={setActiveStreamFilter}
        />
      )}

      {/* Combined View & Master Inventory: Master Inventory Analytics */}
      {activeLayoutTab === 'analytics' && (dashboardAnalyticsMode === 'all' || dashboardAnalyticsMode === 'master') && (
        <DashboardAnalyticsTab
          summary={summary}
          items={filteredItems}
          materialMasterItems={materialMasterItems}
          multipleStockItems={filteredMultipleStockItems}
          receivingRecords={filteredReceivingRecords}
          sohStats={sohStats}
          warehouseReceivedStats={warehouseReceivedStats}
          onNavigateTab={onNavigateTab}
          onFilterStatus={onFilterStatus}
          onOpenSohModal={() => setIsSohModalOpen(true)}
          onOpenNonMovingModal={() => setIsNonMovingModalOpen(true)}
          onOpenWarehouseReceivedModal={() => setIsWarehouseReceivedModalOpen(true)}
          onOpenInstallationModal={(status) => {
            setSelectedInstallationStatus(status || 'all');
            setIsInstallationModalOpen(true);
          }}
          plantFilter={dashboardPlantFilter}
          setPlantFilter={setDashboardPlantFilter}
          groupFilter={dashboardGroupFilter}
          setGroupFilter={setDashboardGroupFilter}
          startDate={dashboardStartDate}
          setStartDate={setDashboardStartDate}
          endDate={dashboardEndDate}
          setEndDate={setDashboardEndDate}
        />
      )}


      {/* Expiry Notification & QA Action Modal */}
      <ExpiryNotificationModal
        selectedItem={selectedExpiryItem}
        onClose={() => setSelectedExpiryItem(null)}
        filteredExpiringItems={filteredExpiringItems}
        expiryFilterDays={expiryFilterDays}
        recipient={expiryEmailRecipient}
        onRecipientChange={setExpiryEmailRecipient}
        note={expiryActionNote}
        onNoteChange={setExpiryActionNote}
        copiedSuccess={expiryCopiedSuccess}
        onCopiedSuccessChange={setExpiryCopiedSuccess}
        onToast={setToastNotification}
      />

      {/* SOH Analysis Modal */}
      <SohModal
        isOpen={isSohModalOpen}
        onClose={() => setIsSohModalOpen(false)}
        items={sohFilteredItems}
        search={sohSearch}
        onSearchChange={setSohSearch}
        branchFilter={sohBranchFilter}
        onBranchChange={setSohBranchFilter}
        rdfFilter={sohRdfFilter}
        onRdfChange={setSohRdfFilter}
        progFilter={sohProgramFilter}
        onProgChange={setSohProgramFilter}
        branchList={sohBranchList}
        rdfList={sohRdfList}
        progList={sohProgramList}
        stats={sohStats}
        onOpenMultiUpload={() => {
          setIsSohModalOpen(false);
          setMultiUploadInitialMode('all');
          setIsMultipleUploadModalOpen(true);
        }}
      />

      {/* Non-Moving Item Analysis Modal */}
      <NonMovingModal
        isOpen={isNonMovingModalOpen}
        onClose={() => setIsNonMovingModalOpen(false)}
        items={items}
        onOpenMultiUpload={() => {
          setIsNonMovingModalOpen(false);
          setMultiUploadInitialMode('nonMoving');
          setIsMultipleUploadModalOpen(true);
        }}
      />

      {/* Warehouse Received Analysis Modal */}
      <WarehouseReceivedModal
        isOpen={isWarehouseReceivedModalOpen}
        onClose={() => setIsWarehouseReceivedModalOpen(false)}
        items={warehouseReceivedFilteredItems}
        receivingRecords={warehouseReceivedFilteredRecords}
        search={warehouseReceivedSearch}
        onSearchChange={setWarehouseReceivedSearch}
        poFilter={warehouseReceivedPoFilter}
        onPoChange={setWarehouseReceivedPoFilter}
        pkgFilter={warehouseReceivedPackageFilter}
        onPkgChange={setWarehouseReceivedPackageFilter}
        rdfFilter={warehouseReceivedRdfFilter}
        onRdfChange={setWarehouseReceivedRdfFilter}
        progFilter={warehouseReceivedProgramFilter}
        onProgChange={setWarehouseReceivedProgramFilter}
        plantFilter={warehouseReceivedPlantFilter}
        onPlantChange={setWarehouseReceivedPlantFilter}
        supplierFilter={warehouseReceivedSupplierFilter}
        onSupplierChange={setWarehouseReceivedSupplierFilter}
        movementFilter={warehouseReceivedMovementFilter}
        onMovementChange={setWarehouseReceivedMovementFilter}
        poList={warehouseReceivedPoNumbers}
        pkgList={warehouseReceivedPackages}
        rdfList={warehouseReceivedRdfNumbers}
        progList={warehouseReceivedPrograms}
        plantList={warehouseReceivedPlants}
        supplierList={warehouseReceivedSuppliers}
        movementList={warehouseReceivedMovements}
        stats={warehouseReceivedStats}
        datePreset={warehouseReceivedDatePreset}
        startDate={warehouseReceivedStartDate}
        endDate={warehouseReceivedEndDate}
        onNavigateToReceivingLedger={() => onNavigateTab('receiving-data')}
      />

      {/* Multiple Data Batch Upload Modal - Admin Only */}
      {isAdmin && onUploadBatches && (
        <MultipleDataUploadModal
          isOpen={isMultipleUploadModalOpen}
          onClose={() => setIsMultipleUploadModalOpen(false)}
          onUploadBatches={(batches) => {
            onUploadBatches(batches);
            setToastNotification(`Successfully imported ${batches.length} data batches for analysis!`);
            setTimeout(() => setToastNotification(null), 5000);
          }}
          onAcceptAndConfirmBatch={(confirmedBatch) => {
            onUploadBatches([], confirmedBatch);
            setToastNotification(`✓ Ingestion Confirmed! Successfully accepted and distributed across each navigation bar.`);
            setTimeout(() => setToastNotification(null), 5000);
          }}
          onAddDocument={onAddDocument}
          existingBatchCount={0}
          initialMode={multiUploadInitialMode}
        />
      )}

      {/* Medical Device Installation Task & Audit Modal */}
      <InstallationTaskModal
        isOpen={isInstallationModalOpen}
        onClose={() => setIsInstallationModalOpen(false)}
        items={items}
        initialStatus={selectedInstallationStatus}
        onNavigateTab={onNavigateTab}
        onFilterStatus={onFilterStatus}
      />

      {/* Toast Notification Overlay */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold">{toastNotification}</span>
          </div>
        </div>
      )}

      {/* Export Charts for Reporting Modal */}
      <ExportChartsModal
        isOpen={isExportChartsModalOpen}
        onClose={() => setIsExportChartsModalOpen(false)}
        activeFilters={{
          timePeriod: dashboardStartDate && dashboardEndDate
            ? `${dashboardStartDate} to ${dashboardEndDate}`
            : dashboardStartDate
            ? `From ${dashboardStartDate}`
            : 'All Time Available',
          programType: 'All Programs (RDF & Health Program)',
          plantHub: dashboardPlantFilter === 'all' || (Array.isArray(dashboardPlantFilter) && dashboardPlantFilter.length === 0) ? 'All EPSS Plants & Hubs' : (Array.isArray(dashboardPlantFilter) ? dashboardPlantFilter.join(', ') : dashboardPlantFilter),
          metricMode: 'Valuation (ETB) & Physical Quantity'
        }}
        stats={receivingStatsForExport}
        defaultTargetId={
          dashboardAnalyticsMode === 'multiple-stock'
            ? 'multiple-stock-charts-container'
            : 'receiving-bar-and-pie-charts-container'
        }
        barChartTargetId={
          dashboardAnalyticsMode === 'multiple-stock'
            ? 'ms-bar-chart-card'
            : 'receiving-bar-chart-card'
        }
        pieChartTargetId={
          dashboardAnalyticsMode === 'multiple-stock'
            ? 'ms-pie-chart-card'
            : 'receiving-pie-chart-card'
        }
      />


      {/* Floating Quick Actions Button */}
    </div>
  );
};

export default DashboardView;
