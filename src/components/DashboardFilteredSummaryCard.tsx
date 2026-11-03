import React, { useMemo } from 'react';
import {
  Package,
  TrendingUp,
  Building2,
  Filter,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
  Search,
  Calendar,
  Layers,
  Coins,
  ShieldCheck,
  Wrench,
  PackageCheck
} from 'lucide-react';
import { MedicalDeviceItem, MultipleStockRecord, ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

interface DashboardFilteredSummaryCardProps {
  // Master Inventory datasets
  items: MedicalDeviceItem[];
  filteredItems: MedicalDeviceItem[];

  // Multiple Stock datasets (optional)
  multipleStockItems?: MultipleStockRecord[];
  filteredMultipleStockItems?: MultipleStockRecord[];

  // Current Dashboard Mode
  dashboardMode: 'all' | 'multiple-stock' | 'master';

  // Active filter state values
  plantFilter: string;
  setPlantFilter: (val: string) => void;
  groupFilter: string;
  setGroupFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onResetFilters: () => void;

  // Available options
  availablePlants: { code: string; name: string }[];
  availableGroups: string[];

  // Navigation callbacks
  onNavigateTab?: (tab: string) => void;
  receivingRecords?: ReceivingDataRecord[];
  onOpenWarehouseReceivedModal?: () => void;
}

export const DashboardFilteredSummaryCard: React.FC<DashboardFilteredSummaryCardProps> = ({
  items,
  filteredItems,
  multipleStockItems = [],
  filteredMultipleStockItems = [],
  receivingRecords = [],
  onOpenWarehouseReceivedModal,
  dashboardMode,
  plantFilter,
  setPlantFilter,
  groupFilter,
  setGroupFilter,
  statusFilter,
  setStatusFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  searchQuery,
  setSearchQuery,
  onResetFilters,
  availablePlants,
  availableGroups,
  onNavigateTab
}) => {
  // Check if any filter is currently applied
  const isFilterActive = useMemo(() => {
    return (
      plantFilter !== 'all' ||
      groupFilter !== 'all' ||
      statusFilter !== 'all' ||
      Boolean(startDate) ||
      Boolean(endDate) ||
      Boolean(searchQuery.trim())
    );
  }, [plantFilter, groupFilter, statusFilter, startDate, endDate, searchQuery]);

  // Calculations for Master Inventory
  const masterFilteredCount = filteredItems.length;
  const masterTotalCount = items.length;

  const masterFilteredUnits = useMemo(() => {
    return filteredItems.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
  }, [filteredItems]);

  const masterTotalUnits = useMemo(() => {
    return items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
  }, [items]);

  const masterFilteredValuation = useMemo(() => {
    return filteredItems.reduce((acc, i) => {
      const amt = Number(i.totalAmount) || (Number(i.qty || 0) * (Number(i.unitPrice) || 0));
      return acc + amt;
    }, 0);
  }, [filteredItems]);

  const masterTotalValuation = useMemo(() => {
    return items.reduce((acc, i) => {
      const amt = Number(i.totalAmount) || (Number(i.qty || 0) * (Number(i.unitPrice) || 0));
      return acc + amt;
    }, 0);
  }, [items]);

  // Calculations for Multiple Stock records
  const msFilteredCount = filteredMultipleStockItems.length;
  const msTotalCount = multipleStockItems.length;

  const msFilteredUnits = useMemo(() => {
    return filteredMultipleStockItems.reduce((acc, i) => {
      return (
        acc +
        (Number(i.unrestrictedStock) || 0) +
        (Number(i.stockInQualityInspection) || 0) +
        (Number(i.blockedStock) || 0)
      );
    }, 0);
  }, [filteredMultipleStockItems]);

  const msTotalUnits = useMemo(() => {
    return multipleStockItems.reduce((acc, i) => {
      return (
        acc +
        (Number(i.unrestrictedStock) || 0) +
        (Number(i.stockInQualityInspection) || 0) +
        (Number(i.blockedStock) || 0)
      );
    }, 0);
  }, [multipleStockItems]);

  const msFilteredValuation = useMemo(() => {
    return filteredMultipleStockItems.reduce((acc, i) => {
      return (
        acc +
        (Number(i.currentValueOfUnrestrictedStock) || 0) +
        (Number(i.valueOfBlockedStock) || 0) +
        (Number(i.valueOfStockInQualityInspection) || 0)
      );
    }, 0);
  }, [filteredMultipleStockItems]);

  const msTotalValuation = useMemo(() => {
    return multipleStockItems.reduce((acc, i) => {
      return (
        acc +
        (Number(i.currentValueOfUnrestrictedStock) || 0) +
        (Number(i.valueOfBlockedStock) || 0) +
        (Number(i.valueOfStockInQualityInspection) || 0)
      );
    }, 0);
  }, [multipleStockItems]);

  // Choose display values according to dashboard mode
  const isMultipleStockMode = dashboardMode === 'multiple-stock';

  const displayFilteredItemsCount = isMultipleStockMode ? msFilteredCount : masterFilteredCount;
  const displayTotalItemsCount = isMultipleStockMode ? msTotalCount : masterTotalCount;

  const displayFilteredUnits = isMultipleStockMode ? msFilteredUnits : masterFilteredUnits;
  const displayTotalUnits = isMultipleStockMode ? msTotalUnits : masterTotalUnits;

  const displayFilteredTotalValue = isMultipleStockMode ? msFilteredValuation : masterFilteredValuation;
  const displayTotalValuation = isMultipleStockMode ? msTotalValuation : masterTotalValuation;

  // Receiving Data metrics (Authority for Total Item Received)
  const totalReceivedUnits = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return receivingRecords.reduce((acc, r) => acc + (Number(r.quantity) || Number(r.qtyInUnitOfEntry) || 0), 0);
    }
    return items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
  }, [receivingRecords, items]);

  const totalReceivedValuation = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return receivingRecords.reduce((acc, r) => acc + (Number(r.amtInLocCur) || 0), 0);
    }
    return items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').reduce((acc, i) => acc + (Number(i.totalAmount) || (Number(i.qty || 0) * (Number(i.unitPrice) || 0))), 0);
  }, [receivingRecords, items]);

  const totalReceivedLines = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return receivingRecords.length;
    }
    return items.filter(i => i.deliveryStatus === 'Delivered & Dispatched').length;
  }, [receivingRecords, items]);

  // Percentage calculations
  const itemsPercentage = displayTotalItemsCount > 0
    ? ((displayFilteredItemsCount / displayTotalItemsCount) * 100).toFixed(1)
    : '0.0';

  const unitsPercentage = displayTotalUnits > 0
    ? ((displayFilteredUnits / displayTotalUnits) * 100).toFixed(1)
    : '0.0';

  const valuePercentage = displayTotalValuation > 0
    ? ((displayFilteredTotalValue / displayTotalValuation) * 100).toFixed(1)
    : '0.0';

  // Plant and Hub Coverage
  const activePlantCodes = useMemo(() => {
    const set = new Set<string>();
    if (isMultipleStockMode) {
      filteredMultipleStockItems.forEach(i => { if (i.plant) set.add(i.plant); });
    } else {
      filteredItems.forEach(i => { if (i.plant) set.add(i.plant); });
    }
    return set;
  }, [isMultipleStockMode, filteredMultipleStockItems, filteredItems]);

  const totalPlantCodes = useMemo(() => {
    const set = new Set<string>();
    if (isMultipleStockMode) {
      multipleStockItems.forEach(i => { if (i.plant) set.add(i.plant); });
    } else {
      items.forEach(i => { if (i.plant) set.add(i.plant); });
    }
    return set;
  }, [isMultipleStockMode, multipleStockItems, items]);

  const filteredPlantCount = activePlantCodes.size;
  const totalPlantCount = Math.max(totalPlantCodes.size, availablePlants.length, 1);
  const coveragePercentage = ((filteredPlantCount / totalPlantCount) * 100).toFixed(0);

  // Group Coverage
  const activeGroups = useMemo(() => {
    const set = new Set<string>();
    if (isMultipleStockMode) {
      filteredMultipleStockItems.forEach(i => { if (i.materialGroupName) set.add(i.materialGroupName); });
    } else {
      filteredItems.forEach(i => { if (i.materialGroupName) set.add(i.materialGroupName); });
    }
    return set;
  }, [isMultipleStockMode, filteredMultipleStockItems, filteredItems]);

  // Operational health of filtered items (Master Inventory)
  const functionalStats = useMemo(() => {
    let functional = 0;
    let defective = 0;
    let needsSpare = 0;
    filteredItems.forEach(i => {
      if (i.isNotFunctional) defective++;
      else if (i.needsSparePart) needsSpare++;
      else functional++;
    });
    const total = filteredItems.length || 1;
    const rate = Math.round((functional / total) * 100);
    return { functional, defective, needsSpare, rate };
  }, [filteredItems]);

  // Average valuations
  const averageValuePerItem = displayFilteredItemsCount > 0
    ? Math.round(displayFilteredTotalValue / displayFilteredItemsCount)
    : 0;

  const averageValuePerUnit = displayFilteredUnits > 0
    ? Math.round(displayFilteredTotalValue / displayFilteredUnits)
    : 0;

  // Selected plant display label
  const selectedPlantLabel = useMemo(() => {
    if (plantFilter === 'all') return 'All Plants';
    const match = availablePlants.find(p => p.code === plantFilter || p.name === plantFilter);
    return match ? (match.name ? `${match.name} (${match.code})` : match.code) : plantFilter;
  }, [plantFilter, availablePlants]);

  // Export filtered items handler
  const handleExportFilteredCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    if (isMultipleStockMode) {
      const exportData = filteredMultipleStockItems.map(item => ({
        'Material ID': item.material,
        'Material Description': item.materialDescription,
        'Plant': item.plant,
        'Storage Location': item.storageLocation,
        'Special Stock Type': item.specialStockType,
        'Unrestricted Stock': item.unrestrictedStock,
        'Quality Inspection': item.stockInQualityInspection,
        'Blocked Stock': item.blockedStock,
        'Current Value': item.currentValueOfUnrestrictedStock,
        'Material Group': item.materialGroupName,
        'WBS Element': item.wbsElement
      }));
      downloadCSV(`EPSS_Filtered_MultipleStock_${timestamp}.csv`, exportData);
    } else {
      const exportData = filteredItems.map(item => ({
        'Material Code': item.material,
        'Description': item.materialDescription,
        'Plant Code': item.plant,
        'Plant Name': item.plantName,
        'Quantity': item.qty,
        'Unit Price (ETB)': item.unitPrice,
        'Total Amount (ETB)': item.totalAmount || (item.qty * (item.unitPrice || 0)),
        'Material Group': item.materialGroupName || 'N/A',
        'Functional Status': item.isNotFunctional ? 'Defective' : item.needsSparePart ? 'Needs Spare Part' : 'Functional',
        'Installation Status': item.installationStatus || 'Installed',
        'Delivery Status': item.deliveryStatus || 'Delivered & Dispatched',
        'Batch': item.batch || 'N/A',
        'Receiving Date': item.receivingDate || item.docDate || 'N/A'
      }));
      downloadCSV(`EPSS_Filtered_MasterInventory_${timestamp}.csv`, exportData);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
      {/* 1. Header & Active Filter Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
            isFilterActive
              ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
          }`}>
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Dashboard Filter Overview & Impact
              </h3>
              {isFilterActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Filtered Selection Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All Inventory Data (100% Scope)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFilterActive
                ? `Current filter criteria isolate ${formatNumber(displayFilteredItemsCount)} of ${formatNumber(displayTotalItemsCount)} items (${itemsPercentage}% of catalog)`
                : `No filter constraints applied. Displaying total national inventory across all hubs, groups, and timelines.`}
            </p>
          </div>
        </div>

        {/* Action Controls: Export CSV & Reset */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Reset all dashboard filters to view full inventory"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportFilteredCSV}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Download CSV export of currently filtered items"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Filtered ({formatNumber(displayFilteredItemsCount)})</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Inspect filtered records in table view"
            >
              <span>Inspect in Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Filter Controls Toolbar */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Filter 1: Plant / Hub */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Delivering Plant / Hub
            </label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Plants & Hubs</option>
              {availablePlants.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name ? `${p.name} (${p.code})` : p.code}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Material Group */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Material Group
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Material Groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Operational Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Equipment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="Functional">Functional (Active)</option>
              <option value="Defective">Defective (Breakdown)</option>
              <option value="Needs Spare Part">Needs Spare Part</option>
              <option value="Non-Moving">Non-Moving Stock</option>
            </select>
          </div>

          {/* Filter 4: Start Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Received From Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                title="Filter by receiving or document date on/after this date"
              />
            </div>
          </div>

          {/* Filter 5: End Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Received To Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                title="Filter by receiving or document date on/before this date"
              />
            </div>
          </div>

          {/* Filter 6: Quick Search Keyword */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Search Keyword
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Description, code, batch..."
                className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-7 pr-2 py-1.5 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar (Shown when any filter is selected) */}
        {isFilterActive && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Active:</span>
            </span>

            {plantFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs">
                <span>Plant: {selectedPlantLabel}</span>
                <button
                  type="button"
                  onClick={() => setPlantFilter('all')}
                  className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                  title="Remove Plant filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {groupFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs">
                <span>Group: {groupFilter}</span>
                <button
                  type="button"
                  onClick={() => setGroupFilter('all')}
                  className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                  title="Remove Group filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                  title="Remove Status filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>
                  Date: {startDate || 'Any'} → {endDate || 'Any'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                  title="Clear Date range"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs">
                <Search className="w-3 h-3 text-indigo-500" />
                <span>Query: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                  title="Clear Search"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* 3. Primary Summary Metric Cards (Prominently displaying 'Total Filtered Items', 'Filtered Total Value', and 'Total Item Received') */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* CARD 1: Total Filtered Items (Requested exact title) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-cyan-50/40 p-4 sm:p-5 rounded-2xl border border-cyan-200/80 shadow-xs hover:border-cyan-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-900/80">
                Total Filtered Items
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                  {formatNumber(displayFilteredItemsCount)}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  catalog lines
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-100/70 border border-cyan-200 text-cyan-700 shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-cyan-100 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-semibold font-mono">
              {formatNumber(displayFilteredUnits)} physical units
            </span>
            <span className={`font-bold ${isFilterActive ? 'text-cyan-700' : 'text-slate-500'}`}>
              {isFilterActive ? `${itemsPercentage}% of total` : '100% of stock'}
            </span>
          </div>
        </div>

        {/* CARD 2: Filtered Total Value (Requested exact title) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900/80">
                Filtered Total Value
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight font-mono">
                  {formatCurrency(displayFilteredTotalValue, true)}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-200 text-emerald-700 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
            <span
              className="text-slate-700 font-mono font-medium truncate max-w-[170px]"
              title={formatCurrency(displayFilteredTotalValue, false)}
            >
              {formatCurrency(displayFilteredTotalValue, false)}
            </span>
            <span className={`font-bold ${isFilterActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isFilterActive ? `${valuePercentage}% of valuation` : 'Full Valuation'}
            </span>
          </div>
        </div>

        {/* CARD 3: Filter Scope & Plant Coverage */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900/80">
                Active Filter Coverage
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight font-mono">
                  {filteredPlantCount}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  of {totalPlantCount} hubs
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-100/70 border border-indigo-200 text-indigo-700 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-semibold">
              {activeGroups.size} material {activeGroups.size === 1 ? 'group' : 'groups'}
            </span>
            <span className="text-indigo-700 font-bold font-mono">
              {coveragePercentage}% hub scope
            </span>
          </div>
        </div>

        {/* CARD 4: Filtered Operational Condition / Average Value */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-900/80">
                Average Unit Valuation
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                  {formatCurrency(averageValuePerUnit, true)}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  / unit
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-700 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">
              {formatCurrency(averageValuePerItem, true)} / line
            </span>
            {!isMultipleStockMode ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{functionalStats.rate}% Functional</span>
              </span>
            ) : (
              <span className="text-slate-500 font-medium">
                Multi-Stock Ledger
              </span>
            )}
          </div>
        </div>

        {/* CARD 5: Total Item Received (Computed directly from Receiving Data) */}
        <div
          onClick={() => {
            if (onOpenWarehouseReceivedModal) onOpenWarehouseReceivedModal();
            else if (onNavigateTab) onNavigateTab('receiving-data');
          }}
          className="relative overflow-hidden bg-gradient-to-br from-white to-teal-50/50 p-4 sm:p-5 rounded-2xl border border-teal-200/80 shadow-xs hover:border-teal-300 transition-all flex flex-col justify-between cursor-pointer group"
          title="Click to view Total Item Received details & warehouse intake logs"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-900/80">
                  Total Item Received
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Receiving Data
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-teal-900 tracking-tight font-mono group-hover:text-teal-700 transition-colors">
                  {formatNumber(totalReceivedUnits)}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  physical units
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-100/70 border border-teal-200 text-teal-700 shrink-0 group-hover:bg-teal-200/70 transition-colors">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-teal-100 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-semibold font-mono">
              {formatNumber(totalReceivedLines)} GRN lines
            </span>
            <span className="text-teal-700 font-bold font-mono">
              {formatCurrency(totalReceivedValuation, true)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Empty Result Warning Banner if filters returned 0 items */}
      {displayFilteredItemsCount === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>No items found:</strong> No inventory records match the applied filter combination. Click Reset to return to the full catalog.
            </span>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
