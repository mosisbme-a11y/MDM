import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  Layers,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';
import { DspWorkflowRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';

export interface StageSourceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageKey: string;
  stageTitle: string;
  records: DspWorkflowRecord[];
}

export const StageSourceDataModal: React.FC<StageSourceDataModalProps> = ({
  isOpen,
  onClose,
  stageKey,
  stageTitle,
  records
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<DspWorkflowRecord | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Filter records matching this stage
  const stageRecords = useMemo(() => {
    return records.filter(r => {
      const s = r.stage as string;
      if (stageKey === 'moh-to-epss' && (s === 'moh-to-epss' || s === 'dsp-mgmt')) return true;
      if (stageKey === 'rhb-to-moh' && s === 'rhb-to-moh') return true;
      if (stageKey === 'moh-to-rhb' && s === 'moh-to-rhb') return true;
      if (stageKey === 'moh-to-epss-ho' && s === 'moh-to-epss-ho') return true;
      if (stageKey === 'epss-ho-aggregation' && s === 'epss-ho-aggregation') return true;
      if (stageKey === 'epss-branch-dispatch' && (s === 'epss-branch-dispatch' || s === 'epss-to-branch')) return true;
      return s === stageKey;
    });
  }, [records, stageKey]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return stageRecords;
    const q = searchQuery.toLowerCase();
    return stageRecords.filter(r => 
      r.dspRefNumber?.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q) ||
      r.senderOrg?.toLowerCase().includes(q) ||
      r.recipientOrg?.toLowerCase().includes(q) ||
      r.officialLetterRef?.toLowerCase().includes(q)
    );
  }, [stageRecords, searchQuery]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    const csvData = filteredRecords.map(r => ({
      'DSP Ref': r.dspRefNumber,
      'Stage': r.stageTitle || stageTitle,
      'Sender': r.senderOrg,
      'Recipient': r.recipientOrg,
      'Subject': r.subject,
      'Status': r.status,
      'Date Submitted': r.dateSubmitted,
      'Total Quantity': r.totalQuantity,
      'Valuation (ETB)': r.totalValuationETB,
      'Target Facilities': r.targetedFacilitiesCount
    }));
    downloadCSV(`stage-source-data-${stageKey}.csv`, csvData);
  };

  const filteredItems = useMemo(() => {
    if (!selectedRecordDetail?.itemsIncluded) return [];
    if (!itemSearchQuery.trim()) return selectedRecordDetail.itemsIncluded;
    const q = itemSearchQuery.toLowerCase();
    return selectedRecordDetail.itemsIncluded.filter(item =>
      item.material?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.allocatedFacility?.toLowerCase().includes(q) ||
      item.plant?.toLowerCase().includes(q)
    );
  }, [selectedRecordDetail, itemSearchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">Source Data Inspection</div>
              <h2 className="text-base font-black text-white">{stageTitle}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Actions Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dossiers by reference, subject, sender, or recipient..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 font-mono bg-white px-3 py-2 rounded-xl border border-slate-200">
              {filteredRecords.length} Dossier{filteredRecords.length === 1 ? '' : 's'} Found
            </span>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Content Table / Detail */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No source dossiers found for this stage.</p>
              <p className="text-xs text-slate-400 mt-1">Double-click on another stage or initiate new requests in the pipeline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredRecords.map(rec => (
                <div
                  key={rec.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-mono text-xs font-black border border-amber-200">
                        {rec.dspRefNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status === 'Endorsed & Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        rec.status === 'Dispatched to Plants' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {rec.status}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Submitted: {rec.dateSubmitted}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{rec.subject}</h4>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sender: <strong className="text-slate-700">{rec.senderOrg}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>Recipient: <strong className="text-slate-700">{rec.recipientOrg}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">Quantity / Value</div>
                      <div className="text-xs font-black text-cyan-700 font-mono">{formatNumber(rec.totalQuantity)} Units</div>
                      <div className="text-xs font-bold text-emerald-600 font-mono">{formatCurrency(rec.totalValuationETB)}</div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedRecordDetail(rec);
                        setItemSearchQuery('');
                      }}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Inspect Items (Table)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Record Detail Sub-Modal: Smart Interactive Spreadsheet Table */}
          {selectedRecordDetail && (
            <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Exact Source Data Table</div>
                    <h3 className="text-sm font-black text-white">
                      {selectedRecordDetail.dspRefNumber} — {selectedRecordDetail.subject}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedRecordDetail(null)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search item code, description, facility, or plant..."
                        value={itemSearchQuery}
                        onChange={e => setItemSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-mono text-xs font-bold border border-amber-200">
                      {filteredItems.length} Line Item{filteredItems.length === 1 ? '' : 's'}
                    </span>
                    <button
                      onClick={() => {
                        const csv = filteredItems.map((item, idx) => ({
                          'No': idx + 1,
                          'Material Code': item.material,
                          'Description': item.description,
                          'Allocated Facility': item.allocatedFacility || 'N/A',
                          'Quantity': item.quantity
                        }));
                        downloadCSV(`dossier-items-${selectedRecordDetail.dspRefNumber}.csv`, csv);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Table CSV</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                          <th className="p-2.5 border-r border-slate-300 w-12 text-center">#</th>
                          <th className="p-2.5 border-r border-slate-300 min-w-[130px]">Material Code</th>
                          <th className="p-2.5 border-r border-slate-300 min-w-[220px]">Item Description</th>
                          <th className="p-2.5 border-r border-slate-300 min-w-[180px]">Allocated Facility</th>
                          <th className="p-2.5 text-right min-w-[100px]">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              No matching line items found.
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => {
                            return (
                              <tr 
                                key={idx} 
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="p-2.5 border-r border-slate-200 text-center font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-slate-900">
                                  {item.material}
                                </td>
                                <td className="p-2.5 border-r border-slate-200 text-slate-800 font-medium">
                                  {item.description}
                                </td>
                                <td className="p-2.5 border-r border-slate-200 text-cyan-800 font-medium">
                                  {item.allocatedFacility || 'Regional Hub Allocation'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-cyan-700">
                                  {formatNumber(item.quantity)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Showing exact source line items for dossier {selectedRecordDetail.dspRefNumber}</span>
                  <button
                    onClick={() => setSelectedRecordDetail(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition cursor-pointer shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Double-click inspection mode active for stage dossiers.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
