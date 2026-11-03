import React, { useState, useMemo } from 'react';
import {
  Building2,
  Inbox,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Search,
  Filter,
  ArrowRight,
  Warehouse,
  Hospital,
  FileSpreadsheet,
  ChevronRight,
  PackageCheck,
  FileCheck,
  ShieldCheck,
  Layers,
  MapPin,
  RefreshCw,
  Eye,
  Check,
  Sparkles
} from 'lucide-react';
import { MedicalDeviceItem, EpssSubTab } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

export interface PlantDspRecord {
  id: string;
  dspOrderNumber: string;
  hoLetterRef: string;
  plantCode: string;
  plantName: string;
  region: string;
  deviceCategory: string;
  description: string;
  materialCode: string;
  allocatedQty: number;
  receivedQty: number;
  dispatchedQty: number;
  destinationFacility: string;
  receivingDspStatus: 'Pending HO Arrival' | 'Arrived at Plant Bay' | 'Verified & Stored' | 'Discrepancy Flagged';
  distributionStatus: 'Ready for Dispatch' | 'In Transit' | 'Delivered & Confirmed' | 'Partially Dispatched';
  receivingStatus: 'GRN Issued' | 'Pending Inspection' | 'Confirmed & Closed';
  grnNumber: string;
  waybillNumber: string;
  dateReceivedAtPlant?: string;
  dateDispatchedToFacility?: string;
  dateDeliveredToFacility?: string;
  driverName?: string;
  truckPlate?: string;
  plantOfficer: string;
  notes?: string;
}

