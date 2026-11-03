import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList
} from 'recharts';
import {
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  PackageCheck,
  Wrench,
  HelpCircle,
  Info,
  Layers3,
  Boxes,
  FileText
} from 'lucide-react';
import { InventorySummary, MedicalDeviceItem, ReceivingDataRecord, MaterialMasterRecord, MultipleStockRecord } from '../types';
import { formatNumber } from '../utils/formatters';
import { ReceivingDataAnalyticsSection } from './ReceivingDataAnalyticsSection';
import { DashboardSourceDataModal, DashboardSourceDataMode } from './DashboardSourceDataModal';
import { DataQualityWidget } from './DataQualityWidget';

interface DashboardAnalyticsTabProps {
  summary?: InventorySummary;
  items: MedicalDeviceItem[];
  materialMasterItems: MaterialMasterRecord[];
  multipleStockItems: MultipleStockRecord[];
  receivingRecords?: ReceivingDataRecord[];
  isVerticalLayout?: boolean;
  showAllPrograms?: boolean;
  setShowAllPrograms?: (show: boolean) => void;
  regionDistribution?: any[];
  trendMetricMode?: any;
  setTrendMetricMode?: any;
  trendData?: any[];
  COLORS?: string[];
  topManufacturers?: any[];
  pieData?: any[];
  PIE_COLORS?: string[];
  sohStats?: any;
  nonMovingStats?: any;
  warehouseReceivedStats?: any;
  onNavigateTab: (tab: string) => void;
  onFilterStatus: (status: string) => void;
  onOpenSohModal?: () => void;
  onOpenNonMovingModal?: () => void;
  onOpenWarehouseReceivedModal?: () => void;
  onOpenInstallationModal: (status?: string) => void;
  plantFilter: string | string[];
  setPlantFilter: (val: string | string[]) => void;
  groupFilter: string;
  setGroupFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

interface GraphicDataItem {
  name: string;
  shortName?: string;
  fullName?: string;
  units: number;
  lineItems: number;
  color: string;
  statusKey?: string;
  valuation?: number;
}

// Custom Recharts Tooltip integrated directly on graph hover clearly identifying Quantity vs Line Items
const CustomStatusTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: GraphicDataItem = payload[0].payload;
    const name = data.fullName || data.name || label || '';
    const units = Number(data.units ?? 0);
    const lineItems = Number(data.lineItems ?? 0);
    const valuation = data.valuation;
    const isOneToOne = units === lineItems && units > 0;
    const isBulk = units > lineItems && lineItems > 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-xs text-white px-4 py-3 rounded-xl shadow-2xl text-xs space-y-2 border border-slate-700/80 min-w-[240px]">
        <div className="font-bold text-slate-100 border-b border-slate-700/60 pb-1.5 flex items-center justify-between gap-2">
          <span>{name}</span>
        </div>
        
        {/* Metric 1: Physical Quantity / Units */}
        <div className="flex items-center justify-between gap-4 text-emerald-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300">Quantity (Physical Units):</span>
          </div>
          <span className="font-mono font-bold">{formatNumber(units)} physical units</span>
        </div>

        {/* Metric 2: Line of Items */}
        <div className="flex items-center justify-between gap-4 text-cyan-300 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-slate-300">Line of Item (Distinct SKUs):</span>
          </div>
          <span className="font-mono font-bold">{formatNumber(lineItems)} catalog lines</span>
        </div>

