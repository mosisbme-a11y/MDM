import React from 'react';
import { Layers, Upload, X, Search } from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatNumber, formatCurrency } from '../utils/formatters';

interface SohModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  search: string;
  onSearchChange: (s: string) => void;
  branchFilter: string;
  onBranchChange: (b: string) => void;
  rdfFilter: string;
  onRdfChange: (r: string) => void;
  progFilter: string;
  onProgChange: (p: string) => void;
  branchList: string[];
  rdfList: string[];
  progList: string[];
  stats: {
    units: number;
    valuation: number;
    lineItems: number;
    branchCount: number;
  };
  onOpenMultiUpload: () => void;
}

export const SohModal: React.FC<SohModalProps> = ({
  isOpen,
  onClose,
  items,
  search,
  onSearchChange,
  branchFilter,
  onBranchChange,
  rdfFilter,
  onRdfChange,
  progFilter,
  onProgChange,
  branchList,
  rdfList,
  progList,
  stats,
  onOpenMultiUpload
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-tight">STOCK ON HAND (SOH) ANALYSIS</h3>
              <p className="text-xs text-blue-100">
                Real-time stock levels filtered by Branch, RDF, and Program for strategic distribution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMultiUpload}
              className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-[10px] font-bold hover:bg-blue-600 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Multi-Upload SOH Analysis</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-100">
          <div className="p-4 border-r border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total SOH Units</span>
            <div className="text-xl font-black text-slate-900">{formatNumber(stats.units)}</div>
          </div>
          <div className="p-4 border-r border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Valuation</span>
            <div className="text-xl font-black text-blue-900">{formatCurrency(stats.valuation, true)}</div>
          </div>
          <div className="p-4 border-r border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Line Items</span>
            <div className="text-xl font-black text-slate-900">{formatNumber(stats.lineItems)}</div>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Active Branches</span>
            <div className="text-xl font-black text-slate-900">{stats.branchCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search Device / Code</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, material code..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Branch / Hub</label>
            <select
              value={branchFilter}
              onChange={(e) => onBranchChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
            >
              <option value="all">All Branches</option>
              {branchList.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RDF Number</label>
            <select
              value={rdfFilter}
              onChange={(e) => onRdfChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
            >
              <option value="all">All RDF</option>
              {rdfList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Program</label>
            <select
              value={progFilter}
              onChange={(e) => onProgChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
            >
              <option value="all">All Programs</option>
              {progList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-white z-10 shadow-xs">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold text-slate-600">Material Description</th>
                <th className="py-3 px-4 text-left font-bold text-slate-600">Code</th>
                <th className="py-3 px-4 text-left font-bold text-slate-600">Branch/Hub</th>
                <th className="py-3 px-4 text-right font-bold text-slate-600">Qty</th>
                <th className="py-3 px-4 text-right font-bold text-slate-600">Valuation (ETB)</th>
                <th className="py-3 px-4 text-left font-bold text-slate-600">RDF</th>
                <th className="py-3 px-4 text-left font-bold text-slate-600">Program</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="font-bold">No SOH items match these filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.materialDescription}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 uppercase">{item.material}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {item.plantName}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatNumber(item.qty)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-800">
                      {formatCurrency(item.totalAmount || (item.qty * (item.unitPrice || 0)), true)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-slate-600">{item.rdfNumber || '-'}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-100">
                        {item.programName || 'General'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 font-medium italic">
            Total Displayed: {items.length} records • Cumulative SOH Valuation: {formatCurrency(stats.valuation)}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
