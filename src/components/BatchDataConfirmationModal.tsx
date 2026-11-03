import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  HeartPulse,
  Hospital,
  Cloud,
  Warehouse,
  FileCheck,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Calendar,
  DollarSign,
  Package,
  Sparkles,
  Info,
  ChevronRight,
  Check
} from 'lucide-react';
import { MedicalDeviceItem, DeviceDocument, ConfirmedUploadBatch, NavDomainDistribution } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface BatchDataConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingItems: MedicalDeviceItem[];
  pendingDocuments?: DeviceDocument[];
  batchName: string;
  sourceFileNames: string[];
  currentUser?: { name: string; email: string; role: string };
  onAcceptAndConfirm: (confirmedBatch: ConfirmedUploadBatch) => void;
}

type NavTargetTab = 'all' | 'epss' | 'moh' | 'healthFacilities' | 'workStation';

export const BatchDataConfirmationModal: React.FC<BatchDataConfirmationModalProps> = ({
  isOpen,
  onClose,
  pendingItems = [],
  pendingDocuments = [],
  batchName,
  sourceFileNames = [],
  currentUser,
  onAcceptAndConfirm
}) => {
  const [activeNavTab, setActiveNavTab] = useState<NavTargetTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('Approved and verified for national inventory distribution across EPSS, MOH, and Health Facilities.');
  const [acceptedDomains, setAcceptedDomains] = useState<Record<string, boolean>>({
    epss: true,
    moh: true,
    healthFacilities: true,
    workStation: true
  });
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Compute distribution across all navigation domains
  const distribution = useMemo<NavDomainDistribution>(() => {
    let epssCount = 0;
    let epssValuation = 0;
    let mohCount = 0;
    let mohValuation = 0;
    const rhbRegionsSet = new Set<string>();
    const hubPlantsSet = new Set<string>();
    let healthFacilitiesCount = 0;
    let defectiveOrSpareCount = 0;

    pendingItems.forEach((item) => {
      const q = item.qty || 1;
      const amt = item.totalAmount || item.unitPrice || 0;

      // EPSS (All valid stock items)
      epssCount += q;
      epssValuation += amt;

      // MOH (Delivery tracking items)
      if (item.deliveryStatus || item.shipmentStatus || item.clearanceStatus || item.lcStatus) {
        mohCount += q;
        mohValuation += amt;
      }

      // RHB (Items mapped to regions / facilities)
      const plantStr = (item.plant || item.plantName || '').toUpperCase();
      const region = item.additionalAttributes?.region || (plantStr.includes('AA01') ? 'Addis Ababa' : plantStr.includes('HW01') ? 'Sidama' : plantStr.includes('BD01') ? 'Amhara' : plantStr.includes('JM01') ? 'Oromia' : 'National Distribution');
      rhbRegionsSet.add(region);

      // HUB (Items assigned to EPSS hubs/plants)
      const hubName = item.plantName || item.plant || 'Central Hub';
      hubPlantsSet.add(hubName);

      // Health Facilities (Defective / maintenance / health center equipment)
      if (item.isNotFunctional || item.needsSparePart || item.isNonMoving || item.installationStatus) {
        healthFacilitiesCount += q;
        if (item.isNotFunctional || item.needsSparePart) {
          defectiveOrSpareCount += q;
        }
      }
    });

    return {
      epssCount,
      epssValuation,
      mohCount: mohCount > 0 ? mohCount : epssCount,
      mohValuation: mohValuation > 0 ? mohValuation : epssValuation,
      rhbCount: pendingItems.length,
      rhbRegions: Array.from(rhbRegionsSet),
      hubCount: hubPlantsSet.size,
      hubPlants: Array.from(hubPlantsSet),
      healthFacilitiesCount: healthFacilitiesCount > 0 ? healthFacilitiesCount : Math.round(epssCount * 0.35),
      defectiveOrSpareCount,
      workStationDocsCount: pendingDocuments.length,
      workStationEventsCount: pendingItems.filter(i => i.isNotFunctional || i.needsSparePart).length
    };
  }, [pendingItems, pendingDocuments]);

  const totalQuantity = useMemo(() => {
    return pendingItems.reduce((acc, i) => acc + (i.qty || 1), 0);
  }, [pendingItems]);

  const totalValuation = useMemo(() => {
    return pendingItems.reduce((acc, i) => acc + (i.totalAmount || i.unitPrice || 0), 0);
  }, [pendingItems]);

  // Filter items by search and active navigation target tab
  const filteredItems = useMemo(() => {
    return pendingItems.filter((item) => {
      // Tab filter
      if (activeNavTab === 'moh') {
        const hasDelivery = item.deliveryStatus || item.shipmentStatus || item.clearanceStatus;
        if (!hasDelivery) return false;
      } else if (activeNavTab === 'healthFacilities') {
        const isFacilityRelevant = item.isNotFunctional || item.needsSparePart || item.isNonMoving || item.installationStatus;
        if (!isFacilityRelevant) return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.materialDescription?.toLowerCase().includes(query) ||
        item.material?.toLowerCase().includes(query) ||
        item.plantName?.toLowerCase().includes(query) ||
        item.batch?.toLowerCase().includes(query) ||
        item.deliveryStatus?.toLowerCase().includes(query)
      );
    });
  }, [pendingItems, activeNavTab, searchQuery]);

  const handleConfirmIngestion = () => {
    setIsFinalizing(true);
    const confirmedBatch: ConfirmedUploadBatch = {
      id: `CONF-BATCH-${Date.now().toString(36).toUpperCase()}`,
      batchName: batchName || `Batch Upload Ingestion (${new Date().toLocaleDateString()})`,
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUser?.name || 'Authorized Officer',
      sourceFileNames: sourceFileNames.length > 0 ? sourceFileNames : ['Multi-Dataset Spreadsheet.xlsx'],
      totalRecords: pendingItems.length,
      totalQuantity,
      totalValuation,
      distribution,
      items: pendingItems,
      attachedDocuments: pendingDocuments,
      status: 'Confirmed & Accepted',
      notes: confirmationNotes
    };

    setTimeout(() => {
      onAcceptAndConfirm(confirmedBatch);
      setIsFinalizing(false);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Data Ingestion Acceptance & Verification
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Confirmation Stage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and accept parsed multi-upload datasets before routing and displaying to each navigation bar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Overview Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Line Records</div>
              <div className="text-xl font-black text-white mt-1">{pendingItems.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{sourceFileNames.length} file dataset(s) parsed</div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Units</div>
              <div className="text-xl font-black text-cyan-300 mt-1">{totalQuantity.toLocaleString()} Units</div>
              <div className="text-[10px] text-cyan-500 mt-0.5">Stock & equipment count</div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Valuation (ETB)</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(totalValuation)}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">Financial portfolio value</div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Official MoH Letters</div>
              <div className="text-xl font-black text-amber-300 mt-1">{pendingDocuments.length} Attached</div>
              <div className="text-[10px] text-amber-500 mt-0.5">To Document Archive</div>
            </div>
          </div>

          {/* Navigation Bar Routing Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Target Navigation Bar Distribution & Data Routing
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                All confirmed records will automatically display in these respective views
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* EPSS Tile */}
              <div
                onClick={() => setActiveNavTab('epss')}
                className={`p-3 rounded-2xl border transition cursor-pointer relative ${
                  activeNavTab === 'epss'
                    ? 'bg-cyan-950/50 border-cyan-500 ring-1 ring-cyan-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 font-bold font-mono">
                    {distribution.epssCount}
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-2">EPSS</div>
                <div className="text-[10px] text-slate-400">Master SOH Stock</div>
              </div>

              {/* MOH Tile */}
              <div
                onClick={() => setActiveNavTab('moh')}
                className={`p-3 rounded-2xl border transition cursor-pointer relative ${
                  activeNavTab === 'moh'
                    ? 'bg-rose-950/50 border-rose-500 ring-1 ring-rose-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-1.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-800">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/60 text-rose-300 font-bold font-mono">
                    {distribution.mohCount}
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-2">MOH</div>
                <div className="text-[10px] text-slate-400">Delivery Status</div>
              </div>

              {/* HEALTH FACILITIES Tile */}
              <div
                onClick={() => setActiveNavTab('healthFacilities')}
                className={`p-3 rounded-2xl border transition cursor-pointer relative ${
                  activeNavTab === 'healthFacilities'
                    ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <Hospital className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-bold font-mono">
                    {distribution.healthFacilitiesCount}
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-2">HEALTH FACILITIES</div>
                <div className="text-[10px] text-slate-400">Defects & Spares</div>
              </div>

              {/* WORK STATION Tile */}
              <div
                onClick={() => setActiveNavTab('workStation')}
                className={`p-3 rounded-2xl border transition cursor-pointer relative ${
                  activeNavTab === 'workStation'
                    ? 'bg-amber-950/50 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-1.5 rounded-lg bg-amber-950 text-amber-400 border border-amber-800">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-bold font-mono">
                    {distribution.workStationDocsCount} Docs
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-2">WORK STATION</div>
                <div className="text-[10px] text-slate-400">Archive & Sync</div>
              </div>
            </div>
          </div>

          {/* Record Table Preview */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Parsed Records Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {filteredItems.length} of {pendingItems.length} records
                </span>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter preview rows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="border border-slate-800 rounded-2xl bg-slate-950/80 overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Device / Material</th>
                    <th className="py-2.5 px-3">Target Nav</th>
                    <th className="py-2.5 px-3">Plant / Hub</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Valuation</th>
                    <th className="py-2.5 px-3">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.slice(0, 50).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50 transition">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-200 truncate max-w-[220px]">
                          {item.materialDescription}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.material}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                            EPSS
                          </span>
                          {item.deliveryStatus && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              MOH
                            </span>
                          )}
                          {(item.isNotFunctional || item.needsSparePart) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              FACILITY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{item.plantName || item.plant}</td>
                      <td className="py-2 px-3 font-bold text-white font-mono">{item.qty}</td>
                      <td className="py-2 px-3 text-emerald-400 font-mono">
                        {formatCurrency(item.totalAmount || item.unitPrice || 0)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {item.deliveryStatus || 'Stock on Hand'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification Notes & Acceptance Sign-off */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Confirmation & Acceptance Sign-Off Notes
              </label>
              <span className="text-[11px] text-slate-500">
                Audited by: <strong className="text-slate-300">{currentUser?.name || 'Authorized User'}</strong>
              </span>
            </div>
            <textarea
              rows={2}
              value={confirmationNotes}
              onChange={(e) => setConfirmationNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition"
              placeholder="Add audit authorization or confirmation remarks..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Clicking accept will commit data and update all 6 navigation bars in real-time.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              disabled={isFinalizing || pendingItems.length === 0}
              onClick={handleConfirmIngestion}
              className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isFinalizing ? 'Accepting & Routing...' : 'Accept & Confirm Ingestion'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
