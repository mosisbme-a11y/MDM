import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Activity,
  FileCheck2,
  CircleDollarSign,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Filter,
  ArrowRight,
  Warehouse,
  Hospital,
  ChevronRight,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  Sparkles,
  BadgeAlert,
  UserCheck,
  FileSpreadsheet,
  Check,
  ExternalLink
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

export interface InstallationRecord {
  id: string;
  installationRef: string;
  contractNumber: string;
  vendorName: string;
  materialCode: string;
  description: string;
  category: string;
  serialNumber: string;
  destinationFacility: string;
  facilityType: 'Specialized Comprehensive' | 'General Hospital' | 'Primary Hospital' | 'Health Center';
  region: string;
  plantHub: string;
  siteReadiness: 'Site Ready' | 'Civil Works Incomplete' | 'Power/Water Deficit' | 'Pending Assessment';
  installationStatus: 'Installed & Commissioned' | 'In Progress' | 'Pending Installation' | 'Site Not Ready' | 'PAC Pending';
  performanceScore: number; // 0 - 100%
  engineerName: string;
  engineerContact: string;
  commissioningDate?: string;
  pacCertificateNumber?: string;
  warrantyPeriodMonths: number;
  totalContractValueETB: number;
  paymentMilestone: '100% Paid (Closed)' | '80% Commissioning Paid (20% Retained)' | '50% Advance Paid' | 'Payment Pending Review';
  retentionAmountETB: number;
  paidAmountETB: number;
  paymentRefNumber: string;
  notes?: string;
}

const SAMPLE_INSTALLATION_RECORDS: InstallationRecord[] = [];

