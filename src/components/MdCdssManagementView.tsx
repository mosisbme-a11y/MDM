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

const SAMPLE_PROCUREMENT_DATA: CdssProcurementRecord[] = [
  {
    id: 'pr-001',
    tenderRef: 'ICB/EPSS/MD/2025/08',
    contractNumber: 'EPSS/CON/2026/0114',
    itemDescription: 'High-Field 1.5T Superconducting MRI System',
    materialCode: 'MAT-MRI-01',
    category: 'Advanced Diagnostic Imaging',
    procurementMethod: 'International Competitive Bidding (ICB)',
    supplierName: 'GE Healthcare International',
    procurementStage: 'In-Transit to Port',
    quantityContracted: 4,
    quantityDelivered: 1,
    unitPriceUSD: 720000,
    totalContractETB: 352800000,
    budgetSource: 'World Bank (WB)',
    fundingYear: '2025/2026',
    lcStatus: 'LC Settled',
    estimatedArrival: '2026-04-15'
  },
  {
    id: 'pr-002',
    tenderRef: 'ICB/EPSS/MD/2025/11',
    contractNumber: 'EPSS/CON/2026/0122',
    itemDescription: 'Color Doppler Ultrasound Scanner 3-Probe Integrated',
    materialCode: 'MAT-ULT-01',
    category: 'Diagnostic Imaging',
    procurementMethod: 'International Competitive Bidding (ICB)',
    supplierName: 'Mindray Bio-Medical Electronics',
    procurementStage: 'Customs Cleared',
    quantityContracted: 45,
    quantityDelivered: 38,
    unitPriceUSD: 28000,
    totalContractETB: 154350000,
    budgetSource: 'SDG Performance Fund',
    fundingYear: '2025/2026',
    lcStatus: 'LC Settled',
    estimatedArrival: '2026-03-30'
  },
  {
    id: 'pr-003',
    tenderRef: 'NCB/EPSS/MD/2025/19',
    contractNumber: 'EPSS/CON/2026/0149',
    itemDescription: 'Advanced ICU Ventilator System with Integrated Compressor',
    materialCode: 'MAT-VEN-04',
    category: 'Critical Care & ICU',
    procurementMethod: 'Direct Procurement (Framework)',
    supplierName: 'Dräger Medical Agency Ethiopia',
    procurementStage: 'Awarded / Contract Signed',
    quantityContracted: 30,
    quantityDelivered: 0,
    unitPriceUSD: 24500,
    totalContractETB: 90037500,
    budgetSource: 'Global Fund (GFATM)',
    fundingYear: '2025/2026',
    lcStatus: 'LC In Progress',
    estimatedArrival: '2026-05-20'
  },
  {
    id: 'pr-004',
    tenderRef: 'ICB/EPSS/MD/2025/24',
    contractNumber: 'EPSS/CON/2026/0177',
    itemDescription: 'Digital Mobile X-Ray 32kW High-Frequency',
    materialCode: 'MAT-XRAY-02',
    category: 'Radiology',
    procurementMethod: 'International Competitive Bidding (ICB)',
    supplierName: 'Siemens Healthineers Agent',
    procurementStage: 'PO Issued',
    quantityContracted: 22,
    quantityDelivered: 5,
    unitPriceUSD: 41000,
    totalContractETB: 110500000,
    budgetSource: 'MOH Capital Budget',
    fundingYear: '2025/2026',
    lcStatus: 'LC In Progress',
    estimatedArrival: '2026-06-10'
  },
  {
    id: 'pr-005',
    tenderRef: 'NCB/EPSS/MD/2025/30',
    contractNumber: 'EPSS/CON/2026/0192',
    itemDescription: 'Hospital Waste Autoclave Shredder Combo 150L',
    materialCode: 'MAT-AUT-04',
    category: 'Sterilization & Infection Prevention',
    procurementMethod: 'National Competitive Bidding (NCB)',
    supplierName: 'Getinge AB East Africa',
    procurementStage: 'Completed',
    quantityContracted: 18,
    quantityDelivered: 18,
    unitPriceUSD: 31000,
    totalContractETB: 68350000,
    budgetSource: 'MOH Capital Budget',
    fundingYear: '2024/2025',
    lcStatus: 'LC Settled',
    estimatedArrival: '2026-02-15'
  }
];

