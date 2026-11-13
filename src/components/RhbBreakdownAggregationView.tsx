import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Hospital,
  Layers,
  Package,
  Search,
  Send,
  Trash2,
  Upload,
  UserCheck,
  AlertCircle,
  MapPin
} from 'lucide-react';
import {
  DspWorkflowRecord,
  HealthFacilityRecord,
  RegionBreakdownColumn,
  RegionBreakdownRow
} from '../types';
import { Stage4MatrixData, Stage4Row } from './Stage4MohSubmittedMatrixTable';
import { formatNumber } from '../utils/formatters';
import { aggregateRhbSubmissionsToMoh } from '../utils/rhbAggregation';

interface RhbBreakdownAggregationViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems?: HealthFacilityRecord[];
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
  onNavigateToSubmitToMoh?: () => void;
  onProceedToEpss: (
    matrixData: Stage4MatrixData,
    summary: {
      regions: string[];
      facilityCount: number;
      columnCount: number;
      totalUnits: number;
      latestDate: string;
    }
  ) => void;
}

export const RhbBreakdownAggregationView: React.FC<RhbBreakdownAggregationViewProps> = ({
  records,
  setRecords,
  onTriggerCloudSync,
  onNavigateToSubmitToMoh,
  onProceedToEpss
}) => {
  const [viewMode, setViewMode] = useState<'region-summary' | 'facility-matrix' | 'dossiers'>('region-summary');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const aggregation = useMemo(() => aggregateRhbSubmissionsToMoh(records), [records]);
  const {
    submissions,
    unifiedColumns,
    facilityRows,
    regionSummaries,
    columnTotals,
    grandTotalUnits,
    hasAnyHub,
    latestDate
  } = aggregation;

  const filteredRegionSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return regionSummaries.filter((rs) => {
      if (selectedRegion !== 'all' && rs.region !== selectedRegion) return false;
      if (!q) return true;
      return (
        rs.region.toLowerCase().includes(q) ||
        rs.dspRefs.some((d) => d.toLowerCase().includes(q)) ||
        rs.dspNames.some((d) => d.toLowerCase().includes(q)) ||
        rs.officialLetterRefs.some((d) => d.toLowerCase().includes(q)) ||
        rs.senderOrgs.some((d) => d.toLowerCase().includes(q)) ||
        rs.signatories.some((d) => d.toLowerCase().includes(q)) ||
        rs.zones.some((d) => d.toLowerCase().includes(q)) ||
        rs.woredas.some((d) => d.toLowerCase().includes(q)) ||
        rs.packages.some((d) => d.toLowerCase().includes(q)) ||
        rs.hubs.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [regionSummaries, selectedRegion, searchQuery]);

  const filteredFacilityRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return facilityRows.filter((row) => {
      if (selectedRegion !== 'all' && row.region !== selectedRegion) return false;
      if (!q) return true;
      return (
        row.region.toLowerCase().includes(q) ||
        row.zone.toLowerCase().includes(q) ||
        row.woreda.toLowerCase().includes(q) ||
        row.healthFacility.toLowerCase().includes(q) ||
        (row.customerDescription || '').toLowerCase().includes(q) ||
        (row.customerId || '').toLowerCase().includes(q) ||
        row.packages.toLowerCase().includes(q) ||
        (row.hub || '').toLowerCase().includes(q) ||
        row.dspRefNumber.toLowerCase().includes(q) ||
        row.dspName.toLowerCase().includes(q) ||
        row.officialLetterRef.toLowerCase().includes(q) ||
        row.senderOrg.toLowerCase().includes(q) ||
        row.signatory.toLowerCase().includes(q)
      );
    });
  }, [facilityRows, selectedRegion, searchQuery]);

  const filteredColumnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    unifiedColumns.forEach((col) => {
      totals[col.id] = filteredFacilityRows.reduce((sum, r) => sum + (Number(r.quantities[col.id]) || 0), 0);
    });
    return totals;
  }, [unifiedColumns, filteredFacilityRows]);

  const filteredGrandTotal = useMemo(() => {
    return Object.values(filteredColumnTotals).reduce((sum, v) => sum + v, 0);
  }, [filteredColumnTotals]);

  const handleInspectRegion = (regionName: string) => {
    setSelectedRegion(regionName);
    setViewMode('facility-matrix');
  };

  const handleProceed = () => {
    if (facilityRows.length === 0 || unifiedColumns.length === 0) {
      showToast('No RHB submissions to forward yet. Submit or upload at least one RHB breakdown first.');
      return;
    }

    const stage4Rows: Stage4Row[] = facilityRows.map((r, idx) => ({
      id: `s4-aggr-${idx}-${Date.now()}`,
      date: r.submissionDate !== '-' ? r.submissionDate : latestDate,
      region: r.region,
      zone: r.zone,
      woreda: r.woreda,
      healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
      packages: r.packages || 'MCH',
      plant: r.hub || undefined,
      quantities: { ...r.quantities }
    }));

    const stage4Matrix: Stage4MatrixData = {
      date: latestDate,
      region: regionSummaries.length === 1 ? regionSummaries[0].region : 'All Regions',
      columns: unifiedColumns.map((c) => ({ id: c.id, name: c.name, code: c.code })),
      rows: stage4Rows
    };

    onProceedToEpss(stage4Matrix, {
      regions: regionSummaries.map((r) => r.region),
      facilityCount: stage4Rows.length,
      columnCount: unifiedColumns.length,
      totalUnits: grandTotalUnits,
      latestDate
    });
  };

  const handleExportExcel = () => {
    if (facilityRows.length === 0) {
      showToast('Nothing to export — no individual RHB submissions found.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: All-Region Summary Table
    const sumHeader1 = [
      'S/N',
      'Region',
      'Submission Date',
      'DSP Ref Number',
      'DSP Name / Subject',
      'Official Letter Ref',
      'Sender Organization',
      'Authorized Signatory',
      'Zones Covered',
      'Woredas Covered',
      'Health Facilities Count',
      'List of Packages',
      ...(hasAnyHub ? ['HUB(s)'] : []),
      ...unifiedColumns.map((c) => c.name),
      'Region Total Units',
      'Status'
    ];
    const sumHeader2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ...(hasAnyHub ? [''] : []),
      ...unifiedColumns.map((c) => c.code),
      '',
      ''
    ];
    const sumRows = filteredRegionSummaries.map((rs, i) => [
      i + 1,
      rs.region,
      rs.latestDate,
      rs.dspRefs.join('; ') || '-',
      rs.dspNames.join('; ') || '-',
      rs.officialLetterRefs.join('; ') || '-',
      rs.senderOrgs.join('; ') || '-',
      rs.signatories.join('; ') || '-',
      `${rs.zones.length} (${rs.zones.join(', ')})`,
      `${rs.woredas.length} (${rs.woredas.join(', ')})`,
      rs.facilityCount,
      rs.packages.join(', ') || '-',
      ...(hasAnyHub ? [rs.hubs.join(', ') || '-'] : []),
      ...unifiedColumns.map((c) => rs.columnTotals[c.id] || 0),
      rs.totalUnits,
      rs.statuses.join('; ') || 'Submitted & Pending'
    ]);
    const sumTotalRow = [
      '',
      `NATIONAL TOTAL (${filteredRegionSummaries.length} Regions)`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      filteredFacilityRows.length,
      '',
      ...(hasAnyHub ? [''] : []),
      ...unifiedColumns.map((c) => filteredColumnTotals[c.id] || 0),
      filteredGrandTotal,
      ''
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet([sumHeader1, sumHeader2, ...sumRows, sumTotalRow]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'All_Region_Summary');

    // Sheet 2: Consolidated Facility Matrix (Every RHB Column)
    const facHeader1 = [
      'S/N',
      'Date',
      'DSP Ref Number',
      'DSP Name',
      'Official Letter Ref',
      'Sender Org',
      'Authorized Signatory',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'Customer ID',
      'List of Packages',
      ...(hasAnyHub ? ['HUB'] : []),
      ...unifiedColumns.map((c) => c.name),
      'Row Total',
      'Status'
    ];
    const facHeader2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'List of Packages',
      ...(hasAnyHub ? [''] : []),
      ...unifiedColumns.map((c) => c.code),
      '',
      ''
    ];
    const facRows = filteredFacilityRows.map((row, idx) => [
      idx + 1,
      row.submissionDate,
      row.dspRefNumber,
      row.dspName,
      row.officialLetterRef,
      row.senderOrg,
      row.signatoryRole && row.signatoryRole !== '-' ? `${row.signatory} (${row.signatoryRole})` : row.signatory,
      row.region,
      row.zone,
      row.woreda,
      row.healthFacility,
      row.customerId || '',
      row.packages,
      ...(hasAnyHub ? [row.hub || ''] : []),
      ...unifiedColumns.map((c) => row.quantities[c.id] || 0),
      row.rowTotal,
      row.status
    ]);
    const facTotalRow = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'GRAND TOTAL',
      '',
      '',
      `${filteredFacilityRows.length} Facilities`,
      '',
      '',
      ...(hasAnyHub ? [''] : []),
      ...unifiedColumns.map((c) => filteredColumnTotals[c.id] || 0),
      filteredGrandTotal,
      ''
    ];
    const wsFacilities = XLSX.utils.aoa_to_sheet([facHeader1, facHeader2, ...facRows, facTotalRow]);
    XLSX.utils.book_append_sheet(wb, wsFacilities, 'All_Facilities_Matrix');

    XLSX.writeFile(wb, `MOH_RHB_Breakdown_Aggregation_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✓ Exported 2-sheet All-Region RHB Aggregation Workbook (.xlsx)');
  };

  const handleUploadRhbExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!raw || raw.length < 2) {
          showToast('Uploaded file is empty or invalid.');
          return;
        }

        // Locate the header row containing "Region" or "Name of health facility"
        let headerRowIdx = 0;
        let detectedDate = new Date().toISOString().split('T')[0];

        for (let i = 0; i < Math.min(6, raw.length); i++) {
          const row = raw[i] || [];
          const firstCell = String(row[0] || '').trim().toLowerCase();
          if (firstCell === 'date' && row[1]) {
            detectedDate = String(row[1]).trim();
          }
          const joined = row.map((c) => String(c || '').toLowerCase()).join('|');
          if (joined.includes('region') && (joined.includes('health facility') || joined.includes('customer'))) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow1 = (raw[headerRowIdx] || []).map((c) => String(c || '').trim());
        const nextRow = (raw[headerRowIdx + 1] || []).map((c) => String(c || '').trim());
        const hasTwoTierCodes =
          nextRow.length > 0 &&
          !nextRow[0] &&
          nextRow.some((c, idx) => idx >= 4 && c.length > 0);

        const dataStartIdx = hasTwoTierCodes ? headerRowIdx + 2 : headerRowIdx + 1;

        // Detect column indices by exact or normalized header name
        const findCol = (patterns: string[]) =>
          headerRow1.findIndex((h) => patterns.some((p) => h.toLowerCase().includes(p)));

        const dateIdx = findCol(['date']);
        const regionIdx = findCol(['region']);
        const zoneIdx = findCol(['zone']);
        const woredaIdx = findCol(['woreda']);
        const facilityIdx = findCol(['name of health facility', 'health facility', 'customer description', 'facility']);
        const pkgIdx = findCol(['list of pack', 'package']);
        const hubIdx = findCol(['hub', 'delivering plant', 'plant']);
        const custIdIdx = findCol(['customer id', 'customer code']);

        const knownMetaIndices = new Set(
          [dateIdx, regionIdx, zoneIdx, woredaIdx, facilityIdx, pkgIdx, hubIdx, custIdIdx].filter((i) => i >= 0)
        );

        const importedColumns: RegionBreakdownColumn[] = [];
        const colIdxToId = new Map<number, string>();

        headerRow1.forEach((colName, idx) => {
          if (knownMetaIndices.has(idx)) return;
          const lower = colName.toLowerCase();
          if (!colName || lower === 's/n' || lower === 'sn' || lower === 'total' || lower === 'row total' || lower === 'status') {
            return;
          }
          const code = (hasTwoTierCodes ? nextRow[idx] : '') || `403-MAT-${idx}`;
          const colId = `rhb-imp-${Date.now()}-${idx}`;
          importedColumns.push({ id: colId, name: colName, code });
          colIdxToId.set(idx, colId);
        });

        const parsedRows: RegionBreakdownRow[] = [];
        for (let r = dataStartIdx; r < raw.length; r++) {
          const row = raw[r];
          if (!row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) continue;

          const regVal = regionIdx >= 0 ? String(row[regionIdx] || '').trim() : '';
          const facVal = facilityIdx >= 0 ? String(row[facilityIdx] || '').trim() : '';
          if (regVal.toLowerCase().includes('total') || facVal.toLowerCase().includes('total')) continue;
          if (!regVal && !facVal) continue;

          const quantities: Record<string, number> = {};
          colIdxToId.forEach((colId, cIdx) => {
            quantities[colId] = Math.max(0, Number(row[cIdx]) || 0);
          });

          parsedRows.push({
            id: `rhb-row-${Date.now()}-${r}`,
            region: regVal || 'Unspecified',
            zone: zoneIdx >= 0 ? String(row[zoneIdx] || '').trim() || '-' : '-',
            woreda: woredaIdx >= 0 ? String(row[woredaIdx] || '').trim() || '-' : '-',
            hub: hubIdx >= 0 ? String(row[hubIdx] || '').trim() : '',
            healthFacility: facVal || `Health Facility ${r}`,
            customerDescription: facVal || `Health Facility ${r}`,
            customerId: custIdIdx >= 0 ? String(row[custIdIdx] || '').trim() || undefined : undefined,
            packages: pkgIdx >= 0 ? String(row[pkgIdx] || '').trim() || 'MCH' : 'MCH',
            quantities
          });
        }

        if (parsedRows.length === 0 || importedColumns.length === 0) {
          showToast('Could not detect valid facility rows and equipment columns in the Excel file.');
          return;
        }

        const primaryRegion = parsedRows[0].region || 'Regional';
        const rowDate = dateIdx >= 0 && raw[dataStartIdx]?.[dateIdx] ? String(raw[dataStartIdx][dateIdx]).trim() : detectedDate;
        const totalUnits = parsedRows.reduce(
          (sum, row) => sum + Object.values(row.quantities).reduce((s, v) => s + (Number(v) || 0), 0),
          0
        );

        const newRecord: DspWorkflowRecord = {
          id: `dsp-rhb-import-${Date.now()}`,
          dspRefNumber: `RHB/MOH-IMP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
          stage: 'rhb-to-moh',
          subStage: '3.2',
          stageTitle: '3.2 Submit Breakdown to MOH',
          senderOrg: `${primaryRegion} Regional Health Bureau`,
          recipientOrg: 'Ministry of Health (PMD Directorate)',
          dspName: `${primaryRegion} RHB Submitted Breakdown`,
          subject: `${primaryRegion} RHB Facility Breakdown Submitted to MOH (${file.name})`,
          status: 'Submitted & Pending',
          dateSubmitted: rowDate,
          totalDevices: importedColumns.length,
          totalQuantity: totalUnits,
          totalValuationETB: totalUnits * 250000,
          targetedRegions: Array.from(new Set(parsedRows.map((r) => r.region).filter(Boolean))),
          targetedFacilitiesCount: parsedRows.length,
          officialLetterRef: `RHB/${primaryRegion.slice(0, 3).toUpperCase()}/${Date.now().toString().slice(-4)}`,
          signatory: 'Regional Health Bureau Upload',
          signatoryRole: 'RHB Medical Equipment Coordinator',
          itemsIncluded: importedColumns.map((c) => ({
            material: c.code,
            description: c.name,
            quantity: parsedRows.reduce((acc, row) => acc + (Number(row.quantities[c.id]) || 0), 0),
            plant: parsedRows[0].hub || `${primaryRegion} Hub`
          })),
          facilityMatrixData: {
            date: rowDate,
            region: primaryRegion,
            columns: importedColumns,
            rows: parsedRows
          },
          notes: `Imported individual RHB breakdown Excel file (${file.name}) directly into MOH Aggregation (2.4).`
        };

        setRecords((prev) => [newRecord, ...prev]);
        onTriggerCloudSync?.(`Imported ${primaryRegion} RHB submission (${parsedRows.length} facilities)`, {
          type: 'CREATE',
          title: `Import ${primaryRegion} RHB Breakdown (${parsedRows.length} facilities)`
        });
        showToast(`✓ Added ${primaryRegion} RHB submission (${parsedRows.length} facilities, ${importedColumns.length} equipment columns)!`);
      } catch (err) {
        console.error('Failed to parse RHB Excel:', err);
        showToast('Failed to parse Excel file. Please verify the format.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveDossier = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    showToast('Removed RHB dossier from aggregation.');
  };

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleUploadRhbExcel}
        className="hidden"
      />

      {/* Dark Navy Hero Header matching Workflow UI */}
      <div className="bg-[#0B1527] text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Sub-step 2.4 • Ministry of Health Aggregation
            </span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              Only Individual RHB → MOH Submissions
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white">
            Breakdown Aggregation by RHB — All-Region Summary
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl">
            Automatically aggregates only what individual Regional Health Bureaus (RHBs) submitted to MOH, preserving every metadata, facility, package, HUB, and two-tier equipment column without omission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload RHB Submission</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={facilityRows.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export All-Region Excel</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={facilityRows.length === 0}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md border-b-4 border-amber-700 active:border-b-0 active:translate-y-[2px] transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Proceed to DSP Aggr. Submitted to EPSS (2.5)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Submitted Regions</div>
          <div className="text-xl font-black font-mono text-[#0B1527] mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span>{regionSummaries.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Individual RHBs sent to MOH</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RHB Dossiers</div>
          <div className="text-xl font-black font-mono text-indigo-700 mt-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>{submissions.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Verified RHB submissions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Health Facilities</div>
          <div className="text-xl font-black font-mono text-purple-700 mt-1 flex items-center gap-2">
            <Hospital className="w-4 h-4 text-purple-500" />
            <span>{formatNumber(facilityRows.length)}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across all submitted RHBs</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipment Columns</div>
          <div className="text-xl font-black font-mono text-slate-800 mt-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>{unifiedColumns.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">100% of RHB columns kept</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Units</div>
          <div className="text-xl font-black font-mono text-emerald-700 mt-1 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <span>{formatNumber(grandTotalUnits)}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Latest date: {latestDate}</div>
        </div>
      </div>

      {/* Controls & View Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('region-summary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'region-summary'
                ? 'bg-[#0B1527] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>All-Region Summary Table ({regionSummaries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('facility-matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'facility-matrix'
                ? 'bg-[#0B1527] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>All Facilities Matrix ({facilityRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dossiers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'dossiers'
                ? 'bg-[#0B1527] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>RHB Dossiers ({submissions.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search region, facility, zone, letter ref..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Submitted Regions ({regionSummaries.length})</option>
              {regionSummaries.map((rs) => (
                <option key={rs.region} value={rs.region}>
                  {rs.region} ({rs.facilityCount} Facilities • {formatNumber(rs.totalUnits)} Units)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty State vs Data Tables */}
      {submissions.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-1 max-w-lg mx-auto">
            <h3 className="text-base font-black text-slate-900">
              No Individual RHB Submissions Found for MOH Yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              This table aggregates <strong>only</strong> breakdowns individually submitted by Regional Health Bureaus (RHBs) to the Ministry of Health in Stage 3.2, or RHB submission Excel files uploaded here.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#0B1527] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Upload Individual RHB Excel (.xlsx)</span>
            </button>
            {onNavigateToSubmitToMoh && (
              <button
                type="button"
                onClick={onNavigateToSubmitToMoh}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Go to 3.2 Submit Breakdown to MOH</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'region-summary' ? (
        /* MODE 1: SMART ALL-REGION SUMMARY TABLE WITH EVERY COLUMN */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0B1527]" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                All-Region Aggregated Summary (RHB → MOH)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                {filteredRegionSummaries.length} Regions • {unifiedColumns.length} Equipment Columns
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Click <strong>Inspect Facilities</strong> on any region to view every individual health facility row
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                {/* Tier 1 Header: Metadata + Equipment Names */}
                <tr className="border-b border-slate-300 bg-[#0B1527] text-white">
                  <th className="p-2.5 border-r border-slate-700 text-center w-10 font-mono">S/N</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[130px]">Region</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[100px]">Date</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[150px]">DSP Ref / Name</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[120px]">Official Letter Ref</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[170px]">Sender Org & Signatory</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[130px]">Zones</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[130px]">Woredas</th>
                  <th className="p-2.5 border-r border-slate-700 text-center min-w-[85px]">Facilities</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[110px]">List of Packages</th>
                  {hasAnyHub && (
                    <th className="p-2.5 border-r border-slate-700 min-w-[100px] text-center">HUB(s)</th>
                  )}
                  {unifiedColumns.map((col) => (
                    <th
                      key={col.id}
                      className="p-2.5 border-r border-slate-700 bg-[#16233B] text-amber-100 min-w-[155px] max-w-[200px] font-semibold leading-tight"
                    >
                      <div className="line-clamp-2" title={col.name}>
                        {col.name}
                      </div>
                    </th>
                  ))}
                  <th className="p-2.5 border-r border-slate-700 text-right min-w-[100px] bg-amber-500 text-slate-950 font-black">
                    Region Total
                  </th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[120px]">Status</th>
                  <th className="p-2.5 text-center min-w-[110px]">Action</th>
                </tr>

                {/* Tier 2 Header: SAP Material Codes */}
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-[10px] font-mono text-slate-600">
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300 text-slate-500 font-sans">Submitted RHB</th>
                  <th className="p-1.5 border-r border-slate-300">YYYY-MM-DD</th>
                  <th className="p-1.5 border-r border-slate-300">Ref / Dossier</th>
                  <th className="p-1.5 border-r border-slate-300">Letter No.</th>
                  <th className="p-1.5 border-r border-slate-300">Signatory & Role</th>
                  <th className="p-1.5 border-r border-slate-300">Zone(s)</th>
                  <th className="p-1.5 border-r border-slate-300">Woreda(s)</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">HF Count</th>
                  <th className="p-1.5 border-r border-slate-300 text-center bg-blue-50 text-blue-800">Packages</th>
                  {hasAnyHub && (
                    <th className="p-1.5 border-r border-slate-300 text-center bg-yellow-50 text-amber-800">Plant / HUB</th>
                  )}
                  {unifiedColumns.map((col) => (
                    <th
                      key={`code-${col.id}`}
                      className="p-1.5 border-r border-slate-300 bg-white text-indigo-700 font-bold text-left"
                    >
                      {col.code}
                    </th>
                  ))}
                  <th className="p-1.5 border-r border-slate-300 text-right bg-amber-50 text-amber-900 font-black">
                    Units
                  </th>
                  <th className="p-1.5 border-r border-slate-300">MOH Review</th>
                  <th className="p-1.5 text-center">Drill-down</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRegionSummaries.map((rs, idx) => (
                  <tr key={rs.region} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-r border-slate-200 font-black text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{rs.region}</span>
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5">
                        {rs.dossierCount} dossier{rs.dossierCount !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-slate-200 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {rs.latestDate}
                    </td>
                    <td className="p-2.5 border-r border-slate-200">
                      <div className="font-mono font-bold text-[11px] text-indigo-700">
                        {rs.dspRefs.join(', ') || '-'}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1" title={rs.dspNames.join(', ')}>
                        {rs.dspNames.join(', ') || '-'}
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-slate-200 font-mono text-[11px] text-slate-700">
                      {rs.officialLetterRefs.join(', ') || '-'}
                    </td>
                    <td className="p-2.5 border-r border-slate-200">
                      <div className="font-bold text-slate-800 text-[11px]">{rs.senderOrgs.join(', ') || '-'}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[160px]" title={rs.signatories.join(', ')}>
                          {rs.signatories.join(', ') || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-slate-200">
                      <span className="font-bold text-slate-800">{rs.zones.length}</span>{' '}
                      <span className="text-[10px] text-slate-500">
                        ({rs.zones.slice(0, 2).join(', ')}
                        {rs.zones.length > 2 ? ` +${rs.zones.length - 2}` : ''})
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-slate-200">
                      <span className="font-bold text-slate-800">{rs.woredas.length}</span>{' '}
                      <span className="text-[10px] text-slate-500">
                        ({rs.woredas.slice(0, 2).join(', ')}
                        {rs.woredas.length > 2 ? ` +${rs.woredas.length - 2}` : ''})
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-slate-200 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-black">
                        {rs.facilityCount}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-slate-200 bg-blue-50/40">
                      <div className="flex flex-wrap gap-1">
                        {rs.packages.map((pkg) => (
                          <span
                            key={pkg}
                            className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]"
                          >
                            {pkg}
                          </span>
                        ))}
                      </div>
                    </td>
                    {hasAnyHub && (
                      <td className="p-2.5 border-r border-slate-200 text-center bg-yellow-50/40 font-mono font-bold text-amber-900">
                        {rs.hubs.join(', ') || '-'}
                      </td>
                    )}
                    {unifiedColumns.map((col) => {
                      const val = rs.columnTotals[col.id] || 0;
                      return (
                        <td
                          key={`${rs.region}-${col.id}`}
                          className={`p-2.5 border-r border-slate-200 text-right font-mono ${
                            val > 0 ? 'font-black text-slate-900' : 'text-slate-300'
                          }`}
                        >
                          {val > 0 ? formatNumber(val) : '0'}
                        </td>
                      );
                    })}
                    <td className="p-2.5 border-r border-slate-200 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                      {formatNumber(rs.totalUnits)}
                    </td>
                    <td className="p-2.5 border-r border-slate-200">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 whitespace-nowrap">
                        {rs.statuses[0] || 'Submitted to MOH'}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleInspectRegion(rs.region)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0B1527] hover:text-white text-slate-700 font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <td colSpan={8} className="p-3 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    National Aggregated Total ({filteredRegionSummaries.length} Regions)
                  </td>
                  <td className="p-3 border-r border-slate-300 text-center font-mono text-purple-900">
                    {formatNumber(filteredFacilityRows.length)} HFs
                  </td>
                  <td className="p-3 border-r border-slate-300"></td>
                  {hasAnyHub && <td className="p-3 border-r border-slate-300"></td>}
                  {unifiedColumns.map((col) => (
                    <td
                      key={`sum-tot-${col.id}`}
                      className="p-3 border-r border-slate-300 text-right font-mono text-indigo-900 bg-amber-50/70"
                    >
                      {formatNumber(
                        filteredRegionSummaries.reduce((s, r) => s + (r.columnTotals[col.id] || 0), 0)
                      )}
                    </td>
                  ))}
                  <td className="p-3 border-r border-slate-300 text-right font-mono text-emerald-900 bg-emerald-100">
                    {formatNumber(
                      filteredRegionSummaries.reduce((s, r) => s + r.totalUnits, 0)
                    )}
                  </td>
                  <td colSpan={2} className="p-3 bg-slate-100"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : viewMode === 'facility-matrix' ? (
        /* MODE 2: CONSOLIDATED ALL-FACILITY MATRIX (ZERO COLUMNS OMITTED) */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Consolidated Health Facility Breakdown Matrix (Every Column Sent by RHBs)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                {filteredFacilityRows.length} Facilities • {unifiedColumns.length} Equipment Columns
              </span>
            </div>
            {selectedRegion !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedRegion('all')}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
              >
                Show All Regions
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#0B1527] text-white">
                  <th className="p-2.5 border-r border-slate-700 text-center w-10 font-mono">S/N</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[95px]">Date</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[140px]">DSP Ref / Name</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[115px]">Official Letter Ref</th>
                  <th className="p-2.5 border-r border-slate-700 min-w-[155px]">Sender Org / Signatory</th>
                  <th className="p-2.5 border-r border-slate-700 bg-[#fed7aa] text-slate-900 font-bold min-w-[115px]">Region</th>
                  <th className="p-2.5 border-r border-slate-700 bg-[#fed7aa] text-slate-900 font-bold min-w-[120px]">Zone</th>
                  <th className="p-2.5 border-r border-slate-700 bg-[#fef08a] text-slate-900 font-bold min-w-[90px]">Woreda</th>
                  <th className="p-2.5 border-r border-slate-700 bg-[#fed7aa] text-slate-900 font-bold min-w-[210px]">
                    Name of health facility
                  </th>
                  <th className="p-2.5 border-r border-slate-700 bg-[#dbeafe] text-slate-900 font-bold min-w-[110px] text-center">
                    List of Packages
                  </th>
                  {hasAnyHub && (
                    <th className="p-2.5 border-r border-slate-700 bg-yellow-300 text-slate-900 font-black min-w-[85px] text-center">
                      HUB
                    </th>
                  )}
                  {unifiedColumns.map((col) => (
                    <th
                      key={`fac-h-${col.id}`}
                      className="p-2.5 border-r border-slate-700 bg-[#fed7aa] text-slate-900 font-semibold min-w-[155px] max-w-[200px] leading-tight"
                    >
                      <div className="line-clamp-2" title={col.name}>
                        {col.name}
                      </div>
                    </th>
                  ))}
                  <th className="p-2.5 border-r border-slate-700 bg-amber-500 text-slate-950 font-black text-right min-w-[90px]">
                    Row Total
                  </th>
                  <th className="p-2.5 min-w-[115px]">Status</th>
                </tr>

                <tr className="border-b-2 border-slate-300 bg-slate-50 text-[10px] font-mono">
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300"></th>
                  <th className="p-1.5 border-r border-slate-300 bg-[#ffedd5]"></th>
                  <th className="p-1.5 border-r border-slate-300 bg-[#ffedd5]"></th>
                  <th className="p-1.5 border-r border-slate-300 bg-[#fef9c3]"></th>
                  <th className="p-1.5 border-r border-slate-300 bg-[#ffedd5] text-slate-500">Customer Description / ID</th>
                  <th className="p-1.5 border-r border-slate-300 bg-[#dbeafe] text-blue-900 text-center">List of Packages</th>
                  {hasAnyHub && (
                    <th className="p-1.5 border-r border-slate-300 bg-yellow-100 text-amber-900 text-center">Plant</th>
                  )}
                  {unifiedColumns.map((col) => (
                    <th
                      key={`fac-c-${col.id}`}
                      className="p-1.5 border-r border-slate-300 bg-white text-indigo-700 font-bold text-left"
                    >
                      {col.code}
                    </th>
                  ))}
                  <th className="p-1.5 border-r border-slate-300 bg-amber-50 text-right text-amber-900 font-bold">Units</th>
                  <th className="p-1.5"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredFacilityRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {row.submissionDate}
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="font-mono font-bold text-[11px] text-indigo-700">{row.dspRefNumber}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={row.dspName}>
                        {row.dspName}
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-700">
                      {row.officialLetterRef}
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="text-[11px] font-bold text-slate-800 truncate max-w-[160px]" title={row.senderOrg}>
                        {row.senderOrg}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                        {row.signatory}
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.region}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-700">{row.zone}</td>
                    <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">{row.woreda}</td>
                    <td className="p-2 border-r border-slate-200 font-semibold text-slate-900">
                      <div>{row.healthFacility}</div>
                      {row.customerId && (
                        <div className="text-[10px] font-mono text-slate-400">ID: {row.customerId}</div>
                      )}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center bg-[#eff6ff] font-bold text-blue-900">
                      {row.packages}
                    </td>
                    {hasAnyHub && (
                      <td className="p-2 border-r border-slate-200 text-center bg-yellow-50 font-mono font-bold text-amber-900">
                        {row.hub || '-'}
                      </td>
                    )}
                    {unifiedColumns.map((col) => {
                      const q = Number(row.quantities[col.id]) || 0;
                      return (
                        <td
                          key={`${row.id}-${col.id}`}
                          className={`p-2 border-r border-slate-200 text-right font-mono ${
                            q > 0 ? 'font-bold text-slate-900' : 'text-slate-300'
                          }`}
                        >
                          {q}
                        </td>
                      );
                    })}
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                      {formatNumber(row.rowTotal)}
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <td colSpan={hasAnyHub ? 11 : 10} className="p-3 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    Consolidated Total ({filteredFacilityRows.length} Health Facilities)
                  </td>
                  {unifiedColumns.map((col) => (
                    <td
                      key={`fac-tot-${col.id}`}
                      className="p-3 border-r border-slate-300 text-right font-mono text-indigo-900 bg-amber-50/70"
                    >
                      {formatNumber(filteredColumnTotals[col.id] || 0)}
                    </td>
                  ))}
                  <td className="p-3 border-r border-slate-300 text-right font-mono text-emerald-900 bg-emerald-100">
                    {formatNumber(filteredGrandTotal)}
                  </td>
                  <td className="p-3 bg-slate-100"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* MODE 3: INDIVIDUAL RHB DOSSIERS INCLUDED IN AGGREGATION */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {submissions.map((rec) => {
            const facCount = rec.facilityMatrixData?.rows?.length || rec.targetedFacilitiesCount || 0;
            const colCount = rec.facilityMatrixData?.columns?.length || rec.itemsIncluded?.length || 0;
            return (
              <div
                key={rec.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-400 transition flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {rec.dspRefNumber}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {rec.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 leading-snug">{rec.subject}</h4>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold">{rec.senderOrg}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Submitted: <strong>{rec.dateSubmitted}</strong> • Letter: <strong>{rec.officialLetterRef || '-'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {rec.signatory} ({rec.signatoryRole})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3 font-mono font-bold text-slate-700">
                    <span>{facCount} HFs</span>
                    <span>{colCount} Cols</span>
                    <span className="text-emerald-700">{formatNumber(rec.totalQuantity)} Units</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rec.targetedRegions?.[0] && (
                      <button
                        type="button"
                        onClick={() => handleInspectRegion(rec.targetedRegions[0])}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-[#0B1527] hover:text-white text-slate-700 font-bold text-[10px] cursor-pointer transition"
                      >
                        Inspect
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveDossier(rec.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                      title="Remove dossier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Next Step Guidance Bar */}
      {submissions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-900">
              Next Workflow Step → 2.5 DSP Aggr. Submitted to EPSS
            </div>
            <p className="text-xs text-amber-800">
              Ready to forward <strong>{regionSummaries.length} region(s)</strong>,{' '}
              <strong>{facilityRows.length} health facilities</strong>, and all{' '}
              <strong>{unifiedColumns.length} equipment columns</strong> ({formatNumber(grandTotalUnits)} total units) to{' '}
              <strong>2.5 DSP Aggr. Submitted to EPSS</strong> for final MOH → EPSS submission.
            </p>
          </div>
          <button
            type="button"
            onClick={handleProceed}
            className="px-5 py-2.5 rounded-xl bg-[#0B1527] hover:bg-black text-amber-400 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shrink-0 shadow-md transition"
          >
            <span>Proceed to 2.5 DSP Aggr. Submitted to EPSS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
