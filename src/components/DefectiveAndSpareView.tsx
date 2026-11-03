import React, { useState } from 'react';
import {
  Wrench,
  AlertTriangle,
  Search,
  Calendar,
  Mail,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Printer,
  RefreshCw,
  Upload,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MedicalDeviceItem } from '../types';
import { InventoryCacheMeta } from '../utils/indexedDbCache';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { EquipmentReliabilityTrends } from './EquipmentReliabilityTrends';
import { SyncHealthIndicator } from './SyncHealthIndicator';
import { Language } from '../utils/localization';

interface DefectiveAndSpareViewProps {
  items: MedicalDeviceItem[];
  onSelectItem: (item: MedicalDeviceItem) => void;
  onScheduleCalendar: (item: MedicalDeviceItem) => void;
  onSendAlert: (item: MedicalDeviceItem) => void;
  language?: Language;
  isSyncing?: boolean;
  cachedMeta?: InventoryCacheMeta | null;
  onRefresh?: () => void;
  onPrintReport?: () => void;
  onOpenUploadModal?: () => void;
  onFilterStatus?: (status: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DefectiveAndSpareView: React.FC<DefectiveAndSpareViewProps> = ({
  items,
  onSelectItem,
  onScheduleCalendar,
  onSendAlert,
  language = 'en',
  isSyncing = false,
  cachedMeta,
  onRefresh,
  onPrintReport,
  onOpenUploadModal,
  onFilterStatus,
  onNavigateTab
}) => {
  const [activeTab, setActiveTab] = useState<'spare' | 'defective'>('spare');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const dynamicTitle = 'EPSS@2026';
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const spareItems = items.filter((i) => i.needsSparePart);
  const defectiveItems = items.filter((i) => i.isNotFunctional);

  const displayList = activeTab === 'spare' ? spareItems : defectiveItems;

  const filteredList = displayList.filter(
    (i) =>
      (i.materialDescription || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.material || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.plant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.nextAction || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSpareQty = spareItems.reduce((acc, curr) => acc + curr.qty, 0);
  const totalDefectiveQty = defectiveItems.reduce((acc, curr) => acc + curr.qty, 0);

  const handleExport = () => {
    const rows = filteredList.map((i) => ({
      ID: i.id,
      Status: activeTab === 'spare' ? 'Needs Spare Part' : 'Defective / Not Functional',
      Plant: i.plant,
      Warehouse: i.wh,
      'Material Code': i.material,
      'Material Description': i.materialDescription,
      Quantity: i.qty,
      'Total Amount (ETB)': i.totalAmount,
      Manufacturer: i.manufacturer,
      'Next Action': i.nextAction,
      'Intervention Pathway': i.wayOfIntervention,
      'Responsible Body': i.responsibleBody,
      Timeframe: i.timeFrame
    }));
    downloadCSV(
      `EPSS_${activeTab === 'spare' ? 'Needs_Spare_Parts' : 'Defective_Items'}_${Date.now()}.csv`,
      rows
    );
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.setTextColor(8, 145, 178); // cyan-600
    doc.text('EPSS@2026', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      activeTab === 'spare' ? 'Needs Spare Parts Inventory Report' : 'Defective Equipment Inventory Report',
      14,
      28
    );

    doc.setFontSize(9);
    doc.text(`Generated on: ${timestamp}`, 14, 34);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 14, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Category Units: ${formatNumber(activeTab === 'spare' ? totalSpareQty : totalDefectiveQty)}`, 14, 48);
    doc.text(`Filtered Line Items: ${filteredList.length}`, 14, 54);

    const tableData = filteredList.slice(0, 100).map((item) => [
      item.materialDescription || 'N/A',
      item.material || 'N/A',
      item.plant || 'N/A',
      String(item.qty),
      item.nextAction || item.responsibleBody || 'Pending Action'
    ]);

    autoTable(doc, {
      startY: 62,
      head: [['Description', 'Code', 'Plant', 'Qty', 'Next Action']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [8, 145, 178], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 70 }
      }
    });

    doc.save(`EPSS_${activeTab === 'spare' ? 'Spare_Parts' : 'Defective_Items'}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feature Navigation Actions (Moved physically from Dashboard) */}
      <div id="feature-navigation-action-bar" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{dynamicTitle}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-0.5">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isSyncing ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isSyncing ? 'Linking & Syncing...' : 'Live Link Active'}
            </div>
            {cachedMeta?.dateFormatted && (
              <span className="text-[11px] text-slate-400">
                Last Auto-Update: <span className="text-slate-500 font-medium">{cachedMeta.dateFormatted}</span>
              </span>
            )}
            <span className="text-slate-300 hidden sm:inline">|</span>
            <SyncHealthIndicator isSyncing={isSyncing} onRefresh={onRefresh} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenUploadModal && (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition border border-emerald-700 bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer group shadow-xs"
              title="MOH Portal: Upload dataset sheets & official authorization letters interlocked"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-100 group-hover:scale-115 transition" />
              <span>Ingest Spreadsheet Datasets</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-900 text-emerald-100 font-mono">
                Data + Letter
              </span>
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border shadow-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200 cursor-pointer"
            title="Export current filtered data to a professional PDF report"
          >
            <FileDown className="w-3.5 h-3.5 text-teal-600" />
            <span>Export PDF</span>
          </button>
          {onPrintReport && (
            <button
              onClick={onPrintReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border shadow-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200 cursor-pointer"
              title={`Print real-time summary (${isMac ? '⌘P' : 'Ctrl+P'})`}
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Report</span>
              <kbd className="hidden md:inline-block text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 pointer-events-none select-none ml-0.5">
                {isMac ? '⌘P' : 'Ctrl+P'}
              </kbd>
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border shadow-xs ${isSyncing ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border-cyan-200 cursor-pointer'}`}
              title={`Manually re-pull all data from Google Sheets (${isMac ? '⌘S' : 'Ctrl+S'})`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-slate-400' : 'text-cyan-600'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              <kbd className={`hidden md:inline-block text-[9px] font-mono px-1 py-0.5 rounded border pointer-events-none select-none ml-0.5 ${isSyncing ? 'text-slate-300 bg-slate-50 border-slate-100' : 'text-cyan-500 bg-cyan-50/50 border-cyan-100'}`}>
                {isMac ? '⌘S' : 'Ctrl+S'}
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Quick Triage Shortcut Chips (Moved physically under Feature navigation) */}
      <div id="feature-quick-triage-queues" className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Triage Queues:</span>
        </div>
        {[
          {
            id: 'defective',
            label: `Defective / Faulty (${formatNumber(totalDefectiveQty)})`,
            icon: ShieldAlert,
            color: 'purple',
            isCurrent: activeTab === 'defective',
            action: () => {
              setActiveTab('defective');
              setSearchTerm('');
            }
          },
          {
            id: 'spare',
            label: `Needs Spare Parts (${formatNumber(totalSpareQty)})`,
            icon: Wrench,
            color: 'purple',
            isCurrent: activeTab === 'spare',
            action: () => {
              setActiveTab('spare');
              setSearchTerm('');
            }
          },
          {
            id: 'lowStock',
            label: 'Urgent/Low Stock',
            icon: AlertTriangle,
            color: 'rose',
            action: () => {
              if (onFilterStatus && onNavigateTab) {
                onFilterStatus('lowStock');
                onNavigateTab('inventory');
              }
            }
          },
          {
            id: 'requiresInstallation',
            label: 'Requires Installation',
            icon: Wrench,
            color: 'amber',
            action: () => {
              if (onFilterStatus && onNavigateTab) {
                onFilterStatus('requiresInstallation');
                onNavigateTab('inventory');
              }
            }
          },
          {
            id: 'nonmoving',
            label: 'Non-Moving Stock',
            icon: Clock,
            color: 'slate',
            action: () => {
              if (onFilterStatus && onNavigateTab) {
                onFilterStatus('nonmoving');
                onNavigateTab('inventory');
              }
            }
          }
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={chip.action}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all border shadow-2xs hover:shadow-sm cursor-pointer group ${
              chip.isCurrent
                ? 'bg-purple-100 text-purple-900 border-purple-400 ring-2 ring-purple-300'
                : chip.color === 'rose'
                ? 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300'
                : chip.color === 'amber'
                ? 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                : chip.color === 'purple'
                ? 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <chip.icon
              className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                chip.isCurrent
                  ? 'text-purple-700'
                  : chip.color === 'rose'
                  ? 'text-rose-500'
                  : chip.color === 'amber'
                  ? 'text-amber-500'
                  : chip.color === 'purple'
                  ? 'text-purple-500'
                  : 'text-slate-400'
              }`}
            />
            <span>{chip.label}</span>
            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        ))}
      </div>

      {/* Interactive Clinical Status Legend (Moved physically under Feature navigation) */}
      <div id="clinical-status-legend" className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden print:hidden transition-all">
        <button
          id="feature-status-legend-toggle"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className={`w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors duration-150 group ${
            isLegendOpen ? 'bg-slate-50/90 border-b border-slate-100' : 'bg-white hover:bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200/80 flex items-center justify-center shrink-0 shadow-2xs text-cyan-700 group-hover:scale-105 transition-transform">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  Interactive Status Legend (Clinical Standards)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100/80 text-cyan-800 border border-cyan-200">
                  Reference Taxonomy
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Standardized definitions for operational health, installation staging, and freight dispatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs group-hover:border-slate-300 group-hover:text-slate-900 transition-all">
            <span>{isLegendOpen ? 'Hide Legend' : 'Show Legend'}</span>
            {isLegendOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </div>
        </button>

        {isLegendOpen && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/40 grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Operational Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Operational Status
              </h4>
              <div className="grid grid-cols-1 gap-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] w-[95px] justify-center shrink-0 border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Functional
                  </span>
                  <span>Device is fully active, tested, and running in healthcare facility.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('defective');
                      setSearchTerm('');
                    }}
                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] w-[95px] justify-center shrink-0 border border-rose-200 hover:bg-rose-200 cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" /> Defective
                  </button>
                  <span>Requires immediate technical repair or decommissioning.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('spare');
                      setSearchTerm('');
                    }}
                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] w-[95px] justify-center shrink-0 border border-purple-200 hover:bg-purple-200 cursor-pointer transition-colors"
                  >
                    <Wrench className="w-2.5 h-2.5" /> Needs Spare
                  </button>
                  <span>Awaiting parts/materials from bio-medical engineering team.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onFilterStatus && onNavigateTab) {
                        onFilterStatus('nonmoving');
                        onNavigateTab('inventory');
                      }
                    }}
                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] w-[95px] justify-center shrink-0 border border-amber-200 hover:bg-amber-200 cursor-pointer transition-colors"
                  >
                    <Clock className="w-2.5 h-2.5" /> Non-Moving
                  </button>
                  <span>Static stock stored without deployment for an extended period.</span>
                </div>
              </div>
            </div>

            {/* Installation Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Installation Status
              </h4>
              <div className="grid grid-cols-1 gap-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] w-[110px] justify-center shrink-0 border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Installed
                  </span>
                  <span>Successfully set up and configured at the assigned ward.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[9px] w-[110px] justify-center shrink-0 border border-amber-200">
                    <Clock className="w-2.5 h-2.5" /> Pending Inst.
                  </span>
                  <span>Awaiting field engineer deployment to clinical location.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[9px] w-[110px] justify-center shrink-0 border border-blue-200">
                    <Wrench className="w-2.5 h-2.5" /> Commissioning
                  </span>
                  <span>Actively undergoing calibration, test loops, and safe start-up.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-red-100 text-red-800 text-[9px] w-[110px] justify-center shrink-0 border border-red-200">
                    <AlertTriangle className="w-2.5 h-2.5" /> Not Installed
                  </span>
                  <span>Still crated or stored without any physical assembly.</span>
                </div>
              </div>
            </div>

            {/* Delivery Statuses */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Delivery Status
              </h4>
              <div className="grid grid-cols-1 gap-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] w-[115px] justify-center shrink-0 border border-emerald-200">
                    Delivered
                  </span>
                  <span>Arrived safely and signed off at regional warehouse or facility.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[9px] w-[115px] justify-center shrink-0 border border-blue-200">
                    In Transit
                  </span>
                  <span>On freight trucks dispatched between central and regional hubs.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[9px] w-[115px] justify-center shrink-0 border border-amber-200">
                    Port Clearance
                  </span>
                  <span>Awaiting customs control, import taxes, or regulatory releases.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[9px] w-[115px] justify-center shrink-0 border border-purple-200">
                    Pending Dispatch
                  </span>
                  <span>Held in central medical stockpile waiting for dispatch orders.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overview Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Biomedical Maintenance & Spare Parts Triage Board
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Targeted queues for items requiring spare part replenishment ({formatNumber(totalSpareQty)} units)
            and defective equipment needing repair or decommissioning ({formatNumber(totalDefectiveQty)} units).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export List</span>
          </button>
        </div>
      </div>

      {/* Equipment Reliability Trends Recharts Component */}
      <EquipmentReliabilityTrends items={items} />

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setActiveTab('spare');
            setSearchTerm('');
          }}
          className={`flex-1 p-4 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
            activeTab === 'spare'
              ? 'bg-purple-50 border-purple-400 shadow-sm'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Needs Spare Parts Queue
              </div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {formatNumber(totalSpareQty)} Units <span className="text-xs font-normal text-purple-900 font-mono">({spareItems.length} Line Items)</span>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-purple-700 px-2.5 py-1 rounded-full bg-purple-100">
            High Priority
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('defective');
            setSearchTerm('');
          }}
          className={`flex-1 p-4 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
            activeTab === 'defective'
              ? 'bg-rose-50 border-rose-400 shadow-sm'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Defective & Non-Functional Queue
              </div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {formatNumber(totalDefectiveQty)} Units <span className="text-xs font-normal text-rose-900 font-mono">({defectiveItems.length} Line Items)</span>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-700 px-2.5 py-1 rounded-full bg-rose-100">
            Audit Flagged
          </span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter queue by device description, material code, hub, or action..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Triage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredList.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No items in this queue match the search term.
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-400 hover:shadow-sm transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {item.material}
                    </span>
                    <span className="ml-2 text-xs font-semibold text-slate-800">
                      Plant: {item.plant} ({item.wh})
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.needsSparePart
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.needsSparePart ? 'Needs Spare Part' : 'Defective'}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2">
                  {item.materialDescription}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manufacturer: <strong>{item.manufacturer}</strong> • Stock:{' '}
                  <strong>{formatNumber(item.qty)} Units</strong> • Valuation:{' '}
                  <strong>{formatCurrency(item.totalAmount, true)}</strong>
                </p>

                {/* Audit Action / Intervention */}
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                  <div className="text-slate-700">
                    <span className="font-semibold text-slate-900">Recommended Action:</span>{' '}
                    {item.nextAction || 'Under Biomedical Evaluation'}
                  </div>
                  {item.wayOfIntervention && (
                    <div className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-800">Pathway:</span>{' '}
                      {item.wayOfIntervention}
                    </div>
                  )}
                  {item.responsibleBody && (
                    <div className="text-slate-500 text-[10px]">
                      <span className="font-semibold">Responsible:</span> {item.responsibleBody} (
                      {item.timeFrame || 'Urgent'})
                    </div>
                  )}
                </div>
              </div>

              {/* Workspace Action Buttons */}
              <div
                className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onScheduleCalendar(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar PPM</span>
                </button>

                <button
                  onClick={() => onSendAlert(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Requisition Notice</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
