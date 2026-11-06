import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Target,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  BadgeAlert,
  Boxes,
  Landmark,
  Layers,
  ChevronRight,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { MedicalDeviceItem, EpssSubTab } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

export interface CdssProcurementRecord {
  id: string;
  tenderRef: string;
  contractNumber: string;
  itemDescription: string;
  materialCode: string;
  category: string;
  procurementMethod: 'International Competitive Bidding (ICB)' | 'National Competitive Bidding (NCB)' | 'Direct Procurement (Framework)';
  supplierName: string;
  procurementStage: 'Tender Floating' | 'Technical Evaluation' | 'Awarded / Contract Signed' | 'LC Opened' | 'PO Issued' | 'In-Transit to Port' | 'Customs Cleared' | 'Completed';
  quantityContracted: number;
  quantityDelivered: number;
  unitPriceUSD: number;
  totalContractETB: number;
  budgetSource: 'MOH Capital Budget' | 'Global Fund (GFATM)' | 'World Bank (WB)' | 'SDG Performance Fund';
  fundingYear: string;
  lcStatus: 'LC Settled' | 'LC In Progress' | 'CAD' | 'Exempt / Grant';
  estimatedArrival: string;
}

export interface CommittedDemandRecord {
  id: string;
  demandCode: string;
  region: string;
  zone: string;
  facilityName: string;
  facilityLevel: 'Specialized Comprehensive' | 'General Hospital' | 'Primary Hospital' | 'Health Center';
  materialCode: string;
  itemDescription: string;
  category: string;
  committedDemandQty: number;
  allocatedSupplyQty: number;
  demandFulfillmentRate: number; // %
  budgetApprovedETB: number;
  demandPriority: 'P1 - Immediate Critical' | 'P2 - High Priority' | 'P3 - Standard Expansion';
  submissionDate: string;
  epssReviewStatus: 'Committed & Approved' | 'Partially Allocated' | 'Under Capacity Review' | 'Deferred to Next Cycle';
}

export interface CdssDeliveryRecord {
  id: string;
  deliveryRef: string;
  contractNumber: string;
  itemDescription: string;
  materialCode: string;
  originHub: string;
  destinationFacility: string;
  destinationRegion: string;
  dispatchedQty: number;
  receivedQty: number;
  pendingTransitQty: number;
  fulfillmentPercent: number;
  waybillNumber: string;
  carrierName: string;
  dispatchDate: string;
  actualArrivalDate?: string;
  deliveryCondition: 'Full & Intact' | 'Under Verification' | 'Delayed in Transit' | 'Partial Delivery';
  grnNumber?: string;
}

const SAMPLE_PROCUREMENT_DATA: CdssProcurementRecord[] = [];

const SAMPLE_DEMAND_DATA: CommittedDemandRecord[] = [];

const SAMPLE_DELIVERY_DATA: CdssDeliveryRecord[] = [];

