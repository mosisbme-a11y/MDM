import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Printer,
  Building2,
  Layers,
  MapPin,
  CheckCircle2,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord } from '../types';
import { formatNumber } from '../utils/formatters';

interface DossierFacilityMatrixDetailsTableProps {
  data: any;
  record: DspWorkflowRecord;
  title?: string;
  subtitle?: string;
}

export const DossierFacilityMatrixDetailsTable: React.FC<DossierFacilityMatrixDetailsTableProps> = ({
  data,
  record,
  title = 'Exact Sent Health Facility Breakdown Matrix',
  subtitle = 'Official two-tier equipment allocation matrix as transmitted (RHB / MOH Format)'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('all');

  // Normalize columns and rows safely from data
  const matrixDate = data?.date || record.dateSubmitted || new Date().toISOString().split('T')[0];

  const columns = useMemo<{ id: string; name: string; code: string }[]>(() => {
    if (!data?.columns || !Array.isArray(data.columns)) return [];
    return data.columns.map((c: any) => ({
      id: String(c.id),
      name: String(c.name || 'Equipment Item'),
      code: String(c.code || 'SAP-CODE')
    }));
  }, [data]);

  const rows = useMemo<any[]>(() => {
    if (!data?.rows || !Array.isArray(data.rows)) return [];
    return data.rows.map((r: any, idx: number) => ({
      id: r.id || `hf-row-${idx}`,
      date: r.date || matrixDate,
      region: r.region || 'Unspecified',
      zone: r.zone || '-',
      woreda: r.woreda || '-',
      healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
      customerDescription: r.customerDescription || '',
      packages: r.packages || 'WB',
      quantities: r.quantities || {}
    }));
  }, [data, matrixDate]);

  // Unique regions
  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.region).filter(Boolean))).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r => {
      const matchRegion = selectedRegionFilter === 'all' || r.region.toLowerCase() === selectedRegionFilter.toLowerCase();
      const matchSearch =
        !q ||
        r.region.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.woreda.toLowerCase().includes(q) ||
        r.healthFacility.toLowerCase().includes(q) ||
        (r.customerDescription && r.customerDescription.toLowerCase().includes(q)) ||
        r.packages.toLowerCase().includes(q);

      return matchRegion && matchSearch;
    });
  }, [rows, selectedRegionFilter, searchQuery]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      totals[col.id] = filteredRows.reduce((acc, row) => acc + (Number(row.quantities[col.id]) || 0), 0);
    });
    return totals;
  }, [columns, filteredRows]);

  // Grand total units
  const grandTotal = useMemo(() => {
    return Object.values(columnTotals).reduce((a, b) => a + b, 0);
  }, [columnTotals]);

  // Export to Excel
  const handleExportExcel = () => {
    const headerRow1 = [
      'S/N',
      'Date',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packages',
      ...columns.map(c => c.name),
      'Total'
    ];

    const headerRow2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      'List of Packages',
      ...columns.map(c => c.code),
      'Units'
    ];

    const bodyRows = filteredRows.map((r, idx) => {
      const rowSum = columns.reduce((acc, c) => acc + (Number(r.quantities[c.id]) || 0), 0);
      return [
        idx + 1,
        r.date || matrixDate,
        r.region,
        r.zone,
        r.woreda,
        r.healthFacility,
        r.packages,
        ...columns.map(c => Number(r.quantities[c.id]) || 0),
        rowSum
      ];
    });

    const footerRow = [
      'TOTAL APPROVED ALLOCATION',
      '',
      '',
      '',
      '',
      `${filteredRows.length} Health Facilities`,
      'TOTAL',
      ...columns.map(c => columnTotals[c.id] || 0),
      grandTotal
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', matrixDate],
      headerRow1,
      headerRow2,
      ...bodyRows,
      footerRow
    ]);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 13 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 32 },
      { wch: 16 },
      ...columns.map(() => ({ wch: 22 })),
      { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HF_Breakdown_Matrix');
    const safeRef = (record.dspRefNumber || 'Dossier').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Exact_Health_Facility_Matrix_${safeRef}_${matrixDate}.xlsx`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const esc = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headerRow1 = [
      'S/N',
      'Date',
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packages',
      ...columns.map(c => c.name),
      'Total'
    ];
    const headerRow2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      'List of Packages',
      ...columns.map(c => c.code),
      'Units'
    ];

    const bodyRows = filteredRows.map((r, idx) => {
      const rowSum = columns.reduce((acc, c) => acc + (Number(r.quantities[c.id]) || 0), 0);
      return [
        idx + 1,
        esc(r.date || matrixDate),
        esc(r.region),
        esc(r.zone),
        esc(r.woreda),
        esc(r.healthFacility),
        esc(r.packages),
        ...columns.map(c => Number(r.quantities[c.id]) || 0),
        rowSum
      ].join(',');
    });

    const footerRow = [
      esc('TOTAL APPROVED ALLOCATION'),
      '',
      '',
      '',
      '',
      esc(`${filteredRows.length} Health Facilities`),
      esc('TOTAL'),
      ...columns.map(c => columnTotals[c.id] || 0),
      grandTotal
    ].join(',');

    const csvContent = [
      ['Date', esc(matrixDate)].join(','),
      headerRow1.map(esc).join(','),
      headerRow2.map(esc).join(','),
      ...bodyRows,
      footerRow
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeRef = (record.dspRefNumber || 'Dossier').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `Exact_Health_Facility_Matrix_${safeRef}_${matrixDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3.5">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-sm shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                {title}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase font-mono border border-amber-200">
                Official Two-Tier Dossier Format
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Read-Only Export Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Download complete two-tier breakdown matrix in Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-sm active:scale-95"
            title="Download complete two-tier breakdown matrix in CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition shadow-2xs"
            title="Print dossier matrix"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Health Facilities</div>
            <div className="text-base font-black text-slate-900 font-mono">{filteredRows.length} Facilities</div>
          </div>
          <Building2 className="w-4 h-4 text-indigo-600" />
        </div>

        <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Equipment Types</div>
            <div className="text-base font-black text-purple-700 font-mono">{columns.length} Items</div>
          </div>
          <Layers className="w-4 h-4 text-purple-600" />
        </div>

        <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Total Allocated Units</div>
            <div className="text-base font-black text-emerald-700 font-mono">{formatNumber(grandTotal)} Units</div>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>

        <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Regions Covered</div>
            <div className="text-base font-black text-amber-700 font-mono">{uniqueRegions.length} Regions</div>
          </div>
          <MapPin className="w-4 h-4 text-amber-600" />
        </div>
      </div>

      {/* Search & Region Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility, woreda, zone, region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Regions ({uniqueRegions.length})</option>
              {uniqueRegions.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          <span className="text-xs font-bold text-slate-500 font-mono px-2">
            Showing {filteredRows.length} of {rows.length} Facilities
          </span>
        </div>
      </div>

      {/* TWO-TIER FULL COLUMNS HEALTH FACILITY MATRIX TABLE */}
      {rows.length > 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-left border-collapse select-text text-xs">
              <thead className="sticky top-0 z-10 shadow-xs">
                {/* Header Row 1: Item Descriptions */}
                <tr className="font-bold border-b border-slate-400">
                  <th className="bg-[#fed7aa] text-slate-900 border-r border-slate-400 py-2.5 px-3 text-center w-12 shrink-0">
                    S/N
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[105px]">
                    Date
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[110px]">
                    Region
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[120px]">
                    Zone
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[100px]">
                    Woreda
                  </th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[240px]">
                    Name of health facility
                  </th>
                  <th className="bg-[#dbeafe] text-slate-900 italic border-r border-slate-400 py-2.5 px-3 min-w-[120px] text-center">
                    List of Packages
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.id}
                      className="bg-[#fed7aa] text-slate-900 border-r border-slate-400 py-2.5 px-3 text-center min-w-[150px] leading-tight font-semibold"
                      title={col.name}
                    >
                      <div className="line-clamp-2">{col.name}</div>
                    </th>
                  ))}
                  <th className="bg-[#fde047] text-slate-950 font-black border-l border-slate-400 py-2.5 px-3 text-center min-w-[80px]">
                    Total
                  </th>
                </tr>

                {/* Header Row 2: Equipment SAP Material Codes */}
                <tr className="text-[10px] border-b-2 border-slate-400 bg-white">
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#fed7aa] border-r border-slate-400 py-1 px-3"></th>
                  <th className="bg-[#dbeafe] text-slate-800 italic border-r border-slate-400 py-1 px-2 text-center font-normal">
                    List of Packages
                  </th>
                  {columns.map(col => (
                    <th
                      key={`code-${col.id}`}
                      className="bg-white text-slate-800 font-mono border-r border-slate-400 py-1 px-2 text-center font-bold"
                    >
                      {col.code}
                    </th>
                  ))}
                  <th className="bg-[#fde047] border-l border-slate-400 py-1 px-2 text-center font-mono font-bold text-slate-950">
                    Units
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredRows.map((row, idx) => {
                  const rowSum = columns.reduce(
                    (acc, c) => acc + (Number(row.quantities[c.id]) || 0),
                    0
                  );
                  return (
                    <tr
                      key={row.id || idx}
                      className={idx % 2 === 0 ? 'bg-white hover:bg-amber-50/40 transition-colors' : 'bg-slate-50/60 hover:bg-amber-50/40 transition-colors'}
                    >
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                        {row.date || matrixDate}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">
                        {row.region}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                        {row.zone}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-mono text-[11px]">
                        {row.woreda}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">
                        <div>{row.healthFacility}</div>
                        {row.customerDescription && row.customerDescription !== row.healthFacility && (
                          <div className="text-[10px] text-slate-500 font-normal">{row.customerDescription}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 bg-[#eff6ff]/70 text-indigo-900 font-bold text-center">
                        {row.packages}
                      </td>
                      {columns.map(col => (
                        <td
                          key={`${row.id}-${col.id}`}
                          className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800"
                        >
                          {Number(row.quantities[col.id]) || 0}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 border-l border-slate-300 text-center font-mono font-black text-amber-950 bg-amber-100/70">
                        {formatNumber(rowSum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950 shadow-inner">
                  <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-amber-400 font-mono">
                    TOTAL APPROVED ALLOCATION ({filteredRows.length} Health Facilities):
                  </td>
                  {columns.map(col => (
                    <td
                      key={`tot-${col.id}`}
                      className="py-3 px-3 text-center font-mono text-amber-300 border-r border-slate-700 font-black"
                    >
                      {formatNumber(columnTotals[col.id] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center font-mono text-emerald-400 bg-slate-950 text-sm font-black border-l border-slate-700">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No Facility Breakdown Rows in this Dossier</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            This dossier does not contain detailed health facility breakdown matrix records.
          </p>
        </div>
      )}
    </div>
  );
};
