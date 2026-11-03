import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Warehouse,
  CheckSquare,
  Square,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  Clock,
  Truck,
  RotateCcw,
  Layers,
  ArrowRight,
  Package
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatNumber } from '../utils/formatters';

export interface OperationalStatusOption {
  id: string;
  label: string;
  description: string;
  category: 'Condition' | 'Deployment' | 'Stock';
  color: string;
  badgeBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatusOption[] = [
  {
    id: 'functional',
    label: 'Usable / Functional Only',
    description: 'Fully operational assets without defects or spare part needs',
    category: 'Condition',
    color: '#059669',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2
  },
  {
    id: 'defective',
    label: 'Defective / Faulty',
    description: 'Equipment flagged with malfunction or breakdown',
    category: 'Condition',
    color: '#e11d48',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: ShieldAlert
  },
  {
    id: 'needsSpare',
    label: 'Needs Spare Parts',
    description: 'Awaiting replacement components or repair accessories',
    category: 'Condition',
    color: '#d97706',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Wrench
  },
  {
    id: 'nonmoving',
    label: 'Non-Moving Stock',
    description: 'Stagnant inventory sitting in custody without movement',
    category: 'Stock',
    color: '#7c3aed',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Clock
  },
  {
    id: 'lowStock',
    label: 'Critical / Low Stock (≤5)',
    description: 'Items below minimum reorder threshold',
    category: 'Stock',
    color: '#dc2626',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertTriangle
  },
  {
    id: 'installed',
    label: 'Installed & Operational',
    description: 'Deployment completed at destination health facility',
    category: 'Deployment',
    color: '#10b981',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2
  },
  {
    id: 'commissioning',
    label: 'Under Commissioning',
    description: 'Engineering testing, calibration, and handover in progress',
    category: 'Deployment',
    color: '#2563eb',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Wrench
  },
  {
    id: 'pendingInstallation',
    label: 'Pending Installation',
    description: 'Delivered to site, awaiting biomedical installation',
    category: 'Deployment',
    color: '#f59e0b',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock
  },
  {
    id: 'siteAssessment',
    label: 'Site Readiness Assessment',
    description: 'Pre-installation physical site and utility readiness check',
    category: 'Deployment',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Layers
  },
  {
    id: 'inTransit',
    label: 'In-Transit / Dispatched',
    description: 'On road or out for delivery to regional hubs or hospitals',
    category: 'Stock',
    color: '#0284c7',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: Truck
  }
];

export interface WarehouseFilterItem {
  id: string;
  whName: string;
  plantName: string;
  displayName: string;
  itemCount: number;
  totalUnits: number;
}

/**
 * Filter predicate verifying whether an item meets both Warehouse and Operational Status filters simultaneously.
 */
export function checkItemMatchesFilters(
  item: MedicalDeviceItem,
  selectedWarehouses: string[],
  selectedOperationalStatuses: string[]
): boolean {
  // 1. Check Warehouse selection (if any active)
  if (selectedWarehouses.length > 0) {
    const whKey = (item.wh && item.wh.trim()) || (item.plantName && item.plantName.trim()) || 'Central Warehouse';
    const matchesWh =
      selectedWarehouses.includes(whKey) ||
      (item.wh && selectedWarehouses.includes(item.wh)) ||
      (item.plantName && selectedWarehouses.includes(item.plantName)) ||
      (item.plant && selectedWarehouses.includes(item.plant));
    if (!matchesWh) return false;
  }

  // 2. Check Operational Status selection (if any active)
  if (selectedOperationalStatuses.length > 0) {
    const matchesStatus = selectedOperationalStatuses.some((statusId) => {
      switch (statusId) {
        case 'functional':
          return !item.isNotFunctional && !item.needsSparePart;
        case 'defective':
          return Boolean(item.isNotFunctional);
        case 'needsSpare':
          return Boolean(item.needsSparePart);
        case 'nonmoving':
          return Boolean(item.isNonMoving || item.sohStatus === 'Non-Moving Stock');
        case 'lowStock':
          return (Number(item.qty) || 0) <= 5;
        case 'installed':
          return (item.installationStatus || 'Installed') === 'Installed';
        case 'commissioning':
          return item.installationStatus === 'Under Commissioning';
        case 'pendingInstallation':
          return item.installationStatus === 'Pending Installation';
        case 'siteAssessment':
          return item.installationStatus === 'Site Assessment';
        case 'inTransit':
          return item.deliveryStatus === 'In Transit' || item.deliveryStatus === 'Delivered & Dispatched';
        default:
          return true;
      }
    });
    if (!matchesStatus) return false;
  }

  return true;
}

interface WarehouseStatusFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  selectedWarehouses: string[];
  selectedOperationalStatuses: string[];
  onApplyFilters: (warehouses: string[], statuses: string[]) => void;
  onClearFilters: () => void;
}

