import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Clipboard, 
  FileText, 
  Building2, 
  Send,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  RegionBreakdownColumn, 
  RegionBreakdownRow, 
  RegionBreakdownMatrixData, 
  RegionBreakdownMatrixTable,
  DEFAULT_STAGE_3_COLUMNS,
  DEFAULT_STAGE_3_ROWS
} from './RegionBreakdownMatrixTable';
import { HealthFacilityRecord, DspWorkflowRecord } from '../types';

interface RegionBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: DspWorkflowRecord) => void;
  initialData?: RegionBreakdownMatrixData;
  hfListItems?: HealthFacilityRecord[];
}

export const RegionBreakdownModal: React.FC<RegionBreakdownModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  hfListItems = []
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'matrix' | 'upload' | 'paste' | 'metadata'>('matrix');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [columns, setColumns] = useState<RegionBreakdownColumn[]>(initialData?.columns || DEFAULT_STAGE_3_COLUMNS);
  const [rows, setRows] = useState<RegionBreakdownRow[]>(initialData?.rows || DEFAULT_STAGE_3_ROWS);

  // Metadata form
  const [regionName, setRegionName] = useState(rows[0]?.region || 'Oromia');
  const [refNumber, setRefNumber] = useState(`RHB/${(rows[0]?.region || 'OR').slice(0, 2).toUpperCase()}-DSP/2026/${Math.floor(100 + Math.random() * 900)}`);
  const [officialLetterRef, setOfficialLetterRef] = useState(`RHB/LET/${Date.now().toString().slice(-4)}`);
  const [subject, setSubject] = useState(`Official Regional Health Facility Equipment Allocation Breakdown - ${rows[0]?.region || 'Oromia'} Region`);
  const [signatory, setSignatory] = useState('Dr. Mengistu (Regional Health Bureau Head)');
  const [signatoryRole, setSignatoryRole] = useState('Head of Regional Health Bureau');
  const [notes, setNotes] = useState('Regional facility breakdown matrix finalized in accordance with MOH quota allocations.');

  // Paste parsing state
  const [pastedText, setPastedText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // File upload state
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  // Update rows & columns from matrix table
  const handleMatrixUpdate = (updated: RegionBreakdownMatrixData) => {
    setDate(updated.date);
    setColumns(updated.columns);
    setRows(updated.rows);
    if (updated.rows[0]?.region) {
      setRegionName(updated.rows[0].region);
    }
  };

  // Parse pasted TSV text
  const handleParsePastedData = () => {
    setParseError(null);
    setParseSuccessMsg(null);

    if (!pastedText.trim()) {
      setParseError('Please paste tab-delimited text from Excel or Google Sheets.');
      return;
    }

    try {
      const lines = pastedText.trim().split(/\r?\n/).map(l => l.split('\t'));
      if (lines.length < 2) {
        setParseError('At least 2 rows of data (headers + at least one data row) are required.');
        return;
      }

      // Check if header row 1 has standard columns
      let startRowIdx = 0;
      let headerRow1 = lines[0];
      let headerRow2: string[] | null = null;

      // Check if top row is "Date" row
      if (headerRow1[0]?.toLowerCase().includes('date') && lines.length > 2) {
        startRowIdx = 1;
        headerRow1 = lines[1];
      }

      // Check if next row contains codes (starts with empty cells or has item codes)
      if (lines.length > startRowIdx + 2 && lines[startRowIdx + 1].length >= 5) {
        const potentialCodeRow = lines[startRowIdx + 1];
        if (potentialCodeRow[0] === '' && potentialCodeRow[1] === '') {
          headerRow2 = potentialCodeRow;
          startRowIdx = startRowIdx + 2;
        } else {
          startRowIdx = startRowIdx + 1;
        }
      } else {
        startRowIdx = startRowIdx + 1;
      }

      // Extract equipment column names & codes
      const parsedColumns: RegionBreakdownColumn[] = [];
      const colStart = 5; // index after Region, Zone, Woreda, Facility, Packages

      for (let c = colStart; c < headerRow1.length; c++) {
        const colName = headerRow1[c]?.trim();
        if (colName) {
          const colCode = (headerRow2 && headerRow2[c]?.trim()) || `ITEM-0${c - colStart + 1}`;
          parsedColumns.push({
            id: `col-parsed-${c}`,
            name: colName,
            code: colCode
          });
        }
      }

      if (parsedColumns.length === 0) {
        // Fall back to existing columns if only facility data was pasted
        parsedColumns.push(...columns);
      }

      // Extract rows
      const parsedRows: RegionBreakdownRow[] = [];
      for (let r = startRowIdx; r < lines.length; r++) {
        const rowData = lines[r];
        if (!rowData || rowData.length === 0 || !rowData.some(cell => cell.trim())) continue;

        const reg = rowData[0]?.trim() || regionName;
        const zone = rowData[1]?.trim() || 'Zone';
        const woreda = rowData[2]?.trim() || '1';
        const facility = rowData[3]?.trim() || 'Health Center';
        const pkg = rowData[4]?.trim() || 'MCH';

        const quantities: Record<string, number> = {};
        parsedColumns.forEach((col, idx) => {
          const cellVal = rowData[colStart + idx]?.trim();
          quantities[col.id] = cellVal ? Number(cellVal) || 0 : 0;
        });

        parsedRows.push({
          id: `prow-${r}-${Date.now()}`,
          region: reg,
          zone,
          woreda,
          hub: 'General Regional Hub',
          healthFacility: facility,
          packages: pkg,
          quantities
        });
      }

      if (parsedRows.length === 0) {
        setParseError('Could not parse any valid rows. Please ensure columns match Region, Zone, Woreda, Facility, Package, then Equipment Quantities.');
        return;
      }

      setColumns(parsedColumns);
      setRows(parsedRows);
      if (parsedRows[0]?.region) setRegionName(parsedRows[0].region);
      setParseSuccessMsg(`✓ Successfully parsed ${parsedRows.length} facility rows and ${parsedColumns.length} equipment columns!`);
      setTimeout(() => setActiveTab('matrix'), 1000);
    } catch (err: any) {
      setParseError(`Parse error: ${err.message || 'Unknown parsing failure'}`);
    }
  };

  // Handle Excel file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setParseSuccessMsg(null);

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          setParseError('The uploaded sheet does not contain enough rows.');
          return;
        }

        // Detect Date
        let curDate = date;
        let startRowIdx = 0;
        if (rawJson[0]?.[0]?.toString().toLowerCase().includes('date')) {
          curDate = rawJson[0]?.[1]?.toString() || date;
          startRowIdx = 1;
        }

        const headerRow1 = rawJson[startRowIdx] || [];
        let headerRow2: any[] | null = null;

        // Check if next row has codes
        if (rawJson.length > startRowIdx + 2 && (!rawJson[startRowIdx + 1]?.[0] || rawJson[startRowIdx + 1]?.[0] === '')) {
          headerRow2 = rawJson[startRowIdx + 1];
          startRowIdx = startRowIdx + 2;
        } else {
          startRowIdx = startRowIdx + 1;
        }

        const colStart = 5;
        const parsedColumns: RegionBreakdownColumn[] = [];
        for (let c = colStart; c < headerRow1.length; c++) {
          const colName = headerRow1[c]?.toString().trim();
          if (colName) {
            const colCode = (headerRow2 && headerRow2[c]?.toString().trim()) || `40${c}-CODE`;
            parsedColumns.push({
              id: `col-up-${c}`,
              name: colName,
              code: colCode
            });
          }
        }

        if (parsedColumns.length === 0) {
          parsedColumns.push(...columns);
        }

        const parsedRows: RegionBreakdownRow[] = [];
        for (let r = startRowIdx; r < rawJson.length; r++) {
          const rowData = rawJson[r];
          if (!rowData || rowData.length === 0) continue;
          if (rowData[0]?.toString().toUpperCase() === 'TOTAL') continue;

          const reg = rowData[0]?.toString().trim() || regionName;
          const zone = rowData[1]?.toString().trim() || '';
          const woreda = rowData[2]?.toString().trim() || '';
          const facility = rowData[3]?.toString().trim() || '';
          const pkg = rowData[4]?.toString().trim() || 'MCH';

          if (!facility && !zone) continue;

          const quantities: Record<string, number> = {};
          parsedColumns.forEach((col, idx) => {
            const rawVal = rowData[colStart + idx];
            quantities[col.id] = rawVal ? Number(rawVal) || 0 : 0;
          });

          parsedRows.push({
            id: `row-up-${r}-${Date.now()}`,
            region: reg,
            zone,
            woreda,
            hub: 'General Regional Hub',
            healthFacility: facility,
            packages: pkg,
            quantities
          });
        }

        if (parsedRows.length === 0) {
          setParseError('No data rows found in the uploaded spreadsheet.');
          return;
        }

        setDate(curDate);
        setColumns(parsedColumns);
        setRows(parsedRows);
        if (parsedRows[0]?.region) setRegionName(parsedRows[0].region);
        setParseSuccessMsg(`✓ Successfully imported ${parsedRows.length} facilities and ${parsedColumns.length} equipment columns from ${file.name}!`);
        setTimeout(() => setActiveTab('matrix'), 1000);
      } catch (err: any) {
        setParseError(`Upload error: ${err.message || 'Failed to read file'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit Dossier
  const handleSubmitDossier = () => {
    // Calculate total quantity
    let totalQty = 0;
    rows.forEach(r => {
      columns.forEach(c => {
        totalQty += (Number(r.quantities[c.id]) || 0);
      });
    });

    // Generate Excel Blob
    const aoa: any[][] = [];
    aoa.push(['Date', date]);
    aoa.push([
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packeges',
      ...columns.map(c => c.name)
    ]);
    aoa.push([
      '',
      '',
      '',
      '',
      '',
      ...columns.map(c => c.code)
    ]);
    rows.forEach(r => {
      aoa.push([
        r.region,
        r.zone,
        r.woreda,
        r.healthFacility,
        r.packages,
        ...columns.map(c => r.quantities[c.id] ?? '')
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facility Breakdown');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const excelFileName = `DSP_Stage3_Region_Breakdown_${regionName}_${date}.xlsx`;

    const newRecord: DspWorkflowRecord = {
      id: `dsp-reg-${Date.now().toString().slice(-6)}`,
      dspRefNumber: refNumber,
      stage: 'rhb-to-moh',
      subStage: '3.2',
      stageTitle: '3. DSP Submitted RHB to MOH',
      senderOrg: `${regionName} Regional Health Bureau`,
      recipientOrg: 'Ministry of Health (PMD Directorate)',
      subject,
      status: 'Submitted & Pending',
      dateSubmitted: date,
      totalDevices: columns.length,
      totalQuantity: totalQty,
      totalValuationETB: totalQty * 250000, // Estimated value
      targetedRegions: [regionName],
      targetedFacilitiesCount: rows.length,
      officialLetterRef,
      signatory,
      signatoryRole,
      itemsIncluded: columns.map(c => {
        const colTotal = rows.reduce((acc, r) => acc + (Number(r.quantities[c.id]) || 0), 0);
        return {
          material: c.code,
          description: c.name,
          quantity: colTotal,
          plant: `${regionName} Hub`
        };
      }),
      notes,
      excelFile: {
        name: excelFileName,
        blob: excelBlob
      },
      facilityMatrixData: {
        date,
        region: regionName,
        columns,
        rows
      }
    };

    onSubmit(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Modal Top Header */}
        <div className="p-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <Building2 className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
                  Stage 3 Workflow
                </span>
                <h2 className="text-base font-black tracking-tight">
                  DSP Submitted Region to MOH (Facility Breakdown)
                </h2>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Two-tier Regional Health Facility Equipment Allocation Format
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>1. Matrix Spreadsheet</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Upload size={14} />
              <span>2. Upload File</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Clipboard size={14} />
              <span>3. Paste from Sheets</span>
            </button>

            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'metadata'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <FileText size={14} />
              <span>4. Transmission Metadata</span>
            </button>
          </div>

          <div className="text-xs font-mono font-bold text-slate-500">
            {rows.length} Facilities • {columns.length} Devices
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {/* TAB 1: SPREADSHEET MATRIX VIEW */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <RegionBreakdownMatrixTable
                data={{
                  date,
                  region: regionName,
                  columns,
                  rows
                }}
                hfListItems={hfListItems}
                onUpdateData={handleMatrixUpdate}
                isEditable={true}
                title="Regional Health Facility Allocation Matrix"
                subtitle="Live interactive editor. Click cells to modify facility details or allocated equipment quantities."
              />
            </div>
          )}

          {/* TAB 2: EXCEL / CSV UPLOAD */}
          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto py-6 space-y-4">
              <div className="bg-white border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 text-center transition-colors">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-200">
                  <Upload size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Upload Regional Breakdown Spreadsheet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Upload an Excel (.xlsx, .xls) or CSV file formatted with the two-tier layout (Region, Zone, Woreda, Name of health facility, List of Packeges, Equipment).
                </p>

                <div className="mt-5">
                  <label className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md inline-flex items-center gap-2">
                    <FileSpreadsheet size={16} />
                    <span>Choose Excel File</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadFileName && (
                  <div className="mt-3 text-xs font-mono text-slate-700">
                    Selected file: <span className="font-bold">{uploadFileName}</span>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {parseSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{parseSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PASTE TSV TEXT */}
          {activeTab === 'paste' && (
            <div className="max-w-2xl mx-auto py-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Paste Table Rows from Excel / Google Sheets</h4>
                    <p className="text-[11px] text-slate-500">
                      Copy the cells directly from your spreadsheet and paste them below:
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPastedText(`Region\tZone\tWoreda\tName of health facility\tList of Packeges\tAnesthesia machine - with Patient mon\tBed - Patient, Fowler, Adult\tBowel - With Stand, Stainless Steel.\tCold box\tCouch - Delivery\tCouch - Examination\n\t\t\t\t\t403-XRRD-0101\t403-XRRD-0101\t403-XRRB-0101N\t403-XRRD-0101-001\t401-WICU-0101N\t401-WICU-0101N\nOromia\tAddis ketema\t1\tAbeshige Woreda Health Office\tMCH\t2\t3\t3\t2\t2\t2\nOromia\tAddis ketema\t1\tAddis Hiwot Health Center\tOR\t2\t3\t3\t2\t2\t2\nOromia\tAddis ketema\t1\tAdama Health Center\tICU\t2\t1\t1\t2\t2\t2\nOromia\tkirkose\t3\tAddis Hiwot Health Center\tMCH\t2\t\t\t2\t2\t2\nOromia\tkirkose\t3\tAbala Primary Hospital\tOR\t2\t3\t3\t2\t2\t2`);
                    }}
                    className="text-[11px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                  >
                    Paste Sample
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste rows here (tab-separated from Excel or Google Sheets)..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
                />

                <button
                  onClick={handleParsePastedData}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition"
                >
                  Parse and Apply to Matrix
                </button>
              </div>

              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {parseSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{parseSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: METADATA & DISPATCH */}
          {activeTab === 'metadata' && (
            <div className="max-w-2xl mx-auto py-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Official Transmission Information
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Region</label>
                    <select
                      value={regionName}
                      onChange={(e) => setRegionName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="Oromia">Oromia</option>
                      <option value="Amhara">Amhara</option>
                      <option value="Sidama">Sidama</option>
                      <option value="Somali">Somali</option>
                      <option value="Tigray">Tigray</option>
                      <option value="Afar">Afar</option>
                      <option value="South Ethiopia">South Ethiopia</option>
                      <option value="Central Ethiopia">Central Ethiopia</option>
                      <option value="South West Ethiopia">South West Ethiopia</option>
                      <option value="Benishangul-Gumuz">Benishangul-Gumuz</option>
                      <option value="Gambella">Gambella</option>
                      <option value="Harari">Harari</option>
                      <option value="Addis Ababa">Addis Ababa</option>
                      <option value="Dire Dawa">Dire Dawa</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Submission Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">DSP Reference Number</label>
                    <input
                      type="text"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Official Letter Ref</label>
                    <input
                      type="text"
                      value={officialLetterRef}
                      onChange={(e) => setOfficialLetterRef(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Authorized Signatory</label>
                    <input
                      type="text"
                      value={signatory}
                      onChange={(e) => setSignatory(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Signatory Title</label>
                    <input
                      type="text"
                      value={signatoryRole}
                      onChange={(e) => setSignatoryRole(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Notes / Remarks</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer transition"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmitDossier}
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-md transition flex items-center gap-2"
            >
              <Send size={14} />
              <span>Submit Regional Breakdown to MOH</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
