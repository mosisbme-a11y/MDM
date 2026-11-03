import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  Mail,
  AlertCircle,
  Layers,
  Package,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  ShoppingBag,
  Clock
} from 'lucide-react';
import { NoBkdItem } from '../types';
import { formatNumber, downloadCSV } from '../utils/formatters';

interface NoBkdViewProps {
  items: NoBkdItem[];
  onSendMohEmail: (batchNumber?: string) => void;
  onUpdateItem?: (item: NoBkdItem) => void;
  isAdmin?: boolean;
}

interface BatchGroup {
  batchNumber: string;
  items: NoBkdItem[];
  totalQty: number;
  plant: string;
  storageLocation: string;
  wbsElement: string;
}

export const NoBkdView: React.FC<NoBkdViewProps> = ({ items, onSendMohEmail, onUpdateItem, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'batch' | 'list'>('batch');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [batchSortBy, setBatchSortBy] = useState<'qty-desc' | 'items-desc' | 'batch-asc'>('qty-desc');
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Requisition Modal State
  const [activeRequisitionBatch, setActiveRequisitionBatch] = useState<BatchGroup | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Group items batch-by-batch
  const batchGroups = useMemo<BatchGroup[]>(() => {
    const map = new Map<string, BatchGroup>();

    (items || []).forEach((item) => {
      const batchKey = item.batch || 'BT-PENDING';
      if (!map.has(batchKey)) {
        map.set(batchKey, {
          batchNumber: batchKey,
          items: [],
          totalQty: 0,
          plant: item.plant || 'Main Hub',
          storageLocation: item.storageLocation || 'Central Warehouse',
          wbsElement: item.wbsElement || 'N/A'
        });
      }
      const group = map.get(batchKey)!;
      group.items.push(item);
      group.totalQty += item.qty;
    });

    const groups = Array.from(map.values());

    // Sort batches
    groups.sort((a, b) => {
      if (batchSortBy === 'qty-desc') return b.totalQty - a.totalQty;
      if (batchSortBy === 'items-desc') return b.items.length - a.items.length;
      return a.batchNumber.localeCompare(b.batchNumber);
    });

    return groups;
  }, [items, batchSortBy]);

  // Unique batches list for filter dropdown
  const uniqueBatches = useMemo(() => {
    return Array.from(new Set((items || []).map((i) => i.batch || 'BT-PENDING'))).sort();
  }, [items]);

  // Filtered batch groups for Batch-by-Batch view
  const filteredBatchGroups = useMemo(() => {
    return batchGroups.filter((bg) => {
      if (selectedBatchFilter !== 'all' && bg.batchNumber !== selectedBatchFilter) {
        return false;
      }
      if (!searchTerm) return true;

      const term = searchTerm.toLowerCase();
      const matchBatch = bg.batchNumber.toLowerCase().includes(term);
      const matchWbs = bg.wbsElement.toLowerCase().includes(term);
      const matchItem = bg.items.some(
        (i) =>
          (i.description || '').toLowerCase().includes(term) ||
          (i.code || '').toLowerCase().includes(term) ||
          (i.storageLocation || '').toLowerCase().includes(term)
      );

      return matchBatch || matchWbs || matchItem;
    });
  }, [batchGroups, selectedBatchFilter, searchTerm]);

  // Filtered items for Table/List view
  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      if (selectedBatchFilter !== 'all' && (item.batch || 'BT-PENDING') !== selectedBatchFilter) {
        return false;
      }
      if (!searchTerm) return true;

      const term = searchTerm.toLowerCase();
      return (
        (item.description || '').toLowerCase().includes(term) ||
        (item.code || '').toLowerCase().includes(term) ||
        (item.batch || '').toLowerCase().includes(term) ||
        (item.wbsElement || '').toLowerCase().includes(term) ||
        (item.storageLocation || '').toLowerCase().includes(term)
      );
    });
  }, [items, selectedBatchFilter, searchTerm]);

  // Pagination for table view
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalQuantity = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.qty, 0);
  }, [items]);

  const toggleBatchExpand = (batchNumber: string) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [batchNumber]: !prev[batchNumber]
    }));
  };

  const expandAllBatches = () => {
    const next: Record<string, boolean> = {};
    filteredBatchGroups.forEach((bg) => {
      next[bg.batchNumber] = true;
    });
    setExpandedBatches(next);
  };

  const collapseAllBatches = () => {
    setExpandedBatches({});
  };

  const handleExportFilteredBreakdownItemsCSV = () => {
    // Collect the current view's filtered list of breakdown items
    const exportList = viewMode === 'batch'
      ? filteredBatchGroups.flatMap((bg) => bg.items)
      : filteredItems;

    if (!exportList || exportList.length === 0) {
      alert('No breakdown items match the current search or batch filter.');
      return;
    }

    const rows = exportList.map((i, idx) => ({
      'S/N': idx + 1,
      'Batch Number': i.batch || 'BT-PENDING',
      'Material Code': i.code || '',
      'Material Description': i.description || '',
      'Quantity': i.qty ?? 0,
      'Unit': i.unit || 'EA',
      'Plant / Hub': i.plant || '',
      'Storage Location': i.storageLocation || '',
      'WBS Element': i.wbsElement || '',
      'Expiry Date': i.expiryDate || 'N/A',
      'MOH Approval Status': i.mohApprovalStatus || 'Pending',
      'Audit Status': 'Awaiting MoH Breakdown',
      'Remark / Issue': i.remark || ''
    }));

    const dateStr = new Date().toISOString().slice(0, 10);
    const batchFilterTag = selectedBatchFilter !== 'all' ? `_Batch_${selectedBatchFilter}` : '';
    const searchFilterTag = searchTerm.trim() ? '_Filtered' : '';
    downloadCSV(`EPSS_Filtered_Breakdown_Items_${dateStr}${batchFilterTag}${searchFilterTag}.csv`, rows);
  };

  const handleExportItemsCSV = handleExportFilteredBreakdownItemsCSV;

  const handleExportBatchSummaryCSV = () => {
    const rows = filteredBatchGroups.map((bg, idx) => ({
      'S/N': idx + 1,
      'Batch Number': bg.batchNumber,
      'Total Units': bg.totalQty,
      'Distinct Items': bg.items.length,
      Plant: bg.plant,
      'Storage Location': bg.storageLocation,
      'WBS Element': bg.wbsElement,
      'Material Codes in Batch': bg.items.map((i) => i.code).join('; ')
    }));
    downloadCSV(`EPSS_Batch_by_Batch_Breakdown_Summary_${Date.now()}.csv`, rows);
  };

  const handleCopyRequisitionText = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* -------------------- MODE 1: BATCH-BY-BATCH VIEW -------------------- */}
      {viewMode === 'batch' && (
        <div className="space-y-3">
          {filteredBatchGroups.length === 0 ? null : (
            filteredBatchGroups.map((bg) => {
              const isExpanded = !!expandedBatches[bg.batchNumber];
              return (
                <div
                  key={bg.batchNumber}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition overflow-hidden"
                >
                  {/* Batch Header Summary */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleBatchExpand(bg.batchNumber)}
                        className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                        title={isExpanded ? 'Collapse batch details' : 'Expand batch details'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                            Batch #{bg.batchNumber}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {bg.items.length} {bg.items.length === 1 ? 'material SKU' : 'material SKUs'}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {formatNumber(bg.totalQty)} units
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span>
                            Location:{' '}
                            <strong className="text-slate-700 font-semibold">
                              {bg.plant} ({bg.storageLocation})
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">
                            WBS: <span className="text-slate-700">{bg.wbsElement}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <button
                          onClick={() => setActiveRequisitionBatch(bg)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer"
                          title={`Generate MoH Breakdown request for Batch #${bg.batchNumber}`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Request Batch Allocation</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleBatchExpand(bg.batchNumber)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition cursor-pointer"
                      >
                        {isExpanded ? 'Hide Items' : 'View Items'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Items Inside Batch */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-3 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3">Material Code</th>
                              <th className="py-2.5 px-3">Equipment / Spare Description</th>
                              <th className="py-2.5 px-3 text-right">Quantity</th>
                              <th className="py-2.5 px-3">Unit</th>
                              <th className="py-2.5 px-3">Storage Location</th>
                              <th className="py-2.5 px-3">Funding / Remark</th>
                              <th className="py-2.5 px-3">Audit Status</th>
                              <th className="py-2.5 px-3">MOH Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bg.items.map((item, idx) => (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                                  {item.code}
                                </td>
                                <td className="py-2.5 px-3 max-w-md font-medium text-slate-900">
                                  {item.description}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                  {formatNumber(item.qty)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{item.unit || 'EA'}</td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                  {item.plant} - {item.storageLocation}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                  {item.remark || item.wbsElement}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                    Awaiting Breakdown
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {isAdmin ? (
                                    <select 
                                      className={`text-[10px] font-semibold px-2 py-1 rounded border outline-hidden cursor-pointer ${
                                        item.mohApprovalStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                        item.mohApprovalStatus === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                        'bg-slate-50 border-slate-200 text-slate-700'
                                      }`}
                                      value={item.mohApprovalStatus || 'Pending'}
                                      onChange={(e) => onUpdateItem?.({...item, mohApprovalStatus: e.target.value as any})}
                                    >
                                      <option value="Pending">Pending Request</option>
                                      <option value="Approved">Approved</option>
                                      <option value="Rejected">Rejected</option>
                                    </select>
                                  ) : (
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                      item.mohApprovalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                      item.mohApprovalStatus === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {item.mohApprovalStatus || 'Pending'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* -------------------- MODE 2: TABLE VIEW WITH BATCH COLUMN -------------------- */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* List View Count & Export Action Bar */}
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <div>
              Showing <strong>{filteredItems.length}</strong> filtered breakdown items
              {searchTerm && <span> matching &quot;{searchTerm}&quot;</span>}
              {selectedBatchFilter !== 'all' && <span> in batch #{selectedBatchFilter}</span>}
            </div>
            <button
              onClick={handleExportFilteredBreakdownItemsCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer shadow-2xs"
              title="Export current view's filtered list as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Filtered List ({filteredItems.length} CSV)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Material Code</th>
                    <th className="py-3 px-4">Material Description</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">WBS Element</th>
                    <th className="py-3 px-4">Audit Status</th>
                    <th className="py-3 px-4 text-center">MOH Status</th>
                    <th className="py-3 px-4 text-center">Batch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No items found matching the search criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, index) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                      const parentBatch = batchGroups.find((bg) => bg.batchNumber === item.batch);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-center font-mono text-slate-400">{globalIndex}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              #{item.batch || 'BT-PENDING'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="py-3 px-4 max-w-sm font-medium text-slate-900">
                            {item.description}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatNumber(item.qty)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{item.unit || 'EA'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{item.plant}</span>
                            <span className="text-slate-500 ml-1">({item.storageLocation || 'HOM6'})</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {item.wbsElement}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Awaiting Breakdown
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isAdmin ? (
                              <select 
                                className={`text-[10px] font-semibold px-2 py-1.5 rounded border outline-hidden cursor-pointer ${
                                  item.mohApprovalStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                  item.mohApprovalStatus === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                  'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                                value={item.mohApprovalStatus || 'Pending'}
                                onChange={(e) => onUpdateItem?.({...item, mohApprovalStatus: e.target.value as any})}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            ) : (
                              <span className={`text-[10px] font-semibold px-2 py-1 rounded ${
                                item.mohApprovalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                item.mohApprovalStatus === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {item.mohApprovalStatus || 'Pending'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isAdmin ? (
                              <button
                                onClick={() => {
                                  if (parentBatch) {
                                    setActiveRequisitionBatch(parentBatch);
                                  } else {
                                    onSendMohEmail(item.batch);
                                  }
                                }}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                Request MoH
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">View Only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                <div>
                  Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (
                  <strong>{filteredItems.length}</strong> items total)
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2.5 py-1 rounded border text-xs font-medium transition cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span className="px-1 text-slate-400">...</span>}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- BATCH REQUISITION MODAL -------------------- */}
      {activeRequisitionBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Mail className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    MoH Allocation Requisition for Batch #{activeRequisitionBatch.batchNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official dispatch memo for {activeRequisitionBatch.items.length} items (
                    {formatNumber(activeRequisitionBatch.totalQty)} total units)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveRequisitionBatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Item Details Summary */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Location:</span>
                <strong className="text-slate-800">
                  {activeRequisitionBatch.plant} ({activeRequisitionBatch.storageLocation})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Funding / WBS Element:</span>
                <strong className="text-slate-800 font-mono">{activeRequisitionBatch.wbsElement}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Batch Quantity:</span>
                <strong className="text-indigo-700 font-bold">
                  {formatNumber(activeRequisitionBatch.totalQty)} Units
                </strong>
              </div>
            </div>

            {/* Generated Requisition Text */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Official Allocation Memorandum Body:</label>
              <textarea
                readOnly
                rows={7}
                value={`To: Ministry of Health, Directorate of Medical Devices
From: Ethiopian Pharmaceuticals Supply Service (EPSS) - Medical Device Directorate
Subject: Urgent Regional Breakdown Allocation Request for Batch #${activeRequisitionBatch.batchNumber}

Dear Sir/Madam,

In accordance with our July 2026 Inventory Analysis, the following items under Batch #${activeRequisitionBatch.batchNumber} are currently stored at Head Office (${activeRequisitionBatch.storageLocation}) under WBS Element [${activeRequisitionBatch.wbsElement}] awaiting regional hospital breakdown allocation:

${activeRequisitionBatch.items
  .map(
    (item, i) =>
      `${i + 1}. [${item.code}] ${item.description} - ${formatNumber(item.qty)} ${item.unit || 'EA'}`
  )
  .join('\n')}

Total Batch Quantity: ${formatNumber(activeRequisitionBatch.totalQty)} units.

To ensure uninterrupted clinical services and avoid long-term idle storage, kindly provide the approved regional allocation schedule at your earliest convenience.

Kind regards,
EPSS Biomedical Engineering Directorate`}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() =>
                  handleCopyRequisitionText(`To: Ministry of Health, Directorate of Medical Devices
From: Ethiopian Pharmaceuticals Supply Service (EPSS)
Subject: Urgent Regional Breakdown Allocation Request for Batch #${activeRequisitionBatch.batchNumber}

Batch: #${activeRequisitionBatch.batchNumber}
Location: ${activeRequisitionBatch.storageLocation}
WBS: ${activeRequisitionBatch.wbsElement}
Total Units: ${formatNumber(activeRequisitionBatch.totalQty)}

Items:
${activeRequisitionBatch.items
  .map((item, i) => `${i + 1}. [${item.code}] ${item.description} - ${formatNumber(item.qty)} ${item.unit || 'EA'}`)
  .join('\n')}`)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                {isCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? 'Copied to Clipboard' : 'Copy Memorandum'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const batchNum = activeRequisitionBatch.batchNumber;
                    setActiveRequisitionBatch(null);
                    onSendMohEmail(batchNum);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Workspace Email</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
