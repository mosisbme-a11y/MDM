import React from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  Mail,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Package
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatNumber, formatCurrency } from '../utils/formatters';

interface ExpiringItemDetail extends MedicalDeviceItem {
  daysRemaining: number;
  expiryUrgency: 'expired' | 'critical' | 'warning' | 'notice';
  formattedExpiry: string;
}

interface DashboardAlertsTabProps {
  items: MedicalDeviceItem[];
  lowStockThreshold: number;
  setLowStockThreshold: (t: number) => void;
  procurementSearch: string;
  setProcurementSearch: (s: string) => void;
  filteredLowStockItems: MedicalDeviceItem[];
  setSelectedProcurementItem: (item: MedicalDeviceItem | 'BULK') => void;
  expiryFilterDays: number;
  setExpiryFilterDays: (d: number) => void;
  expirySearch: string;
  setExpirySearch: (s: string) => void;
  expiryUrgencyFilter: string;
  setExpiryUrgencyFilter: (f: string) => void;
  filteredExpiringItems: ExpiringItemDetail[];
  setSelectedExpiryItem: (item: ExpiringItemDetail | 'BULK_EXPIRY') => void;
  expiryCounts: {
    expired: number;
    critical: number;
    warning: number;
    notice: number;
    total: number;
  };
  onNavigateTab?: (tab: string) => void;
}

export const DashboardAlertsTab: React.FC<DashboardAlertsTabProps> = ({
  items,
  lowStockThreshold,
  setLowStockThreshold,
  procurementSearch,
  setProcurementSearch,
  filteredLowStockItems,
  setSelectedProcurementItem,
  expiryFilterDays,
  setExpiryFilterDays,
  expirySearch,
  setExpirySearch,
  expiryUrgencyFilter,
  setExpiryUrgencyFilter,
  filteredExpiringItems,
  setSelectedExpiryItem,
  expiryCounts,
  onNavigateTab
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      {/* 1. Low Stock & Urgent Procurement Requests */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Low Stock Alert & Procurement</h3>
                <p className="text-xs text-slate-500">Urgent restocking requests for hubs below buffer thresholds</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedProcurementItem('BULK')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Bulk Procurement ({filteredLowStockItems.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 my-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search low stock equipment or hub..."
                value={procurementSearch}
                onChange={(e) => setProcurementSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Threshold:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[3, 5, 10, 20].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLowStockThreshold(num)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      lowStockThreshold === num ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ≤ {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredLowStockItems.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Stock Levels Optimal</p>
                <p className="text-[11px] text-slate-400">No medical devices found below threshold of {lowStockThreshold} units</p>
              </div>
            ) : (
              filteredLowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-50/70 hover:bg-rose-50/40 rounded-xl border border-slate-200 hover:border-rose-200 transition flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        {item.materialDescription}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold shrink-0">
                        {item.material}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>Hub: <strong className="text-slate-700 font-sans">{item.plantName || item.plant}</strong></span>
                      <span>•</span>
                      <span>Batch: <strong className="text-slate-700">{item.batch || 'N/A'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-black text-rose-600 font-mono block">
                        {item.qty} {item.qty === 1 ? 'unit' : 'units'}
                      </span>
                      <span className="text-[10px] text-slate-400">Remaining</span>
                    </div>

                    <button
                      onClick={() => setSelectedProcurementItem(item)}
                      className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 transition cursor-pointer shadow-xs"
                      title="Generate Reorder Notice"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Expiry Notification & Shelf-Life Horizon */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Shelf-Life & Expiry Watch</h3>
                <p className="text-xs text-slate-500">Proactive QA monitoring and recall prevention protocols</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedExpiryItem('BULK_EXPIRY')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>QA Bulk Notice ({filteredExpiringItems.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 my-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expiring batch or material..."
                value={expirySearch}
                onChange={(e) => setExpirySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Horizon:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[30, 60, 90, 180].map((days) => (
                  <button
                    key={days}
                    onClick={() => setExpiryFilterDays(days)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      expiryFilterDays === days ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Summary Counts */}
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div
              onClick={() => setExpiryUrgencyFilter(expiryUrgencyFilter === 'expired' ? 'all' : 'expired')}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                expiryUrgencyFilter === 'expired' ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-rose-50/50 border-rose-200 text-rose-700'
              }`}
            >
              <span className="text-[10px] font-bold block">Expired</span>
              <span className="text-sm font-black font-mono">{expiryCounts.expired}</span>
            </div>
            <div
              onClick={() => setExpiryUrgencyFilter(expiryUrgencyFilter === 'critical' ? 'all' : 'critical')}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                expiryUrgencyFilter === 'critical' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-amber-50/50 border-amber-200 text-amber-700'
              }`}
            >
              <span className="text-[10px] font-bold block">≤ 30 Days</span>
              <span className="text-sm font-black font-mono">{expiryCounts.critical}</span>
            </div>
            <div
              onClick={() => setExpiryUrgencyFilter(expiryUrgencyFilter === 'warning' ? 'all' : 'warning')}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                expiryUrgencyFilter === 'warning' ? 'bg-yellow-100 border-yellow-300 text-yellow-900' : 'bg-yellow-50/50 border-yellow-200 text-yellow-700'
              }`}
            >
              <span className="text-[10px] font-bold block">≤ 60 Days</span>
              <span className="text-sm font-black font-mono">{expiryCounts.warning}</span>
            </div>
            <div
              onClick={() => setExpiryUrgencyFilter(expiryUrgencyFilter === 'notice' ? 'all' : 'notice')}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                expiryUrgencyFilter === 'notice' ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-blue-50/50 border-blue-200 text-blue-700'
              }`}
            >
              <span className="text-[10px] font-bold block">≤ 90 Days</span>
              <span className="text-sm font-black font-mono">{expiryCounts.notice}</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filteredExpiringItems.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Imminent Expiries</p>
                <p className="text-[11px] text-slate-400">All registered batches are valid within the {expiryFilterDays}-day horizon</p>
              </div>
            ) : (
              filteredExpiringItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50/70 hover:bg-amber-50/40 rounded-xl border border-slate-200 hover:border-amber-200 transition flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        {item.materialDescription}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        item.expiryUrgency === 'expired' ? 'bg-rose-100 text-rose-800' :
                        item.expiryUrgency === 'critical' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.daysRemaining < 0 ? 'Expired' : `${item.daysRemaining} days left`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>Batch: <strong className="text-slate-700">{item.batch || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Exp: <strong className="text-slate-700">{item.formattedExpiry}</strong></span>
                      <span>•</span>
                      <span>Hub: <strong className="text-slate-700 font-sans">{item.plantName || item.plant}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 font-mono block">
                        {item.qty} units
                      </span>
                      <span className="text-[10px] text-slate-400">{formatCurrency(item.totalAmount || (item.qty * (item.unitPrice || 0)), true)}</span>
                    </div>

                    <button
                      onClick={() => setSelectedExpiryItem(item)}
                      className="p-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 transition cursor-pointer shadow-xs"
                      title="Send QA Expiry Notice"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
