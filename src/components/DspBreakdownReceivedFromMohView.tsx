import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  Search,
  ArrowRight,
  FileSpreadsheet,
  FolderArchive,
  FileText,
  ShieldCheck,
  Zap,
  Inbox,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  DspWorkflowRecord,
  EpssSubTab,
  HealthFacilityRecord,
  RegionBreakdownColumn,
  RegionBreakdownRow,
  RegionBreakdownMatrixData
} from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { canonicalizeSubStage, isDossierInTier } from '../data/defaultDspWorkflows';

interface Props {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems?: HealthFacilityRecord[];
  onSelectSubTab?: (tab: EpssSubTab) => void;
  onSelectRecordForBreakdown?: (record: DspWorkflowRecord) => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

const ALL_REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Dire Dawa',
  'Gambella', 'Harari', 'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'South West Ethiopia', 'SNNPR', 'Tigray'
];

export const DspBreakdownReceivedFromMohView: React.FC<Props> = ({
  records,
  setRecords,
  hfListItems = [],
  onSelectSubTab,
  onSelectRecordForBreakdown,
  onTriggerCloudSync
}) => {
  // Strictly isolated to RHB Breakdown Management (Sub-step 3.1: Breakdown Received from MOH) — excludes EPSS 1.x, MOH 2.x, Branch 4.x
  const receivedMohDossiers = useMemo(() => {
    return records
      .filter(r => {
        const sub = canonicalizeSubStage(r.subStage, r.stage);
        return isDossierInTier(r, 'rhb-breakdown-management') && sub === '3.1';
      })
      .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records]);

  // Selected dossier
  const [selectedDossierId, setSelectedDossierId] = useState<string>(
    receivedMohDossiers[0]?.id || ''
  );

  useEffect(() => {
    if (receivedMohDossiers.length > 0 && !receivedMohDossiers.some(d => d.id === selectedDossierId)) {
      setSelectedDossierId(receivedMohDossiers[0].id);
    } else if (receivedMohDossiers.length === 0 && selectedDossierId !== '') {
      setSelectedDossierId('');
    }
  }, [receivedMohDossiers, selectedDossierId]);

  // Security: Regional Access Filter
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedDossierIds, setCheckedDossierIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedDossier = useMemo(() => {
    return (
      receivedMohDossiers.find(d => d.id === selectedDossierId) ||
      receivedMohDossiers[0] ||
      null
    );
  }, [receivedMohDossiers, selectedDossierId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredDossiers = useMemo(() => {
    if (!searchQuery.trim()) return receivedMohDossiers;
    const q = searchQuery.toLowerCase();
    return receivedMohDossiers.filter(d =>
      d.dspRefNumber?.toLowerCase().includes(q) ||
      d.dspName?.toLowerCase().includes(q) ||
      d.subject?.toLowerCase().includes(q) ||
      d.officialLetterRef?.toLowerCase().includes(q) ||
      d.signatory?.toLowerCase().includes(q) ||
      d.targetedRegions?.some(reg => reg.toLowerCase().includes(q)) ||
      d.itemsIncluded?.some(i =>
        i.description?.toLowerCase().includes(q) ||
        i.material?.toLowerCase().includes(q)
      )
    );
  }, [receivedMohDossiers, searchQuery]);

  // Derive the exact Regional Quota Matrix columns & rows from the selected dossier
  const { matrixColumns, matrixRows, filteredMatrixRows } = useMemo(() => {
    if (!selectedDossier) {
      return {
        matrixColumns: [] as RegionBreakdownColumn[],
        matrixRows: [] as RegionBreakdownRow[],
        filteredMatrixRows: [] as RegionBreakdownRow[]
      };
    }

    const cols: RegionBreakdownColumn[] =
      selectedDossier.facilityMatrixData?.columns && selectedDossier.facilityMatrixData.columns.length > 0
        ? selectedDossier.facilityMatrixData.columns
        : (selectedDossier.itemsIncluded || []).map((it, idx) => ({
            id: `col-${idx}-${it.material}`,
            name: it.description,
            code: it.material
          }));

    let rows: RegionBreakdownRow[] = [];
    if (selectedDossier.facilityMatrixData?.rows && selectedDossier.facilityMatrixData.rows.length > 0) {
      rows = selectedDossier.facilityMatrixData.rows;
    } else if (selectedDossier.targetedRegions && selectedDossier.targetedRegions.length > 0) {
      const regionCount = selectedDossier.targetedRegions.length;
      rows = selectedDossier.targetedRegions.map((reg, rIdx) => {
        const qObj: Record<string, number> = {};
        cols.forEach((col, cIdx) => {
          const item = selectedDossier.itemsIncluded?.[cIdx];
          const total = Number(item?.quantity) || 0;
          const base = Math.floor(total / regionCount);
          const rem = rIdx < (total % regionCount) ? 1 : 0;
          qObj[col.id] = base + rem;
        });
        return {
          id: `fallback-reg-${rIdx}`,
          date: selectedDossier.dateSubmitted,
          region: reg,
          zone: '',
          woreda: '',
          hub: '',
          healthFacility: `${reg} Regional Health Bureau`,
          packages: selectedDossier.itemsIncluded?.[0]?.budgetSource || 'WB',
          quantities: qObj
        };
      });
    }

    const visibleRows =
      selectedRegion === 'all'
        ? rows
        : rows.filter(r => r.region?.toLowerCase() === selectedRegion.toLowerCase());

    return {
      matrixColumns: cols,
      matrixRows: rows,
      filteredMatrixRows: visibleRows
    };
  }, [selectedDossier, selectedRegion]);

  // Compute exact column totals for displayed rows
  const columnTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    matrixColumns.forEach(c => {
      sums[c.id] = filteredMatrixRows.reduce((acc, row) => acc + (Number(row.quantities?.[c.id]) || 0), 0);
    });
    return sums;
  }, [matrixColumns, filteredMatrixRows]);

  const displayedTotalUnits = useMemo(() => {
    return Object.values(columnTotals).reduce((a, b) => a + b, 0);
  }, [columnTotals]);

  const availableRegionsInDossier = useMemo(() => {
    const set = new Set<string>();
    matrixRows.forEach(r => {
      if (r.region) set.add(r.region);
    });
    selectedDossier?.targetedRegions?.forEach(reg => {
      if (reg) set.add(reg);
    });
    return set.size > 0 ? Array.from(set) : ALL_REGIONS;
  }, [matrixRows, selectedDossier]);

  // Primary Action: Break Item for Facility (Stage 3.2) using exact regional quota for the chosen region
  const handleBreakItemForFacility = (dossier: DspWorkflowRecord) => {
    const cols: RegionBreakdownColumn[] =
      dossier.facilityMatrixData?.columns && dossier.facilityMatrixData.columns.length > 0
        ? dossier.facilityMatrixData.columns.map(c => ({ id: c.id, name: c.name, code: c.code }))
        : (dossier.itemsIncluded || []).map((item, idx) => ({
            id: `col-dossier-${idx}-${item.material.replace(/[^a-zA-Z0-9]/g, '-')}`,
            name: item.description,
            code: item.material
          }));

    const regionName =
      selectedRegion && selectedRegion !== 'all'
        ? selectedRegion
        : dossier.facilityMatrixData?.rows?.[0]?.region || dossier.targetedRegions?.[0] || 'Oromia';

    // Exact quota row for this region from MOH's 2.2 Regional Quota Matrix
    const regionRow = dossier.facilityMatrixData?.rows?.find(
      r => r.region?.toLowerCase() === regionName.toLowerCase()
    );

    const getRegionalQuotaForColumn = (col: RegionBreakdownColumn, idx: number): number => {
      if (regionRow && regionRow.quantities && regionRow.quantities[col.id] !== undefined) {
        return Number(regionRow.quantities[col.id]) || 0;
      }
      const dossierItem =
        dossier.itemsIncluded?.find(i => i.material === col.code) || dossier.itemsIncluded?.[idx];
      const regCount = Math.max(1, dossier.targetedRegions?.length || 1);
      return dossierItem ? Math.max(1, Math.round(dossierItem.quantity / regCount)) : 0;
    };

    const regionFacilities = hfListItems.filter(
      h =>
        h.region?.toLowerCase() === regionName.toLowerCase() ||
        (h.deliveringPlantDescr && h.deliveringPlantDescr.toLowerCase().includes(regionName.toLowerCase()))
    );

    let facilityRows: RegionBreakdownRow[] = [];

    if (regionFacilities.length > 0) {
      const targetFacilities = regionFacilities.slice(0, Math.min(10, regionFacilities.length));
      facilityRows = targetFacilities.map((hf, fIdx) => {
        const qObj: Record<string, number> = {};
        cols.forEach((col, cIdx) => {
          const totalRegQty = getRegionalQuotaForColumn(col, cIdx);
          const base = Math.floor(totalRegQty / targetFacilities.length);
          const rem = fIdx < (totalRegQty % targetFacilities.length) ? 1 : 0;
          qObj[col.id] = base + rem;
        });
        return {
          id: `row-hf-${hf.id || fIdx}-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          region: hf.region || regionName,
          zone: hf.zoneDescription || hf.zoneCode || 'Zone 1',
          woreda: hf.woredaDescription || hf.woreda || 'Woreda 01',
          healthFacility: hf.customerDescription || hf.customer || `Facility ${fIdx + 1}`,
          customerDescription: hf.customerDescription || hf.customer,
          customerId: hf.customer,
          hub: hf.deliveringPlant || '',
          packages: regionRow?.packages || 'MCH',
          quantities: qObj
        };
      });
    } else {
      const standardFacilityNames = [
        `${regionName} Referral Hospital`,
        `${regionName} Comprehensive Specialized Hospital`,
        `${regionName} General Hospital`,
        `${regionName} District Hospital`,
        `${regionName} Model Health Center`
      ];

      facilityRows = standardFacilityNames.map((name, fIdx) => {
        const qObj: Record<string, number> = {};
        cols.forEach((col, cIdx) => {
          const totalRegQty = getRegionalQuotaForColumn(col, cIdx);
          const base = Math.floor(totalRegQty / standardFacilityNames.length);
          const rem = fIdx < (totalRegQty % standardFacilityNames.length) ? 1 : 0;
          qObj[col.id] = base + rem;
        });
        return {
          id: `row-std-${fIdx}-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          region: regionName,
          zone: `${regionName} Central Zone`,
          woreda: `Woreda 0${fIdx + 1}`,
          healthFacility: name,
          customerDescription: name,
          hub: '',
          packages: regionRow?.packages || 'MCH',
          quantities: qObj
        };
      });
    }

    const facilityMatrixData: RegionBreakdownMatrixData = {
      date: new Date().toISOString().split('T')[0],
      region: regionName,
      columns: cols,
      rows: facilityRows
    };

    const updatedRecord: DspWorkflowRecord = {
      ...dossier,
      id: `dsp-rhb-draft-${dossier.id}-${regionName.replace(/\s+/g, '-')}`,
      stage: 'rhb-breakdown-management',
      subStage: '3.2',
      stageTitle: '3.2 Submit Breakdown to MOH',
      status: 'Draft',
      facilityMatrixData,
      targetedRegions: [regionName],
      targetedFacilitiesCount: facilityRows.length,
      totalQuantity: cols.reduce((s, c, cIdx) => s + getRegionalQuotaForColumn(c, cIdx), 0),
      itemsIncluded: cols.map((c, cIdx) => ({
        material: c.code,
        description: c.name,
        quantity: getRegionalQuotaForColumn(c, cIdx),
        plant: 'AA01 Central'
      }))
    };

    setRecords(prev => {
      const exists = prev.some(r => r.id === updatedRecord.id);
      if (exists) {
        return prev.map(r => (r.id === updatedRecord.id ? updatedRecord : r));
      }
      return [updatedRecord, ...prev];
    });

    if (onSelectRecordForBreakdown) {
      onSelectRecordForBreakdown(updatedRecord);
    }

    if (onTriggerCloudSync) {
      onTriggerCloudSync(`✓ Loaded MOH Dossier ${dossier.dspRefNumber} (${regionName} quota) for Health Facility Breakdown!`, {
        type: 'UPDATE',
        title: `Breakdown for Facilities (${dossier.dspRefNumber})`,
        payload: updatedRecord
      });
    }

    showToast(`✓ Loaded ${cols.length} items for ${regionName} with exact MOH regional quota! Opening Stage 3.2...`);
    if (onSelectSubTab) {
      onSelectSubTab('dsp-rhb-3-2');
    }
  };

  // Export exact MOH-to-RHB dossier to Excel
  const handleExportDossierExcel = (dossier: DspWorkflowRecord) => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['MINISTRY OF HEALTH (MOH) — PMD DIRECTORATE'],
      ['OFFICIAL MEDICAL EQUIPMENT REGIONAL BREAKDOWN DOSSIER (MOH TO RHB)'],
      [''],
      ['DSP Reference Number:', dossier.dspRefNumber],
      ['DSP Name:', dossier.dspName || dossier.subject],
      ['Official Letter Ref:', dossier.officialLetterRef],
      ['Dispatch Date:', dossier.dateSubmitted],
      ['Sender:', dossier.senderOrg],
      ['Recipient:', dossier.recipientOrg],
      ['Authorized Signatory:', `${dossier.signatory} (${dossier.signatoryRole || 'Official'})`],
      ['Targeted Regions:', dossier.targetedRegions?.join(', ') || 'All Regions'],
      ['Total Equipment Columns:', matrixColumns.length],
      ['Total Units Allocated:', displayedTotalUnits],
      ['Notes:', dossier.notes || '']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'MOH Transmittal Summary');

    // Sheet 2: Exact MOH Regional Quota Horizontal Matrix
    const matrixHeaders1 = [
      'Date',
      'Region',
      'Budget Source',
      ...matrixColumns.map(c => c.name),
      'Total'
    ];
    const matrixHeaders2 = [
      '',
      '',
      'Budget',
      ...matrixColumns.map(c => c.code),
      ''
    ];
    const matrixDataRows = filteredMatrixRows.map(row => {
      const rTotal = matrixColumns.reduce((s, c) => s + (Number(row.quantities?.[c.id]) || 0), 0);
      return [
        row.date || dossier.facilityMatrixData?.date || dossier.dateSubmitted,
        row.region,
        row.packages || 'WB',
        ...matrixColumns.map(c => Number(row.quantities?.[c.id]) || 0),
        rTotal
      ];
    });
    const totalFooterRow = [
      'TOTAL',
      `${filteredMatrixRows.length} Regions`,
      '',
      ...matrixColumns.map(c => columnTotals[c.id] || 0),
      displayedTotalUnits
    ];

    const wsMatrix = XLSX.utils.aoa_to_sheet([
      matrixHeaders1,
      matrixHeaders2,
      ...matrixDataRows,
      totalFooterRow
    ]);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'MOH Regional Quota Matrix');

    XLSX.writeFile(wb, `MOH_to_RHB_Dossier_${dossier.dspRefNumber.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    showToast(`✓ Downloaded MOH-to-RHB Breakdown Dossier (${dossier.dspRefNumber})!`);
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="hidden bg-[#0B1527] border border-[#0B1527] rounded-2xl p-5 shadow-lg text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md text-white">
              <FolderArchive className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-orange-500/20 text-orange-300 border border-orange-400/40">
                  3. RHB Breakdown Management • Sub-step 3.1
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  RHB Isolated (EPSS &amp; MOH Excluded)
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  • MOH ➔ RHB Regional Quota Dossiers
                </span>
              </div>
              <h1 className="text-lg font-black text-white mt-1 tracking-tight">
                Breakdown Received from MOH (RHB Incoming Dossiers)
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Displays ONLY RHB Sub-step 3.1 Regional Quota Dossiers received from MOH PMD Directorate (strictly separated from EPSS Head Office &amp; Branch dossiers).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (selectedDossier) {
                  handleBreakItemForFacility(selectedDossier);
                } else if (onSelectSubTab) {
                  onSelectSubTab('dsp-rhb-3-2');
                }
              }}
              disabled={!selectedDossier}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-black shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Break Item for Facility (Stage 3.2)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (selectedDossier) handleExportDossierExcel(selectedDossier);
              }}
              disabled={!selectedDossier}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-bold border border-white/10 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Dossier (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Received MOH Dossiers
            </span>
            <span className="text-lg font-black text-white">
              {receivedMohDossiers.length} Official File{receivedMohDossiers.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Selected Dossier Items
            </span>
            <span className="text-lg font-black text-amber-300">
              {matrixColumns.length} Material Code{matrixColumns.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Targeted Regions (Shown)
            </span>
            <span className="text-lg font-black text-cyan-300">
              {filteredMatrixRows.length} Region{filteredMatrixRows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Allocated Quota Units
            </span>
            <span className="text-lg font-black text-emerald-400">
              {formatNumber(displayedTotalUnits)} Units
            </span>
          </div>
        </div>
      </div>

      {receivedMohDossiers.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            No Breakdown Dossiers Received from MOH Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            This inbox shows only exact Regional Quota Matrices transmitted by Ministry of Health (MOH) in Sub-step 2.2 (DSP Request to RHB).
          </p>
          {onSelectSubTab && (
            <button
              type="button"
              onClick={() => onSelectSubTab('dsp-moh-2-2')}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-amber-300 text-xs font-black uppercase tracking-wider cursor-pointer transition"
            >
              <span>Go to 2.2 DSP Request to RHB</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dossiers Table matching requested format */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  MOH Sent to RHB Dossiers ({filteredDossiers.length})
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  MOH ➔ RHB • Proceed to Facility
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ref, DSP name, region, item..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-950 font-black border-b border-slate-300">
                    <th className="p-2.5 border-r border-slate-300 text-center w-12 italic">S/N</th>
                    <th className="p-2.5 border-r border-slate-300 italic min-w-[100px]">Date</th>
                    <th className="p-2.5 border-r border-slate-300 italic min-w-[140px]">Region</th>
                    <th className="p-2.5 border-r border-slate-300 italic min-w-[180px]">DSP Name</th>
                    <th className="p-2.5 border-r border-slate-300 italic min-w-[150px]">Authorized person</th>
                    <th className="p-2.5 border-r border-slate-300 italic min-w-[130px]">Role</th>
                    <th className="p-2.5 border-r border-slate-300 text-center w-24 italic">View</th>
                    <th className="p-2.5 text-center min-w-[165px] italic">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredDossiers.map((dossier, idx) => {
                    const isSelected = dossier.id === selectedDossier?.id;
                    const dossierRegions =
                      dossier.facilityMatrixData?.rows?.map(r => r.region).filter(Boolean) ||
                      dossier.targetedRegions ||
                      [];
                    const regionName =
                      Array.from(new Set(dossierRegions)).join(', ') || dossier.senderOrg || 'All Regions';

                    return (
                      <tr
                        key={dossier.id}
                        onClick={() => setSelectedDossierId(dossier.id)}
                        className={`cursor-pointer transition-colors hover:bg-amber-50/50 ${
                          isSelected ? 'bg-amber-50/80 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                          {dossier.dateSubmitted || '-'}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-black text-slate-900">
                          {regionName}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-bold text-amber-900">
                          {dossier.dspName || dossier.subject || dossier.dspRefNumber}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-800 font-semibold">
                          {dossier.signatory || dossier.senderOrg || 'MOH Coordinator'}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-600">
                          {dossier.signatoryRole || 'Coordinator'}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDossierId(dossier.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-2xs transition ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-900 hover:bg-black text-amber-300'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isSelected ? 'Viewing' : 'View'}</span>
                          </button>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDossierId(dossier.id);
                              handleBreakItemForFacility(dossier);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer shadow-2xs transition"
                          >
                            <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                            <span>Proceed to Facility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Dossier Exact MOH-to-RHB Matrix */}
          <div className="space-y-4">
            {selectedDossier && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-4">
                {/* Transmittal Header Details */}
                <div className="hidden p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          MOH ➔ RHB Exact Sent Dossier
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600">
                          Ref: {selectedDossier.dspRefNumber}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          • Letter: {selectedDossier.officialLetterRef}
                        </span>
                      </div>
                      <h2 className="text-sm font-black text-slate-900 mt-1">
                        {selectedDossier.dspName || selectedDossier.subject}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleBreakItemForFacility(selectedDossier)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        <span>Break Regional Quota (Stage 3.2)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleExportDossierExcel(selectedDossier)}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                        title="Export Excel (.xlsx)"
                      >
                        <Download className="w-4 h-4 text-amber-500" />
                      </button>
                    </div>
                  </div>

                  {/* Transmittal Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Sender Organization
                      </span>
                      <span className="font-bold text-slate-900 line-clamp-1">
                        {selectedDossier.senderOrg || 'Ministry of Health (PMD)'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Authorized Signatory
                      </span>
                      <span className="font-bold text-slate-900 line-clamp-1">
                        {selectedDossier.signatory} ({selectedDossier.signatoryRole || 'Lead'})
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Targeted Regions
                      </span>
                      <span className="font-bold text-slate-900 line-clamp-1">
                        {matrixRows.map(r => r.region).join(', ') || selectedDossier.targetedRegions?.join(', ') || 'All Regions'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Official Dispatch Date
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedDossier.dateSubmitted}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EXACT MOH REGIONAL QUOTA HORIZONTAL MATRIX (SENT FROM 2.2) */}
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          MOH Regional Quota Matrix (Exact Data Sent in 2.2)
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Region View:</span>
                        <select
                          value={selectedRegion}
                          onChange={e => setSelectedRegion(e.target.value)}
                          className="bg-transparent border-none text-[11px] font-black text-slate-900 focus:ring-0 cursor-pointer outline-none"
                        >
                          <option value="all">ALL SENT REGIONS ({matrixRows.length})</option>
                          {availableRegionsInDossier.map(reg => (
                            <option key={reg} value={reg}>
                              {reg.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-300 text-xs font-medium bg-[#ffedd5]">
                            <th className="p-2.5 italic text-slate-900 border-r border-slate-300 font-semibold min-w-[95px]">
                              Date
                            </th>
                            <th className="p-2.5 italic text-slate-900 border-r border-slate-300 font-semibold min-w-[130px]">
                              Region
                            </th>
                            <th className="p-2.5 font-bold bg-[#f97316] text-white border-r border-slate-300 text-center min-w-[110px]">
                              Budget Source
                            </th>
                            {matrixColumns.map(col => (
                              <th
                                key={col.id}
                                className="p-2.5 bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[150px] leading-tight"
                              >
                                <div className="line-clamp-2" title={col.name}>
                                  {col.name}
                                </div>
                              </th>
                            ))}
                            <th className="p-2.5 bg-[#fde047]/70 text-slate-900 font-bold text-center min-w-[80px]">
                              Total
                            </th>
                          </tr>
                          <tr className="border-b border-slate-300 bg-white font-mono text-[11px]">
                            <th className="p-2 bg-[#fff7ed] border-r border-slate-300"></th>
                            <th className="p-2 bg-[#fff7ed] border-r border-slate-300"></th>
                            <th className="p-2 bg-[#eff6ff] text-blue-900 border-r border-slate-300 text-center font-bold text-[10px]">
                              Budget
                            </th>
                            {matrixColumns.map(col => (
                              <th key={`code-${col.id}`} className="p-2 border-r border-slate-300 font-bold text-slate-700">
                                {col.code}
                              </th>
                            ))}
                            <th className="p-2 bg-[#fef9c3] text-center font-bold text-slate-700">Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredMatrixRows.length === 0 ? (
                            <tr>
                              <td colSpan={matrixColumns.length + 4} className="p-8 text-center text-slate-400 font-semibold">
                                No rows match the selected region filter in this dossier.
                              </td>
                            </tr>
                          ) : (
                            filteredMatrixRows.map((row, rIdx) => {
                              const rowTotal = matrixColumns.reduce(
                                (sum, col) => sum + (Number(row.quantities?.[col.id]) || 0),
                                0
                              );
                              return (
                                <tr key={row.id || rIdx} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                                    {row.date || selectedDossier.facilityMatrixData?.date || selectedDossier.dateSubmitted}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">
                                    {row.region}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-center bg-[#dbeafe]/40 text-blue-900">
                                    {row.packages || 'WB'}
                                  </td>
                                  {matrixColumns.map(col => (
                                    <td
                                      key={col.id}
                                      className="p-2.5 border-r border-slate-200 font-mono font-black text-right text-slate-900 bg-slate-50/30"
                                    >
                                      {formatNumber(Number(row.quantities?.[col.id]) || 0)}
                                    </td>
                                  ))}
                                  <td className="p-2.5 font-mono font-black text-right text-amber-900 bg-amber-50/70">
                                    {formatNumber(rowTotal)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-900 font-bold border-t-2 border-slate-400 text-white text-xs">
                            <td colSpan={2} className="p-2.5 border-r border-slate-700 uppercase tracking-wider font-black text-[11px]">
                              Total Regional Quota ({filteredMatrixRows.length} Region{filteredMatrixRows.length === 1 ? '' : 's'}):
                            </td>
                            <td className="p-2.5 border-r border-slate-700 text-center font-mono text-[10px] text-cyan-300">
                              {Array.from(new Set(filteredMatrixRows.map(r => r.packages || 'WB'))).join(', ') || 'WB'}
                            </td>
                            {matrixColumns.map(col => (
                              <td
                                key={`tot-${col.id}`}
                                className="p-2.5 border-r border-slate-700 text-right font-mono font-black text-amber-300"
                              >
                                {formatNumber(columnTotals[col.id] || 0)}
                              </td>
                            ))}
                            <td className="p-2.5 text-right font-mono font-black text-emerald-400 bg-slate-950">
                              {formatNumber(displayedTotalUnits)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Equipment Allocation Summary for Selected Dossier / Region */}
                  <div className="hidden space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Sent Equipment Quota Summary ({matrixColumns.length} Material Codes)
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Total Earmarked: {formatNumber(displayedTotalUnits)} Units
                        {selectedDossier.totalValuationETB > 0 ? ` • ${formatCurrency(selectedDossier.totalValuationETB)}` : ''}
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-bold select-none text-[11px]">
                            <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center">S/N</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 w-36">Material Code</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Equipment Description</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 w-32 text-right">Sent Quota Qty</th>
                            <th className="py-2.5 px-3 w-36 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {matrixColumns.map((col, idx) => (
                            <tr key={col.id} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-2.5 px-3 border-r border-slate-100 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-indigo-700 bg-indigo-50/10">
                                {col.code}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-100 font-bold text-slate-900">
                                {col.name}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-100 text-right font-black text-amber-700 font-mono">
                                {formatNumber(columnTotals[col.id] || 0)} units
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => handleBreakItemForFacility(selectedDossier)}
                                  className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 transition cursor-pointer"
                                >
                                  Break for Facility
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                            <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider font-black text-[11px]">
                              Total Quota Summary:
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-amber-800 font-mono">
                              {formatNumber(displayedTotalUnits)} units
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {selectedDossier.notes && (
                  <div className="hidden mx-4 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <span className="font-bold text-slate-800 block text-[10px] uppercase tracking-wider mb-1">
                      Ministerial Guidelines & Transmittal Directives:
                    </span>
                    <p className="italic">{selectedDossier.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
