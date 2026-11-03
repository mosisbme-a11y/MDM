import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Calendar,
  Filter,
  RefreshCw,
  Percent,
  TrendingUp,
  HardDrive,
  Truck,
  Activity,
  Award,
  CircleDollarSign,
  Package,
  Layers,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface ManagementExecutiveDashboardProps {
  items: MedicalDeviceItem[];
  language?: 'en' | 'am';
}

export const ManagementExecutiveDashboard: React.FC<ManagementExecutiveDashboardProps> = ({
  items = [],
  language = 'en'
}) => {
  // --- 1. Interactive Filter States for Procurement ---
  const [selectedPo, setSelectedPo] = useState<string>('all');
  const [selectedAgreement, setSelectedAgreement] = useState<string>('all');
  const [selectedBudget, setSelectedBudget] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [minQty, setMinQty] = useState<number>(0);

  // Derive unique values for Procurement filters
  const uniquePos = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const match = i.batch || i.wbsElement;
      if (match) set.add(match);
    });
    return Array.from(set).slice(0, 15); // limit list for display suitability
  }, [items]);

  const uniqueAgreements = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const match = i.materialType || 'Framework Agreement';
      if (match) set.add(match);
    });
    return Array.from(set);
  }, [items]);

  const uniqueBudgets = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const match = i.wbsElement;
      if (match) set.add(match);
    });
    return Array.from(set).slice(0, 10);
  }, [items]);

  const uniqueYears = ['2024', '2025', '2026', '2027'];

  // Handle clear all management filters
  const handleResetFilters = () => {
    setSelectedPo('all');
    setSelectedAgreement('all');
    setSelectedBudget('all');
    setSelectedYear('all');
    setMinQty(0);
  };

  // --- 2. Filter & Calculate Procurement Metrics ---
  const filteredProcurementItems = useMemo(() => {
    return items.filter(i => {
      // PO Filter (mapped to batch or item ID suffix)
      if (selectedPo !== 'all' && i.batch !== selectedPo && i.wbsElement !== selectedPo) return false;
      // Agreement Filter
      if (selectedAgreement !== 'all' && (i.materialType || 'Framework Agreement') !== selectedAgreement) return false;
      // Budget WBS Filter
      if (selectedBudget !== 'all' && i.wbsElement !== selectedBudget) return false;
      // Year Filter
      if (selectedYear !== 'all' && !String(i.expiryDate || '2026').includes(selectedYear)) return false;
      // Quantity filter
      if (Number(i.qty || 0) < minQty) return false;
      return true;
    });
  }, [items, selectedPo, selectedAgreement, selectedBudget, selectedYear, minQty]);

  // Calculations by Percentage
  const procurementPercentages = useMemo(() => {
    const total = filteredProcurementItems.length || 1;
    let lcOpened = 0;
    let dispatched = 0;
    let cleared = 0;
    let arrived = 0;

    filteredProcurementItems.forEach(i => {
      const lowerClearance = String(i.clearanceStatus || '').toLowerCase();
      const lowerLc = String(i.lcStatus || '').toLowerCase();
      const lowerShip = String(i.shipmentStatus || '').toLowerCase();
      const delivStatus = String(i.deliveryStatus || '').toLowerCase();

      if (lowerLc.includes('open') || lowerLc.includes('issue') || i.lcStatus) lcOpened++;
      if (delivStatus.includes('dispatched') || delivStatus.includes('transit') || i.deliveryStatus) dispatched++;
      if (lowerClearance.includes('clear') || lowerClearance.includes('done')) cleared++;
      if (delivStatus.includes('delivered') || !i.isNotFunctional) arrived++;
    });

    return {
      lcPct: Math.round((lcOpened / total) * 100),
      dispatchPct: Math.round((dispatched / total) * 100),
      clearPct: Math.round((cleared / total) * 100),
      arrivePct: Math.round((arrived / total) * 100),
      totalCount: filteredProcurementItems.length,
      totalQty: filteredProcurementItems.reduce((acc, i) => acc + (Number(i.qty) || 0), 0),
      totalValue: filteredProcurementItems.reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0)
    };
  }, [filteredProcurementItems]);


  // --- 3. Installation Metrics (Mandatory #2) ---
  const installationStats = useMemo(() => {
    const total = items.length || 1;
    let installed = 0;
    let pending = 0;
    let commissioning = 0;
    let assessment = 0;

    items.forEach(i => {
      const status = String(i.installationStatus || '').toLowerCase();
      if (status.includes('installed') || status === 'installed') installed++;
      else if (status.includes('pending')) pending++;
      else if (status.includes('commission')) commissioning++;
      else if (status.includes('site') || status.includes('assess')) assessment++;
      else installed++; // fallback
    });

    return {
      installedPct: Math.round((installed / total) * 100),
      pendingPct: Math.round((pending / total) * 100),
      commissionPct: Math.round((commissioning / total) * 100),
      assessPct: Math.round((assessment / total) * 100),
      installedCount: installed,
      pendingCount: pending,
      commissionCount: commissioning,
      assessCount: assessment
    };
  }, [items]);


  // --- 4. Distribution Metrics (Mandatory #3) ---
  const distributionStats = useMemo(() => {
    const total = items.length || 1;
    let centralStock = 0;
    let regionalTransit = 0;
    let portCustoms = 0;
    let localWards = 0;

    items.forEach(i => {
      const deliv = String(i.deliveryStatus || '').toLowerCase();
      if (deliv.includes('transit')) regionalTransit++;
      else if (deliv.includes('custom') || deliv.includes('port')) portCustoms++;
      else if (i.plant === 'HO01') centralStock++;
      else localWards++;
    });

    return {
      centralPct: Math.round((centralStock / total) * 100),
      transitPct: Math.round((regionalTransit / total) * 100),
      portPct: Math.round((portCustoms / total) * 100),
      wardPct: Math.round((localWards / total) * 100),
      centralCount: centralStock,
      transitCount: regionalTransit,
      portCount: portCustoms,
      wardCount: localWards
    };
  }, [items]);


  // --- 5. Breakdown Metrics (Mandatory #4) ---
  const breakdownStats = useMemo(() => {
    const total = items.length || 1;
    let defective = 0;
    let nonMoving = 0;
    let fullyOperational = 0;

    items.forEach(i => {
      if (i.isNotFunctional) defective++;
      else if (i.isNonMoving) nonMoving++;
      else fullyOperational++;
    });

    return {
      defectivePct: Math.round((defective / total) * 100),
      nonMovingPct: Math.round((nonMoving / total) * 100),
      operationalPct: Math.round((fullyOperational / total) * 100),
      defectiveCount: defective,
      nonMovingCount: nonMoving,
      operationalCount: fullyOperational
    };
  }, [items]);


  // --- 6. Maintenance Metrics (Mandatory #5) ---
  const maintenanceStats = useMemo(() => {
    const total = items.length || 1;
    let ppmScheduled = 0;
    let spareNeeded = 0;
    let partsSecured = 0;

    items.forEach(i => {
      if (i.needsSparePart) spareNeeded++;
      else if (i.isNotFunctional) ppmScheduled++;
      else partsSecured++;
    });

    // Simulated high-fidelity SLA level tracking for biomed
    return {
      scheduledPct: Math.round((ppmScheduled / total) * 100),
      sparePct: Math.round((spareNeeded / total) * 100),
      securedPct: Math.round((partsSecured / total) * 100),
      scheduledCount: ppmScheduled,
      spareCount: spareNeeded,
      securedCount: partsSecured
    };
  }, [items]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* --- 1. PROCUREMENT STATUS MODULE WITH ADVANCED FILTERS --- */}
      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700 border border-cyan-200">
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                1. Procurement Execution Status (By Percent)
              </h3>
              <p className="text-[10px] text-slate-500">Filters PO, Agreement, Budget source, year, and quantity bounds dynamically</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-150 px-2 py-0.5 rounded-md font-bold">
              <span>Query Matches: {procurementPercentages.totalCount} items ({formatNumber(procurementPercentages.totalQty)} Pcs)</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-250 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
              title="Reset all filter selections"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Management Filter Controls Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* PO / Batch Code filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">Purchase Order (PO)</label>
            <select
              value={selectedPo}
              onChange={(e) => setSelectedPo(e.target.value)}
              className="w-full text-[11px] font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">All PO Batches</option>
              {uniquePos.map((po) => (
                <option key={po} value={po}>PO: {po}</option>
              ))}
            </select>
          </div>

          {/* Agreement Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">Framework Agreement</label>
            <select
              value={selectedAgreement}
              onChange={(e) => setSelectedAgreement(e.target.value)}
              className="w-full text-[11px] font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">All Agreements</option>
              {uniqueAgreements.map((ag) => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>
          </div>

          {/* Budget Source Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">Funding WBS</label>
            <select
              value={selectedBudget}
              onChange={(e) => setSelectedBudget(e.target.value)}
              className="w-full text-[11px] font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">All Funding Sources</option>
              {uniqueBudgets.map((bg) => (
                <option key={bg} value={bg}>WBS: {bg}</option>
              ))}
            </select>
          </div>

          {/* Fiscal Year Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">Target Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-[11px] font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">All Years</option>
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>
          </div>

          {/* Quantity Min Filter */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">Min Quantity ({minQty} Pcs)</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minQty}
              onChange={(e) => setMinQty(Number(e.target.value))}
              className="w-full accent-cyan-600 mt-1.5 cursor-pointer"
            />
          </div>
        </div>

        {/* Procurement Percentage Progress Rings/Bars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3">
          {/* L/C opened percentage */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Letter of Credit %</span>
            <div className="relative inline-flex items-center justify-center">
              <strong className="text-xl font-extrabold text-slate-850 font-mono">
                {procurementPercentages.lcPct}%
              </strong>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-cyan-600 h-full rounded-full transition-all duration-300" style={{ width: `${procurementPercentages.lcPct}%` }}></div>
            </div>
          </div>

          {/* Dispatched & Shipped percentage */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Dispatched Pipeline %</span>
            <strong className="text-xl font-extrabold text-slate-850 font-mono block">
              {procurementPercentages.dispatchPct}%
            </strong>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${procurementPercentages.dispatchPct}%` }}></div>
            </div>
          </div>

          {/* Cleared Customs percentage */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Port Customs Clearance %</span>
            <strong className="text-xl font-extrabold text-slate-850 font-mono block">
              {procurementPercentages.clearPct}%
            </strong>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full transition-all duration-300" style={{ width: `${procurementPercentages.clearPct}%` }}></div>
            </div>
          </div>

          {/* Arrived & SOH Stock value percentage */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Central Stock Receipt %</span>
            <strong className="text-xl font-extrabold text-slate-850 font-mono block">
              {procurementPercentages.arrivePct}%
            </strong>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${procurementPercentages.arrivePct}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* --- FOUR MAIN PILLARS STATS GRID (INSTALLATION, DISTRIBUTION, BREAKDOWN, MAINTENANCE) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* --- 2. INSTALLATION STATUS --- */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              2. Installation Status
            </h4>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Installed */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Fully Installed & Live</span>
                <span className="text-slate-900 font-mono">{installationStats.installedCount} Pcs ({installationStats.installedPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${installationStats.installedPct}%` }}></div>
              </div>
            </div>

            {/* Pending */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Pending Installation</span>
                <span className="text-slate-900 font-mono">{installationStats.pendingCount} Pcs ({installationStats.pendingPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${installationStats.pendingPct}%` }}></div>
              </div>
            </div>

            {/* Commissioning */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Under Commissioning</span>
                <span className="text-slate-900 font-mono">{installationStats.commissionCount} Pcs ({installationStats.commissionPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${installationStats.commissionPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 3. DISTRIBUTION STATUS --- */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200">
              <Truck className="w-4 h-4" />
            </div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              3. Distribution Status
            </h4>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Central SOH */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Central Stockpile</span>
                <span className="text-slate-900 font-mono">{distributionStats.centralCount} Items ({distributionStats.centralPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${distributionStats.centralPct}%` }}></div>
              </div>
            </div>

            {/* In Transit */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Regional In Transit</span>
                <span className="text-slate-900 font-mono">{distributionStats.transitCount} Items ({distributionStats.transitPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-cyan-600 h-full rounded-full" style={{ width: `${distributionStats.transitPct}%` }}></div>
              </div>
            </div>

            {/* Port customs */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Port Customs Stage</span>
                <span className="text-slate-900 font-mono">{distributionStats.portCount} Items ({distributionStats.portPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-amber-600 h-full rounded-full" style={{ width: `${distributionStats.portPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 4. BREAKDOWN STATUS --- */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              4. Breakdown Status
            </h4>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Defective */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Active Defective Devices</span>
                <span className="text-rose-700 font-mono font-black">{breakdownStats.defectiveCount} Pcs ({breakdownStats.defectivePct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-rose-600 h-full rounded-full" style={{ width: `${breakdownStats.defectivePct}%` }}></div>
              </div>
            </div>

            {/* Non-moving */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Slow / Non-Moving</span>
                <span className="text-slate-900 font-mono">{breakdownStats.nonMovingCount} Pcs ({breakdownStats.nonMovingPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${breakdownStats.nonMovingPct}%` }}></div>
              </div>
            </div>

            {/* Fully functional */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Fully Operational SOH</span>
                <span className="text-slate-900 font-mono">{breakdownStats.operationalCount} Pcs ({breakdownStats.operationalPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${breakdownStats.operationalPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 5. MAINTENANCE STATUS --- */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
              <Settings className="w-4 h-4" />
            </div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              5. Maintenance Status
            </h4>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* PPM Scheduled */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Scheduled Preventive Maintenance</span>
                <span className="text-slate-900 font-mono">{maintenanceStats.scheduledCount} Pcs ({maintenanceStats.scheduledPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${maintenanceStats.scheduledPct}%` }}></div>
              </div>
            </div>

            {/* Spare needed */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Urgent Spare Parts Needed</span>
                <span className="text-purple-700 font-mono font-black">{maintenanceStats.spareCount} Pcs ({maintenanceStats.sparePct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${maintenanceStats.sparePct}%` }}></div>
              </div>
            </div>

            {/* SLA Secured */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">Active Service Agreements</span>
                <span className="text-slate-900 font-mono">{maintenanceStats.securedCount} Pcs ({maintenanceStats.securedPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.2">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${maintenanceStats.securedPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