const SAMPLE_DEMAND_DATA: CommittedDemandRecord[] = [
  {
    id: 'dem-001',
    demandCode: 'CMD-OR-2026-001',
    region: 'Oromia',
    zone: 'East Shewa',
    facilityName: 'Adama Hospital Medical College',
    facilityLevel: 'Specialized Comprehensive',
    materialCode: 'MAT-MRI-01',
    itemDescription: 'High-Field 1.5T Superconducting MRI System',
    category: 'Advanced Diagnostic Imaging',
    committedDemandQty: 1,
    allocatedSupplyQty: 1,
    demandFulfillmentRate: 100,
    budgetApprovedETB: 88200000,
    demandPriority: 'P1 - Immediate Critical',
    submissionDate: '2025-11-10',
    epssReviewStatus: 'Committed & Approved'
  },
  {
    id: 'dem-002',
    demandCode: 'CMD-AM-2026-004',
    region: 'Amhara',
    zone: 'West Gojjam',
    facilityName: 'Felege Hiwot Comprehensive Specialized Hospital',
    facilityLevel: 'Specialized Comprehensive',
    materialCode: 'MAT-ULT-01',
    itemDescription: 'Color Doppler Ultrasound Scanner 3-Probe Integrated',
    category: 'Diagnostic Imaging',
    committedDemandQty: 8,
    allocatedSupplyQty: 6,
    demandFulfillmentRate: 75,
    budgetApprovedETB: 24700000,
    demandPriority: 'P1 - Immediate Critical',
    submissionDate: '2025-12-05',
    epssReviewStatus: 'Partially Allocated'
  },
  {
    id: 'dem-003',
    demandCode: 'CMD-AA-2026-009',
    region: 'Addis Ababa',
    zone: 'Lideta',
    facilityName: 'Tikur Anbessa Specialized Hospital (TASH)',
    facilityLevel: 'Specialized Comprehensive',
    materialCode: 'MAT-VEN-04',
    itemDescription: 'Advanced ICU Ventilator System with Integrated Compressor',
    category: 'Critical Care & ICU',
    committedDemandQty: 12,
    allocatedSupplyQty: 12,
    demandFulfillmentRate: 100,
    budgetApprovedETB: 36015000,
    demandPriority: 'P1 - Immediate Critical',
    submissionDate: '2025-11-20',
    epssReviewStatus: 'Committed & Approved'
  },
  {
    id: 'dem-004',
    demandCode: 'CMD-SI-2026-015',
    region: 'Sidama',
    zone: 'Hawassa City',
    facilityName: 'Hawassa University Comprehensive Specialized Hospital',
    facilityLevel: 'Specialized Comprehensive',
    materialCode: 'MAT-XRAY-02',
    itemDescription: 'Digital Mobile X-Ray 32kW High-Frequency',
    category: 'Radiology',
    committedDemandQty: 5,
    allocatedSupplyQty: 3,
    demandFulfillmentRate: 60,
    budgetApprovedETB: 15100000,
    demandPriority: 'P2 - High Priority',
    submissionDate: '2026-01-12',
    epssReviewStatus: 'Partially Allocated'
  },
  {
    id: 'dem-005',
    demandCode: 'CMD-TI-2026-021',
    region: 'Tigray',
    zone: 'Mekelle',
    facilityName: 'Ayder Comprehensive Specialized Hospital',
    facilityLevel: 'Specialized Comprehensive',
    materialCode: 'MAT-AUT-04',
    itemDescription: 'Hospital Waste Autoclave Shredder Combo 150L',
    category: 'Sterilization & Infection Prevention',
    committedDemandQty: 4,
    allocatedSupplyQty: 4,
    demandFulfillmentRate: 100,
    budgetApprovedETB: 15200000,
    demandPriority: 'P1 - Immediate Critical',
    submissionDate: '2025-12-18',
    epssReviewStatus: 'Committed & Approved'
  }
];

