import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  Search,
  Building2,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FileCheck,
  Download,
  Info,
  SlidersHorizontal,
  X,
  CheckCircle2
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface HubsViewProps {
  items: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
  isAdmin?: boolean;
}

// 20 Standard EPSS Branches / Hubs Registry
const EPSS_HUBS_REGISTRY = [
  { code: 'HO01', name: 'Head office', region: 'Central', manager: 'Dr. Solomon Abebe', phone: '+251 11 123 0001' },
  { code: 'AD01', name: 'Adama', region: 'Oromia', manager: 'Kebede Chala', phone: '+251 22 111 2233' },
  { code: 'AA01', name: 'Addis Ababa (Hub 1)', region: 'Addis Ababa', manager: 'Abebe Bekele', phone: '+251 11 123 4567' },
  { code: 'AA02', name: 'Addis Ababa (Hub 2)', region: 'Addis Ababa', manager: 'Aster Wolde', phone: '+251 11 123 4568' },
  { code: 'AR01', name: 'Arba Minch', region: 'Southern Ethiopia', manager: 'Daniel Dawit', phone: '+251 46 881 3344' },
  { code: 'AS01', name: 'Assosa', region: 'Benishangul-Gumuz', manager: 'Tariku Jene', phone: '+251 57 775 6677' },
  { code: 'BD01', name: 'Bahir Dar', region: 'Amhara', manager: 'Muluken Ayalew', phone: '+251 58 220 3344' },
  { code: 'DS01', name: 'Dessie', region: 'Amhara', manager: 'Yohannes Abebe', phone: '+251 33 111 4455' },
  { code: 'DD01', name: 'Dire Dawa', region: 'Dire Dawa', manager: 'Mohammed Ali', phone: '+251 25 111 5566' },
  { code: 'GB01', name: 'Gambella', region: 'Gambella', manager: 'Okwor Obang', phone: '+251 47 551 5566' },
  { code: 'GD01', name: 'Gondar', region: 'Amhara', manager: 'Assefa Belay', phone: '+251 58 111 6677' },
  { code: 'HW01', name: 'Hawassa', region: 'Sidama', manager: 'Tewodros Lemma', phone: '+251 46 220 1122' },
  { code: 'JM01', name: 'Jimma', region: 'Oromia', manager: 'Fikru Tolosa', phone: '+251 47 111 7788' },
  { code: 'JJ01', name: 'Jijiga', region: 'Somali', manager: 'Abdi Omar', phone: '+251 25 775 4455' },
  { code: 'KB01', name: 'Kebri-Dehar', region: 'Somali', manager: 'Farah Abdi', phone: '+251 25 123 4569' },
  { code: 'MK01', name: 'Mekelle', region: 'Tigray', manager: 'Haile Selassie', phone: '+251 34 440 8899' },
  { code: 'NG01', name: 'Negele', region: 'Oromia', manager: 'Demissew Tadesse', phone: '+251 46 445 9900' },
  { code: 'NK01', name: 'Nekemte', region: 'Oromia', manager: 'Girma Feyisa', phone: '+251 57 661 1122' },
  { code: 'SM01', name: 'Semera', region: 'Afar', manager: 'Ali Humed', phone: '+251 33 666 7788' },
  { code: 'SH02', name: 'Shire', region: 'Tigray', manager: 'Gebre Tsadkan', phone: '+251 34 111 2233' }
];

