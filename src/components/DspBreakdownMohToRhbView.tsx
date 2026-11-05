import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Send, 
  CheckCircle2, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3,
  X,
  Check,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Share2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Paperclip
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';
import { saveDspRecordsToIndexedDB } from '../utils/indexedDbCache';

const TODAY_ISO_DATE = new Date().toISOString().split('T')[0];

interface MatrixRow {
  id: string;
  sn: number;
  date: string;
  region: string;
  budgetSource: string;
  quantities: Record<string, number>; // materialId -> quantity
}

interface MatrixColumn {
  id: string;
  materialCode: string;
  description: string;
}

interface Props {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  multipleStockItems?: MultipleStockRecord[];
  onSelectSubTab?: (tab: EpssSubTab) => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

export const DspBreakdownMohToRhbView: React.FC<Props> = ({
  records,
  setRecords,
  multipleStockItems = [],
  onSelectSubTab,
  onTriggerCloudSync
}) => {
  // 1. Columns (Materials)
  const [columns, setColumns] = useState<MatrixColumn[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_2_2_columns');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { id: 'mat-1', materialCode: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon' },
      { id: 'mat-2', materialCode: '403-XRRD-0101', description: 'Bed - Patient, Fowler, Adult' },
      { id: 'mat-3', materialCode: '403-XRRB-0101N', description: 'Bowel - With Stand, Stainless Steel.' },
      { id: 'mat-4', materialCode: '403-XRRD-0101-001', description: 'Cold box' },
      { id: 'mat-5', materialCode: '401-WICU-0101N', description: 'Couch - Delivery' },
      { id: 'mat-6', materialCode: '401-WICU-0101N', description: 'Couch - Examination' }
    ];
  });

  // 2. Rows (Regions)
  const [rows, setRows] = useState<MatrixRow[]>(() => {
    try {
      const stored = localStorage.getItem('epss_dsp_2_2_rows');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { 
        id: 'row-1', 
        sn: 1, 
        date: TODAY_ISO_DATE, 
        region: 'Oromia', 
        budgetSource: 'MCH', 
        quantities: { 'mat-1': 10, 'mat-2': 10, 'mat-3': 10, 'mat-4': 10, 'mat-5': 10, 'mat-6': 10 } 
      },
      { 
        id: 'row-2', 
        sn: 2, 
        date: TODAY_ISO_DATE, 
        region: 'Amhara', 
        budgetSource: 'MCH', 
        quantities: { 'mat-1': 5, 'mat-2': 5, 'mat-3': 5, 'mat-4': 5, 'mat-5': 5, 'mat-6': 5 } 
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  const [uploadedLetter, setUploadedLetter] = useState<File | null>(null);

  useEffect(() => {
    localStorage.setItem('epss_dsp_2_2_columns', JSON.stringify(columns));
    localStorage.setItem('epss_dsp_2_2_rows', JSON.stringify(rows));
  }, [columns, rows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rows.filter(r => 
      r.region.toLowerCase().includes(q) || 
      r.budgetSource.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const totals = useMemo(() => {
    const colTotals: Record<string, number> = {};
    columns.forEach(c => {
      colTotals[c.id] = rows.reduce((sum, r) => sum + (r.quantities[c.id] || 0), 0);
    });
    return colTotals;
  }, [columns, rows]);

  const handleUpdateQuantity = (rowId: string, colId: string, val: number) => {
    setRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, quantities: { ...r.quantities, [colId]: val } } : r
    ));
  };

  const handleAddRow = () => {
    const newRow: MatrixRow = {
      id: `row-${Date.now()}`,
      sn: rows.length + 1,
      date: TODAY_ISO_DATE,
      region: 'New Region',
      budgetSource: 'MCH',
      quantities: {}
    };
    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, sn: i + 1 })));
  };

  const handleDownloadExcel = () => {
    const header1 = ['S/N', 'Date', 'Region', 'Budget Source', ...columns.map(c => c.description)];
    const header2 = ['', '', '', '', ...columns.map(c => c.materialCode)];
    const data = filteredRows.map(r => [
      r.sn,
      r.date,
      r.region,
      r.budgetSource,
      ...columns.map(c => r.quantities[c.id] || 0)
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header1, header2, ...data]);
    
    // Styling attempt (AOA doesn't support complex styling easily without plugins, but we can set column widths)
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
      ...columns.map(() => ({ wch: 25 }))
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DSP_Breakdown_Template');
    XLSX.writeFile(workbook, `DSP_Breakdown_Request_MOH_to_RHB_${TODAY_ISO_DATE}.xlsx`);
  };

  const handleTransmit = () => {
    const year = new Date().getFullYear();
    const randNum = Math.floor(100 + Math.random() * 900);
    const refNum = `MOH/PMD-BRK/${year}/${randNum}`;
    const officialLetterRef = `MOH/LET/${year}/${Math.floor(1000 + Math.random() * 9000)}`;

    const totalQty = Object.values(totals).reduce((sum, v) => sum + v, 0);

    const newRecord: DspWorkflowRecord = {
      id: `dsp-brk-tx-${Date.now()}`,
      dspRefNumber: refNum,
      stage: 'moh-osp-management',
      subStage: '2.2',
      stageTitle: 'MOH OSP Management',
      senderOrg: 'Ministry of Health (PMD Directorate)',
      recipientOrg: rows.map(r => r.region).join(', ') + ' Regional Health Bureaus',
      subject: `DSP Breakdown Request: Regional Allocation Quota Transmission (${columns.length} Materials)`,
      status: 'Submitted & Pending',
      dateSubmitted: TODAY_ISO_DATE,
      totalDevices: columns.length,
      totalQuantity: totalQty,
      totalValuationETB: totalQty * 250000, // Dummy valuation
      targetedRegions: rows.map(r => r.region),
      targetedFacilitiesCount: rows.length,
      officialLetterRef: officialLetterRef,
      signatory: 'Dr. Bethlehem (MOH PMD Directorate)',
      signatoryRole: 'Director, PMD Directorate',
      itemsIncluded: columns.map(c => ({
        material: c.materialCode,
        description: c.description,
        quantity: totals[c.id] || 0,
        plant: 'AA01 Central'
      })),
      notes: `Transmitted via Horizontal Matrix Template. Targeting ${rows.length} Regions.`
    };

    setRecords(prev => [newRecord, ...prev]);
    saveDspRecordsToIndexedDB([newRecord, ...records]);
    
    if (onTriggerCloudSync) {
      onTriggerCloudSync(`✓ Breakdown Request ${refNum} transmitted to Regions!`, {
        type: 'CREATE',
        title: `Breakdown Request ${refNum}`,
        payload: newRecord
      });
    }

    setIsTransmitModalOpen(false);
    if (onSelectSubTab) onSelectSubTab('moh-osp-management');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-[#0B1527] border border-[#0B1527] rounded-2xl p-4 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1E3A5F] border border-[#2D4D75] shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <span className="text-xs md:text-sm font-black text-white tracking-tight uppercase">
                DSP Breakdown Request to RHB
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-900">
                {rows.length} Regions
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                MOH PMD Directorate ➔ Regional Health Bureaus
              </div>
              <div className="text-xs font-semibold text-slate-200">
                Official Quota Breakdown Matrix Template (Sub-step 2.2)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
            <button
              onClick={() => setIsTransmitModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to RHBs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Matrix Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Regions or Budget Sources..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>
        <button
          onClick={handleAddRow}
          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border border-indigo-200"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Region Row</span>
        </button>
      </div>

      {/* The Horizontal Matrix Template Table */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-text">
            <thead>
              {/* Header 1: Material Descriptions */}
              <tr className="bg-orange-100 border-b border-slate-300 text-slate-900 font-bold">
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[60px]">S/N</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[100px] italic">Date</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[140px]">Region</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-300 min-w-[120px] bg-orange-400 text-white uppercase">Budget Source</th>
                {columns.map(col => (
                  <th key={col.id} className="py-1.5 px-2 text-left border-r border-slate-300 min-w-[180px] bg-orange-100 font-medium leading-tight align-bottom">
                    {col.description}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center w-12 bg-slate-100">Action</th>
              </tr>
              {/* Header 2: Material Codes */}
              <tr className="bg-white border-b border-slate-400 text-slate-600 font-mono text-[10px]">
                <th className="border-r border-slate-200"></th>
                <th className="border-r border-slate-200"></th>
                <th className="border-r border-slate-200"></th>
                <th className="border-r border-slate-200"></th>
                {columns.map(col => (
                  <th key={`${col.id}-code`} className="py-1 px-2 text-left border-r border-slate-300 font-bold text-slate-900">
                    {col.materialCode}
                  </th>
                ))}
                <th className="bg-slate-50"></th>
              </tr>
            </thead>
            <tbody className="bg-blue-50/20">
              {filteredRows.map((row, idx) => (
                <tr key={row.id} className="border-b border-slate-200 hover:bg-white transition-colors group">
                  <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-400">
                    {row.sn}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200 font-mono">
                    <input 
                      type="text" 
                      value={row.date} 
                      onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, date: e.target.value } : r))}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">
                    <input 
                      type="text" 
                      value={row.region} 
                      onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, region: e.target.value } : r))}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs font-bold"
                    />
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200 bg-blue-50 font-black text-indigo-700">
                    <input 
                      type="text" 
                      value={row.budgetSource} 
                      onChange={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, budgetSource: e.target.value } : r))}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-indigo-700"
                    />
                  </td>
                  {columns.map(col => (
                    <td key={col.id} className="py-2 px-2 border-r border-slate-200 text-center">
                      <input 
                        type="number"
                        value={row.quantities[col.id] || 0}
                        onChange={(e) => handleUpdateQuantity(row.id, col.id, parseInt(e.target.value) || 0)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-center font-mono font-bold text-slate-900"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center bg-slate-50">
                    <button 
                      onClick={() => handleRemoveRow(row.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-slate-900 text-white font-black text-[11px]">
                <td colSpan={4} className="py-2.5 px-4 text-right uppercase tracking-widest text-amber-400">Total Regional Quota:</td>
                {columns.map(col => (
                  <td key={`${col.id}-total`} className="py-2.5 px-2 text-center border-r border-slate-700 font-mono text-cyan-300">
                    {formatNumber(totals[col.id])}
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span>This matrix template follows the official MOH PMD standard for regional medical equipment quota allocation. Quantities entered here will be transmitted as breakdown targets for each RHB.</span>
      </div>

      {/* Transmit Modal */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">Submit Breakdown to RHBs</h3>
                  <p className="text-[11px] text-slate-400 font-medium tracking-tight">Institutional Quota Transmission to {rows.length} Regional Health Bureaus</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransmitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <span>Dossier Payload</span>
                  <span className="text-amber-600 font-mono">REGIONAL_QUOTA_MATRIX</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Regions Targeted</span>
                    <span className="font-bold text-slate-900">{rows.length} RHBs</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Material Groups</span>
                    <span className="font-bold text-slate-900">{columns.length} Items</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Units</span>
                    <span className="font-black text-cyan-800">{formatNumber(Object.values(totals).reduce((a, b) => a + b, 0))} Units</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Source Budget</span>
                    <span className="font-black text-indigo-700">MCH / Health Program</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Paperclip className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-amber-950">Official Ministerial Letter</div>
                    <div className="text-[10px] text-amber-700 font-medium">Attach signed breakdown authorization</div>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="letter-upload-22" 
                  className="hidden" 
                  onChange={(e) => setUploadedLetter(e.target.files?.[0] || null)}
                />
                <label 
                  htmlFor="letter-upload-22"
                  className="px-2.5 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-amber-100 transition-colors"
                >
                  {uploadedLetter ? 'Attached' : 'Browse PDF'}
                </label>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-tight">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verify and Commit Transmittal</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  Confirming this action will transmit the regional quotas to all targeted RHBs. Each region will receive their specific allocation to begin the health facility breakdown (Stage 3).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsTransmitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleTransmit}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-amber-300 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md text-xs uppercase tracking-widest"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
