import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Boxes,
  Upload,
  Sparkles,
  Layers,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  Check,
  Package,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  CircleDot,
  Percent,
  ArrowRight,
  Coins,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MultipleStockRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { parseMultipleStockWorkbook } from './MultipleStockUploadModal';
import { PlantSourceDataModal, PlantBreakdownMetrics } from './PlantSourceDataModal';
import { DashboardSourceDataModal } from './DashboardSourceDataModal';

/**
 * Classifies a MultipleStockRecord into RDF (Revolving Drug Fund) or HP (Health Program)
 * Excel / SAP EPSS Standard:
 * - Special Stock Type 'Q' = Health Program (HP)
 * - Special Stock Type Blank / Empty = Revolving Drug Fund (RDF)
 */
export function getRdfHpCategory(item: MultipleStockRecord): 'RDF' | 'HP' {
  const sType = (item.specialStockType || '').trim();

  // Primary Rule: Special Stock Type 'Q' from Excel represents Health Program (HP)
  if (sType.toUpperCase() === 'Q' || sType.toUpperCase().startsWith('Q')) {
    return 'HP';
  }

  // Primary Rule: Special Stock Type Blank / Empty from Excel represents Revolving Drug Fund (RDF)
  if (
    sType === '' ||
    sType === '-' ||
    sType === '--' ||
    sType.toLowerCase() === 'blank' ||
    sType.toLowerCase() === 'none' ||
    sType.toLowerCase() === 'standard' ||
    sType.toLowerCase() === 'rdf' ||
    sType.toLowerCase() === 'normal'
  ) {
    return 'RDF';
  }

  // Secondary indicator checks
  if (/\b(q|hp|health\s*program|program|project|donation|grant|unicef|usaid|gf|global fund)\b/i.test(sType)) {
    return 'HP';
  }

  const wbs = (item.wbsElement || '').toLowerCase();
  if (wbs.includes('hp') || wbs.includes('project') || wbs.includes('donation')) {
    return 'HP';
  }

  return 'RDF';
}

interface MultipleStockAnalyticsProps {
  multipleStockItems: MultipleStockRecord[];
  onUploadMultipleStockData?: (records: MultipleStockRecord[], mode?: 'append' | 'replace') => void;
  isSidebarCollapsed?: boolean;
  hideWhenEmpty?: boolean;
  hideUpload?: boolean;
  showHighValuationTable?: boolean;
  onNavigateToMultipleStock?: () => void;
  hideNavigateToMultipleStock?: boolean;
  plantFilter?: string | string[];
  onPlantFilterChange?: (plant: string | string[]) => void;
  groupFilter?: string;
  onGroupFilterChange?: (group: string) => void;
  streamFilter?: 'all' | 'RDF' | 'HP';
  onStreamFilterChange?: (stream: 'all' | 'RDF' | 'HP') => void;
}

