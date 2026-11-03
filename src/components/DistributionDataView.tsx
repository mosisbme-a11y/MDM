import React, { useState, useMemo } from 'react';
import {
  Truck,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  Warehouse,
  ArrowDownLeft,
  Barcode,
  Layers,
  ShieldCheck,
  Upload,
  X,
  FileText,
  Sparkles,
  RefreshCw,
  Eye,
  Tag,
  DollarSign,
  User,
  Hash,
  SlidersHorizontal,
  Trash2,
  ChevronDown,
  ArrowUpDown,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Info,
  Package,
  Check,
  HelpCircle,
  ExternalLink,
  Sliders
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  Cell
} from 'recharts';
import { DistributionDataRecord, ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { DistributionDataUploadModal } from './DistributionDataUploadModal';
import {
  DISTRIBUTION_DATA_COLUMNS,
  DEFAULT_DISTRIBUTION_DATA_RECORDS,
  downloadDistributionDataTemplateCSV,
  downloadDistributionDataTemplateExcel,
  generateDistributionDataCSVText,
  getDistributionFundStream
} from '../data/defaultDistributionData';
import {
  isMovementType641,
  getReceivingFundStream,
  calculateStockHoldingDays,
  SAMPLE_MD_TRANSFER_641_RECORDS
} from '../data/defaultReceivingData';

interface DistributionDataViewProps {
  distributionRecords?: DistributionDataRecord[];
  receivingRecords?: ReceivingDataRecord[];
  onUploadDistributionData?: (records: DistributionDataRecord[], mode: 'replace' | 'append') => void;
  onClearDistributionData?: () => void;
  onUploadReceivingData?: (records: ReceivingDataRecord[], mode: 'replace' | 'append') => void;
  isAdmin?: boolean;
}

export const DistributionDataView: React.FC<DistributionDataViewProps> = ({
  distributionRecords = [],
  receivingRecords = [],
  onUploadDistributionData,
  onClearDistributionData,
  onUploadReceivingData,
  isAdmin = false
}) => {
  // Navigation View Mode: 'transfers' (MD Transfer to Plant 641) vs 'deliveries' (18 SAP distribution columns) vs 'combined'
  const [activeSubTab, setActiveSubTab] = useState<'transfers' | 'deliveries' | 'combined'>('transfers');

  // Smart Bar Graph Visualization Mode
  // 'all-in-one': Single unified smart bar graph comparing Total Value Transferred, Amount (Quantity), and Line of Items with RDF vs HP
  // 'stream-comparison': Dual-scale comparative bar graph across streams (RDF vs HP vs Total)
  // 'value': Focused bar graph on Total Value Transferred
  // 'amount': Focused bar graph on Amount (Quantity)
  // 'lines': Focused bar graph on Line of Items
  const [smartBarMode, setSmartBarMode] = useState<'all-in-one' | 'stream-comparison' | 'value' | 'amount' | 'lines'>('all-in-one');

  // =========================================================================
  // SECTION 1: MD TRANSFER TO PLANT (MOVEMENT TYPE 641) STATE & DATA
  // =========================================================================
  const [trfSearchQuery, setTrfSearchQuery] = useState('');
  const [trfSelectedPlant, setTrfSelectedPlant] = useState('all');
  const [trfSelectedStream, setTrfSelectedStream] = useState<'all' | 'RDF' | 'HP'>('all');
  const [trfStartDate, setTrfStartDate] = useState('');
  const [trfEndDate, setTrfEndDate] = useState('');
  const [inspectingTransferRecord, setInspectingTransferRecord] = useState<ReceivingDataRecord | null>(null);

  // Drill-down filter state for MD Transfer to Plant smart bar graph
  const [trfDrillDown, setTrfDrillDown] = useState<{
    key: 'RDF' | 'HP' | 'high-value' | 'high-qty' | null;
    label: string;
    description: string;
  }>({ key: null, label: '', description: '' });

  const handleTrfBarClick = (key: 'RDF' | 'HP' | 'high-value' | 'high-qty' | null, label?: string) => {
    if (!key) return;
    if (trfDrillDown.key === key) {
      setTrfDrillDown({ key: null, label: '', description: '' });
    } else {
      const defaultLabel = key === 'RDF' ? 'RDF Stream' :
        key === 'HP' ? 'HP Stream' :
        key === 'high-value' ? 'High Value Transfers (≥ 10M ETB)' :
        'Bulk Transfers (≥ 5 Units)';
      const desc = key === 'RDF' ? 'Filtered to Revolving Drug Fund inter-plant transfers' :
        key === 'HP' ? 'Filtered to Health Program grant transfers' :
        key === 'high-value' ? 'Filtered to clinical equipment valued at 10M+ ETB' :
        'Filtered to batch transfers with 5 or more units';
      setTrfDrillDown({ key, label: label || defaultLabel, description: desc });
    }
  };

  // Sorting state for MD Transfer table (matched with Receiving Data table sorting)
  const [trfSortField, setTrfSortField] = useState<'default' | 'quantity' | 'amt' | 'postingDate' | 'holdingDays'>('default');
  const [trfSortAsc, setTrfSortAsc] = useState<boolean>(false);

  const handleToggleTrfSort = (field: 'quantity' | 'amt' | 'postingDate' | 'holdingDays') => {
    if (trfSortField === field) {
      setTrfSortAsc(!trfSortAsc);
    } else {
      setTrfSortField(field);
      setTrfSortAsc(false);
    }
  };

  const all641Records: ReceivingDataRecord[] = useMemo(() => {
    return (receivingRecords || []).filter(r => isMovementType641(r.movementType));
  }, [receivingRecords]);

  // Plants list for 641 transfers
  const trfPlantsList = useMemo(() => {
    return Array.from(new Set(all641Records.map(r => r.plant))).filter(Boolean).sort();
  }, [all641Records]);

  // Filtered 641 transfer records
  const filteredTrfRecords = useMemo(() => {
    return all641Records.filter(r => {
      const q = trfSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.materialDescription?.toLowerCase().includes(q) ||
        r.material?.toLowerCase().includes(q) ||
        r.purchaseOrder?.toLowerCase().includes(q) ||
        r.reference?.toLowerCase().includes(q) ||
        r.batch?.toLowerCase().includes(q) ||
        r.wbsElement?.toLowerCase().includes(q) ||
        r.plant?.toLowerCase().includes(q) ||
        r.storageLocation?.toLowerCase().includes(q);

      const matchesPlant = trfSelectedPlant === 'all' || r.plant === trfSelectedPlant;
      const stream = getReceivingFundStream(r);
      const matchesStream = trfSelectedStream === 'all' || stream === trfSelectedStream;

      const postDate = r.postingDate || r.entryDate || '';
      const matchesStartDate = !trfStartDate || (postDate && postDate >= trfStartDate);
      const matchesEndDate = !trfEndDate || (postDate && postDate <= trfEndDate);

      // Smart Bar Drill-Down
      let matchesTrfDrill = true;
      if (trfDrillDown.key === 'RDF') {
        matchesTrfDrill = stream === 'RDF';
      } else if (trfDrillDown.key === 'HP') {
        matchesTrfDrill = stream === 'HP';
      } else if (trfDrillDown.key === 'high-value') {
        matchesTrfDrill = (Number(r.amtInLocCur) || 0) >= 10000000;
      } else if (trfDrillDown.key === 'high-qty') {
        matchesTrfDrill = (Number(r.quantity) || 1) >= 5;
      }

      return matchesSearch && matchesPlant && matchesStream && matchesStartDate && matchesEndDate && matchesTrfDrill;
    });
  }, [all641Records, trfSearchQuery, trfSelectedPlant, trfSelectedStream, trfStartDate, trfEndDate, trfDrillDown]);

  // Sorted MD Transfer records matching Receiving Data table sorting
  const sortedTrfRecords = useMemo(() => {
    if (trfSortField === 'default') return filteredTrfRecords;
    return [...filteredTrfRecords].sort((a, b) => {
      let cmp = 0;
      if (trfSortField === 'quantity') {
        cmp = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      } else if (trfSortField === 'amt') {
        cmp = (Number(a.amtInLocCur) || 0) - (Number(b.amtInLocCur) || 0);
      } else if (trfSortField === 'postingDate') {
        const da = a.postingDate || a.entryDate || '';
        const db = b.postingDate || b.entryDate || '';
        cmp = da.localeCompare(db);
      } else if (trfSortField === 'holdingDays') {
        const ha = calculateStockHoldingDays(a.postingDate || a.entryDate, a) ?? -1;
        const hb = calculateStockHoldingDays(b.postingDate || b.entryDate, b) ?? -1;
        cmp = ha - hb;
      }
      return trfSortAsc ? cmp : -cmp;
    });
  }, [filteredTrfRecords, trfSortField, trfSortAsc]);

  // Statistics for MD Transfer to Plant (Movement Type 641)
  const trfStats = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    let totalLines = filteredTrfRecords.length;

    let rdfVal = 0;
    let rdfQty = 0;
    let rdfLines = 0;

    let hpVal = 0;
    let hpQty = 0;
    let hpLines = 0;

    const plantMap: Record<string, { value: number; qty: number; lines: number }> = {};

    filteredTrfRecords.forEach(r => {
      const v = Number(r.amtInLocCur) || 0;
      const q = Number(r.quantity) || Number(r.qtyInUnitOfEntry) || 1;
      const stream = getReceivingFundStream(r);
      const p = r.plant || 'Unknown Hub';

      totalValue += v;
      totalQty += q;

      if (stream === 'RDF') {
        rdfVal += v;
        rdfQty += q;
        rdfLines++;
      } else {
        hpVal += v;
        hpQty += q;
        hpLines++;
      }

      if (!plantMap[p]) {
        plantMap[p] = { value: 0, qty: 0, lines: 0 };
      }
      plantMap[p].value += v;
      plantMap[p].qty += q;
      plantMap[p].lines++;
    });

    const rdfValuePct = totalValue > 0 ? (rdfVal / totalValue) * 100 : 0;
    const hpValuePct = totalValue > 0 ? (hpVal / totalValue) * 100 : 0;

    const rdfAmountPct = totalQty > 0 ? (rdfQty / totalQty) * 100 : 0;
    const hpAmountPct = totalQty > 0 ? (hpQty / totalQty) * 100 : 0;

    const rdfLinesPct = totalLines > 0 ? (rdfLines / totalLines) * 100 : 0;
    const hpLinesPct = totalLines > 0 ? (hpLines / totalLines) * 100 : 0;

    const plantBreakdown = Object.entries(plantMap).map(([plant, data]) => ({
      name: plant,
      value: data.value,
      qty: data.qty,
      lines: data.lines,
      valuePct: totalValue > 0 ? (data.value / totalValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    return {
      totalValue,
      totalQty,
      totalLines,
      rdfVal,
      rdfQty,
      rdfLines,
      hpVal,
      hpQty,
      hpLines,
      rdfValuePct,
      hpValuePct,
      rdfAmountPct,
      hpAmountPct,
      rdfLinesPct,
      hpLinesPct,
      plantBreakdown
    };
  }, [filteredTrfRecords]);

  // =========================================================================
  // SMART BAR GRAPH DATASETS
  // 1. All-in-One Multi-Metric Bar Data (Total Value, Amount Qty, Line Items with RDF & HP)
  // 2. Stream Comparison Bar Data (RDF vs HP vs Total with Value, Amount, Lines)
  // 3. Focused Metric Bar Data
  // =========================================================================
  const smartAllInOneData = useMemo(() => [
    {
      dimension: 'Total Value Transferred',
      shortDim: 'Total Value',
      category: 'Valuation',
      unit: 'ETB',
      RDF_Share: Math.round(trfStats.rdfValuePct * 10) / 10,
      HP_Share: Math.round(trfStats.hpValuePct * 10) / 10,
      RDF_Val: trfStats.rdfVal,
      HP_Val: trfStats.hpVal,
      Total_Val: trfStats.totalValue,
      RDF_Formatted: formatCurrency(trfStats.rdfVal),
      HP_Formatted: formatCurrency(trfStats.hpVal),
      Total_Formatted: formatCurrency(trfStats.totalValue)
    },
    {
      dimension: 'Transferred Amount (Qty)',
      shortDim: 'Amount (Qty)',
      category: 'Volume',
      unit: 'Units',
      RDF_Share: Math.round(trfStats.rdfAmountPct * 10) / 10,
      HP_Share: Math.round(trfStats.hpAmountPct * 10) / 10,
      RDF_Val: trfStats.rdfQty,
      HP_Val: trfStats.hpQty,
      Total_Val: trfStats.totalQty,
      RDF_Formatted: `${formatNumber(trfStats.rdfQty)} Units`,
      HP_Formatted: `${formatNumber(trfStats.hpQty)} Units`,
      Total_Formatted: `${formatNumber(trfStats.totalQty)} Units`
    },
    {
      dimension: 'Line of Items',
      shortDim: 'Line Items',
      category: 'Catalog',
      unit: 'Lines',
      RDF_Share: Math.round(trfStats.rdfLinesPct * 10) / 10,
      HP_Share: Math.round(trfStats.hpLinesPct * 10) / 10,
      RDF_Val: trfStats.rdfLines,
      HP_Val: trfStats.hpLines,
      Total_Val: trfStats.totalLines,
      RDF_Formatted: `${trfStats.rdfLines} Lines`,
      HP_Formatted: `${trfStats.hpLines} Lines`,
      Total_Formatted: `${trfStats.totalLines} Lines`
    }
  ], [trfStats]);

  const smartStreamComparisonData = useMemo(() => [
    {
      stream: 'RDF (Revolving Fund)',
      shortName: 'RDF',
      valueInMillions: Math.round((trfStats.rdfVal / 1000000) * 100) / 100,
      amountUnits: trfStats.rdfQty,
      lineItems: trfStats.rdfLines,
      valueFormatted: formatCurrency(trfStats.rdfVal),
      amountFormatted: `${formatNumber(trfStats.rdfQty)} Units`,
      linesFormatted: `${trfStats.rdfLines} Lines`
    },
    {
      stream: 'HP (Health Program)',
      shortName: 'HP',
      valueInMillions: Math.round((trfStats.hpVal / 1000000) * 100) / 100,
      amountUnits: trfStats.hpQty,
      lineItems: trfStats.hpLines,
      valueFormatted: formatCurrency(trfStats.hpVal),
      amountFormatted: `${formatNumber(trfStats.hpQty)} Units`,
      linesFormatted: `${trfStats.hpLines} Lines`
    },
    {
      stream: 'Total Transferred',
      shortName: 'Total',
      valueInMillions: Math.round((trfStats.totalValue / 1000000) * 100) / 100,
      amountUnits: trfStats.totalQty,
      lineItems: trfStats.totalLines,
      valueFormatted: formatCurrency(trfStats.totalValue),
      amountFormatted: `${formatNumber(trfStats.totalQty)} Units`,
      linesFormatted: `${trfStats.totalLines} Lines`
    }
  ], [trfStats]);

  const smartFocusData = useMemo(() => {
    if (smartBarMode === 'value') {
      return [
        { name: 'RDF Stream', value: trfStats.rdfVal, formatted: formatCurrency(trfStats.rdfVal), color: '#10b981', pct: `${Math.round(trfStats.rdfValuePct)}%` },
        { name: 'HP Stream', value: trfStats.hpVal, formatted: formatCurrency(trfStats.hpVal), color: '#8b5cf6', pct: `${Math.round(trfStats.hpValuePct)}%` },
        { name: 'Total Transferred', value: trfStats.totalValue, formatted: formatCurrency(trfStats.totalValue), color: '#3b82f6', pct: '100%' }
      ];
    }
    if (smartBarMode === 'amount') {
      return [
        { name: 'RDF Stream', value: trfStats.rdfQty, formatted: `${formatNumber(trfStats.rdfQty)} Units`, color: '#10b981', pct: `${Math.round(trfStats.rdfAmountPct)}%` },
        { name: 'HP Stream', value: trfStats.hpQty, formatted: `${formatNumber(trfStats.hpQty)} Units`, color: '#8b5cf6', pct: `${Math.round(trfStats.hpAmountPct)}%` },
        { name: 'Total Transferred', value: trfStats.totalQty, formatted: `${formatNumber(trfStats.totalQty)} Units`, color: '#3b82f6', pct: '100%' }
      ];
    }
    return [
      { name: 'RDF Stream', value: trfStats.rdfLines, formatted: `${trfStats.rdfLines} Lines`, color: '#10b981', pct: `${Math.round(trfStats.rdfLinesPct)}%` },
      { name: 'HP Stream', value: trfStats.hpLines, formatted: `${trfStats.hpLines} Lines`, color: '#8b5cf6', pct: `${Math.round(trfStats.hpLinesPct)}%` },
      { name: 'Total Transferred', value: trfStats.totalLines, formatted: `${trfStats.totalLines} Lines`, color: '#3b82f6', pct: '100%' }
    ];
  }, [smartBarMode, trfStats]);

  const handleExportTrfCSV = () => {
    const data = sortedTrfRecords.map(r => ({
      'Purchase order': r.purchaseOrder,
      'Reference': r.reference || '',
      'Material': r.material,
      'Material Description': r.materialDescription,
      'Batch': r.batch || '',
      'Quantity': r.quantity,
      'Storage Location': r.storageLocation || 'SL01',
      'Amt.in Loc.Cur.': r.amtInLocCur,
      'Movement Type': r.movementType || '641',
      'Special Stock': r.specialStock || 'RDF',
      'WBS Element': r.wbsElement || '',
      'Plant': r.plant || 'AA01',
      'Posting Date': r.postingDate || r.entryDate || '',
      'Stock Holding Days': calculateStockHoldingDays(r.postingDate || r.entryDate, r) ?? ''
    }));
    downloadCSV(`EPSS_MD_Transfer_To_Plant_641_Matched_Ledger_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  const handleLoadDemo641Transfers = () => {
    if (onUploadReceivingData) {
      const demo641 = SAMPLE_MD_TRANSFER_641_RECORDS.map((r, i) => ({
        ...r,
        id: `demo-641-trf-${i}-${Date.now()}`
      }));
      onUploadReceivingData(demo641, 'append');
    }
  };

  // =========================================================================
  // SECTION 2: MD DELIVER TO HF & REGIONAL CUSTOMER DELIVERIES STATE & DATA
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedPodStatus, setSelectedPodStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [inspectingRecord, setInspectingRecord] = useState<DistributionDataRecord | null>(null);

  // Drill-down filter state for MD Deliver to HF smart bar graph
  const [deliveryDrillDown, setDeliveryDrillDown] = useState<{
    key: 'RDF' | 'HP' | 'high-value' | 'mid-value' | 'standard-value' | 'high-qty' | 'lines' | null;
    label: string;
    description: string;
  }>({ key: null, label: '', description: '' });

  // Smart bar graph visualization mode for MD Deliver to HF
  const [deliverySmartBarMode, setDeliverySmartBarMode] = useState<'all-in-one' | 'stream-comparison' | 'value' | 'amount' | 'lines'>('all-in-one');

  const handleDeliveryBarClick = (
    key: 'RDF' | 'HP' | 'high-value' | 'mid-value' | 'standard-value' | 'high-qty' | 'lines' | null,
    label?: string,
    desc?: string
  ) => {
    if (!key) return;
    if (deliveryDrillDown.key === key) {
      setDeliveryDrillDown({ key: null, label: '', description: '' });
    } else {
      const defaultLabel =
        key === 'RDF' ? 'RDF Stream (Revolving Drug Fund)' :
        key === 'HP' ? 'HP Stream (Health Program Grants)' :
        key === 'high-value' ? 'High-Value Items (≥ 10M ETB)' :
        key === 'mid-value' ? 'Mid-Value Items (5M - 10M ETB)' :
        key === 'standard-value' ? 'Standard Value Items (< 5M ETB)' :
        key === 'high-qty' ? 'Bulk Shipments (≥ 5 Units)' :
        'All Line Items';

      const defaultDesc =
        key === 'RDF' ? 'Filtered to Revolving Drug Fund shipments & commercial equipment' :
        key === 'HP' ? 'Filtered to Health Program grants (Global Fund, World Bank/IDA, PEPFAR, MOH)' :
        key === 'high-value' ? 'Filtered to major hospital installations valued at 10M+ ETB' :
        key === 'mid-value' ? 'Filtered to clinical systems valued between 5M and 10M ETB' :
        key === 'standard-value' ? 'Filtered to standard equipment dispatches under 5M ETB' :
        key === 'high-qty' ? 'Filtered to batch shipments containing 5 or more units' :
        'Showing all delivery line items';

      setDeliveryDrillDown({
        key,
        label: label || defaultLabel,
        description: desc || defaultDesc
      });
    }
  };

  const activeRecords: DistributionDataRecord[] = useMemo(() => {
    return distributionRecords || [];
  }, [distributionRecords]);

  // Statistics for MD Deliver to HF Smart Bar Graph
  const deliveryStats = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    let totalLines = activeRecords.length;

    let rdfVal = 0;
    let rdfQty = 0;
    let rdfLines = 0;

    let hpVal = 0;
    let hpQty = 0;
    let hpLines = 0;

    let highValueCount = 0;
    let midValueCount = 0;
    let standardValueCount = 0;
    let highQtyCount = 0;

    activeRecords.forEach(r => {
      const v = Number(r.netValue) || 0;
      const q = Number(r.quantity) || 1;
      const stream = getDistributionFundStream(r);

      totalValue += v;
      totalQty += q;

      if (stream === 'RDF') {
        rdfVal += v;
        rdfQty += q;
        rdfLines++;
      } else {
        hpVal += v;
        hpQty += q;
        hpLines++;
      }

      if (v >= 10000000) highValueCount++;
      else if (v >= 5000000) midValueCount++;
      else standardValueCount++;

      if (q >= 5) highQtyCount++;
    });

    const rdfValuePct = totalValue > 0 ? (rdfVal / totalValue) * 100 : 0;
    const hpValuePct = totalValue > 0 ? (hpVal / totalValue) * 100 : 0;

    const rdfAmountPct = totalQty > 0 ? (rdfQty / totalQty) * 100 : 0;
    const hpAmountPct = totalQty > 0 ? (hpQty / totalQty) * 100 : 0;

    const rdfLinesPct = totalLines > 0 ? (rdfLines / totalLines) * 100 : 0;
    const hpLinesPct = totalLines > 0 ? (hpLines / totalLines) * 100 : 0;

    return {
      totalValue,
      totalQty,
      totalLines,
      rdfVal,
      rdfQty,
      rdfLines,
      hpVal,
      hpQty,
      hpLines,
      rdfValuePct,
      hpValuePct,
      rdfAmountPct,
      hpAmountPct,
      rdfLinesPct,
      hpLinesPct,
      highValueCount,
      midValueCount,
      standardValueCount,
      highQtyCount
    };
  }, [activeRecords]);

  // Datasets for MD Deliver to HF Smart Bar Graph
  const deliverySmartAllInOneData = useMemo(() => [
    {
      dimension: 'Total Value Delivered',
      shortDim: 'Total Value',
      category: 'Valuation',
      unit: 'ETB',
      RDF_Share: Math.round(deliveryStats.rdfValuePct * 10) / 10,
      HP_Share: Math.round(deliveryStats.hpValuePct * 10) / 10,
      RDF_Val: deliveryStats.rdfVal,
      HP_Val: deliveryStats.hpVal,
      Total_Val: deliveryStats.totalValue,
      RDF_Formatted: formatCurrency(deliveryStats.rdfVal),
      HP_Formatted: formatCurrency(deliveryStats.hpVal),
      Total_Formatted: formatCurrency(deliveryStats.totalValue),
      drillKey: 'high-value'
    },
    {
      dimension: 'Delivered Amount (Qty)',
      shortDim: 'Amount (Qty)',
      category: 'Volume',
      unit: 'Units',
      RDF_Share: Math.round(deliveryStats.rdfAmountPct * 10) / 10,
      HP_Share: Math.round(deliveryStats.hpAmountPct * 10) / 10,
      RDF_Val: deliveryStats.rdfQty,
      HP_Val: deliveryStats.hpQty,
      Total_Val: deliveryStats.totalQty,
      RDF_Formatted: `${formatNumber(deliveryStats.rdfQty)} Units`,
      HP_Formatted: `${formatNumber(deliveryStats.hpQty)} Units`,
      Total_Formatted: `${formatNumber(deliveryStats.totalQty)} Units`,
      drillKey: 'high-qty'
    },
    {
      dimension: 'Line of Items',
      shortDim: 'Line Items',
      category: 'Catalog',
      unit: 'Lines',
      RDF_Share: Math.round(deliveryStats.rdfLinesPct * 10) / 10,
      HP_Share: Math.round(deliveryStats.hpLinesPct * 10) / 10,
      RDF_Val: deliveryStats.rdfLines,
      HP_Val: deliveryStats.hpLines,
      Total_Val: deliveryStats.totalLines,
      RDF_Formatted: `${deliveryStats.rdfLines} Lines`,
      HP_Formatted: `${deliveryStats.hpLines} Lines`,
      Total_Formatted: `${deliveryStats.totalLines} Lines`,
      drillKey: null
    }
  ], [deliveryStats]);

  const deliverySmartStreamComparisonData = useMemo(() => [
    {
      stream: 'RDF (Revolving Fund)',
      shortName: 'RDF',
      valueInMillions: Math.round((deliveryStats.rdfVal / 1000000) * 100) / 100,
      amountUnits: deliveryStats.rdfQty,
      lineItems: deliveryStats.rdfLines,
      valueFormatted: formatCurrency(deliveryStats.rdfVal),
      amountFormatted: `${formatNumber(deliveryStats.rdfQty)} Units`,
      linesFormatted: `${deliveryStats.rdfLines} Lines`,
      drillKey: 'RDF' as const
    },
    {
      stream: 'HP (Health Program)',
      shortName: 'HP',
      valueInMillions: Math.round((deliveryStats.hpVal / 1000000) * 100) / 100,
      amountUnits: deliveryStats.hpQty,
      lineItems: deliveryStats.hpLines,
      valueFormatted: formatCurrency(deliveryStats.hpVal),
      amountFormatted: `${formatNumber(deliveryStats.hpQty)} Units`,
      linesFormatted: `${deliveryStats.hpLines} Lines`,
      drillKey: 'HP' as const
    },
    {
      stream: 'Total Delivered',
      shortName: 'Total',
      valueInMillions: Math.round((deliveryStats.totalValue / 1000000) * 100) / 100,
      amountUnits: deliveryStats.totalQty,
      lineItems: deliveryStats.totalLines,
      valueFormatted: formatCurrency(deliveryStats.totalValue),
      amountFormatted: `${formatNumber(deliveryStats.totalQty)} Units`,
      linesFormatted: `${deliveryStats.totalLines} Lines`,
      drillKey: 'high-value' as const
    }
  ], [deliveryStats]);

interface DeliveryFocusItem {
  name: string;
  value: number;
  formatted: string;
  color: string;
  pct: string;
  drillKey: 'RDF' | 'HP' | 'high-value' | 'mid-value' | 'standard-value' | 'high-qty' | null;
}

  const deliverySmartFocusData: DeliveryFocusItem[] = useMemo(() => {
    if (deliverySmartBarMode === 'value') {
      return [
        {
          name: 'RDF Stream',
          value: deliveryStats.rdfVal,
          formatted: formatCurrency(deliveryStats.rdfVal),
          color: '#10b981',
          pct: `${Math.round(deliveryStats.rdfValuePct)}%`,
          drillKey: 'RDF'
        },
        {
          name: 'HP Stream',
          value: deliveryStats.hpVal,
          formatted: formatCurrency(deliveryStats.hpVal),
          color: '#8b5cf6',
          pct: `${Math.round(deliveryStats.hpValuePct)}%`,
          drillKey: 'HP'
        },
        {
          name: 'High Value (≥ 10M)',
          value: deliveryStats.highValueCount,
          formatted: `${deliveryStats.highValueCount} Shipments (≥ 10M ETB)`,
          color: '#0284c7',
          pct: `${Math.round((deliveryStats.highValueCount / Math.max(1, deliveryStats.totalLines)) * 100)}%`,
          drillKey: 'high-value'
        },
        {
          name: 'Mid Value (5M-10M)',
          value: deliveryStats.midValueCount,
          formatted: `${deliveryStats.midValueCount} Shipments (5M-10M ETB)`,
          color: '#06b6d4',
          pct: `${Math.round((deliveryStats.midValueCount / Math.max(1, deliveryStats.totalLines)) * 100)}%`,
          drillKey: 'mid-value'
        },
        {
          name: 'Standard (< 5M)',
          value: deliveryStats.standardValueCount,
          formatted: `${deliveryStats.standardValueCount} Shipments (< 5M ETB)`,
          color: '#64748b',
          pct: `${Math.round((deliveryStats.standardValueCount / Math.max(1, deliveryStats.totalLines)) * 100)}%`,
          drillKey: 'standard-value'
        }
      ];
    }
    if (deliverySmartBarMode === 'amount') {
      return [
        {
          name: 'RDF Stream (Units)',
          value: deliveryStats.rdfQty,
          formatted: `${formatNumber(deliveryStats.rdfQty)} Units`,
          color: '#10b981',
          pct: `${Math.round(deliveryStats.rdfAmountPct)}%`,
          drillKey: 'RDF'
        },
        {
          name: 'HP Stream (Units)',
          value: deliveryStats.hpQty,
          formatted: `${formatNumber(deliveryStats.hpQty)} Units`,
          color: '#8b5cf6',
          pct: `${Math.round(deliveryStats.hpAmountPct)}%`,
          drillKey: 'HP'
        },
        {
          name: 'Bulk Shipments (≥5 Units)',
          value: deliveryStats.highQtyCount,
          formatted: `${deliveryStats.highQtyCount} Batch Shipments`,
          color: '#14b8a6',
          pct: `${Math.round((deliveryStats.highQtyCount / Math.max(1, deliveryStats.totalLines)) * 100)}%`,
          drillKey: 'high-qty'
        }
      ];
    }
    return [
      {
        name: 'RDF Lines',
        value: deliveryStats.rdfLines,
        formatted: `${deliveryStats.rdfLines} Lines`,
        color: '#10b981',
        pct: `${Math.round(deliveryStats.rdfLinesPct)}%`,
        drillKey: 'RDF'
      },
      {
        name: 'HP Lines',
        value: deliveryStats.hpLines,
        formatted: `${deliveryStats.hpLines} Lines`,
        color: '#8b5cf6',
        pct: `${Math.round(deliveryStats.hpLinesPct)}%`,
        drillKey: 'HP'
      },
      {
        name: 'Total Dispatches',
        value: deliveryStats.totalLines,
        formatted: `${deliveryStats.totalLines} Total Lines`,
        color: '#3b82f6',
        pct: '100%',
        drillKey: null
      }
    ];
  }, [deliverySmartBarMode, deliveryStats]);

  const plantsList = useMemo(() => {
    return Array.from(new Set(activeRecords.map(r => r.plant))).filter(Boolean).sort();
  }, [activeRecords]);

  const regionsList = useMemo(() => {
    return Array.from(new Set(activeRecords.map(r => r.regionDescr))).filter(Boolean).sort();
  }, [activeRecords]);

  const podStatusesList = useMemo(() => {
    return Array.from(new Set(activeRecords.map(r => r.podStatus))).filter(Boolean).sort();
  }, [activeRecords]);

  const filteredRecords = useMemo(() => {
    return activeRecords.filter(r => {
      const matchesSearch =
        !searchQuery ||
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.materialDescr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.podNumbers.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.wbsElementDescr.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPlant = selectedPlant === 'all' || r.plant === selectedPlant;
      const matchesRegion = selectedRegion === 'all' || r.regionDescr === selectedRegion;
      const matchesStatus = selectedPodStatus === 'all' || r.podStatus === selectedPodStatus;
      const matchesStartDate = !startDate || (r.deliveryDate && r.deliveryDate >= startDate);
      const matchesEndDate = !endDate || (r.deliveryDate && r.deliveryDate <= endDate);

      // Smart Bar Graph Drill-Down Filter
      let matchesDrill = true;
      if (deliveryDrillDown.key === 'RDF') {
        matchesDrill = getDistributionFundStream(r) === 'RDF';
      } else if (deliveryDrillDown.key === 'HP') {
        matchesDrill = getDistributionFundStream(r) === 'HP';
      } else if (deliveryDrillDown.key === 'high-value') {
        matchesDrill = (Number(r.netValue) || 0) >= 10000000;
      } else if (deliveryDrillDown.key === 'mid-value') {
        const v = Number(r.netValue) || 0;
        matchesDrill = v >= 5000000 && v < 10000000;
      } else if (deliveryDrillDown.key === 'standard-value') {
        matchesDrill = (Number(r.netValue) || 0) < 5000000;
      } else if (deliveryDrillDown.key === 'high-qty') {
        matchesDrill = (Number(r.quantity) || 1) >= 5;
      }

      return matchesSearch && matchesPlant && matchesRegion && matchesStatus && matchesStartDate && matchesEndDate && matchesDrill;
    });
  }, [activeRecords, searchQuery, selectedPlant, selectedRegion, selectedPodStatus, startDate, endDate, deliveryDrillDown]);

  const stats = useMemo(() => {
    const totalLineItems = filteredRecords.length;
    const totalQty = filteredRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalNetValue = filteredRecords.reduce((sum, r) => sum + (r.netValue || 0), 0);
    const confirmedCount = filteredRecords.filter(
      r => r.podStatus.toLowerCase().includes('confirm') || r.podStatus.toLowerCase().includes('signed')
    ).length;
    return { totalLineItems, totalQty, totalNetValue, confirmedCount };
  }, [filteredRecords]);

  const handleExportCSV = () => {
    const data = filteredRecords.map(r => ({
      'Plant': r.plant,
      'Sales Org Descr': r.salesOrgDescr,
      'Customer Name': r.customerName,
      'Material Code': r.materialCode,
      'Material Descr': r.materialDescr,
      'Quantity': r.quantity,
      'Unit': r.unit,
      'Net Value': r.netValue,
      'Manufacturer Descr': r.manufacturerDescr,
      'Batch': r.batch,
      'Wbs Element Descr': r.wbsElementDescr,
      'Material Type Descr': r.materialTypeDescr,
      'Region Descr': r.regionDescr,
      'Zone Descr': r.zoneDescr,
      'Woreda Descr': r.woredaDescr,
      'POD status': r.podStatus,
      'Delivery Date': r.deliveryDate,
      'POD Numbers': r.podNumbers
    }));
    downloadCSV(`EPSS_Distribution_Data_Export_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  const handleLoadDemoDataset = () => {
    if (onUploadDistributionData) {
      const demoItems: DistributionDataRecord[] = DEFAULT_DISTRIBUTION_DATA_RECORDS.map((r, i) => ({
        ...r,
        id: `demo-${i}-${Date.now()}`
      }));
      onUploadDistributionData(demoItems, 'replace');
    }
  };

  const hasActiveCustomUpload = distributionRecords && distributionRecords.length > 0;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn w-full min-w-0 max-w-full">
      
      {/* =========================================================================
          TOP BANNER: UNIFIED DISTRIBUTION & MD TRANSFER COMMAND CENTER
          ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500/30 to-teal-500/30 border border-indigo-500/30 rounded-2xl backdrop-blur-md">
              <Truck className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">Distribution & MD Transfer Intelligence</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  Movement 641 + SAP Distribution
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Centralized distribution operations tracking inter-plant Medical Device transfers (Movement Type 641 hidden from receiving) and regional customer delivery dispatches with Proof of Delivery (POD).
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Distribution</span>
              </button>
            )}

            <button
              onClick={activeSubTab === 'transfers' ? handleExportTrfCSV : handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
              title="Download filtered records as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={downloadDistributionDataTemplateExcel}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Templates</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation Strip: MD Transfer to Plant (641) vs Regional Deliveries */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('transfers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              activeSubTab === 'transfers'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/30'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-cyan-300" />
            <span>MD Transfer to Plant</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeSubTab === 'transfers' ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {all641Records.length} records
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('deliveries')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              activeSubTab === 'deliveries'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/30'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-300" />
            <span>MD Deliver to HF</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeSubTab === 'deliveries' ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {activeRecords.length} records
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('combined')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              activeSubTab === 'combined'
                ? 'bg-purple-600 text-white shadow-md border border-purple-400/30'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/50'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-300" />
            <span>Combined Overview</span>
          </button>

          <div className="ml-auto text-xs text-slate-400 font-mono hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live EPSS Ledger Sync</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE 1: MD TRANSFER TO PLANT (MOVEMENT TYPE 641)
          User requested:
          1. "match the column table of MD Transfer to plant with column table of Receiving data"
          2. "change circle graph in to bar graph and give me in one bar graph by Total value transferred ,by amount, line of item, RDF and HP by smart bar graph"
          ========================================================================= */}
      {(activeSubTab === 'transfers' || activeSubTab === 'combined') && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Executive Header & Explanatory Banner for Movement Type 641 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-800 shrink-0">
                  <ArrowDownLeft className="w-6 h-6 text-blue-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                      MD Transfer to Plant
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      Movement Type 641 &bull; Routed to Distribution
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Analyzes cross-plant Medical Device transfers originating from Goods Receipt ledgers. All metrics broken down by Total Value, Amount (Quantity), Line Items, and RDF vs HP.
                  </p>
                </div>
              </div>

              {/* Quick 641 Demo Persistence Button */}
              {all641Records === SAMPLE_MD_TRANSFER_641_RECORDS && (
                <button
                  type="button"
                  onClick={handleLoadDemo641Transfers}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs self-start md:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Persist Demo 641 Records</span>
                </button>
              )}
            </div>

            {/* Quick 641 Notice Card */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Accounting Rule:</strong> SAP Movement Type 641 represents cross-plant Medical Device stock transport orders (TF to plant). To avoid duplicate inventory valuation, these are isolated from standard Goods Receipt (101/105) and visualized here under Distribution Data with matched Receiving Data columns.
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              5 EXECUTIVE METRIC CARDS FOR MD TRANSFER TO PLANT
              ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            
            {/* Card 1: Total Value Transferred */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Value Transferred
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(trfStats.totalValue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-emerald-600">RDF: {formatCurrency(trfStats.rdfVal)}</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-purple-600">HP: {formatCurrency(trfStats.hpVal)}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${trfStats.rdfValuePct}%` }} title={`RDF: ${Math.round(trfStats.rdfValuePct)}%`} />
                <div className="bg-purple-500 h-full" style={{ width: `${trfStats.hpValuePct}%` }} title={`HP: ${Math.round(trfStats.hpValuePct)}%`} />
              </div>
            </div>

            {/* Card 2: Total Amount Transferred (Quantity Units) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  By Amount (Quantity)
                </span>
                <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {formatNumber(trfStats.totalQty)} <span className="text-xs text-slate-400 font-normal">Units</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-emerald-600">RDF: {formatNumber(trfStats.rdfQty)}u</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-purple-600">HP: {formatNumber(trfStats.hpQty)}u</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${trfStats.rdfAmountPct}%` }} title={`RDF: ${Math.round(trfStats.rdfAmountPct)}%`} />
                <div className="bg-purple-500 h-full" style={{ width: `${trfStats.hpAmountPct}%` }} title={`HP: ${Math.round(trfStats.hpAmountPct)}%`} />
              </div>
            </div>

            {/* Card 3: By Line of Item */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  By Line of Item
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {formatNumber(trfStats.totalLines)} <span className="text-xs text-slate-400 font-normal">Lines</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-emerald-600">RDF: {trfStats.rdfLines} items</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-purple-600">HP: {trfStats.hpLines} items</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${trfStats.rdfLinesPct}%` }} title={`RDF: ${Math.round(trfStats.rdfLinesPct)}%`} />
                <div className="bg-purple-500 h-full" style={{ width: `${trfStats.hpLinesPct}%` }} title={`HP: ${Math.round(trfStats.hpLinesPct)}%`} />
              </div>
            </div>

            {/* Card 4: Revolving Drug Fund (RDF) */}
            <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/70 rounded-2xl p-4 border border-emerald-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>RDF Stream</span>
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-emerald-950 tracking-tight">
                  {formatCurrency(trfStats.rdfVal)}
                </div>
                <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  {formatNumber(trfStats.rdfQty)} units &bull; {trfStats.rdfLines} line items ({Math.round(trfStats.rdfValuePct)}% Value)
                </div>
              </div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Revolving Fund Capital</div>
            </div>

            {/* Card 5: Health Program (HP) */}
            <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/70 rounded-2xl p-4 border border-purple-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>HP Stream</span>
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-purple-950 tracking-tight">
                  {formatCurrency(trfStats.hpVal)}
                </div>
                <div className="text-[11px] text-purple-800 font-medium mt-0.5">
                  {formatNumber(trfStats.hpQty)} units &bull; {trfStats.hpLines} line items ({Math.round(trfStats.hpValuePct)}% Value)
                </div>
              </div>
              <div className="text-[10px] font-bold text-purple-600 uppercase">Grants & Project Stock (Q)</div>
            </div>

          </div>

          {/* =========================================================================
              THE SMART BAR GRAPH (CHANGED FROM CIRCLE GRAPH AS REQUESTED)
              "change circle graph in to bar graph and give me in one bar graph
               by Total value transferred ,by amount, line of item, RDF and HP by smart bar graph"
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            
            {/* Smart Bar Graph Header & Interactive View Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 text-white shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Smart Bar Graph: MD Transfer Multi-Metric Intelligence
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Unified 1-Graph Architecture
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visualizes Total Value Transferred, Amount (Quantity), Line of Items, RDF, and HP in a single smart responsive chart.
                  </p>
                </div>
              </div>

              {/* Smart View Mode Selector */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSmartBarMode('all-in-one')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    smartBarMode === 'all-in-one'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="All 3 dimensions in 1 smart bar chart"
                >
                  <span>⚡ All-in-One Multi-Metric</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSmartBarMode('stream-comparison')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    smartBarMode === 'stream-comparison'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Compare RDF, HP, and Combined Total side-by-side"
                >
                  <span>📊 Stream Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSmartBarMode('value')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    smartBarMode === 'value'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💰 Total Value
                </button>
                <button
                  type="button"
                  onClick={() => setSmartBarMode('amount')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    smartBarMode === 'amount'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📦 Amount (Qty)
                </button>
                <button
                  type="button"
                  onClick={() => setSmartBarMode('lines')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    smartBarMode === 'lines'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Line Items
                </button>
              </div>
            </div>

            {/* Smart Chart Container */}
            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {smartBarMode === 'all-in-one' ? (
                  /* Mode 1: All-in-One Smart Multi-Metric Bar Graph (Total Value, Amount Qty, Line Items with RDF & HP) */
                  <BarChart
                    data={smartAllInOneData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="dimension"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2">
                              <div className="font-bold border-b border-slate-700 pb-1 text-cyan-400">
                                {data.dimension} ({data.unit})
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span>RDF (Revolving Drug Fund):</span>
                                  </span>
                                  <span className="font-bold font-mono text-emerald-400">
                                    {data.RDF_Formatted} ({data.RDF_Share}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                    <span>HP (Health Program):</span>
                                  </span>
                                  <span className="font-bold font-mono text-purple-400">
                                    {data.HP_Formatted} ({data.HP_Share}%)
                                  </span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between text-slate-300 font-semibold">
                                  <span>Total Transferred:</span>
                                  <span className="font-bold font-mono text-white">
                                    {data.Total_Formatted} (100%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 12, fontWeight: 600 }}
                    />
                    <Bar
                      name="RDF — Revolving Drug Fund (% Share)"
                      dataKey="RDF_Share"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={() => handleTrfBarClick('RDF', 'RDF Stream')}
                      label={{
                        position: 'top',
                        formatter: (val: any) => `${val}%`,
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#059669'
                      }}
                    />
                    <Bar
                      name="HP — Health Program Grants (% Share)"
                      dataKey="HP_Share"
                      fill="#8b5cf6"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={() => handleTrfBarClick('HP', 'HP Stream')}
                      label={{
                        position: 'top',
                        formatter: (val: any) => `${val}%`,
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#7c3aed'
                      }}
                    />
                  </BarChart>
                ) : smartBarMode === 'stream-comparison' ? (
                  /* Mode 2: Multi-Metric Stream Comparison (Value in Millions ETB, Amount Units, Line Items) */
                  <BarChart
                    data={smartStreamComparisonData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="stream"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      label={{ value: 'Valuation (Millions ETB)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      label={{ value: 'Units & Line Count', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2">
                              <div className="font-bold border-b border-slate-700 pb-1 text-cyan-400">
                                {data.stream}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-blue-300">Total Value Transferred:</span>
                                  <span className="font-bold font-mono text-white">{data.valueFormatted}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-teal-300">Amount Transferred:</span>
                                  <span className="font-bold font-mono text-white">{data.amountFormatted}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-amber-300">Line of Items:</span>
                                  <span className="font-bold font-mono text-white">{data.linesFormatted}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 12, fontWeight: 600 }}
                    />
                    <Bar
                      yAxisId="left"
                      name="Total Value Transferred (Million ETB)"
                      dataKey="valueInMillions"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      name="Amount Transferred (Quantity Units)"
                      dataKey="amountUnits"
                      fill="#14b8a6"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      name="Line of Items"
                      dataKey="lineItems"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  /* Mode 3: Focused Bar Graph for Value, Amount, or Lines */
                  <BarChart
                    data={smartFocusData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [item.payload.formatted, item.payload.name]}
                    />
                    <Bar
                      dataKey="value"
                      radius={[8, 8, 0, 0]}
                      label={{
                        position: 'top',
                        formatter: (val: any) => {
                          const item = smartFocusData.find(d => d.value === val);
                          return item ? item.pct : '';
                        },
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#334155'
                      }}
                    >
                      {smartFocusData.map((entry, index) => (
                        <Cell key={`focus-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Smart KPI Comparative Summary Matrix Below Bar Graph */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              
              {/* Valuation Matrix Card */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <span>Total Value Transferred</span>
                  </span>
                  <span className="font-mono text-slate-900">{formatCurrency(trfStats.totalValue)}</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {formatCurrency(trfStats.rdfVal)}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(trfStats.rdfValuePct)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {formatCurrency(trfStats.hpVal)}</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(trfStats.hpValuePct)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount (Quantity) Matrix Card */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-teal-600" />
                    <span>By Amount (Quantity)</span>
                  </span>
                  <span className="font-mono text-slate-900">{formatNumber(trfStats.totalQty)} Units</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {formatNumber(trfStats.rdfQty)} Units</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(trfStats.rdfAmountPct)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {formatNumber(trfStats.hpQty)} Units</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(trfStats.hpAmountPct)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Line of Items Matrix Card */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-600" />
                    <span>By Line of Item</span>
                  </span>
                  <span className="font-mono text-slate-900">{trfStats.totalLines} Items</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {trfStats.rdfLines} Items</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(trfStats.rdfLinesPct)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {trfStats.hpLines} Items</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(trfStats.hpLinesPct)}%
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Active Drill-Down Filter Notice Banner for MD Transfer to Plant */}
          {trfDrillDown.key && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-teal-50 border border-blue-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Active Smart Bar Drill-Down:
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-600 text-white shadow-2xs font-mono">
                      {trfDrillDown.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {filteredTrfRecords.length} of {all641Records.length} records matching
                    </span>
                  </div>
                  {trfDrillDown.description && (
                    <p className="text-xs text-slate-600 mt-1">{trfDrillDown.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrfDrillDown({ key: null, label: '', description: '' })}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
                title="Clear drill-down and show all MD transfers"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Drill-Down</span>
              </button>
            </div>
          )}

          {/* =========================================================================
              FILTER & SEARCH BAR FOR MD TRANSFER TO PLANT
              ========================================================================= */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={trfSearchQuery}
                  onChange={(e) => setTrfSearchQuery(e.target.value)}
                  placeholder="Search MD Transfers by Material, PO, Batch, WBS, Plant Hub, SLoc..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {trfSearchQuery && (
                  <button
                    onClick={() => setTrfSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Controls Strip */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                
                {/* Destination Plant Hub Filter */}
                <select
                  value={trfSelectedPlant}
                  onChange={(e) => setTrfSelectedPlant(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Filter by Destination Plant Hub"
                >
                  <option value="all">All Plant Hubs ({trfPlantsList.length})</option>
                  {trfPlantsList.map(p => (
                    <option key={p} value={p}>Plant: {p}</option>
                  ))}
                </select>

                {/* Fund Stream Filter (RDF vs HP) */}
                <select
                  value={trfSelectedStream}
                  onChange={(e) => setTrfSelectedStream(e.target.value as 'all' | 'RDF' | 'HP')}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Filter by Fund Stream"
                >
                  <option value="all">All Fund Streams (RDF & HP)</option>
                  <option value="RDF">RDF — Revolving Drug Fund</option>
                  <option value="HP">HP — Health Program (Q Stock)</option>
                </select>

                {/* From Date */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                  <input
                    type="date"
                    value={trfStartDate}
                    onChange={(e) => setTrfStartDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {/* To Date */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                  <input
                    type="date"
                    value={trfEndDate}
                    onChange={(e) => setTrfEndDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Reset Filters */}
                {(trfSearchQuery || trfSelectedPlant !== 'all' || trfSelectedStream !== 'all' || trfStartDate || trfEndDate || trfSortField !== 'default' || trfDrillDown.key) && (
                  <button
                    onClick={() => {
                      setTrfSearchQuery('');
                      setTrfSelectedPlant('all');
                      setTrfSelectedStream('all');
                      setTrfStartDate('');
                      setTrfEndDate('');
                      setTrfSortField('default');
                      setTrfDrillDown({ key: null, label: '', description: '' });
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 px-3 py-2 bg-blue-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}

              </div>
            </div>
          </div>

          {/* =========================================================================
              MD TRANSFER TO PLANT (MOVEMENT TYPE 641) LEDGER TABLE
              * MATCHED WITH THE COLUMN TABLE OF RECEIVING DATA *
              Columns matched:
              1. # (index)
              2. Purchase order
              3. Reference
              4. Material
              5. Material Description
              6. Batch
              7. Quantity (Sortable)
              8. Storage Location
              9. Amt.in Loc.Cur. (Sortable)
              10. Movement Type (641 badge)
              11. Special Stock (RDF / Q badge)
              12. WBS Element
              13. Plant
              14. Posting Date (Sortable)
              15. Stock Holding Days (Sortable, dynamic alert calculation)
              16. Action (Inspect)
              ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 text-center">#</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Purchase order</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Reference</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Material</th>
                    <th className="py-3 px-3.5 min-w-[220px] border-x border-slate-200">Material Description</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Batch</th>
                    <th
                      className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => handleToggleTrfSort('quantity')}
                      title="Click to sort by Quantity"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Quantity</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Storage Location</th>
                    <th
                      className="py-3 px-3.5 text-right whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => handleToggleTrfSort('amt')}
                      title="Click to sort by Valuation (Amt.in Loc.Cur.)"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amt.in Loc.Cur.</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200">Movement Type</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 text-center">Special Stock</th>
                    <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">WBS Element</th>
                    <th className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200">Plant</th>
                    <th
                      className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => handleToggleTrfSort('postingDate')}
                      title="Click to sort by Posting Date"
                    >
                      <div className="flex items-center gap-1">
                        <span>Posting Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => handleToggleTrfSort('holdingDays')}
                      title="Click to sort by Stock Holding Days"
                    >
                      <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        <span>Stock Holding Days</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="text-[9px] font-normal text-slate-500 mt-0.5 font-sans text-center">
                        Auto-calculated from posting date
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-[11px]">
                  {sortedTrfRecords.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-16 text-center text-slate-400 font-sans">
                        <ArrowDownLeft className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
                        <p className="text-sm font-semibold text-slate-800">
                          No Movement Type 641 transfer records match your current filters
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Try resetting filters or uploading receiving data containing 641 movement types.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    sortedTrfRecords.map((rec, index) => {
                      const stream = getReceivingFundStream(rec);
                      const holdingDays = calculateStockHoldingDays(rec.postingDate || rec.entryDate, rec);
                      const isExceedingAlert = holdingDays !== null && holdingDays > 90;

                      return (
                        <tr
                          key={rec.id || index}
                          className="hover:bg-blue-50/40 transition group cursor-pointer"
                          onClick={() => setInspectingTransferRecord(rec)}
                        >
                          {/* 1. # Index */}
                          <td className="py-2.5 px-3.5 text-center text-slate-400 text-[10px] border-x border-slate-200">
                            {index + 1}
                          </td>

                          {/* 2. Purchase Order */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-blue-700 border-x border-slate-200">
                            {rec.purchaseOrder}
                          </td>

                          {/* 3. Reference */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 border-x border-slate-200">
                            {rec.reference || '-'}
                          </td>

                          {/* 4. Material */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap font-semibold text-slate-900 border-x border-slate-200">
                            {rec.material}
                          </td>

                          {/* 5. Material Description */}
                          <td className="py-2.5 px-3.5 font-sans font-medium text-slate-900 max-w-xs truncate border-x border-slate-200" title={rec.materialDescription}>
                            {rec.materialDescription}
                          </td>

                          {/* 6. Batch */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 border-x border-slate-200">
                            {rec.batch || '-'}
                          </td>

                          {/* 7. Quantity */}
                          <td className="py-2.5 px-3.5 text-center font-bold text-slate-900 border-x border-slate-200">
                            {rec.quantity?.toLocaleString() || 0}
                          </td>

                          {/* 8. Storage Location */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-700 border-x border-slate-200">
                            <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-200">
                              {rec.storageLocation || 'SL01'}
                            </span>
                          </td>

                          {/* 9. Amt.in Loc.Cur. */}
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-bold text-emerald-600 border-x border-slate-200">
                            {formatCurrency(rec.amtInLocCur)}
                          </td>

                          {/* 10. Movement Type */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-x border-slate-200">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                              <ArrowDownLeft className="w-3 h-3 text-blue-600" />
                              <span>{rec.movementType || '641'}</span>
                            </span>
                          </td>

                          {/* 11. Special Stock */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-center text-slate-500 border-x border-slate-200">
                            {rec.specialStock === 'Q' || stream === 'HP' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                {rec.specialStock || 'Q'} &bull; HP
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {rec.specialStock || 'RDF'}
                              </span>
                            )}
                          </td>

                          {/* 12. WBS Element */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 text-[10px] border-x border-slate-200">
                            {rec.wbsElement || '-'}
                          </td>

                          {/* 13. Plant */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-x border-slate-200">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {rec.plant || 'AA01'}
                            </span>
                          </td>

                          {/* 14. Posting Date */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap border-x border-slate-200">
                            {rec.postingDate ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{rec.postingDate}</span>
                                {rec.postingDay && rec.postingMonth && rec.postingYear && (
                                  <span className="text-[9px] font-sans px-1.5 py-0.2 rounded-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                    D{rec.postingDay}/M{rec.postingMonth}/Y{rec.postingYear}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-sans italic text-[10px]">-</span>
                            )}
                          </td>

                          {/* 15. Stock Holding Days */}
                          <td className={`py-2.5 px-3.5 text-center whitespace-nowrap border-x transition ${
                            isExceedingAlert
                              ? 'border-rose-300 bg-rose-100/70'
                              : 'border-slate-200'
                          }`}>
                            {holdingDays !== null ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                  holdingDays <= 30
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : holdingDays <= 60
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : holdingDays <= 90
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{holdingDays} {holdingDays === 1 ? 'Day' : 'Days'}</span>
                                <span className="text-[9px] font-sans opacity-70">
                                  ({holdingDays <= 30 ? '<30d Fresh' : holdingDays <= 60 ? '31-60d Active' : holdingDays <= 90 ? '61-90d Safe' : '>90d Alert'})
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans text-[11px] italic">No Date</span>
                            )}
                          </td>

                          {/* 16. Action */}
                          <td className="py-2.5 px-3.5 text-center border-x border-slate-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingTransferRecord(rec);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                              title="Inspect full 641 transfer metadata"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary Stats (Matched with Receiving Data Table Footer) */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  Showing {sortedTrfRecords.length} of {all641Records.length} MD Transfer records
                </span>
                <span>&bull;</span>
                <span className="text-blue-700 font-medium">15 columns matched with Receiving Data ledger</span>
              </div>
              <div className="flex items-center gap-4 font-mono font-bold text-slate-800">
                <span>Total Amount: <strong className="text-cyan-700">{formatNumber(trfStats.totalQty)} Units</strong></span>
                <span>Total Valuation: <strong className="text-emerald-700">{formatCurrency(trfStats.totalValue)}</strong></span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: REGIONAL CUSTOMER DELIVERIES & POD (18 SAP COLUMNS)
          ========================================================================= */}
      {(activeSubTab === 'deliveries' || activeSubTab === 'combined') && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <Truck className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  MD Deliver to HF & POD Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  18 standard SAP distribution columns tracking health facility shipments, proof of delivery (POD), and net value across EPSS hubs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!hasActiveCustomUpload && (
                <button
                  onClick={handleLoadDemoDataset}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 rounded-xl text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Load Demo Deliveries</span>
                </button>
              )}

              {hasActiveCustomUpload && onClearDistributionData && (
                <button
                  onClick={onClearDistributionData}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  title="Clear uploaded custom records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Upload</span>
                </button>
              )}
            </div>
          </div>

          {/* Deliveries Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatched Items</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{formatNumber(stats.totalLineItems)}</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  {formatNumber(stats.totalQty)} total units
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Net Value</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(stats.totalNetValue)}</h3>
                <p className="text-xs text-slate-500 mt-1">Valued across regional deliveries</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmed POD Signed</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{formatNumber(stats.confirmedCount)}</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  {stats.totalLineItems > 0 ? Math.round((stats.confirmedCount / stats.totalLineItems) * 100) : 0}% POD success rate
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Regional Hubs</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{plantsList.length} Hubs</h3>
                <p className="text-xs text-slate-500 mt-1">{regionsList.length} regions covered</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                <Warehouse className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* =========================================================================
              SMART BAR GRAPH: MD DELIVER TO HF MULTI-METRIC INTELLIGENCE WITH DRILL-DOWN
              * User Request: Support drill-down functionality: clicking on any bar
                filters the associated data table below to show only items matching
                that specific attribute (RDF/HP, Total Value, etc.). *
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
            
            {/* Header & Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Smart Bar Graph: MD Deliver to HF Intelligence
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                      Click Any Bar to Drill Down
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visualizes Total Net Value, Amount (Units), Line of Items, RDF, and HP. Click any bar to instantly filter the delivery table below.
                  </p>
                </div>
              </div>

              {/* View Mode Selector */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setDeliverySmartBarMode('all-in-one')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    deliverySmartBarMode === 'all-in-one'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Multi-metric view with RDF & HP breakdown"
                >
                  <span>⚡ All-in-One Multi-Metric</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliverySmartBarMode('stream-comparison')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    deliverySmartBarMode === 'stream-comparison'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Side-by-side comparison of RDF, HP, and Total"
                >
                  <span>📊 Stream Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliverySmartBarMode('value')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    deliverySmartBarMode === 'value'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💰 Net Value
                </button>
                <button
                  type="button"
                  onClick={() => setDeliverySmartBarMode('amount')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    deliverySmartBarMode === 'amount'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📦 Amount (Qty)
                </button>
                <button
                  type="button"
                  onClick={() => setDeliverySmartBarMode('lines')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    deliverySmartBarMode === 'lines'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Line Items
                </button>
              </div>
            </div>

            {/* Quick Drill-Down Interactive Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                <span>Drill-Down Filter:</span>
              </span>
              <button
                type="button"
                onClick={() => handleDeliveryBarClick('RDF', 'RDF Stream (Revolving Drug Fund)')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  deliveryDrillDown.key === 'RDF'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
                title="Filter table to RDF items"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>RDF Stream ({deliveryStats.rdfLines} items &bull; {formatCurrency(deliveryStats.rdfVal)})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeliveryBarClick('HP', 'HP Stream (Health Program Grants)')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  deliveryDrillDown.key === 'HP'
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                }`}
                title="Filter table to Health Program items"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>HP Stream ({deliveryStats.hpLines} items &bull; {formatCurrency(deliveryStats.hpVal)})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeliveryBarClick('high-value', 'High-Value Items (≥ 10M ETB)')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  deliveryDrillDown.key === 'high-value'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
                title="Filter table to items valued at 10M+ ETB"
              >
                <DollarSign className="w-3 h-3 text-blue-600" />
                <span>High-Value &ge; 10M ETB ({deliveryStats.highValueCount} items)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeliveryBarClick('high-qty', 'Bulk Shipments (≥ 5 Units)')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  deliveryDrillDown.key === 'high-qty'
                    ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                }`}
                title="Filter table to bulk shipments with 5+ units"
              >
                <Package className="w-3 h-3 text-teal-600" />
                <span>Bulk &ge; 5 Units ({deliveryStats.highQtyCount} items)</span>
              </button>

              {deliveryDrillDown.key && (
                <button
                  type="button"
                  onClick={() => setDeliveryDrillDown({ key: null, label: '', description: '' })}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 transition flex items-center gap-1 cursor-pointer"
                  title="Clear active drill-down filter"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Drill-Down</span>
                </button>
              )}
            </div>

            {/* Smart Chart Container */}
            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {deliverySmartBarMode === 'all-in-one' ? (
                  /* Mode 1: All-in-One Smart Multi-Metric Bar Graph with Interactive Click Drill-Down */
                  <BarChart
                    data={deliverySmartAllInOneData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="dimension"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2">
                              <div className="font-bold border-b border-slate-700 pb-1 text-emerald-400">
                                {data.dimension} ({data.unit})
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span>RDF (Revolving Drug Fund):</span>
                                  </span>
                                  <span className="font-bold font-mono text-emerald-400">
                                    {data.RDF_Formatted} ({data.RDF_Share}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                    <span>HP (Health Program):</span>
                                  </span>
                                  <span className="font-bold font-mono text-purple-400">
                                    {data.HP_Formatted} ({data.HP_Share}%)
                                  </span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between text-slate-300 font-semibold">
                                  <span>Total Dispatched:</span>
                                  <span className="font-bold font-mono text-white">
                                    {data.Total_Formatted} (100%)
                                  </span>
                                </div>
                              </div>
                              <div className="pt-1.5 border-t border-slate-800 text-[10px] text-teal-300 font-semibold flex items-center gap-1">
                                <span>👉 Click bar to drill down table below by RDF or HP</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 12, fontWeight: 600 }}
                    />
                    <Bar
                      name="RDF — Revolving Drug Fund (% Share)"
                      dataKey="RDF_Share"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={() => handleDeliveryBarClick('RDF', 'RDF Stream (Revolving Drug Fund)')}
                      label={{
                        position: 'top',
                        formatter: (val: any) => `${val}%`,
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#059669'
                      }}
                    />
                    <Bar
                      name="HP — Health Program Grants (% Share)"
                      dataKey="HP_Share"
                      fill="#8b5cf6"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={() => handleDeliveryBarClick('HP', 'HP Stream (Health Program Grants)')}
                      label={{
                        position: 'top',
                        formatter: (val: any) => `${val}%`,
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#7c3aed'
                      }}
                    />
                  </BarChart>
                ) : deliverySmartBarMode === 'stream-comparison' ? (
                  /* Mode 2: Multi-Metric Stream Comparison with Drill-Down */
                  <BarChart
                    data={deliverySmartStreamComparisonData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="stream"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      label={{ value: 'Net Value (Million ETB)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      label={{ value: 'Units & Line Items', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2">
                              <div className="font-bold border-b border-slate-700 pb-1 text-emerald-400">
                                {data.stream}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-blue-300">Total Net Value:</span>
                                  <span className="font-bold font-mono text-white">{data.valueFormatted}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-teal-300">Amount (Quantity):</span>
                                  <span className="font-bold font-mono text-white">{data.amountFormatted}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-amber-300">Line Items:</span>
                                  <span className="font-bold font-mono text-white">{data.linesFormatted}</span>
                                </div>
                              </div>
                              <div className="pt-1.5 border-t border-slate-800 text-[10px] text-teal-300 font-semibold flex items-center gap-1">
                                <span>👉 Click bar to drill down to {data.shortName} records</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 12, fontWeight: 600 }}
                    />
                    <Bar
                      yAxisId="left"
                      name="Total Net Value (Million ETB)"
                      dataKey="valueInMillions"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const target = data?.shortName === 'RDF' ? 'RDF' : data?.shortName === 'HP' ? 'HP' : 'high-value';
                        handleDeliveryBarClick(target as any);
                      }}
                    />
                    <Bar
                      yAxisId="right"
                      name="Dispatched Amount (Units)"
                      dataKey="amountUnits"
                      fill="#14b8a6"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const target = data?.shortName === 'RDF' ? 'RDF' : data?.shortName === 'HP' ? 'HP' : 'high-qty';
                        handleDeliveryBarClick(target as any);
                      }}
                    />
                    <Bar
                      yAxisId="right"
                      name="Line of Items"
                      dataKey="lineItems"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const target = data?.shortName === 'RDF' ? 'RDF' : data?.shortName === 'HP' ? 'HP' : null;
                        handleDeliveryBarClick(target as any);
                      }}
                    />
                  </BarChart>
                ) : (
                  /* Mode 3: Focused Bar Graph with Interactive Click Drill-Down */
                  <BarChart
                    data={deliverySmartFocusData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                              <div className="font-bold text-emerald-400">{item.name}</div>
                              <div className="font-mono text-sm">{item.formatted}</div>
                              <div className="text-slate-400 text-[10px]">Share: {item.pct}</div>
                              <div className="pt-1 text-[10px] text-teal-300 font-semibold">👉 Click to drill down into this attribute</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[8, 8, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data && data.drillKey) {
                          handleDeliveryBarClick(data.drillKey, data.name);
                        }
                      }}
                      label={{
                        position: 'top',
                        formatter: (val: any) => {
                          const item = deliverySmartFocusData.find(d => d.value === val);
                          return item ? item.pct : '';
                        },
                        fontSize: 11,
                        fontWeight: 700,
                        fill: '#334155'
                      }}
                    >
                      {deliverySmartFocusData.map((entry, index) => (
                        <Cell
                          key={`delivery-focus-cell-${index}`}
                          fill={entry.color}
                          stroke={deliveryDrillDown.key === entry.drillKey ? '#0f172a' : 'none'}
                          strokeWidth={deliveryDrillDown.key === entry.drillKey ? 2 : 0}
                          cursor="pointer"
                          onClick={() => handleDeliveryBarClick(entry.drillKey as any, entry.name)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Smart KPI Comparative Summary Matrix Below Bar Graph with Click-to-Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              
              {/* Valuation Matrix Card */}
              <div
                onClick={() => handleDeliveryBarClick('high-value', 'High-Value Items (≥ 10M ETB)')}
                className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-3 border border-slate-200 transition cursor-pointer"
                title="Click to drill down into high-value dispatches"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <span>Total Net Value Delivered</span>
                  </span>
                  <span className="font-mono text-slate-900">{formatCurrency(deliveryStats.totalValue)}</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('RDF', 'RDF Stream (Revolving Drug Fund)'); }}
                    className="flex items-center justify-between hover:bg-emerald-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {formatCurrency(deliveryStats.rdfVal)}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(deliveryStats.rdfValuePct)}%
                    </span>
                  </div>
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('HP', 'HP Stream (Health Program Grants)'); }}
                    className="flex items-center justify-between hover:bg-purple-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {formatCurrency(deliveryStats.hpVal)}</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(deliveryStats.hpValuePct)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount (Quantity) Matrix Card */}
              <div
                onClick={() => handleDeliveryBarClick('high-qty', 'Bulk Shipments (≥ 5 Units)')}
                className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-3 border border-slate-200 transition cursor-pointer"
                title="Click to drill down into bulk shipments"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-teal-600" />
                    <span>By Amount (Quantity)</span>
                  </span>
                  <span className="font-mono text-slate-900">{formatNumber(deliveryStats.totalQty)} Units</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('RDF', 'RDF Stream (Revolving Drug Fund)'); }}
                    className="flex items-center justify-between hover:bg-emerald-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {formatNumber(deliveryStats.rdfQty)} Units</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(deliveryStats.rdfAmountPct)}%
                    </span>
                  </div>
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('HP', 'HP Stream (Health Program Grants)'); }}
                    className="flex items-center justify-between hover:bg-purple-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {formatNumber(deliveryStats.hpQty)} Units</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(deliveryStats.hpAmountPct)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Line of Items Matrix Card */}
              <div
                onClick={() => handleDeliveryBarClick('RDF', 'RDF Line Items')}
                className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-3 border border-slate-200 transition cursor-pointer"
                title="Click to drill down into delivery lines"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-600" />
                    <span>By Line of Item</span>
                  </span>
                  <span className="font-mono text-slate-900">{deliveryStats.totalLines} Items</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('RDF', 'RDF Line Items'); }}
                    className="flex items-center justify-between hover:bg-emerald-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>RDF: {deliveryStats.rdfLines} items</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(deliveryStats.rdfLinesPct)}%
                    </span>
                  </div>
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDeliveryBarClick('HP', 'HP Line Items'); }}
                    className="flex items-center justify-between hover:bg-purple-50 p-0.5 rounded cursor-pointer"
                  >
                    <span className="text-purple-700 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>HP: {deliveryStats.hpLines} items</span>
                    </span>
                    <span className="font-mono font-bold text-purple-800">
                      {Math.round(deliveryStats.hpLinesPct)}%
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Active Drill-Down Filter Notice Banner for MD Deliver to HF */}
          {deliveryDrillDown.key && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Active Smart Bar Drill-Down:
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-600 text-white shadow-2xs font-mono">
                      {deliveryDrillDown.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {filteredRecords.length} of {activeRecords.length} items matching
                    </span>
                  </div>
                  {deliveryDrillDown.description && (
                    <p className="text-xs text-slate-600 mt-1">{deliveryDrillDown.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryDrillDown({ key: null, label: '', description: '' })}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
                title="Clear drill-down and show all delivery items"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Drill-Down</span>
              </button>
            </div>
          )}

          {/* Filter & Search Bar for Deliveries */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by customer name, material code, description, POD number..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                
                {/* Plant Filter */}
                <select
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Plants (Hubs)</option>
                  {plantsList.map(p => (
                    <option key={p} value={p}>Plant: {p}</option>
                  ))}
                </select>

                {/* Region Filter */}
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Regions</option>
                  {regionsList.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>

                {/* POD Status Filter */}
                <select
                  value={selectedPodStatus}
                  onChange={(e) => setSelectedPodStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All POD Statuses</option>
                  {podStatusesList.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>

                {/* Delivery Start Date Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Delivery End Date Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {(searchQuery || selectedPlant !== 'all' || selectedRegion !== 'all' || selectedPodStatus !== 'all' || startDate || endDate || deliveryDrillDown.key) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPlant('all');
                      setSelectedRegion('all');
                      setSelectedPodStatus('all');
                      setStartDate('');
                      setEndDate('');
                      setDeliveryDrillDown({ key: null, label: '', description: '' });
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-3 py-2 bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}

              </div>

            </div>
          </div>

          {/* Main Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-3 px-4">Plant / Hub</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Material Code & Description</th>
                    <th className="py-3 px-4 text-right">Quantity & Unit</th>
                    <th className="py-3 px-4 text-right">Net Value</th>
                    <th className="py-3 px-4">Region / Zone</th>
                    <th className="py-3 px-4">WBS Element Descr</th>
                    <th className="py-3 px-4">POD Status</th>
                    <th className="py-3 px-4">Delivery Date</th>
                    <th className="py-3 px-4">POD Number</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-semibold">No distribution records match your current filters</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting filters or uploading new distribution records.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{r.plant}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 max-w-[200px] truncate">{r.customerName}</div>
                          <div className="text-[10px] text-slate-500 truncate">{r.salesOrgDescr}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="font-mono font-semibold text-emerald-800">{r.materialCode}</div>
                          <div className="text-slate-600 truncate">{r.materialDescr}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatNumber(r.quantity)} <span className="text-slate-500 font-normal">{r.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {formatCurrency(r.netValue)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{r.regionDescr}</div>
                          <div className="text-[10px] text-slate-500">{r.zoneDescr} • {r.woredaDescr}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <div className="font-mono text-[11px] font-medium text-slate-800 truncate" title={r.wbsElementDescr}>
                            {r.wbsElementDescr}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.podStatus.toLowerCase().includes('confirm') || r.podStatus.toLowerCase().includes('signed')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {r.podStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {r.deliveryDate}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {r.podNumbers}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setInspectingRecord(r)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Record"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL 1: INSPECT MD TRANSFER (MOVEMENT TYPE 641) RECORD
          ========================================================================= */}
      {inspectingTransferRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <ArrowDownLeft className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">MD Transfer to Plant</h3>
                  <p className="text-xs text-blue-200 font-mono">PO: {inspectingTransferRecord.purchaseOrder}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingTransferRecord(null)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Movement Type</span>
                  <span className="font-bold text-blue-800 text-sm font-mono">
                    {inspectingTransferRecord.movementType || '641'} ({inspectingTransferRecord.movementTypeText || 'TF to plant'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Fund Stream</span>
                  <span className={`font-bold text-sm ${
                    getReceivingFundStream(inspectingTransferRecord) === 'RDF' ? 'text-emerald-700' : 'text-purple-700'
                  }`}>
                    {getReceivingFundStream(inspectingTransferRecord) === 'RDF' ? 'RDF — Revolving Drug Fund' : 'HP — Health Program (Q Stock)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Destination Plant Hub</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{inspectingTransferRecord.plant}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Storage Location</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{inspectingTransferRecord.storageLocation || 'SL01'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Material & Valuation Information</h4>
                <div className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Material Code</span>
                    <span className="font-mono font-bold text-blue-900 text-sm">{inspectingTransferRecord.material}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batch Number</span>
                    <span className="font-mono font-bold text-slate-800">{inspectingTransferRecord.batch || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Material Description</span>
                    <span className="font-bold text-slate-900">{inspectingTransferRecord.materialDescription}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Transferred Amount (Qty)</span>
                    <span className="font-bold text-slate-900 text-sm">{formatNumber(inspectingTransferRecord.quantity)} Units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Value Transferred</span>
                    <span className="font-bold text-blue-700 text-sm">{formatCurrency(inspectingTransferRecord.amtInLocCur)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Accounting & Project Allocation</h4>
                <div className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">WBS Element</span>
                    <span className="font-mono font-medium text-slate-800">{inspectingTransferRecord.wbsElement || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Special Stock Indicator</span>
                    <span className="font-mono font-bold text-slate-800">{inspectingTransferRecord.specialStock || 'RDF Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Posting Date</span>
                    <span className="font-mono text-slate-800">{inspectingTransferRecord.postingDate || inspectingTransferRecord.entryDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Stock Holding Days</span>
                    <span className="font-bold text-slate-900">
                      {calculateStockHoldingDays(inspectingTransferRecord.postingDate || inspectingTransferRecord.entryDate, inspectingTransferRecord) !== null
                        ? `${calculateStockHoldingDays(inspectingTransferRecord.postingDate || inspectingTransferRecord.entryDate, inspectingTransferRecord)} days`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
              <button
                onClick={() => setInspectingTransferRecord(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: INSPECT REGIONAL DELIVERY RECORD
          ========================================================================= */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                  <Truck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">MD Deliver to HF Detail</h3>
                  <p className="text-xs text-emerald-200 font-mono">POD: {inspectingRecord.podNumbers}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingRecord(null)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Plant / Hub</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{inspectingRecord.plant}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Sales Organization</span>
                  <span className="font-bold text-slate-900 text-sm">{inspectingRecord.salesOrgDescr}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Customer Name</span>
                  <span className="font-bold text-slate-900 text-sm">{inspectingRecord.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Delivery Date</span>
                  <span className="font-bold text-slate-900 font-mono">{inspectingRecord.deliveryDate}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Material & Quantity Information</h4>
                <div className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Material Code</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">{inspectingRecord.materialCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Material Description</span>
                    <span className="font-bold text-slate-900">{inspectingRecord.materialDescr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Quantity & Unit</span>
                    <span className="font-bold text-slate-900 text-sm">{formatNumber(inspectingRecord.quantity)} {inspectingRecord.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Net Valuation</span>
                    <span className="font-bold text-emerald-700 text-sm">{formatCurrency(inspectingRecord.netValue)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Manufacturer</span>
                    <span className="font-medium text-slate-800">{inspectingRecord.manufacturerDescr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batch Number</span>
                    <span className="font-mono font-bold text-slate-800">{inspectingRecord.batch}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Geographic & WBS Allocation</h4>
                <div className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Region / Zone / Woreda</span>
                    <span className="font-bold text-slate-900">{inspectingRecord.regionDescr} / {inspectingRecord.zoneDescr} / {inspectingRecord.woredaDescr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">WBS Element</span>
                    <span className="font-mono font-medium text-slate-800">{inspectingRecord.wbsElementDescr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Material Type</span>
                    <span className="font-medium text-slate-800">{inspectingRecord.materialTypeDescr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">POD Status</span>
                    <span className="inline-block px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">{inspectingRecord.podStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
              <button
                onClick={() => setInspectingRecord(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Admin Only */}
      {isAdmin && isUploadModalOpen && onUploadDistributionData && (
        <DistributionDataUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadDistributionData={onUploadDistributionData}
          initialRecordsCount={activeRecords.length}
        />
      )}

    </div>
  );
};
