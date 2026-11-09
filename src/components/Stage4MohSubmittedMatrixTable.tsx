import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  Plus,
  Trash2,
  Check,
  Edit3,
  Copy,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2,
  FileText,
  Upload,
  X,
  RefreshCw,
  Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatNumber } from '../utils/formatters';
import { HealthFacilityRecord } from '../types';

export interface Stage4Column {
  id: string;
  name: string; // e.g. "Anesthesia machine"
  code: string; // e.g. "403-XRRD-0101"
}

export interface Stage4Row {
  id: string;
  date?: string;
  region: string;
  zone: string;
  woreda: string;
  healthFacility: string;
  packages: string; // e.g. "MCH"
  plant?: string; // e.g. "AA01", "HO01", "AD01" (EPSS Hub / Delivering Plant)
  quantities: Record<string, number>;
}

export interface Stage4MatrixData {
  date: string;
  region: string;
  columns: Stage4Column[];
  rows: Stage4Row[];
}

export function lookupHubFromHfMasterData(
  facilityName: string,
  regionName: string,
  hfList: HealthFacilityRecord[] = []
): string {
  if (!facilityName) return 'AA01';
  const cleanFac = facilityName.trim().toLowerCase();

  if (hfList && hfList.length > 0) {
    const match = hfList.find(hf => {
      const desc = (hf.customerDescription || '').toLowerCase();
      const cust = (hf.customer || '').toLowerCase();
      return desc.includes(cleanFac) || cleanFac.includes(desc) || cust === cleanFac;
    });

    if (match) {
      if (match.deliveringPlant) return match.deliveringPlant;
      if (match.plant) return match.plant;
      if (match.deliveringPlantDescr) return match.deliveringPlantDescr;
    }
  }

  // Regional defaults if not found in master data
  const reg = (regionName || '').toLowerCase();
  if (reg.includes('addis')) return 'HO01';
  if (reg.includes('oromia')) return 'AD01';
  if (reg.includes('amhara')) return 'BD01';
  if (reg.includes('tigray')) return 'ME01';
  if (reg.includes('somali')) return 'JI01';
  if (reg.includes('sidama') || reg.includes('south') || reg.includes('snnpr')) return 'HA01';
  if (reg.includes('afar')) return 'AS01';
  if (reg.includes('dire') || reg.includes('harar')) return 'DR01';
  if (reg.includes('benishangul')) return 'AS01';
  if (reg.includes('gambella') || reg.includes('gambela')) return 'GB01';

  return 'AA01';
}

export const DEFAULT_STAGE_4_COLUMNS: Stage4Column[] = [];

export const DEFAULT_STAGE_4_ROWS: Stage4Row[] = [];

interface Stage4MohSubmittedMatrixTableProps {
  data?: Stage4MatrixData;
  onUpdateData?: (updated: Stage4MatrixData) => void;
  isEditable?: boolean;
  hfListItems?: HealthFacilityRecord[];
  dossiers?: any[];
  selectedDossierId?: string;
  onSelectDossier?: (dossierId: string) => void;
  title?: string;
  subtitle?: string;
}