export const HubsView: React.FC<HubsViewProps> = ({ items = [], onSelectItem, isAdmin = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedHubCode, setSelectedHubCode] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'high' | 'low' | 'empty'>('all');

  // Compute dynamic stats per hub
  const hubsData = useMemo(() => {
    return EPSS_HUBS_REGISTRY.map((hub) => {
      // Find all inventory items allocated to this hub
      const hubItems = items.filter((item) => {
        const itemPlant = (item.plant || '').toUpperCase();
        const itemPlantName = (item.plantName || '').toLowerCase();
        const hubCode = hub.code.toUpperCase();
        const hubNameBase = hub.name.split(' ')[0].toLowerCase(); // e.g. "addis" or "adama"

        return (
          itemPlant.includes(hubCode) ||
          itemPlantName.includes(hubNameBase) ||
          (hub.code === 'AA01' && itemPlantName.includes('addis')) // fallback
        );
      });

      const totalQty = hubItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const totalValuation = hubItems.reduce((sum, item) => sum + (Number(item.qty || 0) * (Number(item.unitPrice) || 0)), 0);
      const defectiveQty = hubItems.filter((item) => item.isNotFunctional || item.needsSparePart).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const lineItemsCount = hubItems.length;

      return {
        ...hub,
        totalQty,
        totalValuation,
        defectiveQty,
        lineItemsCount,
        itemsList: hubItems
      };
    });
  }, [items]);

  // Extract unique regions for filter
  const regions = useMemo(() => {
    return ['All', ...Array.from(new Set(EPSS_HUBS_REGISTRY.map((h) => h.region)))];
  }, []);

  // Filter hubs list
  const filteredHubs = useMemo(() => {
    return hubsData.filter((hub) => {
      const matchesSearch =
        hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.manager.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRegion = selectedRegion === 'All' || hub.region === selectedRegion;

      let matchesStock = true;
      if (stockFilter === 'high') {
        matchesStock = hub.totalQty >= 500;
      } else if (stockFilter === 'low') {
        matchesStock = hub.totalQty > 0 && hub.totalQty < 500;
      } else if (stockFilter === 'empty') {
        matchesStock = hub.totalQty === 0;
      }

      return matchesSearch && matchesRegion && matchesStock;
    });
  }, [hubsData, searchQuery, selectedRegion, stockFilter]);

  const selectedHub = useMemo(() => {
    if (!selectedHubCode) return null;
    return hubsData.find((h) => h.code === selectedHubCode) || null;
  }, [hubsData, selectedHubCode]);

  // Overall statistics for all hubs
  const totalStockUnits = useMemo(() => hubsData.reduce((sum, h) => sum + h.totalQty, 0), [hubsData]);
  const totalFinancialValuation = useMemo(() => hubsData.reduce((sum, h) => sum + h.totalValuation, 0), [hubsData]);
  const totalDefects = useMemo(() => hubsData.reduce((sum, h) => sum + h.defectiveQty, 0), [hubsData]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. Header & Quick Overview Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Warehouse className="w-5.5 h-5.5 text-cyan-600" />
            <span>EPSS Logistics Hub Network Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock monitoring, asset valuation, and active maintenance logs across the 19 regional warehouses
          </p>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Warehouse Units</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">
              {formatNumber(totalStockUnits)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active physical stock pieces</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Asset SOH Valuation</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">
              {formatCurrency(totalFinancialValuation)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5 font-semibold">
              Live valuation of stock in transit/hubs
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Defect & Repair Stock</div>
            <div className="text-2xl font-black text-rose-600 mt-0.5 font-mono">
              {formatNumber(totalDefects)}
            </div>
            <div className="text-[10px] text-rose-500 mt-0.5 font-semibold">
              Units flagged for technical verification
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Split Panel (Grid & Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hubs Listing Block */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search hub name, code, or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-cyan-500 focus:bg-white text-slate-800 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Region Filter */}
              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-cyan-500 focus:bg-white text-slate-700 font-semibold"
                >
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      Region: {region}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock Levels Filter Tabs */}
            <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">Capacity Level:</span>
              {(['all', 'high', 'low', 'empty'] as const).map((filter) => {
                const isActive = stockFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setStockFilter(filter)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {filter === 'all' && 'All Hubs'}
                    {filter === 'high' && 'High Stock (≥500)'}
                    {filter === 'low' && 'Low Stock (<500)'}
                    {filter === 'empty' && 'Zero/Unmapped'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hub Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredHubs.length > 0 ? (
              filteredHubs.map((hub) => {
                const isSelected = selectedHubCode === hub.code;
                return (
                  <div
                    key={hub.code}
                    onClick={() => setSelectedHubCode(hub.code)}
                    className={`p-5 rounded-2xl border transition cursor-pointer hover:shadow-md flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-50 border-cyan-500 ring-2 ring-cyan-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold font-mono text-[10px] border border-slate-200">
                          {hub.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {hub.region}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-cyan-600 transition">
                        {hub.name}
                      </h3>

                      <div className="grid grid-cols-2 gap-2.5 pt-2">
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <div className="text-[9px] font-bold text-slate-400 uppercase">SOH Qty</div>
                          <div className="text-sm font-black text-slate-800 font-mono mt-0.5">
                            {formatNumber(hub.totalQty)}
                          </div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Line Items</div>
                          <div className="text-sm font-black text-slate-800 font-mono mt-0.5">
                            {hub.lineItemsCount}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div>
                        <div className="font-semibold text-slate-700">{hub.manager}</div>
                        <div className="text-[10px]">{hub.phone}</div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition ${isSelected ? 'text-cyan-600 translate-x-1' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 bg-white p-12 text-center rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
                <Warehouse className="w-10 h-10 text-slate-300" />
                <div className="text-sm font-bold text-slate-700">No hubs found matching filters</div>
                <div className="text-xs text-slate-400">Try loosening your search query or region tab select.</div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Hub Details Panel */}
        <div className="lg:col-span-1">
          {selectedHub ? (
            <div className="bg-white text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 sticky top-24">
              {/* Hub Title Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px] font-bold font-mono border border-cyan-200">
                    {selectedHub.code}
                  </span>
                  <button
                    onClick={() => setSelectedHubCode(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-base font-black text-slate-900">{selectedHub.name}</h3>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <span>Logistics Division:</span>
                  <span className="text-slate-700 font-semibold">{selectedHub.region}</span>
                </div>
              </div>

              {/* Hub Contacts */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hub Manager:</span>
                  <span className="font-bold text-slate-900">{selectedHub.manager}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telephone:</span>
                  <span className="font-semibold text-slate-800">{selectedHub.phone}</span>
                </div>
              </div>

              {/* Hub Valuation Breakdown */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hub Asset Financials</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Valuation</div>
                    <div className="text-sm font-black text-slate-900 mt-1">
                      {formatCurrency(selectedHub.totalValuation)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Defect Items</div>
                    <div className="text-sm font-black text-rose-600 mt-1">
                      {formatNumber(selectedHub.defectiveQty)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List inside Hub */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    SOH Line Items ({selectedHub.itemsList.length})
                  </h4>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300">
                  {selectedHub.itemsList.length > 0 ? (
                    selectedHub.itemsList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectItem?.(item)}
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-left group shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-cyan-700 font-bold truncate max-w-[80px]">
                            {item.material}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-mono border border-slate-200">
                            {formatNumber(item.qty)} Pcs
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-900 mt-1 line-clamp-1 group-hover:text-cyan-700 transition">
                          {item.materialDescription}
                        </p>
                        <div className="flex items-center justify-between mt-2 text-[9px] text-slate-500">
                          <span>{item.manufacturer || 'OEM Brand'}</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(item.qty * item.unitPrice)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No stock mapped directly to {selectedHub.code} in this dataset.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 h-full min-h-[400px]">
              <div className="p-3 bg-white rounded-full shadow-xs text-slate-400">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800">No Hub Selected</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                  Select any EPSS branch warehouse card to explore detailed stock list and asset values
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