export const DashboardViewMultipleStockAnalytics: React.FC<MultipleStockAnalyticsProps> = ({
  multipleStockItems,
  onUploadMultipleStockData,
  isSidebarCollapsed,
  hideWhenEmpty = false,
  hideUpload = false,
  showHighValuationTable = false,
  onNavigateToMultipleStock,
  hideNavigateToMultipleStock = false,
  plantFilter,
  onPlantFilterChange,
  groupFilter,
  onGroupFilterChange,
  streamFilter,
  onStreamFilterChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalPlantFilter, setInternalPlantFilter] = useState<string | string[]>('all');
  const [internalGroupFilter, setInternalGroupFilter] = useState<string>('all');
  const [internalStreamFilter, setInternalStreamFilter] = useState<'all' | 'RDF' | 'HP'>('all');

  const selectedPlantFilter = plantFilter !== undefined ? plantFilter : internalPlantFilter;
  const setSelectedPlantFilter = (action: React.SetStateAction<string | string[]>) => {
    const nextVal = typeof action === 'function' ? action(selectedPlantFilter) : action;
    setInternalPlantFilter(nextVal);
    onPlantFilterChange?.(nextVal);
  };
  const selectedGroupFilter = groupFilter !== undefined ? groupFilter : internalGroupFilter;
  const setSelectedGroupFilter = (action: React.SetStateAction<string>) => {
    const nextVal = typeof action === 'function' ? action(selectedGroupFilter) : action;
    setInternalGroupFilter(nextVal);
    onGroupFilterChange?.(nextVal);
  };
  const selectedStreamFilter = streamFilter !== undefined ? streamFilter : internalStreamFilter;
  const setSelectedStreamFilter = (action: React.SetStateAction<'all' | 'RDF' | 'HP'>) => {
    const nextVal = typeof action === 'function' ? action(selectedStreamFilter) : action;
    setInternalStreamFilter(nextVal);
    onStreamFilterChange?.(nextVal);
  };
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'rdf-hp' | 'group' | 'status' | 'plants' | 'plant-metrics'>('all');
  const [rdfCircleMetric, setRdfCircleMetric] = useState<'valuation' | 'units'>('valuation');
  const [hoveredSlice, setHoveredSlice] = useState<'RDF' | 'HP' | null>(null);
  const [selectedPlantForModal, setSelectedPlantForModal] = useState<PlantBreakdownMetrics | null>(null);
  const [hiddenChartIds, setHiddenChartIds] = useState<string[]>([]);

  const toggleHideChart = (id: string) => {
    setHiddenChartIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenPlantSourceData = (plantData: PlantBreakdownMetrics) => {
    setSelectedPlantForModal(plantData);
  };

  const [sourceDataModal, setSourceDataModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    badge?: string;
    multipleStockRecords?: MultipleStockRecord[];
    initialStreamFilter?: 'all' | 'RDF' | 'HP';
    initialStatusFilter?: string;
    initialPlantFilter?: string;
  }>({
    isOpen: false,
    title: ''
  });

  const handleOpenSourceDataModal = (options: {
    title: string;
    subtitle?: string;
    badge?: string;
    records?: MultipleStockRecord[];
    streamFilter?: 'all' | 'RDF' | 'HP';
    statusFilter?: string;
    plantFilter?: string;
  }) => {
    setSourceDataModal({
      isOpen: true,
      title: options.title,
      subtitle: options.subtitle || 'Underlying multiple stock records filtered from your dashboard selection.',
      badge: options.badge || 'Multiple Stock Source Data',
      multipleStockRecords: options.records || filteredItems,
      initialStreamFilter: options.streamFilter || 'all',
      initialStatusFilter: options.statusFilter || 'all',
      initialPlantFilter: options.plantFilter || 'all'
    });
  };

  const selectedPlantList = useMemo(() => {
    if (!selectedPlantFilter || selectedPlantFilter === 'all') return [];
    if (Array.isArray(selectedPlantFilter)) return selectedPlantFilter;
    if (typeof selectedPlantFilter === 'string') {
      return selectedPlantFilter.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [selectedPlantFilter]);

  // Filtered dataset based on quick analytics filters (Plant, Group, and RDF vs HP Fund Stream)
  const filteredItems = useMemo(() => {
    return multipleStockItems.filter(item => {
      const matchPlant = selectedPlantList.length === 0 || selectedPlantList.includes('all') || selectedPlantList.some(p => p.toLowerCase() === item.plant?.toLowerCase());
      const matchGroup = selectedGroupFilter === 'all' || item.materialGroupName === selectedGroupFilter;
      const matchStream = selectedStreamFilter === 'all' || getRdfHpCategory(item) === selectedStreamFilter;
      return matchPlant && matchGroup && matchStream;
    });
  }, [multipleStockItems, selectedPlantList, selectedGroupFilter, selectedStreamFilter]);

  // Unique plants and groups for dropdowns
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    multipleStockItems.forEach(i => { if (i.plant) set.add(i.plant); });
    return Array.from(set).sort();
  }, [multipleStockItems]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    multipleStockItems.forEach(i => { if (i.materialGroupName) set.add(i.materialGroupName); });
    return Array.from(set).sort();
  }, [multipleStockItems]);

  // Total Value of RDF and HP Circle Graph Data
  const msRdfHpCircleData = useMemo(() => {
    let rdfVal = 0;
    let rdfUnits = 0;
    let rdfCount = 0;
    let rdfUnrestricted = 0;
    let rdfBlocked = 0;
    let rdfInspection = 0;
    let rdfUnrestrictedVal = 0;
    let rdfBlockedVal = 0;
    let rdfInspectionVal = 0;

    let hpVal = 0;
    let hpUnits = 0;
    let hpCount = 0;
    let hpUnrestricted = 0;
    let hpBlocked = 0;
    let hpInspection = 0;
    let hpUnrestrictedVal = 0;
    let hpBlockedVal = 0;
    let hpInspectionVal = 0;

    filteredItems.forEach(item => {
      const cat = getRdfHpCategory(item);
      const valUnres = item.currentValueOfUnrestrictedStock || 0;
      const valBlock = item.valueOfBlockedStock || 0;
      const valInsp = item.valueOfStockInQualityInspection || 0;
      const val = valUnres + valBlock + valInsp;

      const unresUnits = item.unrestrictedStock || 0;
      const blockUnits = item.blockedStock || 0;
      const inspUnits = item.stockInQualityInspection || 0;
      const units = unresUnits + blockUnits + inspUnits;

      if (cat === 'RDF') {
        rdfVal += val;
        rdfUnits += units;
        rdfCount++;
        rdfUnrestricted += unresUnits;
        rdfBlocked += blockUnits;
        rdfInspection += inspUnits;
        rdfUnrestrictedVal += valUnres;
        rdfBlockedVal += valBlock;
        rdfInspectionVal += valInsp;
      } else {
        hpVal += val;
        hpUnits += units;
        hpCount++;
        hpUnrestricted += unresUnits;
        hpBlocked += blockUnits;
        hpInspection += inspUnits;
        hpUnrestrictedVal += valUnres;
        hpBlockedVal += valBlock;
        hpInspectionVal += valInsp;
      }
    });

    const totalVal = rdfVal + hpVal;
    const rdfPct = totalVal > 0 ? Number(((rdfVal / totalVal) * 100).toFixed(1)) : 0;
    const hpPct = totalVal > 0 ? Number(((hpVal / totalVal) * 100).toFixed(1)) : 0;

    const totalUnits = rdfUnits + hpUnits;
    const rdfUnitsPct = totalUnits > 0 ? Number(((rdfUnits / totalUnits) * 100).toFixed(1)) : 0;
    const hpUnitsPct = totalUnits > 0 ? Number(((hpUnits / totalUnits) * 100).toFixed(1)) : 0;

    return {
      rdf: {
        valuation: rdfVal,
        percentage: rdfPct,
        units: rdfUnits,
        unitsPercentage: rdfUnitsPct,
        count: rdfCount,
        unrestricted: rdfUnrestricted,
        blocked: rdfBlocked,
        inspection: rdfInspection,
        unrestrictedVal: rdfUnrestrictedVal,
        blockedVal: rdfBlockedVal,
        inspectionVal: rdfInspectionVal
      },
      hp: {
        valuation: hpVal,
        percentage: hpPct,
        units: hpUnits,
        unitsPercentage: hpUnitsPct,
        count: hpCount,
        unrestricted: hpUnrestricted,
        blocked: hpBlocked,
        inspection: hpInspection,
        unrestrictedVal: hpUnrestrictedVal,
        blockedVal: hpBlockedVal,
        inspectionVal: hpInspectionVal
      },
      totalValuation: totalVal,
      totalUnits: totalUnits,
      rdfUnitsPercentage: rdfUnitsPct,
      hpUnitsPercentage: hpUnitsPct,
      chartData: [
        {
          key: 'RDF' as const,
          name: 'RDF (Revolving Drug Fund)',
          shortName: 'RDF Stock',
          value: rdfVal,
          percentage: rdfPct,
          units: rdfUnits,
          itemsCount: rdfCount,
          color: '#059669', // Emerald
          legendColor: 'bg-emerald-600'
        },
        {
          key: 'HP' as const,
          name: 'HP (Health Program)',
          shortName: 'HP Stock',
          value: hpVal,
          percentage: hpPct,
          units: hpUnits,
          itemsCount: hpCount,
          color: '#4f46e5', // Indigo
          legendColor: 'bg-indigo-600'
        }
      ]
    };
  }, [filteredItems]);

  // Pie chart dataset for RDF vs HP Circle Graph
  const rdfHpPieData = useMemo(() => {
    const isVal = rdfCircleMetric === 'valuation';
    const valRdf = msRdfHpCircleData.rdf.valuation;
    const valHp = msRdfHpCircleData.hp.valuation;
    const unitsRdf = msRdfHpCircleData.rdf.units;
    const unitsHp = msRdfHpCircleData.hp.units;

    const value1 = isVal ? valRdf : unitsRdf;
    const value2 = isVal ? valHp : unitsHp;
    const isBothZero = value1 === 0 && value2 === 0;

    return [
      {
        key: 'RDF' as const,
        name: 'RDF (Revolving Drug Fund)',
        shortName: 'RDF Stock',
        value: isBothZero ? 1 : value1,
        realValue: value1,
        valuation: valRdf,
        units: unitsRdf,
        percentage: isVal ? msRdfHpCircleData.rdf.percentage : msRdfHpCircleData.rdfUnitsPercentage,
        color: '#059669',
        hoverColor: '#10b981',
        isZero: value1 === 0
      },
      {
        key: 'HP' as const,
        name: 'HP (Health Program)',
        shortName: 'HP Stock',
        value: isBothZero ? 1 : value2,
        realValue: value2,
        valuation: valHp,
        units: unitsHp,
        percentage: isVal ? msRdfHpCircleData.hp.percentage : msRdfHpCircleData.hpUnitsPercentage,
        color: '#4f46e5',
        hoverColor: '#6366f1',
        isZero: value2 === 0
      }
    ];
  }, [rdfCircleMetric, msRdfHpCircleData]);

  // Aggregate metrics
  const msTotalValue = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      return sum + (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
    }, 0);
  }, [filteredItems]);

  const msTotalQuantity = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      return sum + (item.unrestrictedStock || 0) + (item.blockedStock || 0) + (item.stockInQualityInspection || 0);
    }, 0);
  }, [filteredItems]);

  const msUnrestrictedQty = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.unrestrictedStock || 0), 0);
  }, [filteredItems]);

  const msQualityInspectionQty = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.stockInQualityInspection || 0), 0);
  }, [filteredItems]);

  const msBlockedQty = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.blockedStock || 0), 0);
  }, [filteredItems]);

  // Stock status chart data
  const msStockStatusData = useMemo(() => {
    return [
      { name: 'Unrestricted', value: msUnrestrictedQty, color: '#059669', label: 'Ready for Dispatch' },
      { name: 'Quality Inspection', value: msQualityInspectionQty, color: '#eab308', label: 'Under QA Testing' },
      { name: 'Blocked Stock', value: msBlockedQty, color: '#ef4444', label: 'Restricted / Hold' },
    ];
  }, [msUnrestrictedQty, msQualityInspectionQty, msBlockedQty]);

  // Value by Material Group (Donut / Pie)
  const msValueCircleChartData = useMemo(() => {
    const groupVal: Record<string, number> = {};
    filteredItems.forEach(item => {
      const g = item.materialGroupName || item.specialStockType || 'General Devices';
      const val = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
      groupVal[g] = (groupVal[g] || 0) + val;
    });
    const total = msTotalValue || 1;
    const colors = ['#0891b2', '#059669', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#14b8a6', '#64748b'];
    return Object.entries(groupVal)
      .map(([name, val], idx) => ({
        name,
        value: val,
        percentage: Number(((val / total) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredItems, msTotalValue]);

  // Line Items by Special Stock Type / RDF vs HP
  const msRdfBarChartData = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    filteredItems.forEach(item => {
      const sType = (item.specialStockType || '').trim();
      const label = (sType.toUpperCase() === 'Q' || sType.toUpperCase().startsWith('Q'))
        ? 'Q (HP Stock)'
        : (sType === '' || sType.toLowerCase() === 'standard' || sType.toLowerCase() === 'blank')
        ? 'Blank (RDF Stock)'
        : `${sType} Stock`;
      if (!counts[label]) counts[label] = new Set();
      counts[label].add(item.material || item.id);
    });
    return Object.entries(counts)
      .map(([rdf, set]) => ({
        name: rdf,
        count: set.size
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  // Plant-by-Plant valuation breakdown (Unrestricted, In Transit, QC, Unique Materials)
  const msPlantBarChartData = useMemo(() => {
    const plantVals: Record<string, { valuation: number; unrestrictedValuation: number; inTransitValuation: number; qcValuation: number; rdfValuation: number; hpValuation: number; units: number; items: MultipleStockRecord[] }> = {};
    filteredItems.forEach(item => {
      const p = item.plant || 'Central HO';
      if (!plantVals[p]) plantVals[p] = { valuation: 0, unrestrictedValuation: 0, inTransitValuation: 0, qcValuation: 0, rdfValuation: 0, hpValuation: 0, units: 0, items: [] };
      const unrestrictVal = item.currentValueOfUnrestrictedStock || 0;
      const transitVal = item.valueOfBlockedStock || 0;
      const qcVal = item.valueOfStockInQualityInspection || 0;
      const val = unrestrictVal + transitVal + qcVal;
      const units = (item.unrestrictedStock || 0) + (item.blockedStock || 0) + (item.stockInQualityInspection || 0);
      
      const cat = getRdfHpCategory(item);
      plantVals[p].valuation += val;
      plantVals[p].unrestrictedValuation += unrestrictVal;
      plantVals[p].inTransitValuation += transitVal;
      plantVals[p].qcValuation += qcVal;
      plantVals[p].units += units;
      plantVals[p].items.push(item);
      
      if (cat === 'RDF') {
        plantVals[p].rdfValuation += val;
      } else {
        plantVals[p].hpValuation += val;
      }
    });
    return Object.entries(plantVals)
      .map(([plant, data]): PlantBreakdownMetrics => ({
        name: plant,
        displayName: plant,
        valuation: data.valuation,
        units: data.units,
        lineItems: data.items.length,
        unrestrictedValuation: data.unrestrictedValuation,
        inTransitValuation: data.inTransitValuation,
        qcValuation: data.qcValuation,
        uniqueMaterials: new Set(data.items.map(i => i.material || i.materialDescription)).size,
        rdfValuation: data.rdfValuation,
        rdfUnits: 0,
        rdfLineItems: data.items.filter(i => getRdfHpCategory(i) === 'RDF').length,
        hpValuation: data.hpValuation,
        hpUnits: 0,
        hpLineItems: data.items.filter(i => getRdfHpCategory(i) === 'HP').length,
        items: data.items
      }))
      .sort((a, b) => b.valuation - a.valuation);
  }, [filteredItems]);

  // Top 5 Highest Valuation Items
  const topValuedItems = useMemo(() => {
    return [...filteredItems]
      .sort((a, b) => {
        const valA = (a.currentValueOfUnrestrictedStock || 0) + (a.valueOfBlockedStock || 0) + (a.valueOfStockInQualityInspection || 0);
        const valB = (b.currentValueOfUnrestrictedStock || 0) + (b.valueOfBlockedStock || 0) + (b.valueOfStockInQualityInspection || 0);
        return valB - valA;
      });
  }, [filteredItems]);

  // Handle Quick File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const allParsed: MultipleStockRecord[] = [];
      for (const file of Array.from(files)) {
        let wb: XLSX.WorkBook;
        if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
          const text = await file.text();
          wb = XLSX.read(text, { type: 'string' });
        } else {
          const buffer = await file.arrayBuffer();
          wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        }
        const parsed = parseMultipleStockWorkbook(wb, file.name);
        if (parsed && parsed.length > 0) {
          allParsed.push(...parsed);
        }
      }
      if (allParsed.length > 0 && onUploadMultipleStockData) {
        onUploadMultipleStockData(allParsed, 'replace');
      }
    } catch (err) {
      console.error('Failed to parse multiple stock workbook', err);
    }
    e.target.value = '';
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    const data = filteredItems.map((item, idx) => ({
      '#': idx + 1,
      'Material': item.material,
      'Description': item.materialDescription,
      'Plant': item.plant,
      'Storage Location': item.storageLocation,
      'Special Stock Type': item.specialStockType || 'Blank (RDF)',
      'Fund Stream': getRdfHpCategory(item) === 'HP' ? 'HP (Health Program)' : 'RDF (Revolving Drug Fund)',
      'Unrestricted Qty': item.unrestrictedStock,
      'Inspection Qty': item.stockInQualityInspection,
      'Blocked Qty': item.blockedStock,
      'Valuation ETB': (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0),
      'Material Group': item.materialGroupName,
      'WBS Element': item.wbsElement
    }));
    downloadCSV(`Multiple_Stock_Analytics_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  // =========================================================================
  // EMPTY STATE (When no multiple stock items have been loaded)
  // Ensures the section is ALWAYS visible both of collapse and expand!
  // =========================================================================
  if (multipleStockItems.length === 0) {
    if (hideWhenEmpty) {
      return null;
    }
    return (
      <div className="w-full min-w-0 max-w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl border-2 border-indigo-400/40 shadow-xl p-6 sm:p-8 space-y-6 mt-6 transition-all duration-300">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          onChange={handleFileUpload}
          className="sr-only"
        />

        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300 shadow-inner shrink-0">
              <Boxes className="w-7 h-7 text-indigo-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/50 text-indigo-200 border border-indigo-400/40 font-mono">
                  Dashboard View Module
                </span>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                  Multiple Stock Analytics & Multi-Plant Ledger
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Auto-Save Online & Active</span>
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-1">
                Visual stock intelligence across all 14 attributes: Blank = Revolving Drug Fund (RDF), Q = Health Program (HP) under Special Stock Type.
              </p>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!hideUpload && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-950/60 cursor-pointer"
                title="Upload Multiple Stock spreadsheet (.xlsx, .csv)"
              >
                <Upload className="w-4 h-4 animate-bounce" />
                <span>Upload Stock Spreadsheet</span>
              </button>
            )}

          </div>
        </div>

        {/* Metric Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 w-full min-w-0">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Total Valuation</div>
            <div className="text-xl font-mono font-black text-white mt-1">ETB 0.00</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Aggregated multiple stock value</p>
          </div>
          <div className="bg-white/5 border border-emerald-400/20 rounded-xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">RDF Stock Valuation</div>
            <div className="text-xl font-mono font-black text-emerald-300 mt-1">ETB 0.00</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Special Stock: Blank</p>
          </div>
          <div className="bg-white/5 border border-indigo-400/20 rounded-xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">HP Stock Valuation</div>
            <div className="text-xl font-mono font-black text-indigo-300 mt-1">ETB 0.00</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Special Stock: Q</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Unrestricted Stock</div>
            <div className="text-xl font-mono font-black text-teal-400 mt-1">0 Units</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Ready for distribution</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">QA & Blocked</div>
            <div className="text-xl font-mono font-black text-amber-400 mt-1">0 Units</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Under test or quarantine</p>
          </div>
        </div>

        {/* Preview Circle Graph for RDF & HP Valuation in Empty State */}
        <div className="bg-white/5 border border-indigo-400/25 rounded-xl p-5 backdrop-blur-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* SVG Donut Circle Graph Preview */}
            <div className="relative w-28 h-28 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.08)" strokeWidth="14" fill="transparent" />
                <circle cx="50" cy="50" r="38" stroke="#059669" strokeWidth="14" strokeDasharray="120 239" strokeDashoffset="0" fill="transparent" />
                <circle cx="50" cy="50" r="38" stroke="#4f46e5" strokeWidth="14" strokeDasharray="119 239" strokeDashoffset="-120" fill="transparent" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">Total Value</span>
                <span className="text-xs font-mono font-black text-white">ETB 0.00</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-black text-white">RDF vs HP Total Value Circle Graph</h4>
              </div>
              <p className="text-xs text-indigo-200 mt-1 max-w-md">
                Excel Rule: Special Stock Type <strong>Blank</strong> = Revolving Drug Fund (RDF), and <strong>Q</strong> = Health Program (HP).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-left">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] font-bold text-emerald-300">RDF (Blank Stock)</span>
              </div>
              <div className="text-sm font-mono font-black text-white mt-0.5">ETB 0.00</div>
              <span className="text-[10px] text-emerald-400/80 font-mono">0.0% of Total</span>
            </div>
            <div className="bg-indigo-950/40 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-left">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <span className="text-[11px] font-bold text-indigo-300">HP (Q Stock)</span>
              </div>
              <div className="text-sm font-mono font-black text-white mt-0.5">ETB 0.00</div>
              <span className="text-[10px] text-indigo-400/80 font-mono">0.0% of Total</span>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-indigo-400/20 rounded-xl p-4 text-center text-xs text-indigo-200">
          ✓ <strong>Auto-Save Active:</strong> Upload your multiple stock spreadsheet (.xlsx, .csv). All 14 columns and plant records will be automatically saved in real-time across both Dashboard and Multiple Stock views without any automatic clearing.
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE ANALYTICS VIEW (When Multiple Stock records are present)
  // Engineered with min-w-0 and xl:grid-cols-2 so it looks pristine both
  // when sidebar is COLLAPSED and when sidebar is EXPANDED!
  // =========================================================================
  return (
    <div className="w-full min-w-0 max-w-full bg-white rounded-2xl border-2 border-indigo-200 shadow-md p-5 sm:p-6 space-y-6 mt-6 transition-all duration-300">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.ods"
        onChange={handleFileUpload}
        className="sr-only"
      />

      {/* Primary Header & Action Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs shrink-0">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white font-mono shadow-xs">
                Multiple Stock Active
              </span>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900">
                Multiple Stock Analytics Dashboard
              </h3>
              <span className="hidden px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                {multipleStockItems.length.toLocaleString()} Recorded Rows
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                14 Attributes Tracked
              </span>
              <span className="hidden px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-mono shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Auto-Saved Online & Offline ({uniquePlants.length} Plants)</span>
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 mt-1">
              Multi-plant inventory distribution across Ethiopia EPSS hubs. Blank = RDF, Q = HP under Special Stock Type.
            </p>
          </div>
        </div>

        {/* Quick Filter & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Plant Filter */}
          {uniquePlants.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-600">Plant:</span>
              <select
                value={selectedPlantFilter}
                onChange={(e) => setSelectedPlantFilter(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">All Plants ({uniquePlants.length})</option>
                {uniquePlants.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Material Group Filter */}
          {uniqueGroups.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-600">Group:</span>
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 focus:outline-none cursor-pointer text-xs max-w-[140px] truncate"
              >
                <option value="all">All Groups ({uniqueGroups.length})</option>
                {uniqueGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {/* Fund Stream Filter (RDF vs HP) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="font-bold text-slate-600">Fund:</span>
            <select
              value={selectedStreamFilter}
              onChange={(e) => setSelectedStreamFilter(e.target.value as 'all' | 'RDF' | 'HP')}
              className="bg-transparent font-bold text-indigo-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Funds (RDF & HP)</option>
              <option value="RDF">RDF — Blank Stock ({msRdfHpCircleData.rdf.count})</option>
              <option value="HP">HP — Q Stock ({msRdfHpCircleData.hp.count})</option>
            </select>
          </div>

          {/* Reset filter */}
          {(selectedPlantFilter !== 'all' || selectedGroupFilter !== 'all' || selectedStreamFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setSelectedPlantFilter('all'); setSelectedGroupFilter('all'); setSelectedStreamFilter('all'); }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Reset
            </button>
          )}

          {/* Quick upload trigger */}
          {!hideUpload && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Upload new Multiple Stock records"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden">Upload</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export filtered Multiple Stock analytics dataset"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export CSV</span>
          </button>

          {/* Navigate to Multiple Stock Tab */}
          {onNavigateToMultipleStock && !hideNavigateToMultipleStock && (
            <button
              type="button"
              id="btn-navigate-to-multiple-stock-assets"
              onClick={onNavigateToMultipleStock}
              className="btn-assets-table-multiple-stock px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open Multiple Stock View to view full asset tables and records"
            >
              <Boxes className="w-3.5 h-3.5 text-indigo-600" />
              <span>Assets Table in Multiple Stock →</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Level Metric KPI Cards (Highlights Total Valuation, RDF Total Value, and HP Total Value) */}
      <div className="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 w-full min-w-0">
        {/* Total Valuation */}
        <div className="bg-gradient-to-br from-indigo-50 via-white to-slate-50 border border-indigo-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">Total Valuation</span>
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-indigo-950 font-mono mt-1">{formatCurrency(msTotalValue)}</p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-indigo-100">
            <span>Filtered Total</span>
            <span className="font-bold text-indigo-700 font-mono">{filteredItems.length} lines</span>
          </div>
        </div>

        {/* RDF Total Valuation */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/30 border border-emerald-300 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">RDF Total Value</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              {msRdfHpCircleData.rdf.percentage}%
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-800 font-mono mt-1">{formatCurrency(msRdfHpCircleData.rdf.valuation)}</p>
          <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-2 pt-1.5 border-t border-emerald-200/60 font-medium">
            <span>RDF (Blank Special Stock)</span>
            <span className="font-mono font-bold">{formatNumber(msRdfHpCircleData.rdf.units)} Units</span>
          </div>
        </div>

        {/* HP Total Valuation */}
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 border border-indigo-300 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">HP Total Value</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
              {msRdfHpCircleData.hp.percentage}%
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-indigo-800 font-mono mt-1">{formatCurrency(msRdfHpCircleData.hp.valuation)}</p>
          <div className="flex items-center justify-between text-[10px] text-indigo-700 mt-2 pt-1.5 border-t border-indigo-200/60 font-medium">
            <span>HP (Q Special Stock)</span>
            <span className="font-mono font-bold">{formatNumber(msRdfHpCircleData.hp.units)} Units</span>
          </div>
        </div>

        {/* Unrestricted Stock */}
        <div className="bg-gradient-to-br from-teal-50 via-white to-slate-50 border border-teal-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-teal-900 tracking-wider">Unrestricted Stock</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-teal-700 font-mono mt-1">{formatNumber(msUnrestrictedQty)}</p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-teal-100">
            <span>Ready for Delivery</span>
            <span className="font-bold text-teal-700 font-mono">
              {msTotalQuantity > 0 ? `${((msUnrestrictedQty / msTotalQuantity) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* QA & Blocked Stock */}
        <div className="bg-gradient-to-br from-amber-50 via-white to-rose-50/20 border border-amber-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider">QA & Blocked Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 font-mono mt-1">{formatNumber(msQualityInspectionQty + msBlockedQty)}</p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-amber-100 font-mono">
            <span>QA: {formatNumber(msQualityInspectionQty)}</span>
            <span>Blocked: {formatNumber(msBlockedQty)}</span>
          </div>
        </div>
      </div>

      {/* High-Valuation Multiple Stock Assets Table (Rendered only when showHighValuationTable is true, e.g. inside Multiple Stock view) */}
      {showHighValuationTable && topValuedItems.length > 0 && (
        <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                High-Valuation Multiple Stock Assets
              </h4>
            </div>
            <span className="text-[11px] font-bold text-slate-500 font-mono">Ranked by total recorded valuation</span>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                  <th className="pb-2 pt-1 px-2">Material</th>
                  <th className="pb-2 pt-1 px-2">Description</th>
                  <th className="pb-2 pt-1 px-2">Plant</th>
                  <th className="pb-2 pt-1 px-2 text-right">Unrestricted</th>
                  <th className="pb-2 pt-1 px-2 text-right">Total Value (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {topValuedItems.map((item, idx) => {
                  const val = (item.currentValueOfUnrestrictedStock || 0) + (item.valueOfBlockedStock || 0) + (item.valueOfStockInQualityInspection || 0);
                  return (
                    <tr key={idx} className="hover:bg-indigo-50/50 transition">
                      <td className="py-2 px-2 text-indigo-700 font-bold">{item.material}</td>
                      <td className="py-2 px-2 font-sans font-medium text-slate-900 max-w-[240px] truncate">{item.materialDescription}</td>
                      <td className="py-2 px-2 text-slate-700">{item.plant}</td>
                      <td className="py-2 px-2 text-right text-emerald-700 font-bold">{formatNumber(item.unrestrictedStock)}</td>
                      <td className="py-2 px-2 text-right font-black text-slate-900">{formatCurrency(val)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FEATURED: TOTAL VALUE OF RDF AND HP FOR MULTIPLE STOCK (CIRCLE GRAPH)     */}
      {/* Prominently visible on Dashboard view with interactive donut, metrics,   */}
      {/* and comparative balance stream analysis                                  */}
      {/* ========================================================================= */}
      {!hiddenChartIds.includes('multiple-stock-rdf-hp-circle-graph') && (
        <div
          id="multiple-stock-rdf-hp-circle-graph"
          onDoubleClick={() => handleOpenSourceDataModal({
            title: 'Source Data: Total Value of RDF & HP',
            subtitle: 'Granular Multiple Stock inventory records classified across Revolving Drug Fund (RDF) and Health Program (HP).'
          })}
          title="Double-click to view underlying source data records"
          className={`bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 border-2 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 w-full min-w-0 transition-all cursor-pointer ${
            activeChartTab === 'rdf-hp' ? 'border-emerald-400 ring-4 ring-emerald-100 shadow-md' : 'border-indigo-200/90'
          }`}
        >
          {/* Card Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-600 text-white shadow-xs shrink-0">
                <PieChartIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                    ● Circle Graph
                  </span>
                  <h4 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                    Total Value of RDF and HP for Multiple Stock
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                    {formatCurrency(msRdfHpCircleData.totalValuation)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparative monetary valuation and inventory distribution between Revolving Drug Fund (RDF) and Health Program (HP) stocks.
                </p>
              </div>
            </div>

            {/* Metric Selector & Filter Status */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleHideChart('multiple-stock-rdf-hp-circle-graph'); }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Hide component from view"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setRdfCircleMetric('valuation')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  rdfCircleMetric === 'valuation'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Show Total Monetary Valuation (ETB)"
              >
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Valuation (ETB)</span>
              </button>
              <button
                type="button"
                onClick={() => setRdfCircleMetric('units')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  rdfCircleMetric === 'units'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Show Physical Quantity (Units)"
              >
                <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                <span>Physical Units</span>
              </button>
            </div>
          </div>
        </div>

        {/* Circle Graph Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Donut Circle Graph */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="h-64 sm:h-72 w-full max-w-[320px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                <PieChart>
                  <Pie
                    data={rdfHpPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={104}
                    paddingAngle={3}
                    cornerRadius={6}
                    onMouseEnter={(_, index) => setHoveredSlice(index === 0 ? 'RDF' : 'HP')}
                    onMouseLeave={() => setHoveredSlice(null)}
                    onClick={(entry: any) => setSelectedStreamFilter(prev => prev === entry.key ? 'all' : entry.key)}
                    cursor="pointer"
                  >
                    {rdfHpPieData.map((entry, index) => (
                      <Cell
                        key={`rdf-hp-circle-cell-${index}`}
                        fill={entry.color}
                        stroke="#ffffff"
                        strokeWidth={hoveredSlice === entry.key ? 3 : 2}
                        className="transition-all duration-200 cursor-pointer"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleOpenSourceDataModal({
                            title: `Source Data: ${entry.name}`,
                            streamFilter: entry.key as 'RDF' | 'HP',
                            subtitle: `Multiple stock line items belonging to ${entry.name}.`
                          });
                        }}
                        style={{
                          filter: hoveredSlice === entry.key ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))' : undefined,
                          outline: 'none'
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any, item: any) => [
                      rdfCircleMetric === 'valuation'
                        ? `${formatCurrency(Number(item.payload.valuation))} (${item.payload.percentage}%)`
                        : `${formatNumber(Number(item.payload.units))} Units (${item.payload.percentage}%)`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#fff',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic Center Hole Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className={`text-[10px] font-black uppercase tracking-wider transition-colors duration-200 ${
                  hoveredSlice === 'RDF' ? 'text-emerald-600' : hoveredSlice === 'HP' ? 'text-indigo-600' : 'text-slate-500'
                }`}>
                  {hoveredSlice === 'RDF' ? 'RDF Stock' : hoveredSlice === 'HP' ? 'HP Stock' : 'Total Valuation'}
                </span>
                <span className={`font-mono font-black tracking-tight leading-tight transition-all duration-200 ${
                  hoveredSlice ? 'text-base sm:text-lg text-slate-900' : 'text-sm sm:text-base text-slate-900'
                }`}>
                  {hoveredSlice === 'RDF'
                    ? (rdfCircleMetric === 'valuation' ? formatCurrency(msRdfHpCircleData.rdf.valuation) : `${formatNumber(msRdfHpCircleData.rdf.units)} Units`)
                    : hoveredSlice === 'HP'
                    ? (rdfCircleMetric === 'valuation' ? formatCurrency(msRdfHpCircleData.hp.valuation) : `${formatNumber(msRdfHpCircleData.hp.units)} Units`)
                    : (rdfCircleMetric === 'valuation' ? formatCurrency(msRdfHpCircleData.totalValuation) : `${formatNumber(msRdfHpCircleData.totalUnits)} Units`)
                  }
                </span>
                <span className={`text-[10px] font-bold font-mono transition-colors duration-200 ${
                  hoveredSlice === 'RDF' ? 'text-emerald-700' : hoveredSlice === 'HP' ? 'text-indigo-700' : 'text-slate-500'
                }`}>
                  {hoveredSlice === 'RDF'
                    ? `${msRdfHpCircleData.rdf.percentage}% of Multi-Stock`
                    : hoveredSlice === 'HP'
                    ? `${msRdfHpCircleData.hp.percentage}% of Multi-Stock`
                    : '100% Multiple Stock'
                  }
                </span>
              </div>
            </div>

            {/* Clickable Micro Legend */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-200 text-xs w-full">
              <button
                type="button"
                onClick={() => setSelectedStreamFilter(prev => prev === 'RDF' ? 'all' : 'RDF')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition cursor-pointer text-xs font-semibold ${
                  selectedStreamFilter === 'RDF'
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900 ring-2 ring-emerald-300'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50'
                }`}
                title="Click to isolate RDF records (Special Stock: Blank)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                <span>RDF (Blank):</span>
                <span className="font-mono text-emerald-800 font-bold">{formatCurrency(msRdfHpCircleData.rdf.valuation)}</span>
                <span className="text-[10px] text-slate-500 font-mono">({msRdfHpCircleData.rdf.percentage}%)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStreamFilter(prev => prev === 'HP' ? 'all' : 'HP')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition cursor-pointer text-xs font-semibold ${
                  selectedStreamFilter === 'HP'
                    ? 'bg-indigo-100 border-indigo-400 text-indigo-900 ring-2 ring-indigo-300'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50'
                }`}
                title="Click to isolate HP records (Special Stock: Q)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
                <span>HP (Q):</span>
                <span className="font-mono text-indigo-800 font-bold">{formatCurrency(msRdfHpCircleData.hp.valuation)}</span>
                <span className="text-[10px] text-slate-500 font-mono">({msRdfHpCircleData.hp.percentage}%)</span>
              </button>
            </div>
          </div>

          {/* Right Column: Comparative Stream Detail Cards */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* RDF Card */}
              <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/30 border-2 border-emerald-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <h5 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
                      Revolving Drug Fund (RDF)
                    </h5>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Blank Stock • {msRdfHpCircleData.rdf.percentage}%
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  Special Stock: <strong>Blank</strong> in Excel
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Recorded Total Value</div>
                  <p className="text-lg sm:text-xl font-black text-emerald-800 font-mono">
                    {formatCurrency(msRdfHpCircleData.rdf.valuation)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Physical Units</span>
                    <span className="font-mono font-bold text-slate-800">{formatNumber(msRdfHpCircleData.rdf.units)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Distinct SKUs</span>
                    <span className="font-mono font-bold text-slate-800">{formatNumber(msRdfHpCircleData.rdf.count)} lines</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-emerald-100 text-[10px] flex items-center justify-between text-slate-600">
                  <span>Unrestricted: <strong className="text-emerald-700 font-mono">{formatNumber(msRdfHpCircleData.rdf.unrestricted)}</strong></span>
                  <span>QA / Blocked: <strong className="text-amber-700 font-mono">{formatNumber(msRdfHpCircleData.rdf.inspection + msRdfHpCircleData.rdf.blocked)}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStreamFilter(prev => prev === 'RDF' ? 'all' : 'RDF')}
                  className="w-full py-1 rounded-lg text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>{selectedStreamFilter === 'RDF' ? 'Showing RDF Only (Click to Clear)' : 'Filter Dashboard to RDF Stock'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* HP Card */}
              <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/30 border-2 border-indigo-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <h5 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                      Health Program (HP)
                    </h5>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                    Q Stock • {msRdfHpCircleData.hp.percentage}%
                  </span>
                </div>
                <div className="text-[10px] text-indigo-700 font-medium">
                  Special Stock: <strong>Q</strong> in Excel
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Recorded Total Value</div>
                  <p className="text-lg sm:text-xl font-black text-indigo-800 font-mono">
                    {formatCurrency(msRdfHpCircleData.hp.valuation)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-indigo-100">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Physical Units</span>
                    <span className="font-mono font-bold text-slate-800">{formatNumber(msRdfHpCircleData.hp.units)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Distinct SKUs</span>
                    <span className="font-mono font-bold text-slate-800">{formatNumber(msRdfHpCircleData.hp.count)} lines</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-indigo-100 text-[10px] flex items-center justify-between text-slate-600">
                  <span>Unrestricted: <strong className="text-indigo-700 font-mono">{formatNumber(msRdfHpCircleData.hp.unrestricted)}</strong></span>
                  <span>QA / Blocked: <strong className="text-amber-700 font-mono">{formatNumber(msRdfHpCircleData.hp.inspection + msRdfHpCircleData.hp.blocked)}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStreamFilter(prev => prev === 'HP' ? 'all' : 'HP')}
                  className="w-full py-1 rounded-lg text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>{selectedStreamFilter === 'HP' ? 'Showing HP Only (Click to Clear)' : 'Filter Dashboard to HP Stock'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Horizontal Balance Progress Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-800">RDF (Blank): {msRdfHpCircleData.rdf.percentage}%</span>
                  <span className="text-slate-400 font-mono">({formatCurrency(msRdfHpCircleData.rdf.valuation)})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono">({formatCurrency(msRdfHpCircleData.hp.valuation)})</span>
                  <span className="font-bold text-indigo-800">HP (Q): {msRdfHpCircleData.hp.percentage}%</span>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${msRdfHpCircleData.rdf.percentage}%` }}
                  title={`RDF Blank Stock Share: ${msRdfHpCircleData.rdf.percentage}%`}
                ></div>
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${msRdfHpCircleData.hp.percentage}%` }}
                  title={`HP Q Stock Share: ${msRdfHpCircleData.hp.percentage}%`}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Revolving Commercial Operations (Blank)</span>
                <span>Health Programs & Projects (Q)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Visual Analytics Chart Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
            Visual Analytics Portfolio
          </h4>
          {hiddenChartIds.length > 0 && (
            <button
              type="button"
              onClick={() => setHiddenChartIds([])}
              className="px-2.5 py-1 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Restore all hidden chart components"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Restore Hidden Components ({hiddenChartIds.length})</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveChartTab('all')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
              activeChartTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Charts
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveChartTab('rdf-hp');
              document.getElementById('multiple-stock-rdf-hp-circle-graph')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs flex items-center gap-1.5 ${
              activeChartTab === 'rdf-hp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <PieChartIcon className="w-3 h-3" />
            <span>RDF & HP Circle Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('group')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
              activeChartTab === 'group' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-cyan-700'
            }`}
          >
            Material Groups
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('status')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
              activeChartTab === 'status' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Stock Status
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('plants')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
              activeChartTab === 'plants' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            Plant Holdings
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('plant-metrics')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
              activeChartTab === 'plant-metrics' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            Value, RDF & Qty
          </button>
        </div>
      </div>

      {/* Visual Analytics Charts Grid (xl:grid-cols-2 ensures stability on collapse and expand) */}
      <div id="multiple-stock-charts-container" className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
        {/* Chart 1: Valuation by Material Group */}
        {(activeChartTab === 'all' || activeChartTab === 'group') && !hiddenChartIds.includes('ms-pie-chart-card') && (
          <div
            id="ms-pie-chart-card"
            onDoubleClick={() => handleOpenSourceDataModal({
              title: 'Source Data: Total Stock Valuation by Material Group',
              subtitle: 'Catalog items and inventory valuation aggregated across all EPSS material groups.'
            })}
            title="Double-click to view underlying source data records"
            className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between w-full min-w-0 overflow-hidden shadow-2xs cursor-pointer hover:border-cyan-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition-transform" />
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  Total Stock Valuation by Material Group
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 font-mono">{msValueCircleChartData.length} Groups</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleHideChart('ms-pie-chart-card'); }}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title="Hide component from view"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            <div className="h-64 sm:h-72 w-full min-w-0 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                <PieChart>
                  <Pie
                    data={msValueCircleChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={35}
                    paddingAngle={2}
                  >
                    {msValueCircleChartData.map((entry, index) => (
                      <Cell
                        key={`ms-pie-${index}`}
                        fill={entry.color}
                        className="cursor-pointer hover:opacity-80"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleOpenSourceDataModal({
                            title: `Source Data: Material Group — ${entry.name}`,
                            statusFilter: entry.name,
                            subtitle: `Multiple stock records under material group '${entry.name}'.`
                          });
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Valuation (ETB)']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '0.75rem', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Micro Legend */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-200 text-[10px]">
              {msValueCircleChartData.map((entry, idx) => (
                <div
                  key={idx}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleOpenSourceDataModal({
                      title: `Source Data: Material Group — ${entry.name}`,
                      statusFilter: entry.name
                    });
                  }}
                  className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-slate-200 cursor-pointer hover:border-cyan-400 transition"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                  <span className="font-semibold text-slate-700 truncate max-w-[110px]">{entry.name}</span>
                  <span className="font-mono text-slate-500">({entry.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart 2: Stock Status Distribution */}
        {(activeChartTab === 'all' || activeChartTab === 'status') && !hiddenChartIds.includes('ms-bar-chart-card') && (
          <div
            id="ms-bar-chart-card"
            onDoubleClick={() => handleOpenSourceDataModal({
              title: 'Source Data: Stock Status Distribution',
              subtitle: 'Catalog line items classified by operational inventory status.'
            })}
            title="Double-click to view underlying source data records"
            className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between w-full min-w-0 overflow-hidden shadow-2xs cursor-pointer hover:border-emerald-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  Stock Status Quantity (Physical Units)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-emerald-700">{formatNumber(msTotalQuantity)} Total</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleHideChart('ms-bar-chart-card'); }}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title="Hide component from view"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full min-w-0 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                <BarChart data={msStockStatusData} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val: any) => [formatNumber(Number(val)) + ' Units', 'Quantity']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '0.75rem', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {msStockStatusData.map((entry, index) => (
                      <Cell
                        key={`status-bar-${index}`}
                        fill={entry.color}
                        className="cursor-pointer hover:opacity-85"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleOpenSourceDataModal({
                            title: `Source Data: Stock Status — ${entry.name}`,
                            subtitle: `Items currently categorized under ${entry.name}.`
                          });
                        }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[10px] text-center font-bold">
              <div
                onDoubleClick={() => handleOpenSourceDataModal({ title: 'Source Data: Unrestricted Stock' })}
                className="text-emerald-700 bg-emerald-50 py-1 rounded cursor-pointer hover:bg-emerald-100 transition"
              >
                Unrestricted: {formatNumber(msUnrestrictedQty)}
              </div>
              <div
                onDoubleClick={() => handleOpenSourceDataModal({ title: 'Source Data: Quality Inspection Stock' })}
                className="text-amber-700 bg-amber-50 py-1 rounded cursor-pointer hover:bg-amber-100 transition"
              >
                QA Test: {formatNumber(msQualityInspectionQty)}
              </div>
              <div
                onDoubleClick={() => handleOpenSourceDataModal({ title: 'Source Data: Blocked Stock' })}
                className="text-rose-700 bg-rose-50 py-1 rounded cursor-pointer hover:bg-rose-100 transition"
              >
                Blocked: {formatNumber(msBlockedQty)}
              </div>
            </div>
          </div>
        )}


        
        {/* Chart 5: Stock Analysis per Plant (Stacked Valuation Bars + Unique Materials Line Overlay) */}
        {(activeChartTab === 'all' || activeChartTab === 'plant-metrics') && !hiddenChartIds.includes('ms-plant-chart-card') && (
          <div 
            id="ms-plant-chart-card"
            onDoubleClick={() => {
              if (msPlantBarChartData.length > 0) {
                handleOpenPlantSourceData(msPlantBarChartData[0]);
              }
            }}
            title="Double-click to view source records across all plant hubs"
            className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white border-2 border-indigo-400/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between w-full min-w-0 overflow-hidden shadow-xl xl:col-span-2 cursor-pointer hover:border-indigo-300 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-indigo-800/80 pb-3">
              <div 
                className="flex items-center gap-2.5 group/title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (msPlantBarChartData.length > 0) {
                    handleOpenPlantSourceData(msPlantBarChartData[0]);
                  }
                }}
                title="Double-click to view source records across all plant hubs"
              >
                <div className="p-2 rounded-xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300 group-hover/title:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black uppercase tracking-wide text-white group-hover/title:text-indigo-200 transition-colors">
                    Stock Analysis per Plant
                  </h4>
                  <p className="text-[11px] text-indigo-300/80 font-normal">
                    💡 Double-click anywhere on this card or any hub bar to view underlying source data
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-mono bg-indigo-900/80 px-3 py-1.5 rounded-xl border border-indigo-700/60">
                  <span className="text-indigo-300">Total Plants:</span>
                  <span className="font-bold text-white">{msPlantBarChartData.length} Hubs</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleHideChart('ms-plant-chart-card'); }}
                  className="p-1.5 rounded-xl bg-indigo-900/80 hover:bg-indigo-800 text-indigo-300 hover:text-white border border-indigo-700/60 transition cursor-pointer"
                  title="Hide component from view"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div 
              className="h-[520px] w-full min-w-0 relative bg-slate-950/40 p-4 rounded-xl border border-indigo-500/20"
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (msPlantBarChartData.length > 0) {
                  handleOpenPlantSourceData(msPlantBarChartData[0]);
                }
              }}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                <BarChart 
                  data={msPlantBarChartData} 
                  margin={{ top: 20, right: 30, left: 10, bottom: 65 }}
                  onDoubleClick={() => {
                    if (msPlantBarChartData.length > 0) {
                      handleOpenPlantSourceData(msPlantBarChartData[0]);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 600 }} 
                    interval={0} 
                    angle={-30} 
                    textAnchor="end"
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    tickFormatter={(val) => val >= 1e9 ? `${(val / 1e9).toFixed(1)}B` : val >= 1e6 ? `${(val / 1e6).toFixed(0)}M` : val}
                    label={{ value: 'Value (ETB)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#38bdf8" 
                    tick={{ fontSize: 10, fill: '#38bdf8' }}
                    label={{ value: 'Unique Materials', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === 'Unique Materials' ? `${formatNumber(Number(val))} SKUs` : formatCurrency(Number(val)),
                      name
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#e2e8f0' }} />
                  <Bar yAxisId="left" dataKey="unrestrictedValuation" name="Unrestricted (ETB)" stackId="valuation" fill="#10b981" radius={[0, 0, 0, 0]} onDoubleClick={(data) => handleOpenPlantSourceData(data as unknown as PlantBreakdownMetrics)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  <Bar yAxisId="left" dataKey="inTransitValuation" name="In Transit (ETB)" stackId="valuation" fill="#d97706" radius={[0, 0, 0, 0]} onDoubleClick={(data) => handleOpenPlantSourceData(data as unknown as PlantBreakdownMetrics)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  <Bar yAxisId="left" dataKey="qcValuation" name="In QC (ETB)" stackId="valuation" fill="#ef4444" radius={[4, 4, 0, 0]} onDoubleClick={(data) => handleOpenPlantSourceData(data as unknown as PlantBreakdownMetrics)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  <Line yAxisId="right" type="monotone" dataKey="uniqueMaterials" name="Unique Materials" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4, fill: '#38bdf8' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-indigo-200/90 pt-3 border-t border-indigo-800/80 gap-2 font-medium">
              <span>📊 <strong>Left Axis:</strong> Stock Valuation in ETB (Unrestricted, In Transit, In QC Stacked)</span>
              <span>📈 <strong>Right Axis:</strong> Unique Materials (SKU Count Line Overlay)</span>
            </div>
          </div>
        )}
      </div>

      {/* High-Valuation Multiple Stock Assets displayed prominently above */}
      
      {/* Plant Source Data Modal */}
      <PlantSourceDataModal 
        isOpen={!!selectedPlantForModal}
        onClose={() => setSelectedPlantForModal(null)}
        plantData={selectedPlantForModal}
        allPlants={msPlantBarChartData}
        onSelectPlant={handleOpenPlantSourceData}
      />

      {/* Multiple Stock Source Data Inspection Modal */}
      <DashboardSourceDataModal
        isOpen={sourceDataModal.isOpen}
        onClose={() => setSourceDataModal(prev => ({ ...prev, isOpen: false }))}
        title={sourceDataModal.title}
        subtitle={sourceDataModal.subtitle}
        badge={sourceDataModal.badge}
        mode="multiple-stock"
        multipleStockRecords={sourceDataModal.multipleStockRecords}
        initialStreamFilter={sourceDataModal.initialStreamFilter}
        initialStatusFilter={sourceDataModal.initialStatusFilter}
        initialPlantFilter={sourceDataModal.initialPlantFilter}
      />
    </div>
  );
};
