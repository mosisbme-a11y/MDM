import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Building2,
  PackageCheck,
  Filter,
  CheckCircle2,
  DollarSign,
  Layers,
  ChevronDown,
  Download,
  RefreshCw,
  FileText,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Truck,
  ArrowUpRight,
  Boxes,
  HelpCircle,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { ReceivingDataRecord, MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { ExportChartsModal } from './ExportChartsModal';
import { exportElementAsPNG } from '../utils/chartExport';
import { DashboardSourceDataModal } from './DashboardSourceDataModal';
import { isMovementType641 } from '../data/defaultReceivingData';

interface ReceivingDataAnalyticsSectionProps {
  receivingRecords?: ReceivingDataRecord[];
  items?: MedicalDeviceItem[];
  onNavigateTab?: (tab: string) => void;
  onOpenUploadModal?: () => void;
  className?: string;
  isDashboardEmbedded?: boolean;
}

// Plant code to friendly name lookup in EPSS network
export const EPSS_PLANT_NAMES: Record<string, string> = {
  AA01: 'Addis Ababa (Central)',
  BD01: 'Bahir Dar Hub',
  HW01: 'Hawassa Hub',
  MK01: 'Mekelle Hub',
  JM01: 'Jimma Hub',
  DR01: 'Dire Dawa Hub',
  AD01: 'Adama Hub',
  AS01: 'Assosa Hub',
  GB01: 'Gambella Hub',
  SD01: 'Semera Hub',
  NK01: 'Nekemte Hub',
  GS01: 'Gonder Hub',
  DB01: 'Debre Berhan Hub',
  DD01: 'Dilla Hub',
  HG01: 'Hawzen Hub',
  SR01: 'Shire Hub',
  JJ01: 'Jijiga Hub',
  RO01: 'Robe Hub'
};

/**
 * Determine if a receiving record belongs to RDF (Revolving Drug Fund) or Health Program (HP).
 * Standard SAP ERP MM / EPSS Business Rules:
 * - Special Stock 'Q' represents Project / Grant / Health Program Stock (GF, WB, GAVI, MOH Program)
 * - Blank / Empty Special Stock represents Revolving Drug Fund (RDF) commercial procurement
 */
export function getReceivingProgramType(record: Partial<ReceivingDataRecord>): 'RDF' | 'HP' {
  const specialStock = (record.specialStock || '').trim().toUpperCase();
  const wbs = (record.wbsElement || '').toUpperCase();
  const valType = (record.valuationType || '').toUpperCase();
  const supplier = (record.supplier || '').toUpperCase();

  // 1. Primary SAP rule: Special Stock indicator 'Q' is Health Program (HP) Project Stock
  if (specialStock === 'Q' || specialStock.startsWith('Q')) {
    return 'HP';
  }

  // 2. Explicit RDF markers in WBS or Valuation Type
  if (wbs.includes('RDF') || valType.includes('RDF') || supplier.includes('RDF') || wbs.includes('REVOLVING')) {
    return 'RDF';
  }

  // 3. Health Program markers in WBS, valuation type, or supplier
  if (
    wbs.includes('GF') ||
    wbs.includes('WB') ||
    wbs.includes('GAVI') ||
    wbs.includes('MNCH') ||
    wbs.includes('COVID') ||
    wbs.includes('HSDP') ||
    wbs.includes('MOH-') ||
    valType.includes('DONATION') ||
    supplier.includes('GLOBAL FUND') ||
    supplier.includes('UNICEF') ||
    supplier.includes('WHO') ||
    supplier.includes('GAVI')
  ) {
    return 'HP';
  }

  // 4. Default: Blank special stock in EPSS SAP MM represents Revolving Drug Fund (RDF)
  return 'RDF';
}

/**
 * Helper to parse various SAP entry dates and ISO dates safely
 */
export function parseReceivingDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

// Color palettes
const RDF_COLOR = '#10b981'; // Emerald
const HP_COLOR = '#8b5cf6';  // Indigo / Purple
const TOTAL_COLOR = '#0ea5e9'; // Sky Blue
const UNITS_COLOR = '#f59e0b'; // Amber

const PIE_COLORS = [
  '#10b981', // RDF - Emerald
  '#8b5cf6', // HP - Purple
  '#0ea5e9', // Sky Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#f97316'  // Orange
];

export interface ReceivingBarChartItem {
  key: string;
  label: string;
  plant?: string;
  plantName?: string;
  periodKey?: string;
  periodLabel?: string;
  rdfVal: number;
  rdfUnits: number;
  hpVal: number;
  hpUnits: number;
  procure101Val: number;
  donated501Val: number;
  totalVal: number;
  totalUnits: number;
  consignments: number;
  uniqueMaterials: number;
  sortTime?: number;
}

export const ReceivingDataAnalyticsSection: React.FC<ReceivingDataAnalyticsSectionProps> = ({
  receivingRecords = [],
  items = [],
  onNavigateTab,
  onOpenUploadModal,
  className = '',
  isDashboardEmbedded = false
}) => {
  // Filter States
  const [timePreset, setTimePreset] = useState<'all' | 'last-30' | 'last-90' | 'ytd' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [programFilter, setProgramFilter] = useState<'all' | 'RDF' | 'HP'>('all');
  const [plantFilter, setPlantFilter] = useState<string>('all');
  
  // View & Metric controls
  const [metricMode, setMetricMode] = useState<'value' | 'quantity' | 'dual'>('value');
  const [barChartGrouping, setBarChartGrouping] = useState<'plant' | 'time'>('plant');
  const [pieChartTarget, setPieChartTarget] = useState<'program' | 'plant'>('program');
  const [showDataTable, setShowDataTable] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isQuickExporting, setIsQuickExporting] = useState(false);

  // 1. Resolve Active Records (Use uploaded receiving records, or synthesize from master inventory)
  const activeRecords: ReceivingDataRecord[] = useMemo(() => {
    if (receivingRecords && receivingRecords.length > 0) {
      return receivingRecords;
    }

    // Fallback: Synthesize from MedicalDeviceItem[] if no receiving records exist
    return items.map((item, index) => {
      const recDate = item.receivingDate || item.docDate || (
        new Date(Date.now() - (index * 86400000 * 2)).toISOString().split('T')[0]
      );
      const poNum = item.poNumber || `PO-MOH-${4500128000 + (index % 500)}`;
      const mvt = (index % 5 === 0) ? '105' : '101';
      const mvtText = mvt === '105' ? 'Release from GR blk' : 'GR goods receipt';
      const isHpItem = (index % 3 === 0) || (item.specialStockType === 'Q');

      return {
        id: `rec-synth-${item.id || index}`,
        entryDate: recDate,
        purchaseOrder: poNum,
        material: item.material || `MAT-100${200 + index}`,
        materialDescription: item.materialDescription || 'Medical Device Equipment',
        quantity: item.qty || 1,
        baseUnitOfMeasure: 'EA',
        storageLocation: item.storageLocation || (index % 4 === 0 ? 'SL02' : 'SL01'),
        amtInLocCur: item.totalAmount || (item.unitPrice ? item.unitPrice * (item.qty || 1) : 250000),
        movementType: mvt,
        userName: (index % 3 === 0) ? 'ALEMU_T' : (index % 3 === 1) ? 'KASSAHUN_A' : 'TIGIST_W',
        valuationType: item.inventoryValuationType || (isHpItem ? 'DONATION_GF' : 'NEW_EQUIP'),
        specialStock: isHpItem ? 'Q' : '',
        wbsElement: isHpItem ? 'ET-MOH-GF-2026-01' : 'EPSS-RDF-REVOLVING-01',
        supplier: isHpItem ? 'Global Fund / MOH Program' : 'Direct International Tender / RDF',
        plant: item.plant || (['AA01', 'BD01', 'HW01', 'MK01', 'JM01', 'DR01'][index % 6]),
        movementTypeText: mvtText,
        qtyInUnitOfEntry: item.qty || 1,
        unitOfEntry: 'EA',
        documentDate: recDate,
        timeOfEntry: '10:30:00',
        materialDocYear: '2026',
        currency: 'ETB',
        sourceFile: 'Synthesized from Inventory Master'
      };
    });
  }, [receivingRecords, items]);

  // List of unique plants in the data
  const availablePlants = useMemo(() => {
    const pSet = new Set<string>();
    activeRecords.forEach(r => {
      if (r.plant) pSet.add(r.plant);
    });
    return Array.from(pSet).sort();
  }, [activeRecords]);

  // Determine latest record date to anchor relative presets
  const anchorDate = useMemo(() => {
    let latest = new Date(0);
    activeRecords.forEach(r => {
      const d = parseReceivingDate(r.entryDate || r.documentDate);
      if (d && d > latest) latest = d;
    });
    return latest.getTime() > 0 ? latest : new Date();
  }, [activeRecords]);

  // 2. Filtered Records based on Time Period, Program Type (RDF vs HP), and Plant
  const filteredRecords = useMemo(() => {
    return activeRecords.filter(record => {
      // Plant Filter
      if (plantFilter !== 'all' && record.plant !== plantFilter) {
        return false;
      }

      // Program Type Filter
      const progType = getReceivingProgramType(record);
      if (programFilter !== 'all' && progType !== programFilter) {
        return false;
      }

      // Time Period Filter
      const recDate = parseReceivingDate(record.entryDate || record.documentDate);
      if (recDate) {
        if (timePreset === 'last-30') {
          const past30 = new Date(anchorDate);
          past30.setDate(anchorDate.getDate() - 30);
          if (recDate < past30) return false;
        } else if (timePreset === 'last-90') {
          const past90 = new Date(anchorDate);
          past90.setDate(anchorDate.getDate() - 90);
          if (recDate < past90) return false;
        } else if (timePreset === 'ytd') {
          const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
          if (recDate < yearStart) return false;
        } else if (timePreset === 'custom') {
          if (startDate) {
            const s = new Date(startDate);
            if (recDate < s) return false;
          }
          if (endDate) {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            if (recDate > e) return false;
          }
        }
      }

      return true;
    });
  }, [activeRecords, plantFilter, programFilter, timePreset, startDate, endDate, anchorDate]);

  // 3. High Level Aggregations
  const stats = useMemo(() => {
    let totalVal = 0;
    let totalUnits = 0;
    let rdfVal = 0;
    let rdfUnits = 0;
    let rdfCount = 0;
    let hpVal = 0;
    let hpUnits = 0;
    let hpCount = 0;

    filteredRecords.forEach(rec => {
      const val = Number(rec.amtInLocCur) || 0;
      const qty = Number(rec.quantity) || Number(rec.qtyInUnitOfEntry) || 0;
      const prog = getReceivingProgramType(rec);

      totalVal += val;
      totalUnits += qty;

      if (prog === 'RDF') {
        rdfVal += val;
        rdfUnits += qty;
        rdfCount += 1;
      } else {
        hpVal += val;
        hpUnits += qty;
        hpCount += 1;
      }
    });

    const rdfValPct = totalVal > 0 ? ((rdfVal / totalVal) * 100).toFixed(1) : '0.0';
    const hpValPct = totalVal > 0 ? ((hpVal / totalVal) * 100).toFixed(1) : '0.0';
    const rdfUnitsPct = totalUnits > 0 ? ((rdfUnits / totalUnits) * 100).toFixed(1) : '0.0';
    const hpUnitsPct = totalUnits > 0 ? ((hpUnits / totalUnits) * 100).toFixed(1) : '0.0';

    return {
      totalVal,
      totalUnits,
      totalRecords: filteredRecords.length,
      rdfVal,
      rdfUnits,
      rdfCount,
      rdfValPct,
      rdfUnitsPct,
      hpVal,
      hpUnits,
      hpCount,
      hpValPct,
      hpUnitsPct
    };
  }, [filteredRecords]);

  // 4. Aggregations By Plant (For Bar Graph & Plant Breakdown)
  const plantBarData: ReceivingBarChartItem[] = useMemo(() => {
    const map: Record<string, ReceivingBarChartItem & { items: ReceivingDataRecord[] }> = {};

    filteredRecords.forEach(rec => {
      const mvt = String(rec.movementType || '').trim();
      if (isMovementType641(mvt)) return;
      if (mvt && !(mvt === '101' || mvt === '501' || mvt.startsWith('101') || mvt.startsWith('501'))) {
        return;
      }

      const p = rec.plant || 'Unassigned';
      if (!map[p]) {
        map[p] = {
          key: p,
          label: p,
          plant: p,
          plantName: EPSS_PLANT_NAMES[p] || `Plant ${p}`,
          rdfVal: 0,
          rdfUnits: 0,
          hpVal: 0,
          hpUnits: 0,
          procure101Val: 0,
          donated501Val: 0,
          totalVal: 0,
          totalUnits: 0,
          consignments: 0,
          uniqueMaterials: 0,
          items: []
        };
      }

      const val = Number(rec.amtInLocCur) || 0;
      const qty = Number(rec.quantity) || Number(rec.qtyInUnitOfEntry) || 0;
      const prog = getReceivingProgramType(rec);

      map[p].totalVal += val;
      map[p].totalUnits += qty;
      map[p].consignments += 1;
      map[p].items.push(rec);

      if (prog === 'RDF') {
        map[p].rdfVal += val;
        map[p].rdfUnits += qty;
      } else {
        map[p].hpVal += val;
        map[p].hpUnits += qty;
      }

      if (mvt === '101') {
        map[p].procure101Val += val;
      } else if (mvt === '501' || mvt.toLowerCase().includes('donate') || mvt.toLowerCase().includes('501')) {
        map[p].donated501Val += val;
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        uniqueMaterials: new Set(item.items.map(i => i.material || i.materialDescription)).size
      }))
      .sort((a, b) => b.totalVal - a.totalVal);
  }, [filteredRecords]);

  // 5. Aggregations By Time Period (For Time-series Bar Graph)
  const timeBarData: ReceivingBarChartItem[] = useMemo(() => {
    const map: Record<string, ReceivingBarChartItem & { items: ReceivingDataRecord[] }> = {};

    filteredRecords.forEach(rec => {
      const mvt = String(rec.movementType || '').trim();
      if (isMovementType641(mvt)) return;
      if (mvt && !(mvt === '101' || mvt === '501' || mvt.startsWith('101') || mvt.startsWith('501'))) {
        return;
      }
      const d = parseReceivingDate(rec.entryDate || rec.documentDate);
      let key = 'Undated';
      let label = 'Undated';
      let sortTime = 0;

      if (d) {
        const yr = d.getFullYear();
        const mo = d.getMonth() + 1;
        key = `${yr}-${String(mo).padStart(2, '0')}`;
        label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        sortTime = new Date(yr, mo - 1, 1).getTime();
      }

      if (!map[key]) {
        map[key] = {
          key,
          label,
          periodKey: key,
          periodLabel: label,
          rdfVal: 0,
          rdfUnits: 0,
          hpVal: 0,
          hpUnits: 0,
          procure101Val: 0,
          donated501Val: 0,
          totalVal: 0,
          totalUnits: 0,
          consignments: 0,
          uniqueMaterials: 0,
          sortTime,
          items: []
        };
      }

      const val = Number(rec.amtInLocCur) || 0;
      const qty = Number(rec.quantity) || Number(rec.qtyInUnitOfEntry) || 0;
      const prog = getReceivingProgramType(rec);

      map[key].totalVal += val;
      map[key].totalUnits += qty;
      map[key].consignments += 1;
      map[key].items.push(rec);

      if (prog === 'RDF') {
        map[key].rdfVal += val;
        map[key].rdfUnits += qty;
      } else {
        map[key].hpVal += val;
        map[key].hpUnits += qty;
      }

      if (mvt === '101') {
        map[key].procure101Val += val;
      } else if (mvt === '501' || mvt.toLowerCase().includes('donate') || mvt.toLowerCase().includes('501')) {
        map[key].donated501Val += val;
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        uniqueMaterials: new Set(item.items.map(i => i.material || i.materialDescription)).size
      }))
      .sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));
  }, [filteredRecords]);

  // 6. Pie Chart Data (RDF vs HP Program Type OR Plant Share)
  const pieChartData = useMemo(() => {
    if (pieChartTarget === 'program') {
      const isValue = metricMode === 'value' || metricMode === 'dual';
      const rdfMetric = isValue ? stats.rdfVal : stats.rdfUnits;
      const hpMetric = isValue ? stats.hpVal : stats.hpUnits;

      return [
        {
          name: 'RDF (Revolving Drug Fund)',
          shortName: 'RDF',
          value: rdfMetric > 0 ? rdfMetric : 0.001,
          realValue: rdfMetric,
          valuation: stats.rdfVal,
          units: stats.rdfUnits,
          count: stats.rdfCount,
          percentage: isValue ? stats.rdfValPct : stats.rdfUnitsPct,
          color: RDF_COLOR
        },
        {
          name: 'Health Program (HP)',
          shortName: 'Health Program',
          value: hpMetric > 0 ? hpMetric : 0.001,
          realValue: hpMetric,
          valuation: stats.hpVal,
          units: stats.hpUnits,
          count: stats.hpCount,
          percentage: isValue ? stats.hpValPct : stats.hpUnitsPct,
          color: HP_COLOR
        }
      ];
    } else {
      // By Plant Share
      const isValue = metricMode === 'value' || metricMode === 'dual';
      const totalAll = isValue ? stats.totalVal : stats.totalUnits;

      return plantBarData.slice(0, 8).map((p, idx) => {
        const val = isValue ? p.totalVal : p.totalUnits;
        const pct = totalAll > 0 ? ((val / totalAll) * 100).toFixed(1) : '0.0';
        return {
          name: p.plantName,
          shortName: p.plant,
          value: val > 0 ? val : 0.001,
          realValue: val,
          valuation: p.totalVal,
          units: p.totalUnits,
          count: p.consignments,
          percentage: pct,
          color: PIE_COLORS[idx % PIE_COLORS.length]
        };
      });
    }
  }, [pieChartTarget, metricMode, stats, plantBarData]);

  // Custom Bar Chart Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const title = data.plantName || data.periodLabel || label || '';

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl text-xs space-y-2 border border-slate-700/80 min-w-[240px]">
        <div className="font-bold text-slate-100 border-b border-slate-700/60 pb-1.5 flex items-center justify-between gap-2">
          <span>{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 font-mono">
            {data.consignments} Consignments
          </span>
        </div>

        {/* RDF Breakdown */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>RDF (Revolving Drug Fund):</span>
            </span>
            <span className="font-mono font-bold">{formatCurrency(data.rdfVal)}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-300/80 text-[11px] pl-3.5">
            <span>RDF Quantity:</span>
            <span className="font-mono">{formatNumber(data.rdfUnits)} units</span>
          </div>
        </div>

        {/* Health Program Breakdown */}
        <div className="space-y-1 border-t border-slate-800 pt-1.5">
          <div className="flex items-center justify-between text-purple-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Health Program (HP):</span>
            </span>
            <span className="font-mono font-bold">{formatCurrency(data.hpVal)}</span>
          </div>
          <div className="flex items-center justify-between text-purple-300/80 text-[11px] pl-3.5">
            <span>HP Quantity:</span>
            <span className="font-mono">{formatNumber(data.hpUnits)} units</span>
          </div>
        </div>

        {/* Total Plant / Horizon */}
        <div className="border-t border-slate-700/80 pt-1.5 flex items-center justify-between font-bold text-sky-300">
          <span>Total Received:</span>
          <span className="font-mono">{formatCurrency(data.totalVal)} ({formatNumber(data.totalUnits)} units)</span>
        </div>
      </div>
    );
  };

  // Custom Pie Chart Tooltip
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 border border-slate-700/80 min-w-[200px]">
        <div className="font-bold flex items-center justify-between border-b border-slate-700/60 pb-1">
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="font-mono text-slate-300">{item.percentage}%</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Valuation (ETB):</span>
          <span className="font-mono font-bold text-emerald-400">{formatCurrency(item.valuation)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Quantity (Units):</span>
          <span className="font-mono font-bold text-amber-400">{formatNumber(item.units)} units</span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Shipment Lines:</span>
          <span className="font-mono">{formatNumber(item.count)} shipments</span>
        </div>
      </div>
    );
  };

  // Export Filtered Receiving Analytics to CSV
  const handleExportAnalyticsCSV = () => {
    const rows = plantBarData.map(p => ({
      'Plant Hub': p.plant,
      'Plant Description': p.plantName,
      'RDF Valuation (ETB)': p.rdfVal,
      'RDF Units': p.rdfUnits,
      'Health Program Valuation (ETB)': p.hpVal,
      'Health Program Units': p.hpUnits,
      'Total Valuation (ETB)': p.totalVal,
      'Total Physical Units': p.totalUnits,
      'Consignment Count': p.consignments,
      'Time Horizon': timePreset === 'all' ? 'All Time' : timePreset
    }));

    downloadCSV(
      `Receiving_Data_Analytics_${programFilter}_${plantFilter}_${new Date().toISOString().split('T')[0]}.csv`,
      rows
    );
  };

  // Single Chart Quick Export to PNG
  const handleExportSingleChart = async (type: 'bar' | 'pie') => {
    setIsQuickExporting(true);
    try {
      const targetId = type === 'bar' ? 'receiving-bar-chart-card' : 'receiving-pie-chart-card';
      const element = document.getElementById(targetId);
      if (!element) {
        setIsExportModalOpen(true);
        return;
      }
      const dateStr = new Date().toISOString().split('T')[0];
      await exportElementAsPNG({
        element,
        filename: `EPSS_Receiving_${type === 'bar' ? 'BarGraph' : 'PieChart'}_${dateStr}.png`,
        reportTitle: type === 'bar' ? 'EPSS Receiving Data Bar Graph' : 'EPSS Receiving Data Pie Chart',
        reportSubtitle: type === 'bar'
          ? `Goods Receipt by ${barChartGrouping === 'plant' ? 'Plant Hub' : 'Time Period'} (RDF vs Health Program)`
          : `Donut Distribution: ${pieChartTarget === 'program' ? 'RDF vs Health Program Proportions' : 'Plant Hub Share'}`,
        metadata: [
          { label: 'Time Horizon', value: timePreset === 'all' ? 'All Time' : timePreset },
          { label: 'Program Type', value: programFilter === 'all' ? 'RDF & Health Program' : programFilter },
          { label: 'Plant Hub', value: plantFilter === 'all' ? 'All EPSS Hubs' : plantFilter }
        ],
        scale: 2,
        includeHeader: true
      });
    } catch (e) {
      console.error('Quick chart export failed:', e);
      setIsExportModalOpen(true);
    } finally {
      setIsQuickExporting(false);
    }
  };

  // Current Bar Data depending on selected grouping
  const currentBarData = barChartGrouping === 'plant' ? plantBarData : timeBarData;

  // Source Data Modal State
  const [sourceDataModal, setSourceDataModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    badge?: string;
    streamFilter?: 'all' | 'RDF' | 'HP';
    plantFilter?: string;
    records?: ReceivingDataRecord[];
  }>({
    isOpen: false,
    title: ''
  });

  const handleOpenReceivingSourceModal = (options: {
    title: string;
    subtitle?: string;
    badge?: string;
    streamFilter?: 'all' | 'RDF' | 'HP';
    plantFilter?: string;
    records?: ReceivingDataRecord[];
  }) => {
    setSourceDataModal({
      isOpen: true,
      title: options.title,
      subtitle: options.subtitle || 'Underlying goods receipt records matching your dashboard filters.',
      badge: options.badge || 'Receiving Source Data',
      streamFilter: options.streamFilter || 'all',
      plantFilter: options.plantFilter || 'all',
      records: options.records || filteredRecords
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Header & Controls Card */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-teal-800/40 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-teal-600/30 text-teal-300 border border-teal-500/30 rounded-xl shadow-inner shrink-0">
              <PackageCheck className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                  Receiving Data Analytics
                </span>
                {isDashboardEmbedded && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active & Synced with Dashboard Filters</span>
                  </span>
                )}
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Goods Receipt by Time Period, Program Type (RDF vs HP) & Plant
                </h3>
              </div>
              <p className="text-xs text-teal-200/80 mt-1">
                Visual inbound delivery intelligence: Dual-axis Bar Graphs and Distribution Pie Charts across Revolving Drug Fund (RDF) and Health Programs (HP) per EPSS Plant.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('receiving-data')}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="View full 22-column SAP goods receipt ledger"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Receiving Ledger</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}

            {onOpenUploadModal && (
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600 text-indigo-100 border border-indigo-400/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Upload GRN</span>
              </button>
            )}

            {/* Export Charts as PNG Button */}
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-teal-600 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Download current bar and pie chart visualizations as a PNG image for reporting"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Export Charts</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[9px] font-mono uppercase font-bold tracking-wider">
                PNG
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportAnalyticsCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Export aggregated analytics data to CSV"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 2. Multi-Filter Toolbar */}
        <div className="bg-slate-900/80 border border-teal-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter 1: Time Period Preset */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300">Time:</span>
              <select
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value as any)}
                className="bg-transparent text-white font-medium text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Time</option>
                <option value="last-30" className="bg-slate-900 text-white">Last 30 Days</option>
                <option value="last-90" className="bg-slate-900 text-white">Last 90 Days</option>
                <option value="ytd" className="bg-slate-900 text-white">Year to Date (2026)</option>
                <option value="custom" className="bg-slate-900 text-white">Custom Range...</option>
              </select>
            </div>

            {/* Custom Date Pickers (if selected) */}
            {timePreset === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-white text-xs focus:outline-hidden"
                  title="Start Date"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-white text-xs focus:outline-hidden"
                  title="End Date"
                />
              </div>
            )}

            {/* Filter 2: Program Type (RDF vs Health Program) */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1">
              <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300">Program:</span>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value as any)}
                className="bg-transparent text-white font-medium text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Programs (RDF & HP)</option>
                <option value="RDF" className="bg-slate-900 text-white">Revolving Drug Fund (RDF) Only</option>
                <option value="HP" className="bg-slate-900 text-white">Health Program (HP) Only</option>
              </select>
            </div>

            {/* Filter 3: Plant Hub */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300">Plant:</span>
              <select
                value={plantFilter}
                onChange={(e) => setPlantFilter(e.target.value)}
                className="bg-transparent text-white font-medium text-xs focus:outline-hidden cursor-pointer max-w-[160px] truncate"
              >
                <option value="all" className="bg-slate-900 text-white">All Plants ({availablePlants.length})</option>
                {availablePlants.map(p => (
                  <option key={p} value={p} className="bg-slate-900 text-white">
                    {p} - {EPSS_PLANT_NAMES[p] || 'Plant'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Switcher & Visual Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">Metric:</span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setMetricMode('value')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  metricMode === 'value'
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Valuation (ETB)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('quantity')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  metricMode === 'quantity'
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Quantity (Units)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('dual')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  metricMode === 'dual'
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dual Axis
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Summary Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Receiving Valuation */}
        <div
          onDoubleClick={() => handleOpenReceivingSourceModal({
            title: 'Source Data: Total Inbound Receiving Valuation',
            subtitle: 'All goods receipt records and consignments across EPSS warehouse hubs.'
          })}
          title="Double-click to view underlying source data records"
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between cursor-pointer hover:border-teal-400 transition-all group"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Inbound Valuation
            </div>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              {formatCurrency(stats.totalVal)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
              <PackageCheck className="w-3 h-3 text-teal-600" />
              <span>{formatNumber(stats.totalUnits)} Physical Units</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 shrink-0 group-hover:scale-105 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Revolving Drug Fund (RDF) Share */}
        <div
          onDoubleClick={() => handleOpenReceivingSourceModal({
            title: 'Source Data: Revolving Drug Fund (RDF) Goods Receipt',
            streamFilter: 'RDF',
            subtitle: 'Goods receipt consignments funded through Revolving Drug Fund.'
          })}
          title="Double-click to view underlying source data records"
          className="bg-white border-2 border-emerald-300/80 p-4 rounded-xl shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                RDF Share ({stats.rdfValPct}%)
              </div>
            </div>
            <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
              {formatCurrency(stats.rdfVal)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">
              {formatNumber(stats.rdfUnits)} Units • {stats.rdfCount} Shipments
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Health Program (HP) Share */}
        <div
          onDoubleClick={() => handleOpenReceivingSourceModal({
            title: 'Source Data: Health Program (HP / Q) Goods Receipt',
            streamFilter: 'HP',
            subtitle: 'Project and donor funded health program goods receipt records.'
          })}
          title="Double-click to view underlying source data records"
          className="bg-white border-2 border-purple-300/80 p-4 rounded-xl shadow-xs flex items-center justify-between cursor-pointer hover:border-purple-500 transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                Health Program ({stats.hpValPct}%)
              </div>
            </div>
            <div className="text-xl font-black text-purple-700 mt-1 font-mono">
              {formatCurrency(stats.hpVal)}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5 font-medium">
              {formatNumber(stats.hpUnits)} Units • {stats.hpCount} Shipments (Q)
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 shrink-0 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Plant Coverage */}
        <div
          onDoubleClick={() => handleOpenReceivingSourceModal({
            title: 'Source Data: Goods Receipt Across Active Plants',
            subtitle: 'Goods receipt records across all regional EPSS warehouse plants.'
          })}
          title="Double-click to view underlying source data records"
          className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center justify-between cursor-pointer hover:border-sky-400 transition-all group"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Plant Hubs
            </div>
            <div className="text-xl font-black text-sky-800 mt-1 font-mono">
              {plantBarData.length} Plants
            </div>
            <div className="text-[10px] text-sky-600 mt-0.5 truncate max-w-[150px]">
              Top: {plantBarData[0]?.plant || 'None'} ({formatCurrency(plantBarData[0]?.totalVal || 0, true)})
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 shrink-0 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Main Chart: Smart Bar Graph */}
      <div
        id="receiving-bar-chart-card"
        onDoubleClick={() => handleOpenReceivingSourceModal({
          title: `Source Data: Goods Receipt ${barChartGrouping === 'plant' ? 'By Plant Hub' : 'By Time Period'}`,
          subtitle: 'Granular goods receipt transactional records matching active filters.'
        })}
        title="Double-click graph to view underlying source data records"
        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between w-full cursor-pointer hover:border-teal-300 transition-all"
      >
          {/* Bar Graph Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Receiving Data Bar Graph: {barChartGrouping === 'plant' ? 'By Plant Hub' : 'By Time Period'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    RDF vs Health Program
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {barChartGrouping === 'plant'
                    ? 'Inbound goods receipt comparison across regional EPSA warehouse plants.'
                    : 'Time-series receiving intake trends categorized by funding mechanism.'}
                </p>
              </div>
            </div>

            {/* Action buttons: Save PNG & Mode Toggle */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleExportSingleChart('bar')}
                disabled={isQuickExporting}
                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Download this Bar Graph as high-resolution PNG image"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>Save PNG</span>
              </button>

              {/* Toggle: Group by Plant vs Group by Time Period */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBarChartGrouping('plant')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    barChartGrouping === 'plant'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Plant Hub
                </button>
                <button
                  type="button"
                  onClick={() => setBarChartGrouping('time')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    barChartGrouping === 'time'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Time Period
                </button>
              </div>
            </div>
          </div>

          {/* Smart Recharts Bar Chart Container */}
          <div className="h-[460px] w-full mt-4 bg-white p-4 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentBarData}
                margin={{ top: 20, right: 40, left: 20, bottom: 65 }}
                onDoubleClick={() => handleOpenReceivingSourceModal({
                  title: `Source Data: Goods Receipt ${barChartGrouping === 'plant' ? 'By Plant Hub' : 'By Time Period'}`,
                  subtitle: 'Granular receiving records from current bar graph selection.'
                })}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey={barChartGrouping === 'plant' ? 'plant' : 'periodLabel'}
                  fontSize={11}
                  tick={{ fill: '#475569', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                />
                
                {/* Left Y-Axis for Valuation in ETB */}
                <YAxis
                  yAxisId="left"
                  fontSize={10}
                  tick={{ fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (metricMode === 'quantity') return formatNumber(val);
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                    return String(val);
                  }}
                />

                {/* Right Y-Axis for Unique Materials */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={10}
                  tick={{ fill: '#38bdf8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${formatNumber(val)} SKUs`}
                />

                <Tooltip content={<CustomBarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => <span className="text-slate-700 font-semibold">{value}</span>}
                />

                <Bar
                  yAxisId="left"
                  dataKey="rdfVal"
                  name="RDF Value (ETB)"
                  fill={RDF_COLOR}
                  radius={[0, 0, 0, 0]}
                  stackId="stacked"
                  className="cursor-pointer hover:opacity-85"
                  onDoubleClick={(data: any) => {
                    if (data) {
                      handleOpenReceivingSourceModal({
                        title: `Source Data: ${data.plant || data.periodLabel || 'Goods Receipt'} (RDF)`,
                        streamFilter: 'RDF',
                        plantFilter: data.plant || 'all'
                      });
                    }
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="hpVal"
                  name="Health Program Value (ETB)"
                  fill={HP_COLOR}
                  radius={[0, 0, 0, 0]}
                  stackId="stacked"
                  className="cursor-pointer hover:opacity-85"
                  onDoubleClick={(data: any) => {
                    if (data) {
                      handleOpenReceivingSourceModal({
                        title: `Source Data: ${data.plant || data.periodLabel || 'Goods Receipt'} (Health Program)`,
                        streamFilter: 'HP',
                        plantFilter: data.plant || 'all'
                      });
                    }
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="procure101Val"
                  name="EPSS Procure (Mvt 101)"
                  fill="#3b82f6"
                  radius={[0, 0, 0, 0]}
                  stackId="stacked"
                  className="cursor-pointer hover:opacity-85"
                  onDoubleClick={(data: any) => {
                    if (data) {
                      handleOpenReceivingSourceModal({
                        title: `Source Data: ${data.plant || data.periodLabel || 'Goods Receipt'} (Movement 101)`,
                        plantFilter: data.plant || 'all'
                      });
                    }
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="donated501Val"
                  name="Donated Item (Mvt 501)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  stackId="stacked"
                  className="cursor-pointer hover:opacity-85"
                  onDoubleClick={(data: any) => {
                    if (data) {
                      handleOpenReceivingSourceModal({
                        title: `Source Data: ${data.plant || data.periodLabel || 'Goods Receipt'} (Movement 501)`,
                        plantFilter: data.plant || 'all'
                      });
                    }
                  }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="uniqueMaterials"
                  name="Unique Materials (SKUs)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#38bdf8' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart Legend & Note */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>Revolving Drug Fund (RDF)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-purple-500" />
                <span>Health Program (HP)</span>
              </span>
              {metricMode === 'dual' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Total Units (Right Axis)</span>
                </span>
              )}
            </div>
            <span className="text-slate-400 italic">
              Showing {currentBarData.length} data points
            </span>
          </div>
        </div>



      {/* 5. Collapsible Detailed Plant × Program Type Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowDataTable(!showDataTable)}
          className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>Plant-by-Plant Receiving Matrix (RDF vs Health Program)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-100 text-teal-800">
              {plantBarData.length} EPSS Plants
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>{showDataTable ? 'Hide Matrix' : 'View Full Matrix'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDataTable ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showDataTable && (
          <div className="p-3 border-t border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold">
                  <th className="py-2 px-3">Plant Hub</th>
                  <th className="py-2 px-3">Warehouse Location</th>
                  <th className="py-2 px-3 text-right">RDF Valuation (ETB)</th>
                  <th className="py-2 px-3 text-right">RDF Units</th>
                  <th className="py-2 px-3 text-right">HP Valuation (ETB)</th>
                  <th className="py-2 px-3 text-right">HP Units</th>
                  <th className="py-2 px-3 text-right">Total Valuation</th>
                  <th className="py-2 px-3 text-right">Total Units</th>
                  <th className="py-2 px-3 text-center">Share (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {plantBarData.map((row, idx) => {
                  const sharePct = stats.totalVal > 0 ? ((row.totalVal / stats.totalVal) * 100).toFixed(1) : '0.0';
                  return (
                    <tr
                      key={idx}
                      onDoubleClick={() => handleOpenReceivingSourceModal({
                        title: `Source Data: ${row.plant} — ${row.plantName}`,
                        plantFilter: row.plant,
                        subtitle: `Granular receiving consignment records for plant hub ${row.plant}.`
                      })}
                      title="Double-click to view source records for this plant hub"
                      className="hover:bg-teal-50/80 transition cursor-pointer"
                    >
                      <td className="py-2 px-3 font-bold text-teal-800">
                        {row.plant}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-700 font-medium">
                        {row.plantName}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                        {formatCurrency(row.rdfVal)}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600">
                        {formatNumber(row.rdfUnits)}
                      </td>
                      <td className="py-2 px-3 text-right text-purple-700 font-bold">
                        {formatCurrency(row.hpVal)}
                      </td>
                      <td className="py-2 px-3 text-right text-purple-600">
                        {formatNumber(row.hpUnits)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900 font-black">
                        {formatCurrency(row.totalVal)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-800 font-bold">
                        {formatNumber(row.totalUnits)}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-teal-700">
                        {sharePct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Charts Modal */}
      <ExportChartsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeFilters={{
          timePeriod: timePreset === 'all' ? 'All Time' : timePreset === 'last-30' ? 'Last 30 Days' : timePreset === 'last-90' ? 'Last 90 Days' : timePreset === 'ytd' ? 'Year to Date 2026' : `${startDate} to ${endDate}`,
          programType: programFilter === 'all' ? 'All Programs (RDF & Health Program)' : programFilter === 'RDF' ? 'Revolving Drug Fund (RDF)' : 'Health Program (HP)',
          plantHub: plantFilter === 'all' ? 'All EPSS Plants & Hubs' : `${EPSS_PLANT_NAMES[plantFilter] || plantFilter} (${plantFilter})`,
          metricMode: metricMode === 'value' ? 'Valuation (ETB)' : metricMode === 'quantity' ? 'Physical Units' : 'Dual-Axis (Valuation & Units)'
        }}
        stats={{
          totalVal: stats.totalVal,
          totalUnits: stats.totalUnits,
          rdfVal: stats.rdfVal,
          rdfUnits: stats.rdfUnits,
          hpVal: stats.hpVal,
          hpUnits: stats.hpUnits,
          consignments: stats.totalRecords
        }}
        defaultTargetId="receiving-bar-and-pie-charts-container"
        barChartTargetId="receiving-bar-chart-card"
        pieChartTargetId="receiving-pie-chart-card"
      />

      {/* Receiving Source Data Inspection Modal */}
      <DashboardSourceDataModal
        isOpen={sourceDataModal.isOpen}
        onClose={() => setSourceDataModal(prev => ({ ...prev, isOpen: false }))}
        title={sourceDataModal.title}
        subtitle={sourceDataModal.subtitle}
        badge={sourceDataModal.badge}
        mode="receiving-data"
        receivingRecords={sourceDataModal.records}
        initialStreamFilter={sourceDataModal.streamFilter}
        initialPlantFilter={sourceDataModal.plantFilter}
      />
    </div>
  );
};

export default ReceivingDataAnalyticsSection;
