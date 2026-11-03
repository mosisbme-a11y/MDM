import React, { useState, useMemo } from 'react';
import {
  Package,
  Users,
  BarChart2,
  PackageCheck,
  Search,
  Filter,
  ArrowRight,
  Download,
  CheckCircle2,
  Building2,
  Globe,
  FileText,
  DollarSign
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

interface DonationManagementViewProps {
  currentSubTab?: string;
  onSelectSubTab?: (subTab: any) => void;
  items: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
}

export const DonationManagementView: React.FC<DonationManagementViewProps> = ({
  currentSubTab = 'donation-receiving-status',
  onSelectSubTab,
  items = [],
  onSelectItem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const activeTab = currentSubTab || 'donation-receiving-status';

  // Receiving Status Records
  const receivingRecords = useMemo(() => {
    return items.slice(0, 60).map((item, idx) => ({
      id: `don-rec-${idx + 1}`,
      grnNumber: `GRN-DON-${5000 + idx}`,
      donorName: idx % 4 === 0 ? 'WHO Ethiopia' : idx % 4 === 1 ? 'Global Fund' : idx % 4 === 2 ? 'UNICEF' : 'USAID / GHSC',
      receivedBody: item.plantName || item.plant || 'National Pharmaceutical Warehouse',
      materialCode: item.material,
      materialDescription: item.materialDescription,
      qtyReceived: item.qty || 10,
      estimatedValue: (item.qty || 10) * 1500,
      receivingDate: `2026-03-${(idx % 25) + 1 < 10 ? '0' + ((idx % 25) + 1) : (idx % 25) + 1}`,
      status: idx % 5 === 0 ? 'Pending Inspection' : 'Verified & Cleared'
    }));
  }, [items]);

  // Donor and Received Body Records
  const donorBodyRecords = useMemo(() => {
    return [
      { id: 'db-1', donor: 'World Health Organization (WHO)', receivedBody: 'Federal Ministry of Health & EPSS', contactPerson: 'Dr. Abebe Kebede', totalShipments: 14, totalValuation: 45000000, status: 'Active Agreement' },
      { id: 'db-2', donor: 'Global Fund to Fight AIDS, TB and Malaria', receivedBody: 'EPSA Central Hub', contactPerson: 'Sarah Jenkins', totalShipments: 28, totalValuation: 120000000, status: 'Active Agreement' },
      { id: 'db-3', donor: 'UNICEF Ethiopia', receivedBody: 'Regional Health Bureaus', contactPerson: 'Michael Tadesse', totalShipments: 19, totalValuation: 34000000, status: 'Active Agreement' },
      { id: 'db-4', donor: 'USAID / GHSC-PSM', receivedBody: 'St. Peter Specialized Hospital', contactPerson: 'Hanna Mulugeta', totalShipments: 22, totalValuation: 78000000, status: 'Active Agreement' },
      { id: 'db-5', donor: 'Clinton Health Access Initiative (CHAI)', receivedBody: 'Black Lion Specialized Hospital', contactPerson: 'Dawit Bekele', totalShipments: 8, totalValuation: 19500000, status: 'Completed' },
      { id: 'db-6', donor: 'Red Cross International', receivedBody: 'Emergency Response Warehouses', contactPerson: 'Fatuma Ahmed', totalShipments: 12, totalValuation: 25000000, status: 'Active Agreement' }
    ];
  }, []);

  // Filtered receiving records
  const filteredReceiving = useMemo(() => {
    return receivingRecords.filter(rec => {
      const matchSearch =
        rec.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.grnNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || rec.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [receivingRecords, searchTerm, statusFilter]);

  const totalDonationValuation = useMemo(() => {
    return donorBodyRecords.reduce((acc, curr) => acc + curr.totalValuation, 0);
  }, [donorBodyRecords]);

  const totalDonationShipments = useMemo(() => {
    return donorBodyRecords.reduce((acc, curr) => acc + curr.totalShipments, 0);
  }, [donorBodyRecords]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 text-slate-900 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  Donation MD Management
                </span>
                <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold border border-cyan-200 font-mono">
                  Inbound Operation Module
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Donated Medical Devices & Consumables Operations
              </h2>
              <p className="text-slate-500 text-xs mt-1 max-w-2xl leading-relaxed">
                Comprehensive tracking of incoming donations, partner donor organizations, receiving institutions, and valuation analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-left shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold uppercase">Total Valuation</span>
              <span className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(totalDonationValuation)}</span>
            </div>
            <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-left shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold uppercase">Total Shipments</span>
              <span className="text-xl font-bold text-cyan-700 font-mono">{totalDonationShipments}</span>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Switcher Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => onSelectSubTab?.('donation-receiving-status')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'donation-receiving-status'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>Receiving Status</span>
          </button>

          <button
            onClick={() => onSelectSubTab?.('donation-donor-body')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'donation-donor-body'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>Donor and received body</span>
          </button>

          <button
            onClick={() => onSelectSubTab?.('donation-analysis')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'donation-analysis'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-purple-600" />
            <span>Donation Analysis</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RECEIVING STATUS */}
      {activeTab === 'donation-receiving-status' && (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search GRN, donor, or medical device..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 text-slate-300 px-3 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Inspection Statuses</option>
                <option value="Verified & Cleared">Verified & Cleared</option>
                <option value="Pending Inspection">Pending Inspection</option>
              </select>

              <button
                onClick={() => downloadCSV('donation_receiving_status.csv', receivingRecords)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <th className="p-4">GRN & Date</th>
                    <th className="p-4">Donor Organization</th>
                    <th className="p-4">Receiving Institution</th>
                    <th className="p-4">Material / Description</th>
                    <th className="p-4 text-right">Qty Received</th>
                    <th className="p-4 text-right">Estimated Value</th>
                    <th className="p-4 text-center">Inspection Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredReceiving.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <span className="font-mono font-bold text-emerald-400 block">{rec.grnNumber}</span>
                        <span className="text-[10px] text-slate-400">{rec.receivingDate}</span>
                      </td>
                      <td className="p-4 font-semibold text-white">{rec.donorName}</td>
                      <td className="p-4 text-slate-300">{rec.receivedBody}</td>
                      <td className="p-4">
                        <span className="font-mono text-cyan-400 block text-[11px]">{rec.materialCode}</span>
                        <span className="text-slate-300 truncate max-w-xs block">{rec.materialDescription}</span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-white">{formatNumber(rec.qtyReceived)}</td>
                      <td className="p-4 text-right font-mono text-emerald-400 font-semibold">{formatCurrency(rec.estimatedValue)}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          rec.status === 'Verified & Cleared'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DONOR AND RECEIVED BODY */}
      {activeTab === 'donation-donor-body' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {donorBodyRecords.map((org) => (
              <div key={org.id} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400">
                      <Globe className="w-5 h-5" />
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      org.status === 'Active Agreement'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {org.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{org.donor}</h3>
                  <p className="text-xs text-slate-400 mb-4 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Received by: <span className="text-slate-200 font-medium">{org.receivedBody}</span>
                  </p>
                  <div className="text-xs text-slate-300 space-y-1.5 py-2 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contact Person:</span>
                      <span className="font-semibold text-white">{org.contactPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Shipments:</span>
                      <span className="font-mono text-cyan-400 font-bold">{org.totalShipments} Batches</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Valuation:</span>
                  <span className="text-sm font-black font-mono text-emerald-400">{formatCurrency(org.totalValuation)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DONATION ANALYSIS */}
      {activeTab === 'donation-analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" /> Donation Valuation Share by Partner
            </h3>
            <div className="space-y-3">
              {donorBodyRecords.map((org) => {
                const percentage = Math.round((org.totalValuation / totalDonationValuation) * 100);
                return (
                  <div key={org.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">{org.donor}</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(org.totalValuation)} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" /> Donation Performance Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Donors</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">{donorBodyRecords.length} Partners</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Shipments</span>
                <span className="text-2xl font-black font-mono text-cyan-400 mt-1 block">{totalDonationShipments} Batches</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Verified & Cleared</span>
                <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">94.5%</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg Shipment Value</span>
                <span className="text-2xl font-black font-mono text-amber-400 mt-1 block">{formatCurrency(totalDonationValuation / totalDonationShipments)}</span>
              </div>
            </div>
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
              Donated medical devices account for approximately 38% of total inbound medical equipment received in national pharmaceutical warehouses during 2026.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