interface InstallationManagementViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (tab: EpssSubTab) => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const InstallationManagementView: React.FC<InstallationManagementViewProps> = ({
  currentSubTab = 'installation',
  onSelectSubTab,
  items = [],
  onSelectItem
}) => {
  const [records, setRecords] = useState<InstallationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<InstallationRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const activeMode: 'performance' | 'status-record' | 'payment-status' = useMemo(() => {
    if (currentSubTab === 'installation-performance') return 'performance';
    if (currentSubTab === 'installation-status-record') return 'status-record';
    if (currentSubTab === 'installation-payment-status') return 'payment-status';
    return 'performance';
  }, [currentSubTab]);

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => set.add(r.region));
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchRegion = selectedRegion === 'all' || r.region === selectedRegion;
      const matchStatus = selectedStatus === 'all' || r.installationStatus === selectedStatus;
      const matchSearch =
        r.installationRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.destinationFacility.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());

      return matchRegion && matchStatus && matchSearch;
    });
  }, [records, selectedRegion, selectedStatus, searchQuery]);

  // Financial & Performance Computations
  const totalContractVal = useMemo(() => filteredRecords.reduce((s, r) => s + r.totalContractValueETB, 0), [filteredRecords]);
  const totalPaidVal = useMemo(() => filteredRecords.reduce((s, r) => s + r.paidAmountETB, 0), [filteredRecords]);
  const totalRetentionVal = useMemo(() => filteredRecords.reduce((s, r) => s + r.retentionAmountETB, 0), [filteredRecords]);
  const avgPerformance = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    return Math.round(filteredRecords.reduce((s, r) => s + r.performanceScore, 0) / filteredRecords.length);
  }, [filteredRecords]);

  // Chart data for Regional Installation Performance
  const regionalPerformanceData = useMemo(() => {
    const regMap: Record<string, { region: string; installed: number; pending: number; avgScore: number; count: number }> = {};
    filteredRecords.forEach(r => {
      if (!regMap[r.region]) {
        regMap[r.region] = { region: r.region, installed: 0, pending: 0, avgScore: 0, count: 0 };
      }
      if (r.installationStatus === 'Installed & Commissioned') {
        regMap[r.region].installed += 1;
      } else {
        regMap[r.region].pending += 1;
      }
      regMap[r.region].avgScore += r.performanceScore;
      regMap[r.region].count += 1;
    });

    return Object.values(regMap).map(rm => ({
      region: rm.region,
      installed: rm.installed,
      pending: rm.pending,
      score: rm.count > 0 ? Math.round(rm.avgScore / rm.count) : 0
    }));
  }, [filteredRecords]);

  const statusDistributionPie = [
    { name: 'Commissioned', value: filteredRecords.filter(r => r.installationStatus === 'Installed & Commissioned').length, color: '#10B981' },
    { name: 'In Progress', value: filteredRecords.filter(r => r.installationStatus === 'In Progress').length, color: '#3B82F6' },
    { name: 'PAC Pending', value: filteredRecords.filter(r => r.installationStatus === 'PAC Pending').length, color: '#8B5CF6' },
    { name: 'Site Not Ready', value: filteredRecords.filter(r => r.installationStatus === 'Site Not Ready').length, color: '#EF4444' }
  ];

  const handleExportCSV = () => {
    const data = filteredRecords.map((r, idx) => ({
      '#': idx + 1,
      'Installation Ref': r.installationRef,
      'Contract #': r.contractNumber,
      'Vendor': r.vendorName,
      'Material Code': r.materialCode,
      'Description': r.description,
      'Serial Number': r.serialNumber,
      'Destination Facility': r.destinationFacility,
      'Region': r.region,
      'Plant Hub': r.plantHub,
      'Site Readiness': r.siteReadiness,
      'Installation Status': r.installationStatus,
      'Performance Score': `${r.performanceScore}%`,
      'PAC Certificate': r.pacCertificateNumber || 'N/A',
      'Total Value (ETB)': r.totalContractValueETB,
      'Paid (ETB)': r.paidAmountETB,
      'Retention (ETB)': r.retentionAmountETB,
      'Payment Milestone': r.paymentMilestone,
      'Engineer': r.engineerName
    }));
    downloadCSV(`EPSS_Installation_${activeMode}_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-600">
            <Hospital className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                Installation Management & Commissioning Ledger
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                Biomedical Engineering & Vendor Payments
              </span>
            </div>
            <p className="text-xs text-slate-500">
              End-to-end tracking of clinical site readiness, device commissioning, PAC certification, and milestone payment disbursements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-300 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Export Installation Ledger</span>
          </button>
        </div>
      </div>

      {/* 3 Sub-View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-2xl shadow-xs">
        <button
          onClick={() => onSelectSubTab?.('installation-performance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'performance'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Activity className="w-4 h-4 text-purple-200" />
          <span>Installation Performance</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/80 text-purple-800 font-bold">
            {avgPerformance}% Avg
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('installation-status-record')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'status-record'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-emerald-200" />
          <span>Installation Status Record</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/80 text-emerald-800 font-bold">
            {records.filter(r => r.installationStatus === 'Installed & Commissioned').length} Commissioned
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('installation-payment-status')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'payment-status'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <CircleDollarSign className="w-4 h-4 text-amber-200" />
          <span>Payment Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/80 text-amber-800 font-bold">
            {formatCurrency(totalPaidVal)} Disbursed
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Installation Value</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{formatCurrency(totalContractVal)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{filteredRecords.length} Active Contracts</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
            <Hospital className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Commissioned & PAC Issued</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5 font-mono">
              {filteredRecords.filter(r => r.installationStatus === 'Installed & Commissioned').length} / {filteredRecords.length}
            </div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5">Tested & Operational</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Average Technical Score</div>
            <div className="text-xl font-black text-cyan-600 mt-0.5 font-mono">{avgPerformance}%</div>
            <div className="text-[10px] text-cyan-600/80 mt-0.5">Biomedical QA Index</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Vendor Payments Disbursed</div>
            <div className="text-xl font-black text-amber-600 mt-0.5 font-mono">{formatCurrency(totalPaidVal)}</div>
            <div className="text-[10px] text-amber-600/80 mt-0.5">Retention: {formatCurrency(totalRetentionVal)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <CircleDollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Section for Performance & Payment */}
      {activeMode === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Regional Installation Commissioning vs Pending
                </h3>
                <p className="text-[11px] text-slate-500">Completion rate of medical equipment setup across regions</p>
              </div>
              <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                Regions
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionalPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                  <XAxis dataKey="region" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', color: '#0f172a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="installed" name="Commissioned & Operational" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending / Site Readiness" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Installation Status Breakdown
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">Equipment lifecycle stage distribution</p>

              <div className="h-40 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistributionPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDistributionPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', color: '#0f172a' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              {statusDistributionPie.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">{entry.value} Units</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search installation ref, hospital, vendor, serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Regions</option>
            {uniqueRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Installation Statuses</option>
            <option value="Installed & Commissioned">Installed & Commissioned</option>
            <option value="In Progress">In Progress</option>
            <option value="PAC Pending">PAC Pending</option>
            <option value="Site Not Ready">Site Not Ready</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Installation Ref & Vendor</th>
                <th className="py-3 px-4">Medical Device / Serial #</th>
                <th className="py-3 px-4">Destination Facility</th>
                <th className="py-3 px-4">Site Readiness</th>
                <th className="py-3 px-4 text-center">Technical Score</th>
                <th className="py-3 px-4 text-center">
                  {activeMode === 'payment-status' ? 'Payment Milestone' : 'Installation Status'}
                </th>
                <th className="py-3 px-4 text-right">
                  {activeMode === 'payment-status' ? 'Disbursed (ETB)' : 'Contract Value (ETB)'}
                </th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No installation records match current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-purple-700">{rec.installationRef}</div>
                      <div className="text-[10px] text-slate-700 font-semibold">{rec.vendorName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Contract: {rec.contractNumber}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-900">{rec.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">SN: {rec.serialNumber} • {rec.category}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-purple-800">{rec.destinationFacility}</div>
                      <div className="text-[10px] text-slate-500">{rec.region} • Hub: {rec.plantHub}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        rec.siteReadiness === 'Site Ready'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {rec.siteReadiness}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-mono font-bold text-cyan-700 text-[11px]">{rec.performanceScore}%</div>
                      <div className="w-12 bg-slate-200 rounded-full h-1.5 mx-auto mt-1 overflow-hidden border border-slate-300">
                        <div
                          className={`h-full rounded-full ${
                            rec.performanceScore >= 90 ? 'bg-emerald-500' : rec.performanceScore >= 75 ? 'bg-cyan-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${rec.performanceScore}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {activeMode === 'payment-status' ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.paymentMilestone === '100% Paid (Closed)'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.paymentMilestone.includes('80%')
                            ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {rec.paymentMilestone}
                        </span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.installationStatus === 'Installed & Commissioned'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.installationStatus === 'In Progress'
                            ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                            : rec.installationStatus === 'PAC Pending'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {rec.installationStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {activeMode === 'payment-status'
                        ? formatCurrency(rec.paidAmountETB)
                        : formatCurrency(rec.totalContractValueETB)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-purple-700 text-[10px] font-bold transition cursor-pointer border border-slate-300 shadow-xs"
                      >
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Installation Dossier Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4 text-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {selectedRecord.installationRef}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{selectedRecord.destinationFacility}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{selectedRecord.description}</h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Technical Installation & PAC Box */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 block">SUPPLIER / CONTRACTOR</span>
                <span className="font-semibold text-slate-900">{selectedRecord.vendorName}</span>
                <span className="text-[10px] text-slate-500 font-mono block">Contract: {selectedRecord.contractNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">SERIAL NUMBER</span>
                <span className="font-mono font-bold text-cyan-700">{selectedRecord.serialNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">PROVISIONAL ACCEPTANCE (PAC)</span>
                <span className="font-mono font-bold text-emerald-700">{selectedRecord.pacCertificateNumber || 'Pending Sign-Off'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">COMMISSIONING DATE</span>
                <span className="text-slate-700">{selectedRecord.commissioningDate || 'In Progress'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">RESPONSIBLE BIOMEDICAL ENGINEER</span>
                <span className="text-slate-800 font-semibold">{selectedRecord.engineerName}</span>
                <span className="text-[10px] text-slate-500 block">{selectedRecord.engineerContact}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">WARRANTY PERIOD</span>
                <span className="text-slate-200">{selectedRecord.warrantyPeriodMonths} Months Comprehensive</span>
              </div>
            </div>

            {/* Milestone Payment Details */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                <span>Vendor Payment & Retention Breakdown</span>
                <span className="text-[10px] font-mono text-slate-400">Ref: {selectedRecord.paymentRefNumber}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Contract Sum</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(selectedRecord.totalContractValueETB)}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 block">Disbursed (Paid)</span>
                  <span className="font-mono font-bold text-emerald-400">{formatCurrency(selectedRecord.paidAmountETB)}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-amber-400 block">Retention Held</span>
                  <span className="font-mono font-bold text-amber-400">{formatCurrency(selectedRecord.retentionAmountETB)}</span>
                </div>
              </div>
            </div>

            {selectedRecord.notes && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Biomedical Technical Notes</span>
                {selectedRecord.notes}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
