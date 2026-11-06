import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageCheck,
  Search,
  Filter,
  Download,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  Warehouse,
  ArrowDownLeft,
  Barcode,
  Layers,
  ShieldCheck,
  Upload,
  X,
  FileText,
  Sparkles,
  RefreshCw,
  Eye,
  Tag,
  DollarSign,
  User,
  Hash,
  SlidersHorizontal,
  Trash2,
  ChevronDown,
  ArrowUpDown,
  Bell,
  BellRing,
  ShieldAlert,
  Volume2,
  VolumeX,
  Sliders,
  Copy,
  Check,
  ExternalLink,
  Send,
  Info,
  ArrowRight
} from 'lucide-react';
import { MedicalDeviceItem, ReceivingDataRecord } from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { ReceivingDataUploadModal } from './ReceivingDataUploadModal';
import { StockHoldingAlertModal } from './StockHoldingAlertModal';
import {
  RECEIVING_DATA_COLUMNS,
  calculateStockHoldingDays,
  downloadReceivingDataTemplateCSV,
  downloadReceivingDataTemplateExcel,
  isMovementType641
} from '../data/defaultReceivingData';
import { ReceivingDataAnalyticsSection } from './ReceivingDataAnalyticsSection';

interface ReceivingDataViewProps {
  items?: MedicalDeviceItem[];
  receivingRecords?: ReceivingDataRecord[];
  onUploadReceivingData?: (records: ReceivingDataRecord[], mode: 'replace' | 'append') => void;
  onClearReceivingData?: () => void;
  onSelectItem?: (item: any) => void;
  onOpenMultiUploadModal?: () => void;
  onNavigateToDistribution?: () => void;
  isAdmin?: boolean;
}

