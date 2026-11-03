import React, { useState } from 'react';
import { 
  Archive, 
  Edit3, 
  Send, 
  Trash2, 
  X, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  Layers, 
  Search, 
  ShieldCheck,
  Plus,
  Table as TableIcon
} from 'lucide-react';
import { DspWorkflowRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface SavedDraftsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: DspWorkflowRecord[];
  onUpdateRecord: (updatedRecord: DspWorkflowRecord) => void;
  onDeleteRecord: (id: string) => void;
  onSubmitDraft: (record: DspWorkflowRecord) => void;
}

export const SavedDraftsManagerModal: React.FC<SavedDraftsManagerModalProps> = ({
  isOpen,
  onClose,
  records,
  onUpdateRecord,
  onDeleteRecord,
  onSubmitDraft
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecord, setEditingRecord] = useState<DspWorkflowRecord | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const draftRecords = records.filter(r => (r.status as string) === 'Draft' || (r.status as string) === 'Saved Draft');
  
  const filteredDrafts = draftRecords.filter(d => 
    d.dspRefNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.stageTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    // Recalculate total quantity from items included
    const computedTotalQty = editingRecord.itemsIncluded.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
    const finalizedRecord = {
      ...editingRecord,
      totalQuantity: computedTotalQty > 0 ? computedTotalQty : editingRecord.totalQuantity,
      totalDevices: editingRecord.itemsIncluded.length
    };

    onUpdateRecord(finalizedRecord);
    setNotification('Draft exact source data updated successfully!');
    setEditingRecord(null);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <Archive className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Saved Drafts & Editable Exact Source Data Manager</h2>
              <p className="text-xs text-amber-100/90">
                Review, modify exact source data tables, items, and quantities before final submission
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search drafts by ref, subject, stage..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none shadow-inner"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
              {draftRecords.length} Saved Draft{draftRecords.length === 1 ? '' : 's'} Stored
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredDrafts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
                <Archive className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">No Saved Drafts Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When you click "Save Draft" on any breakdown request or workflow requisition, it will be safely stored here so you can inspect and edit its exact source data table before sending.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDrafts.map((draft) => (
                <div 
                  key={draft.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                        {draft.dspRefNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {draft.stageTitle || draft.stage}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {draft.dateSubmitted}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{draft.subject}</h4>
                    
                    <p className="text-[11px] text-slate-600 italic">
                      {draft.notes || 'No custom remarks or justification provided.'}
                    </p>

                    <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500 font-medium">
                      <span>Items Included: <strong className="text-slate-800">{draft.itemsIncluded?.length || draft.totalDevices}</strong></span>
                      <span>Total Qty: <strong className="text-slate-800">{formatNumber(draft.totalQuantity)} Units</strong></span>
                      <span>Regions: <strong className="text-slate-800">{draft.targetedRegions?.join(', ') || 'All Regions'}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button
                      onClick={() => setEditingRecord(JSON.parse(JSON.stringify(draft)))}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Source Data</span>
                    </button>

                    <button
                      onClick={() => {
                        onSubmitDraft(draft);
                        onDeleteRecord(draft.id);
                        setNotification(`Draft ${draft.dspRefNumber} submitted successfully!`);
                        setTimeout(() => setNotification(null), 3000);
                      }}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send / Submit</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete draft ${draft.dspRefNumber}?`)) {
                          onDeleteRecord(draft.id);
                          setNotification(`Draft ${draft.dspRefNumber} deleted.`);
                          setTimeout(() => setNotification(null), 3000);
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Stored drafts are persisted securely in local browser cache & Firestore</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition cursor-pointer"
          >
            Close Manager
          </button>
        </div>

      </div>

      {/* Edit Draft Exact Source Data Table Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Edit Exact Source Data Table: {editingRecord.dspRefNumber}</h3>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Draft Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Draft Reference Number
                  </label>
                  <input 
                    type="text"
                    value={editingRecord.dspRefNumber}
                    onChange={(e) => setEditingRecord({ ...editingRecord, dspRefNumber: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Subject / Title
                  </label>
                  <input 
                    type="text"
                    value={editingRecord.subject}
                    onChange={(e) => setEditingRecord({ ...editingRecord, subject: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Date Saved
                  </label>
                  <input 
                    type="date"
                    value={editingRecord.dateSubmitted}
                    onChange={(e) => setEditingRecord({ ...editingRecord, dateSubmitted: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Justification / Remarks
                  </label>
                  <input 
                    type="text"
                    value={editingRecord.notes || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Exact Source Data Items Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exact Source Data Items & Quantities</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newItem = {
                        material: `MAT-${Math.floor(100000 + Math.random() * 900000)}`,
                        description: 'New Medical Equipment Item',
                        quantity: 1,
                        plant: 'HO01'
                      };
                      setEditingRecord({
                        ...editingRecord,
                        itemsIncluded: [...(editingRecord.itemsIncluded || []), newItem]
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item to Source Data</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3 border-b border-slate-200">#</th>
                          <th className="p-3 border-b border-slate-200">Material Code</th>
                          <th className="p-3 border-b border-slate-200">Item Description</th>
                          <th className="p-3 border-b border-slate-200">Plant / Region</th>
                          <th className="p-3 border-b border-slate-200 text-right">Quantity</th>
                          <th className="p-3 border-b border-slate-200 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {(!editingRecord.itemsIncluded || editingRecord.itemsIncluded.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400 text-xs italic">
                              No source items included in this draft. Click "Add Item to Source Data" above.
                            </td>
                          </tr>
                        ) : (
                          editingRecord.itemsIncluded.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-indigo-600">
                                <input 
                                  type="text"
                                  value={item.material || ''}
                                  onChange={(e) => {
                                    const updated = [...editingRecord.itemsIncluded];
                                    updated[idx].material = e.target.value;
                                    setEditingRecord({ ...editingRecord, itemsIncluded: updated });
                                  }}
                                  className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input 
                                  type="text"
                                  value={item.description || ''}
                                  onChange={(e) => {
                                    const updated = [...editingRecord.itemsIncluded];
                                    updated[idx].description = e.target.value;
                                    setEditingRecord({ ...editingRecord, itemsIncluded: updated });
                                  }}
                                  className="w-full min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input 
                                  type="text"
                                  value={item.plant || 'HO01'}
                                  onChange={(e) => {
                                    const updated = [...editingRecord.itemsIncluded];
                                    updated[idx].plant = e.target.value;
                                    setEditingRecord({ ...editingRecord, itemsIncluded: updated });
                                  }}
                                  className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </td>
                              <td className="p-3 text-right">
                                <input 
                                  type="number"
                                  value={item.quantity || 0}
                                  onChange={(e) => {
                                    const updated = [...editingRecord.itemsIncluded];
                                    updated[idx].quantity = Number(e.target.value) || 0;
                                    setEditingRecord({ ...editingRecord, itemsIncluded: updated });
                                  }}
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-right text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = editingRecord.itemsIncluded.filter((_, i) => i !== idx);
                                    setEditingRecord({ ...editingRecord, itemsIncluded: updated });
                                  }}
                                  className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Total Source Items: {editingRecord.itemsIncluded?.length || 0}</span>
                    <span className="text-indigo-600">
                      Total Quantity: {formatNumber(editingRecord.itemsIncluded?.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0) || 0)} Units
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Exact Source Data Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