const SAMPLE_DELIVERY_DATA: CdssDeliveryRecord[] = [
  {
    id: 'del-001',
    deliveryRef: 'CDSS-DEL/2026/089',
    contractNumber: 'EPSS/CON/2026/0122',
    itemDescription: 'Color Doppler Ultrasound Scanner 3-Probe Integrated',
    materialCode: 'MAT-ULT-01',
    originHub: 'AA01 (Central Hub)',
    destinationFacility: 'Felege Hiwot Comprehensive Specialized Hospital',
    destinationRegion: 'Amhara',
    dispatchedQty: 6,
    receivedQty: 6,
    pendingTransitQty: 0,
    fulfillmentPercent: 100,
    waybillNumber: 'WB-EPSS-2026-5501',
    carrierName: 'EPSS Fleet Logistics Division',
    dispatchDate: '2026-03-05',
    actualArrivalDate: '2026-03-08',
    deliveryCondition: 'Full & Intact',
    grnNumber: 'GRN-FH-2026-049'
  },
  {
    id: 'del-002',
    deliveryRef: 'CDSS-DEL/2026/090',
    contractNumber: 'EPSS/CON/2026/0114',
    itemDescription: 'High-Field 1.5T Superconducting MRI System',
    materialCode: 'MAT-MRI-01',
    originHub: 'Djibouti Dry Port Depot',
    destinationFacility: 'Adama Hospital Medical College',
    destinationRegion: 'Oromia',
    dispatchedQty: 1,
    receivedQty: 0,
    pendingTransitQty: 1,
    fulfillmentPercent: 50,
    waybillNumber: 'WB-EPSS-2026-5510',
    carrierName: 'Ethiopian Shipping & Logistics (ESL)',
    dispatchDate: '2026-03-18',
    deliveryCondition: 'Under Verification'
  },
  {
    id: 'del-003',
    deliveryRef: 'CDSS-DEL/2026/091',
    contractNumber: 'EPSS/CON/2026/0149',
    itemDescription: 'Advanced ICU Ventilator System with Integrated Compressor',
    materialCode: 'MAT-VEN-04',
    originHub: 'AA01 (Central Hub)',
    destinationFacility: 'Tikur Anbessa Specialized Hospital (TASH)',
    destinationRegion: 'Addis Ababa',
    dispatchedQty: 12,
    receivedQty: 12,
    pendingTransitQty: 0,
    fulfillmentPercent: 100,
    waybillNumber: 'WB-EPSS-2026-5519',
    carrierName: 'EPSS Dedicated Medical Transit',
    dispatchDate: '2026-03-12',
    actualArrivalDate: '2026-03-13',
    deliveryCondition: 'Full & Intact',
    grnNumber: 'GRN-TASH-2026-118'
  },
  {
    id: 'del-004',
    deliveryRef: 'CDSS-DEL/2026/092',
    contractNumber: 'EPSS/CON/2026/0177',
    itemDescription: 'Digital Mobile X-Ray 32kW High-Frequency',
    materialCode: 'MAT-XRAY-02',
    originHub: 'HW01 (Hawassa Hub)',
    destinationFacility: 'Hawassa University Comprehensive Specialized Hospital',
    destinationRegion: 'Sidama',
    dispatchedQty: 3,
    receivedQty: 2,
    pendingTransitQty: 1,
    fulfillmentPercent: 66,
    waybillNumber: 'WB-EPSS-2026-5532',
    carrierName: 'Regional Health Transport',
    dispatchDate: '2026-03-19',
    deliveryCondition: 'Delayed in Transit'
  }
];

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