interface MdCdssManagementViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (tab: EpssSubTab) => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const MdCdssManagementView: React.FC<MdCdssManagementViewProps> = ({
  currentSubTab = 'cdss-management',
  onSelectSubTab,
  items = [],
  onSelectItem
}) => {
  const [procurementRecords] = useState<CdssProcurementRecord[]>(SAMPLE_PROCUREMENT_DATA);
  const [demandRecords] = useState<CommittedDemandRecord[]>(SAMPLE_DEMAND_DATA);
  const [deliveryRecords] = useState<CdssDeliveryRecord[]>(SAMPLE_DELIVERY_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const activeMode: 'procurement' | 'demand' | 'delivery' = useMemo(() => {
    if (currentSubTab === 'cdss-procurement-status') return 'procurement';
    if (currentSubTab === 'cdss-committed-demand') return 'demand';
    if (currentSubTab === 'cdss-delivery-status') return 'delivery';
    return 'procurement';
  }, [currentSubTab]);

  // Aggregated KPIs
  const totalProcurementValETB = useMemo(
    () => procurementRecords.reduce((acc, r) => acc + r.totalContractETB, 0),
    [procurementRecords]
  );

  const totalDemandUnits = useMemo(
    () => demandRecords.reduce((acc, r) => acc + r.committedDemandQty, 0),
    [demandRecords]
  );

  const totalAllocatedUnits = useMemo(
    () => demandRecords.reduce((acc, r) => acc + r.allocatedSupplyQty, 0),
    [demandRecords]
  );

  const avgDemandFulfillment = useMemo(
    () => Math.round((totalAllocatedUnits / (totalDemandUnits || 1)) * 100),
    [totalAllocatedUnits, totalDemandUnits]
  );

  const totalDispatched = useMemo(
    () => deliveryRecords.reduce((acc, r) => acc + r.dispatchedQty, 0),
    [deliveryRecords]
  );

  const totalDelivered = useMemo(
    () => deliveryRecords.reduce((acc, r) => acc + r.receivedQty, 0),
    [deliveryRecords]
  );

  // Filtered lists based on search
  const filteredProcurement = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return procurementRecords.filter(
      r =>
        r.tenderRef.toLowerCase().includes(q) ||
        r.contractNumber.toLowerCase().includes(q) ||
        r.itemDescription.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        r.procurementStage.toLowerCase().includes(q)
    );
  }, [procurementRecords, searchQuery]);

  const filteredDemand = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return demandRecords.filter(
      r =>
        r.demandCode.toLowerCase().includes(q) ||
        r.facilityName.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.itemDescription.toLowerCase().includes(q)
    );
  }, [demandRecords, searchQuery]);

  const filteredDelivery = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return deliveryRecords.filter(
      r =>
        r.deliveryRef.toLowerCase().includes(q) ||
        r.destinationFacility.toLowerCase().includes(q) ||
        r.itemDescription.toLowerCase().includes(q) ||
        r.waybillNumber.toLowerCase().includes(q)
    );
  }, [deliveryRecords, searchQuery]);

  // Chart data
  const procurementStageChartData = useMemo(() => {
    return [
      { stage: 'Tender Floating', count: procurementRecords.filter(r => r.procurementStage === 'Tender Floating').length, fill: '#3b82f6' },
      { stage: 'Awarded / Contract', count: procurementRecords.filter(r => r.procurementStage === 'Awarded / Contract Signed').length, fill: '#6366f1' },
      { stage: 'PO & LC', count: procurementRecords.filter(r => r.procurementStage === 'PO Issued' || r.procurementStage === 'LC Opened').length, fill: '#8b5cf6' },
      { stage: 'Transit & Customs', count: procurementRecords.filter(r => r.procurementStage === 'In-Transit to Port' || r.procurementStage === 'Customs Cleared').length, fill: '#f59e0b' },
      { stage: 'Completed', count: procurementRecords.filter(r => r.procurementStage === 'Completed').length, fill: '#10b981' }
    ];
  }, [procurementRecords]);

  const handleExportCSV = () => {
    if (activeMode === 'procurement') {
      const data = filteredProcurement.map((r, idx) => ({
        '#': idx + 1,
        'Tender Ref': r.tenderRef,
        'Contract #': r.contractNumber,
        'Description': r.itemDescription,
        'Supplier': r.supplierName,
        'Stage': r.procurementStage,
        'Contracted Units': r.quantityContracted,
        'Delivered Units': r.quantityDelivered,
        'Total ETB': r.totalContractETB,
        'Funding Source': r.budgetSource,
        'Estimated Arrival': r.estimatedArrival
      }));
      downloadCSV(`EPSS_CDSS_Procurement_${new Date().toISOString().split('T')[0]}.csv`, data);
    } else if (activeMode === 'demand') {
      const data = filteredDemand.map((r, idx) => ({
        '#': idx + 1,
        'Demand Code': r.demandCode,
        'Region': r.region,
        'Health Facility': r.facilityName,
        'Level': r.facilityLevel,
        'Device': r.itemDescription,
        'Committed Demand': r.committedDemandQty,
        'Allocated Supply': r.allocatedSupplyQty,
        'Fulfillment Rate': `${r.demandFulfillmentRate}%`,
        'Budget Approved (ETB)': r.budgetApprovedETB,
        'Status': r.epssReviewStatus
      }));
      downloadCSV(`EPSS_CDSS_Committed_Demand_${new Date().toISOString().split('T')[0]}.csv`, data);
    } else {
      const data = filteredDelivery.map((r, idx) => ({
        '#': idx + 1,
        'Delivery Ref': r.deliveryRef,
        'Contract #': r.contractNumber,
        'Description': r.itemDescription,
        'Origin Hub': r.originHub,
        'Destination': r.destinationFacility,
        'Region': r.destinationRegion,
        'Dispatched': r.dispatchedQty,
        'Received': r.receivedQty,
        'Waybill': r.waybillNumber,
        'Condition': r.deliveryCondition
      }));
      downloadCSV(`EPSS_CDSS_Delivery_Status_${new Date().toISOString().split('T')[0]}.csv`, data);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3 Sub-View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-md">
        <button
          onClick={() => onSelectSubTab?.('cdss-procurement-status')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'procurement'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-amber-300" />
          <span>CDSS Procurement Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-amber-300">
            {procurementRecords.length} Tenders
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('cdss-committed-demand')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'demand'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Target className="w-4 h-4 text-indigo-300" />
          <span>Committed Demand Management</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-indigo-300">
            {avgDemandFulfillment}% Met
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('cdss-delivery-status')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'delivery'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4 text-teal-300" />
          <span>CDSS Delivery Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-teal-300">
            {totalDelivered} / {totalDispatched} Delivered
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Total CDSS Procurement Value</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 font-mono">{formatCurrency(totalProcurementValETB)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{procurementRecords.length} Active Contracts</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <CircleDollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Committed National Demand</div>
            <div className="text-xl font-black text-indigo-400 mt-0.5 font-mono">{totalDemandUnits} Units</div>
            <div className="text-[10px] text-indigo-400/80 mt-0.5">Allocated: {totalAllocatedUnits} Units</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
            <Target className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Demand Fulfillment Rate</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5 font-mono">{avgDemandFulfillment}%</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Target: 85% SLA</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">CDSS Dispatched & Arrived</div>
            <div className="text-xl font-black text-teal-400 mt-0.5 font-mono">{totalDelivered} Units</div>
            <div className="text-[10px] text-teal-400/80 mt-0.5">In-Transit: {totalDispatched - totalDelivered} Units</div>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-950/60 border border-teal-800/40 text-teal-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Chart for CDSS Procurement Pipeline */}
      {activeMode === 'procurement' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Procurement Pipeline Stage Distribution
              </h3>
              <p className="text-[11px] text-slate-400">Live progression of international and local medical equipment tenders</p>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
              Procurement Lifecycle
            </span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={procurementStageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="stage" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                />
                <Bar dataKey="count" name="Active Tenders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeMode === 'procurement'
                ? 'Search tender, contract, supplier, item...'
                : activeMode === 'demand'
                ? 'Search demand code, facility, region...'
                : 'Search delivery ref, facility, waybill...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Showing {
            activeMode === 'procurement'
              ? filteredProcurement.length
              : activeMode === 'demand'
              ? filteredDemand.length
              : filteredDelivery.length
          } Records
        </div>
      </div>

      {/* Mode 1: CDSS Procurement Status Table */}
      {activeMode === 'procurement' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Tender Ref & Contract</th>
                  <th className="py-3 px-4">Medical Device / Category</th>
                  <th className="py-3 px-4">Supplier & Method</th>
                  <th className="py-3 px-4 text-center">Procurement Stage</th>
                  <th className="py-3 px-4 text-center">Units (Delivered / Contract)</th>
                  <th className="py-3 px-4 text-right">Contract Value (ETB)</th>
                  <th className="py-3 px-4">Funding Source</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredProcurement.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No CDSS procurement records match current search.
                    </td>
                  </tr>
                ) : (
                  filteredProcurement.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-amber-400">{r.tenderRef}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.contractNumber}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-white">{r.itemDescription}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.materialCode} • {r.category}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{r.supplierName}</div>
                        <div className="text-[10px] text-slate-400">{r.procurementMethod}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.procurementStage === 'Completed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : r.procurementStage === 'In-Transit to Port' || r.procurementStage === 'Customs Cleared'
                            ? 'bg-teal-950 text-teal-300 border border-teal-800'
                            : r.procurementStage === 'Awarded / Contract Signed' || r.procurementStage === 'PO Issued'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {r.procurementStage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-emerald-400">{r.quantityDelivered}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-white">{r.quantityContracted}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatCurrency(r.totalContractETB)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{r.budgetSource}</div>
                        <div className="text-[10px] text-slate-400 font-mono">LC: {r.lcStatus}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold transition cursor-pointer border border-slate-700 shadow-xs"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Committed Demand Management Table */}
      {activeMode === 'demand' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Demand Code & Priority</th>
                  <th className="py-3 px-4">Health Facility & Region</th>
                  <th className="py-3 px-4">Requested Medical Device</th>
                  <th className="py-3 px-4 text-center">Demand vs Allocated</th>
                  <th className="py-3 px-4 text-center">Fulfillment Rate</th>
                  <th className="py-3 px-4 text-right">Approved Budget (ETB)</th>
                  <th className="py-3 px-4 text-center">EPSS Review Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredDemand.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No committed demand records match search.
                    </td>
                  </tr>
                ) : (
                  filteredDemand.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-indigo-400">{d.demandCode}</div>
                        <span className="text-[10px] text-amber-300 font-semibold">{d.demandPriority}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{d.facilityName}</div>
                        <div className="text-[10px] text-slate-400">{d.region} • {d.facilityLevel}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-200">{d.itemDescription}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.materialCode}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-white">{d.committedDemandQty} Units</span>
                        <span className="text-slate-500"> → </span>
                        <span className="font-bold text-emerald-400">{d.allocatedSupplyQty} Allocated</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-cyan-400">{d.demandFulfillmentRate}%</span>
                        <div className="w-12 bg-slate-950 rounded-full h-1.5 mx-auto mt-1 overflow-hidden border border-slate-700">
                          <div
                            className={`h-full rounded-full ${
                              d.demandFulfillmentRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${d.demandFulfillmentRate}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(d.budgetApprovedETB)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          d.epssReviewStatus === 'Committed & Approved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {d.epssReviewStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(d)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold transition cursor-pointer border border-slate-700 shadow-xs"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 3: CDSS Delivery Status Table */}
      {activeMode === 'delivery' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Delivery Ref & Waybill</th>
                  <th className="py-3 px-4">Equipment & Contract</th>
                  <th className="py-3 px-4">Origin Hub → Destination Facility</th>
                  <th className="py-3 px-4 text-center">Dispatched vs Received</th>
                  <th className="py-3 px-4 text-center">Delivery Fulfillment</th>
                  <th className="py-3 px-4">Carrier & Transit Date</th>
                  <th className="py-3 px-4 text-center">Condition Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredDelivery.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No delivery status records match search.
                    </td>
                  </tr>
                ) : (
                  filteredDelivery.map((del) => (
                    <tr key={del.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-teal-400">{del.deliveryRef}</div>
                        <div className="text-[10px] text-slate-400 font-mono">WB: {del.waybillNumber}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-white">{del.itemDescription}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Contract: {del.contractNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{del.destinationFacility}</div>
                        <div className="text-[10px] text-slate-400">From {del.originHub} • {del.destinationRegion}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-emerald-400">{del.receivedQty}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-white">{del.dispatchedQty} Units</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-teal-400">{del.fulfillmentPercent}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{del.carrierName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Dispatched: {del.dispatchDate}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          del.deliveryCondition === 'Full & Intact'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : del.deliveryCondition === 'Under Verification'
                            ? 'bg-teal-950 text-teal-300 border border-teal-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {del.deliveryCondition}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(del)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold transition cursor-pointer border border-slate-700 shadow-xs"
                        >
                          Waybill
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Dossier Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                CDSS Record Dossier: {selectedRecord.tenderRef || selectedRecord.demandCode || selectedRecord.deliveryRef}
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">ITEM DESCRIPTION</span>
                  <span className="font-semibold text-white">{selectedRecord.itemDescription}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">MATERIAL CODE</span>
                  <span className="font-mono text-amber-400">{selectedRecord.materialCode}</span>
                </div>
                {selectedRecord.contractNumber && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">CONTRACT NUMBER</span>
                    <span className="font-mono text-slate-300">{selectedRecord.contractNumber}</span>
                  </div>
                )}
                {selectedRecord.supplierName && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">SUPPLIER</span>
                    <span className="text-slate-200">{selectedRecord.supplierName}</span>
                  </div>
                )}
                {selectedRecord.facilityName && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">HEALTH FACILITY</span>
                    <span className="text-slate-200 font-semibold">{selectedRecord.facilityName}</span>
                  </div>
                )}
                {selectedRecord.totalContractETB && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">TOTAL CONTRACT ETB</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(selectedRecord.totalContractETB)}</span>
                  </div>
                )}
                {selectedRecord.budgetApprovedETB && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">APPROVED BUDGET</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(selectedRecord.budgetApprovedETB)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
