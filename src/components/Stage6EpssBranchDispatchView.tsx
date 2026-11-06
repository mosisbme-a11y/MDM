import React, { useState, useMemo } from 'react';
import {
  Building2,
  Truck,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageCircle,
  CheckCircle2,
  Clock,
  Search,
  Printer,
  Eye,
  Share2,
  Send,
  MapPin,
  Check,
  X,
  PackageCheck,
  Warehouse,
  ExternalLink,
  Copy,
  Table
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, HealthFacilityRecord } from '../types';
import { EPSS_HUBS_REGISTRY, EpssHubInfo, getHubByCode } from '../data/epssHubs';
import { formatNumber, formatCurrency } from '../utils/formatters';

interface Stage6EpssBranchDispatchViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems: HealthFacilityRecord[];
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

export const Stage6EpssBranchDispatchView: React.FC<Stage6EpssBranchDispatchViewProps> = ({
  records,
  setRecords,
  hfListItems = [],
  onTriggerCloudSync
}) => {
  // Stage 5 / Stage 6 records
  const stage5Records = useMemo(() => {
    return records.filter(r => r.stage === 'epss-ho-aggregation' || r.stage === 'moh-to-epss-ho');
  }, [records]);

  // Selected Dossier
  const currentDossier = useMemo(() => {
    return stage5Records[0] || null;
  }, [stage5Records]);

  // Equipment columns
  const equipmentColumns = useMemo(() => {
    if (currentDossier?.hubAggregationData?.columns && currentDossier.hubAggregationData.columns.length > 0) {
      return currentDossier.hubAggregationData.columns;
    }
    if (currentDossier?.stage4MatrixData?.columns && currentDossier.stage4MatrixData.columns.length > 0) {
      return currentDossier.stage4MatrixData.columns;
    }
    return [];
  }, [currentDossier]);

  // Allocations list
  const allocations = useMemo(() => {
    if (currentDossier?.hubAggregationData?.allocations && currentDossier.hubAggregationData.allocations.length > 0) {
      return currentDossier.hubAggregationData.allocations;
    }
    const sourceRows = currentDossier?.stage4MatrixData?.rows || [];
    return sourceRows.map((r: any, idx: number) => {
      const match = getHubByCode(r.hubCode || 'AD01') || EPSS_HUBS_REGISTRY[0];
      const quantities = r.quantities || {};
      const totalQty = Object.values(quantities).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0) as number;
      return {
        id: r.id || `alloc-s6-${idx}`,
        healthFacility: r.healthFacility || 'Health Facility',
        region: r.region || 'Oromia',
        zone: r.zone || 'Central Zone',
        woreda: r.woreda || 'Woreda 01',
        packages: r.packages || 'MCH',
        hubCode: match.code,
        hubName: match.name,
        quantities,
        totalQty: totalQty || 12
      };
    });
  }, [currentDossier]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((item: any) => {
      const matchesSearch =
        item.healthFacility.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.woreda.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.hubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.region.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesHub = selectedHubFilter === 'all' || item.hubCode === selectedHubFilter;
      return matchesSearch && matchesHub;
    });
  }, [allocations, searchQuery, selectedHubFilter]);

  // Export Excel
  const handleExportExcel = () => {
    const row1 = [
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'Hub',
      'List of Packeges',
      ...equipmentColumns.map((c: any) => c.name),
      'Total'
    ];
    const row2 = [
      '',
      '',
      '',
      '',
      '',
      'List of Packeges',
      ...equipmentColumns.map((c: any) => c.code),
      ''
    ];
    const dataRows = allocations.map((item: any) => [
      item.region,
      item.zone,
      item.woreda,
      item.healthFacility,
      `${item.hubName} (${item.hubCode})`,
      item.packages,
      ...equipmentColumns.map((c: any) => item.quantities[c.id] || 0),
      item.totalQty
    ]);

    const ws = XLSX.utils.aoa_to_sheet([row1, row2, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MOH_EPSS_Branch_Matrix');
    XLSX.writeFile(wb, `EPSS_Branch_Dispatched_Aggregated_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`);

    setNotification({
      type: 'success',
      message: 'Exported MOH to EPSS Aggregated Equipment Breakdown Matrix (.xlsx) for branch dispatch successfully!'
    });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDispatchEmail = () => {
    const subject = `EPSS HO to Branch Dispatched Aggregated Matrix (${allocations.length} Health Facilities)`;
    const body = `Dear EPSS Regional Branch Management,\n\nPlease find attached the official MOH to EPSS Aggregated Equipment Breakdown Matrix dispatched from Head Office.\n\nTotal Facilities: ${allocations.length}\nTotal Units: ${allocations.reduce((acc: number, a: any) => acc + a.totalQty, 0).toLocaleString()}\n\nPlease verify local warehouse receiving and stock transport orders.\n\nEPSS Head Office Logistics`;
    window.open(`mailto:branches@epss.gov.et?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setNotification({ type: 'success', message: 'Opened email client for branch dispatch of aggregated matrix!' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDispatchWhatsApp = () => {
    const text = `EPSS HO Dispatched Aggregated Matrix: ${allocations.length} Health Facilities with ${allocations.reduce((acc: number, a: any) => acc + a.totalQty, 0).toLocaleString()} total units ready for branch delivery. Please check STO.`;
    window.open(`https://wa.me/+251911000000?text=${encodeURIComponent(text)}`, '_blank');
    setNotification({ type: 'success', message: 'Opened WhatsApp for branch dispatch!' });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Notification Toast */}
      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Stage 6 Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-rose-800/40 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-lg">6. DSP Submitted EPSS.HO to Plant</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                  MOH to EPSS Aggregated Equipment Breakdown Matrix
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Official aggregated health facility allocation matrix sent from EPSS Head Office to regional branch warehouses.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Export Matrix Excel</span>
            </button>
            <button
              onClick={handleDispatchEmail}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send via Email</span>
            </button>
            <button
              onClick={handleDispatchWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, zone, woreda, hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all"
            />
          </div>

          <select
            value={selectedHubFilter}
            onChange={(e) => setSelectedHubFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer shadow-sm"
          >
            <option value="all">All Mapped Hubs ({EPSS_HUBS_REGISTRY.length})</option>
            {EPSS_HUBS_REGISTRY.map(hub => (
              <option key={hub.code} value={hub.code}>{hub.name} ({hub.code})</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing <strong>{filteredAllocations.length}</strong> of {allocations.length} Facilities
        </div>
      </div>

      {/* THE EXACT SPREADSHEET MATRIX TABLE */}
      <div className="bg-white border-2 border-slate-400 rounded-xl shadow-md overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">MOH to EPSS Aggregated Equipment Breakdown Matrix (Branch Dispatched)</span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left border-collapse select-text">
            <thead>
              {/* TIER 1 HEADER ROW */}
              <tr className="text-xs font-semibold">
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[110px]">Region</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px]">Zone</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[110px]">Woreda</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[220px]">Name of health facility</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[190px] font-bold">Hub</th>
                <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px]">List of Packeges</th>

                {equipmentColumns.map((col: any) => (
                  <th key={col.id} className="bg-[#fed7aa] text-slate-900 font-normal border border-slate-400 py-2 px-2 text-center min-w-[130px] leading-tight">
                    {col.name}
                  </th>
                ))}

                <th className="bg-[#fde047]/60 text-slate-900 font-bold border border-slate-400 py-2 px-2 text-center min-w-[70px]">Total</th>
              </tr>

              {/* TIER 2 SUBHEADER ROW */}
              <tr className="text-xs font-normal">
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-1 px-3 text-left font-normal text-[11px]">List of Packeges</th>

                {equipmentColumns.map((col: any) => (
                  <th key={`code-${col.id}`} className="bg-white text-slate-800 font-mono text-[10px] border border-slate-400 py-1 px-2 text-center font-normal">
                    {col.code}
                  </th>
                ))}

                <th className="bg-[#fde047]/60 border border-slate-400 py-1 px-2"></th>
              </tr>
            </thead>

            <tbody className="text-xs text-slate-900">
              {filteredAllocations.length > 0 ? (
                filteredAllocations.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className={`transition-colors hover:bg-amber-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                    <td className="py-2 px-3 border border-slate-300 font-medium text-slate-800">{item.region}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{item.zone}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700 font-mono text-[11px]">{item.woreda}</td>
                    <td className="py-2 px-3 border border-slate-300 font-semibold text-slate-900">{item.healthFacility}</td>
                    <td className="py-2 px-3 border border-slate-300 bg-amber-50/30 font-bold text-slate-800">
                      {item.hubName} ({item.hubCode})
                    </td>
                    <td className="py-2 px-3 border border-slate-300 bg-[#eff6ff] text-slate-800 font-semibold text-center">{item.packages}</td>

                    {equipmentColumns.map((col: any) => {
                      const qty = item.quantities[col.id] ?? 0;
                      return (
                        <td key={col.id} className="py-1 px-1 border border-slate-300 text-center font-mono font-bold text-slate-800">
                          {qty}
                        </td>
                      );
                    })}

                    <td className="py-2 px-2 border border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/50">
                      {item.totalQty}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={equipmentColumns.length + 7} className="py-12 text-center text-slate-400">
                    <Table className="w-8 h-8 mx-auto mb-2 opacity-40 text-rose-500" />
                    <p className="font-semibold text-slate-600 text-sm">No health facilities found matching filters.</p>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-500 text-xs">
                <td className="py-3 px-3 uppercase tracking-wider font-mono text-[11px]" colSpan={4}>
                  NATIONAL GRAND TOTAL ({allocations.length} Facilities)
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-amber-300">EPSS Hub Mapped</td>
                <td className="py-3 px-3 text-center text-slate-300 font-semibold bg-slate-800">All Packages</td>

                {equipmentColumns.map((col: any) => {
                  const colTotal = allocations.reduce((sum: number, a: any) => sum + (Number(a.quantities[col.id]) || 0), 0);
                  return (
                    <td key={`sum-${col.id}`} className="py-3 px-2 text-center font-mono font-black text-amber-300 border-r border-slate-700">
                      {colTotal}
                    </td>
                  );
                })}

                <td className="py-3 px-2 text-center font-mono font-black text-emerald-400 bg-slate-950 text-sm">
                  {allocations.reduce((sum: number, a: any) => sum + a.totalQty, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
