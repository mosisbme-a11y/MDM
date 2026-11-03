import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Download,
  Printer,
  AlertTriangle,
  Wrench,
  Clock,
  CheckCircle2,
  Calendar,
  Mail,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileSpreadsheet,
  QrCode,
  Building2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  CheckSquare,
  Square,
  MinusSquare,
  RefreshCw,
  Zap,
  Sparkles,
  Layers,
  CheckCheck,
  PlusCircle,
  ShieldAlert,
  Info,
  Settings,
  Eye,
  Package,
  Warehouse,
  Trash2,
  Upload,
  Filter
} from 'lucide-react';

export const SEARCH_COLUMN_OPTIONS = [
  { value: 'all', label: 'All Columns (Global)', placeholder: 'Search across all columns (Description, Material, WBS, Plant)...' },
  { value: 'plant', label: 'Plant Column', placeholder: 'Filter specifically by Plant code or name (e.g. 2001, Central)...' },
  { value: 'status', label: 'Status & Condition', placeholder: 'Filter specifically by Status/Condition (e.g. Defective, Functional)...' },
  { value: 'wbsElement', label: 'WBS Element Column', placeholder: 'Filter specifically by WBS Element (e.g. GF, MOH, ETH)...' },
  { value: 'material', label: 'Material Code Column', placeholder: 'Filter specifically by Material Code (e.g. 1000293)...' },
  { value: 'materialDescription', label: 'Description Column', placeholder: 'Filter specifically by Description (e.g. Ultrasound, Ventilator)...' },
  { value: 'storageLocation', label: 'Storage Location Column', placeholder: 'Filter specifically by Storage Location (e.g. HOM6, Central WH)...' },
  { value: 'batch', label: 'Batch Column', placeholder: 'Filter specifically by Batch number...' },
] as const;

export const COLUMN_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses & Conditions' },
  // Operational
  { value: 'functional', label: '🟢 Operational / Usable' },
  { value: 'defective', label: '🔴 Defective / Breakdown' },
  { value: 'needsSpare', label: '🟣 Needs Spare Parts' },
  { value: 'nonMoving', label: '🟡 Non-Moving Stock' },
  { value: 'lowStock', label: '⚠️ Low Stock (< 5 units)' },
  // Installation
  { value: 'installed', label: '✅ Installed at Assigned Ward' },
  { value: 'pendingInstallation', label: '⏳ Pending Installation' },
  { value: 'underCommissioning', label: '🔧 Under Commissioning' },
  { value: 'siteAssessment', label: '📍 Site Assessment' },
  // Delivery
  { value: 'delivered', label: '🚚 Delivered & Dispatched' },
  { value: 'inTransit', label: '🚛 In Transit' },
  { value: 'clearance', label: '📦 Port Customs Clearance' },
  { value: 'pendingDispatch', label: '📋 Dispatch Pending' },
  // Stock on Hand
  { value: 'stockOnHand', label: '📦 Stock on Hand (Active)' },
  { value: 'outOfStock', label: '🚫 Out of Stock (0 units)' },
];
import { MedicalDeviceItem, PlantSummary } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { DeviceExpandedDetails } from './DeviceExpandedDetails';
import { HFMasterDataRegionalUploadModal } from './HFMasterDataRegionalUploadModal';
import {
  WarehouseStatusFilterModal,
  checkItemMatchesFilters,
  OPERATIONAL_STATUS_OPTIONS
} from './WarehouseStatusFilterModal';
import {
  generateMasterInventorySheetData,
  exportMasterInventoryToCSV,
  exportMasterInventoryToExcel
} from '../utils/masterInventoryExport';

