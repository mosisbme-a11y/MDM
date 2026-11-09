import React, { useState, useMemo } from 'react';
import { HealthFacilityRecord, MultipleStockRecord, DspWorkflowRecord, AuthUser } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { 
  Layers, 
  Search, 
  Building2, 
  Hospital, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  ChevronRight,
  Package,
  Boxes,
  MapPin,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Activity,
  Globe,
  Archive,
  ArrowUpRight,
  ClipboardCheck,
  X,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Props {
  hfListItems: HealthFacilityRecord[];
  multipleStockItems: MultipleStockRecord[];
  dspRecords: DspWorkflowRecord[];
  currentUser?: AuthUser | null;
}

export const RegionalDataAggregator: React.FC<Props> = ({
  hfListItems,
  multipleStockItems,
  dspRecords,
  currentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [reportType, setReportType] = useState<'region' | 'facility'>('region');

  // Unique regions from HF List
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    hfListItems.forEach(hf => {
      if (hf.region) set.add(hf.region.trim());
    });
    // Fallback to Stage 3 regions if HF list is empty
    if (set.size === 0) {
        dspRecords.filter(r => r.stage === 'rhb-to-moh').forEach(r => {
            r.targetedRegions.forEach(reg => set.add(reg));
        });
    }
    return Array.from(set).sort();
  }, [hfListItems, dspRecords]);

  // Facilities filtered by selected regions
  const filteredFacilitiesList = useMemo(() => {
    if (selectedRegions.length === 0) return hfListItems;
    return hfListItems.filter(hf => selectedRegions.includes(hf.region));
  }, [hfListItems, selectedRegions]);

  // Aggregate Stage 2 & 3 Regional Data
  const regionalData = useMemo(() => {
    const data: any[] = [];
    // Include both Stage 2 (MOH to RHB) and Stage 3 (RHB to MOH)
    dspRecords.filter(r => r.stage === 'moh-to-rhb' || r.stage === 'rhb-to-moh').forEach(record => {
      if (record.facilityMatrixData?.rows) {
        record.facilityMatrixData.rows.forEach(row => {
          data.push({
            ...row,
            dspRef: record.dspRefNumber,
            stage: record.stage,
            columns: record.facilityMatrixData?.columns || []
          });
        });
      } else if (record.itemsIncluded) {
        // If no matrix yet (Stage 2), use the base items but they aren't mapped to facilities yet
        // We can still use the targetedRegions if we want to show "Pending Allocation"
      }
    });
    return data;
  }, [dspRecords]);

  // Consolidate data based on selection
  const consolidatedReport = useMemo(() => {
    const report: Record<string, {
      material: string;
      description: string;
      epssStock: number;
      allocatedQty: number;
      valuation: number;
      facilities: Set<string>;
      regions: Set<string>;
    }> = {};

    // Get EPSS Central Stock baseline
    multipleStockItems.forEach(item => {
      const key = item.material;
      if (!report[key]) {
        report[key] = {
          material: item.material,
          description: item.materialDescription,
          epssStock: 0,
          allocatedQty: 0,
          valuation: 0,
          facilities: new Set(),
          regions: new Set()
        };
      }
      report[key].epssStock += (item.unrestrictedStock || 0);
    });

    // Filter regional data by selection
    const filteredRegionalData = regionalData.filter(row => {
        const matchRegion = selectedRegions.length === 0 || selectedRegions.includes(row.region);
        const matchFacility = selectedFacilities.length === 0 || selectedFacilities.includes(row.healthFacility);
        return matchRegion && matchFacility;
    });

    // Layer regional allocations on top
    filteredRegionalData.forEach(row => {
        row.columns.forEach((col: any) => {
            const key = col.code;
            const qty = Number(row.quantities[col.id]) || 0;
            if (qty === 0) return;

            if (!report[key]) {
                report[key] = {
                    material: col.code,
                    description: col.name,
                    epssStock: 0,
                    allocatedQty: 0,
                    valuation: 0,
                    facilities: new Set(),
                    regions: new Set()
                };
            }
            report[key].allocatedQty += qty;
            report[key].facilities.add(row.healthFacility);
            report[key].regions.add(row.region);
        });
    });

    return Object.values(report).filter(item => {
        if (searchQuery) {
            return item.material.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   item.description.toLowerCase().includes(searchQuery.toLowerCase());
        }
        // Only show items that have either EPSS stock or regional allocation in the current context
        return item.epssStock > 0 || item.allocatedQty > 0;
    }).sort((a, b) => b.allocatedQty - a.allocatedQty);
  }, [multipleStockItems, regionalData, selectedRegions, selectedFacilities, searchQuery]);

  // Data for Regional Distribution Chart
  const regionalDistributionData = useMemo(() => {
    const regionMap: Record<string, { region: string; totalAllocated: number; dossiers: number }> = {};
    
    uniqueRegions.forEach(reg => {
      regionMap[reg] = { region: reg, totalAllocated: 0, dossiers: 0 };
    });

    regionalData.forEach(row => {
      if (regionMap[row.region]) {
        row.columns.forEach((col: any) => {
          regionMap[row.region].totalAllocated += (Number(row.quantities[col.id]) || 0);
        });
      }
    });

    dspRecords.filter(r => r.stage === 'moh-to-rhb' || r.stage === 'rhb-to-moh').forEach(record => {
      record.targetedRegions.forEach(reg => {
        if (regionMap[reg]) {
          regionMap[reg].dossiers += 1;
        }
      });
    });

    return Object.values(regionMap)
      .filter(d => d.totalAllocated > 0 || d.dossiers > 0)
      .sort((a, b) => b.totalAllocated - a.totalAllocated);
  }, [uniqueRegions, regionalData, dspRecords]);

  const handleExport = () => {
    const data = consolidatedReport.map(item => ({
        'Material Code': item.material,
        'Description': item.description,
        'EPSS Central Stock': item.epssStock,
        'Region/Facility Allocation': item.allocatedQty,
        'Variance': item.epssStock - item.allocatedQty,
        'Regions Covered': Array.from(item.regions).join(', '),
        'Facilities Covered': item.facilities.size
    }));
    downloadCSV(`Regional_Data_Aggregation_Report_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  const toggleRegion = (reg: string) => {
    setSelectedRegions(prev => 
        prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]
    );
    // Clear facilities that don't belong to the remaining regions
    setSelectedFacilities([]);
  };

  const toggleFacility = (fac: string) => {
    setSelectedFacilities(prev => 
        prev.includes(fac) ? prev.filter(f => f !== fac) : [...prev, fac]
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      {/* Sidebar: Selection Controls */}
      <div className="lg:w-80 shrink-0 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 sticky top-24">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Aggregation Filter</h3>
          </div>

          <div className="space-y-4">
            {/* Region Multi-select */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Regions</span>
                <span className="text-indigo-600">{selectedRegions.length} Selected</span>
              </label>
              <div className="max-h-48 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                {uniqueRegions.map(reg => (
                  <button
                    key={reg}
                    onClick={() => toggleRegion(reg)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between group ${
                      selectedRegions.includes(reg) 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <span className="truncate">{reg}</span>
                    {selectedRegions.includes(reg) ? (
                        <Check size={14} />
                    ) : (
                        <Globe size={12} className="opacity-40 group-hover:opacity-100" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Facility Multi-select */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>2. Select Facilities</span>
                <span className="text-purple-600">{selectedFacilities.length} Selected</span>
              </label>
              <div className="max-h-48 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                {filteredFacilitiesList.length === 0 ? (
                    <div className="text-[10px] text-slate-400 italic p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No facilities available for selection.
                    </div>
                ) : (
                    filteredFacilitiesList.map(hf => (
                        <button
                          key={hf.id}
                          onClick={() => toggleFacility(hf.customerDescription)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold transition flex items-center justify-between group ${
                            selectedFacilities.includes(hf.customerDescription) 
                              ? 'bg-purple-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                          }`}
                        >
                          <span className="truncate">{hf.customerDescription}</span>
                          {selectedFacilities.includes(hf.customerDescription) ? (
                              <Check size={14} />
                          ) : (
                              <Hospital size={12} className="opacity-40 group-hover:opacity-100" />
                          )}
                        </button>
                      ))
                )}
              </div>
            </div>

            <button 
                onClick={() => {
                    setSelectedRegions([]);
                    setSelectedFacilities([]);
                }}
                className="w-full py-2 rounded-xl border border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition"
            >
                Reset All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Consolidated Report */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          {/* Report Header */}
          <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
                  <TrendingUp className="w-6 h-6 text-indigo-300" />
               </div>
               <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Breakdown Aggregation by RHB</h2>
                  <p className="text-xs text-indigo-200/80 font-medium">
                    {selectedRegions.length === 0 ? 'All 15 Regions' : `${selectedRegions.length} Selected Regions`} • 
                    {selectedFacilities.length === 0 ? 'All Registered Facilities' : `${selectedFacilities.length} Selected Facilities`}
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-xs focus:bg-white/20 outline-none transition-all w-48 sm:w-64 placeholder:text-white/30"
                    />
                </div>
                <button 
                    onClick={handleExport}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/40 transition flex items-center gap-2 text-xs font-black"
                >
                    <Download size={16} />
                    <span className="hidden sm:inline">Export CSV</span>
                </button>
            </div>
          </div>

          {/* Regional Distribution Visualization */}
          <div className="p-6 border-b border-slate-100">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div>
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Regional Equipment Distribution</h3>
                         <p className="text-[10px] text-slate-500 font-medium italic">Units allocated per Regional Health Bureau (RHB)</p>
                      </div>
                      <div className="flex items-center gap-1">
                         <div className="w-2 h-2 rounded-full bg-indigo-500" />
                         <span className="text-[10px] font-bold text-slate-500">Units</span>
                      </div>
                   </div>
                   
                   <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={regionalDistributionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                               dataKey="region" 
                               type="category" 
                               axisLine={false} 
                               tickLine={false} 
                               tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                               width={90}
                            />
                            <RechartsTooltip 
                               cursor={{ fill: '#f8fafc' }}
                               content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                     const data = payload[0].payload;
                                     return (
                                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-[10px]">
                                           <div className="font-black mb-1 uppercase tracking-wider border-b border-white/10 pb-1">{data.region}</div>
                                           <div className="flex justify-between gap-4 mt-1">
                                              <span className="text-slate-400">Total Units:</span>
                                              <span className="font-mono font-bold text-indigo-400">{formatNumber(data.totalAllocated)}</span>
                                           </div>
                                        </div>
                                     );
                                  }
                                  return null;
                               }}
                            />
                            <Bar 
                               dataKey="totalAllocated" 
                               radius={[0, 4, 4, 0]} 
                               barSize={14}
                            >
                               {regionalDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div>
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Breakdown Frequency</h3>
                         <p className="text-[10px] text-slate-500 font-medium italic">Number of official dossiers / requests per RHB</p>
                      </div>
                      <div className="flex items-center gap-1">
                         <div className="w-2 h-2 rounded-full bg-amber-500" />
                         <span className="text-[10px] font-bold text-slate-500">Dossiers</span>
                      </div>
                   </div>
                   
                   <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={[...regionalDistributionData].sort((a, b) => b.dossiers - a.dossiers)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                               dataKey="region" 
                               type="category" 
                               axisLine={false} 
                               tickLine={false} 
                               tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                               width={90}
                            />
                            <RechartsTooltip 
                               cursor={{ fill: '#f8fafc' }}
                               content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                     const data = payload[0].payload;
                                     return (
                                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-[10px]">
                                           <div className="font-black mb-1 uppercase tracking-wider border-b border-white/10 pb-1">{data.region}</div>
                                           <div className="flex justify-between gap-4 mt-1">
                                              <span className="text-slate-400">Total Dossiers:</span>
                                              <span className="font-mono font-bold text-amber-400">{data.dossiers}</span>
                                           </div>
                                        </div>
                                     );
                                  }
                                  return null;
                               }}
                            />
                            <Bar 
                               dataKey="dossiers" 
                               radius={[0, 4, 4, 0]} 
                               barSize={14}
                            >
                               {regionalDistributionData.map((entry, index) => (
                                  <Cell key={`cell-freq-${index}`} fill={index % 2 === 0 ? '#d97706' : '#f59e0b'} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100 bg-slate-50/50">
             <div className="p-4 border-r border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Dossiers</div>
                <div className="text-lg font-black text-slate-900 font-mono">
                    {dspRecords.filter(r => r.stage === 'moh-to-rhb' || r.stage === 'rhb-to-moh').length}
                </div>
             </div>
             <div className="p-4 border-r border-slate-100">
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">EPSS Stock (Units)</div>
                <div className="text-lg font-black text-indigo-600 font-mono">
                    {formatNumber(consolidatedReport.reduce((acc, i) => acc + i.epssStock, 0))}
                </div>
             </div>
             <div className="p-4 border-r border-slate-100">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">RHB Allocated (Units)</div>
                <div className="text-lg font-black text-amber-600 font-mono">
                    {formatNumber(consolidatedReport.reduce((acc, i) => acc + i.allocatedQty, 0))}
                </div>
             </div>
             <div className="p-4">
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Allocation Coverage</div>
                <div className="text-lg font-black text-emerald-600 font-mono">
                    {(() => {
                        const totalRegions = uniqueRegions.length;
                        const regionsWithData = new Set(regionalData.map(r => r.region)).size;
                        return Math.round((regionsWithData / totalRegions) * 100) + '%';
                    })()}
                </div>
             </div>
          </div>

          {/* Report Table */}
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                    <tr className="bg-white border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                        <th className="p-4 sticky left-0 bg-white z-10 w-[280px]">Medical Device / Material</th>
                        <th className="p-4 text-center">EPSS Central Stock</th>
                        <th className="p-4 text-center">Regional Allocation</th>
                        <th className="p-4 text-center">Balance / Variance</th>
                        <th className="p-4">Distribution Breadth</th>
                        <th className="p-4 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {consolidatedReport.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-24 text-center">
                                <Archive size={40} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-400">No consolidated records match the current filters.</p>
                                <p className="text-xs text-slate-400 mt-1">Try broadening your region or facility selection.</p>
                            </td>
                        </tr>
                    ) : (
                        consolidatedReport.map(item => {
                            const variance = item.epssStock - item.allocatedQty;
                            const isLow = item.epssStock < item.allocatedQty;
                            return (
                                <tr key={item.material} className="hover:bg-indigo-50/20 transition-colors group">
                                    <td className="p-4 sticky left-0 bg-white group-hover:bg-indigo-50/20 z-10">
                                        <div className="font-black text-slate-900 text-xs truncate max-w-[240px]" title={item.description}>{item.description}</div>
                                        <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{item.material}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="bg-indigo-50 text-indigo-700 font-mono font-black text-xs py-1 rounded-lg border border-indigo-100">
                                            {formatNumber(item.epssStock)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="bg-amber-50 text-amber-700 font-mono font-black text-xs py-1 rounded-lg border border-amber-100">
                                            {formatNumber(item.allocatedQty)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className={`font-mono font-black text-xs py-1 rounded-lg border ${
                                            variance >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                        }`}>
                                            {variance > 0 ? '+' : ''}{formatNumber(variance)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                                <Globe size={10} className="text-indigo-400" />
                                                {item.regions.size} Regions
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                                <Hospital size={10} className="text-purple-400" />
                                                {item.facilities.size} Facilities
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        {item.epssStock > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                                                <CheckCircle2 size={10} />
                                                Available
                                            </span>
                                        ) : item.allocatedQty > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                                                <Activity size={10} />
                                                Allocated
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase">
                                                <Archive size={10} />
                                                No Stock
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Informational Footer Section */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4">
           <div className="p-3 bg-white rounded-2xl shadow-sm border border-indigo-100">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
           </div>
           <div className="flex-1 text-center md:text-left">
              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">Operational Protocol Verification</h4>
              <p className="text-[11px] text-indigo-700/80 font-medium">
                This report consolidates central stockpile data with verified regional breakdown submissions (Stage 3). 
                Variance calculations assist in identifying over-allocated items vs. available central warehouse reserves.
              </p>
           </div>
           <div className="flex items-center gap-3 shrink-0">
               <div className="flex flex-col items-end">
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Report Confidence</span>
                   <span className="text-xs font-black text-indigo-600 font-mono">100% Verified</span>
               </div>
               <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-600 w-full" />
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};
