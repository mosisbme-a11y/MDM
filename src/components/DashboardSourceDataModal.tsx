import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Filter,
  Layers,
  Building2,
  Boxes,
  PackageCheck,
  ShieldCheck,
  Truck,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { MedicalDeviceItem, MultipleStockRecord, ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { getRdfHpCategory } from './DashboardViewMultipleStockAnalytics';
import { getReceivingProgramType } from './ReceivingDataAnalyticsSection';

export type DashboardSourceDataMode = 'medical-device' | 'multiple-stock' | 'receiving-data';

export interface DashboardSourceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  mode: DashboardSourceDataMode;
  items?: MedicalDeviceItem[];
  multipleStockRecords?: MultipleStockRecord[];
  receivingRecords?: ReceivingDataRecord[];
  initialStreamFilter?: 'all' | 'RDF' | 'HP';
  initialStatusFilter?: string;
  initialPlantFilter?: string;
}

export const DashboardSourceDataModal: React.FC<DashboardSourceDataModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  mode,
  items = [],
  multipleStockRecords = [],
  receivingRecords = [],
  initialStreamFilter = 'all',
  initialStatusFilter = 'all',
  initialPlantFilter = 'all'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState<'all' | 'RDF' | 'HP'>(initialStreamFilter);
  const [selectedPlant, setSelectedPlant] = useState<string>(initialPlantFilter);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortField, setSortField] = useState<string>('valuation');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedRowDetail, setSelectedRowDetail] = useState<any | null>(null);

  // Sync initial filters when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStreamFilter(initialStreamFilter);
      setSelectedPlant(initialPlantFilter);
      setSelectedStatus(initialStatusFilter);
      setCurrentPage(1);
      setSearchQuery('');
      setSelectedRowDetail(null);
    }
  }, [isOpen, initialStreamFilter, initialPlantFilter, initialStatusFilter]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Helper to determine RDF vs HP classification
  const getItemStream = (row: any): 'RDF' | 'HP' => {
    if (mode === 'multiple-stock') {
      return getRdfHpCategory(row as MultipleStockRecord);
    }
    if (mode === 'receiving-data') {
      return getReceivingProgramType(row as ReceivingDataRecord);
    }
    // For MedicalDeviceItem:
    const s = ((row as MedicalDeviceItem).specialStockType || (row as any).specialStock || '').trim().toUpperCase();
    if (s === 'Q' || s.startsWith('Q') || (row as MedicalDeviceItem).wbsElement) {
      return 'HP';
    }
    return 'RDF';
  };

  // Unique plants for dropdown
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    if (mode === 'medical-device') {
      items.forEach(i => {
        if (i.plant) set.add(i.plant);
      });
    } else if (mode === 'multiple-stock') {
      multipleStockRecords.forEach(i => {
        if (i.plant) set.add(i.plant);
      });
    } else {
      receivingRecords.forEach(i => {
        if (i.plant) set.add(i.plant);
      });
    }
    return Array.from(set).sort();
  }, [mode, items, multipleStockRecords, receivingRecords]);

  // Unique status / categories for dropdown
  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    if (mode === 'medical-device') {
      items.forEach(i => {
        if (i.stockType) set.add(i.stockType);
        if (i.installationStatus) set.add(i.installationStatus);
        if (i.deliveryStatus) set.add(i.deliveryStatus);
      });
    } else if (mode === 'multiple-stock') {
      multipleStockRecords.forEach(i => {
        if (i.materialGroupName) set.add(i.materialGroupName);
      });
    } else {
      receivingRecords.forEach(i => {
        if (i.movementType) set.add(i.movementType);
      });
    }
    return Array.from(set).sort();
  }, [mode, items, multipleStockRecords, receivingRecords]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    let list: any[] = [];
    if (mode === 'medical-device') list = [...items];
    else if (mode === 'multiple-stock') list = [...multipleStockRecords];
    else list = [...receivingRecords];

    // Filter by stream (RDF vs HP)
    if (streamFilter !== 'all') {
      list = list.filter(row => getItemStream(row) === streamFilter);
    }

    // Filter by plant
    if (selectedPlant !== 'all') {
      list = list.filter(row => row.plant === selectedPlant || (row.plantName && row.plantName === selectedPlant));
    }

    // Filter by status/group
    if (selectedStatus !== 'all') {
      list = list.filter(row => {
        if (mode === 'medical-device') {
          return row.stockType === selectedStatus || row.installationStatus === selectedStatus || row.deliveryStatus === selectedStatus;
        }
        if (mode === 'multiple-stock') {
          return row.materialGroupName === selectedStatus;
        }
        return row.movementType === selectedStatus;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(row => {
        const mat = (row.material || '').toLowerCase();
        const desc = (row.materialDescription || '').toLowerCase();
        const plant = (row.plant || '').toLowerCase();
        const batch = (row.batch || '').toLowerCase();
        const po = (row.purchaseOrder || row.poNumber || '').toLowerCase();
        const wbs = (row.wbsElement || '').toLowerCase();
        const sup = (row.supplier || '').toLowerCase();
        const loc = (row.storageLocation || '').toLowerCase();
        return (
          mat.includes(q) ||
          desc.includes(q) ||
          plant.includes(q) ||
          batch.includes(q) ||
          po.includes(q) ||
          wbs.includes(q) ||
          sup.includes(q) ||
          loc.includes(q)
        );
      });
    }

    // Sort
    return list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'valuation') {
        if (mode === 'medical-device') {
          valA = Number(a.totalAmount) || (Number(a.qty || 0) * Number(a.unitPrice || 0));
          valB = Number(b.totalAmount) || (Number(b.qty || 0) * Number(b.unitPrice || 0));
        } else if (mode === 'multiple-stock') {
          valA = (Number(a.currentValueOfUnrestrictedStock) || 0) + (Number(a.valueOfBlockedStock) || 0) + (Number(a.valueOfStockInQualityInspection) || 0);
          valB = (Number(b.currentValueOfUnrestrictedStock) || 0) + (Number(b.valueOfBlockedStock) || 0) + (Number(b.valueOfStockInQualityInspection) || 0);
        } else {
          valA = Number(a.amtInLocCur) || 0;
          valB = Number(b.amtInLocCur) || 0;
        }
      } else if (sortField === 'quantity') {
        if (mode === 'medical-device') {
          valA = Number(a.qty) || 0;
          valB = Number(b.qty) || 0;
        } else if (mode === 'multiple-stock') {
          valA = (Number(a.unrestrictedStock) || 0) + (Number(a.blockedStock) || 0) + (Number(a.stockInQualityInspection) || 0);
          valB = (Number(b.unrestrictedStock) || 0) + (Number(b.blockedStock) || 0) + (Number(b.stockInQualityInspection) || 0);
        } else {
          valA = Number(a.quantity) || 0;
          valB = Number(b.quantity) || 0;
        }
      } else if (sortField === 'material') {
        valA = a.material || '';
        valB = b.material || '';
      } else if (sortField === 'description') {
        valA = a.materialDescription || '';
        valB = b.materialDescription || '';
      } else if (sortField === 'plant') {
        valA = a.plant || '';
        valB = b.plant || '';
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [mode, items, multipleStockRecords, receivingRecords, streamFilter, selectedPlant, selectedStatus, searchQuery, sortField, sortAsc]);

  // Aggregate stats of filtered dataset
  const stats = useMemo(() => {
    let totalValuation = 0;
    let totalUnits = 0;
    let rdfValuation = 0;
    let rdfUnits = 0;
    let hpValuation = 0;
    let hpUnits = 0;

    filteredData.forEach(row => {
      let val = 0;
      let units = 0;

      if (mode === 'medical-device') {
        val = Number(row.totalAmount) || (Number(row.qty || 0) * Number(row.unitPrice || 0));
        units = Number(row.qty) || 0;
      } else if (mode === 'multiple-stock') {
        val = (Number(row.currentValueOfUnrestrictedStock) || 0) + (Number(row.valueOfBlockedStock) || 0) + (Number(row.valueOfStockInQualityInspection) || 0);
        units = (Number(row.unrestrictedStock) || 0) + (Number(row.blockedStock) || 0) + (Number(row.stockInQualityInspection) || 0);
      } else {
        val = Number(row.amtInLocCur) || 0;
        units = Number(row.quantity) || 0;
      }

      totalValuation += val;
      totalUnits += units;

      const stream = getItemStream(row);
      if (stream === 'HP') {
        hpValuation += val;
        hpUnits += units;
      } else {
        rdfValuation += val;
        rdfUnits += units;
      }
    });

    return {
      lineItems: filteredData.length,
      totalValuation,
      totalUnits,
      rdfValuation,
      rdfUnits,
      hpValuation,
      hpUnits
    };
  }, [filteredData, mode]);

  // Paginated records
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Toggle sort field
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Export CSV handler
  const handleExportCSV = () => {
    let exportRows: any[] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    if (mode === 'medical-device') {
      exportRows = filteredData.map((row: MedicalDeviceItem, idx) => ({
        '#': idx + 1,
        'Material Code': row.material,
        'Description': row.materialDescription,
        'Plant': row.plant,
        'Quantity': row.qty,
        'Unit Price': row.unitPrice,
        'Total Valuation ETB': Number(row.totalAmount) || (Number(row.qty || 0) * Number(row.unitPrice || 0)),
        'Program Stream': getItemStream(row),
        'Stock Type': row.stockType,
        'Special Stock': row.specialStockType,
        'Installation Status': row.installationStatus,
        'Delivery Status': row.deliveryStatus,
        'Batch': row.batch,
        'Expiry Date': row.expiryDate,
        'WBS Element': row.wbsElement
      }));
    } else if (mode === 'multiple-stock') {
      exportRows = filteredData.map((row: MultipleStockRecord, idx) => ({
        '#': idx + 1,
        'Material Code': row.material,
        'Description': row.materialDescription,
        'Plant': row.plant,
        'Storage Location': row.storageLocation,
        'Unrestricted Stock': row.unrestrictedStock,
        'Quality Inspection': row.stockInQualityInspection,
        'Blocked Stock': row.blockedStock,
        'Total Units': (row.unrestrictedStock || 0) + (row.stockInQualityInspection || 0) + (row.blockedStock || 0),
        'Unrestricted Val ETB': row.currentValueOfUnrestrictedStock,
        'Total Valuation ETB': (row.currentValueOfUnrestrictedStock || 0) + (row.valueOfBlockedStock || 0) + (row.valueOfStockInQualityInspection || 0),
        'Program Stream': getItemStream(row),
        'Special Stock Type': row.specialStockType,
        'Material Group': row.materialGroupName,
        'WBS Element': row.wbsElement
      }));
    } else {
      exportRows = filteredData.map((row: ReceivingDataRecord, idx) => ({
        '#': idx + 1,
        'Purchase Order': row.purchaseOrder,
        'Posting Date': row.postingDate || row.entryDate,
        'Material Code': row.material,
        'Description': row.materialDescription,
        'Plant': row.plant,
        'Storage Location': row.storageLocation,
        'Movement Type': row.movementType,
        'Quantity': row.quantity,
        'Amount in Loc Cur ETB': row.amtInLocCur,
        'Program Stream': getItemStream(row),
        'Special Stock': row.specialStock,
        'Batch': row.batch,
        'Supplier': row.supplier,
        'WBS Element': row.wbsElement
      }));
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    downloadCSV(`${safeTitle}_Source_Data_${dateStr}.csv`, exportRows);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-7xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* =========================================================================
            1. MODAL HEADER
            ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/60 shrink-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-600/40 border border-indigo-400/40 text-indigo-300 shadow-inner shrink-0">
              {mode === 'medical-device' && <ShieldCheck className="w-6 h-6 text-indigo-300" />}
              {mode === 'multiple-stock' && <Boxes className="w-6 h-6 text-indigo-300" />}
              {mode === 'receiving-data' && <PackageCheck className="w-6 h-6 text-teal-300" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono">
                  {badge || 'Granular Source Data'}
                </span>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  {title}
                </h2>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 truncate">
                {subtitle || 'Underlying transactional line items filtered from your active dashboard selection with full operational attributes.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              title="Export all currently filtered source records to CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. TOP METRIC RIBBON (Valuation, Units, RDF vs HP Breakdown)
            ========================================================================= */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* Card 1: Line Items / SKUs */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Catalog Line Items
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.lineItems.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Distinct catalog entries
            </div>
          </div>

          {/* Card 2: Physical Quantity */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Physical Quantity (Units)
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {formatNumber(stats.totalUnits)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Total physical assets
            </div>
          </div>

          {/* Card 3: Revolving Drug Fund (RDF) */}
          <div className="bg-white border border-emerald-300 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Revolving Drug Fund (RDF)
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5 font-mono">
              {formatCurrency(stats.rdfValuation)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              {formatNumber(stats.rdfUnits)} Units • Commercial
            </div>
          </div>

          {/* Card 4: Health Program (HP) */}
          <div className="bg-white border border-purple-300 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                Health Program (HP / Q)
              </span>
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-700 mt-0.5 font-mono">
              {formatCurrency(stats.hpValuation)}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">
              {formatNumber(stats.hpUnits)} Units • Grants & Projects
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. FILTER & SEARCH CONTROL TOOLBAR
            ========================================================================= */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Search */}
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search material, description, plant, batch..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fund Stream Filter (Buttons) */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => { setStreamFilter('all'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  streamFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Streams
              </button>
              <button
                type="button"
                onClick={() => { setStreamFilter('RDF'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  streamFilter === 'RDF'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                RDF Only
              </button>
              <button
                type="button"
                onClick={() => { setStreamFilter('HP'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  streamFilter === 'HP'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                HP (Q) Only
              </button>
            </div>

            {/* Plant Dropdown Filter */}
            {uniquePlants.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedPlant}
                  onChange={e => { setSelectedPlant(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-slate-800 text-xs font-medium focus:outline-hidden cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">All Plants ({uniquePlants.length})</option>
                  {uniquePlants.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status / Category Dropdown Filter */}
            {uniqueStatuses.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedStatus}
                  onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-slate-800 text-xs font-medium focus:outline-hidden cursor-pointer max-w-[160px] truncate"
                >
                  <option value="all">All Classifications ({uniqueStatuses.length})</option>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Results count & page size */}
          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <span>
              Showing <strong className="text-slate-900 font-mono">{filteredData.length.toLocaleString()}</strong> records
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-300 rounded-md px-1.5 py-0.5 text-xs text-slate-700 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. MAIN TABLE (High Clarity, Dense, Tabular Figures)
            ========================================================================= */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center text-slate-500">#</th>
                <th
                  onClick={() => handleSort('material')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Material Code</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition select-none min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Description</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('plant')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Plant Hub</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Mode-specific column headers */}
                {mode === 'medical-device' && (
                  <>
                    <th
                      onClick={() => handleSort('quantity')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Units</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">Unit Price (ETB)</th>
                    <th
                      onClick={() => handleSort('valuation')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Val (ETB)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Stream</th>
                    <th className="py-2.5 px-3">Status / Stage</th>
                    <th className="py-2.5 px-3">Batch / Expiry</th>
                    <th className="py-2.5 px-3">WBS Element</th>
                  </>
                )}

                {mode === 'multiple-stock' && (
                  <>
                    <th className="py-2.5 px-3">Storage Loc</th>
                    <th
                      onClick={() => handleSort('quantity')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Unrestricted</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">QA / Blocked</th>
                    <th className="py-2.5 px-3 text-right">Total Units</th>
                    <th
                      onClick={() => handleSort('valuation')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Val (ETB)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Stream</th>
                    <th className="py-2.5 px-3">Material Group</th>
                    <th className="py-2.5 px-3">WBS Element</th>
                  </>
                )}

                {mode === 'receiving-data' && (
                  <>
                    <th className="py-2.5 px-3">PO Number</th>
                    <th className="py-2.5 px-3">Posting Date</th>
                    <th className="py-2.5 px-3">Movement</th>
                    <th
                      onClick={() => handleSort('quantity')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Qty</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('valuation')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount (ETB)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Stream</th>
                    <th className="py-2.5 px-3">Special Stock</th>
                    <th className="py-2.5 px-3">Supplier / WBS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-sans">
                    <p className="text-sm font-semibold">No matching source data records found.</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing your search query or broadening the fund stream filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row: any, idx: number) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const stream = getItemStream(row);
                  const isSelected = selectedRowDetail === row;

                  return (
                    <tr
                      key={row.id || idx}
                      onClick={() => setSelectedRowDetail(isSelected ? null : row)}
                      className={`hover:bg-indigo-50/50 transition cursor-pointer ${
                        isSelected ? 'bg-indigo-50/80 font-semibold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      title="Click row to view full attribute drawer"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px] font-sans">
                        {globalIdx}
                      </td>
                      <td className="py-2 px-3 text-indigo-700 font-bold">
                        {row.material || '—'}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-900 font-medium max-w-[260px] truncate" title={row.materialDescription}>
                        {row.materialDescription || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {row.plant || '—'}
                      </td>

                      {/* Mode: Medical Device Item */}
                      {mode === 'medical-device' && (
                        <>
                          <td className="py-2 px-3 text-right text-slate-800 font-bold">
                            {formatNumber(Number(row.qty) || 0)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {formatCurrency(Number(row.unitPrice) || 0)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-black">
                            {formatCurrency(Number(row.totalAmount) || (Number(row.qty || 0) * Number(row.unitPrice || 0)))}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                stream === 'HP' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {stream === 'HP' ? 'HP (Q)' : 'RDF'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-700 truncate max-w-[140px]">
                            {row.installationStatus || row.stockType || row.deliveryStatus || 'Standard'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[120px]">
                            {row.batch ? `B:${row.batch}` : ''} {row.expiryDate ? `• Exp:${row.expiryDate}` : ''}
                          </td>
                          <td className="py-2 px-3 text-purple-700 text-[11px] truncate max-w-[120px]">
                            {row.wbsElement || '—'}
                          </td>
                        </>
                      )}

                      {/* Mode: Multiple Stock Record */}
                      {mode === 'multiple-stock' && (
                        <>
                          <td className="py-2 px-3 text-slate-600">
                            {row.storageLocation || '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                            {formatNumber(row.unrestrictedStock)}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-700">
                            {formatNumber((row.stockInQualityInspection || 0) + (row.blockedStock || 0))}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-bold">
                            {formatNumber((row.unrestrictedStock || 0) + (row.stockInQualityInspection || 0) + (row.blockedStock || 0))}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-black">
                            {formatCurrency((row.currentValueOfUnrestrictedStock || 0) + (row.valueOfBlockedStock || 0) + (row.valueOfStockInQualityInspection || 0))}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                stream === 'HP' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {stream === 'HP' ? 'HP (Q)' : 'RDF'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-700 truncate max-w-[140px]">
                            {row.materialGroupName || '—'}
                          </td>
                          <td className="py-2 px-3 text-purple-700 text-[11px] truncate max-w-[120px]">
                            {row.wbsElement || '—'}
                          </td>
                        </>
                      )}

                      {/* Mode: Receiving Data Record */}
                      {mode === 'receiving-data' && (
                        <>
                          <td className="py-2 px-3 text-teal-800 font-bold">
                            {row.purchaseOrder || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {row.postingDate || row.entryDate || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-bold">
                            {row.movementType || '101'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-bold">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="py-2 px-3 text-right text-teal-800 font-black">
                            {formatCurrency(row.amtInLocCur)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                stream === 'HP' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {stream === 'HP' ? 'HP (Q)' : 'RDF'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {row.specialStock || '—'}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-[140px]">
                            {row.supplier || row.wbsElement || '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            5. ROW ATTRIBUTE DETAIL DRAWER (When a row is clicked)
            ========================================================================= */}
        {selectedRowDetail && (
          <div className="bg-slate-900 text-white p-4 border-t border-slate-700 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-150">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-300">
                  {selectedRowDetail.material}
                </span>
                <span className="text-slate-400">•</span>
                <h4 className="text-xs font-bold text-white truncate max-w-xl">
                  {selectedRowDetail.materialDescription}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
                <span>Plant: <strong className="text-white">{selectedRowDetail.plant}</strong></span>
                <span>Storage Loc: <strong className="text-white">{selectedRowDetail.storageLocation || 'N/A'}</strong></span>
                <span>Stream: <strong className="text-emerald-400">{getItemStream(selectedRowDetail)}</strong></span>
                {selectedRowDetail.wbsElement && (
                  <span>WBS: <strong className="text-purple-300">{selectedRowDetail.wbsElement}</strong></span>
                )}
                {selectedRowDetail.batch && (
                  <span>Batch: <strong className="text-cyan-300">{selectedRowDetail.batch}</strong></span>
                )}
                {selectedRowDetail.purchaseOrder && (
                  <span>PO: <strong className="text-teal-300">{selectedRowDetail.purchaseOrder}</strong></span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRowDetail(null)}
              className="text-xs font-semibold text-slate-400 hover:text-white transition px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer self-end sm:self-center shrink-0"
            >
              Hide Details ✕
            </button>
          </div>
        )}

        {/* =========================================================================
            6. MODAL FOOTER & PAGINATION CONTROLS
            ========================================================================= */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-500 font-sans">
            Page <strong className="text-slate-900 font-mono">{currentPage}</strong> of{' '}
            <strong className="text-slate-900 font-mono">{totalPages}</strong> &bull;{' '}
            <span>{filteredData.length.toLocaleString()} total filtered entries</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-mono text-slate-600 font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
