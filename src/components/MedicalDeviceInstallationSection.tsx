import React, { useMemo } from 'react';
import {
  Wrench,
  LayoutGrid,
  ArrowUpRight,
  TrendingUp,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { InventorySummary, MedicalDeviceItem } from '../types';
import { formatNumber, formatCurrency } from '../utils/formatters';

interface MedicalDeviceInstallationSectionProps {
  items: MedicalDeviceItem[];
  summary: InventorySummary;
  onOpenTaskView: (initialStatus?: string) => void;
  onNavigateTab: (tab: string) => void;
  isVerticalLayout?: boolean;
}

export const MedicalDeviceInstallationSection: React.FC<MedicalDeviceInstallationSectionProps> = ({
  items,
  summary,
  onOpenTaskView,
  onNavigateTab,
  isVerticalLayout = false
}) => {
  // Aggregate installation metrics from items or summary
  const installationStats = useMemo(() => {
    let installedUnits = 0;
    let pendingUnits = 0;
    let commissioningUnits = 0;
    let assessmentUnits = 0;
    let notInstalledUnits = 0;

    let installedItems = 0;
    let pendingItems = 0;
    let commissioningItems = 0;
    let assessmentItems = 0;
    let notInstalledItems = 0;

    let installedValuation = 0;
    let pendingValuation = 0;
    let commissioningValuation = 0;
    let assessmentValuation = 0;
    let notInstalledValuation = 0;

    items.forEach(item => {
      const status = item.installationStatus || 'Installed';
      const u = Number(item.qty) || 1;
      const v = Number(item.totalAmount) || (u * (item.unitPrice || 0));

      if (status === 'Installed') {
        installedUnits += u;
        installedItems++;
        installedValuation += v;
      } else if (status === 'Pending Installation') {
        pendingUnits += u;
        pendingItems++;
        pendingValuation += v;
      } else if (status === 'Under Commissioning') {
        commissioningUnits += u;
        commissioningItems++;
        commissioningValuation += v;
      } else if (status === 'Site Assessment') {
        assessmentUnits += u;
        assessmentItems++;
        assessmentValuation += v;
      } else {
        notInstalledUnits += u;
        notInstalledItems++;
        notInstalledValuation += v;
      }
    });

    const totalUnits = installedUnits + pendingUnits + commissioningUnits + assessmentUnits + notInstalledUnits || 1;
    const totalLineItems = items.length || 1;
    const totalValuation = installedValuation + pendingValuation + commissioningValuation + assessmentValuation + notInstalledValuation;

    const installedPct = Math.round((installedUnits / totalUnits) * 100);
    const pendingPct = Math.round((pendingUnits / totalUnits) * 100);
    const commissioningPct = Math.round((commissioningUnits / totalUnits) * 100);
    const assessmentPct = Math.round((assessmentUnits / totalUnits) * 100);
    const notInstalledPct = Math.max(0, 100 - (installedPct + pendingPct + commissioningPct + assessmentPct));

    return {
      totalUnits,
      totalLineItems,
      totalValuation,
      installedUnits,
      installedItems,
      installedValuation,
      installedPct,
      pendingUnits,
      pendingItems,
      pendingValuation,
      pendingPct,
      commissioningUnits,
      commissioningItems,
      commissioningValuation,
      commissioningPct,
      assessmentUnits,
      assessmentItems,
      assessmentValuation,
      assessmentPct,
      notInstalledUnits,
      notInstalledItems,
      notInstalledValuation,
      notInstalledPct
    };
  }, [items]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                Medical Device Installation Status & Progress
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                {installationStats.installedPct}% Installed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Total number of items by installation percentage, clinical site readiness, and active commissioning tasks.
            </p>
          </div>
        </div>

        {/* Dashboard Task View Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('installation-status-history-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 cursor-pointer"
            title="Scroll to 30-Day Installation Status History Line Chart"
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
            <span className="hidden sm:inline">30D Trend</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenTaskView('all')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition border shadow-xs text-white bg-indigo-700 hover:bg-indigo-800 border-indigo-800 cursor-pointer group"
            title="Click to open full dashboard task view and inspect installation equipment records"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-200 group-hover:scale-110 transition" />
            <span>Dashboard Task View</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-900 text-indigo-100 font-mono">
              {formatNumber(installationStats.totalLineItems)} Tasks
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Open in Master Inventory"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Inventory</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards: Total Installation by Percentage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Overall Installation Rate */}
        <div
          onClick={() => onOpenTaskView('Installed')}
          className="bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-white p-4.5 rounded-2xl border border-emerald-200 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Installed Devices
            </span>
            <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
              {installationStats.installedPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {formatNumber(installationStats.installedUnits)}
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">
              / {formatNumber(installationStats.totalUnits)} units
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">
              {formatNumber(installationStats.installedItems)} catalog items
            </span>
            <span className="text-emerald-700 font-semibold group-hover:underline flex items-center gap-0.5">
              <span>View data</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-emerald-100/70 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, installationStats.installedPct)}%` }}
            />
          </div>
        </div>

        {/* 2. Pending Installation */}
        <div
          onClick={() => onOpenTaskView('Pending Installation')}
          className="bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-white p-4.5 rounded-2xl border border-amber-200 shadow-2xs hover:border-amber-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Pending Installation
            </span>
            <span className="text-xs font-mono font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
              {installationStats.pendingPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {formatNumber(installationStats.pendingUnits)}
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">units queue</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">
              {formatNumber(installationStats.pendingItems)} catalog items
            </span>
            <span className="text-amber-700 font-semibold group-hover:underline flex items-center gap-0.5">
              <span>View data</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-amber-100/70 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, installationStats.pendingPct)}%` }}
            />
          </div>
        </div>

        {/* 3. Under Commissioning & Site Assessment */}
        <div
          onClick={() => onOpenTaskView('Under Commissioning')}
          className="bg-gradient-to-br from-blue-50/70 via-blue-50/30 to-white p-4.5 rounded-2xl border border-blue-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Commissioning / Assessment
            </span>
            <span className="text-xs font-mono font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
              {installationStats.commissioningPct + installationStats.assessmentPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              {formatNumber(installationStats.commissioningUnits + installationStats.assessmentUnits)}
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">active tests</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">
              {formatNumber(installationStats.commissioningItems + installationStats.assessmentItems)} catalog items
            </span>
            <span className="text-blue-700 font-semibold group-hover:underline flex items-center gap-0.5">
              <span>View data</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-blue-100/70 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, installationStats.commissioningPct + installationStats.assessmentPct)}%` }}
            />
          </div>
        </div>

        {/* 4. Total Operational Asset Valuation */}
        <div
          onClick={() => onOpenTaskView('Installed')}
          className="bg-gradient-to-br from-slate-50 via-indigo-50/20 to-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Installed Valuation
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
              ETB
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-mono font-extrabold text-indigo-950 truncate">
              {formatCurrency(installationStats.installedValuation, true)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">
              of {formatCurrency(installationStats.totalValuation, true)}
            </span>
            <span className="text-indigo-700 font-semibold group-hover:underline flex items-center gap-0.5">
              <span>View data</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, installationStats.installedPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Unified Installation Progress Bar Graphic */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-800">
              National Installation Distribution Analysis
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Total Base: <strong className="text-slate-800 font-mono">{formatNumber(installationStats.totalUnits)} units</strong>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Installed', units: installationStats.installedUnits, color: '#10b981' },
                { name: 'Pending', units: installationStats.pendingUnits, color: '#fbbf24' },
                { name: 'Commissioning', units: installationStats.commissioningUnits, color: '#3b82f6' },
                { name: 'Assessment', units: installationStats.assessmentUnits, color: '#a855f7' },
                { name: 'Not Installed', units: installationStats.notInstalledUnits, color: '#94a3b8' }
              ]}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(241, 245, 249, 0.8)' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                {[
                  { color: '#10b981' },
                  { color: '#fbbf24' },
                  { color: '#3b82f6' },
                  { color: '#a855f7' },
                  { color: '#94a3b8' }
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