const SAMPLE_PLANT_DSP_RECORDS: PlantDspRecord[] = [
  {
    id: 'p-dsp-001',
    dspOrderNumber: 'DSP-HO-PLANT/2026/088',
    hoLetterRef: 'EPSS/HO/MED/678/26',
    plantCode: 'AD01',
    plantName: 'Adama Hub Plant',
    region: 'Oromia',
    deviceCategory: 'Critical Care & ICU',
    description: 'Advanced ICU Ventilator System with Compressor',
    materialCode: 'MAT-VEN-04',
    allocatedQty: 25,
    receivedQty: 25,
    dispatchedQty: 20,
    destinationFacility: 'Asella Referral & Teaching Hospital',
    receivingDspStatus: 'Verified & Stored',
    distributionStatus: 'In Transit',
    receivingStatus: 'GRN Issued',
    grnNumber: 'GRN-AD01-2026-0412',
    waybillNumber: 'WB-AD-9921',
    dateReceivedAtPlant: '2026-03-14',
    dateDispatchedToFacility: '2026-03-18',
    driverName: 'Gemechu Desta',
    truckPlate: 'ET-3-48192',
    plantOfficer: 'Sr. Almaz Tolosa',
    notes: '5 units held at bay for upcoming Adama General Hospital delivery.'
  },
  {
    id: 'p-dsp-002',
    dspOrderNumber: 'DSP-HO-PLANT/2026/092',
    hoLetterRef: 'EPSS/HO/MED/680/26',
    plantCode: 'HW01',
    plantName: 'Hawassa Hub Plant',
    region: 'Sidama',
    deviceCategory: 'Diagnostic Ultrasound',
    description: 'Color Doppler Ultrasound Scanner 3-Probe',
    materialCode: 'MAT-ULT-01',
    allocatedQty: 18,
    receivedQty: 18,
    dispatchedQty: 18,
    destinationFacility: 'Hawassa University Comprehensive Specialized Hospital',
    receivingDspStatus: 'Verified & Stored',
    distributionStatus: 'Delivered & Confirmed',
    receivingStatus: 'Confirmed & Closed',
    grnNumber: 'GRN-HW01-2026-0189',
    waybillNumber: 'WB-HW-4310',
    dateReceivedAtPlant: '2026-03-11',
    dateDispatchedToFacility: '2026-03-15',
    dateDeliveredToFacility: '2026-03-16',
    driverName: 'Hailemariam Tekle',
    truckPlate: 'ET-3-31902',
    plantOfficer: 'Ato Yohannes Berhe',
    notes: 'Installation and acceptance certificate signed by biomedical lead.'
  },
  {
    id: 'p-dsp-003',
    dspOrderNumber: 'DSP-HO-PLANT/2026/095',
    hoLetterRef: 'EPSS/HO/MED/689/26',
    plantCode: 'BD01',
    plantName: 'Bahir Dar Hub Plant',
    region: 'Amhara',
    deviceCategory: 'Maternal & Neonatal',
    description: 'Infant Radiant Warmer & Incubator Unit',
    materialCode: 'MAT-INC-03',
    allocatedQty: 30,
    receivedQty: 30,
    dispatchedQty: 15,
    destinationFacility: 'Felege Hiwot Comprehensive Specialized Hospital',
    receivingDspStatus: 'Verified & Stored',
    distributionStatus: 'Partially Dispatched',
    receivingStatus: 'GRN Issued',
    grnNumber: 'GRN-BD01-2026-0521',
    waybillNumber: 'WB-BD-7712',
    dateReceivedAtPlant: '2026-03-16',
    dateDispatchedToFacility: '2026-03-20',
    driverName: 'Kassahun Mulatu',
    truckPlate: 'ET-3-88219',
    plantOfficer: 'W/ro Selamawit G.',
    notes: 'Second batch of 15 units staged for Debre Markos Hospital.'
  },
  {
    id: 'p-dsp-004',
    dspOrderNumber: 'DSP-HO-PLANT/2026/104',
    hoLetterRef: 'EPSS/HO/MED/701/26',
    plantCode: 'MK01',
    plantName: 'Mekelle Hub Plant',
    region: 'Tigray',
    deviceCategory: 'Surgical & Anesthesia',
    description: 'Anesthesia Workstation 3-Gas Integrated',
    materialCode: 'MAT-ANA-01',
    allocatedQty: 12,
    receivedQty: 12,
    dispatchedQty: 0,
    destinationFacility: 'Ayder Comprehensive Specialized Hospital',
    receivingDspStatus: 'Arrived at Plant Bay',
    distributionStatus: 'Ready for Dispatch',
    receivingStatus: 'Pending Inspection',
    grnNumber: 'GRN-MK01-2026-PENDING',
    waybillNumber: 'TBD',
    dateReceivedAtPlant: '2026-03-22',
    plantOfficer: 'Eng. Gebremedhin K.',
    notes: 'Physical QA inspection scheduled for tomorrow morning.'
  },
  {
    id: 'p-dsp-005',
    dspOrderNumber: 'DSP-HO-PLANT/2026/110',
    hoLetterRef: 'EPSS/HO/MED/712/26',
    plantCode: 'JM01',
    plantName: 'Jimma Hub Plant',
    region: 'Oromia',
    deviceCategory: 'Oxygen & Respiratory',
    description: 'Medical Oxygen Concentrator Heavy-Duty 10L',
    materialCode: 'MAT-OXY-01',
    allocatedQty: 50,
    receivedQty: 50,
    dispatchedQty: 50,
    destinationFacility: 'Jimma Medical Center (JMC)',
    receivingDspStatus: 'Verified & Stored',
    distributionStatus: 'Delivered & Confirmed',
    receivingStatus: 'Confirmed & Closed',
    grnNumber: 'GRN-JM01-2026-0314',
    waybillNumber: 'WB-JM-1120',
    dateReceivedAtPlant: '2026-03-12',
    dateDispatchedToFacility: '2026-03-14',
    dateDeliveredToFacility: '2026-03-15',
    driverName: 'Abdi Mohammed',
    truckPlate: 'ET-3-66120',
    plantOfficer: 'Ato Temesgen G.',
    notes: 'Fully deployed and commissioned in pediatric emergency unit.'
  },
  {
    id: 'p-dsp-006',
    dspOrderNumber: 'DSP-HO-PLANT/2026/115',
    hoLetterRef: 'EPSS/HO/MED/720/26',
    plantCode: 'DR01',
    plantName: 'Dire Dawa Hub Plant',
    region: 'Dire Dawa',
    deviceCategory: 'Sterilization & Autoclave',
    description: 'Horizontal Autoclave Steam Sterilizer 250L',
    materialCode: 'MAT-AUT-04',
    allocatedQty: 10,
    receivedQty: 0,
    dispatchedQty: 0,
    destinationFacility: 'Dilchora Referral Hospital',
    receivingDspStatus: 'Pending HO Arrival',
    distributionStatus: 'Ready for Dispatch',
    receivingStatus: 'Pending Inspection',
    grnNumber: 'Awaiting Receipt',
    waybillNumber: 'Awaiting Transit',
    plantOfficer: 'Sr. Fozia Ahmed',
    notes: 'Truck convoy dispatched from EPSS Central Addis Ababa.'
  }
];

