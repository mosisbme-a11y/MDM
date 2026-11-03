import React, { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  FileCheck
} from 'lucide-react';
import { MedicalDeviceAgreement, EpssSubTab } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

interface ContractManagementViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (subTab: EpssSubTab) => void;
  items?: any[];
  onSelectItem?: (item: any) => void;
}

export const ContractManagementView: React.FC<ContractManagementViewProps> = ({
  currentSubTab,
  onSelectSubTab,
  items = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const contracts = useMemo(() => [
    {
      id: 'cont-001',
      contractNumber: 'AGR-EPSS-2026-PKG1-MDR',
      title: 'Mindray Advanced Diagnostic Imaging & Ultrasound Framework Agreement',
      supplier: 'Mindray Bio-Medical Electronics Co.',
      supplierCountry: 'China / East Africa Hub',
      packageType: 'Imaging & Radiology',
      fundingSource: 'Revolving Drug Fund (RDF)',
      signedDate: '2025-08-15',
      validUntil: '2028-08-15',
      totalValueETB: 148000000,
      disbursedValueETB: 127700000,
      status: 'Active',
      slaScore: 96,
      warrantyMonths: 36,
      manager: 'Dr. Zhang Wei / Eng. Dawit Alemu'
    },
    {
      id: 'cont-002',
      contractNumber: 'AGR-MOH-GF-2026-PKG2-ICU',
      title: 'Critical Care ICU Ventilators & Multipara Patient Monitors Accord',
      supplier: 'GE Healthcare / Draeger Medical AG',
      supplierCountry: 'Germany / USA',
      packageType: 'ICU & Life Support',
      fundingSource: 'Global Fund (GFATM)',
      signedDate: '2025-09-01',
      validUntil: '2027-09-01',
      totalValueETB: 195500000,
      disbursedValueETB: 166600000,
      status: 'Active',
      slaScore: 94,
      warrantyMonths: 24,
      manager: 'Klaus Reinhardt / Eng. Bethelhem Tadesse'
    },
    {
      id: 'cont-003',
      contractNumber: 'AGR-RDF-LAB-2025-RCH',
      title: 'National Automated Clinical Chemistry & Hematology Analyzers Accord',
      supplier: 'Roche Diagnostics GmbH & Sysmex',
      supplierCountry: 'Switzerland / Japan',
      packageType: 'Laboratory & Diagnostics',
      fundingSource: 'Revolving Drug Fund (RDF)',
      signedDate: '2025-05-10',
      validUntil: '2028-05-10',
      totalValueETB: 162000000,
      disbursedValueETB: 162000000,
      status: 'Fully Fulfilled',
      slaScore: 99,
      warrantyMonths: 36,
      manager: 'Marc Van Der Berg / Dr. Samuel Kebede'
    }
  ], []);

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchSearch = c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [contracts, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Outbound Contract Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage framework agreements, supplier SLAs, contract valuations, and validity milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV('outbound_contracts.csv', filteredContracts)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Contracts
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contract number, supplier or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="fully fulfilled">Fully Fulfilled</option>
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="p-3 font-bold">Contract Number & Title</th>
                <th className="p-3 font-bold">Supplier / Vendor</th>
                <th className="p-3 font-bold">Package & Funding</th>
                <th className="p-3 font-bold text-right">Total Contract Value</th>
                <th className="p-3 font-bold text-center">SLA Score</th>
                <th className="p-3 font-bold text-center">Warranty</th>
                <th className="p-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredContracts.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3">
                    <span className="font-mono font-bold text-cyan-400 block">{c.contractNumber}</span>
                    <span className="font-semibold text-slate-200">{c.title}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-white block">{c.supplier}</span>
                    <span className="text-[10px] text-slate-400">{c.supplierCountry}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-slate-200 block">{c.packageType}</span>
                    <span className="text-[10px] text-emerald-400">{c.fundingSource}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-white">
                    {formatCurrency(c.totalValueETB)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold text-[10px] border border-emerald-800">
                      {c.slaScore}% SLA
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono text-slate-300">
                    {c.warrantyMonths} Mos
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 font-bold text-[10px] border border-blue-800">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
