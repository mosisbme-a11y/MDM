import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Package,
  Search,
  Upload,
  Download,
  Trash2,
  PlusCircle,
  FileSpreadsheet,
  Eye,
  X,
  AlertTriangle,
  PieChart,
  BarChart3,
  Layers,
  Building2,
  Tag
} from 'lucide-react';
import { MaterialMasterRecord } from '../types';
import { downloadCSV } from '../utils/formatters';
import { MaterialMasterUploadModal, parseMaterialMasterRows, parseMaterialMasterWorkbook } from './MaterialMasterUploadModal';

interface MaterialMasterViewProps {
  items: MaterialMasterRecord[];
  onUploadMaterialMasterData: (items: MaterialMasterRecord[], mode: 'replace' | 'append', files?: { name: string, url: string }[]) => void;
  onClearAllMaterialMasterData: () => void;
  onAddMaterialItem?: (item: MaterialMasterRecord) => void;
  onDeleteMaterialItem?: (id: string) => void;
  isAdmin?: boolean;
}

export const MaterialMasterView: React.FC<MaterialMasterViewProps> = ({
  items,
  onUploadMaterialMasterData,
  onClearAllMaterialMasterData,
  onAddMaterialItem,
  onDeleteMaterialItem,
  isAdmin = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<MaterialMasterRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeChartDim, setActiveChartDim] = useState<'productGroup' | 'plant' | 'product'>('productGroup');

  const [newItemData, setNewItemData] = useState<Partial<MaterialMasterRecord>>({
    product: '',
    material: '',
    plant: 'HO01',
    productType: 'Medical Device',
    productGroup: 'Diagnostic Imaging'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          (item.material || '').toLowerCase().includes(q) ||
          (item.product || '').toLowerCase().includes(q) ||
          (item.plant || '').toLowerCase().includes(q) ||
          (item.productType || '').toLowerCase().includes(q) ||
          (item.productGroup || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, searchTerm]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.ceil(filteredItems.length / itemsPerPage) || 1;
  }, [filteredItems.length, itemsPerPage]);

  const paginatedItems = useMemo(() => {
    if (itemsPerPage === 'all') return filteredItems;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      let key = '';
      if (activeChartDim === 'productGroup') key = item.productGroup || 'Unassigned';
      else if (activeChartDim === 'plant') key = item.plant || 'Unassigned';
      else key = item.product || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = items.length || 1;
    const colors = [
      '#0891b2', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
      '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981',
      '#14b8a6', '#0284c7', '#4f46e5', '#7c3aed', '#db2777'
    ];

    const sorted = Object.entries(counts)
      .map(([name, count], idx) => ({
        name,
        count,
        percentage: Number(((count / total) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.count - a.count);

    return sorted;
  }, [items, activeChartDim]);

  const handleDirectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const parsed = parseMaterialMasterWorkbook(wb, file.name);
          if (parsed.length > 0) {
            onUploadMaterialMasterData(parsed, 'append');
          }
        } catch (err) {
          console.error('Failed to parse file:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSaveNewItem = () => {
    if (!newItemData.material?.trim() || !newItemData.product?.trim()) {
      alert('Please provide both Material Code and Product.');
      return;
    }

    const record: MaterialMasterRecord = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      product: newItemData.product.trim(),
      material: newItemData.material.trim(),
      plant: (newItemData.plant || 'HO01').toUpperCase(),
      productType: newItemData.productType || 'Medical Device',
      productGroup: newItemData.productGroup || 'Diagnostic Imaging',
      uploadedAt: new Date().toISOString(),
      sourceFile: 'Manual Entry'
    };

    if (onAddMaterialItem) {
      onAddMaterialItem(record);
    } else {
      onUploadMaterialMasterData([record], 'append');
    }

    setIsAddModalOpen(false);
    setNewItemData({
      product: '',
      material: '',
      plant: 'HO01',
      productType: 'Medical Device',
      productGroup: 'Diagnostic Imaging'
    });
  };

  return (
    <div id="view-material-master" className="space-y-6 pb-12">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleDirectFileChange} className="hidden" />

      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Material Master Analytics & Records</h1>
              <p className="text-xs text-slate-500">Analyze product distribution across Product, Plant, and Product Group.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl shadow-sm cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            )}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 rounded-xl">
              <PlusCircle className="w-3.5 h-3.5" /> + Add
            </button>
            {items.length > 0 && (
                <button onClick={() => setShowClearConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
            )}
          </div>
        </div>
      </div>

      {/* Circle Graph & Analytics Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Circular Distribution Analysis</h2>
              <p className="text-[11px] text-slate-500">Visual breakdown of Material Master items by dimension</p>
            </div>
          </div>

          {/* Dimension Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveChartDim('productGroup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeChartDim === 'productGroup' ? 'bg-white text-cyan-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Layers className="w-3.5 h-3.5" /> Product Group
            </button>
            <button
              onClick={() => setActiveChartDim('plant')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeChartDim === 'plant' ? 'bg-white text-cyan-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Building2 className="w-3.5 h-3.5" /> Plant
            </button>
            <button
              onClick={() => setActiveChartDim('product')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeChartDim === 'product' ? 'bg-white text-cyan-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Tag className="w-3.5 h-3.5" /> Product
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No Material Master data available. Upload a file or add items to view the circular graph analytics.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Circle Graph Visual (Donut SVG) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    let cumulativePercent = 0;
                    const radius = 38;
                    const circumference = 2 * Math.PI * radius;
                    return chartData.map((slice, idx) => {
                      const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                      cumulativePercent += slice.percentage;
                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="18"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-500 hover:opacity-90 cursor-pointer"
                        >
                          <title>{`${slice.name}: ${slice.count} items (${slice.percentage}%)`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-black text-slate-900">{items.length}</span>
                  <span className="text-[10px] font-semibold text-cyan-700 capitalize">{activeChartDim.replace(/([A-Z])/g, ' $1')}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 text-center">Hover or view legend below for distribution details</p>
            </div>

            {/* Legend & Breakdown list */}
            <div className="lg:col-span-7 space-y-3 max-h-72 overflow-y-auto pr-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Distribution Breakdown ({chartData.length} categories)
              </div>
              {chartData.map((slice, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: slice.color }} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{slice.name}</div>
                      <div className="text-[10px] text-slate-500">{slice.count} items recorded</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(slice.percentage, 3)}%`, backgroundColor: slice.color }} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 min-w-[45px] text-right">{slice.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, materials, plants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs"></span> Synced</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Offline</span>
            </div>
            <span>Showing <strong>{paginatedItems.length}</strong> of <strong>{items.length}</strong> material items</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 cursor-pointer focus:outline-none focus:border-cyan-500 shadow-2xs"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={500}>500 / page</option>
              <option value="all">Show All ({filteredItems.length})</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Material Code</th>
                <th className="py-3 px-4">Plant</th>
                <th className="py-3 px-4">Product Type</th>
                <th className="py-3 px-4">Product Group</th>
                <th className="py-3 px-4 text-center">Firebase Sync</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">No matching records found.</td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const status = item.syncStatus || 'synced';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              status === 'pending'
                                ? 'bg-amber-500 animate-ping'
                                : status === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500 shadow-xs shadow-emerald-400/50'
                            }`}
                            title={
                              status === 'pending'
                                ? 'Pending sync with Firebase'
                                : status === 'offline'
                                ? 'Stored locally / offline'
                                : 'Successfully synced with Firebase backend'
                            }
                          />
                          <span>{item.product}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-900 font-bold">{item.material}</td>
                      <td className="py-3 px-4 font-mono">{item.plant}</td>
                      <td className="py-3 px-4 text-slate-600">{item.productType}</td>
                      <td className="py-3 px-4 text-slate-600">{item.productGroup}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            status === 'pending'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : status === 'offline'
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                          title={
                            status === 'pending'
                              ? 'Record pending upload to Firestore'
                              : status === 'offline'
                              ? 'Offline record saved locally'
                              : 'Record verified and active on Firebase Firestore'
                          }
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'pending'
                                ? 'bg-amber-500 animate-pulse'
                                : status === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span>{status === 'pending' ? 'Pending' : status === 'offline' ? 'Offline' : 'Synced'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                          <button onClick={() => setSelectedItemDetail(item)} className="p-1 text-slate-500 hover:text-cyan-700" title="View details">
                              <Eye className="w-4 h-4" />
                          </button>
                          {onDeleteMaterialItem && (
                              <button onClick={() => onDeleteMaterialItem(item.id)} className="p-1 text-rose-500 hover:text-rose-700 ml-1" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <h3 className="font-bold text-lg">Add Material Item</h3>
            <input type="text" placeholder="Product Name" value={newItemData.product} onChange={(e) => setNewItemData({...newItemData, product: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs"/>
            <input type="text" placeholder="Material Code" value={newItemData.material} onChange={(e) => setNewItemData({...newItemData, material: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"/>
            <input type="text" placeholder="Plant" value={newItemData.plant} onChange={(e) => setNewItemData({...newItemData, plant: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"/>
            <input type="text" placeholder="Product Type" value={newItemData.productType} onChange={(e) => setNewItemData({...newItemData, productType: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs"/>
            <input type="text" placeholder="Product Group" value={newItemData.productGroup} onChange={(e) => setNewItemData({...newItemData, productGroup: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-xs"/>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-xl text-xs font-medium">Cancel</button>
                <button onClick={handleSaveNewItem} className="px-4 py-2 bg-cyan-700 text-white rounded-xl text-xs font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Admin Only */}
      {isAdmin && isUploadModalOpen && (
        <MaterialMasterUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadMaterialMasterData={onUploadMaterialMasterData}
        />
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Clear All Material Master?</h3>
            <p className="text-xs text-slate-500">This action will remove all uploaded material records. This cannot be undone.</p>
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl text-xs">Cancel</button>
              <button onClick={() => { onClearAllMaterialMasterData(); setShowClearConfirm(false); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs">Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">Material Item Details</h3>
              <button onClick={() => setSelectedItemDetail(null)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-xs text-slate-700">
              <div><strong className="text-slate-400 block text-[10px] uppercase">Product</strong><span className="font-medium text-slate-900 text-sm">{selectedItemDetail.product}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><strong className="text-slate-400 block text-[10px] uppercase">Material Code</strong><span className="font-mono font-bold text-cyan-900 text-sm">{selectedItemDetail.material}</span></div>
                <div><strong className="text-slate-400 block text-[10px] uppercase">Plant</strong><span className="font-mono font-semibold">{selectedItemDetail.plant}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><strong className="text-slate-400 block text-[10px] uppercase">Product Type</strong><span>{selectedItemDetail.productType}</span></div>
                <div><strong className="text-slate-400 block text-[10px] uppercase">Product Group</strong><span>{selectedItemDetail.productGroup}</span></div>
              </div>
              {selectedItemDetail.sourceFile && (
                <div><strong className="text-slate-400 block text-[10px] uppercase">Source File</strong><span className="text-slate-500">{selectedItemDetail.sourceFile}</span></div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedItemDetail(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-medium text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