interface PlantDspViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (tab: EpssSubTab) => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const PlantDspView: React.FC<PlantDspViewProps> = ({
  currentSubTab = 'plant-dsp',
  onSelectSubTab,
  items = [],
  onSelectItem
}) => {
  const [records, setRecords] = useState<PlantDspRecord[]>(SAMPLE_PLANT_DSP_RECORDS);
  const [selectedRecord, setSelectedRecord] = useState<PlantDspRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Determine active view mode based on subTab
  const activeMode: 'receiving-dsp' | 'distribution-status' | 'receiving-status' | 'overview' = useMemo(() => {
    if (currentSubTab === 'plant-receiving-dsp') return 'receiving-dsp';
    if (currentSubTab === 'plant-distribution-status') return 'distribution-status';
    if (currentSubTab === 'plant-receiving-status') return 'receiving-status';
    return 'overview';
  }, [currentSubTab]);

  const uniquePlants = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach(r => map.set(r.plantCode, `${r.plantCode} - ${r.plantName}`));
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchPlant = selectedPlant === 'all' || r.plantCode === selectedPlant;
      const matchSearch =
        r.dspOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.destinationFacility.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.plantName.toLowerCase().includes(searchQuery.toLowerCase());

      let matchFilter = true;
      if (selectedStatusFilter !== 'all') {
        if (activeMode === 'receiving-dsp') {
          matchFilter = r.receivingDspStatus === selectedStatusFilter;
        } else if (activeMode === 'distribution-status') {
          matchFilter = r.distributionStatus === selectedStatusFilter;
        } else if (activeMode === 'receiving-status') {
          matchFilter = r.receivingStatus === selectedStatusFilter;
        }
      }

      return matchPlant && matchSearch && matchFilter;
    });
  }, [records, selectedPlant, searchQuery, selectedStatusFilter, activeMode]);

  // Aggregate metrics
  const totalAllocated = useMemo(() => filteredRecords.reduce((sum, r) => sum + r.allocatedQty, 0), [filteredRecords]);
  const totalReceived = useMemo(() => filteredRecords.reduce((sum, r) => sum + r.receivedQty, 0), [filteredRecords]);
  const totalDispatched = useMemo(() => filteredRecords.reduce((sum, r) => sum + r.dispatchedQty, 0), [filteredRecords]);
  const fulfillmentRate = totalAllocated > 0 ? Math.round((totalDispatched / totalAllocated) * 100) : 0;

  const handleExportCSV = () => {
    const data = filteredRecords.map((r, idx) => ({
      '#': idx + 1,
      'DSP Order': r.dspOrderNumber,
      'Plant Hub': `${r.plantCode} - ${r.plantName}`,
      'Region': r.region,
      'Material Code': r.materialCode,
      'Description': r.description,
      'Allocated Qty': r.allocatedQty,
      'Received at Plant': r.receivedQty,
      'Dispatched to Facility': r.dispatchedQty,
      'Destination Facility': r.destinationFacility,
      'Receiving DSP Status': r.receivingDspStatus,
      'Distribution Status': r.distributionStatus,
      'Receiving Status': r.receivingStatus,
      'GRN Number': r.grnNumber,
      'Waybill': r.waybillNumber,
      'Plant Officer': r.plantOfficer
    }));
    downloadCSV(`EPSS_Plant_DSP_Status_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Plant DSP Status & Hub Execution Management
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                19 EPSS Hub Plants
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Branch-level receiving of DSP batches, goods receipt registry (GRN), and facility dispatch fulfillment
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Plant Ledger</span>
          </button>
        </div>
      </div>

      {/* 3 Sub-View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-md">
        <button
          onClick={() => onSelectSubTab?.('plant-receiving-dsp')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'receiving-dsp'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Inbox className="w-4 h-4 text-cyan-300" />
          <span>Receiving DSP</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-slate-300">
            {records.filter(r => r.receivingDspStatus !== 'Discrepancy Flagged').length}
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('plant-distribution-status')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'distribution-status'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4 text-emerald-300" />
          <span>Distribution Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-slate-300">
            {records.filter(r => r.distributionStatus === 'Delivered & Confirmed' || r.distributionStatus === 'In Transit').length}
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('plant-receiving-status')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'receiving-status'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <PackageCheck className="w-4 h-4 text-teal-300" />
          <span>Receiving Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/60 text-slate-300">
            {records.filter(r => r.receivingStatus === 'GRN Issued' || r.receivingStatus === 'Confirmed & Closed').length}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">HO DSP Allocation</div>
            <div className="text-xl font-black text-white mt-0.5 font-mono">{totalAllocated} Units</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{filteredRecords.length} Active Consignments</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Received at Plant Bays</div>
            <div className="text-xl font-black text-cyan-400 mt-0.5 font-mono">{totalReceived} Units</div>
            <div className="text-[10px] text-cyan-400/80 mt-0.5">Physical Inventory Verified</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Dispatched to Facilities</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5 font-mono">{totalDispatched} Units</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Delivered or En Route</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Fulfillment Rate</div>
            <div className="text-xl font-black text-purple-400 mt-0.5 font-mono">{fulfillmentRate}%</div>
            <div className="text-[10px] text-purple-400/80 mt-0.5">Dispatched vs Allocated</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plant, DSP order, material code, facility..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All 19 EPSS Plants</option>
            {uniquePlants.map(p => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Stage Statuses</option>
            {activeMode === 'receiving-dsp' && (
              <>
                <option value="Pending HO Arrival">Pending HO Arrival</option>
                <option value="Arrived at Plant Bay">Arrived at Plant Bay</option>
                <option value="Verified & Stored">Verified & Stored</option>
                <option value="Discrepancy Flagged">Discrepancy Flagged</option>
              </>
            )}
            {activeMode === 'distribution-status' && (
              <>
                <option value="Ready for Dispatch">Ready for Dispatch</option>
                <option value="In Transit">In Transit</option>
                <option value="Partially Dispatched">Partially Dispatched</option>
                <option value="Delivered & Confirmed">Delivered & Confirmed</option>
              </>
            )}
            {activeMode === 'receiving-status' && (
              <>
                <option value="Pending Inspection">Pending Inspection</option>
                <option value="GRN Issued">GRN Issued</option>
                <option value="Confirmed & Closed">Confirmed & Closed</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Plant & DSP Order</th>
                <th className="py-3 px-4">Medical Device / Description</th>
                <th className="py-3 px-4 text-center">Allocated</th>
                <th className="py-3 px-4 text-center">Received</th>
                <th className="py-3 px-4 text-center">Dispatched</th>
                <th className="py-3 px-4">Destination Facility</th>
                <th className="py-3 px-4 text-center">
                  {activeMode === 'receiving-dsp'
                    ? 'Receiving DSP Status'
                    : activeMode === 'distribution-status'
                    ? 'Distribution Status'
                    : 'Receiving Status (GRN)'}
                </th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No plant DSP execution records found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{rec.plantName}</span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-mono">{rec.dspOrderNumber}</div>
                      <div className="text-[10px] text-slate-500">Ref: {rec.hoLetterRef}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-200">{rec.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Code: {rec.materialCode} • {rec.deviceCategory}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">
                      {rec.allocatedQty}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-cyan-400">
                      {rec.receivedQty}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {rec.dispatchedQty}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-purple-300">{rec.destinationFacility}</div>
                      <div className="text-[10px] text-slate-400">Officer: {rec.plantOfficer}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {activeMode === 'receiving-dsp' ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.receivingDspStatus === 'Verified & Stored'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : rec.receivingDspStatus === 'Arrived at Plant Bay'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {rec.receivingDspStatus}
                        </span>
                      ) : activeMode === 'distribution-status' ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.distributionStatus === 'Delivered & Confirmed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : rec.distributionStatus === 'In Transit'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : rec.distributionStatus === 'Partially Dispatched'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {rec.distributionStatus}
                        </span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.receivingStatus === 'Confirmed & Closed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : rec.receivingStatus === 'GRN Issued'
                            ? 'bg-teal-950 text-teal-300 border border-teal-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {rec.receivingStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold transition cursor-pointer border border-slate-700 shadow-xs"
                      >
                        Inspect Plant Log
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Plant Log Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {selectedRecord.plantCode} - {selectedRecord.plantName}
                  </span>
                  <span className="text-xs font-bold text-amber-400 font-mono">{selectedRecord.dspOrderNumber}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{selectedRecord.description}</h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Plant Execution Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 block">GOODS RECEIPT NOTE (GRN)</span>
                <span className="font-mono font-bold text-teal-400">{selectedRecord.grnNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">WAYBILL NUMBER</span>
                <span className="font-mono font-bold text-indigo-400">{selectedRecord.waybillNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">DESTINATION FACILITY</span>
                <span className="font-semibold text-purple-300">{selectedRecord.destinationFacility}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">RESPONSIBLE OFFICER</span>
                <span className="font-semibold text-slate-200">{selectedRecord.plantOfficer}</span>
              </div>
              {selectedRecord.driverName && (
                <div>
                  <span className="text-[10px] text-slate-500 block">FLEET DRIVER</span>
                  <span className="text-slate-300">{selectedRecord.driverName} ({selectedRecord.truckPlate})</span>
                </div>
              )}
              {selectedRecord.dateDeliveredToFacility && (
                <div>
                  <span className="text-[10px] text-slate-500 block">DELIVERY CONFIRMATION DATE</span>
                  <span className="text-emerald-400 font-medium">{selectedRecord.dateDeliveredToFacility}</span>
                </div>
              )}
            </div>

            {/* Quantity Fulfillment Matrix */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Allocated</div>
                <div className="text-base font-bold text-white font-mono mt-0.5">{selectedRecord.allocatedQty}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-cyan-400">Received at Hub</div>
                <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">{selectedRecord.receivedQty}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-emerald-400">Dispatched</div>
                <div className="text-base font-bold text-emerald-300 font-mono mt-0.5">{selectedRecord.dispatchedQty}</div>
              </div>
            </div>

            {selectedRecord.notes && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Plant Operation Notes</span>
                {selectedRecord.notes}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
