import React, { useState, useMemo } from 'react';
import {
  HeartPulse,
  Percent,
  Layers,
  Truck,
  Building2,
  CheckCircle2,
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
  Clock,
  Archive,
  RefreshCw,
  Sparkles,
  Lock,
  ShieldAlert,
  UserCheck,
  Key,
  Check,
  X
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

interface DistributionRateAndSohViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (tab: EpssSubTab) => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const DistributionRateAndSohView: React.FC<DistributionRateAndSohViewProps> = ({
  currentSubTab = 'distribution',
  onSelectSubTab,
  items = [],
  onSelectItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedMaterialType, setSelectedMaterialType] = useState('all');

  // Strong Access Request Security State
  const [accessStatus, setAccessStatus] = useState<'granted' | 'pending' | 'locked'>(() => {
    return (localStorage.getItem('epss_distribution_access') as any) || 'locked';
  });
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    name: 'Dr. Samuel Kebede',
    directorate: 'Jimma Regional Health Bureau & Biomedical Unit',
    justification: 'Quarterly regional equipment allocation audit and distribution rate verification.',
    urgency: 'Audit Clearance / High Priority'
  });
  const [requestSubmittedTime, setRequestSubmittedTime] = useState<string | null>(null);

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.name.trim() || !requestForm.justification.trim()) {
      alert('Please fill in your name and justification for access.');
      return;
    }
    setAccessStatus('pending');
    setRequestSubmittedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setShowAccessModal(false);
  };

  const handleGrantAccess = () => {
    setAccessStatus('granted');
    localStorage.setItem('epss_distribution_access', 'granted');
  };

  const handleRevokeAccess = () => {
    setAccessStatus('locked');
    localStorage.removeItem('epss_distribution_access');
  };

  const activeMode: 'delivery-rate' | 'remain-soh' = useMemo(() => {
    if (currentSubTab === 'distribution-remain-soh') return 'remain-soh';
    return 'delivery-rate';
  }, [currentSubTab]);

  // Aggregate items with computed delivery rate and remaining SOH metrics
  const analyzedItems = useMemo(() => {
    return items.map((item, idx) => {
      const initialPlan = (item.qty || 1) + Math.floor((idx % 5) * 3);
      const dispatched = item.deliveryStatus === 'Delivered & Dispatched'
        ? item.qty
        : item.deliveryStatus === 'In Transit'
        ? Math.floor(item.qty * 0.7)
        : Math.floor(item.qty * 0.3);
      const remainSoh = Math.max(0, initialPlan - dispatched);
      const deliveryRate = initialPlan > 0 ? Math.min(100, Math.round((dispatched / initialPlan) * 100)) : 0;

      return {
        ...item,
        initialPlan,
        dispatched,
        remainSoh,
        deliveryRate,
        remainValuationETB: remainSoh * (item.unitPrice || 125000),
        dispatchedValuationETB: dispatched * (item.unitPrice || 125000)
      };
    });
  }, [items]);

  const uniquePlants = useMemo(() => {
    const map = new Map<string, string>();
    analyzedItems.forEach(i => {
      if (i.plant) map.set(i.plant, `${i.plant} - ${i.plantName || 'Hub'}`);
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [analyzedItems]);

  const uniqueMaterialTypes = useMemo(() => {
    const set = new Set<string>();
    analyzedItems.forEach(i => {
      if (i.materialType) set.add(i.materialType);
    });
    return Array.from(set);
  }, [analyzedItems]);

  const filteredItems = useMemo(() => {
    return analyzedItems.filter(item => {
      const matchPlant = selectedPlant === 'all' || item.plant === selectedPlant;
      const matchType = selectedMaterialType === 'all' || item.materialType === selectedMaterialType;
      const matchSearch =
        (item.materialDescription && item.materialDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.material && item.material.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.plantName && item.plantName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.programName && item.programName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.batch && item.batch.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchPlant && matchType && matchSearch;
    });
  }, [analyzedItems, selectedPlant, selectedMaterialType, searchQuery]);

  // Top KPI calculations
  const totalPlannedQty = useMemo(() => filteredItems.reduce((s, i) => s + i.initialPlan, 0), [filteredItems]);
  const totalDispatchedQty = useMemo(() => filteredItems.reduce((s, i) => s + i.dispatched, 0), [filteredItems]);
  const totalRemainSohQty = useMemo(() => filteredItems.reduce((s, i) => s + i.remainSoh, 0), [filteredItems]);
  const overallDeliveryRate = totalPlannedQty > 0 ? Math.round((totalDispatchedQty / totalPlannedQty) * 100) : 0;
  const totalRemainValuation = useMemo(() => filteredItems.reduce((s, i) => s + i.remainValuationETB, 0), [filteredItems]);

  // Chart data for plant delivery rates
  const plantRateChartData = useMemo(() => {
    const plantMap: Record<string, { plant: string; planned: number; dispatched: number; remain: number }> = {};
    filteredItems.forEach(item => {
      const p = item.plantName || item.plant || 'Central Hub';
      if (!plantMap[p]) {
        plantMap[p] = { plant: p.replace(' Hub', ''), planned: 0, dispatched: 0, remain: 0 };
      }
      plantMap[p].planned += item.initialPlan;
      plantMap[p].dispatched += item.dispatched;
      plantMap[p].remain += item.remainSoh;
    });
    return Object.values(plantMap).slice(0, 8);
  }, [filteredItems]);

  const rateDistributionPie = [
    { name: 'High Fulfillment (≥80%)', value: filteredItems.filter(i => i.deliveryRate >= 80).length, color: '#10B981' },
    { name: 'Moderate Delivery (50-79%)', value: filteredItems.filter(i => i.deliveryRate >= 50 && i.deliveryRate < 80).length, color: '#3B82F6' },
    { name: 'Low / Pending (<50%)', value: filteredItems.filter(i => i.deliveryRate < 50).length, color: '#F59E0B' }
  ];

  const handleExportCSV = () => {
    const data = filteredItems.map((i, idx) => ({
      '#': idx + 1,
      'Material Code': i.material,
      'Description': i.materialDescription,
      'Plant Hub': `${i.plant} - ${i.plantName}`,
      'Warehouse': i.wh,
      'Program': i.programName || 'National MOH Quota',
      'Planned Quantity': i.initialPlan,
      'Dispatched Quantity': i.dispatched,
      'Remaining SOH Quantity': i.remainSoh,
      'Delivery Fulfillment Rate (%)': `${i.deliveryRate}%`,
      'Remaining SOH Valuation (ETB)': i.remainValuationETB,
      'Batch': i.batch
    }));
    downloadCSV(`EPSS_Distribution_${activeMode}_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                Distribution Performance & Fulfillment Ledger
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                Delivery Rate & Remaining SOH
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time monitoring of equipment delivery completion rates, warehouse remaining stock (SOH), and branch dispatch fulfillment
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {accessStatus === 'granted' ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Security Clearance: Authorized</span>
              </span>
              <button
                onClick={handleRevokeAccess}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold transition cursor-pointer border border-slate-200"
                title="Lock session clearance"
              >
                Lock
              </button>
            </div>
          ) : accessStatus === 'pending' ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Clearance Pending (Submitted at {requestSubmittedTime || 'Today'})</span>
              </span>
              <button
                onClick={handleGrantAccess}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                title="Simulate Admin Approval"
              >
                ✓ Approve Access (Admin)
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAccessModal(true)}
              className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Key className="w-4 h-4" />
              <span>Request Official Access Clearance</span>
            </button>
          )}

          {accessStatus === 'granted' && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-300 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Distribution Ledger</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-2xl shadow-xs">
        <button
          onClick={() => onSelectSubTab?.('distribution-delivery-rate')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'delivery-rate'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Percent className="w-4 h-4 text-emerald-200" />
          <span>Delivery Rate</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/80 text-emerald-800 font-bold">
            {overallDeliveryRate}% Avg
          </span>
        </button>

        <button
          onClick={() => onSelectSubTab?.('distribution-remain-soh')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeMode === 'remain-soh'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-200" />
          <span>Remain SOH</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/80 text-purple-800 font-bold">
            {totalRemainSohQty.toLocaleString()} Units
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Program Quota</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{totalPlannedQty.toLocaleString()} Units</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{filteredItems.length} Medical Device Lines</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Archive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Dispatched & Delivered</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5 font-mono">{totalDispatchedQty.toLocaleString()} Units</div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5">Dispatched to Facilities</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Overall Delivery Rate</div>
            <div className="text-xl font-black text-cyan-600 mt-0.5 font-mono">{overallDeliveryRate}%</div>
            <div className="text-[10px] text-cyan-600/80 mt-0.5">Dispatched vs Allocated</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Remaining SOH Stock</div>
            <div className="text-xl font-black text-purple-600 mt-0.5 font-mono">{totalRemainSohQty.toLocaleString()} Units</div>
            <div className="text-[10px] text-purple-600/80 mt-0.5">{formatCurrency(totalRemainValuation)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Plant Fulfillment Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Plant Dispatch vs Remaining SOH Distribution
              </h3>
              <p className="text-[11px] text-slate-500">Comparison of dispatched volume against remaining warehouse stock</p>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              EPSS Plants
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plantRateChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                <XAxis dataKey="plant" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', color: '#0f172a' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="dispatched" name="Dispatched to Facilities" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="remain" name="Remaining SOH" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fulfillment Rate Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Fulfillment Speed Tiers
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">Distribution rate performance distribution</p>

            <div className="h-40 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rateDistributionPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rateDistributionPie.map((entry, index) => (
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
            {rateDistributionPie.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">{entry.value} Items</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search material, description, plant, batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Source Plants</option>
            {uniquePlants.map(p => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>

          <select
            value={selectedMaterialType}
            onChange={(e) => setSelectedMaterialType(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Material Types</option>
            {uniqueMaterialTypes.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table with Strong Access Request Security Gate */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs relative">
        {accessStatus !== 'granted' && (
          <div className="absolute inset-0 z-20 backdrop-blur-md bg-white/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-md">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                Distribution Report Restricted Access
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This regional distribution ledger contains confidential Ministry of Health allocation metrics and regional transit data. Official security clearance is required to view raw dispatch records.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowAccessModal(true)}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>Request Official Access Clearance</span>
              </button>
              <button
                onClick={handleGrantAccess}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition border border-slate-300 cursor-pointer"
              >
                Simulate Admin Grant
              </button>
            </div>
          </div>
        )}

        <div className={`overflow-x-auto ${accessStatus !== 'granted' ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Material & Description</th>
                <th className="py-3 px-4">Plant & Hub</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-center">Planned Quota</th>
                <th className="py-3 px-4 text-center">Dispatched</th>
                <th className="py-3 px-4 text-center">Remain SOH</th>
                <th className="py-3 px-4 text-center">Delivery Rate</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No medical device distribution records match current filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.materialDescription}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Code: {item.material} • Batch: {item.batch}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.plant} - {item.plantName || 'Hub'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-purple-700">{item.wh}</div>
                      <div className="text-[10px] text-slate-500">{item.programName || 'National MOH'}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {item.initialPlan}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                      {item.dispatched}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-purple-600">
                      {item.remainSoh}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                          <div
                            className={`h-full rounded-full ${
                              item.deliveryRate >= 80 ? 'bg-emerald-500' : item.deliveryRate >= 50 ? 'bg-cyan-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.deliveryRate}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-[11px] text-slate-800">
                          {item.deliveryRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectItem?.(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-700 text-[10px] font-bold transition cursor-pointer border border-slate-300 shadow-xs"
                      >
                        Inspect Device
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Request Modal */}
      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                    Official Access Request Form
                  </h3>
                  <p className="text-xs text-slate-500">
                    Submit credentials and justification for Distribution Report clearance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAccessModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Requester Full Name & Title</label>
                <input
                  type="text"
                  required
                  value={requestForm.name}
                  onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-amber-500"
                  placeholder="e.g. Dr. Samuel Kebede"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Regional Directorate / Health Bureau</label>
                <input
                  type="text"
                  required
                  value={requestForm.directorate}
                  onChange={(e) => setRequestForm({ ...requestForm, directorate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-amber-500"
                  placeholder="e.g. Jimma Regional Health Bureau"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audit / Inspection Justification</label>
                <textarea
                  required
                  rows={3}
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-amber-500 resize-none"
                  placeholder="Explain why you require access to regional equipment dispatch records..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Clearance Priority Level</label>
                <select
                  value={requestForm.urgency}
                  onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:bg-white focus:border-amber-500 cursor-pointer"
                >
                  <option value="Normal">Normal Review (24-48 hours)</option>
                  <option value="Urgent / Emergency">Urgent / Emergency Dispatch Verification</option>
                  <option value="Audit Clearance / High Priority">Audit Clearance / High Priority</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
                >
                  Submit Access Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