        {/* Clear Identification Note */}
        <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
          {isOneToOne ? (
            <div className="text-amber-300/90 flex items-center gap-1">
              <span>ℹ️ 1:1 Serialized Asset: Each individual machine has its own row (1 Unit = 1 Line Item).</span>
            </div>
          ) : isBulk ? (
            <div className="text-cyan-300/90 flex items-center gap-1">
              <span>ℹ️ Multi-unit batch: Average {(units / lineItems).toFixed(1)} units grouped per line item.</span>
            </div>
          ) : null}
          {valuation ? (
            <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/60">
              <span>Valuation:</span>
              <span className="font-mono font-bold text-amber-300">ETB {formatNumber(Number(valuation))}</span>
            </div>
          ) : null}
          <div className="text-slate-500 italic pt-0.5">
            💡 Double-click to inspect underlying source records
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Reusable label renderer that clearly identifies both Quantity (Units) and Line of Items (SKUs)
const renderIntegratedBarLabel = (dataList: GraphicDataItem[]) => (props: any) => {
  const { x, y, width, index } = props;
  const item = dataList[index];
  if (!item) return null;
  return (
    <g transform={`translate(${x + width / 2},${y - 6})`}>
      <text
        x={0}
        y={-10}
        fill="#0f172a"
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
      >
        Qty: {formatNumber(item.units)} Units
      </text>
      <text
        x={0}
        y={2}
        fill="#0284c7"
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
      >
        Lines: {formatNumber(item.lineItems)} SKUs
      </text>
    </g>
  );
};

export const DashboardAnalyticsTab: React.FC<DashboardAnalyticsTabProps> = ({
  items,
  materialMasterItems,
  multipleStockItems,
  receivingRecords = [],
  sohStats,
  warehouseReceivedStats,
  onNavigateTab,
  onOpenSohModal,
  onOpenWarehouseReceivedModal,
  onOpenInstallationModal,
  plantFilter,
  setPlantFilter,
  groupFilter,
  setGroupFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}) => {
  const [showDefinitionDetails, setShowDefinitionDetails] = useState(false);

  const plants = useMemo(() => Array.from(new Set(items.map(i => i.plant))), [items]);
  const groups = useMemo(() => Array.from(new Set(items.map(i => i.materialGroupName))), [items]);

  const totalSystemUnits = useMemo(() => {
    return items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
  }, [items]);

  // 1. Procurement Status Data (Both Units and Line of Items integrated on graphic)
  const procurementBarData: GraphicDataItem[] = useMemo(() => {
    let criticalUnits = 0, criticalLines = 0;
    let reorderUnits = 0, reorderLines = 0;
    let adequateUnits = 0, adequateLines = 0;

    items.forEach(i => {
      const q = Number(i.qty) || 0;
      if (q <= 5) {
        criticalLines++;
        criticalUnits += q;
      } else if (q <= 15) {
        reorderLines++;
        reorderUnits += q;
      } else {
        adequateLines++;
        adequateUnits += q;
      }
    });

    return [
      {
        name: 'Critical (≤5)',
        shortName: 'Critical (≤5)',
        fullName: 'Critical Stock (≤5 Units Threshold)',
        units: criticalUnits,
        lineItems: criticalLines,
        color: '#ef4444'
      },
      {
        name: 'Reorder (6-15)',
        shortName: 'Reorder (6-15)',
        fullName: 'Reorder Needed (6-15 Units Threshold)',
        units: reorderUnits,
        lineItems: reorderLines,
        color: '#f59e0b'
      },
      {
        name: 'Adequate (>15)',
        shortName: 'Adequate (>15)',
        fullName: 'Adequate Stock (>15 Units Threshold)',
        units: adequateUnits,
        lineItems: adequateLines,
        color: '#10b981'
      }
    ];
  }, [items]);

  // 2. Installation Status Data (Both Units and Line of Items integrated on graphic)
  const installationBarData: GraphicDataItem[] = useMemo(() => {
    let installedUnits = 0, installedLines = 0;
    let commUnits = 0, commLines = 0;
    let pendingUnits = 0, pendingLines = 0;
    let assessUnits = 0, assessLines = 0;

    items.forEach(item => {
      const status = item.installationStatus || 'Installed';
      const u = Number(item.qty) || 1;
      if (status === 'Installed') {
        installedUnits += u;
        installedLines++;
      } else if (status === 'Under Commissioning') {
        commUnits += u;
        commLines++;
      } else if (status === 'Pending Installation') {
        pendingUnits += u;
        pendingLines++;
      } else if (status === 'Site Assessment') {
        assessUnits += u;
        assessLines++;
      } else {
        installedUnits += u;
        installedLines++;
      }
    });

    return [
      {
        name: 'Installed',
        fullName: 'Installed & Functional',
        statusKey: 'Installed',
        units: installedUnits,
        lineItems: installedLines,
        color: '#10b981'
      },
      {
        name: 'Commissioning',
        fullName: 'Under Commissioning',
        statusKey: 'Under Commissioning',
        units: commUnits,
        lineItems: commLines,
        color: '#3b82f6'
      },
      {
        name: 'Pending Inst.',
        fullName: 'Pending Installation',
        statusKey: 'Pending Installation',
        units: pendingUnits,
        lineItems: pendingLines,
        color: '#f59e0b'
      },
      {
        name: 'Assessment',
        fullName: 'Site Readiness Assessment',
        statusKey: 'Site Assessment',
        units: assessUnits,
        lineItems: assessLines,
        color: '#8b5cf6'
      }
    ];
  }, [items]);

  // 3. DSP Delivery Status Data (Both Units and Line of Items integrated on graphic)
  const dspDeliveryPieData: GraphicDataItem[] = useMemo(() => {
    const statusMap: Record<string, { units: number; lineItems: number }> = {};
    items.forEach(i => {
      const st = i.deliveryStatus || 'Processing';
      if (!statusMap[st]) {
        statusMap[st] = { units: 0, lineItems: 0 };
      }
      statusMap[st].units += Number(i.qty) || 1;
      statusMap[st].lineItems += 1;
    });

    const colors = ['#0891b2', '#2563eb', '#7c3aed', '#db2777', '#16a34a', '#ea580c'];
    return Object.entries(statusMap).map(([name, stat], idx) => ({
      name,
      fullName: name,
      units: stat.units,
      lineItems: stat.lineItems,
      color: colors[idx % colors.length]
    }));
  }, [items]);

  // 5. Total Item Received Data (Both Units and Line of Items integrated on graphic)
  const receivedBarData: GraphicDataItem[] = useMemo(() => {
    // If receivingRecords is available, compute intake directly from SAP Receiving Data
    if (receivingRecords && receivingRecords.length > 0) {
      const parseDate = (dStr?: string): Date | null => {
        if (!dStr) return null;
        if (dStr.includes('.')) {
          const parts = dStr.split('.');
          if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            if (!isNaN(d.getTime())) return d;
          }
        }
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const now = new Date();
      let maxRecordDate = new Date(0);
      receivingRecords.forEach(r => {
        const d = parseDate(r.entryDate || r.documentDate);
        if (d && d > maxRecordDate) maxRecordDate = d;
      });

      // Anchor to latest record date if historical upload, else current date
      const diffDays = Math.abs((now.getTime() - maxRecordDate.getTime()) / (1000 * 60 * 60 * 24));
      const refDate = (maxRecordDate.getTime() > 0 && diffDays > 90) ? maxRecordDate : now;

      const d7 = new Date(refDate); d7.setDate(refDate.getDate() - 7);
      const d30 = new Date(refDate); d30.setDate(refDate.getDate() - 30);
      const d90 = new Date(refDate); d90.setDate(refDate.getDate() - 90);

      let u7 = 0, l7 = 0, v7 = 0;
      let u30 = 0, l30 = 0, v30 = 0;
      let u90 = 0, l90 = 0, v90 = 0;
      let uTotal = 0, lTotal = 0, vTotal = 0;

      receivingRecords.forEach(rec => {
        const u = Number(rec.quantity) || Number(rec.qtyInUnitOfEntry) || 0;
        const v = Number(rec.amtInLocCur) || 0;
        uTotal += u;
        lTotal += 1;
        vTotal += v;

        const d = parseDate(rec.entryDate || rec.documentDate);
        if (d) {
          if (d >= d7) {
            u7 += u; l7 += 1; v7 += v;
            u30 += u; l30 += 1; v30 += v;
            u90 += u; l90 += 1; v90 += v;
          } else if (d >= d30) {
            u30 += u; l30 += 1; v30 += v;
            u90 += u; l90 += 1; v90 += v;
          } else if (d >= d90) {
            u90 += u; l90 += 1; v90 += v;
          }
        }
      });

      return [
        { name: 'Last 7 Days', fullName: 'Warehouse Intake: Last 7 Days (Receiving Ledger)', units: u7, lineItems: l7, color: '#06b6d4', valuation: v7 },
        { name: 'Last 30 Days', fullName: 'Warehouse Intake: Last 30 Days (Receiving Ledger)', units: u30, lineItems: l30, color: '#3b82f6', valuation: v30 },
        { name: 'Last 90 Days', fullName: 'Warehouse Intake: Last 90 Days (Receiving Ledger)', units: u90, lineItems: l90, color: '#6366f1', valuation: v90 },
        { name: 'Cumulative', fullName: 'Total Cumulative Received Intake (All GRNs)', units: uTotal, lineItems: lTotal, color: '#8b5cf6', valuation: vTotal }
      ];
    }

    const deliveredItems = items.filter(i => i.deliveryStatus === 'Delivered & Dispatched');
    const now = new Date();
    const d7 = new Date(); d7.setDate(now.getDate() - 7);
    const d30 = new Date(); d30.setDate(now.getDate() - 30);
    const d90 = new Date(); d90.setDate(now.getDate() - 90);

    let u7 = 0, l7 = 0;
    let u30 = 0, l30 = 0;
    let u90 = 0, l90 = 0;
    let uTotal = 0, lTotal = 0;

    deliveredItems.forEach((item) => {
      const u = Number(item.qty) || 0;
      uTotal += u;
      lTotal += 1;

      const dateStr = item.receivingDate || item.docDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          if (d >= d7) {
            u7 += u; l7 += 1;
            u30 += u; l30 += 1;
            u90 += u; l90 += 1;
          } else if (d >= d30) {
            u30 += u; l30 += 1;
            u90 += u; l90 += 1;
          } else if (d >= d90) {
            u90 += u; l90 += 1;
          }
        }
      }
    });

    return [
      { name: 'Last 7 Days', fullName: 'Warehouse Intake: Last 7 Days', units: u7, lineItems: l7, color: '#06b6d4' },
      { name: 'Last 30 Days', fullName: 'Warehouse Intake: Last 30 Days', units: u30, lineItems: l30, color: '#3b82f6' },
      { name: 'Last 90 Days', fullName: 'Warehouse Intake: Last 90 Days', units: u90, lineItems: l90, color: '#6366f1' },
      { name: 'Cumulative', fullName: 'Total Cumulative Received Intake', units: uTotal, lineItems: lTotal, color: '#8b5cf6' }
    ];
  }, [items, warehouseReceivedStats, receivingRecords]);

  // Source Data Modal State
  const [sourceDataModal, setSourceDataModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    badge?: string;
    items?: MedicalDeviceItem[];
    receivingRecords?: ReceivingDataRecord[];
    initialStreamFilter?: 'all' | 'RDF' | 'HP';
    initialStatusFilter?: string;
    initialPlantFilter?: string;
    mode: DashboardSourceDataMode;
  }>({
    isOpen: false,
    title: '',
    mode: 'medical-device'
  });

  const handleOpenProcurementSourceData = (bucket?: string) => {
    let filtered = items;
    let subtitleText = 'Master inventory equipment items categorized by procurement stock thresholds.';
    let titleText = 'Source Data: Procurement Stock Level Inventory';

    if (bucket === 'Critical Under-stock (<5 Units)') {
      filtered = items.filter(i => (Number(i.qty) || 0) < 5 && (Number(i.qty) || 0) > 0);
      titleText = 'Source Data: Critical Under-Stock (< 5 Units)';
      subtitleText = 'Items critically below emergency minimum stock thresholds requiring urgent reorder.';
    } else if (bucket === 'Reorder Needed (<20 Units)') {
      filtered = items.filter(i => (Number(i.qty) || 0) >= 5 && (Number(i.qty) || 0) < 20);
      titleText = 'Source Data: Reorder Needed (< 20 Units)';
      subtitleText = 'Items approaching safety stock limit requiring standard procurement replenishment.';
    } else if (bucket === 'Healthy Stock Level (>20 Units)') {
      filtered = items.filter(i => (Number(i.qty) || 0) >= 20);
      titleText = 'Source Data: Healthy Stock Level (> 20 Units)';
      subtitleText = 'Items with sufficient operational inventory ready for regional distribution.';
    } else if (bucket === 'Zero Stock (Depleted)') {
      filtered = items.filter(i => (Number(i.qty) || 0) === 0);
      titleText = 'Source Data: Zero Stock (Depleted Inventory)';
      subtitleText = 'Depleted line items with 0 physical units in warehouse storage.';
    }

    setSourceDataModal({
      isOpen: true,
      title: titleText,
      subtitle: subtitleText,
      badge: 'Procurement Source Data',
      mode: 'medical-device',
      items: filtered
    });
  };

  const handleOpenInstallationSourceData = (statusKey?: string) => {
    let filtered = items;
    let titleText = 'Source Data: Installation & Commissioning Inventory';
    let subtitleText = 'Medical equipment records categorized by commissioning stage.';

    if (statusKey && statusKey !== 'all') {
      filtered = items.filter(i => (i.installationStatus || 'Installed') === statusKey);
      titleText = `Source Data: Installation Stage — ${statusKey}`;
      subtitleText = `Medical equipment currently classified under '${statusKey}'.`;
    }

    setSourceDataModal({
      isOpen: true,
      title: titleText,
      subtitle: subtitleText,
      badge: 'Installation Source Data',
      mode: 'medical-device',
      items: filtered,
      initialStatusFilter: statusKey && statusKey !== 'all' ? statusKey : 'all'
    });
  };

  const handleOpenDeliverySourceData = (deliveryStatus?: string) => {
    let filtered = items;
    let titleText = 'Source Data: DSP Delivery Pipeline Records';
    let subtitleText = 'Medical device consignment line items across the delivery supply chain.';

    if (deliveryStatus && deliveryStatus !== 'all') {
      filtered = items.filter(i => (i.deliveryStatus || 'Delivered & Dispatched') === deliveryStatus);
      titleText = `Source Data: Delivery Status — ${deliveryStatus}`;
      subtitleText = `Consignment items currently tracked under '${deliveryStatus}'.`;
    }

    setSourceDataModal({
      isOpen: true,
      title: titleText,
      subtitle: subtitleText,
      badge: 'Delivery Pipeline Source Data',
      mode: 'medical-device',
      items: filtered,
      initialStatusFilter: deliveryStatus && deliveryStatus !== 'all' ? deliveryStatus : 'all'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
      <DataQualityWidget materialMasterItems={materialMasterItems} multipleStockItems={multipleStockItems} />
      <div id="dashboard-analytics-charts-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Procurement Status Graphic (Units & Line of Items Integrated Directly on Graphic) */}
        <div 
          onDoubleClick={() => handleOpenProcurementSourceData()}
          title="Double-click graph to view underlying source data"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Procurement Status</h3>
                <p className="text-[11px] text-slate-500">Units & Line of Items by critical reorder thresholds (Double-click to view source records)</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigateTab('alerts'); }}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View Alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={procurementBarData}
                margin={{ top: 30, right: 10, left: -20, bottom: 5 }}
                onDoubleClick={() => handleOpenProcurementSourceData()}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomStatusTooltip />} />
                <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                  {procurementBarData.map((entry, index) => (
                    <Cell
                      key={`cell-proc-${index}`}
                      fill={entry.color}
                      className="cursor-pointer hover:opacity-85"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenProcurementSourceData(entry.name);
                      }}
                    />
                  ))}
                  <LabelList content={renderIntegratedBarLabel(procurementBarData)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Installation Status Graphic (Units & Line of Items Integrated Directly on Graphic) */}
        <div 
          onDoubleClick={() => handleOpenInstallationSourceData('all')}
          title="Double-click graph to view underlying source data"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 cursor-pointer hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Installation Status</h3>
                <p className="text-[11px] text-slate-500">Units & Line of Items by commissioning stage (Double-click to view source records)</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenInstallationModal('all'); }}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Audit Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={installationBarData}
                margin={{ top: 30, right: 10, left: -20, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    onOpenInstallationModal(e.activePayload[0].payload.statusKey);
                  }
                }}
                onDoubleClick={() => handleOpenInstallationSourceData('all')}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomStatusTooltip />} />
                <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                  {installationBarData.map((entry, index) => (
                    <Cell
                      key={`cell-inst-${index}`}
                      fill={entry.color}
                      className="cursor-pointer hover:opacity-85"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenInstallationSourceData(entry.statusKey);
                      }}
                    />
                  ))}
                  <LabelList content={renderIntegratedBarLabel(installationBarData)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. DSP Delivery Status Graphic (Units & Line of Items Integrated Directly on Graphic) */}
        <div 
          onDoubleClick={() => handleOpenDeliverySourceData('all')}
          title="Double-click graph to view underlying source data"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 cursor-pointer hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">DSP Delivery Status</h3>
                <p className="text-[11px] text-slate-500">Units & Line of Items distribution across delivery pipeline (Double-click to view source records)</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigateTab('agreements'); }}
              className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View Agreements</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[280px] w-full" onDoubleClick={() => handleOpenDeliverySourceData('all')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dspDeliveryPieData}
                  dataKey="units"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {dspDeliveryPieData.map((entry, index) => (
                    <Cell
                      key={`cell-dsp-${index}`}
                      fill={entry.color}
                      className="cursor-pointer hover:opacity-80"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeliverySourceData(entry.name);
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomStatusTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={42}
                  formatter={(val) => {
                    const pData = dspDeliveryPieData.find(d => d.name === val);
                    return (
                      <span className="text-[11px] text-slate-700 font-medium">
                        {val}: <strong className="text-slate-900">Qty: {formatNumber(pData?.units || 0)} Units</strong>{' '}
                        <span className="text-cyan-700 font-semibold">(Lines: {formatNumber(pData?.lineItems || 0)} SKUs)</span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Receiving Data Analytics: Time Period, Program Type (RDF vs HP) & Plant with Bar Graph & Pie Chart */}
        <div className="lg:col-span-2">
          <ReceivingDataAnalyticsSection
            receivingRecords={receivingRecords}
            items={items}
            onNavigateTab={onNavigateTab}
            isDashboardEmbedded={true}
          />
        </div>
      </div>

      {/* Source Data Inspection Modal */}
      <DashboardSourceDataModal
        isOpen={sourceDataModal.isOpen}
        onClose={() => setSourceDataModal(prev => ({ ...prev, isOpen: false }))}
        title={sourceDataModal.title}
        subtitle={sourceDataModal.subtitle}
        badge={sourceDataModal.badge}
        mode={sourceDataModal.mode}
        items={sourceDataModal.items}
        receivingRecords={sourceDataModal.receivingRecords}
        initialStreamFilter={sourceDataModal.initialStreamFilter}
        initialStatusFilter={sourceDataModal.initialStatusFilter}
        initialPlantFilter={sourceDataModal.initialPlantFilter}
      />
    </div>
  );
};


export default function DashboardAnalyticsTabWrapper(props: DashboardAnalyticsTabProps) {
  return (
    <>
      <DashboardAnalyticsTab {...props} />
    </>
  );
}

