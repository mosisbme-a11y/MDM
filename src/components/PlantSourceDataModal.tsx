import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Search,
  Filter,
  Layers,
  Building2,
  Boxes,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { MultipleStockRecord } from '../types';
import { getRdfHpCategory } from './DashboardViewMultipleStockAnalytics';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

export interface PlantBreakdownMetrics {
  name: string;
  displayName: string;
  valuation: number;
  units: number;
  lineItems: number;
  unrestrictedValuation?: number;
  inTransitValuation?: number;
  qcValuation?: number;
  uniqueMaterials?: number;
  rdfValuation: number;
  rdfUnits: number;
  rdfLineItems: number;
  hpValuation: number;
  hpUnits: number;
  hpLineItems: number;
  items: MultipleStockRecord[];
}

export interface PlantSourceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantData: PlantBreakdownMetrics | null;
  allPlants?: PlantBreakdownMetrics[];
  onSelectPlant?: (plant: PlantBreakdownMetrics) => void;
}

export const PlantSourceDataModal: React.FC<PlantSourceDataModalProps> = ({
  isOpen,
  onClose,
  plantData,
  allPlants = [],
  onSelectPlant
}) => {
  const [streamFilter, setStreamFilter] = useState<'all' | 'RDF' | 'HP'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStorageLocation, setSelectedStorageLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'material' | 'materialDescription' | 'totalStock' | 'totalValuation'>('totalValuation');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Return null if not open or no data
  if (!isOpen || !plantData) return null;

  const rawRecords = plantData.items || [];

  // Unique material groups and storage locations for filters
  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    rawRecords.forEach((item) => {
      if (item.materialGroupName) set.add(item.materialGroupName);
    });
    return Array.from(set).sort();
  }, [rawRecords]);

  const uniqueStorageLocations = useMemo(() => {
    const set = new Set<string>();
    rawRecords.forEach((item) => {
      if (item.storageLocation) set.add(item.storageLocation);
    });
    return Array.from(set).sort();
  }, [rawRecords]);

  // Counts by Program
  const rdfCount = useMemo(() => {
    return rawRecords.filter((item) => getRdfHpCategory(item) === 'RDF').length;
  }, [rawRecords]);

  const hpCount = useMemo(() => {
    return rawRecords.filter((item) => getRdfHpCategory(item) === 'HP').length;
  }, [rawRecords]);

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    let list = rawRecords;

    // Filter by Program Stream (RDF vs HP)
    if (streamFilter !== 'all') {
      list = list.filter((item) => getRdfHpCategory(item) === streamFilter);
    }

    // Filter by Material Group
    if (selectedGroup !== 'all') {
      list = list.filter((item) => item.materialGroupName === selectedGroup);
    }

    // Filter by Storage Location
    if (selectedStorageLocation !== 'all') {
      list = list.filter((item) => item.storageLocation === selectedStorageLocation);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          (item.material || '').toLowerCase().includes(q) ||
          (item.materialDescription || '').toLowerCase().includes(q) ||
          (item.storageLocation || '').toLowerCase().includes(q) ||
          (item.materialGroupName || '').toLowerCase().includes(q) ||
          (item.wbsElement || '').toLowerCase().includes(q) ||
          (item.specialStockType || '').toLowerCase().includes(q)
        );
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'totalValuation') {
        valA = (a.currentValueOfUnrestrictedStock || 0) + (a.valueOfBlockedStock || 0) + (a.valueOfStockInQualityInspection || 0);
        valB = (b.currentValueOfUnrestrictedStock || 0) + (b.valueOfBlockedStock || 0) + (b.valueOfStockInQualityInspection || 0);
      } else if (sortField === 'totalStock') {
        valA = (a.unrestrictedStock || 0) + (a.blockedStock || 0) + (a.stockInQualityInspection || 0);
        valB = (b.unrestrictedStock || 0) + (b.blockedStock || 0) + (b.stockInQualityInspection || 0);
      } else if (sortField === 'material') {
        valA = a.material || '';
        valB = b.material || '';
      } else {
        valA = a.materialDescription || '';
        valB = b.materialDescription || '';
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [rawRecords, streamFilter, selectedGroup, selectedStorageLocation, searchQuery, sortField, sortAsc]);

  // Aggregate stats for filtered records
  const filteredStats = useMemo(() => {
    let units = 0;
    let valuation = 0;
    let unrestricted = 0;
    let blocked = 0;
    let inspection = 0;

    filteredRecords.forEach((item) => {
      const u = (item.unrestrictedStock || 0) + (item.blockedStock || 0) + (item.stockInQualityInspection || 0);
      const val = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
      units += u;
      valuation += val;
      unrestricted += (item.unrestrictedStock || 0);
      blocked += (item.blockedStock || 0);
      inspection += (item.stockInQualityInspection || 0);
    });

    return {
      count: filteredRecords.length,
      units,
      valuation,
      unrestricted,
      blocked,
      inspection
    };
  }, [filteredRecords]);

  // CSV Export
  const handleExportCSV = () => {
    const csvData = filteredRecords.map((item, idx) => {
      const stream = getRdfHpCategory(item);
      const totalUnits = (item.unrestrictedStock || 0) + (item.blockedStock || 0) + (item.stockInQualityInspection || 0);
      const totalVal = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);

      return {
        '#': idx + 1,
        'Plant Hub': item.plant,
        'Material Number': item.material,
        'Material Description': item.materialDescription,
        'Funding Stream': stream === 'HP' ? 'Health Program (HP)' : 'Revolving Drug Fund (RDF)',
        'Special Stock Type': item.specialStockType ? item.specialStockType : 'Blank (RDF)',
        'Storage Location': item.storageLocation || 'Main Hub Store',
        'Unrestricted Stock': item.unrestrictedStock || 0,
        'Quality Inspection Stock': item.stockInQualityInspection || 0,
        'Blocked Stock': item.blockedStock || 0,
        'Total Quantity (Units)': totalUnits,
        'Value of Unrestricted Stock (ETB)': item.currentValueOfUnrestrictedStock || 0,
        'Value of Quality Inspection Stock (ETB)': item.valueOfStockInQualityInspection || 0,
        'Value of Blocked Stock (ETB)': item.valueOfBlockedStock || 0,
        'Total Inventory Valuation (ETB)': totalVal,
        'Material Group': item.materialGroupName || 'General Medical Devices',
        'Valuation Type': item.inventoryValuationType || 'Moving Average (V)',
        'WBS Element': item.wbsElement || '',
        'Source File': item.sourceFile || ''
      };
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const cleanPlant = plantData.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCSV(`EPSS_Source_Data_Plant_${cleanPlant}_${dateStr}.csv`, csvData);
  };

  const handleToggleSort = (field: 'material' | 'materialDescription' | 'totalStock' | 'totalValuation') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for easy scanning
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 border-b border-indigo-900/60 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300 shadow-inner shrink-0">
                <Building2 className="w-7 h-7 text-indigo-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 font-mono">
                    Plant Source Data Inspector
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Double-Click Triggered</span>
                  </span>
                  {allPlants.length > 1 && onSelectPlant && (
                    <div className="relative inline-block">
                      <select
                        value={plantData.name}
                        onChange={(e) => {
                          const target = allPlants.find((p) => p.name === e.target.value);
                          if (target) onSelectPlant(target);
                        }}
                        className="bg-indigo-950/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-indigo-400/40 focus:outline-none cursor-pointer"
                        title="Switch Plant Hub"
                      >
                        {allPlants.map((p) => (
                          <option key={p.name} value={p.name} className="bg-slate-900 text-white">
                            Plant: {p.displayName || p.name} ({p.lineItems} SKUs)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide text-white mt-1">
                  Plant Source Records: <span className="text-indigo-300">{plantData.displayName || plantData.name}</span>
                </h3>
                <p className="text-xs text-indigo-200/90 mt-0.5">
                  Complete line-by-line inventory records, quantity distributions, and monetary valuations for this plant hub.
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                title="Download this plant's source data records as CSV"
              >
                <Download className="w-4 h-4" />
                <span>Export Plant CSV</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-700/80 text-[10px] font-mono">
                  {filteredRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Close Source Data Inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Plant Top-Level KPI Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-indigo-800/60 text-xs">
            {/* Total Valuation */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold block">Total Plant Value</span>
              <span className="text-sm sm:text-base font-black font-mono text-white mt-0.5 block truncate">
                {formatCurrency(plantData.valuation)}
              </span>
              <span className="text-[10px] text-slate-300 font-mono">100% of Plant</span>
            </div>

            {/* Total Line Items */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold block">Total Line Items</span>
              <span className="text-sm sm:text-base font-black font-mono text-cyan-300 mt-0.5 block">
                {plantData.lineItems.toLocaleString()} SKUs
              </span>
              <span className="text-[10px] text-slate-300 font-mono">Inventory Records</span>
            </div>

            {/* Total Physical Quantity */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold block">Total Quantity</span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-300 mt-0.5 block">
                {formatNumber(plantData.units)} Units
              </span>
              <span className="text-[10px] text-slate-300 font-mono">Physical Stock</span>
            </div>

            {/* RDF Value & Lines */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold">RDF Value (Blank)</span>
              </div>
              <span className="text-sm sm:text-base font-black font-mono text-emerald-200 mt-0.5 block truncate">
                {formatCurrency(plantData.rdfValuation)}
              </span>
              <span className="text-[10px] text-emerald-400/90 font-mono">
                {plantData.rdfLineItems} lines • {formatNumber(plantData.rdfUnits)} u
              </span>
            </div>

            {/* HP Value & Lines */}
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Health Program (Q)</span>
              </div>
              <span className="text-sm sm:text-base font-black font-mono text-purple-200 mt-0.5 block truncate">
                {formatCurrency(plantData.hpValuation)}
              </span>
              <span className="text-[10px] text-purple-400/90 font-mono">
                {plantData.hpLineItems} lines • {formatNumber(plantData.hpUnits)} u
              </span>
            </div>

            {/* Program Ratio */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold block">Funding Ratio</span>
              <div className="flex items-center gap-1 text-[11px] font-mono font-bold mt-1">
                <span className="text-emerald-400">
                  {plantData.valuation > 0 ? Math.round((plantData.rdfValuation / plantData.valuation) * 100) : 0}% RDF
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-purple-400">
                  {plantData.valuation > 0 ? Math.round((plantData.hpValuation / plantData.valuation) * 100) : 0}% HP
                </span>
              </div>
              <span className="text-[10px] text-slate-400">By monetary value</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Program Stream Selector Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setStreamFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                streamFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records ({rawRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setStreamFilter('RDF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                streamFilter === 'RDF'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>RDF Stock ({rdfCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStreamFilter('HP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                streamFilter === 'HP'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span>Health Program ({hpCount})</span>
            </button>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search code, description, batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Material Group Filter */}
            {uniqueGroups.length > 0 && (
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none max-w-[150px] truncate"
                title="Filter by Material Group"
              >
                <option value="all">All Groups ({uniqueGroups.length})</option>
                {uniqueGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            {/* Storage Location Filter */}
            {uniqueStorageLocations.length > 0 && (
              <select
                value={selectedStorageLocation}
                onChange={(e) => setSelectedStorageLocation(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none max-w-[150px] truncate"
                title="Filter by Storage Location"
              >
                <option value="all">All Locations ({uniqueStorageLocations.length})</option>
                {uniqueStorageLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}

            {/* Reset Filter Button */}
            {(streamFilter !== 'all' || selectedGroup !== 'all' || selectedStorageLocation !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStreamFilter('all');
                  setSelectedGroup('all');
                  setSelectedStorageLocation('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Data Table Section */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-[350px]">
          {filteredRecords.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No matching stock records found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Try adjusting your search query, material group filter, or program stream selection.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStreamFilter('all');
                  setSelectedGroup('all');
                  setSelectedStorageLocation('all');
                  setSearchQuery('');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                    <th className="py-3 px-3 w-10 text-center border-x border-slate-200">#</th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition border-x border-slate-200"
                      onClick={() => handleToggleSort('material')}
                      title="Sort by Material Code"
                    >
                      <div className="flex items-center gap-1">
                        <span>Material Code</span>
                        {sortField === 'material' && (
                          sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition border-x border-slate-200"
                      onClick={() => handleToggleSort('materialDescription')}
                      title="Sort by Description"
                    >
                      <div className="flex items-center gap-1">
                        <span>Description</span>
                        {sortField === 'materialDescription' && (
                          sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-3 border-x border-slate-200">Program Stream</th>
                    <th className="py-3 px-3 border-x border-slate-200">Storage Loc</th>
                    <th className="py-3 px-3 text-right border-x border-slate-200">Unrestricted</th>
                    <th className="py-3 px-3 text-right border-x border-slate-200">Quality</th>
                    <th className="py-3 px-3 text-right border-x border-slate-200">Blocked</th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition border-x border-slate-200"
                      onClick={() => handleToggleSort('totalStock')}
                      title="Sort by Total Quantity"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Units</span>
                        {sortField === 'totalStock' && (
                          sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition border-x border-slate-200"
                      onClick={() => handleToggleSort('totalValuation')}
                      title="Sort by Total Valuation"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Valuation (ETB)</span>
                        {sortField === 'totalValuation' && (
                          sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-3 border-x border-slate-200">Group & WBS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.map((item, idx) => {
                    const isHp = getRdfHpCategory(item) === 'HP';
                    const totalQty = (item.unrestrictedStock || 0) + (item.blockedStock || 0) + (item.stockInQualityInspection || 0);
                    const totalVal = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);

                    return (
                      <tr key={item.id || idx} className="hover:bg-indigo-50/40 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] border-x border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap border-x border-slate-200">
                          {item.material || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs truncate border-x border-slate-200" title={item.materialDescription}>
                          {item.materialDescription || 'Unnamed Material'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap border-x border-slate-200">
                          {isHp ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              <span>HP (Q)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>RDF (Blank)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px] border-x border-slate-200">
                          {item.storageLocation || 'Main Hub'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 border-x border-slate-200">
                          {(item.unrestrictedStock || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-700 border-x border-slate-200">
                          {(item.stockInQualityInspection || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700 border-x border-slate-200">
                          {(item.blockedStock || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 border-x border-slate-200">
                          {totalQty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700 whitespace-nowrap border-x border-slate-200">
                          {formatCurrency(totalVal)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-[180px] truncate border-x border-slate-200" title={`${item.materialGroupName || ''} | ${item.wbsElement || ''}`}>
                          <span className="text-slate-800 font-medium">{item.materialGroupName || 'General'}</span>
                          {item.wbsElement && <span className="block font-mono text-[10px] text-slate-400">{item.wbsElement}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span>
              Showing <strong>{filteredRecords.length}</strong> of <strong>{rawRecords.length}</strong> records in Plant {plantData.name}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Filtered Units: <strong className="font-mono text-slate-900">{formatNumber(filteredStats.units)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Filtered Valuation: <strong className="font-mono text-emerald-700">{formatCurrency(filteredStats.valuation)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantSourceDataModal;
