import React, { useState } from 'react';
import {
  X,
  Package,
  CircleDollarSign,
  Building2,
  Calendar,
  Mail,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Compass,
  Navigation,
  Layers,
  FileText,
  Download,
  Eye,
  BookOpen,
  Award
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface DeviceDetailModalProps {
  item: MedicalDeviceItem | null;
  onClose: () => void;
  onScheduleCalendar: (item: MedicalDeviceItem) => void;
  onSendAlert: (item: MedicalDeviceItem) => void;
  isAdmin?: boolean;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  item,
  onClose,
  onScheduleCalendar,
  onSendAlert,
  isAdmin
}) => {
  const [selectedWing, setSelectedWing] = useState<'icu' | 'emergency' | 'radiology' | 'theatre' | 'warehouse'>('icu');

  if (!item) return null;

  // Determine mock room / wing based on item properties or hash
  const hubName = item.plantName || item.plant || 'Central Depot';
  const warehouseBay = item.wh || 'WH-01';
  const installationStatus = item.installationStatus || 'Installed';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {item.material}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  item.isNotFunctional
                    ? 'bg-rose-100 text-rose-800'
                    : item.needsSparePart
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {item.isNotFunctional ? 'Defective' : item.needsSparePart ? 'Needs Spare Part' : 'Operational'}
              </span>
              {item.isNonMoving && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  Non-Moving
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-2">{item.materialDescription}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manufacturer: <strong>{item.manufacturer || 'Unspecified'}</strong> • Batch:{' '}
              <strong className="font-mono">{item.batch || 'N/A'}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-slate-700">
          {/* Top 3 Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-500" /> Quantity
              </span>
              <div className="text-lg font-bold text-slate-900 mt-1">{formatNumber(item.qty)} Units</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CircleDollarSign className="w-3.5 h-3.5 text-slate-500" /> Total Value
              </span>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {formatCurrency(item.totalAmount, true)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" /> Hub & WH
              </span>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {item.plant} <span className="text-xs font-normal text-slate-500">({warehouseBay})</span>
              </div>
            </div>
          </div>

          {/* Visual Map Component - Hospital Wing / Room Location Highlighting */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Interactive Facility & Installation Map</h4>
                  <p className="text-[11px] text-slate-400">
                    Showing real-time installation node for {item.plant} ({warehouseBay})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-semibold">{installationStatus}</span>
              </div>
            </div>

            {/* Floor Plan Visualizer Stage */}
            <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-hidden min-h-[220px] flex flex-col justify-between">
              {/* Grid Background overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none"></div>

              {/* Facility Header info */}
              <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2.5">
                <span className="font-mono text-cyan-400 font-bold uppercase">{hubName}</span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-500" /> Zone: {warehouseBay} • Floor 2, Wing A
                </span>
              </div>

              {/* Visual Rooms Layout */}
              <div className="relative z-10 grid grid-cols-3 gap-3 my-3">
                <div className={`p-3 rounded-lg border transition ${
                  selectedWing === 'icu' ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-lg' : 'bg-slate-900/80 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[10px] uppercase font-bold tracking-wider block text-cyan-400">ICU Ward B</span>
                  <span className="text-xs font-bold text-white mt-1 block">Room 302 - Bedside</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Active Monitoring</span>
                </div>

                <div className={`p-3 rounded-lg border transition ${
                  selectedWing === 'theatre' ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-lg' : 'bg-slate-900/80 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[10px] uppercase font-bold tracking-wider block text-indigo-400">Operation Suite</span>
                  <span className="text-xs font-bold text-white mt-1 block">Theatre 4</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Surgical Support</span>
                </div>

                <div className={`p-3 rounded-lg border transition ${
                  selectedWing === 'warehouse' ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-lg' : 'bg-slate-900/80 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[10px] uppercase font-bold tracking-wider block text-emerald-400">Main Depot</span>
                  <span className="text-xs font-bold text-white mt-1 block">Bay {warehouseBay}</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Central Storage</span>
                </div>
              </div>

              {/* Highlighted Marker Footer */}
              <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-extrabold text-[10px]">
                    📍
                  </div>
                  <div>
                    <span className="text-white font-bold block">Current Device Pinpoint Location</span>
                    <span className="text-slate-400 text-[10px]">GPS Coordinates: 9.0300° N, 38.7400° E • EPSS Hub Network</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-cyan-400 text-xs">Verified Node</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Inventory Specifications */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-200">
              Inventory & Logistics Attributes
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Plant Name</span>
                <span className="font-semibold text-slate-900">{item.plantName}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Unit Price (ETB)</span>
                <span className="font-semibold text-slate-900 font-mono">{formatCurrency(item.unitPrice)}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Stock Type</span>
                <span className="font-semibold text-slate-900">{item.stockType || 'Unrestricted'}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Expiry Date</span>
                <span className="font-semibold text-slate-900">{item.expiryDate || 'N/A (Permanent Asset)'}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">WBS Funding Element</span>
                <span className="font-mono text-slate-800 font-semibold">{item.wbsElement || 'Central Treasury'}</span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Material Type</span>
                <span className="font-semibold text-slate-900">{item.materialType || 'ZMED'}</span>
              </div>
            </div>
          </div>

          {item.contractIssue && (
            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/70 space-y-1 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-900">Contract / LC Issue</h4>
              </div>
              <p className="text-sm font-semibold text-orange-950">{item.contractIssue}</p>
            </div>
          )}

          {/* Procurement Pipeline */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-slate-400 block text-[11px] mb-1">Letter of Credit</span>
              <span className="font-semibold text-slate-900 text-xs">{item.lcStatus || 'N/A'}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-slate-400 block text-[11px] mb-1">Shipment Status</span>
              <span className="font-semibold text-slate-900 text-xs">{item.shipmentStatus || 'N/A'}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-slate-400 block text-[11px] mb-1">Customs Clearance</span>
              <span className="font-semibold text-slate-900 text-xs">{item.clearanceStatus || 'N/A'}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-slate-400 block text-[11px] mb-1">Assign Train (Inland)</span>
              <span className="font-semibold text-slate-900 text-xs">{item.assignTrainStatus || 'N/A'}</span>
            </div>
          </div>

          {/* EPSS Allocation & Breakdown Status */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-1">
            <div className="font-bold text-emerald-950 text-xs">
              EPSS Allocation & Breakdown Status
            </div>
            <div className="text-emerald-900 text-sm font-semibold">
              {item.fyaEpSSNoBkdStatus?.replace(/FYA /gi, '') || 'Approved for Distribution - Active Stock'}
            </div>
          </div>

          {/* Audit Recommendation & Biomedical Action */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <span>Post-Inventory Audit Findings & Directive</span>
            </div>
            <div className="text-indigo-900 text-xs leading-relaxed">
              <p>
                <strong>Recommended Next Action:</strong>{' '}
                {item.nextAction || 'Regular clinical distribution in progress.'}
              </p>
              {item.wayOfIntervention && (
                <p className="mt-1">
                  <strong>Intervention Pathway:</strong> {item.wayOfIntervention}
                </p>
              )}
              {item.responsibleBody && (
                <p className="mt-1">
                  <strong>Executing Body:</strong> {item.responsibleBody} (Target: {item.timeFrame || 'Within Audit Cycle'})
                </p>
              )}
            </div>
          </div>

          {/* Associated Documentation (Manuals & Warranty Cards) */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <BookOpen className="w-4 h-4 text-cyan-600 animate-pulse" />
              <span>Associated Documentation & Credentials</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Operator & Technical Manual */}
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group hover:border-cyan-300 hover:shadow-xs transition duration-200">
                {/* Visual Thumbnail Preview representation */}
                <div className="w-24 bg-gradient-to-br from-cyan-600 to-indigo-700 text-white p-3 flex flex-col justify-between shrink-0 relative overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px] opacity-10"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[7px] font-mono font-bold tracking-widest uppercase bg-cyan-950/40 px-1 py-0.2 rounded">PDF</span>
                    <BookOpen className="w-3 h-3 text-cyan-100" />
                  </div>
                  <div className="space-y-1 relative z-10">
                    <div className="h-0.5 w-1/2 bg-cyan-200 rounded"></div>
                    <div className="h-0.5 w-3/4 bg-cyan-200 rounded"></div>
                    <span className="text-[8px] font-bold tracking-tight block truncate text-cyan-100">TECHNICAL</span>
                    <span className="text-[7px] font-mono text-cyan-300 block leading-none">V2.4</span>
                  </div>
                </div>
                
                {/* Details & Action Links */}
                <div className="p-3.5 flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <h5 className="font-bold text-slate-800 truncate text-[11px]" title={`${item.materialDescription} Operator Manual`}>
                      {item.materialDescription} Manual
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Technical Guideline • {formatNumber(item.qty > 0 ? 124 : 85)} pages
                    </p>
                    <span className="text-[9px] font-mono bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100 inline-block mt-2">
                      Ref: MNL-{item.material || 'GEN-01'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <a
                      href={`https://example.com/manuals/MNL-${item.material || 'GEN-01'}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 hover:text-cyan-700 hover:underline"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Quick View</span>
                    </a>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => alert(`Secure Document Preview for MNL-${item.material || 'GEN-01'}.pdf`)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Warranty Card & Service Level Contract */}
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group hover:border-emerald-300 hover:shadow-xs transition duration-200">
                {/* Visual Warranty Thumbnail representation */}
                <div className="w-24 bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3 flex flex-col justify-between shrink-0 relative overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px] opacity-10"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[7px] font-mono font-bold tracking-widest uppercase bg-emerald-950/40 px-1 py-0.2 rounded">CERT</span>
                    <Award className="w-3.5 h-3.5 text-emerald-100" />
                  </div>
                  <div className="space-y-1 relative z-10">
                    <div className="h-0.5 w-2/3 bg-emerald-200 rounded"></div>
                    <div className="h-0.5 w-5/6 bg-emerald-200 rounded"></div>
                    <span className="text-[8px] font-bold tracking-tight block text-emerald-100">WARRANTY</span>
                    <span className="text-[7px] font-mono text-emerald-300 block leading-none">3-YEAR COV</span>
                  </div>
                </div>

                {/* Details & Action Links */}
                <div className="p-3.5 flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <h5 className="font-bold text-slate-800 truncate text-[11px]">
                      OEM Warranty Card & SLA
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Active Coverage • SLA level Gold
                    </p>
                    <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-2">
                      Expires: Sept 2028
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <a
                      href={`https://example.com/warranty/WRY-${item.material || 'GEN-01'}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Verify SLA</span>
                    </a>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => alert(`Secure SLA Guarantee Document Preview for WRY-${item.material || 'GEN-01'}.pdf`)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    onScheduleCalendar(item);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule PPM in Calendar</span>
                </button>

                <button
                  onClick={() => {
                    onSendAlert(item);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Gmail Notice</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