export const Stage4MohSubmittedMatrixTable: React.FC<Stage4MohSubmittedMatrixTableProps> = ({
  data,
  onUpdateData,
  isEditable = true,
  hfListItems = [],
  dossiers = [],
  selectedDossierId = '',
  onSelectDossier,
  title = '4. DSP Submitted MOH to EPSS - Health Facility Breakdown Matrix',
  subtitle = 'Official breakdown format submitted by MOH PMD to EPSS with two-tier equipment headers'
}) => {
  const [internalDate, setInternalDate] = useState<string>(data?.date || new Date().toISOString().split('T')[0]);
  const [columns, setColumns] = useState<Stage4Column[]>(data?.columns || DEFAULT_STAGE_4_COLUMNS);
  const [rows, setRows] = useState<Stage4Row[]>(data?.rows || DEFAULT_STAGE_4_ROWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState('all');
  const [isEditingMode, setIsEditingMode] = useState(isEditable);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Column configurator modal
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnCode, setNewColumnCode] = useState('');
  const [batchQtyInputs, setBatchQtyInputs] = useState<Record<string, string>>({});

  const handleBatchApplyQtyToAllRows = (colId: string, customQty?: number) => {
    const valToApply = customQty !== undefined ? customQty : (Number(batchQtyInputs[colId]) || 0);
    setRows(prevRows =>
      prevRows.map(row => ({
        ...row,
        quantities: {
          ...row.quantities,
          [colId]: valToApply
        }
      }))
    );
    const targetCol = columns.find(c => c.id === colId);
    setToastMessage(`✓ Applied ${valToApply} units of "${targetCol?.name || 'Equipment'}" across all ${rows.length} facility rows!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mapping analysis & template engine modal state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'item-agg' | 'hf-matrix'>('item-agg');
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectItemOneByOne = (val: string) => {
    if (!val) return;
    const [code, name] = val.split(':::');
    const itemCode = code || '403-MAT-0101';
    const itemName = name || 'Medical Device Item';

    const exists = columns.some(c => c.code === itemCode || c.name.toLowerCase() === itemName.toLowerCase());
    if (exists) {
      showToast(`⚠️ "${itemName}" is already in equipment columns.`);
      return;
    }

    const newCol: Stage4Column = {
      id: `col-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: itemName,
      code: itemCode
    };

    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);

    const updatedRows = rows.map(r => ({
      ...r,
      quantities: { ...r.quantities, [newCol.id]: 2 }
    }));
    setRows(updatedRows);
    notifyChange(updatedCols, updatedRows);
    showToast(`✓ Selected "${itemName} (${itemCode})" & added as column!`);
  };

  const toggleItemOneByOne = (item: { name: string; code: string }) => {
    const existingCol = columns.find(c => c.code === item.code || c.name.toLowerCase() === item.name.toLowerCase());
    if (existingCol) {
      handleRemoveColumn(existingCol.id);
    } else {
      handleSelectItemOneByOne(`${item.code}:::${item.name}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleMapWithHubs = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const updated = rows.map(r => ({
        ...r,
        plant: lookupHubFromHfMasterData(r.healthFacility, r.region, hfListItems)
      }));
      setRows(updated);
      notifyChange(columns, updated);
      setIsAnalyzing(false);
      showToast(`⚡ Auto-mapped EPSS Hubs for all ${updated.length} facilities using Health Facility Master Data!`);
    }, 400);
  };

  const handleDownloadItemAggregationTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const headersRow1 = [
      'Hub',
      'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult',
      'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
    ];
    const headersRow2 = [
      '',
      '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
    ];

    const hubRows = [
      ['AA01', 6, 6, 2, 2, 2, 2],
      ['AD01', 2, 2, 2, 2, 2, 2],
      ['DI01', 2, 2, 2, 2, 2, 2],
      ['BD01', 2, 2, 2, 2, 2, 2],
      ['HW01', 2, 2, 2, 2, 2, 2],
      ['DD01', 2, 2, 2, 2, 2, 2]
    ];

    if (format === 'csv') {
      const csvData = [
        headersRow1,
        headersRow2,
        ...hubRows
      ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Item_Aggregation_By_Hub_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Downloaded Item Aggregation CSV template!');
      return;
    }

    const aoa = [
      headersRow1,
      headersRow2,
      ...hubRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 32 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Aggregation');
    XLSX.writeFile(wb, `Item_Aggregation_By_Hub_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✓ Downloaded Item Aggregation Excel (.xlsx) template!');
  };

  const handleDownloadExactTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const headersRow1 = [
      'Region', 'Zone', 'Woreda', 'Name of health facility', 'List of Packeges', 'Plant',
      ...columns.map(c => c.name)
    ];
    const headersRow2 = [
      '', '', '', '', 'List of Packeges', 'Delivering Plant',
      ...columns.map(c => c.code)
    ];

    const sampleRows = rows.slice(0, 5).map(r => [
      r.region, r.zone, r.woreda, r.healthFacility, r.packages, r.plant || lookupHubFromHfMasterData(r.healthFacility, r.region, hfListItems),
      ...columns.map(c => r.quantities[c.id] || 2)
    ]);

    if (format === 'csv') {
      const csvData = [
        headersRow1,
        headersRow2,
        ...sampleRows
      ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Health_Facility_Allocation_Matrix_Template_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Downloaded Health Facility Matrix CSV template!');
      return;
    }

    const aoa = [
      headersRow1,
      headersRow2,
      ...sampleRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 38 }, { wch: 16 }, { wch: 14 },
      ...columns.map(() => ({ wch: 20 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HF Allocation Matrix');
    XLSX.writeFile(wb, `Health_Facility_Allocation_Matrix_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✓ Downloaded Health Facility Matrix Excel (.xlsx) template!');
  };

  const notifyChange = (updatedCols: Stage4Column[], updatedRows: Stage4Row[]) => {
    if (onUpdateData) {
      onUpdateData({
        date: internalDate,
        region: selectedRegionFilter === 'all' ? 'All' : selectedRegionFilter,
        columns: updatedCols,
        rows: updatedRows
      });
    }
  };

  // Sync when data prop changes
  useEffect(() => {
    if (data) {
      if (data.date) setInternalDate(data.date);
      if (data.columns && data.columns.length > 0) setColumns(data.columns);
      if (data.rows && data.rows.length > 0) setRows(data.rows);
    }
  }, [data]);

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.region) set.add(r.region); });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueZones = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (selectedRegionFilter === 'all' || r.region === selectedRegionFilter) {
        if (r.zone) set.add(r.zone);
      }
    });
    return Array.from(set).sort();
  }, [rows, selectedRegionFilter]);

  const uniquePackages = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.packages) set.add(r.packages); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchRegion = selectedRegionFilter === 'all' || r.region === selectedRegionFilter;
      const matchZone = selectedZone === 'all' || r.zone === selectedZone;
      const matchPackage = selectedPackage === 'all' || r.packages === selectedPackage;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.region.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.woreda.toLowerCase().includes(q) ||
        r.healthFacility.toLowerCase().includes(q) ||
        r.packages.toLowerCase().includes(q);

      return matchRegion && matchZone && matchPackage && matchSearch;
    });
  }, [rows, selectedRegionFilter, selectedZone, selectedPackage, searchQuery]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      totals[col.id] = filteredRows.reduce((sum, r) => sum + (Number(r.quantities[col.id]) || 0), 0);
    });
    return totals;
  }, [columns, filteredRows]);

  const grandTotalUnits = useMemo(() => {
    return Object.values(columnTotals).reduce((sum, val) => sum + val, 0);
  }, [columnTotals]);

  // Cell quantity change
  const handleQuantityChange = (rowId: string, colId: string, value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    const updated = rows.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          quantities: {
            ...r.quantities,
            [colId]: num
          }
        };
      }
      return r;
    });
    setRows(updated);
    notifyChange(columns, updated);
  };

  // Row field change
  const handleRowFieldChange = (rowId: string, field: keyof Omit<Stage4Row, 'quantities'>, value: string) => {
    const updated = rows.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setRows(updated);
    notifyChange(columns, updated);
  };

  // Add Row
  const handleAddRow = () => {
    const newRow: Stage4Row = {
      id: `s4-row-${Date.now()}`,
      region: selectedRegionFilter !== 'all' ? selectedRegionFilter : (rows[0]?.region || 'Oromia'),
      zone: uniqueZones[0] || 'Zone 1',
      woreda: '01',
      healthFacility: `Health Center ${rows.length + 1}`,
      packages: 'MCH',
      quantities: {}
    };
    columns.forEach(col => {
      newRow.quantities[col.id] = 2; // Default 2 matching user screenshot
    });
    const updated = [...rows, newRow];
    setRows(updated);
    notifyChange(columns, updated);
    showToast(`✓ Added row for ${newRow.healthFacility}`);
  };

  // Delete Row
  const handleDeleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      alert('Cannot delete the last row.');
      return;
    }
    const updated = rows.filter(r => r.id !== rowId);
    setRows(updated);
    notifyChange(columns, updated);
  };

  // Add Column
  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    const colCode = newColumnCode.trim() || `403-MAT-010${columns.length + 1}`;
    const newCol: Stage4Column = {
      id: `col-${Date.now()}`,
      name: newColumnName.trim(),
      code: colCode
    };
    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);

    const updatedRows = rows.map(r => ({
      ...r,
      quantities: {
        ...r.quantities,
        [newCol.id]: 2
      }
    }));
    setRows(updatedRows);
    notifyChange(updatedCols, updatedRows);

    setNewColumnName('');
    setNewColumnCode('');
    setIsColumnPickerOpen(false);
    showToast(`✓ Added column: ${newCol.name} (${newCol.code})`);
  };

  // Remove Column
  const handleRemoveColumn = (colId: string) => {
    if (columns.length <= 1) {
      alert('Cannot remove the last equipment column.');
      return;
    }
    const updatedCols = columns.filter(c => c.id !== colId);
    setColumns(updatedCols);
    const updatedRows = rows.map(r => {
      const copy = { ...r.quantities };
      delete copy[colId];
      return { ...r, quantities: copy };
    });
    setRows(updatedRows);
    notifyChange(updatedCols, updatedRows);
    showToast('✓ Removed equipment column');
  };

  // Update Column Header
  const handleUpdateColumnHeader = (colId: string, name: string, code: string) => {
    const updatedCols = columns.map(c => c.id === colId ? { ...c, name, code } : c);
    setColumns(updatedCols);
    notifyChange(updatedCols, rows);
  };

  // Export to Excel with two-tier header
  const handleExportExcel = () => {
    const headerRow1: string[] = [
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packeges',
      ...columns.map(c => c.name)
    ];

    const headerRow2: string[] = [
      '',
      '',
      '',
      '',
      'List of Packeges',
      ...columns.map(c => c.code)
    ];

    const dataRows = filteredRows.map(r => [
      r.region,
      r.zone,
      r.woreda,
      r.healthFacility,
      r.packages,
      ...columns.map(c => r.quantities[c.id] !== undefined ? r.quantities[c.id] : 0)
    ]);

    const totalRow = [
      'TOTAL',
      '',
      '',
      `${filteredRows.length} Facilities`,
      '',
      ...columns.map(c => columnTotals[c.id] || 0)
    ];

    const aoa = [headerRow1, headerRow2, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths
    ws['!cols'] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
      ...columns.map(() => ({ wch: 22 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MOH_EPSS_Breakdown_Matrix');
    XLSX.writeFile(wb, `Stage4_MOH_to_EPSS_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✓ Excel export downloaded successfully!');
  };

  // Download Blank Template
  const handleDownloadTemplate = () => {
    const headerRow1 = [
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packeges',
      ...columns.map(c => c.name)
    ];

    const headerRow2 = [
      '',
      '',
      '',
      '',
      'List of Packeges',
      ...columns.map(c => c.code)
    ];

    const sampleRow = [
      'Oromia',
      'Addis ketema',
      '01',
      'Sample Health Facility',
      'MCH',
      ...columns.map(() => 2)
    ];

    const aoa = [headerRow1, headerRow2, sampleRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
      ...columns.map(() => ({ wch: 22 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Stage4_MOH_EPSS_Breakdown_Template.xlsx`);
    showToast('✓ Template downloaded successfully!');
  };

  // Upload Excel / CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length < 2) {
          alert('Uploaded sheet does not contain enough header rows.');
          return;
        }

        const row1 = data[0] || [];
        const row2 = data[1] || [];

        // Identify equipment columns starting from column index 5
        const newCols: Stage4Column[] = [];
        for (let colIdx = 5; colIdx < row1.length; colIdx++) {
          const name = String(row1[colIdx] || '').trim();
          const code = String(row2[colIdx] || '').trim() || `403-MAT-010${colIdx}`;
          if (name || code) {
            newCols.push({
              id: `col-${colIdx}-${Date.now()}`,
              name: name || `Equipment ${colIdx - 4}`,
              code: code
            });
          }
        }

        const effectiveCols = newCols.length > 0 ? newCols : columns;

        // Parse data rows starting from row index 2
        const parsedRows: Stage4Row[] = [];
        for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
          const row = data[rowIdx];
          if (!row || row.length === 0) continue;
          const reg = String(row[0] || '').trim();
          const zone = String(row[1] || '').trim();
          const woreda = String(row[2] || '').trim();
          const facility = String(row[3] || '').trim();
          const pkg = String(row[4] || '').trim() || 'MCH';

          if (!facility && !reg && !zone) continue; // Skip empty rows

          const quantities: Record<string, number> = {};
          effectiveCols.forEach((col, idx) => {
            const rawVal = row[5 + idx];
            quantities[col.id] = parseInt(rawVal, 10) || 0;
          });

          parsedRows.push({
            id: `s4-import-${rowIdx}-${Date.now()}`,
            region: reg || 'Oromia',
            zone: zone || 'Addis ketema',
            woreda: woreda || '01',
            healthFacility: facility || `Health Center ${rowIdx - 1}`,
            packages: pkg,
            quantities
          });
        }

        if (parsedRows.length > 0) {
          setColumns(effectiveCols);
          setRows(parsedRows);
          notifyChange(effectiveCols, parsedRows);
          showToast(`✓ Successfully imported ${parsedRows.length} facilities and ${effectiveCols.length} equipment columns!`);
        } else {
          alert('No valid facility rows found in the uploaded file.');
        }
      } catch (err) {
        console.error('Error importing file:', err);
        alert('Failed to parse uploaded Excel file. Please ensure it follows the two-tier header template.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAutoMapHubs = () => {
    const updated = rows.map(r => ({
      ...r,
      plant: lookupHubFromHfMasterData(r.healthFacility, r.region, hfListItems)
    }));
    setRows(updated);
    notifyChange(columns, updated);
    showToast(`✓ Auto-mapped EPSS Hubs for all ${updated.length} facilities using Health Facility Master Data!`);
  };

  return (
    <div className={`space-y-4 ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-50 p-6 overflow-y-auto' : ''}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                Official MoH Two-Tier Format
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* MAP HF TO HUB Dark Pill Button Matching attachment _2C20FE77-C59A-4AE4-A51A-9016280E8D95__a472711d.png */}
          <button
            type="button"
            onClick={handleMapWithHubs}
            disabled={isAnalyzing}
            className="flex items-center gap-3 px-5 py-2 bg-[#0a0f1d] hover:bg-black text-white rounded-full font-black text-xs shadow-xl hover:shadow-amber-500/20 transition-all transform active:scale-95 border border-slate-700/80 disabled:opacity-50 cursor-pointer tracking-wider uppercase group"
            title="Map Health Facilities to official regional EPSS hubs using HF Master Data"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)] animate-pulse shrink-0" />
            <span className="tracking-widest font-black text-white group-hover:text-amber-300 transition-colors">
              {isAnalyzing ? 'MAPPING...' : 'MAP HF TO HUB'}
            </span>
          </button>

          {/* ITEM AGGREGATION Dark Pill Button */}
          <button
            type="button"
            onClick={() => {
              setActiveTemplateTab('item-agg');
              setShowTemplateModal(true);
            }}
            className="flex items-center gap-3 px-5 py-2 bg-[#0a0f1d] hover:bg-black text-white rounded-full font-black text-xs shadow-xl hover:shadow-amber-500/20 transition-all transform active:scale-95 border border-slate-700/80 cursor-pointer tracking-wider uppercase group"
            title="View and download Item Aggregation Template by Hub"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)] animate-pulse shrink-0" />
            <span className="tracking-widest font-black text-white group-hover:text-amber-300 transition-colors">
              ITEM AGGREGATION
            </span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Import Excel or CSV matching this format"
          >
            <Upload size={14} />
            <span>Upload / Import Matrix</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Export to Excel with two-tier headers"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTemplateTab('hf-matrix');
              setShowTemplateModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Download blank matrix templates"
          >
            <Download size={14} className="text-purple-600" />
            <span>Download Template</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              isEditingMode
                ? 'bg-purple-50 border-purple-300 text-purple-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Edit3 size={14} />
            <span>{isEditingMode ? 'Finish Editing' : 'Edit Matrix'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 cursor-pointer transition"
            title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtered Region</div>
          <div className="text-sm font-black font-mono text-purple-700 mt-0.5 flex items-center gap-1.5">
            <Building2 size={14} className="text-purple-600" />
            <span>{selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocated Health Facilities</div>
          <div className="text-sm font-black font-mono text-indigo-700 mt-0.5">
            {filteredRows.length} Center{filteredRows.length !== 1 ? 's' : ''} (of {rows.length})
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipment Types</div>
          <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
            {columns.length} Items Configured
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Quantity Earmarked</div>
          <div className="text-sm font-black font-mono text-emerald-700 mt-0.5">
            {formatNumber(grandTotalUnits)} Units
          </div>
        </div>
      </div>

      {/* Controls & Column Picker Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-60">
            <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, zone, woreda, package..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium cursor-pointer focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Regions ({uniqueRegions.length})</option>
            {uniqueRegions.map(reg => (
              <option key={reg} value={reg}>{reg}</option>
            ))}
          </select>

          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium cursor-pointer focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Zones ({uniqueZones.length})</option>
            {uniqueZones.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium cursor-pointer focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Packages ({uniquePackages.length})</option>
            {uniquePackages.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Buttons to Add Row & Columns */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Add a new health facility row"
          >
            <Plus size={14} />
            <span>+ Add Facility Row</span>
          </button>

          <button
            type="button"
            onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Layers size={14} />
            <span>{isColumnPickerOpen ? 'Close Equipment' : 'Manage Equipment (' + columns.length + ')'}</span>
          </button>
        </div>
      </div>

      {/* Column Configurator Drawer */}
      {isColumnPickerOpen && (
        <div className="bg-white border border-purple-200 rounded-xl p-3.5 text-xs space-y-3 animate-in fade-in duration-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Selectable Equipment Columns in Matrix ({columns.length})</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Select items one by one from catalog or click &times; to remove item</span>
          </div>

          {/* Select Item One by One Dropdown & Checklist Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-purple-50/80 border border-purple-200 p-2 rounded-xl text-xs">
            <div className="flex items-center gap-2 flex-1 w-full">
              <span className="font-bold text-purple-950 shrink-0 flex items-center gap-1 text-[11px]">
                <CheckCircle2 size={15} className="text-purple-600" />
                <span>Select Item One by One:</span>
              </span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectItemOneByOne(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="flex-1 bg-white border border-purple-300 text-slate-900 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="" disabled>⚡ -- Pick Equipment Item One by One from Catalog --</option>
                {[
                  { name: 'Anesthesia machine - with Patient mon', code: '403-XRRD-0101' },
                  { name: 'Bed - Patient, Fowler, Adult', code: '403-XRRD-0101' },
                  { name: 'Bowel - With Stand, Stainless Steel.', code: '403-XRRB-0101N' },
                  { name: 'Cold box', code: '403-XRRD-0101-001' },
                  { name: 'Couch - Delivery', code: '401-WICU-0101N' },
                  { name: 'Couch - Examination', code: '401-WICU-0101N' },
                  { name: 'Oxygen Concentrator 10L', code: '401-OXY-0101' },
                  { name: 'Patient Monitor Multi-parameter', code: '401-MON-0102' },
                  { name: 'Infusion Pump Volumetric', code: '402-PUMP-0103' },
                  { name: 'Syringe Pump Micro-infusion', code: '402-PUMP-0104' },
                  { name: 'Ultrasound Scanner Digital Color Doppler', code: '403-US-0104' },
                  { name: 'X-Ray Mobile Digital System 300mA', code: '403-XRAY-0105' },
                  { name: 'Defibrillator Biphasic with Monitor', code: '401-DEF-0106' },
                  { name: 'ECG Machine 12-Channel Automatic', code: '401-ECG-0107' },
                  { name: 'Phototherapy Unit Neonatal Overhead', code: '401-PHOTO-0108' },
                  { name: 'Infant Incubator Intensive Care', code: '401-INC-0109' },
                  { name: 'Suction Machine Electric Dual Bottle', code: '402-SUC-0110' },
                  { name: 'Autoclave Steam Sterilizer 50L', code: '404-AUTO-0111' },
                  { name: 'Operating Table Hydraulic Universal', code: '403-OT-0112' },
                  { name: 'Surgical Shadowless Light Ceiling', code: '403-LIGHT-0113' },
                  { name: 'Pulse Oximeter Fingertip/Handheld', code: '401-OX-0114' },
                  { name: 'Centrifuge Benchtop Clinical 24-Tube', code: '405-CENT-0115' },
                  { name: 'Microscope Binocular Laboratory', code: '405-MIC-0116' }
                ].map((item, idx) => (
                  <option key={`${item.code}-${idx}`} value={`${item.code}:::${item.name}`}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsChecklistOpen(!isChecklistOpen)}
              className="px-3 py-1.5 rounded-lg bg-purple-900 hover:bg-black text-purple-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <Check className="w-3.5 h-3.5 text-purple-400" />
              <span>{isChecklistOpen ? 'Hide Item Checklist' : '📋 Checklist (Select One by One)'}</span>
            </button>
          </div>

          {/* Item Checklist Drawer (Select / Deselect One by One) */}
          {isChecklistOpen && (
            <div className="p-3 bg-purple-50/40 border border-purple-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                <span>Master Catalog Items Checklist — Click any item to select or deselect one by one:</span>
                <span className="font-mono text-purple-900 font-extrabold bg-purple-200 px-2 py-0.5 rounded-full text-[10px]">
                  {columns.length} Columns Selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                {[
                  { name: 'Anesthesia machine - with Patient mon', code: '403-XRRD-0101' },
                  { name: 'Bed - Patient, Fowler, Adult', code: '403-XRRD-0101' },
                  { name: 'Bowel - With Stand, Stainless Steel.', code: '403-XRRB-0101N' },
                  { name: 'Cold box', code: '403-XRRD-0101-001' },
                  { name: 'Couch - Delivery', code: '401-WICU-0101N' },
                  { name: 'Couch - Examination', code: '401-WICU-0101N' },
                  { name: 'Oxygen Concentrator 10L', code: '401-OXY-0101' },
                  { name: 'Patient Monitor Multi-parameter', code: '401-MON-0102' },
                  { name: 'Infusion Pump Volumetric', code: '402-PUMP-0103' },
                  { name: 'Syringe Pump Micro-infusion', code: '402-PUMP-0104' },
                  { name: 'Ultrasound Scanner Digital Color Doppler', code: '403-US-0104' },
                  { name: 'X-Ray Mobile Digital System 300mA', code: '403-XRAY-0105' },
                  { name: 'Defibrillator Biphasic with Monitor', code: '401-DEF-0106' },
                  { name: 'ECG Machine 12-Channel Automatic', code: '401-ECG-0107' },
                  { name: 'Phototherapy Unit Neonatal Overhead', code: '401-PHOTO-0108' },
                  { name: 'Infant Incubator Intensive Care', code: '401-INC-0109' },
                  { name: 'Suction Machine Electric Dual Bottle', code: '402-SUC-0110' },
                  { name: 'Autoclave Steam Sterilizer 50L', code: '404-AUTO-0111' },
                  { name: 'Operating Table Hydraulic Universal', code: '403-OT-0112' },
                  { name: 'Surgical Shadowless Light Ceiling', code: '403-LIGHT-0113' },
                  { name: 'Pulse Oximeter Fingertip/Handheld', code: '401-OX-0114' },
                  { name: 'Centrifuge Benchtop Clinical 24-Tube', code: '405-CENT-0115' },
                  { name: 'Microscope Binocular Laboratory', code: '405-MIC-0116' }
                ].map((catItem, idx) => {
                  const isSelected = columns.some(c => c.code === catItem.code || c.name.toLowerCase() === catItem.name.toLowerCase());
                  return (
                    <label
                      key={`check-${catItem.code}-${idx}`}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition cursor-pointer text-[11px] ${
                        isSelected
                          ? 'bg-purple-100/90 border-purple-400 text-purple-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemOneByOne(catItem)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                      />
                      <div className="truncate flex-1">
                        <div className="truncate font-semibold">{catItem.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{catItem.code}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Columns Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {columns.map(col => (
              <div
                key={col.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-slate-800 font-mono text-[11px]"
              >
                <span className="font-bold text-purple-900">{col.name}</span>
                <span className="text-[10px] text-slate-500">({col.code})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveColumn(col.id)}
                  className="ml-1 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                  title="Remove column"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* APPLIED SELECTED ITEMS EXACT QUANTITIES SUMMARY TABLE */}
          {columns.length > 0 && (
            <div className="mt-2 border border-purple-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Applied Equipment Quantities Table ({columns.length} Selected Items)</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-purple-950/40 text-purple-100 px-2.5 py-0.5 rounded-full border border-purple-300/40">
                  Total Earmarked Units: {formatNumber(rows.reduce((total, r) => total + columns.reduce((s, c) => s + (Number(r.quantities[c.id]) || 0), 0), 0))}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-purple-50/80 text-purple-950 font-bold text-[11px] sticky top-0 border-b border-purple-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Equipment Item Description</th>
                      <th className="py-2 px-3">SAP Material Code</th>
                      <th className="py-2 px-3 text-center">Allocated Facilities</th>
                      <th className="py-2 px-3 text-right">Applied Total Quantity</th>
                      <th className="py-2 px-3 text-center">Batch Set Qty to All Rows</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {columns.map((col, idx) => {
                      const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantities[col.id]) || 0), 0);
                      const facCount = rows.filter(r => (Number(r.quantities[col.id]) || 0) > 0).length;
                      return (
                        <tr key={`applied-sum-${col.id}`} className="hover:bg-purple-50/50 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-sans text-xs">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-900">
                            {col.name}
                          </td>
                          <td className="py-2 px-3 text-purple-800 font-bold">
                            {col.code || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                              {facCount} / {rows.length} Rows
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-700 text-xs">
                            {formatNumber(totalQty)} units
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                placeholder="Qty"
                                value={batchQtyInputs[col.id] || ''}
                                onChange={(e) => setBatchQtyInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
                                className="w-16 px-2 py-1 bg-white border border-purple-300 rounded text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleBatchApplyQtyToAllRows(col.id)}
                                className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] transition cursor-pointer whitespace-nowrap"
                                title={`Apply specified quantity to all ${rows.length} facility rows`}
                              >
                                Apply All
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBatchApplyQtyToAllRows(col.id, 2)}
                                className="px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold text-[10px] border border-slate-200 cursor-pointer"
                                title="Set 2 units to all rows"
                              >
                                Set 2
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveColumn(col.id)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition cursor-pointer"
                              title="Remove item column"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="New Equipment Description (e.g. Suction Machine)..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              placeholder="SAP Material Code (e.g. 403-XRRD-0101)..."
              value={newColumnCode}
              onChange={(e) => setNewColumnCode(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleAddColumn}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm"
            >
              Add Column
            </button>
          </div>
        </div>
      )}

      {/* SPREADSHEET TABLE: Matching Exact User Attachment Format */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              {/* Header Row 1: Matching Image 1 (Date, Region, Zone, Woreda, Name of health facility, List of Packeges) */}
              <tr className="border-b border-slate-300 text-xs font-medium">
                <th className="p-2.5 bg-white font-bold border-r border-slate-300 min-w-[90px] text-slate-900">
                  Date
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[120px]">
                  Region
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[130px]">
                  Zone
                </th>
                <th className="p-2.5 italic bg-[#fef08a] text-slate-900 border-r border-slate-300 font-semibold min-w-[80px] text-center">
                  Woreda
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[200px]">
                  Name of health facility
                </th>
                <th className="p-2.5 italic bg-[#dbeafe] text-slate-900 border-r border-slate-300 font-semibold min-w-[130px] text-center">
                  List of Packeges
                </th>
                <th className="p-2.5 bg-[#facc15] text-slate-950 border-r border-slate-300 font-black min-w-[110px] text-center shadow-2xs">
                  Plant
                </th>
                {columns.map(col => (
                  <th
                    key={col.id}
                    className="p-2.5 bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold text-left min-w-[170px] max-w-[210px] leading-tight"
                  >
                    {isEditingMode ? (
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => handleUpdateColumnHeader(col.id, e.target.value, col.code)}
                        className="w-full bg-white border border-purple-300 rounded p-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                        placeholder="Item Description..."
                      />
                    ) : (
                      <div className="line-clamp-2" title={col.name}>{col.name}</div>
                    )}
                  </th>
                ))}
                {isEditingMode && (
                  <th className="p-2 bg-slate-100 text-center text-slate-500 font-bold min-w-[60px]">
                    Action
                  </th>
                )}
              </tr>

              {/* Header Row 2: Sub-headers with SAP Material Numbers & Light Blue Subheader */}
              <tr className="border-b border-slate-300 bg-white text-[11px] font-mono">
                <th className="p-2 bg-white border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#fef9c3] border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 italic bg-[#dbeafe] text-slate-900 border-r border-slate-300 font-semibold text-center">
                  List of Packeges
                </th>
                <th className="p-2 bg-[#fef08a] font-mono font-bold text-yellow-950 border-r border-slate-300 text-center text-[10px]">
                  Delivering Plant
                </th>
                {columns.map(col => (
                  <th
                    key={col.id}
                    className="p-2 bg-white text-slate-800 border-r border-slate-300 font-mono text-[11px] font-bold text-left tracking-tight"
                  >
                    {isEditingMode ? (
                      <input
                        type="text"
                        value={col.code}
                        onChange={(e) => handleUpdateColumnHeader(col.id, col.name, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded p-0.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-purple-500"
                        placeholder="SAP Code..."
                      />
                    ) : (
                      <div className="font-mono">{col.code}</div>
                    )}
                  </th>
                ))}
                {isEditingMode && (
                  <th className="p-2 bg-slate-100 text-center"></th>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (isEditingMode ? 7 : 6)} className="py-12 text-center text-slate-400">
                    No matching facilities found in this filter. Click "+ Add Facility Row" to add a new record.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="p-2 border-r border-slate-200 text-slate-600 font-mono text-[11px] text-center whitespace-nowrap">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.date || internalDate}
                          onChange={(e) => handleRowFieldChange(row.id, 'date' as any, e.target.value)}
                          className="w-full text-center bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded text-xs font-mono"
                        />
                      ) : (
                        <span>{row.date || internalDate}</span>
                      )}
                    </td>

                    {/* Region */}
                    <td className="p-2 border-r border-slate-200">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.region}
                          onChange={(e) => handleRowFieldChange(row.id, 'region', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded text-xs"
                        />
                      ) : (
                        <span className="font-medium">{row.region}</span>
                      )}
                    </td>

                    {/* Zone */}
                    <td className="p-2 border-r border-slate-200">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.zone}
                          onChange={(e) => handleRowFieldChange(row.id, 'zone', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded text-xs"
                        />
                      ) : (
                        <span>{row.zone}</span>
                      )}
                    </td>

                    {/* Woreda */}
                    <td className="p-2 border-r border-slate-200 text-center font-mono">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.woreda}
                          onChange={(e) => handleRowFieldChange(row.id, 'woreda', e.target.value)}
                          className="w-full text-center bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded text-xs font-mono"
                        />
                      ) : (
                        <span>{row.woreda}</span>
                      )}
                    </td>

                    {/* Name of health facility */}
                    <td className="p-2 border-r border-slate-200">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.healthFacility}
                          onChange={(e) => handleRowFieldChange(row.id, 'healthFacility', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded text-xs font-medium text-slate-900"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{row.healthFacility}</span>
                      )}
                    </td>

                    {/* List of Packeges (light blue background matching screenshot) */}
                    <td className="p-2 border-r border-slate-200 text-center bg-[#eff6ff] font-semibold text-blue-900">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.packages}
                          onChange={(e) => handleRowFieldChange(row.id, 'packages', e.target.value)}
                          className="w-full text-center bg-white border border-blue-200 rounded px-1 py-0.5 text-xs font-bold text-blue-900"
                        />
                      ) : (
                        <span>{row.packages}</span>
                      )}
                    </td>

                    {/* Plant Column (highlighted yellow background matching user attachment) */}
                    <td className="p-2 border-r border-slate-200 text-center bg-yellow-50/80 font-mono font-bold text-yellow-950">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.plant || lookupHubFromHfMasterData(row.healthFacility, row.region, hfListItems)}
                          onChange={(e) => handleRowFieldChange(row.id, 'plant', e.target.value)}
                          className="w-full text-center bg-white border border-yellow-400 rounded px-1 py-0.5 text-xs font-mono font-bold text-yellow-950"
                          placeholder="e.g. AA01"
                        />
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-yellow-200/90 border border-yellow-400 font-mono font-black text-yellow-950 text-[11px] shadow-2xs">
                          {row.plant || lookupHubFromHfMasterData(row.healthFacility, row.region, hfListItems)}
                        </span>
                      )}
                    </td>

                    {/* Equipment Quantities Cells */}
                    {columns.map(col => (
                      <td key={col.id} className="p-2 border-r border-slate-200 text-right font-mono font-medium">
                        {isEditingMode ? (
                          <input
                            type="number"
                            min="0"
                            value={row.quantities[col.id] !== undefined ? row.quantities[col.id] : 0}
                            onChange={(e) => handleQuantityChange(row.id, col.id, e.target.value)}
                            className="w-full text-right bg-transparent border-0 border-b border-transparent hover:border-purple-300 focus:border-purple-600 focus:bg-purple-50/50 px-1 py-0.5 rounded font-mono font-bold text-slate-900"
                          />
                        ) : (
                          <span className={row.quantities[col.id] > 0 ? 'font-bold text-slate-900' : 'text-slate-300'}>
                            {row.quantities[col.id] || 0}
                          </span>
                        )}
                      </td>
                    ))}

                    {/* Delete Row Action */}
                    {isEditingMode && (
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                          title="Delete row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Footer Row */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <td colSpan={5} className="p-2.5 border-r border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-wider text-[11px] font-black text-slate-700">Total Approved Allocation</span>
                    <span className="text-[11px] font-mono text-slate-600">{filteredRows.length} Health Facilities</span>
                  </div>
                </td>
                <td className="p-2.5 border-r border-slate-300 text-center bg-[#dbeafe] text-blue-900 font-mono font-bold">
                  TOTAL
                </td>
                <td className="p-2.5 border-r border-slate-300 text-center bg-[#fef08a] font-mono font-bold text-yellow-950">
                  -
                </td>
                {columns.map(col => (
                  <td key={col.id} className="p-2.5 border-r border-slate-300 text-right font-mono font-black text-purple-900">
                    {formatNumber(columnTotals[col.id] || 0)}
                  </td>
                ))}
                {isEditingMode && <td className="p-2.5 bg-slate-100"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Official Matrix Template Engine Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <span>EPSS Allocation Matrix Template Engine</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-mono border border-amber-400/30">
                      Official EPSS Standard
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preview and download two-tier Excel/CSV spreadsheet specifications for Health Facility allocation and Item Aggregation by Hub.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Template Selector Tabs */}
            <div className="flex items-center gap-2 p-3 bg-slate-100 border-b border-slate-200">
              <button
                onClick={() => setActiveTemplateTab('item-agg')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
                  activeTemplateTab === 'item-agg'
                    ? 'bg-slate-900 text-amber-400 shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Item Aggregation Template (by Hub)</span>
              </button>

              <button
                onClick={() => setActiveTemplateTab('hf-matrix')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
                  activeTemplateTab === 'hf-matrix'
                    ? 'bg-slate-900 text-amber-400 shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Building2 size={15} />
                <span>Health Facility Allocation Matrix Template</span>
              </button>
            </div>

            {/* Modal Body Preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              {activeTemplateTab === 'item-agg' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                    📌 <strong>Item Aggregation Layout:</strong> Groups equipment quantities by EPSS Distribution Hub (e.g. AA01, AD01, DI01, BD01). Column 1 (Hub) is highlighted with bright yellow fill.
                  </div>

                  <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-amber-100 border-b border-slate-300 font-bold text-xs text-slate-800">
                          <th className="p-2 border-r border-slate-300 bg-yellow-300 text-yellow-950 font-black">Hub</th>
                          <th className="p-2 border-r border-slate-300">Anesthesia machine - with Patient mon</th>
                          <th className="p-2 border-r border-slate-300">Bed - Patient, Fowler, Adult</th>
                          <th className="p-2 border-r border-slate-300">Bowel - With Stand, Stainless Steel.</th>
                          <th className="p-2 border-r border-slate-300">Cold box</th>
                          <th className="p-2 border-r border-slate-300">Couch - Delivery</th>
                          <th className="p-2">Couch - Examination</th>
                        </tr>
                        <tr className="bg-amber-50 border-b border-slate-300 font-mono text-[11px] text-slate-700">
                          <td className="p-2 border-r border-slate-300 bg-yellow-200 font-bold">Hub</td>
                          <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                          <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                          <td className="p-2 border-r border-slate-300 font-bold">403-XRRB-0101N</td>
                          <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101-001</td>
                          <td className="p-2 border-r border-slate-300 font-bold">401-WICU-0101N</td>
                          <td className="p-2 font-bold">401-WICU-0101N</td>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                        <tr>
                          <td className="p-2 border-r border-slate-200 font-bold bg-yellow-200 text-yellow-950">AA01</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">6</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">6</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 text-right font-bold">2</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r border-slate-200 font-bold bg-yellow-200 text-yellow-950">AD01</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 text-right font-bold">2</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r border-slate-200 font-bold bg-yellow-200 text-yellow-950">DI01</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 text-right font-bold">2</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                    📌 <strong>Health Facility Allocation Matrix Layout:</strong> Two-tier equipment allocation matrix with Region, Zone, Woreda, Name of health facility, List of Packages, and Hub column.
                  </div>

                  <div className="border border-slate-300 rounded-2xl overflow-x-auto bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-purple-100 border-b border-slate-300 font-bold text-xs text-slate-800">
                          <th className="p-2 border-r border-slate-300">Date</th>
                          <th className="p-2 border-r border-slate-300">Region</th>
                          <th className="p-2 border-r border-slate-300">Zone</th>
                          <th className="p-2 border-r border-slate-300">Woreda</th>
                          <th className="p-2 border-r border-slate-300">Name of health facility</th>
                          <th className="p-2 border-r border-slate-300 bg-purple-200/60 text-purple-950 font-bold">List of Packeges</th>
                          <th className="p-2 border-r border-slate-300 bg-yellow-200 text-yellow-950 font-bold">Plant</th>
                          <th className="p-2 border-r border-slate-300">Anesthesia machine</th>
                          <th className="p-2 border-r border-slate-300">Bed - Patient, Fowler</th>
                        </tr>
                        <tr className="bg-purple-50 border-b border-slate-300 font-mono text-[11px] text-slate-700">
                          <td className="p-2 border-r border-slate-300"></td>
                          <td className="p-2 border-r border-slate-300"></td>
                          <td className="p-2 border-r border-slate-300"></td>
                          <td className="p-2 border-r border-slate-300"></td>
                          <td className="p-2 border-r border-slate-300"></td>
                          <td className="p-2 border-r border-slate-300 bg-purple-100 italic text-purple-800 text-[10px] text-center">List of Packeges</td>
                          <td className="p-2 border-r border-slate-300 bg-yellow-100 font-bold">Delivering Plant</td>
                          <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                          <td className="p-2 font-bold">403-XRRD-0101</td>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                        <tr>
                          <td className="p-2 border-r border-slate-200">2026-11-09</td>
                          <td className="p-2 border-r border-slate-200">Somali</td>
                          <td className="p-2 border-r border-slate-200">Afder</td>
                          <td className="p-2 border-r border-slate-200">Raso</td>
                          <td className="p-2 border-r border-slate-200 font-sans font-medium">Raso PHCU(Magalo-kansahHP)</td>
                          <td className="p-2 border-r border-slate-200 text-center font-sans">MCH</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold bg-yellow-50">JI01</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">2</td>
                          <td className="p-2 text-right font-bold">2</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Select download format for active matrix template:
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (activeTemplateTab === 'item-agg') {
                      handleDownloadItemAggregationTemplate('csv');
                    } else {
                      handleDownloadExactTemplate('csv');
                    }
                    setShowTemplateModal(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <Download size={15} />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={() => {
                    if (activeTemplateTab === 'item-agg') {
                      handleDownloadItemAggregationTemplate('xlsx');
                    } else {
                      handleDownloadExactTemplate('xlsx');
                    }
                    setShowTemplateModal(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