export const ReceivingDataView: React.FC<ReceivingDataViewProps> = ({
  items = [],
  receivingRecords = [],
  onUploadReceivingData,
  onClearReceivingData,
  onSelectItem,
  onOpenMultiUploadModal,
  onNavigateToDistribution,
  isAdmin = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all');
  const [selectedMvtType, setSelectedMvtType] = useState('all');
  const [selectedStorageLoc, setSelectedStorageLoc] = useState('all');
  const [selectedHoldingFilter, setSelectedHoldingFilter] = useState<'all' | 'alertExceeded' | 'fresh' | 'active' | 'watch' | 'aging'>('all');
  const [sortField, setSortField] = useState<'default' | 'holdingDays' | 'postingDate' | 'quantity' | 'amt'>('default');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [inspectingRecord, setInspectingRecord] = useState<ReceivingDataRecord | null>(null);

  // Automated Stock Holding Alert System State (default 90 days threshold)
  const [alertThresholdDays, setAlertThresholdDays] = useState<number>(90);
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [soundAlertEnabled, setSoundAlertEnabled] = useState(false);
  const [isDesktopNotifyEnabled, setIsDesktopNotifyEnabled] = useState<boolean>(false);
  const [copiedMemoSuccess, setCopiedMemoSuccess] = useState(false);
  const [desktopNotifyStatus, setDesktopNotifyStatus] = useState<string | null>(null);

  // Active records: Exclude Movement Type 641 (MD Transfer to Plant) - hidden from Receiving Data & routed to Distribution Data
  const activeRecords: ReceivingDataRecord[] = useMemo(() => {
    const list = receivingRecords || [];
    return list.filter(r => !isMovementType641(r.movementType));
  }, [receivingRecords]);

  // Track hidden 641 MD Transfer to Plant records routed to Distribution Data
  const mdTransfer641Records = useMemo(() => {
    const list = receivingRecords || [];
    return list.filter(r => isMovementType641(r.movementType));
  }, [receivingRecords]);

  // Unique filter option sets
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => { if (r.plant) set.add(r.plant); });
    return Array.from(set).sort();
  }, [activeRecords]);

  const uniqueMovementTypes = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => { if (r.movementType) set.add(r.movementType); });
    return Array.from(set).sort();
  }, [activeRecords]);

  const uniqueStorageLocs = useMemo(() => {
    const set = new Set<string>();
    activeRecords.forEach(r => { if (r.storageLocation) set.add(r.storageLocation); });
    return Array.from(set).sort();
  }, [activeRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return activeRecords.filter((rec) => {
      const matchSearch =
        !query ||
        rec.materialDescription?.toLowerCase().includes(query) ||
        rec.material?.toLowerCase().includes(query) ||
        rec.purchaseOrder?.toLowerCase().includes(query) ||
        rec.reference?.toLowerCase().includes(query) ||
        rec.batch?.toLowerCase().includes(query) ||
        rec.wbsElement?.toLowerCase().includes(query) ||
        rec.storageLocation?.toLowerCase().includes(query) ||
        rec.movementType?.toLowerCase().includes(query);

      const matchPlant = selectedPlant === 'all' || rec.plant === selectedPlant;
      const matchMvt = selectedMvtType === 'all' || rec.movementType === selectedMvtType;
      const matchSLoc = selectedStorageLoc === 'all' || rec.storageLocation === selectedStorageLoc;

      // Stock holding days filter
      let matchHolding = true;
      if (selectedHoldingFilter !== 'all') {
        const days = calculateStockHoldingDays(rec.postingDate || rec.entryDate, rec);
        if (days === null) {
          matchHolding = false;
        } else if (selectedHoldingFilter === 'alertExceeded') {
          matchHolding = days > alertThresholdDays;
        } else if (selectedHoldingFilter === 'fresh') {
          matchHolding = days <= 30;
        } else if (selectedHoldingFilter === 'active') {
          matchHolding = days > 30 && days <= 90;
        } else if (selectedHoldingFilter === 'watch') {
          matchHolding = days > 90 && days <= 180;
        } else if (selectedHoldingFilter === 'aging') {
          matchHolding = days > 180;
        }
      }

      return matchSearch && matchPlant && matchMvt && matchSLoc && matchHolding;
    });
  }, [activeRecords, searchQuery, selectedPlant, selectedMvtType, selectedStorageLoc, selectedHoldingFilter, alertThresholdDays]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    if (sortField === 'default') return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      if (sortField === 'holdingDays') {
        const daysA = calculateStockHoldingDays(a.postingDate || a.entryDate, a) ?? -1;
        const daysB = calculateStockHoldingDays(b.postingDate || b.entryDate, b) ?? -1;
        return sortAsc ? daysA - daysB : daysB - daysA;
      }
      if (sortField === 'postingDate') {
        const dateA = a.postingDate || a.entryDate || '';
        const dateB = b.postingDate || b.entryDate || '';
        return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      if (sortField === 'quantity') {
        return sortAsc ? (a.quantity || 0) - (b.quantity || 0) : (b.quantity || 0) - (a.quantity || 0);
      }
      if (sortField === 'amt') {
        return sortAsc ? (a.amtInLocCur || 0) - (b.amtInLocCur || 0) : (b.amtInLocCur || 0) - (a.amtInLocCur || 0);
      }
      return 0;
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Aggregated KPI metrics
  const totalReceivedUnits = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [filteredRecords]);

  const totalReceivedValuation = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.amtInLocCur || 0), 0);
  }, [filteredRecords]);

  const distinctPosCount = useMemo(() => {
    return new Set(filteredRecords.map(r => r.purchaseOrder)).size;
  }, [filteredRecords]);

  const distinctMaterialsCount = useMemo(() => {
    return new Set(filteredRecords.map(r => r.material)).size;
  }, [filteredRecords]);

  // Stock holding days statistics
  const { avgHoldingDays, agingBatchesCount } = useMemo(() => {
    let sumDays = 0;
    let countWithDate = 0;
    let agingCount = 0;
    filteredRecords.forEach((r) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r);
      if (days !== null) {
        sumDays += days;
        countWithDate += 1;
        if (days > 180) agingCount += 1;
      }
    });

    return {
      avgHoldingDays: countWithDate > 0 ? Math.round(sumDays / countWithDate) : 0,
      agingBatchesCount: agingCount
    };
  }, [filteredRecords]);

  const handleToggleSort = (field: 'default' | 'holdingDays' | 'postingDate' | 'quantity' | 'amt') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  };

  // Export 13-column + Stock Holding Days CSV
  const handleExportCSV = () => {
    const data = sortedRecords.map((r) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r);
      return {
        'Purchase order': r.purchaseOrder,
        'Reference': r.reference || '-',
        'Material': r.material,
        'Material Description': r.materialDescription,
        'Batch': r.batch || '-',
        'Quantity': r.quantity,
        'Storage Location': r.storageLocation,
        'Amt.in Loc.Cur.': r.amtInLocCur,
        'Movement Type': r.movementType,
        'Special Stock': r.specialStock || '-',
        'WBS Element': r.wbsElement || '-',
        'Plant': r.plant,
        'Posting Date': r.postingDate || '-',
        'Posting Year': r.postingYear || '-',
        'Posting Month': r.postingMonth || '-',
        'Posting Day': r.postingDay || '-',
        'Stock Holding Days': days !== null ? `${days} Days` : '-'
      };
    });

    downloadCSV(
      `EPSS_Receiving_Data_Ledger_HoldingDays_${new Date().toISOString().split('T')[0]}.csv`,
      data
    );
  };

  // Automated Alert System Computations
  const handleUpdateThreshold = (days: number) => {
    setAlertThresholdDays(days);
    setIsAlertBannerDismissed(false);
  };

  const alertRecords = useMemo(() => {
    return activeRecords.filter((r) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r);
      return days !== null && days > alertThresholdDays;
    });
  }, [activeRecords, alertThresholdDays]);

  const alertCount = alertRecords.length;
  const alertTotalValuation = useMemo(() => {
    return alertRecords.reduce((sum, r) => sum + (r.amtInLocCur || 0), 0);
  }, [alertRecords]);
  const alertTotalUnits = useMemo(() => {
    return alertRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [alertRecords]);

  // Audio chime synthesizer via Web Audio API
  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (alertCount > 0 && soundAlertEnabled) {
      playAlertChime();
    }
  }, [alertCount, soundAlertEnabled, alertThresholdDays]);

  // Export dedicated Aging Alert report
  const handleExportAlertsCSV = () => {
    const data = alertRecords.map((r) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r);
      return {
        'Purchase order': r.purchaseOrder,
        'Reference': r.reference || '-',
        'Material': r.material,
        'Material Description': r.materialDescription,
        'Batch': r.batch || '-',
        'Quantity': r.quantity,
        'Storage Location': r.storageLocation,
        'Amt.in Loc.Cur.': r.amtInLocCur,
        'Movement Type': r.movementType,
        'Special Stock': r.specialStock || '-',
        'WBS Element': r.wbsElement || '-',
        'Plant': r.plant,
        'Posting Date': r.postingDate || '-',
        'Posting Year': r.postingYear || '-',
        'Posting Month': r.postingMonth || '-',
        'Posting Day': r.postingDay || '-',
        'Stock Holding Days': days !== null ? `${days} Days` : '-',
        'Alert Threshold (Days)': alertThresholdDays,
        'Days Over Threshold': days !== null ? `${days - alertThresholdDays} Days` : '-',
        'Alert Severity': days !== null && days > alertThresholdDays + 90 ? 'CRITICAL_HIGH' : 'ELEVATED_AGING'
      };
    });

    downloadCSV(
      `EPSS_Stock_Holding_Alerts_Over_${alertThresholdDays}Days_${new Date().toISOString().split('T')[0]}.csv`,
      data
    );
  };

  // Desktop OS notification trigger & permissions
  const handleToggleDesktopNotification = async () => {
    if (!('Notification' in window)) {
      setDesktopNotifyStatus('Desktop notifications are not supported in this browser.');
      setTimeout(() => setDesktopNotifyStatus(null), 3500);
      return;
    }

    try {
      if (Notification.permission === 'granted') {
        const nextState = !isDesktopNotifyEnabled;
        setIsDesktopNotifyEnabled(nextState);
        if (nextState) {
          new Notification('🚨 EPSS Stock Holding Alerts Active', {
            body: `${alertCount} consignments currently exceed ${alertThresholdDays}-day limit.`,
            icon: '/favicon.ico'
          });
          setDesktopNotifyStatus('✓ Desktop alert notifications enabled');
        } else {
          setDesktopNotifyStatus('Desktop alert notifications muted');
        }
      } else {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setIsDesktopNotifyEnabled(true);
          new Notification('✓ EPSS Stock Holding Alerts Enabled', {
            body: `You will receive automated desktop notifications when receiving consignments exceed ${alertThresholdDays} days in stock.`,
            icon: '/favicon.ico'
          });
          setDesktopNotifyStatus('✓ Desktop alert notifications enabled');
        } else {
          setDesktopNotifyStatus('Browser notification permission was not granted.');
        }
      }
    } catch {
      setDesktopNotifyStatus('Could not enable desktop notifications.');
    }
    setTimeout(() => setDesktopNotifyStatus(null), 3500);
  };

  // Automated notification trigger on record changes / threshold updates
  useEffect(() => {
    if (
      isDesktopNotifyEnabled &&
      alertCount > 0 &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('🚨 EPSS Inbound Inventory Alert', {
          body: `${alertCount} consignments have exceeded the ${alertThresholdDays}-day stock holding threshold! Total valuation at risk: ${formatCurrency(alertTotalValuation)}.`,
          icon: '/favicon.ico'
        });
      } catch {
        // ignore
      }
    }
  }, [alertCount, alertThresholdDays, isDesktopNotifyEnabled, alertTotalValuation]);

  // Formatted escalation notification memo generator
  const handleCopyEscalationNotice = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const top5Items = alertRecords.slice(0, 5).map((r, i) => {
      const days = calculateStockHoldingDays(r.postingDate || r.entryDate, r) || 0;
      return `  ${i + 1}. PO: ${r.purchaseOrder} | Material: ${r.material} (${r.materialDescription}) | Plant: ${r.plant} - ${r.storageLocation} | Held: ${days} days (+${days - alertThresholdDays}d over) | Value: ETB ${r.amtInLocCur?.toLocaleString() || 0}`;
    }).join('\n');

    const noticeText = [
      `=============================================================`,
      `EPSS INVENTORY STOCK HOLDING ALERT & ESCALATION NOTICE`,
      `Generated: ${todayStr} | SLA Limit: ${alertThresholdDays} Calendar Days`,
      `=============================================================`,
      `TOTAL CONSIGNMENTS EXCEEDING THRESHOLD: ${alertRecords.length} batches`,
      `TOTAL VALUATION AT RISK: ETB ${alertTotalValuation.toLocaleString()}`,
      `TOTAL UNITS: ${alertTotalUnits.toLocaleString()} physical items`,
      ``,
      `SAMPLE AGING BATCHES:`,
      top5Items,
      alertRecords.length > 5 ? `  ... and ${alertRecords.length - 5} more consignments exceeding ${alertThresholdDays} days.` : '',
      ``,
      `ACTION REQUIRED:`,
      `1. Warehouse managers to prioritize FIFO/FEFO dispatch.`,
      `2. Quality Assurance inspection for lots held > ${alertThresholdDays} days.`,
      `3. Expedite distribution to regional health hubs.`,
      `=============================================================`
    ].filter(Boolean).join('\n');

    try {
      navigator.clipboard.writeText(noticeText);
      setCopiedMemoSuccess(true);
      setTimeout(() => setCopiedMemoSuccess(false), 3000);
    } catch {
      alert('Escalation notice copied to clipboard!');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-linear-to-br from-teal-500 to-teal-700 text-white rounded-xl shadow-xs shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Receiving Data (Inbound Goods Receipt & GRN Ledger)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 font-mono uppercase">
                {activeRecords.length.toLocaleString()} Consignments Recorded
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Auto Stock Holding Days Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Warehouse receiving registry with auto-calculated Stock Holding Days (Posting Date - Today in Days) for real-time inventory aging intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {alertCount > 0 && (
            <button
              type="button"
              onClick={() => setIsAlertModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
              title={`View ${alertCount} items exceeding ${alertThresholdDays}-day threshold`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{alertCount} Holding Alerts (&gt;{alertThresholdDays}d)</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Receiving Data (.xlsx / .csv)</span>
            </button>
          )}

          <button
            type="button"
            onClick={downloadReceivingDataTemplateExcel}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Download formatted Excel template with Stock Holding Days"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Template</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Export current filtered view with Stock Holding Days"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export CSV</span>
          </button>

          {onClearReceivingData && activeRecords.length > 0 && (
            <button
              type="button"
              onClick={onClearReceivingData}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Clear all receiving records"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Automated Stock Holding Alert Banner */}
      {alertCount > 0 && !isAlertBannerDismissed && (
        <div className="bg-linear-to-r from-rose-50 via-rose-100/60 to-amber-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase font-mono tracking-wider shadow-2xs">
                  AUTOMATED STOCK HOLDING ALERT TRIGGERED
                </span>
                <span className="text-xs font-mono font-bold text-rose-950">
                  Threshold: &gt; {alertThresholdDays} Days
                </span>
                {soundAlertEnabled && (
                  <span className="text-[10px] text-rose-700 font-bold flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full border border-rose-200">
                    <Volume2 className="w-3 h-3 text-rose-600" />
                    <span>Sound Alert Active</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-900 font-medium mt-1">
                <strong>{alertCount} consignment {alertCount === 1 ? 'batch' : 'batches'}</strong> have remained in stock exceeding the <strong>{alertThresholdDays}-day limit</strong>! Total valuation at risk: <strong className="font-mono text-rose-950 font-black">{formatCurrency(alertTotalValuation)}</strong> ({formatNumber(alertTotalUnits)} units).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedHoldingFilter(selectedHoldingFilter === 'alertExceeded' ? 'all' : 'alertExceeded')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                selectedHoldingFilter === 'alertExceeded'
                  ? 'bg-rose-800 text-white ring-2 ring-rose-400'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{selectedHoldingFilter === 'alertExceeded' ? 'Showing Alert Items' : `Filter ${alertCount} Alert Items`}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAlertModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-rose-600" />
              <span>Alert Center</span>
            </button>

            <button
              type="button"
              onClick={handleCopyEscalationNotice}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copy structured stock aging escalation memo"
            >
              {copiedMemoSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-rose-600" />}
              <span>{copiedMemoSuccess ? 'Memo Copied!' : 'Copy Notice'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDesktopNotification}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                isDesktopNotifyEnabled
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-white hover:bg-rose-50 text-slate-700 border-slate-300'
              }`}
              title={isDesktopNotifyEnabled ? 'Disable browser desktop notifications' : 'Enable browser desktop notifications'}
            >
              <Bell className={`w-3.5 h-3.5 ${isDesktopNotifyEnabled ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>{isDesktopNotifyEnabled ? 'Desktop On' : 'Desktop Alert'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportAlertsCSV}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download CSV report of alert items"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Alert CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundAlertEnabled(!soundAlertEnabled)}
              className={`p-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                soundAlertEnabled
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
              title={soundAlertEnabled ? 'Disable audio alert chime' : 'Enable audio alert chime'}
            >
              {soundAlertEnabled ? <Volume2 className="w-4 h-4 text-rose-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            <button
              type="button"
              onClick={() => setIsAlertBannerDismissed(true)}
              className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-xl transition cursor-pointer"
              title="Dismiss alert banner for this session"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {desktopNotifyStatus && (
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono flex items-center justify-between shadow-xs">
          <span>{desktopNotifyStatus}</span>
          <button onClick={() => setDesktopNotifyStatus(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards including Stock Holding Days */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Inbound Units
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
              {formatNumber(totalReceivedUnits)}
            </div>
            <div className="text-[10px] text-teal-600 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{filteredRecords.length} Consignment Batches</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-600">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Amt. in Loc. Cur. (ETB)
            </div>
            <div className="text-xl font-black text-emerald-600 mt-0.5 font-mono">
              {formatCurrency(totalReceivedValuation)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Valuation of Received Shipments
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Purchase Orders & SKUs
            </div>
            <div className="text-xl font-black text-purple-700 mt-0.5 font-mono">
              {distinctPosCount} POs • {distinctMaterialsCount} Items
            </div>
            <div className="text-[10px] text-purple-600 font-medium mt-0.5">
              Distinct Purchasing Orders
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
            <Barcode className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Receiving Plants & SLocs
            </div>
            <div className="text-xl font-black text-cyan-700 mt-0.5 font-mono">
              {uniquePlants.length} Plants • {uniqueStorageLocs.length} SLocs
            </div>
            <div className="text-[10px] text-cyan-600 font-medium mt-0.5">
              Multi-Warehouse Intake Points
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>

        {/* Stock Holding Alert Metric Card */}
        <div
          onClick={() => {
            if (alertCount > 0) {
              setSelectedHoldingFilter(selectedHoldingFilter === 'alertExceeded' ? 'all' : 'alertExceeded');
            } else {
              setIsAlertModalOpen(true);
            }
          }}
          className={`p-3.5 rounded-xl shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1 cursor-pointer transition border ${
            alertCount > 0
              ? 'bg-rose-50/70 border-rose-300 hover:bg-rose-100/80 ring-1 ring-rose-300'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
          title={alertCount > 0 ? `Click to filter ${alertCount} items exceeding ${alertThresholdDays}-day threshold` : 'Holding days overview'}
        >
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              alertCount > 0 ? 'text-rose-700 font-black' : 'text-slate-500'
            }`}>
              <AlertTriangle className={`w-3.5 h-3.5 ${alertCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
              <span>Alerts (&gt;{alertThresholdDays}d)</span>
            </div>
            <div className={`text-xl font-black mt-0.5 font-mono ${
              alertCount > 0 ? 'text-rose-950 font-black' : 'text-slate-800'
            }`}>
              {alertCount} Batches
            </div>
            <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${
              alertCount > 0 ? 'text-rose-800 font-bold' : 'text-slate-500 font-medium'
            }`}>
              <span>{formatCurrency(alertTotalValuation)} at risk</span>
              <span className="opacity-75">({avgHoldingDays}d avg)</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${
            alertCount > 0
              ? 'bg-rose-600 text-white shadow-xs animate-pulse'
              : 'bg-amber-50 border border-amber-200 text-amber-600'
          }`}>
            {alertCount > 0 ? <ShieldAlert className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* 641 Movement Type Auto-Routing Notice Banner */}
      {mdTransfer641Records.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-teal-50 border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>{mdTransfer641Records.length} MD Transfer to Plant (Movement Type 641) Records</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  Hidden from Receiving Data &bull; Routed to Distribution Data
                </span>
              </div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Movement Type 641 records represent Medical Device transfers between plants and are displayed inside Distribution Data under MD Transfer to Plant, analyzed by Total Value Transferred, Amount (Quantity), Line Items, and RDF vs HP smart bar graphs.
              </p>
            </div>
          </div>
          {onNavigateToDistribution && (
            <button
              type="button"
              onClick={onNavigateToDistribution}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>View in Distribution Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Visual Analytics Section */}
      <ReceivingDataAnalyticsSection
        receivingRecords={activeRecords}
        items={items}
        onOpenUploadModal={isAdmin ? () => setIsUploadModalOpen(true) : undefined}
      />

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Material, PO, Reference, Batch, Description, WBS, SLoc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plant Hub */}
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Plants ({uniquePlants.length})</option>
            {uniquePlants.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Movement Type */}
          <select
            value={selectedMvtType}
            onChange={(e) => setSelectedMvtType(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Movement Types ({uniqueMovementTypes.length})</option>
            {uniqueMovementTypes.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Storage Location */}
          <select
            value={selectedStorageLoc}
            onChange={(e) => setSelectedStorageLoc(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:bg-white focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Storage Locs ({uniqueStorageLocs.length})</option>
            {uniqueStorageLocs.map(sl => (
              <option key={sl} value={sl}>{sl}</option>
            ))}
          </select>

          {/* Quick Filter Alert Button */}
          {alertCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedHoldingFilter(selectedHoldingFilter === 'alertExceeded' ? 'all' : 'alertExceeded')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                selectedHoldingFilter === 'alertExceeded'
                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{selectedHoldingFilter === 'alertExceeded' ? 'Showing Alerts' : `Filter Alerts (${alertCount})`}</span>
            </button>
          )}

          {/* Stock Holding Days Filter */}
          <select
            value={selectedHoldingFilter}
            onChange={(e) => setSelectedHoldingFilter(e.target.value as any)}
            className={`text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer font-bold transition ${
              selectedHoldingFilter === 'alertExceeded'
                ? 'bg-rose-100 text-rose-900 border-2 border-rose-400 ring-2 ring-rose-300'
                : 'bg-amber-50/70 border border-amber-200 text-amber-900'
            }`}
          >
            <option value="all">All Holding Days</option>
            {alertCount > 0 && (
              <option value="alertExceeded" className="font-bold text-rose-700">
                🚨 Exceeding {alertThresholdDays}d Alert ({alertCount} Batches)
              </option>
            )}
            <option value="fresh">Fresh (&le; 30 Days)</option>
            <option value="active">Active (31 - 90 Days)</option>
            <option value="watch">Watch (91 - 180 Days)</option>
            <option value="aging">Aging Alert (&gt; 180 Days)</option>
          </select>

          {/* Threshold Adjuster Button */}
          <button
            type="button"
            onClick={() => setIsAlertModalOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2.5 py-1.5 transition flex items-center gap-1.5 cursor-pointer"
            title="Configure alert threshold days and view alert details"
          >
            <Sliders className="w-3.5 h-3.5 text-rose-600" />
            <span>Threshold: {alertThresholdDays}d</span>
          </button>

          {(selectedPlant !== 'all' || selectedMvtType !== 'all' || selectedStorageLoc !== 'all' || selectedHoldingFilter !== 'all' || searchQuery || sortField !== 'default') && (
            <button
              onClick={() => {
                setSelectedPlant('all');
                setSelectedMvtType('all');
                setSelectedStorageLoc('all');
                setSelectedHoldingFilter('all');
                setSearchQuery('');
                setSortField('default');
              }}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold px-2 py-1 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Comprehensive Receiving Ledger Table with Smart Column Lines & Stock Holding Days */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 text-center">#</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Purchase order</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Reference</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Material</th>
                <th className="py-3 px-3.5 min-w-[220px] border-x border-slate-200">Material Description</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Batch</th>
                <th 
                  className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => handleToggleSort('quantity')}
                  title="Click to sort by Quantity"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Quantity</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">Storage Location</th>
                <th 
                  className="py-3 px-3.5 text-right whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => handleToggleSort('amt')}
                  title="Click to sort by Valuation"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amt.in Loc.Cur.</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200">Movement Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 text-center">Special Stock</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200">WBS Element</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap border-x border-slate-200">Plant</th>
                <th 
                  className="py-3 px-3.5 whitespace-nowrap border-x border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => handleToggleSort('postingDate')}
                  title="Click to sort by Posting Date"
                >
                  <div className="flex items-center gap-1">
                    <span>Posting Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                {/* Auto Stock Holding Days Column with Dynamic Alert Styling */}
                <th 
                  className={`py-3 px-3.5 whitespace-nowrap border-x cursor-pointer transition ${
                    alertCount > 0
                      ? 'bg-rose-100/80 hover:bg-rose-200/80 border-rose-300 text-rose-950'
                      : 'bg-teal-50/50 hover:bg-teal-100/60 border-slate-200 text-teal-900'
                  }`}
                  onClick={() => handleToggleSort('holdingDays')}
                  title={`Click to sort by Stock Holding Days (Alert threshold: ${alertThresholdDays} days)`}
                >
                  <div className="flex items-center justify-center gap-1.5 font-black">
                    <Clock className={`w-3.5 h-3.5 ${alertCount > 0 ? 'text-rose-600' : 'text-teal-600'}`} />
                    <span>Stock Holding Days</span>
                    <ArrowUpDown className={`w-3 h-3 ${alertCount > 0 ? 'text-rose-700' : 'text-slate-400'}`} />
                    {alertCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white font-mono animate-pulse shadow-2xs">
                        {alertCount} Over Limit
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-normal text-slate-500 mt-0.5 font-sans">
                    Limit: &gt;{alertThresholdDays}d • Auto-updated daily
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-[11px]">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                      <p className="text-sm font-bold text-slate-800">
                        No receiving records uploaded or found matching criteria
                      </p>
                      <p className="text-xs text-slate-500">
                        Please upload an Excel or CSV file containing your inbound receiving consignments
                      </p>
                      {isAdmin && (
                        <button
                          onClick={() => setIsUploadModalOpen(true)}
                          className="mt-2 px-3.5 py-1.5 bg-teal-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                        >
                          Upload Receiving Data
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRecords.map((rec, index) => {
                  const holdingDays = calculateStockHoldingDays(rec.postingDate || rec.entryDate, rec);
                  const isExceedingAlert = holdingDays !== null && holdingDays > alertThresholdDays;
                  return (
                    <tr
                      key={rec.id || index}
                      className={`transition group cursor-pointer ${
                        isExceedingAlert
                          ? 'bg-rose-50/70 hover:bg-rose-100/80 border-l-4 border-l-rose-600'
                          : 'hover:bg-teal-50/40'
                      }`}
                      onClick={() => {
                        setInspectingRecord(rec);
                        onSelectItem?.(rec);
                      }}
                    >
                      <td className="py-2.5 px-3.5 text-center text-slate-400 text-[10px] border-x border-slate-200">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-teal-700 border-x border-slate-200">
                        {rec.purchaseOrder}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 border-x border-slate-200">
                        {rec.reference || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-semibold text-slate-900 border-x border-slate-200">
                        {rec.material}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans font-medium text-slate-900 max-w-xs truncate border-x border-slate-200" title={rec.materialDescription}>
                        {rec.materialDescription}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 border-x border-slate-200">
                        {rec.batch || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-900 border-x border-slate-200">
                        {rec.quantity?.toLocaleString() || 0}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-700 border-x border-slate-200">
                        <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-200">
                          {rec.storageLocation || 'SL01'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-bold text-emerald-600 border-x border-slate-200">
                        {formatCurrency(rec.amtInLocCur)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-x border-slate-200">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {rec.movementType || '101'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-center text-slate-500 border-x border-slate-200">
                        {rec.specialStock ? (
                          <span className="px-1.5 py-0.5 rounded-sm bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                            {rec.specialStock}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 text-[10px] border-x border-slate-200">
                        {rec.wbsElement || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-x border-slate-200">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {rec.plant || 'AA01'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap border-x border-slate-200">
                        {rec.postingDate ? (
                          <div
                            className="flex items-center gap-1.5"
                            title={`Exact Excel Date: ${rec.postingDate}${rec.postingDay ? ` | Day: ${rec.postingDay}, Month: ${rec.postingMonth}, Year: ${rec.postingYear}` : ''}${rec.rawPostingDate !== undefined ? ` (Raw Excel Cell: ${rec.rawPostingDate})` : ''}`}
                          >
                            <span className="font-bold text-slate-800">{rec.postingDate}</span>
                            {rec.postingDay && rec.postingMonth && rec.postingYear && (
                              <span className="text-[9px] font-sans px-1.5 py-0.2 rounded-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                D{rec.postingDay}/M{rec.postingMonth}/Y{rec.postingYear}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[10px]">-</span>
                        )}
                      </td>
                      {/* Auto-Calculated Stock Holding Days Cell with Automated Red Alert Highlighting */}
                      <td className={`py-2.5 px-3.5 text-center whitespace-nowrap border-x transition ${
                        isExceedingAlert
                          ? 'border-rose-300 bg-rose-100/70'
                          : 'border-slate-200'
                      }`}>
                        {holdingDays !== null ? (
                          isExceedingAlert ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black font-mono bg-rose-200 text-rose-950 border-2 border-rose-400 ring-2 ring-rose-200/80 shadow-2xs animate-pulse"
                              title={`🚨 CRITICAL STOCK HOLDING ALERT: In stock for ${holdingDays} days! Exceeds ${alertThresholdDays}-day threshold by ${holdingDays - alertThresholdDays} days! Exact Posting Date: ${rec.postingDate} | Today: ${new Date().toISOString().split('T')[0]}`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span className="font-black">{holdingDays} Days</span>
                              <span className="text-[10px] font-bold text-rose-900 font-sans px-1.5 py-0.2 rounded-xs bg-rose-300/80 border border-rose-400">
                                +{holdingDays - alertThresholdDays}d over limit
                              </span>
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                holdingDays <= 30
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : holdingDays <= 60
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                              title={`Exact Posting Date: ${rec.postingDate}${rec.postingDay ? ` (Day: ${rec.postingDay}, Month: ${rec.postingMonth}, Year: ${rec.postingYear})` : ''} | Current Date (Today): ${new Date().toISOString().split('T')[0]} | Holding Period: ${holdingDays} days (Within ${alertThresholdDays}d SLA)`}
                            >
                              <Clock className={`w-3 h-3 shrink-0 ${
                                holdingDays <= 30
                                  ? 'text-emerald-500'
                                  : holdingDays <= 60
                                  ? 'text-teal-500'
                                  : 'text-amber-500'
                              }`} />
                              <span>{holdingDays} {holdingDays === 1 ? 'Day' : 'Days'}</span>
                              <span className="text-[9px] font-sans opacity-70">
                                ({holdingDays <= 30 ? '<30d Fresh' : holdingDays <= 60 ? '31-60d Active' : `61-${alertThresholdDays}d Safe`})
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 font-sans text-[11px] italic">No Date</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated Stock Holding Floating Alert Toast */}
      {alertCount > 0 && !isAlertBannerDismissed && (
        <div className="fixed bottom-5 right-5 z-40 max-w-md w-full bg-white border-2 border-rose-400 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 ring-4 ring-rose-500/10">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md animate-pulse shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-rose-950 uppercase tracking-tight flex items-center gap-1.5">
                  <span>Automated Stock Alert</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-mono font-bold">
                    {alertCount} Over Limit
                  </span>
                </span>
                <button
                  onClick={() => setIsAlertBannerDismissed(true)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-snug">
                <strong className="text-rose-900 font-bold">{alertCount} consignment {alertCount === 1 ? 'batch' : 'batches'}</strong> have remained in stock exceeding the <strong className="text-slate-900 font-mono font-bold">{alertThresholdDays}-day limit</strong>! Valuation at risk: <strong className="text-emerald-700 font-mono font-bold">{formatCurrency(alertTotalValuation)}</strong>.
              </p>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHoldingFilter('alertExceeded');
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter {alertCount} Batches</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-rose-600" />
                  <span>Open Alert Center</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEscalationNotice}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Copy escalation notification memo"
                >
                  {copiedMemoSuccess ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copiedMemoSuccess ? 'Copied' : 'Copy Memo'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspection Dossier Modal */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            {(() => {
              const days = calculateStockHoldingDays(inspectingRecord.postingDate || inspectingRecord.entryDate, inspectingRecord);
              const isOverdue = days !== null && days > alertThresholdDays;
              return (
                <>
                  <div className={`px-5 py-4 border-b flex items-center justify-between ${
                    isOverdue 
                      ? 'bg-linear-to-r from-rose-50 to-rose-100/60 border-rose-200' 
                      : 'bg-linear-to-r from-slate-50 to-teal-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl shadow-xs text-white ${
                        isOverdue ? 'bg-rose-600 animate-pulse' : 'bg-teal-600'
                      }`}>
                        {isOverdue ? <ShieldAlert className="w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">
                            Goods Receipt Inbound Dossier
                          </h3>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase font-mono">
                              Alert: &gt;{alertThresholdDays}d Limit
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Purchase Order: <strong className="font-mono text-teal-700">{inspectingRecord.purchaseOrder}</strong> • Material: <strong className="font-mono text-slate-800">{inspectingRecord.material}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setInspectingRecord(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    {/* Material title card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Material Description</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {inspectingRecord.materialDescription}
                      </div>
                    </div>

                    {/* Stock Holding Days & Alert Status Card */}
                    <div className={`p-4 rounded-xl border ${
                      isOverdue 
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' 
                        : 'bg-teal-50/70 border-teal-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                          {isOverdue ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <Clock className="w-4 h-4 text-teal-600" />}
                          <span>Stock Holding Days & Aging Assessment</span>
                        </div>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white font-mono">
                            +{days! - alertThresholdDays} Days Overdue
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Posting Date (Excel Source)</span>
                          <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block">
                            {inspectingRecord.postingDate || '-'}
                          </span>
                          {inspectingRecord.postingDay && inspectingRecord.postingMonth && inspectingRecord.postingYear && (
                            <span className="text-[10px] text-amber-700 font-sans block mt-0.5">
                              Day {inspectingRecord.postingDay} • Month {inspectingRecord.postingMonth} • Year {inspectingRecord.postingYear}
                            </span>
                          )}
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Date (Today)</span>
                          <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block">
                            {new Date().toISOString().split('T')[0]}
                          </span>
                          <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                            Auto-updated daily
                          </span>
                        </div>

                        <div className={`p-2.5 rounded-lg border ${
                          isOverdue ? 'bg-rose-100/80 border-rose-300' : 'bg-teal-100/70 border-teal-300'
                        }`}>
                          <span className="text-[10px] text-slate-600 font-bold uppercase block">Holding Duration</span>
                          <span className={`text-base font-black font-mono mt-0.5 block ${
                            isOverdue ? 'text-rose-950' : 'text-teal-900'
                          }`}>
                            {days !== null ? `${days} Days` : 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-600 font-sans block mt-0.5">
                            Threshold: {alertThresholdDays} days
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity Received</span>
                        <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                          {inspectingRecord.quantity?.toLocaleString() || 0}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Valuation (Loc. Cur.)</span>
                        <span className="text-sm font-bold font-mono text-emerald-600 mt-0.5 block">
                          {formatCurrency(inspectingRecord.amtInLocCur)}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Batch Number</span>
                        <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block">
                          {inspectingRecord.batch || '-'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Plant & Storage Loc</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                          Plant {inspectingRecord.plant} • {inspectingRecord.storageLocation}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Movement Type</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                          {inspectingRecord.movementType || '101'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">WBS Element</span>
                        <span className="text-xs font-mono text-slate-700 mt-0.5 block">
                          {inspectingRecord.wbsElement || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const text = `EPSS Consignment Alert: PO ${inspectingRecord.purchaseOrder} | Material ${inspectingRecord.material} (${inspectingRecord.materialDescription}) | Plant ${inspectingRecord.plant} - ${inspectingRecord.storageLocation} | Held for ${days} days (Limit: ${alertThresholdDays}d) | Value: ETB ${inspectingRecord.amtInLocCur?.toLocaleString()}`;
                        navigator.clipboard.writeText(text);
                        alert('Consignment memo copied to clipboard!');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Consignment Memo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectingRecord(null)}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Close Dossier
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Stock Holding Days Automated Alert Center Modal */}
      <StockHoldingAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        alertRecords={alertRecords}
        totalRecordsCount={activeRecords.length}
        alertThresholdDays={alertThresholdDays}
        onUpdateThreshold={handleUpdateThreshold}
        onSelectItem={(rec) => setInspectingRecord(rec)}
        onExportAlerts={handleExportAlertsCSV}
      />

      {/* Upload Modal - Admin Only */}
      {isAdmin && isUploadModalOpen && (
        <ReceivingDataUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadReceivingData={(records, mode) => {
            onUploadReceivingData?.(records, mode);
            setIsUploadModalOpen(false);
          }}
          initialRecordsCount={activeRecords.length}
        />
      )}
    </div>
  );
};
