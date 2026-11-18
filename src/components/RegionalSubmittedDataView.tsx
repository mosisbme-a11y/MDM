import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, RegionBreakdownColumn, RegionBreakdownRow } from '../types';
import { formatNumber } from '../utils/formatters';
import {
  Building2,
  Layers,
  AlertCircle,
  FileSpreadsheet,
  Hospital,
  Eye,
  Check,
  Download,
  Search,
  Calendar,
  FileText,
  ArrowRight,
  UserCheck,
  Mail,
  MessageCircle,
  Send
} from 'lucide-react';
import { isRhbSubmittedToMohRecord, aggregateRhbSubmissionsToMoh } from '../utils/rhbAggregation';

interface Props {
  records: DspWorkflowRecord[];
  onSelectSubTab?: (tab: EpssSubTab) => void;
}

export const RegionalSubmittedDataView: React.FC<Props> = ({ records, onSelectSubTab }) => {
  const regionalRecords = useMemo(
    () =>
      records
        .filter(isRhbSubmittedToMohRecord)
        .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime()),
    [records]
  );

  const [selectedDossierId, setSelectedDossierId] = useState<string>(() => regionalRecords[0]?.id || '');
  const [checkedDossierIds, setCheckedDossierIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'single' | 'consolidated'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleResendEmail = () => {
    if (!selectedDossier) return;
    const subject = encodeURIComponent(`[RESEND] Official RHB Breakdown Dossier #${selectedDossier.dspRefNumber} - MOH Logistics Desk`);
    const body = encodeURIComponent(`Dear EPSS & MOH Logistics Desk,\n\nResending official Regional Health Bureau Health Facility Breakdown Dossier:\n- Ref No: ${selectedDossier.dspRefNumber}\n- Subject: ${selectedDossier.dspName || selectedDossier.subject}\n- Sender: ${selectedDossier.senderOrg}\n- Signatory: ${selectedDossier.signatory} (${selectedDossier.signatoryRole})\n- Total Facilities: ${filteredSelectedRows.length}\n- Total Units: ${selectedGrandTotal}\n- Date Submitted: ${selectedDossier.dateSubmitted}\n\nBest regards,\n${selectedDossier.senderOrg}`);
    window.location.href = `mailto:hubs-dispatch@epss.gov.et,moh-dsp@moh.gov.et?subject=${subject}&body=${body}`;
    showToast(`✓ Opened email client to resend dossier #${selectedDossier.dspRefNumber} to MOH & Hub Desk.`);
  };

  const handleResendWhatsApp = () => {
    if (!selectedDossier) return;
    const text = encodeURIComponent(`*🏥 MINISTRY OF HEALTH - EPSS LOGISTICS DESK*\n*RESEND OFFICIAL RHB BREAKDOWN DOSSIER*\n*Ref No:* ${selectedDossier.dspRefNumber}\n*Region / Sender:* ${selectedDossier.senderOrg}\n*Facilities:* ${filteredSelectedRows.length} | *Units:* ${selectedGrandTotal}\n*Status:* Verified & Resent`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    showToast(`✓ Opened WhatsApp Web to resend dossier #${selectedDossier.dspRefNumber} to Regional Hub Desk.`);
  };

  useEffect(() => {
    if (regionalRecords.length > 0 && checkedDossierIds.length === 0) {
      setCheckedDossierIds(regionalRecords.map(r => r.id));
    }
  }, [regionalRecords]);

  useEffect(() => {
    if (regionalRecords.length > 0 && !regionalRecords.some(r => r.id === selectedDossierId)) {
      setSelectedDossierId(regionalRecords[0].id);
    } else if (regionalRecords.length === 0 && selectedDossierId !== '') {
      setSelectedDossierId('');
    }
  }, [regionalRecords, selectedDossierId]);

  const selectedDossier = useMemo(() => {
    return regionalRecords.find(r => r.id === selectedDossierId) || regionalRecords[0] || null;
  }, [regionalRecords, selectedDossierId]);

  // Exact columns & rows for the selected 1-to-1 RHB dossier
  const { selectedColumns, selectedRows } = useMemo(() => {
    if (!selectedDossier) {
      return { selectedColumns: [] as RegionBreakdownColumn[], selectedRows: [] as RegionBreakdownRow[] };
    }
    const cols: RegionBreakdownColumn[] =
      selectedDossier.facilityMatrixData?.columns && selectedDossier.facilityMatrixData.columns.length > 0
        ? selectedDossier.facilityMatrixData.columns
        : (selectedDossier.itemsIncluded || []).map((it, idx) => ({
            id: `rhb-col-${idx}-${it.material}`,
            name: it.description,
            code: it.material
          }));

    let rows: RegionBreakdownRow[] = [];
    if (selectedDossier.facilityMatrixData?.rows && selectedDossier.facilityMatrixData.rows.length > 0) {
      rows = selectedDossier.facilityMatrixData.rows;
    } else if (selectedDossier.itemsIncluded && selectedDossier.itemsIncluded.length > 0) {
      const qObj: Record<string, number> = {};
      cols.forEach((c, idx) => {
        qObj[c.id] = Number(selectedDossier.itemsIncluded[idx]?.quantity) || 0;
      });
      rows = [
        {
          id: `${selectedDossier.id}-summary`,
          date: selectedDossier.dateSubmitted,
          region: selectedDossier.targetedRegions?.[0] || 'Regional',
          zone: '-',
          woreda: '-',
          hub: selectedDossier.itemsIncluded[0]?.plant || '',
          healthFacility: `${selectedDossier.targetedRegions?.[0] || 'Regional'} Consolidated Allocation`,
          packages: 'MCH',
          quantities: qObj
        }
      ];
    }
    return { selectedColumns: cols, selectedRows: rows };
  }, [selectedDossier]);

  const filteredSelectedRows = useMemo(() => {
    if (!searchQuery.trim()) return selectedRows;
    const q = searchQuery.toLowerCase();
    return selectedRows.filter(
      row =>
        row.region?.toLowerCase().includes(q) ||
        row.zone?.toLowerCase().includes(q) ||
        row.woreda?.toLowerCase().includes(q) ||
        row.healthFacility?.toLowerCase().includes(q) ||
        row.packages?.toLowerCase().includes(q)
    );
  }, [selectedRows, searchQuery]);

  const selectedColumnTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    selectedColumns.forEach(c => {
      sums[c.id] = filteredSelectedRows.reduce((acc, r) => acc + (Number(r.quantities?.[c.id]) || 0), 0);
    });
    return sums;
  }, [selectedColumns, filteredSelectedRows]);

  const selectedGrandTotal = useMemo(
    () => Object.values(selectedColumnTotals).reduce((a, b) => a + b, 0),
    [selectedColumnTotals]
  );

  // Consolidated across checked RHB dossiers
  const consolidated = useMemo(() => {
    const subset = records.filter(r => checkedDossierIds.includes(r.id));
    return aggregateRhbSubmissionsToMoh(subset);
  }, [records, checkedDossierIds]);

  const handleExportSelectedExcel = () => {
    if (!selectedDossier) return;
    const header1 = [
      'S/N',
      'Date',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packages',
      ...selectedColumns.map(c => c.name),
      'Total'
    ];
    const header2 = ['', '', '', '', '', '', 'Packages', ...selectedColumns.map(c => c.code), 'Units'];
    const dataRows = filteredSelectedRows.map((row, idx) => {
      const rTotal = selectedColumns.reduce((s, c) => s + (Number(row.quantities?.[c.id]) || 0), 0);
      return [
        idx + 1,
        row.date || selectedDossier.facilityMatrixData?.date || selectedDossier.dateSubmitted,
        row.region,
        row.zone,
        row.woreda,
        row.healthFacility,
        row.packages || 'MCH',
        ...selectedColumns.map(c => Number(row.quantities?.[c.id]) || 0),
        rTotal
      ];
    });
    const footerRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      `${filteredSelectedRows.length} Facilities`,
      '',
      ...selectedColumns.map(c => selectedColumnTotals[c.id] || 0),
      selectedGrandTotal
    ];

    const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...dataRows, footerRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RHB_Submitted_Matrix');
    XLSX.writeFile(wb, `RHB_to_MOH_Dossier_${selectedDossier.dspRefNumber.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <Layers className="w-5 h-5 text-amber-600" />
              2.3 Breakdown Received from RHB (RHB ➔ MOH Exact Dossiers)
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Select any Regional Health Bureau submission below to inspect its exact Health Facility Breakdown Matrix as transmitted in Sub-step 3.2.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span className="text-[11px] font-black text-amber-700 font-mono">
                {regionalRecords.length} RHB Dossier{regionalRecords.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 flex items-center gap-2">
              <Hospital className="w-4 h-4 text-purple-600" />
              <span className="text-[11px] font-black text-purple-700 font-mono">
                {consolidated.facilityRows.length} Total Facilities
              </span>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  viewMode === 'single' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selected Dossier (1-to-1)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('consolidated')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  viewMode === 'consolidated' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All RHBs Combined
              </button>
            </div>

            {onSelectSubTab && (
              <button
                type="button"
                onClick={() => onSelectSubTab('dsp-moh-2-4')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <span>Proceed to 2.4 Aggregation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {regionalRecords.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">No RHB breakdown dossiers submitted to MOH yet.</p>
            <p className="text-xs text-slate-400">
              When a Regional Health Bureau submits its Health Facility Breakdown Matrix in Sub-step 3.2, the exact dossier will appear here.
            </p>
          </div>
        ) : (
          /* Spreadsheet Table Format matching requested columns */
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#fed7aa] text-slate-950 font-black border-b border-slate-300">
                  <th className="p-2.5 border-r border-slate-300 text-center w-12 font-mono">S/N</th>
                  <th className="p-2.5 border-r border-slate-300 italic min-w-[100px]">Date</th>
                  <th className="p-2.5 border-r border-slate-300 italic min-w-[160px]">Name of Region</th>
                  <th className="p-2.5 border-r border-slate-300 italic min-w-[180px]">DSP Name</th>
                  <th className="p-2.5 border-r border-slate-300 italic min-w-[180px]">Authorized Person</th>
                  <th className="p-2.5 border-r border-slate-300 text-center w-24">View</th>
                  <th className="p-2.5 text-center w-20">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {regionalRecords.map((record, idx) => {
                  const isSelected = selectedDossier?.id === record.id && viewMode === 'single';
                  const isChecked = checkedDossierIds.includes(record.id);
                  const regionName = record.targetedRegions?.join(', ') || record.senderOrg || 'Regional';
                  return (
                    <tr 
                      key={record.id}
                      className={`transition-colors hover:bg-amber-50/50 ${isSelected ? 'bg-amber-50/80 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                    >
                      <td className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                        {record.dateSubmitted}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-black text-slate-900">
                        {regionName}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-bold text-amber-900">
                        {record.dspName || record.subject || record.dspRefNumber}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-slate-800">
                        {record.signatory || record.senderOrg || 'RHB Coordinator'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDossierId(record.id);
                            setViewMode('single');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-amber-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckedDossierIds(prev => [...prev, record.id]);
                            } else {
                              setCheckedDossierIds(prev => prev.filter(id => id !== record.id));
                            }
                            setViewMode('consolidated');
                          }}
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          title="Select to aggregate across regions"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected RHB Dossier 1-to-1 Matrix Inspector */}
      {regionalRecords.length > 0 && viewMode === 'single' && selectedDossier && (
        <div className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-[#0B1527] text-white p-5 border-b-2 border-amber-400 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-400 text-slate-950 rounded-xl shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Exact RHB ➔ MOH Dossier Sent Data
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">
                    {selectedDossier.dspRefNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px] text-amber-200">
                    Letter: {selectedDossier.officialLetterRef}
                  </span>
                </div>
                <h4 className="text-base font-black text-white mt-1">
                  {selectedDossier.dspName || selectedDossier.subject}
                </h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300 mt-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    Sender: <strong className="text-white">{selectedDossier.senderOrg}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Signatory:{' '}
                    <strong className="text-white">
                      {selectedDossier.signatory} ({selectedDossier.signatoryRole})
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Date: <strong className="font-mono text-white">{selectedDossier.dateSubmitted}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResendEmail}
                className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                title="Resend official dossier via Email to MOH & Hub Dispatch Desk"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Resend Email</span>
              </button>

              <button
                type="button"
                onClick={handleResendWhatsApp}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                title="Resend official dossier via WhatsApp to Regional Hub Coordinators"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Resend WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleExportSelectedExcel}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search health facility, zone, woreda, package..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-xs font-mono font-bold text-slate-600">
              Showing <strong>{filteredSelectedRows.length}</strong> of {selectedRows.length} Facilities •{' '}
              <strong className="text-amber-700">{formatNumber(selectedGrandTotal)}</strong> Units
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="font-semibold">
                  <th className="bg-[#fed7aa] text-slate-900 border border-slate-300 py-2 px-2.5 text-center w-12">
                    S/N
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[95px]">
                    Date
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[110px]">
                    Region
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[120px]">
                    Zone
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[110px]">
                    Woreda
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[210px]">
                    Name of health facility
                  </th>
                  <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-300 py-2 px-3 min-w-[110px] text-center">
                    List of Packages
                  </th>
                  {selectedColumns.map(col => (
                    <th
                      key={col.id}
                      className="bg-[#fed7aa] text-slate-900 font-semibold border border-slate-300 py-2 px-2 text-center min-w-[135px] leading-tight"
                    >
                      {col.name}
                    </th>
                  ))}
                  <th className="bg-[#fde047]/70 text-slate-900 font-black border border-slate-300 py-2 px-2.5 text-center min-w-[75px]">
                    Total
                  </th>
                </tr>
                <tr className="text-[11px] font-mono">
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-2"></th>
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border border-slate-300 py-1 px-3"></th>
                  <th className="bg-[#dbeafe] text-slate-800 border border-slate-300 py-1 px-3 text-center font-sans text-[10px]">
                    Packages
                  </th>
                  {selectedColumns.map(col => (
                    <th
                      key={`code-${col.id}`}
                      className="bg-white text-slate-800 border border-slate-300 py-1 px-2 text-center font-bold"
                    >
                      {col.code}
                    </th>
                  ))}
                  <th className="bg-[#fef9c3] border border-slate-300 py-1 px-2 text-center font-sans text-[10px]">
                    Units
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSelectedRows.map((fac, idx) => {
                  const rowTotal = selectedColumns.reduce(
                    (s, c) => s + (Number(fac.quantities?.[c.id]) || 0),
                    0
                  );
                  return (
                    <tr
                      key={`${selectedDossier.id}-${fac.id}-${idx}`}
                      className={`hover:bg-amber-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                    >
                      <td className="p-2.5 border border-slate-200 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                        {fac.date || selectedDossier.facilityMatrixData?.date || selectedDossier.dateSubmitted}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-bold text-slate-800">{fac.region}</td>
                      <td className="p-2.5 border border-slate-200 text-slate-600">{fac.zone || '-'}</td>
                      <td className="p-2.5 border border-slate-200 text-slate-600">{fac.woreda || '-'}</td>
                      <td className="p-2.5 border border-slate-200 font-black text-slate-900">{fac.healthFacility}</td>
                      <td className="p-2.5 border border-slate-200 text-center bg-[#eff6ff]/60">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                          {fac.packages || 'MCH'}
                        </span>
                      </td>
                      {selectedColumns.map(col => (
                        <td
                          key={col.id}
                          className="p-2.5 border border-slate-200 text-center font-mono font-black text-amber-800 bg-amber-50/10"
                        >
                          {formatNumber(Number(fac.quantities?.[col.id]) || 0)}
                        </td>
                      ))}
                      <td className="p-2.5 border border-slate-200 text-center font-mono font-black text-slate-900 bg-amber-100/50">
                        {formatNumber(rowTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-500 text-xs">
                  <td colSpan={7} className="p-3 text-right uppercase tracking-wider font-mono text-amber-300">
                    Total Sent by {selectedDossier.senderOrg} ({filteredSelectedRows.length} Facilities):
                  </td>
                  {selectedColumns.map(col => (
                    <td
                      key={`sum-${col.id}`}
                      className="p-3 text-center border-r border-slate-700 font-mono text-amber-300"
                    >
                      {formatNumber(selectedColumnTotals[col.id] || 0)}
                    </td>
                  ))}
                  <td className="p-3 text-center font-mono text-emerald-400 bg-slate-950">
                    {formatNumber(selectedGrandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Optional Consolidated View Across All Submitted RHBs */}
      {regionalRecords.length > 0 && viewMode === 'consolidated' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Consolidated RHB Facility Submissions ({consolidated.facilityRows.length} Facilities across{' '}
              {consolidated.regionSummaries.length} Regions)
            </h4>
            <span className="text-xs font-mono font-black text-amber-700">
              Grand Total: {formatNumber(consolidated.grandTotalUnits)} Units
            </span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/20">
            <table className="w-full text-left border-collapse min-w-[1100px] text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                  <th className="p-3 border-r border-slate-200">DSP Ref</th>
                  <th className="p-3 border-r border-slate-200">Date</th>
                  <th className="p-3 border-r border-slate-200">Region</th>
                  <th className="p-3 border-r border-slate-200">Zone</th>
                  <th className="p-3 border-r border-slate-200">Woreda</th>
                  <th className="p-3 border-r border-slate-200 min-w-[200px]">Health Facility</th>
                  <th className="p-3 border-r border-slate-200">Package</th>
                  {consolidated.unifiedColumns.map(col => (
                    <th key={col.id} className="p-3 border-r border-slate-200 text-center min-w-[140px] bg-white">
                      <div className="text-slate-900 leading-tight">{col.name}</div>
                      <div className="text-[9px] font-mono font-normal text-slate-400 mt-1">{col.code}</div>
                    </th>
                  ))}
                  <th className="p-3 text-center bg-amber-100 text-amber-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consolidated.facilityRows.map((fac, idx) => (
                  <tr key={`${fac.dspRefNumber}-${fac.id}-${idx}`} className="hover:bg-amber-50/30 transition-colors bg-white">
                    <td className="p-3 border-r border-slate-100 font-mono text-[10px] font-bold text-slate-500">
                      {fac.dspRefNumber}
                    </td>
                    <td className="p-3 border-r border-slate-100 font-mono text-slate-600">{fac.submissionDate}</td>
                    <td className="p-3 border-r border-slate-100 font-bold text-slate-800">{fac.region}</td>
                    <td className="p-3 border-r border-slate-100 text-slate-600">{fac.zone}</td>
                    <td className="p-3 border-r border-slate-100 text-slate-600">{fac.woreda}</td>
                    <td className="p-3 border-r border-slate-100 font-black text-slate-900">{fac.healthFacility}</td>
                    <td className="p-3 border-r border-slate-100">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[9px]">
                        {fac.packages}
                      </span>
                    </td>
                    {consolidated.unifiedColumns.map(col => (
                      <td key={col.id} className="p-3 border-r border-slate-100 text-center font-black text-amber-700 font-mono bg-amber-50/10">
                        {fac.quantities[col.id] || 0}
                      </td>
                    ))}
                    <td className="p-3 text-center font-mono font-black text-slate-900 bg-amber-50/50">
                      {formatNumber(fac.rowTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 font-black text-white border-t-2 border-slate-300">
                  <td colSpan={7} className="p-3 text-right uppercase tracking-wider text-xs text-amber-300">
                    Total Consolidated Quantity:
                  </td>
                  {consolidated.unifiedColumns.map(col => (
                    <td key={col.id} className="p-3 text-center border-r border-slate-700 text-amber-300 font-mono">
                      {formatNumber(consolidated.columnTotals[col.id] || 0)}
                    </td>
                  ))}
                  <td className="p-3 text-center font-mono text-emerald-400 bg-slate-950">
                    {formatNumber(consolidated.grandTotalUnits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