interface InventoryViewProps {
  items: MedicalDeviceItem[];
  plants: PlantSummary[];
  onSelectItem: (item: MedicalDeviceItem) => void;
  onScheduleCalendar: (item: MedicalDeviceItem) => void;
  onSendAlert: (item: MedicalDeviceItem) => void;
  onOpenAddDevice?: () => void;
  onRefresh?: () => void;
  initialFilterStatus?: string;
  onBulkUpdateOperationalStatus?: (
    itemIds: string[],
    newStatus: 'functional' | 'defective' | 'needsSpare' | 'nonMoving' | 'installed' | 'pendingInstallation' | 'underCommissioning' | 'siteAssessment'
  ) => void;
  isAdmin?: boolean;
  onOpenThresholdConfig?: () => void;
  onBulkUpdateRegions?: (mappings: Record<string, string>) => void;
  documents?: any[];
  onAddDocument?: (doc: any) => void;
  onBulkUploadBreakdowns?: (breakdowns: any[]) => void;
  onClearAllData?: () => void;
  onImportExcel?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  plants,
  onSelectItem,
  onScheduleCalendar,
  onSendAlert,
  onOpenAddDevice,
  onRefresh,
  initialFilterStatus = 'all',
  onBulkUpdateOperationalStatus,
  isAdmin,
  onOpenThresholdConfig,
  onBulkUpdateRegions,
  documents,
  onAddDocument,
  onBulkUploadBreakdowns,
  onClearAllData,
  onImportExcel
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Targeted Column Search and Column Filter State
  const [searchColumn, setSearchColumn] = useState<
    'all' | 'plant' | 'status' | 'wbsElement' | 'material' | 'materialDescription' | 'storageLocation' | 'batch'
  >('all');
  const [columnPlantFilter, setColumnPlantFilter] = useState<string>('all');
  const [columnStatusFilter, setColumnStatusFilter] = useState<string>('all');
  const [columnWbsFilter, setColumnWbsFilter] = useState<string>('all');
  const [wbsInputFilter, setWbsInputFilter] = useState<string>('');
  const [columnStorageLocationFilter, setColumnStorageLocationFilter] = useState<string>('all');
  const [isColumnFilterBarExpanded, setIsColumnFilterBarExpanded] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeManufacturer, setActiveManufacturer] = useState<string | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [plantSearchTerm, setPlantSearchTerm] = useState('');
  const [isHubTagsExpanded, setIsHubTagsExpanded] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilterStatus);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedInstallationStatus, setSelectedInstallationStatus] = useState<string>('all');
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<string>('all');
  const [selectedSohStatus, setSelectedSohStatus] = useState<string>('all');
  const [selectedSheetTabFilter, setSelectedSheetTabFilter] = useState<string>('all');
  const [selectedPoFilter, setSelectedPoFilter] = useState<string>('all');
  const [selectedPackageFilter, setSelectedPackageFilter] = useState<string>('all');
  const [selectedRdfFilter, setSelectedRdfFilter] = useState<string>('all');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRegionalUploadOpen, setIsRegionalUploadOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const itemsPerPage = 30;

  // Multi-Select Filter Modal State (Warehouse & Operational Status simultaneously)
  const [isWarehouseStatusModalOpen, setIsWarehouseStatusModalOpen] = useState(false);
  const [multiSelectedWarehouses, setMultiSelectedWarehouses] = useState<string[]>([]);
  const [multiSelectedStatuses, setMultiSelectedStatuses] = useState<string[]>([]);

  // Multi-select & Bulk Action state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<string | null>(null);
  const [bulkActionFeedback, setBulkActionFeedback] = useState<{
    message: string;
    type: 'success' | 'info';
    timestamp: number;
  } | null>(null);
  const [isBulkMoreOpen, setIsBulkMoreOpen] = useState(false);

  // Expandable Row state for inline maintenance & servicing history
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const handleToggleRowExpand = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleExpandAllOnPage = () => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      paginatedItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const handleCollapseAllOnPage = () => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      paginatedItems.forEach((item) => next.delete(item.id));
      return next;
    });
  };

  // Extract unique filter values
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.materialType || 'Uncategorized'))).sort(), [items]);
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.manufacturer && item.manufacturer !== 'Unspecified') {
        set.add(item.manufacturer);
      }
    });
    return Array.from(set).sort();
  }, [items]);
  const warehouses = useMemo(() => Array.from(new Set(items.map(i => i.wh))).sort(), [items]);

  // Extract unique SOH Statuses
  const sohStatuses = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.sohStatus) set.add(item.sohStatus);
    });
    return Array.from(set).sort();
  }, [items]);

  // Extract unique Sheet Tab sources
  const sheetTabSources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.sheetTabSource) set.add(item.sheetTabSource);
    });
    return Array.from(set).sort();
  }, [items]);

  const poNumbers = useMemo(() => Array.from(new Set(items.map(i => i.poNumber).filter(Boolean) as string[])).sort(), [items]);
  const packages = useMemo(() => Array.from(new Set(items.map(i => i.procurementPackage).filter(Boolean) as string[])).sort(), [items]);
  const rdfNumbers = useMemo(() => Array.from(new Set(items.map(i => i.rdfNumber).filter(Boolean) as string[])).sort(), [items]);
  const programs = useMemo(() => Array.from(new Set(items.map(i => i.programName).filter(Boolean) as string[])).sort(), [items]);

  // Distinct Plants with Codes and Names for targeted column filtering
  const distinctPlants = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    items.forEach((item) => {
      const code = item.plant || 'Unknown';
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        const plantObj = plants.find((p: any) => (p.plant || p.code) === code);
        const name = plantObj?.name || item.plantName || code;
        map.set(code, { code, name, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [items, plants]);

  // Distinct WBS Elements for targeted column filtering
  const distinctWbsElements = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.wbsElement && item.wbsElement.trim() !== '') {
        set.add(item.wbsElement.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // Distinct Storage Locations for targeted column filtering
  const distinctStorageLocations = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const loc = item.storageLocation || item.wh;
      if (loc && loc.trim() !== '') {
        set.add(loc.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const isAnyColumnFilterActive =
    searchColumn !== 'all' ||
    columnPlantFilter !== 'all' ||
    columnStatusFilter !== 'all' ||
    columnWbsFilter !== 'all' ||
    wbsInputFilter.trim() !== '' ||
    columnStorageLocationFilter !== 'all';

  const activeColumnFiltersCount = [
    searchColumn !== 'all' ? 1 : 0,
    columnPlantFilter !== 'all' ? 1 : 0,
    columnStatusFilter !== 'all' ? 1 : 0,
    columnWbsFilter !== 'all' ? 1 : 0,
    wbsInputFilter.trim() !== '' ? 1 : 0,
    columnStorageLocationFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearColumnFilters = () => {
    setSearchColumn('all');
    setColumnPlantFilter('all');
    setColumnStatusFilter('all');
    setColumnWbsFilter('all');
    setWbsInputFilter('');
    setColumnStorageLocationFilter('all');
    setCurrentPage(1);
  };

  // Installation status line items & units counts
  const installationCounts = useMemo(() => {
    const counts: Record<string, { lineItems: number; units: number }> = {
      'Installed': { lineItems: 0, units: 0 },
      'Pending Installation': { lineItems: 0, units: 0 },
      'Under Commissioning': { lineItems: 0, units: 0 },
      'Site Assessment': { lineItems: 0, units: 0 }
    };
    items.forEach(item => {
      const status = item.installationStatus || 'Installed';
      if (!counts[status]) counts[status] = { lineItems: 0, units: 0 };
      counts[status].lineItems += 1;
      counts[status].units += (item.qty || 0);
    });
    return counts;
  }, [items]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof MedicalDeviceItem | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const handleSort = (key: keyof MedicalDeviceItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtering
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      // 1. Search (Column-Targeted or Global)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        if (searchColumn === 'plant') {
          const match =
            (item.plant || '').toLowerCase().includes(term) ||
            (item.plantName || '').toLowerCase().includes(term);
          if (!match) return false;
        } else if (searchColumn === 'status') {
          const statusText = [
            item.isNotFunctional ? 'defective non-functional breakdown' : 'functional operational usable',
            item.needsSparePart ? 'needs spare parts' : '',
            item.isNonMoving ? 'non-moving' : '',
            item.installationStatus || '',
            item.deliveryStatus || '',
            item.sohStatus || '',
            (item.qty || 0) < 5 ? 'low stock' : ''
          ].join(' ').toLowerCase();
          if (!statusText.includes(term)) return false;
        } else if (searchColumn === 'wbsElement') {
          if (!(item.wbsElement || '').toLowerCase().includes(term)) return false;
        } else if (searchColumn === 'material') {
          if (!(item.material || '').toLowerCase().includes(term)) return false;
        } else if (searchColumn === 'materialDescription') {
          if (!(item.materialDescription || '').toLowerCase().includes(term)) return false;
        } else if (searchColumn === 'storageLocation') {
          const loc = (item.storageLocation || item.wh || '').toLowerCase();
          if (!loc.includes(term)) return false;
        } else if (searchColumn === 'batch') {
          if (!(item.batch || '').toLowerCase().includes(term)) return false;
        } else {
          // Default: Search across all key columns
          const matchesGlobal =
            (item.materialDescription || '').toLowerCase().includes(term) ||
            (item.material || '').toLowerCase().includes(term) ||
            (item.batch || '').toLowerCase().includes(term) ||
            (item.wbsElement || '').toLowerCase().includes(term) ||
            (item.plant || '').toLowerCase().includes(term) ||
            (item.plantName || '').toLowerCase().includes(term) ||
            (item.storageLocation || item.wh || '').toLowerCase().includes(term);
          if (!matchesGlobal) return false;
        }
      }

      // 2. Specific Column: Plant Filter
      if (columnPlantFilter !== 'all' && item.plant !== columnPlantFilter) {
        return false;
      }

      // 3. Specific Column: Status Filter
      if (columnStatusFilter !== 'all') {
        if (columnStatusFilter === 'functional' && (item.isNotFunctional || item.needsSparePart)) return false;
        if (columnStatusFilter === 'defective' && !item.isNotFunctional) return false;
        if (columnStatusFilter === 'needsSpare' && !item.needsSparePart) return false;
        if (columnStatusFilter === 'nonMoving' && !item.isNonMoving) return false;
        if (columnStatusFilter === 'lowStock' && (item.qty || 0) >= 5) return false;
        if (columnStatusFilter === 'installed' && item.installationStatus !== 'Installed') return false;
        if (columnStatusFilter === 'pendingInstallation' && item.installationStatus !== 'Pending Installation') return false;
        if (columnStatusFilter === 'underCommissioning' && item.installationStatus !== 'Under Commissioning') return false;
        if (columnStatusFilter === 'siteAssessment' && item.installationStatus !== 'Site Assessment') return false;
        if (columnStatusFilter === 'delivered' && item.deliveryStatus !== 'Delivered & Dispatched') return false;
        if (columnStatusFilter === 'inTransit' && item.deliveryStatus !== 'In Transit') return false;
        if (columnStatusFilter === 'clearance' && item.deliveryStatus !== 'Port Customs Clearance') return false;
        if (columnStatusFilter === 'pendingDispatch' && item.deliveryStatus !== 'Dispatch Pending') return false;
        if (columnStatusFilter === 'stockOnHand' && item.sohStatus !== 'Stock on Hand (Active)') return false;
        if (columnStatusFilter === 'outOfStock' && (item.qty || 0) > 0 && item.sohStatus !== 'Out of Stock') return false;
      }

      // 4. Specific Column: WBS Element Filter (Dropdown)
      if (columnWbsFilter !== 'all' && item.wbsElement !== columnWbsFilter) {
        return false;
      }

      // 5. Specific Column: WBS Element Text Query Filter
      if (wbsInputFilter.trim() && !(item.wbsElement || '').toLowerCase().includes(wbsInputFilter.toLowerCase().trim())) {
        return false;
      }

      // 6. Specific Column: Storage Location Filter
      if (columnStorageLocationFilter !== 'all' && item.storageLocation !== columnStorageLocationFilter && item.wh !== columnStorageLocationFilter) {
        return false;
      }

      // Multi-Select Plants / Hubs
      if (selectedPlants.length > 0 && !selectedPlants.includes(item.plant)) {
        return false;
      }

      // Status
      if (statusFilter === 'functional' && (item.isNotFunctional || item.needsSparePart)) {
        return false;
      }
      if (statusFilter === 'defective' && !item.isNotFunctional) {
        return false;
      }
      if (statusFilter === 'needsSpare' && !item.needsSparePart) {
        return false;
      }
      if (statusFilter === 'nonmoving' && !item.isNonMoving) {
        return false;
      }
      if (statusFilter === 'lowStock' && (item.qty || 0) >= 5) {
        return false;
      }
      if (statusFilter === 'requiresInstallation' && item.installationStatus !== 'Not Installed' && (item.installationStatus || 'Installed') !== 'Pending Installation') {
        return false;
      }
      if (statusFilter === 'hasDSP' && !item.hasDSP) {
        return false;
      }
      if ((statusFilter === 'Delivered & Dispatched' || statusFilter === 'receivedWarehouse') && item.deliveryStatus !== 'Delivered & Dispatched') {
        return false;
      }

      // Manufacturer (Dropdown + Pill)
      if (selectedManufacturer !== 'all' && item.manufacturer !== selectedManufacturer) {
        return false;
      }

      // Category
      if (activeCategory && item.materialType !== activeCategory) {
        return false;
      }

      // Warehouse
      if (activeWarehouse && item.wh !== activeWarehouse) {
        return false;
      }

      // Installation Status
      if (selectedInstallationStatus !== 'all' && item.installationStatus !== selectedInstallationStatus) {
        return false;
      }

      // Delivery Status
      if (selectedDeliveryStatus !== 'all' && item.deliveryStatus !== selectedDeliveryStatus) {
        return false;
      }

      // SOH Status Filter
      if (selectedSohStatus !== 'all' && item.sohStatus !== selectedSohStatus) {
        return false;
      }

      // Sheet Tab Source Filter
      if (selectedSheetTabFilter !== 'all' && item.sheetTabSource !== selectedSheetTabFilter) {
        return false;
      }

      // PO Filter
      if (selectedPoFilter !== 'all' && item.poNumber !== selectedPoFilter) {
        return false;
      }

      // Package Filter
      if (selectedPackageFilter !== 'all' && item.procurementPackage !== selectedPackageFilter) {
        return false;
      }

      // RDF Filter
      if (selectedRdfFilter !== 'all' && item.rdfNumber !== selectedRdfFilter) {
        return false;
      }

      // Program Filter
      if (selectedProgramFilter !== 'all' && item.programName !== selectedProgramFilter) {
        return false;
      }

      // Multi-Select Filter Panel (Warehouse & Operational Status simultaneously)
      if (multiSelectedWarehouses.length > 0 || multiSelectedStatuses.length > 0) {
        if (!checkItemMatchesFilters(item, multiSelectedWarehouses, multiSelectedStatuses)) {
          return false;
        }
      }

      return true;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof MedicalDeviceItem];
        const bVal = b[sortConfig.key as keyof MedicalDeviceItem];
        if (aVal === bVal) return 0;
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, searchTerm, searchColumn, columnPlantFilter, columnStatusFilter, columnWbsFilter, wbsInputFilter, columnStorageLocationFilter, selectedPlants, statusFilter, selectedManufacturer, selectedInstallationStatus, selectedDeliveryStatus, selectedSohStatus, selectedSheetTabFilter, selectedPoFilter, selectedPackageFilter, selectedRdfFilter, selectedProgramFilter, sortConfig, activeCategory, activeWarehouse, multiSelectedWarehouses, multiSelectedStatuses]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalValuation = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [filteredItems]);

  const totalQuantity = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.qty, 0);
  }, [filteredItems]);

  const handleTogglePlant = (code: string) => {
    setSelectedPlants((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
    setCurrentPage(1);
  };

  const handleSelectAllPlants = () => {
    setSelectedPlants([]);
    setCurrentPage(1);
  };

  const handleClearAllPlantFilters = () => {
    setSelectedPlants([]);
    setCurrentPage(1);
  };

  // Filtered plant list based on plant search
  const filteredPlantList = useMemo(() => {
    if (!plantSearchTerm.trim()) return plants || [];
    const term = plantSearchTerm.toLowerCase();
    return (plants || []).filter((p: any) => {
      const code = (p.plant || p.code || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [plants, plantSearchTerm]);

  const handleExportCSV = () => {
    exportMasterInventoryToCSV(
      filteredItems,
      `EPSS_Medical_Device_Filtered_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Multi-select helpers
  const isAllPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((item) => selectedItemIds.includes(item.id));
  const isSomePageSelected =
    paginatedItems.some((item) => selectedItemIds.includes(item.id)) && !isAllPageSelected;
  const isAllFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.includes(item.id));

  const handleToggleSelectAllPage = () => {
    const pageIds = paginatedItems.map((item) => item.id);
    if (isAllPageSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredItems.map((item) => item.id);
    setSelectedItemIds(allFilteredIds);
  };

  const handleClearSelection = () => {
    setSelectedItemIds([]);
  };

  const handleBulkUpdateStatus = (
    newStatus:
      | 'functional'
      | 'defective'
      | 'needsSpare'
      | 'nonMoving'
      | 'installed'
      | 'pendingInstallation'
      | 'underCommissioning'
      | 'siteAssessment'
  ) => {
    if (selectedItemIds.length === 0) return;
    if (onBulkUpdateOperationalStatus) {
      onBulkUpdateOperationalStatus(selectedItemIds, newStatus);
    }
    const statusLabels: Record<string, string> = {
      functional: 'Functional / Operational',
      defective: 'Defective / Non-Functional',
      needsSpare: 'Needs Spare Parts',
      nonMoving: 'Non-Moving Stock',
      installed: 'Installed',
      pendingInstallation: 'Pending Installation',
      underCommissioning: 'Under Commissioning',
      siteAssessment: 'Site Assessment'
    };

    setBulkActionFeedback({
      message: `Updated operational status of ${selectedItemIds.length} device(s) to "${statusLabels[newStatus] || newStatus}"`,
      type: 'success',
      timestamp: Date.now()
    });
    setIsBulkMoreOpen(false);

    setTimeout(() => {
      setBulkActionFeedback((prev) =>
        prev && Date.now() - prev.timestamp >= 1400 ? null : prev
      );
    }, 1500);
  };

  const handleExportSelectedCSV = () => {
    const selectedDevices = items.filter((item) => selectedItemIds.includes(item.id));
    if (selectedDevices.length === 0) return;

    exportMasterInventoryToCSV(
      selectedDevices,
      `EPSS_Selected_${selectedDevices.length}_Devices_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const plantFilterLabel = selectedPlants.length === 0
    ? 'All 21 Regional Hubs'
    : `${selectedPlants.length} Hubs Selected (${selectedPlants.join(', ')})`;

  return (
    <div className="space-y-4 pb-12">
      {/* Official Print Header - visible only when printing */}
      <div className="hidden print:block mb-4 p-4 border-b-2 border-slate-900 bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">
              Ethiopian Pharmaceuticals Supply Service (EPSS)
            </h1>
            <h2 className="text-sm font-bold text-slate-700 mt-0.5">
              Medical Device Master Inventory & Inspection Audit Report
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Generated Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Directorate of Medical Device Management
            </p>
          </div>
          <div className="text-right text-[11px]">
            <div className="font-bold text-slate-900">Filter Scope & Criteria</div>
            <div className="text-slate-700 mt-0.5">
              Regional Hubs: <strong>{plantFilterLabel}</strong>
            </div>
            <div className="text-slate-700">
              Condition: <strong>{statusFilter}</strong> • Manufacturer: <strong>{selectedManufacturer}</strong>
            </div>
            <div className="text-slate-700">
              Installation: <strong>{selectedInstallationStatus}</strong> • Delivery: <strong>{selectedDeliveryStatus}</strong>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-3 pt-2.5 border-t border-slate-300 text-xs font-semibold text-slate-800">
          <div>Registered Devices: <span className="font-bold font-mono text-cyan-800">{filteredItems.length.toLocaleString()} Line Items</span></div>
          <div>Total Stock Units: <span className="font-bold font-mono text-emerald-800">{formatNumber(totalQuantity)} Units</span></div>
          <div>Total Valuation: <span className="font-bold font-mono">{formatCurrency(totalValuation, true)}</span></div>
          <div>Audit Period: <span className="font-bold">July 2026 Master Data</span></div>
        </div>
      </div>

      {/* Collapsible Status Legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden print:hidden transition-all">
        <button
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Interactive Status Legend (Clinical Standards)
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              • Quick reference guide for device indicators
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <span>{isLegendOpen ? 'Hide' : 'Show Legend'}</span>
            {isLegendOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {isLegendOpen && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px]">
            {/* Operational Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Operational Status
              </h4>
              <div className="grid grid-cols-1 gap-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] w-[95px] justify-center shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Functional
                  </span>
                  <span>Device is fully active, tested, and running in healthcare facility.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] w-[95px] justify-center shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5" /> Defective
                  </span>
                  <span>Requires immediate technical repair or decommissioning.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] w-[95px] justify-center shrink-0">
                    <Wrench className="w-2.5 h-2.5" /> Needs Spare
                  </span>
                  <span>Awaiting parts/materials from bio-medical engineering team.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] w-[95px] justify-center shrink-0">
                    <Clock className="w-2.5 h-2.5" /> Non-Moving
                  </span>
                  <span>Static stock stored without deployment for an extended period.</span>
                </div>
              </div>
            </div>

            {/* Installation Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Installation Status
              </h4>
              <div className="grid grid-cols-1 gap-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] w-[110px] justify-center shrink-0 border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Installed
                  </span>
                  <span>Successfully set up and configured at the assigned ward.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[9px] w-[110px] justify-center shrink-0 border border-amber-200">
                    <Clock className="w-2.5 h-2.5" /> Pending Inst.
                  </span>
                  <span>Awaiting field engineer deployment to clinical location.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[9px] w-[110px] justify-center shrink-0 border border-blue-200">
                    <Wrench className="w-2.5 h-2.5" /> Commissioning
                  </span>
                  <span>Actively undergoing calibration, test loops, and safe start-up.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-red-100 text-red-800 text-[9px] w-[110px] justify-center shrink-0 border border-red-200">
                    <AlertTriangle className="w-2.5 h-2.5" /> Not Installed
                  </span>
                  <span>Still crated or stored without any physical assembly.</span>
                </div>
              </div>
            </div>

            {/* Delivery Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Delivery Status
              </h4>
              <div className="grid grid-cols-1 gap-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] w-[115px] justify-center shrink-0 border border-emerald-200">
                    Delivered
                  </span>
                  <span>Arrived safely and signed off at regional warehouse or facility.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[9px] w-[115px] justify-center shrink-0 border border-blue-200">
                    In Transit
                  </span>
                  <span>On freight trucks dispatched between central and regional hubs.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[9px] w-[115px] justify-center shrink-0 border border-amber-200">
                    Port Clearance
                  </span>
                  <span>Awaiting customs control, import taxes, or regulatory releases.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[9px] w-[115px] justify-center shrink-0 border border-purple-200">
                    Pending Dispatch
                  </span>
                  <span>Held in central medical stockpile waiting for dispatch orders.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Header Bar (Screen only) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5 print:hidden">
        {/* Quick Triage Chips & Multi-Select Filter Modal Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Quick Triage:</span>
            {[
              { id: 'all', label: 'All Items', icon: Package, color: 'slate' },
              { id: 'lowStock', label: 'Urgent/Low Stock', icon: AlertTriangle, color: 'rose' },
              { id: 'requiresInstallation', label: 'Requires Installation', icon: Wrench, color: 'amber' },
              { id: 'defective', label: 'Defective / Faulty', icon: ShieldAlert, color: 'purple' },
            ].map((chip) => {
              const isActive = statusFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => {
                    setStatusFilter(chip.id);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
                    isActive
                      ? chip.color === 'rose' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' :
                        chip.color === 'amber' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' :
                        chip.color === 'purple' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' :
                        'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <chip.icon className={`w-3 h-3 ${isActive ? 'text-white' : 
                    chip.color === 'rose' ? 'text-rose-500' :
                    chip.color === 'amber' ? 'text-amber-500' :
                    chip.color === 'purple' ? 'text-purple-500' : 'text-slate-400'}`} />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dedicated Multi-Select Filter Panel Trigger Button */}
          <button
            type="button"
            onClick={() => setIsWarehouseStatusModalOpen(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              multiSelectedWarehouses.length > 0 || multiSelectedStatuses.length > 0
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white border-transparent shadow-sm ring-2 ring-cyan-500/20'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/60'
            }`}
            title="Open multi-select filter panel for Warehouse and Operational Status simultaneously"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
            <span>Multi-Filter: Warehouse & Status</span>
            {multiSelectedWarehouses.length > 0 || multiSelectedStatuses.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-white text-indigo-700 text-[10px] font-black shadow-xs">
                {multiSelectedWarehouses.length + multiSelectedStatuses.length} Active
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded bg-slate-200/70">
                Modal
              </span>
            )}
          </button>
        </div>

        {/* Active Multi-Select Filters Bar (displays chips for selected warehouses and operational statuses) */}
        {(multiSelectedWarehouses.length > 0 || multiSelectedStatuses.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-gradient-to-r from-cyan-50/90 via-indigo-50/50 to-slate-50 border border-cyan-200/80 rounded-xl text-xs animate-in fade-in duration-200">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
              <span>Simultaneous Multi-Filters:</span>
            </span>

            {/* Warehouse Chips */}
            {multiSelectedWarehouses.map((wh) => (
              <span
                key={wh}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold text-[11px] shadow-2xs"
              >
                <Warehouse className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate max-w-[150px]">{wh}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMultiSelectedWarehouses((prev) => prev.filter((w) => w !== wh));
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-600 text-slate-400 ml-0.5 cursor-pointer"
                  title="Remove this warehouse filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Operational Status Chips */}
            {multiSelectedStatuses.map((st) => {
              const opt = OPERATIONAL_STATUS_OPTIONS.find((o) => o.id === st);
              return (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-cyan-200 text-cyan-900 font-semibold text-[11px] shadow-2xs"
                >
                  <CheckCircle2 className="w-3 h-3 text-cyan-600 shrink-0" />
                  <span>{opt?.label || st}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMultiSelectedStatuses((prev) => prev.filter((s) => s !== st));
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-0.5 cursor-pointer"
                    title="Remove this status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsWarehouseStatusModalOpen(true)}
                className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer"
              >
                Edit in Modal
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  setMultiSelectedWarehouses([]);
                  setMultiSelectedStatuses([]);
                  setCurrentPage(1);
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
              >
                Clear Multi-Filters
              </button>
            </div>
          </div>
        )}

        {/* Interactive Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-slate-500 self-center mr-1">Category:</span>
          {categories.slice(0, 8).map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(activeCategory === c ? null : c)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${activeCategory === c ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {c}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-500 self-center ml-2 mr-1">Manufacturer:</span>
          {manufacturers.slice(0, 8).map(m => (
            <button
              key={m}
              onClick={() => setSelectedManufacturer(selectedManufacturer === m ? 'all' : m)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${selectedManufacturer === m ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {m}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-500 self-center ml-2 mr-1">Warehouse:</span>
          {warehouses.slice(0, 8).map(w => (
            <button
              key={w}
              onClick={() => setActiveWarehouse(activeWarehouse === w ? null : w)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${activeWarehouse === w ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Targeted Column Search & Filter Bar Container */}
        <div id="inventory-targeted-filter-bar" className="bg-gradient-to-r from-slate-50 via-cyan-50/20 to-indigo-50/20 rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
          {/* Header Row: Title, Filter Active Badge, Reset and Collapse Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <span>Targeted Column Search & Filters</span>
                  </h3>
                  {isAnyColumnFilterActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-2xs animate-in fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{activeColumnFiltersCount} {activeColumnFiltersCount === 1 ? 'Filter' : 'Filters'} Active</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      Targeted Analysis Bar
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-slate-500 hidden md:inline">
                    • Filter device list by specific columns like Plant, Status, or WBS Element
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isAnyColumnFilterActive && (
                <button
                  type="button"
                  onClick={handleClearColumnFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-2xs"
                  title="Reset all targeted column filters and column search scope"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Column Filters</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsColumnFilterBarExpanded(!isColumnFilterBarExpanded)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs"
                title={isColumnFilterBarExpanded ? 'Collapse column filters panel' : 'Expand column filters panel'}
              >
                <span>{isColumnFilterBarExpanded ? 'Hide Filter Controls' : 'Show Filter Controls'}</span>
                {isColumnFilterBarExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Search Row: Column Scope Selector & Dynamic Search Input */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            <div className="flex flex-1 items-stretch gap-1.5 min-w-0">
              {/* Column Scope Selector */}
              <div className="relative shrink-0 flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500">
                <Filter className="w-3.5 h-3.5 text-cyan-600 mr-1.5 shrink-0" />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Search In:</span>
                <select
                  value={searchColumn}
                  onChange={(e) => {
                    setSearchColumn(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-1"
                  title="Select specific column to search in"
                >
                  {SEARCH_COLUMN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* The Text Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={
                    SEARCH_COLUMN_OPTIONS.find((opt) => opt.value === searchColumn)?.placeholder ||
                    'Search device list...'
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition shadow-2xs placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Column-Specific Quick Filters (Plant, Status, WBS Element, Storage Location) */}
          {isColumnFilterBarExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80">
              {/* 1. PLANT COLUMN FILTER */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-cyan-600" />
                    <span>Plant Column</span>
                  </label>
                  {columnPlantFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setColumnPlantFilter('all');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={columnPlantFilter}
                  onChange={(e) => {
                    setColumnPlantFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium truncate ${
                    columnPlantFilter !== 'all'
                      ? 'bg-cyan-50/80 border-cyan-400 text-cyan-950 font-bold'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="all">All Plants ({distinctPlants.length} Hubs)</option>
                  {distinctPlants.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} - {p.name} ({p.count} devices)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. STATUS COLUMN FILTER */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Status & Condition</span>
                  </label>
                  {columnStatusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setColumnStatusFilter('all');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={columnStatusFilter}
                  onChange={(e) => {
                    setColumnStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium truncate ${
                    columnStatusFilter !== 'all'
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700'
                  }`}
                >
                  {COLUMN_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. WBS ELEMENT COLUMN FILTER */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-600" />
                    <span>WBS Element Column</span>
                  </label>
                  {(columnWbsFilter !== 'all' || wbsInputFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setColumnWbsFilter('all');
                        setWbsInputFilter('');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <select
                    value={columnWbsFilter}
                    onChange={(e) => {
                      setColumnWbsFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium truncate ${
                      columnWbsFilter !== 'all'
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold'
                        : 'bg-slate-50/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="all">
                      {distinctWbsElements.length > 0
                        ? `All WBS Elements (${distinctWbsElements.length} unique)`
                        : 'All WBS Elements'}
                    </option>
                    {distinctWbsElements.map((wbs) => (
                      <option key={wbs} value={wbs}>
                        {wbs}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type WBS code (e.g. GF, MOH)..."
                    value={wbsInputFilter}
                    onChange={(e) => {
                      setWbsInputFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`w-full py-1 px-2 text-[11px] rounded-md border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      wbsInputFilter ? 'bg-indigo-50/60 border-indigo-300 font-semibold' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* 4. STORAGE LOCATION COLUMN FILTER */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Warehouse className="w-3 h-3 text-amber-600" />
                    <span>Storage Location / WH</span>
                  </label>
                  {columnStorageLocationFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setColumnStorageLocationFilter('all');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={columnStorageLocationFilter}
                  onChange={(e) => {
                    setColumnStorageLocationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium truncate ${
                    columnStorageLocationFilter !== 'all'
                      ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="all">All Locations ({distinctStorageLocations.length} locations)</option>
                  {distinctStorageLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Active Targeted Filters Ribbon */}
          {isAnyColumnFilterActive && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80 text-[11px] animate-in fade-in duration-200">
              <span className="font-extrabold text-slate-700 flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3 text-cyan-600" />
                <span>Active Column Filters:</span>
              </span>

              {searchColumn !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-cyan-300 text-cyan-900 font-bold shadow-2xs">
                  <span>Scope: {SEARCH_COLUMN_OPTIONS.find((o) => o.value === searchColumn)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchColumn('all');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Reset search scope to All Columns"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {columnPlantFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-cyan-300 text-cyan-950 font-bold shadow-2xs">
                  <Building2 className="w-3 h-3 text-cyan-600" />
                  <span>Plant: {columnPlantFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnPlantFilter('all');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Remove plant filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {columnStatusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-950 font-bold shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Status: {COLUMN_STATUS_OPTIONS.find((o) => o.value === columnStatusFilter)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnStatusFilter('all');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Remove status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {columnWbsFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-950 font-bold shadow-2xs">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>WBS: {columnWbsFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnWbsFilter('all');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Remove WBS filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {wbsInputFilter.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-950 font-bold shadow-2xs">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>WBS Query: "{wbsInputFilter.trim()}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWbsInputFilter('');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Clear WBS query"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {columnStorageLocationFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-950 font-bold shadow-2xs">
                  <Warehouse className="w-3 h-3 text-amber-600" />
                  <span>Location: {columnStorageLocationFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnStorageLocationFilter('all');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 text-slate-400 ml-1 cursor-pointer"
                    title="Remove storage location filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <span className="text-[11px] text-slate-500 font-semibold ml-auto flex items-center gap-1">
                Targeted Match: <strong className="text-slate-900 font-bold">{filteredItems.length} devices</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:block">
            Quick Actions & Utilities:
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {onOpenAddDevice && isAdmin && (
              <button
                onClick={onOpenAddDevice}
                title="Add new medical equipment or stock on hand device"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg transition cursor-pointer shadow-sm hover:shadow"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-100" />
                <span>+ Add Stock Device</span>
              </button>
            )}

            {isAdmin && onBulkUpdateRegions && (
              <button
                onClick={() => setIsRegionalUploadOpen(true)}
                title="HF MASTER DATA: Bulk regional mapping tool to upload multiple region names in one transaction"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-700 to-indigo-700 hover:from-cyan-600 hover:to-indigo-600 rounded-lg transition cursor-pointer shadow-sm hover:shadow"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-100" />
                <span>HF MASTER DATA: Bulk Regions</span>
              </button>
            )}

            <button
              onClick={() => setIsScannerOpen(true)}
              title="Lookup Medical Device Barcode, QR Code, Tag Image or Material ID"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 rounded-lg transition cursor-pointer shadow-sm hover:shadow"
            >
              <QrCode className="w-3.5 h-3.5 text-white" />
              <span>Scan Barcode / QR</span>
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Force refresh data from Google Sheets (Auto-Syncs all 11 standardized EPSS tabs)"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-600" />
                <span>Refresh Data</span>
              </button>
            )}

            {onImportExcel && (
              <label
                title="Import & Update EPSS Master Medical Device Inventory from Excel or CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Import Update (Excel/CSV)</span>
                <input
                  type="file"
                  onChange={onImportExcel}
                  accept=".xlsx,.xls,.csv,.ods"
                  className="sr-only"
                />
              </label>
            )}

            {onClearAllData && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all EPSS Master Medical Device Inventory data from the system? You can import an updated spreadsheet afterwards.')) {
                    onClearAllData();
                  }
                }}
                title="Clear all EPSS Master Medical Device Inventory data from system"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Master Inventory</span>
              </button>
            )}

            <button
              onClick={() => {
                exportMasterInventoryToExcel(
                  filteredItems,
                  `EPSS_Medical_Device_Filtered_${new Date().toISOString().slice(0, 10)}.xlsx`
                );
              }}
              title="Export currently filtered view to Excel based on imported columns and real data"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Export (Excel)</span>
            </button>

            <button
              onClick={handlePrint}
              title="Print formatted paper audit report of current filtered inventory"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Report</span>
            </button>

            {onOpenThresholdConfig && (
              <button
                onClick={onOpenThresholdConfig}
                title="Configure Custom Low Stock Category Thresholds"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5 text-cyan-600" />
                <span>Threshold Limits</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV ({filteredItems.length})</span>
            </button>
          </div>
        </div>

        {/* Multi-Select Regional Hub Tag Interface */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Regional Hub Locations
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {selectedPlants.length === 0 ? `All ${plants.length} Hubs Active` : `${selectedPlants.length} of ${plants.length} Selected`}
                </span>
              </div>
            </div>

            {/* Quick Actions for Hub Tags */}
            <div className="flex items-center gap-2">
              {/* Mini search inside hubs */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter hub tags..."
                  value={plantSearchTerm}
                  onChange={(e) => setPlantSearchTerm(e.target.value)}
                  className="pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 w-32 sm:w-40"
                />
              </div>

              <button
                onClick={handleSelectAllPlants}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition cursor-pointer ${
                  selectedPlants.length === 0
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Hubs
              </button>

              {selectedPlants.length > 0 && (
                <button
                  onClick={handleClearAllPlantFilters}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition cursor-pointer"
                >
                  Clear ({selectedPlants.length})
                </button>
              )}

              <button
                onClick={() => setIsHubTagsExpanded(!isHubTagsExpanded)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition cursor-pointer flex items-center gap-0.5"
                title={isHubTagsExpanded ? 'Collapse hub tags' : 'Expand hub tags'}
              >
                <span>{isHubTagsExpanded ? 'Collapse' : 'Expand'}</span>
                {isHubTagsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Tag Chips Container */}
          {isHubTagsExpanded && (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/70 rounded-xl border border-slate-200/80">
              {/* All Hubs Tag Chip */}
              <button
                onClick={handleSelectAllPlants}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  selectedPlants.length === 0
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {selectedPlants.length === 0 && <Check className="w-3 h-3 text-cyan-400" />}
                <span>All {plants.length} Regional Hubs</span>
              </button>

              {/* Individual Hub Tags */}
              {filteredPlantList.map((p: any) => {
                const code = p.plant || p.code || 'OTHER';
                const isSelected = selectedPlants.includes(code);
                const rawName = p.name || '';
                const cleanName = rawName
                  .replace(' Regional Hub', '')
                  .replace(' Central Hub', '')
                  .replace(' Hub', '');

                return (
                  <button
                    key={code}
                    onClick={() => handleTogglePlant(code)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold border border-cyan-600 shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-900'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 text-white shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-cyan-500 shrink-0" />
                    )}
                    <span className="font-mono">{code}</span>
                    <span className="font-normal text-[11px] opacity-90">{cleanName}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-cyan-800/60 text-cyan-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.itemsCount || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Selected Tags Summary Ribbon */}
          {selectedPlants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Tag className="w-3 h-3 text-cyan-600" /> Active Hubs ({selectedPlants.length}):
              </span>
              {selectedPlants.map((code) => {
                const plantObj = plants.find((p: any) => (p.plant || p.code) === code);
                const label = plantObj?.name ? plantObj.name.replace(' Regional Hub', '').replace(' Central Hub', '') : code;
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-900 border border-cyan-200 font-semibold"
                  >
                    <span>{code} - {label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlant(code);
                      }}
                      className="hover:text-rose-600 transition cursor-pointer"
                      title={`Remove ${code}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              <button
                onClick={handleClearAllPlantFilters}
                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Secondary Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Additional Filters:</span>
          </div>

          {/* Dedicated Sort Dropdown for Quick Triage */}
          <div className="flex items-center gap-1">
            <select
              value={sortConfig.key ? `${String(sortConfig.key)}-${sortConfig.direction}` : 'none'}
              onChange={(e) => {
                if (e.target.value === 'none') {
                  setSortConfig({ key: null, direction: 'asc' });
                } else {
                  const [key, direction] = e.target.value.split('-') as [keyof MedicalDeviceItem, 'asc' | 'desc'];
                  setSortConfig({ key, direction });
                }
                setCurrentPage(1);
              }}
              className="bg-cyan-50/80 border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-cyan-950 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="none">⇅ Default Order (No Sort)</option>
              <option value="qty-desc">Quantity: High to Low (Priority)</option>
              <option value="qty-asc">Quantity: Low to High (Restock)</option>
              <option value="totalAmount-desc">Valuation: High to Low (Capital)</option>
              <option value="materialDescription-asc">Description: A to Z</option>
              <option value="materialDescription-desc">Description: Z to A</option>
              <option value="sohStatus-asc">SOH Status: A to Z</option>
              <option value="installationStatus-asc">Installation Status: A to Z</option>
              <option value="plant-asc">Plant & WH: A to Z</option>
            </select>
          </div>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Equipment Conditions</option>
            <option value="functional">Usable / Operational Only</option>
            <option value="defective">Defective / Non-Functional</option>
            <option value="needsSpare">Needs Spare Parts</option>
            <option value="nonmoving">Non-Moving Stock</option>
            <option value="hasDSP">DSP Active Delivery</option>
          </select>

          {/* Manufacturer Selector */}
          <select
            value={selectedManufacturer}
            onChange={(e) => {
              setSelectedManufacturer(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-xs truncate"
          >
            <option value="all">All Manufacturers ({manufacturers.length})</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Installation Status Selector */}
          <select
            value={selectedInstallationStatus}
            onChange={(e) => {
              setSelectedInstallationStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Installation Statuses ({items.length} line items)</option>
            {Object.entries(installationCounts)
              
              .map(([status, counts]) => (
                <option key={status} value={status}>
                  {status} ({counts.lineItems} line items • {formatNumber(counts.units)} units)
                </option>
            ))}
          </select>

          {/* Delivery Status Selector */}
          <select
            value={selectedDeliveryStatus}
            onChange={(e) => {
              setSelectedDeliveryStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Delivery Statuses</option>
            <option value="Delivered & Dispatched">Delivered & Dispatched</option>
            <option value="In Transit">In Transit</option>
            <option value="Port Customs Clearance">Port Customs Clearance</option>
            <option value="Dispatch Pending">Dispatch Pending</option>
          </select>

          {/* SOH Status Selector */}
          <select
            value={selectedSohStatus}
            onChange={(e) => {
              setSelectedSohStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-emerald-50/80 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All SOH Statuses</option>
            <option value="Stock on Hand (Active)">Stock on Hand (Active)</option>
            <option value="Low Stock">Low Stock (&lt; 5 units)</option>
            <option value="Out of Stock">Out of Stock (0 units)</option>
            <option value="Defective">Defective / Breakdown</option>
            <option value="Needs Spare Parts">Needs Spare Parts</option>
            <option value="Non-Moving Stock">Non-Moving Stock</option>
            {sohStatuses
              .filter(s => !['Stock on Hand (Active)', 'Low Stock', 'Out of Stock', 'Defective', 'Needs Spare Parts', 'Non-Moving Stock'].includes(s))
              .map(s => (
                <option key={s} value={s}>{s}</option>
              ))
            }
          </select>

          {/* PO Filter */}
          <select
            value={selectedPoFilter}
            onChange={(e) => {
              setSelectedPoFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[120px] truncate"
          >
            <option value="all">All POs ({poNumbers.length})</option>
            {poNumbers.map((po) => (
              <option key={po} value={po}>{po}</option>
            ))}
          </select>

          {/* Package Filter */}
          <select
            value={selectedPackageFilter}
            onChange={(e) => {
              setSelectedPackageFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[120px] truncate"
          >
            <option value="all">All Packages ({packages.length})</option>
            {packages.map((pkg) => (
              <option key={pkg} value={pkg}>{pkg}</option>
            ))}
          </select>

          {/* RDF Filter */}
          <select
            value={selectedRdfFilter}
            onChange={(e) => {
              setSelectedRdfFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[120px] truncate"
          >
            <option value="all">All RDFs ({rdfNumbers.length})</option>
            {rdfNumbers.map((rdf) => (
              <option key={rdf} value={rdf}>{rdf}</option>
            ))}
          </select>

          {/* Program Filter */}
          <select
            value={selectedProgramFilter}
            onChange={(e) => {
              setSelectedProgramFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[120px] truncate"
          >
            <option value="all">All Programs ({programs.length})</option>
            {programs.map((prog) => (
              <option key={prog} value={prog}>{prog}</option>
            ))}
          </select>

          {/* Sheet Tab Source Selector */}
          {sheetTabSources.length > 1 && (
            <div className="flex items-center gap-1">
              <select
                value={selectedSheetTabFilter}
                onChange={(e) => {
                  setSelectedSheetTabFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Sheet Tabs ({sheetTabSources.length} tabs)</option>
                {sheetTabSources.map((tab) => (
                  <option key={tab} value={tab}>Tab: {tab}</option>
                ))}
              </select>
              {selectedSheetTabFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSheetTabFilter('all');
                    setCurrentPage(1);
                  }}
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[11px] font-semibold px-2 py-1 rounded-md transition cursor-pointer"
                  title="Auto-select all sheet tabs"
                >
                  All Tabs
                </button>
              )}
            </div>
          )}

          {(selectedPlants.length > 0 || statusFilter !== 'all' || selectedManufacturer !== 'all' || selectedInstallationStatus !== 'all' || selectedDeliveryStatus !== 'all' || selectedSohStatus !== 'all' || selectedSheetTabFilter !== 'all' || searchTerm || multiSelectedWarehouses.length > 0 || multiSelectedStatuses.length > 0 || isAnyColumnFilterActive) && (
            <button
              onClick={() => {
                setSelectedPlants([]);
                setStatusFilter('all');
                setSelectedManufacturer('all');
                setSelectedInstallationStatus('all');
                setSelectedDeliveryStatus('all');
                setSelectedSohStatus('all');
                setSelectedSheetTabFilter('all');
                setMultiSelectedWarehouses([]);
                setMultiSelectedStatuses([]);
                setSearchTerm('');
                setPlantSearchTerm('');
                handleClearColumnFilters();
                setCurrentPage(1);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-auto cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Operational Actions Toolbar (when items are selected) */}
      {selectedItemIds.length > 0 && isAdmin && (
        <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-3.5 shadow-lg border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">
                  {selectedItemIds.length} {selectedItemIds.length === 1 ? 'Device' : 'Devices'} Selected
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                  {items.filter((i) => selectedItemIds.includes(i.id)).reduce((acc, curr) => acc + (curr.qty || 0), 0).toLocaleString()} Units
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                {!isAllFilteredSelected && filteredItems.length > selectedItemIds.length && (
                  <>
                    <button
                      onClick={handleSelectAllFiltered}
                      className="text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                    >
                      Select all {filteredItems.length} matched devices
                    </button>
                    <span>•</span>
                  </>
                )}
                <button
                  onClick={handleClearSelection}
                  className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Deselect all
                </button>
              </div>
            </div>
          </div>

          {/* Quick One-Click Bulk Operational Status Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden xl:inline mr-1">
              Bulk Status:
            </span>

            {/* 🟢 Set Functional */}
            <button
              onClick={() => setPendingBulkStatus('functional')}
              title="Set selected devices as Functional / Approved"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Functional</span>
            </button>

            {/* 🔴 Set Defective */}
            <button
              onClick={() => setPendingBulkStatus('defective')}
              title="Set selected devices as Defective / Breakdown"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Defective</span>
            </button>

            {/* 🟣 Set Needs Spare */}
            <button
              onClick={() => setPendingBulkStatus('needsSpare')}
              title="Set selected devices as Needs Spare Parts"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Needs Spare</span>
            </button>

            {/* 🟡 Toggle Non-Moving */}
            <button
              onClick={() => setPendingBulkStatus('nonMoving')}
              title="Toggle Non-Moving stock flag for selected devices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Non-Moving</span>
            </button>

            {/* More Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setIsBulkMoreOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>More</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isBulkMoreOpen && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white text-slate-800 shadow-2xl border border-slate-200 py-1.5 z-40 text-xs animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Bulk Installation Status
                  </div>
                  <button
                    onClick={() => setPendingBulkStatus('installed')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Set as "Installed"</span>
                  </button>
                  <button
                    onClick={() => setPendingBulkStatus('pendingInstallation')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium text-amber-700"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Set as "Pending Installation"</span>
                  </button>
                  <button
                    onClick={() => setPendingBulkStatus('underCommissioning')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium text-blue-700"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Set as "Under Commissioning"</span>
                  </button>
                  <button
                    onClick={() => setPendingBulkStatus('siteAssessment')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium text-purple-700"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Set as "Site Assessment"</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Selection Actions
                  </div>
                  <button
                    onClick={() => {
                      handleExportSelectedCSV();
                      setIsBulkMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium text-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export Selected to CSV ({selectedItemIds.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      handleClearSelection();
                      setIsBulkMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Selection</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Feedback Notification Toast */}
      {bulkActionFeedback && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-1 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bulkActionFeedback.message}</span>
          </div>
          <button
            onClick={() => setBulkActionFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Aggregate Stats Strip (Screen only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500 print:hidden">
        <div className="flex items-center gap-3">
          <div>
            Showing <strong>{Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}</strong> -{' '}
            <strong>{Math.min(filteredItems.length, currentPage * itemsPerPage)}</strong> of{' '}
            <strong>{filteredItems.length.toLocaleString()}</strong> matched devices
          </div>

          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-3">
            {expandedRowIds.size > 0 ? (
              <button
                type="button"
                onClick={handleCollapseAllOnPage}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                title="Collapse all expanded device rows on this page"
              >
                <ChevronUp className="w-3 h-3 text-slate-500" />
                <span>Collapse Page ({expandedRowIds.size})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExpandAllOnPage}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-cyan-50 hover:border-cyan-300 text-[11px] font-semibold text-slate-700 hover:text-cyan-800 transition cursor-pointer shadow-2xs"
                title="Expand all device rows on this page to view maintenance & servicing details inline"
              >
                <ChevronDown className="w-3 h-3 text-cyan-600" />
                <span>Expand All on Page</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span>
            Matched Stock: <strong>{formatNumber(totalQuantity)} Units</strong>
          </span>
          <span>
            Valuation: <strong className="text-slate-900 font-mono">{formatCurrency(totalValuation, true)}</strong>
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="py-3 px-3 w-10 text-center print:hidden">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllPage}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 transition cursor-pointer flex items-center justify-center mx-auto"
                    title={isAllPageSelected ? 'Deselect page' : 'Select all on page'}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-cyan-600" />
                    ) : isSomePageSelected ? (
                      <MinusSquare className="w-4 h-4 text-cyan-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 w-14 text-center">#</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3">Material Description</th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>Plant</span>
                    {(columnPlantFilter !== 'all' || searchColumn === 'plant') && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200 uppercase tracking-tighter" title={`Filtered by Plant: ${columnPlantFilter}`}>
                        Filtered
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>Storage Location</span>
                    {(columnStorageLocationFilter !== 'all' || searchColumn === 'storageLocation') && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-tighter" title={`Filtered by Location: ${columnStorageLocationFilter}`}>
                        Filtered
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">Special Stock Type</th>
                <th className="py-3 px-3 text-right">Unrestricted Stock</th>
                <th className="py-3 px-3 text-right">Stock in Quality Inspection</th>
                <th className="py-3 px-3 text-right">Blocked Stock</th>
                <th className="py-3 px-3 text-right">Current Value of Unrestricted Stock</th>
                <th className="py-3 px-3">Inventory Valuation Type</th>
                <th className="py-3 px-3">Material Group Name</th>
                <th className="py-3 px-3 text-right">Value of Blocked Stock</th>
                <th className="py-3 px-3 text-right">Value of Stock in Quality Inspection</th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>WBS Element</span>
                    {(columnWbsFilter !== 'all' || wbsInputFilter || searchColumn === 'wbsElement') && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-tighter" title={`Filtered by WBS: ${columnWbsFilter || wbsInputFilter}`}>
                        Filtered
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Cloud Sync</th>
                <th className="py-3 px-3 text-center print:hidden">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Actions</span>
                    {(columnStatusFilter !== 'all' || searchColumn === 'status') && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-tighter" title={`Filtered by Status: ${columnStatusFilter}`}>
                        Filtered
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Screen Body (Paginated) */}
            <tbody className="divide-y divide-slate-100 print:hidden">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto text-center px-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-800 text-sm">
                        {items.length === 0
                          ? 'EPSS Master Medical Device Inventory is Cleared'
                          : 'No medical devices found matching the selected filters'}
                      </span>
                      <span className="text-xs text-slate-500 leading-relaxed">
                        {items.length === 0
                          ? 'The system is ready for your update. Import your updated Excel or CSV spreadsheet to populate the master inventory and Multiple Stock ledger.'
                          : 'Try resetting your targeted column filters, search scope, or adjusting plant/status criteria.'}
                      </span>
                      {isAnyColumnFilterActive && (
                        <button
                          type="button"
                          onClick={handleClearColumnFilters}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition shadow-2xs"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reset Targeted Column Filters ({activeColumnFiltersCount})</span>
                        </button>
                      )}
                      {onImportExcel && (
                        <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition shadow-xs">
                          <Upload className="w-4 h-4" />
                          <span>Import Update (Excel / CSV)</span>
                          <input
                            type="file"
                            onChange={onImportExcel}
                            accept=".xlsx,.xls,.csv,.ods"
                            className="sr-only"
                          />
                        </label>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  const isLowStock = item.qty < 5;
                  const isSelected = selectedItemIds.includes(item.id);
                  const isExpanded = expandedRowIds.has(item.id);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => handleToggleRowExpand(item.id)}
                        className={`transition cursor-pointer group ${
                          isExpanded
                            ? 'bg-cyan-50/70 border-l-4 border-l-cyan-600'
                            : isSelected
                            ? 'bg-cyan-50/90 hover:bg-cyan-100/80 border-l-4 border-l-cyan-600'
                            : isLowStock
                            ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3 text-center print:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectItem(item.id);
                            }}
                            className="p-1 rounded hover:bg-slate-200 transition cursor-pointer flex items-center justify-center mx-auto"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleRowExpand(item.id, e)}
                              className={`p-0.5 rounded transition cursor-pointer ${
                                isExpanded
                                  ? 'text-cyan-700 bg-cyan-100'
                                  : 'text-slate-400 hover:text-cyan-600 hover:bg-slate-200'
                              }`}
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                            <span className="text-xs">{globalIndex}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900">{item.material}</td>
                        <td className="py-3 px-3">{item.materialDescription}</td>
                        <td className="py-3 px-3">{item.plant}</td>
                        <td className="py-3 px-3">{item.storageLocation || '-'}</td>
                        <td className="py-3 px-3">{item.specialStockType || '-'}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(item.qty)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(item.stockInQualityInspection || 0)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(item.blockedStock || 0)}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(item.currentValueOfUnrestrictedStock || 0)}</td>
                        <td className="py-3 px-3">{item.inventoryValuationType || '-'}</td>
                        <td className="py-3 px-3">{item.materialGroupName || '-'}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(item.valueOfBlockedStock || 0)}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(item.valueOfStockInQualityInspection || 0)}</td>
                        <td className="py-3 px-3">{item.wbsElement || '-'}</td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.syncStatus === 'pending'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : item.syncStatus === 'offline'
                                ? 'bg-slate-100 border-slate-200 text-slate-600'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.syncStatus === 'pending'
                                  ? 'bg-amber-500 animate-pulse'
                                  : item.syncStatus === 'offline'
                                  ? 'bg-slate-400'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span>{item.syncStatus === 'pending' ? 'Pending' : item.syncStatus === 'offline' ? 'Offline' : 'Synced'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectItem(item); }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-cyan-600 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Secondary Details Row */}
                      {isExpanded && (
                        <tr key={`${item.id}-expanded`} className="print:hidden">
                          <td colSpan={17} className="p-0 border-b border-cyan-200 bg-slate-50">
                            <DeviceExpandedDetails
                              item={item}
                              onOpenFullModal={onSelectItem}
                              onScheduleCalendar={onScheduleCalendar}
                              onSendAlert={onSendAlert}
                              onCollapse={() => handleToggleRowExpand(item.id)}
                              isAdmin={isAdmin}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Print Body (Full filtered list for paper report) */}
            <tbody className="divide-y divide-slate-200 hidden print:table-row-group">
              {filteredItems.map((item, index) => (
                <tr key={`print-${item.id}`} className="page-break-inside-avoid">
                  <td className="text-center font-mono">{index + 1}</td>
                  <td className="font-mono font-semibold">{item.material}</td>
                  <td>
                    <div className="font-semibold text-slate-900">{item.materialDescription}</div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      Batch: {item.batch || 'N/A'} • Exp: {item.expiryDate || 'Permanent Asset'} • WBS: {item.wbsElement || 'Core'}
                    </div>
                  </td>
                  <td>{item.plant} ({item.wh || 'WH1'})</td>
                  <td className="text-right font-bold">{formatNumber(item.qty)}</td>
                  <td className="text-right font-mono">{formatCurrency(item.totalAmount, true)}</td>
                  <td>{item.sohStatus || (item.isNotFunctional ? 'Defective' : item.qty === 0 ? 'Out of Stock' : item.qty < 5 ? 'Low Stock' : 'Stock on Hand (Active)')}</td>
                  <td>
                    {item.isNotFunctional ? 'Defective' : item.needsSparePart ? 'Needs Spare' : 'Functional'}
                    {item.isNonMoving ? ' (Non-Moving)' : ''}
                  </td>
                  <td>{item.installationStatus || 'Installed'}</td>
                  <td>{item.deliveryStatus || 'Delivered & Dispatched'}</td>
                  <td>{[item.lcStatus, item.shipmentStatus, item.clearanceStatus, item.assignTrainStatus].filter(Boolean).join(' | ') || '-'}</td>
                  <td>{item.manufacturer || 'Unspecified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Screen only) */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/50 print:hidden">
          <span className="text-slate-500">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredItems.length.toLocaleString()} items)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Official Sign-off and Auditor Verification Section (Print only) */}
      <div className="hidden print:block mt-8 pt-4 border-t-2 border-slate-400 page-break-inside-avoid">
        <div className="text-xs font-bold text-slate-900 uppercase mb-4">
          Audit Verification & Official Approval Sign-Off
        </div>
        <div className="grid grid-cols-3 gap-6 text-[11px] text-slate-700">
          <div className="p-3 border border-slate-300 rounded space-y-4">
            <div className="font-semibold text-slate-900">Prepared By:</div>
            <div className="pt-6 border-b border-dotted border-slate-400"></div>
            <div>Name: _______________________</div>
            <div>Title: Biomedical Logistics Officer</div>
            <div>Date: _______________________</div>
          </div>

          <div className="p-3 border border-slate-300 rounded space-y-4">
            <div className="font-semibold text-slate-900">Audited & Verified By:</div>
            <div className="pt-6 border-b border-dotted border-slate-400"></div>
            <div>Name: _______________________</div>
            <div>Title: Lead Biomedical Engineer</div>
            <div>Date: _______________________</div>
          </div>

          <div className="p-3 border border-slate-300 rounded space-y-4">
            <div className="font-semibold text-slate-900">Directorate Approval & Stamp:</div>
            <div className="pt-6 border-b border-dotted border-slate-400"></div>
            <div>Signature: __________________</div>
            <div>EPSS Directorate Seal:</div>
            <div className="h-4"></div>
          </div>
        </div>
      </div>

      {/* Bulk Status Update Confirmation Dialog Modal */}
      {pendingBulkStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Confirm Bulk Status Update</h3>
                  <p className="text-xs text-slate-300">Prevent accidental changes to multiple records</p>
                </div>
              </div>
              <button
                onClick={() => setPendingBulkStatus(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-950 mb-0.5">Warning: Mass Status Modification</span>
                  You are about to apply a new status to <strong className="underline font-extrabold">{selectedItemIds.length} selected medical device(s)</strong>.
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Target Operational Status:</span>
                  <span className="font-bold text-slate-900 capitalize px-2 py-0.5 bg-slate-100 rounded">
                    {pendingBulkStatus === 'functional' && '🟢 Functional / Operational'}
                    {pendingBulkStatus === 'defective' && '🔴 Defective / Breakdown'}
                    {pendingBulkStatus === 'needsSpare' && '🟣 Needs Spare Parts'}
                    {pendingBulkStatus === 'nonMoving' && '🟡 Non-Moving Stock'}
                    {pendingBulkStatus === 'installed' && '🟢 Installed'}
                    {pendingBulkStatus === 'pendingInstallation' && '🟡 Pending Installation'}
                    {pendingBulkStatus === 'underCommissioning' && '🔵 Under Commissioning'}
                    {pendingBulkStatus === 'siteAssessment' && '🟣 Site Assessment'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Affected Records Count:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedItemIds.length} Devices</span>
                </div>
              </div>

              <p className="text-slate-500 italic">
                Please verify your selection before confirming. Once applied, status updates will synchronize across your active inventory view.
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingBulkStatus(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingBulkStatus) {
                    handleBulkUpdateStatus(pendingBulkStatus as any);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Confirm & Apply Bulk Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode & QR Code Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        onSelectItem={onSelectItem}
        onApplySearchFilter={(query) => {
          setSearchTerm(query);
          setCurrentPage(1);
        }}
      />

      {/* HF Master Data Bulk Region Upload Modal */}
      {onBulkUpdateRegions && (
        <HFMasterDataRegionalUploadModal
          isOpen={isRegionalUploadOpen}
          onClose={() => setIsRegionalUploadOpen(false)}
          items={items}
          onApplyMappings={onBulkUpdateRegions}
          documents={documents}
          onAddDocument={onAddDocument}
          onBulkUploadBreakdowns={onBulkUploadBreakdowns}
        />
      )}

      {/* Multi-Select Warehouse & Operational Status Filter Modal */}
      <WarehouseStatusFilterModal
        isOpen={isWarehouseStatusModalOpen}
        onClose={() => setIsWarehouseStatusModalOpen(false)}
        items={items}
        selectedWarehouses={multiSelectedWarehouses}
        selectedOperationalStatuses={multiSelectedStatuses}
        onApplyFilters={(whs, sts) => {
          setMultiSelectedWarehouses(whs);
          setMultiSelectedStatuses(sts);
          setCurrentPage(1);
        }}
        onClearFilters={() => {
          setMultiSelectedWarehouses([]);
          setMultiSelectedStatuses([]);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};