export const WarehouseStatusFilterModal: React.FC<WarehouseStatusFilterModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedWarehouses,
  selectedOperationalStatuses,
  onApplyFilters,
  onClearFilters
}) => {
  const [draftWarehouses, setDraftWarehouses] = useState<string[]>([]);
  const [draftStatuses, setDraftStatuses] = useState<string[]>([]);
  const [warehouseSearch, setWarehouseSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'both' | 'warehouses' | 'statuses'>('both');

  // Sync draft state with incoming props on modal open
  useEffect(() => {
    if (isOpen) {
      setDraftWarehouses([...selectedWarehouses]);
      setDraftStatuses([...selectedOperationalStatuses]);
      setWarehouseSearch('');
    }
  }, [isOpen, selectedWarehouses, selectedOperationalStatuses]);

  // Derive unique warehouses from inventory items with aggregated item & unit counts
  const warehouseList: WarehouseFilterItem[] = useMemo(() => {
    const map: Record<string, WarehouseFilterItem> = {};

    items.forEach((item) => {
      const whKey = (item.wh && item.wh.trim()) || (item.plantName && item.plantName.trim()) || 'Central Warehouse';
      const pName = (item.plantName && item.plantName.trim()) || 'Regional Hub';

      if (!map[whKey]) {
        map[whKey] = {
          id: whKey,
          whName: item.wh || whKey,
          plantName: pName,
          displayName:
            item.wh && item.plantName && item.wh !== item.plantName
              ? `${item.wh} (${item.plantName})`
              : whKey,
          itemCount: 0,
          totalUnits: 0
        };
      }
      map[whKey].itemCount += 1;
      map[whKey].totalUnits += Number(item.qty) || 1;
    });

    return Object.values(map).sort((a, b) => b.itemCount - a.itemCount);
  }, [items]);

  // Filtered warehouses based on search query
  const filteredWarehouses = useMemo(() => {
    if (!warehouseSearch.trim()) return warehouseList;
    const q = warehouseSearch.toLowerCase();
    return warehouseList.filter(
      (w) =>
        w.displayName.toLowerCase().includes(q) ||
        w.whName.toLowerCase().includes(q) ||
        w.plantName.toLowerCase().includes(q)
    );
  }, [warehouseList, warehouseSearch]);

  // Live matching items preview based on draft selections
  const matchingItemCount = useMemo(() => {
    return items.filter((i) => checkItemMatchesFilters(i, draftWarehouses, draftStatuses)).length;
  }, [items, draftWarehouses, draftStatuses]);

  // Operational status breakdown counts in current dataset
  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; units: number }> = {};
    OPERATIONAL_STATUS_OPTIONS.forEach((opt) => {
      counts[opt.id] = { count: 0, units: 0 };
    });

    items.forEach((item) => {
      const q = Number(item.qty) || 1;
      if (!item.isNotFunctional && !item.needsSparePart) {
        counts['functional'].count++;
        counts['functional'].units += q;
      }
      if (item.isNotFunctional) {
        counts['defective'].count++;
        counts['defective'].units += q;
      }
      if (item.needsSparePart) {
        counts['needsSpare'].count++;
        counts['needsSpare'].units += q;
      }
      if (item.isNonMoving || item.sohStatus === 'Non-Moving Stock') {
        counts['nonmoving'].count++;
        counts['nonmoving'].units += q;
      }
      if ((item.qty || 0) <= 5) {
        counts['lowStock'].count++;
        counts['lowStock'].units += q;
      }
      const instSt = item.installationStatus || 'Installed';
      if (instSt === 'Installed') {
        counts['installed'].count++;
        counts['installed'].units += q;
      } else if (instSt === 'Under Commissioning') {
        counts['commissioning'].count++;
        counts['commissioning'].units += q;
      } else if (instSt === 'Pending Installation') {
        counts['pendingInstallation'].count++;
        counts['pendingInstallation'].units += q;
      } else if (instSt === 'Site Assessment') {
        counts['siteAssessment'].count++;
        counts['siteAssessment'].units += q;
      }
      if (item.deliveryStatus === 'In Transit' || item.deliveryStatus === 'Delivered & Dispatched') {
        counts['inTransit'].count++;
        counts['inTransit'].units += q;
      }
    });

    return counts;
  }, [items]);

  // Toggle individual warehouse
  const toggleWarehouse = (whId: string) => {
    setDraftWarehouses((prev) =>
      prev.includes(whId) ? prev.filter((id) => id !== whId) : [...prev, whId]
    );
  };

  // Toggle individual operational status
  const toggleStatus = (statusId: string) => {
    setDraftStatuses((prev) =>
      prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId]
    );
  };

  // Warehouse bulk actions
  const selectAllWarehouses = () => {
    setDraftWarehouses(warehouseList.map((w) => w.id));
  };
  const clearAllWarehouses = () => {
    setDraftWarehouses([]);
  };

  // Status bulk actions
  const selectAllStatuses = () => {
    setDraftStatuses(OPERATIONAL_STATUS_OPTIONS.map((s) => s.id));
  };
  const clearAllStatuses = () => {
    setDraftStatuses([]);
  };

  // Reset all selections
  const handleReset = () => {
    setDraftWarehouses([]);
    setDraftStatuses([]);
  };

  // Commit and apply filters
  const handleApply = () => {
    onApplyFilters(draftWarehouses, draftStatuses);
    onClose();
  };

  if (!isOpen) return null;

  const totalActiveDraftFilters = draftWarehouses.length + draftStatuses.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-extrabold tracking-tight">
                  Multi-Select Filter: Warehouse & Operational Status
                </h3>
                {totalActiveDraftFilters > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500 text-white">
                    {totalActiveDraftFilters} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Simultaneously filter inventory by multiple physical warehouses and operational conditions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Tabs (Visible on mobile / responsive) */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'both' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side View
            </button>
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'warehouses' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Warehouses ({draftWarehouses.length}/{warehouseList.length})
            </button>
            <button
              onClick={() => setActiveTab('statuses')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'statuses' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Operational Statuses ({draftStatuses.length}/{OPERATIONAL_STATUS_OPTIONS.length})
            </button>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 hidden sm:block">
            Preview matches: <strong className="text-cyan-700 font-bold">{formatNumber(matchingItemCount)} items</strong>
          </div>
        </div>

        {/* Main Selection Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* PANEL 1: WAREHOUSES MULTI-SELECT */}
          {(activeTab === 'both' || activeTab === 'warehouses') && (
            <div className="space-y-3.5 flex flex-col pr-0 md:pr-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Warehouses / Hubs ({warehouseList.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={selectAllWarehouses}
                    className="font-bold text-cyan-700 hover:text-cyan-800 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearAllWarehouses}
                    className="font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Search box for warehouses */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter warehouses by name or hub..."
                  value={warehouseSearch}
                  onChange={(e) => setWarehouseSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:bg-white"
                />
              </div>

              {/* Warehouse List */}
              <div className="flex-1 max-h-[360px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                {filteredWarehouses.length > 0 ? (
                  filteredWarehouses.map((wh) => {
                    const isSelected = draftWarehouses.includes(wh.id);
                    return (
                      <div
                        key={wh.id}
                        onClick={() => toggleWarehouse(wh.id)}
                        className={`p-3 flex items-center justify-between text-xs cursor-pointer transition select-none ${
                          isSelected ? 'bg-amber-50/70 border-l-4 border-amber-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                          <button
                            type="button"
                            className="text-amber-600 focus:outline-none shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWarehouse(wh.id);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 fill-amber-500 text-white" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate">{wh.whName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{wh.plantName}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-800 text-[11px] block">{formatNumber(wh.itemCount)} items</span>
                          <span className="text-[10px] text-slate-500 font-mono">{formatNumber(wh.totalUnits)} units</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No warehouses match &quot;{warehouseSearch}&quot;
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Selected: <strong className="text-slate-800">{draftWarehouses.length}</strong> of {warehouseList.length}</span>
                {draftWarehouses.length === 0 && <span className="text-slate-400 italic">No warehouse filter (All included)</span>}
              </div>
            </div>
          )}

          {/* PANEL 2: OPERATIONAL STATUSES MULTI-SELECT */}
          {(activeTab === 'both' || activeTab === 'statuses') && (
            <div className="space-y-3.5 flex flex-col pt-4 md:pt-0 pl-0 md:pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Operational Statuses ({OPERATIONAL_STATUS_OPTIONS.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={selectAllStatuses}
                    className="font-bold text-cyan-700 hover:text-cyan-800 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearAllStatuses}
                    className="font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Select equipment operational states, readiness conditions, or service statuses.
              </p>

              {/* Status List */}
              <div className="flex-1 max-h-[395px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                {OPERATIONAL_STATUS_OPTIONS.map((opt) => {
                  const isSelected = draftStatuses.includes(opt.id);
                  const Icon = opt.icon;
                  const stat = statusCounts[opt.id] || { count: 0, units: 0 };

                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleStatus(opt.id)}
                      className={`p-3 flex items-start justify-between text-xs cursor-pointer transition select-none ${
                        isSelected ? 'bg-cyan-50/70 border-l-4 border-cyan-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 pr-2">
                        <button
                          type="button"
                          className="text-cyan-600 focus:outline-none shrink-0 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(opt.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 fill-cyan-600 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{opt.label}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${opt.badgeBg}`}>
                              {opt.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{opt.description}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pt-0.5">
                        <span className="font-bold text-slate-800 text-[11px] block">{formatNumber(stat.count)} items</span>
                        <span className="text-[10px] text-slate-500 font-mono">{formatNumber(stat.units)} units</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Selected: <strong className="text-slate-800">{draftStatuses.length}</strong> of {OPERATIONAL_STATUS_OPTIONS.length}</span>
                {draftStatuses.length === 0 && <span className="text-slate-400 italic">No status filter (All included)</span>}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Selections</span>
            </button>

            {totalActiveDraftFilters > 0 && (
              <span className="text-xs text-slate-600 hidden sm:inline">
                Filtering by <strong className="text-slate-900">{draftWarehouses.length} warehouses</strong> and{' '}
                <strong className="text-slate-900">{draftStatuses.length} statuses</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 rounded-xl transition shadow-md hover:shadow-lg cursor-pointer"
            >
              <span>Apply Multi-Filter</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px]">
                {formatNumber(matchingItemCount)} items
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseStatusFilterModal;
