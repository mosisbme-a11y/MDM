import React, { useMemo } from 'react';
import { DspWorkflowRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Building2, Layers, AlertCircle, FileSpreadsheet, Hospital } from 'lucide-react';

interface Props {
  records: DspWorkflowRecord[];
}

export const RegionalSubmittedDataView: React.FC<Props> = ({ records }) => {
  const regionalRecords = useMemo(() => 
    records.filter(r => r.stage === 'rhb-to-moh'),
    [records]
  );

  const aggregatedFacilities = useMemo(() => {
    const facilities: any[] = [];
    regionalRecords.forEach(record => {
      if (record.facilityMatrixData?.rows) {
        record.facilityMatrixData.rows.forEach(row => {
          facilities.push({
            ...row,
            dspRef: record.dspRefNumber,
            columns: record.facilityMatrixData?.columns || []
          });
        });
      }
    });
    return facilities;
  }, [regionalRecords]);

  const allColumns = useMemo(() => {
    const cols = new Map<string, { id: string, name: string, code: string }>();
    regionalRecords.forEach(record => {
      record.facilityMatrixData?.columns.forEach(c => {
        cols.set(c.id, c);
      });
    });
    return Array.from(cols.values());
  }, [regionalRecords]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <Layers className="w-5 h-5 text-amber-600" />
              Regional Submission Aggregation (RHB to MOH)
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Consolidated incoming breakdown data from all Regional Health Bureaus.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span className="text-[11px] font-black text-amber-700 font-mono">{regionalRecords.length} Dossiers</span>
             </div>
             <div className="bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 flex items-center gap-2">
                <Hospital className="w-4 h-4 text-purple-600" />
                <span className="text-[11px] font-black text-purple-700 font-mono">{aggregatedFacilities.length} Facilities</span>
             </div>
          </div>
        </div>
        
        {regionalRecords.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">No regional submissions found in system memory.</p>
            <p className="text-xs text-slate-400 mt-1">Incoming data from RHBs will appear here once submitted.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner bg-slate-50/20">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                  <th className="p-3 border-r border-slate-200 sticky left-0 z-10 bg-slate-100">DSP Ref</th>
                  <th className="p-3 border-r border-slate-200">Region</th>
                  <th className="p-3 border-r border-slate-200">Zone</th>
                  <th className="p-3 border-r border-slate-200">Woreda</th>
                  <th className="p-3 border-r border-slate-200 min-w-[200px]">Health Facility</th>
                  <th className="p-3 border-r border-slate-200">Package</th>
                  {allColumns.map(col => (
                    <th key={col.id} className="p-3 border-r border-slate-200 text-center min-w-[140px] bg-white">
                      <div className="text-slate-900 leading-tight">{col.name}</div>
                      <div className="text-[9px] font-mono font-normal text-slate-400 mt-1">{col.code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {aggregatedFacilities.map((fac, idx) => (
                  <tr key={`${fac.dspRef}-${fac.id}-${idx}`} className="hover:bg-amber-50/30 transition-colors bg-white">
                    <td className="p-3 border-r border-slate-100 font-mono text-[10px] font-bold text-slate-500 sticky left-0 z-10 bg-white group-hover:bg-amber-50/30">{fac.dspRef}</td>
                    <td className="p-3 border-r border-slate-100 font-bold text-slate-800">{fac.region}</td>
                    <td className="p-3 border-r border-slate-100 text-slate-600">{fac.zone}</td>
                    <td className="p-3 border-r border-slate-100 text-slate-600">{fac.woreda}</td>
                    <td className="p-3 border-r border-slate-100 font-black text-slate-900">{fac.healthFacility}</td>
                    <td className="p-3 border-r border-slate-100">
                       <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[9px]">{fac.packages}</span>
                    </td>
                    {allColumns.map(col => (
                      <td key={col.id} className="p-3 border-r border-slate-100 text-center font-black text-amber-700 font-mono bg-amber-50/10">
                        {fac.quantities[col.id] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                  <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-xs">Total Aggregated Quantity:</td>
                  {allColumns.map(col => {
                    const total = aggregatedFacilities.reduce((sum, f) => sum + (Number(f.quantities[col.id]) || 0), 0);
                    return (
                      <td key={col.id} className="p-3 text-center border-r border-slate-200 bg-amber-100/50 text-amber-900 font-mono">
                        {total > 0 ? formatNumber(total) : '-'}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Dossier Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regionalRecords.map(record => (
          <div key={record.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-400 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest font-mono">{record.dspRefNumber}</div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                record.status === 'Submitted & Pending' ? 'bg-amber-100 text-amber-700' : 
                record.status === 'Under Review' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {record.status}
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-2">{record.subject}</h4>
            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
               <div className="flex items-center gap-1">
                 <Building2 className="w-3 h-3" />
                 {record.senderOrg.split(' ')[0]} Region
               </div>
               <div className="flex items-center gap-1">
                 <Hospital className="w-3 h-3" />
                 {record.targetedFacilitiesCount} Facilities
               </div>
               <div className="flex items-center gap-1">
                 <FileSpreadsheet className="w-3 h-3" />
                 {record.totalQuantity} Units
               </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
               <div className="text-[10px] text-slate-400">Submitted: <span className="font-bold text-slate-600">{record.dateSubmitted}</span></div>
               <button className="text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                 View Full Dossier ➔
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
