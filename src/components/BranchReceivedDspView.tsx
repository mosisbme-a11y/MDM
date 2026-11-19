import React, { useState, useMemo, useEffect } from 'react';
import {
  Warehouse,
  Search,
  Download,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Building2,
  BarChart3,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord } from '../types';
import { formatNumber } from '../utils/formatters';
import { canonicalizeSubStage, isDossierInTier } from '../data/defaultDspWorkflows';
import { getHubByCode } from '../data/epssHubs';

interface BranchReceivedDspViewProps {
  records: DspWorkflowRecord[];
  multipleStockItems?: MultipleStockRecord[];
  mode: '4.1' | '4.2';
  onSelectSubTab?: (tab: EpssSubTab) => void;
}

interface BranchColumn {
  id: string;
  name: string;
  code: string;
}

interface BranchAllocationRow {
  id: string;
  date: string;
  region: string;
  zone: string;
  woreda: string;
  healthFacility: string;
  packages: string;
  hubCode: string;
  hubName: string;
  quantities: Record<string, number>;
  totalQty: number;
}

export const BranchReceivedDspView: React.FC<BranchReceivedDspViewProps> = ({
  records,
  multipleStockItems = [],
  mode,
  onSelectSubTab
}) => {
  const branchRecords = useMemo(() => {
    return records
      .filter(r => {
        const sub = canonicalizeSubStage(r.subStage, r.stage);
        return isDossierInTier(r, 'branches-dsp-management') && (sub === '4.1' || sub === '4.2');
      })
      .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records]);

  const [selectedDossierId, setSelectedDossierId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState('all');

  useEffect(() => {
    if (branchRecords.length > 0 && !branchRecords.some(r => r.id === selectedDossierId)) {
      setSelectedDossierId(branchRecords[0].id);
    } else if (branchRecords.length === 0 && selectedDossierId) {
      setSelectedDossierId('');
    }
  }, [branchRecords, selectedDossierId]);

  const activeDossier = useMemo(() => {
    return branchRecords.find(r => r.id === selectedDossierId) || branchRecords[0] || null;
  }, [branchRecords, selectedDossierId]);

  const columns = useMemo<BranchColumn[]>(() => {
    if (activeDossier?.hubAggregationData?.columns?.length) {
      return activeDossier.hubAggregationData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    if (activeDossier?.facilityMatrixData?.columns?.length) {
      return activeDossier.facilityMatrixData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    if (activeDossier?.stage4MatrixData?.columns?.length) {
      return activeDossier.stage4MatrixData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    return [];
  }, [activeDossier]);

  const allocations = useMemo<BranchAllocationRow[]>(() => {
    if (activeDossier?.hubAggregationData?.allocations?.length) {
      return activeDossier.hubAggregationData.allocations.map((a: any, idx: number) => ({
        id: a.id || `br-alloc-${idx}`,
        date: activeDossier.dateSubmitted,
        region: a.region || 'Unspecified',
        zone: a.zone || '-',
        woreda: a.woreda || '-',
        healthFacility: a.healthFacility,
        packages: a.packages || 'MCH',
        hubCode: a.hubCode || 'AA01',
        hubName: a.hubName || getHubByCode(a.hubCode)?.name || a.hubCode || 'AA01',
        quantities: a.quantities || {},
        totalQty: Number(a.totalQty) || 0
      }));
    }

    const rows =
      activeDossier?.facilityMatrixData?.rows ||
      activeDossier?.stage4MatrixData?.rows ||
      [];

    return rows.map((r: any, idx: number) => {
      const hubCode = r.hub || r.plant || 'AA01';
      const hubInfo = getHubByCode(hubCode);
      const quantities: Record<string, number> = r.quantities || {};
      const totalQty = columns.reduce((s, c) => s + (Number(quantities[c.id]) || 0), 0);
      return {
        id: r.id || `br-row-${idx}`,
        date: r.date || activeDossier?.dateSubmitted || '',
        region: r.region || 'Unspecified',
        zone: r.zone || '-',
        woreda: r.woreda || '-',
        healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
        packages: r.packages || 'MCH',
        hubCode,
        hubName: hubInfo?.name || hubCode,
        quantities,
        totalQty
      };
    });
  }, [activeDossier, columns]);

  const uniqueHubs = useMemo(() => {
    const map = new Map<string, string>();
    allocations.forEach(a => {
      if (a.hubCode) map.set(a.hubCode, a.hubName || a.hubCode);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allocations.filter(a => {
      const matchHub = selectedHubFilter === 'all' || a.hubCode === selectedHubFilter;
      const matchSearch =
        !q ||
        a.healthFacility.toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q) ||
        a.zone.toLowerCase().includes(q) ||
        a.woreda.toLowerCase().includes(q) ||
        a.hubCode.toLowerCase().includes(q) ||
        a.hubName.toLowerCase().includes(q);
      return matchHub && matchSearch;
    });
  }, [allocations, selectedHubFilter, searchQuery]);

  // 4.2 Comparison rows: group dispatched units by (hubCode, materialCode) vs MultipleStock SOH
  const comparisonRows = useMemo(() => {
    if (mode !== '4.2' || !activeDossier) return [];

    // Pre-index SOH by plant+material and national material
    const sohByPlantMat = new Map<string, number>();
    const sohByMat = new Map<string, number>();

    multipleStockItems.forEach(item => {
      const mat = (item.material || '').trim().toUpperCase();
      const plant = (item.plant || '').trim().toUpperCase();
      const stock = Number(item.unrestrictedStock) || 0;
      if (mat) {
        sohByMat.set(mat, (sohByMat.get(mat) || 0) + stock);
        if (plant) {
          const key = `${plant}:::${mat}`;
          sohByPlantMat.set(key, (sohByPlantMat.get(key) || 0) + stock);
        }
      }
    });

    const grouped = new Map<
      string,
      {
        hubCode: string;
        hubName: string;
        material: string;
        description: string;
        dspQty: number;
        facilityCount: number;
      }
    >();

    filteredAllocations.forEach(a => {
      columns.forEach(col => {
        const qty = Number(a.quantities[col.id]) || 0;
        if (qty <= 0) return;
        const key = `${a.hubCode}:::${col.code}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.dspQty += qty;
          existing.facilityCount += 1;
        } else {
          grouped.set(key, {
            hubCode: a.hubCode,
            hubName: a.hubName,
            material: col.code,
            description: col.name,
            dspQty: qty,
            facilityCount: 1
          });
        }
      });
    });

    return Array.from(grouped.values()).map((row, idx) => {
      const matUpper = row.material.trim().toUpperCase();
      const plantUpper = row.hubCode.trim().toUpperCase();
      const branchSoh = sohByPlantMat.get(`${plantUpper}:::${matUpper}`) || 0;
      const nationalSoh = sohByMat.get(matUpper) || 0;
      const variance = branchSoh - row.dspQty;
      const status: 'Sufficient' | 'Shortage' = variance >= 0 ? 'Sufficient' : 'Shortage';

      return {
        id: `cmp-${idx}-${row.hubCode}-${row.material}`,
        ...row,
        branchSoh,
        nationalSoh,
        variance,
        status
      };
    });
  }, [mode, activeDossier, filteredAllocations, columns, multipleStockItems]);

  const handleExportExcel = () => {
    if (!activeDossier) return;
    if (mode === '4.1') {
      const row1 = [
        'S/N',
        'Date',
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
        'Hub',
        'List of Packages',
        ...columns.map(c => c.name),
        'Total'
      ];
      const row2 = [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'List of Packages',
        ...columns.map(c => c.code),
        ''
      ];
      const body = filteredAllocations.map((a, idx) => [
        idx + 1,
        a.date || activeDossier.dateSubmitted,
        a.region,
        a.zone,
        a.woreda,
        a.healthFacility,
        `${a.hubName} (${a.hubCode})`,
        a.packages,
        ...columns.map(c => Number(a.quantities[c.id]) || 0),
        a.totalQty
      ]);
      const ws = XLSX.utils.aoa_to_sheet([row1, row2, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Branch_Received_DSP');
      XLSX.writeFile(wb, `Branch_4_1_Received_DSP_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const exportData = comparisonRows.map((r, idx) => ({
      'S/N': idx + 1,
      'Hub / Plant': `${r.hubName} (${r.hubCode})`,
      'Material Code': r.material,
      'Material Description': r.description,
      'Facilities': r.facilityCount,
      'Dispatched DSP Qty': r.dspQty,
      'Branch SOH Available': r.branchSoh,
      'National SOH Total': r.nationalSoh,
      'Variance (Branch SOH - DSP)': r.variance,
      'Status': r.status
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Branch_DSP_vs_SOH');
    XLSX.writeFile(wb, `Branch_4_2_DSP_vs_SOH_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (branchRecords.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-sm font-black text-slate-800 uppercase">
          {mode === '4.1' ? '4.1 Received DSP — No Dispatched Dossiers Yet' : '4.2 Analysis & Compare with DSP — No Dispatched Dossiers Yet'}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Dispatch a mapped Health Facility Allocation Matrix from EPSS Head Office (Sub-step 1.3.2 Send DSP to Hub) so regional branches receive the exact dispatched DSP.
        </p>
        <button
          type="button"
          onClick={() => onSelectSubTab?.('dsp-ho-1-3-2')}
          className="px-4 py-2.5 rounded-xl bg-[#0B1527] hover:bg-slate-800 text-amber-300 text-xs font-black uppercase cursor-pointer inline-flex items-center gap-2"
        >
          <span>Go to 1.3.2 Send DSP to Hub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm">
            {mode === '4.1' ? <Warehouse className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-50 text-purple-800 border border-purple-200">
                4. Branches DSP Management • {mode}
              </span>
              <h3 className="text-sm md:text-base font-black text-slate-900 uppercase">
                {mode === '4.1' ? '4.1 Branch Received DSP (From EPSS Head Office)' : '4.2 Branch SOH Analysis & Compare with DSP'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Exact Dispatched Data
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {activeDossier?.dspName || activeDossier?.dspRefNumber} • Dispatched: {activeDossier?.dateSubmitted}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {mode === '4.1' ? (
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-branches-4-2')}
              className="px-4 py-2 rounded-xl bg-[#0B1527] hover:bg-slate-800 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <span>Proceed to 4.2 Analysis &amp; Compare</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-branches-4-1')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black cursor-pointer"
            >
              Back to 4.1 Received DSP
            </button>
          )}
        </div>
      </div>

      {/* Received from HO EPSS Dossier Table */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Received from HO EPSS Dossiers ({branchRecords.length})
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Select Dossier to Proceed Analysis
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-12 italic">S/N</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[105px] italic">Date</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[200px] italic">DSP Name</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[150px] italic">Authorized person</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px] italic">Role</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px] italic">Hub</th>
                <th className="py-2.5 px-3 text-center min-w-[190px] italic">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {branchRecords.map((r, idx) => {
                const isSelected = activeDossier?.id === r.id;
                const hubNames = Array.from(
                  new Set(
                    [
                      ...(((r as any).branchDispatchData?.allocations || []).map((a: any) => a.hubName || a.hubCode).filter(Boolean)),
                      ...(r.facilityMatrixData?.rows?.map((row: any) => row.hub).filter(Boolean) || []),
                      ...(r.itemsIncluded?.map((it: any) => it.plant).filter(Boolean) || [])
                    ]
                  )
                );
                const hubLabel = hubNames.length > 2
                  ? `${hubNames.slice(0, 2).join(', ')} (+${hubNames.length - 2})`
                  : hubNames.length > 0
                    ? hubNames.join(', ')
                    : 'All Hubs';

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedDossierId(r.id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-purple-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                      {r.dateSubmitted || '-'}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-black text-slate-900">
                      {r.dspName || r.subject || r.dspRefNumber}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800 font-medium">
                      {r.signatory || '-'}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">
                      {r.signatoryRole || '-'}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-purple-900">
                      {hubLabel}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDossierId(r.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition ${
                            isSelected
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-purple-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                        {mode === '4.1' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDossierId(r.id);
                              onSelectSubTab?.('dsp-branches-4-2');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#0B1527] hover:bg-slate-800 text-amber-300 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <span>Proceed Analysis</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters & Dossier Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

          <select
            value={selectedHubFilter}
            onChange={(e) => setSelectedHubFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer"
          >
            <option value="all">All Dispatched Hubs ({uniqueHubs.length})</option>
            {uniqueHubs.map(h => (
              <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, hub, region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="text-xs font-mono text-slate-600">
          {filteredAllocations.length} Facilities • {formatNumber(filteredAllocations.reduce((s, a) => s + a.totalQty, 0))} Units
        </div>
      </div>

      {/* Mode 4.1: Exact Dispatched Matrix */}
      {mode === '4.1' ? (
        <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="font-bold">
                  <th className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2.5 text-center w-10">S/N</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Date</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Region</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Zone</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Woreda</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[200px]">Name of health facility</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[160px]">Hub / Plant</th>
                  <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-2 px-3 text-center">List of Packages</th>
                  {columns.map(col => (
                    <th key={col.id} className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2 text-center min-w-[130px] font-semibold">
                      {col.name}
                    </th>
                  ))}
                  <th className="bg-[#fde047] text-slate-900 font-black border border-slate-400 py-2 px-3 text-center">Total</th>
                </tr>
                <tr className="text-[10px]">
                  <th className="bg-[#fed7aa] border border-slate-400 py-1 px-2" colSpan={7}></th>
                  <th className="bg-[#dbeafe] text-slate-800 italic border border-slate-400 py-1 px-2 text-center font-normal">List of Packages</th>
                  {columns.map(col => (
                    <th key={`c-${col.id}`} className="bg-white text-slate-800 font-mono border border-slate-400 py-1 px-2 text-center font-bold">
                      {col.code}
                    </th>
                  ))}
                  <th className="bg-[#fde047] border border-slate-400 py-1 px-2 text-center font-mono">Units</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    <td className="py-2 px-2.5 border border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border border-slate-300 font-mono text-slate-600">{row.date}</td>
                    <td className="py-2 px-3 border border-slate-300 font-semibold text-slate-900">{row.region}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{row.zone}</td>
                    <td className="py-2 px-3 border border-slate-300 font-mono text-[11px]">{row.woreda}</td>
                    <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">{row.healthFacility}</td>
                    <td className="py-2 px-3 border border-slate-300 font-bold text-amber-900 bg-amber-50/40">
                      {row.hubName} ({row.hubCode})
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-center font-semibold bg-[#eff6ff]">{row.packages}</td>
                    {columns.map(col => (
                      <td key={`${row.id}-${col.id}`} className="py-2 px-2 border border-slate-300 text-center font-mono font-bold">
                        {Number(row.quantities[col.id]) || 0}
                      </td>
                    ))}
                    <td className="py-2 px-3 border border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/60">
                      {formatNumber(row.totalQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td colSpan={8} className="py-3 px-4 text-right uppercase text-amber-400 font-mono">
                    TOTAL ({filteredAllocations.length} Facilities):
                  </td>
                  {columns.map(col => (
                    <td key={`tot-${col.id}`} className="py-3 px-2 text-center font-mono text-amber-300 border-r border-slate-700">
                      {formatNumber(filteredAllocations.reduce((s, r) => s + (Number(r.quantities[col.id]) || 0), 0))}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center font-mono text-emerald-400 bg-slate-950">
                    {formatNumber(filteredAllocations.reduce((s, r) => s + r.totalQty, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Mode 4.2: Compare Dispatched DSP Quantities vs Branch Stock on Hand (SOH) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Hub-Material Pairs</div>
                <div className="text-xl font-black text-slate-900 font-mono">{comparisonRows.length}</div>
              </div>
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Sufficient Stock Lines</div>
                <div className="text-xl font-black text-emerald-600 font-mono">
                  {comparisonRows.filter(r => r.status === 'Sufficient').length}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Shortage Lines (Need Replenishment)</div>
                <div className="text-xl font-black text-rose-600 font-mono">
                  {comparisonRows.filter(r => r.status === 'Shortage').length}
                </div>
              </div>
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0B1527] text-white font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3 text-center w-10">S/N</th>
                    <th className="py-3 px-3">Hub / Plant</th>
                    <th className="py-3 px-3 font-mono">Material Code</th>
                    <th className="py-3 px-3">Material Description</th>
                    <th className="py-3 px-3 text-center">HFs</th>
                    <th className="py-3 px-3 text-right">Dispatched DSP Qty</th>
                    <th className="py-3 px-3 text-right">Branch SOH</th>
                    <th className="py-3 px-3 text-right">National SOH</th>
                    <th className="py-3 px-3 text-right">Variance</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comparisonRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{row.hubName} ({row.hubCode})</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-800">{row.material}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{row.description}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{row.facilityCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-cyan-800">{formatNumber(row.dspQty)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatNumber(row.branchSoh)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatNumber(row.nationalSoh)}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-black ${row.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {row.variance >= 0 ? `+${formatNumber(row.variance)}` : formatNumber(row.variance)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          row.status === 'Sufficient'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {comparisonRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No material allocations match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
