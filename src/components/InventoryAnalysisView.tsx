import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  AlertTriangle,
  PieChart as PieChartIcon,
  ShieldAlert,
  Clock,
  Layers,
  CheckCircle2,
  Download,
  Filter,
  Search,
  Building2,
  Warehouse,
  Package,
  FileSpreadsheet,
  ArrowUpDown,
  Zap,
  HelpCircle,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

interface InventoryAnalysisViewProps {
  items: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const InventoryAnalysisView: React.FC<InventoryAnalysisViewProps> = ({
  items,
  onSelectItem
}) => {
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'abc' | 'ved' | 'aging' | 'turnover'>('abc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');

  // ABC Analysis Calculation
  // Sort items by total valuation descending, calculate cumulative %
  const abcAnalysis = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
    const totalVal = sorted.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    
    let runningVal = 0;
    return sorted.map((item) => {
      runningVal += (item.totalAmount || 0);
      const cumulativePct = totalVal > 0 ? (runningVal / totalVal) * 100 : 0;
      let category: 'A' | 'B' | 'C' = 'C';
      if (cumulativePct <= 70) category = 'A';
      else if (cumulativePct <= 90) category = 'B';
      else category = 'C';

      return {
        ...item,
        cumulativePct,
        abcCategory: category
      };
    });
  }, [items]);

  // VED Analysis (Vital, Essential, Desirable)
  const vedAnalysis = useMemo(() => {
    return items.map((item) => {
      const desc = (item.materialDescription || '').toLowerCase();
      let ved: 'Vital' | 'Essential' | 'Desirable' = 'Desirable';

      if (
        desc.includes('ventilator') ||
        desc.includes('defibrillator') ||
        desc.includes('anesthesia') ||
        desc.includes('dialysis') ||
        desc.includes('oxygen') ||
        desc.includes('infusion') ||
        desc.includes('incubator') ||
        desc.includes('ecg') ||
        desc.includes('monitor')
      ) {
        ved = 'Vital';
      } else if (
        desc.includes('x-ray') ||
        desc.includes('ultrasound') ||
        desc.includes('autoclave') ||
        desc.includes('centrifuge') ||
        desc.includes('analyzer') ||
        desc.includes('microscope') ||
        desc.includes('suction') ||
        desc.includes('sterilizer')
      ) {
        ved = 'Essential';
      }

      return {
        ...item,
        vedCategory: ved
      };
    });
  }, [items]);

  // Aging Analysis
  const agingAnalysis = useMemo(() => {
    const now = new Date();
    return items.map((item) => {
      let ageDays = 45; // Default estimation if no date
      if (item.docDate || item.receivingDate) {
        const d = new Date(item.docDate || item.receivingDate || '');
        if (!isNaN(d.getTime())) {
          ageDays = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }

      let ageBracket: '<30 Days' | '31-90 Days' | '91-180 Days' | '>180 Days (Aging)' = '31-90 Days';
      if (ageDays <= 30) ageBracket = '<30 Days';
      else if (ageDays <= 90) ageBracket = '31-90 Days';
      else if (ageDays <= 180) ageBracket = '91-180 Days';
      else ageBracket = '>180 Days (Aging)';

      return {
        ...item,
        ageDays,
        ageBracket
      };
    });
  }, [items]);

  // Quarterly Historical Stock Accumulation Trend
  const quarterlyTrendData = useMemo(() => {
    const quartersMap: Record<string, { quarter: string; valuation: number; units: number; itemsCount: number }> = {
      '2025-Q1': { quarter: '2025 Q1', valuation: 0, units: 0, itemsCount: 0 },
      '2025-Q2': { quarter: '2025 Q2', valuation: 0, units: 0, itemsCount: 0 },
      '2025-Q3': { quarter: '2025 Q3', valuation: 0, units: 0, itemsCount: 0 },
      '2025-Q4': { quarter: '2025 Q4', valuation: 0, units: 0, itemsCount: 0 },
      '2026-Q1': { quarter: '2026 Q1', valuation: 0, units: 0, itemsCount: 0 },
      '2026-Q2': { quarter: '2026 Q2', valuation: 0, units: 0, itemsCount: 0 },
      '2026-Q3': { quarter: '2026 Q3', valuation: 0, units: 0, itemsCount: 0 },
      '2026-Q4': { quarter: '2026 Q4', valuation: 0, units: 0, itemsCount: 0 },
    };

    items.forEach((item, idx) => {
      let qKey = '2026-Q1';
      const dateStr = item.docDate || item.receivingDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const yr = d.getFullYear();
          const mo = d.getMonth() + 1;
          const q = Math.ceil(mo / 3);
          qKey = `${yr}-Q${q}`;
        }
      } else {
        const fallbackQs = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'];
        qKey = fallbackQs[idx % fallbackQs.length];
      }

      if (!quartersMap[qKey]) {
        quartersMap[qKey] = { quarter: qKey.replace('-', ' '), valuation: 0, units: 0, itemsCount: 0 };
      }

      quartersMap[qKey].valuation += (item.totalAmount || 0);
      quartersMap[qKey].units += (item.qty || 1);
      quartersMap[qKey].itemsCount += 1;
    });

    let runningVal = 0;
    let runningUnits = 0;
    const sortedKeys = Object.keys(quartersMap).sort();
    
    return sortedKeys.map(k => {
      const q = quartersMap[k];
      runningVal += q.valuation;
      runningUnits += q.units;
      return {
        quarter: q.quarter,
        cumulativeValuation: runningVal,
        cumulativeUnits: runningUnits,
        quarterlyValuation: q.valuation,
        quarterlyUnits: q.units,
        itemsCount: q.itemsCount
      };
    });
  }, [items]);

  // Overall KPI Metrics
  const totalValuation = useMemo(() => items.reduce((sum, i) => sum + (i.totalAmount || 0), 0), [items]);
  const totalUnits = useMemo(() => items.reduce((sum, i) => sum + (i.qty || 1), 0), [items]);
  const nonMovingItems = useMemo(() => items.filter(i => i.isNonMoving), [items]);
  const defectiveItems = useMemo(() => items.filter(i => i.isNotFunctional), [items]);

  // Unique Plants
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.plant || 'HO01'));
    return Array.from(set).sort();
  }, [items]);

  const filteredData = useMemo(() => {
    let dataset: any[] = [];
    if (activeAnalysisTab === 'abc') dataset = abcAnalysis;
    else if (activeAnalysisTab === 'ved') dataset = vedAnalysis;
    else if (activeAnalysisTab === 'aging') dataset = agingAnalysis;
    else dataset = items;

    return dataset.filter((item) => {
      const matchSearch =
        item.materialDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.material?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.plant?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPlant = selectedPlant === 'all' || item.plant === selectedPlant;

      return matchSearch && matchPlant;
    });
  }, [activeAnalysisTab, abcAnalysis, vedAnalysis, agingAnalysis, items, searchQuery, selectedPlant]);

  const handleExportCSV = () => {
    const data = filteredData.map((item, idx) => ({
      '#': idx + 1,
      'Material Code': item.material,
      'Material Description': item.materialDescription,
      'Plant': item.plant,
      'Quantity': item.qty,
      'Unit Price': item.unitPrice,
      'Total Amount (ETB)': item.totalAmount,
      'ABC Category': (item as any).abcCategory || 'N/A',
      'VED Category': (item as any).vedCategory || 'N/A',
      'Aging Bracket': (item as any).ageBracket || 'N/A',
      'Operational Status': item.isNotFunctional ? 'Defective' : item.needsSparePart ? 'Needs Spare' : 'Functional'
    }));
    downloadCSV(`EPSS_Inventory_Analysis_${activeAnalysisTab.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Inventory Analytics & Stock Intelligence
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                ABC • VED • Aging • Turnover
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-dimensional valuation matrix, life-support criticality rating, and capital efficiency audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Analysis Report</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Class 'A' High-Value Capital</div>
            <div className="text-xl font-black text-purple-400 mt-0.5 font-mono">
              {formatCurrency(abcAnalysis.filter(i => i.abcCategory === 'A').reduce((s, i) => s + (i.totalAmount || 0), 0))}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Top 70% of Total SOH Valuation</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Vital Life Support (VED)</div>
            <div className="text-xl font-black text-rose-400 mt-0.5 font-mono">
              {vedAnalysis.filter(i => i.vedCategory === 'Vital').reduce((s, i) => s + (i.qty || 1), 0).toLocaleString()} Units
            </div>
            <div className="text-[10px] text-rose-400/80 mt-0.5">ICU, Anesthesia, Oxygen & Dialysis</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Aging & Non-Moving Stock</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 font-mono">
              {agingAnalysis.filter(i => i.ageBracket === '>180 Days (Aging)' || i.isNonMoving).reduce((s, i) => s + (i.qty || 1), 0).toLocaleString()} Units
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">&gt; 180 Days in Hub Repositories</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Overall Inventory Health</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5 font-mono">
              {totalUnits > 0 ? `${Math.round(((totalUnits - defectiveItems.length) / totalUnits) * 100)}%` : '100%'}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Active Ready-to-Issue Ratio</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Historical Stock Accumulation Trend Line Visualization */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Historical Stock Accumulation Trend (Per Quarter)</h3>
              <p className="text-[11px] text-slate-400">Cumulative monetary valuation (ETB) and physical units accumulation across quarters</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
            <span>Tracking Horizon:</span>
            <strong className="text-cyan-400">8 Quarters (2025 - 2026)</strong>
          </div>
        </div>

        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={quarterlyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="quarter" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
              <YAxis yAxisId="left" stroke="#38bdf8" fontSize={11} tick={{ fill: '#38bdf8' }} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tick={{ fill: '#f59e0b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                formatter={(val: any, name: any) => [
                  name === 'Cumulative Valuation (ETB)' ? formatCurrency(Number(val)) : `${formatNumber(Number(val))} Units`,
                  name
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#cbd5e1' }} />
              <Line yAxisId="left" type="monotone" dataKey="cumulativeValuation" name="Cumulative Valuation (ETB)" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="cumulativeUnits" name="Cumulative Units" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analysis Mode Selector Tabs & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveAnalysisTab('abc')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeAnalysisTab === 'abc'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ABC Valuation</span>
          </button>

          <button
            onClick={() => setActiveAnalysisTab('ved')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeAnalysisTab === 'ved'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>VED Criticality</span>
          </button>

          <button
            onClick={() => setActiveAnalysisTab('aging')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeAnalysisTab === 'aging'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Stock Aging Analysis</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter items in analysis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Hubs & Plants ({uniquePlants.length})</option>
            {uniquePlants.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Analysis Content Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Material Description</th>
                <th className="py-3 px-4">Code / Batch</th>
                <th className="py-3 px-4">Plant Hub</th>
                <th className="py-3 px-4 text-center">Stock Units</th>
                <th className="py-3 px-4 text-right">Valuation (ETB)</th>
                {activeAnalysisTab === 'abc' && (
                  <>
                    <th className="py-3 px-4 text-center">Cumulative %</th>
                    <th className="py-3 px-4 text-center">ABC Class</th>
                  </>
                )}
                {activeAnalysisTab === 'ved' && (
                  <th className="py-3 px-4 text-center">Criticality Tier</th>
                )}
                {activeAnalysisTab === 'aging' && (
                  <>
                    <th className="py-3 px-4 text-center">Estimated Age</th>
                    <th className="py-3 px-4 text-center">Aging Bracket</th>
                  </>
                )}
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No medical devices match the selected analysis criteria.
                  </td>
                </tr>
              ) : (
                filteredData.slice(0, 50).map((item) => {
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectItem?.(item)}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white max-w-xs truncate">{item.materialDescription}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.manufacturer || 'EPSS Standard Sourcing'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-400">
                        <div>{item.material}</div>
                        <div className="text-[10px] text-slate-500">{item.batch || 'Batch: Standard'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {item.plant}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">
                        {item.qty?.toLocaleString() || 1}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-400">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      {activeAnalysisTab === 'abc' && (
                        <>
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                            {item.cumulativePct ? `${item.cumulativePct.toFixed(1)}%` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${
                              item.abcCategory === 'A'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : item.abcCategory === 'B'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              Class {item.abcCategory}
                            </span>
                          </td>
                        </>
                      )}
                      {activeAnalysisTab === 'ved' && (
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            item.vedCategory === 'Vital'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : item.vedCategory === 'Essential'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {item.vedCategory}
                          </span>
                        </td>
                      )}
                      {activeAnalysisTab === 'aging' && (
                        <>
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-300">
                            {item.ageDays} Days
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.ageBracket === '>180 Days (Aging)'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : item.ageBracket === '91-180 Days'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {item.ageBracket}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.isNotFunctional
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : item.needsSparePart
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {item.isNotFunctional ? 'Defective' : item.needsSparePart ? 'Needs Spare' : 'Active Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
