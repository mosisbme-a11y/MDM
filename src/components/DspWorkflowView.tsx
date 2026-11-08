import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Send,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Search,
  Filter,
  ArrowRight,
  Layers,
  Hospital,
  Warehouse,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  FileCheck,
  Printer,
  Trash2,
  BadgeAlert,
  ArrowUpRight,
  Sparkles,
  Share2,
  Plus,
  Archive,
  FileSpreadsheet,
  Zap,
  Hourglass,
  Calendar,
  UserCheck,
  Check,
  X,
  BellRing,
  Mail,
  MessageCircle,
  Eye,
  Copy,
  BarChart3,
  TrendingUp,
  GitMerge,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { DSPRequestModal } from './DSPRequestModal';
import { BreakdownRequestModal } from './BreakdownRequestModal';
import { RegionBreakdownModal } from './RegionBreakdownModal';
import { RegionalSubmittedDataView } from './RegionalSubmittedDataView';
import { 
  RegionBreakdownMatrixTable, 
  DEFAULT_STAGE_3_COLUMNS,
  DEFAULT_STAGE_3_ROWS
} from './RegionBreakdownMatrixTable';
import {
  Stage4MohSubmittedMatrixTable,
  Stage4MatrixData,
  DEFAULT_STAGE_4_COLUMNS,
  DEFAULT_STAGE_4_ROWS
} from './Stage4MohSubmittedMatrixTable';
import { Stage5EpssHoAggregationView } from './Stage5EpssHoAggregationView';
import { Stage6EpssBranchDispatchView } from './Stage6EpssBranchDispatchView';
import { DspRequestMohTemplateView } from './DspRequestMohTemplateView';
import { DspReceivedFromMohView } from './DspReceivedFromMohView';
import { DspBreakdownMohToRhbView } from './DspBreakdownMohToRhbView';
import { MappingBreakdownView } from './MappingBreakdownView';
import { StageSourceDataModal } from './StageSourceDataModal';
import { SavedDraftsManagerModal } from './SavedDraftsManagerModal';
import { 
    MedicalDeviceItem, 
    EpssSubTab, 
    MultipleStockRecord, 
    DeviceDocument, 
    HealthFacilityRecord,
    DspWorkflowRecord,
    RegionBreakdownMatrixData,
    RegionBreakdownColumn,
    RegionBreakdownRow
} from '../types';
import { formatCurrency, formatNumber, downloadCSV } from '../utils/formatters';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';
import { isProgramHpStockItem } from '../data/defaultDspRequestTemplateData';

export interface DateCountInfo {
  days: number;
  label: string;
  sublabel: string;
  statusText: string;
  badgeClass: string;
  isActionTaken: boolean;
  actionDate?: string;
  actionBy?: string;
  actionType?: string;
  turnaroundDays?: number;
}

/**
 * Calculates calendar days elapsed between submission date and action date (or today if pending)
 */
export function computeDateCount(
  dateSubmitted: string,
  actionDate?: string,
  status?: string,
  actionBy?: string,
  actionType?: string,
  recordedTurnaround?: number
): DateCountInfo {
  if (!dateSubmitted) {
    return {
      days: 0,
      label: 'No Send Date',
      sublabel: 'Pending dispatch',
      statusText: 'Unsent',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      isActionTaken: false
    };
  }

  const parseToMidnight = (dStr: string) => {
    try {
      const clean = dStr.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m - 1, d).getTime();
        }
      }
      const parsed = new Date(dStr).getTime();
      return isNaN(parsed) ? Date.now() : parsed;
    } catch {
      return Date.now();
    }
  };

  const startMs = parseToMidnight(dateSubmitted);
  const isActionTaken = !!actionDate || status === 'Endorsed & Approved' || status === 'Dispatched to Plants';

  if (isActionTaken) {
    const endMs = actionDate ? parseToMidnight(actionDate) : parseToMidnight(new Date().toISOString().split('T')[0]);
    const computedDays = recordedTurnaround !== undefined ? recordedTurnaround : Math.max(0, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)));

    return {
      days: computedDays,
      turnaroundDays: computedDays,
      label: `${computedDays} Day${computedDays === 1 ? '' : 's'} Turnaround`,
      sublabel: actionDate ? `Action on ${actionDate}` : 'Action Completed',
      statusText: actionType || 'Endorsed & Approved',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      isActionTaken: true,
      actionDate: actionDate || dateSubmitted,
      actionBy,
      actionType
    };
  }

  // Active date count while waiting to Take action
  const nowMs = parseToMidnight(new Date().toISOString().split('T')[0]);
  const diffDays = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return {
      days: 0,
      label: 'Sent Today (Day 0)',
      sublabel: 'Awaiting MOH Action',
      statusText: 'Dispatched Today',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      isActionTaken: false
    };
  } else if (diffDays <= 2) {
    return {
      days: diffDays,
      label: `Day ${diffDays} (${diffDays}d Elapsed)`,
      sublabel: 'Within Normal SLA',
      statusText: 'Awaiting Action',
      badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      isActionTaken: false
    };
  } else if (diffDays <= 5) {
    return {
      days: diffDays,
      label: `Day ${diffDays} (${diffDays}d Elapsed)`,
      sublabel: 'Follow-Up Recommended',
      statusText: 'Action Due',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      isActionTaken: false
    };
  } else {
    return {
      days: diffDays,
      label: `Day ${diffDays} (${diffDays}d Elapsed)`,
      sublabel: 'Urgent • Action Overdue',
      statusText: 'Overdue (>5 Days)',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
      isActionTaken: false
    };
  }
}

export const SUBMITTING_CRITERIA_MAP: Record<string, { title: string; sender: string; recipient: string; criteria: string[] }> = {
  '1.1': {
    title: 'DSP Request to MOH',
    sender: 'EPSS Head Office (Medical Equipment Directorate)',
    recipient: 'Ministry of Health (PMD Directorate)',
    criteria: [
      'Official Request Covering Letter (Signed & Sealed)',
      'Stock Verification List & Equipment Catalog Matching',
      'Prioritized Health Facility Request Dossier (Excel + PDF)',
      'Executive Quota Summary & Budgetary Valuation'
    ]
  },
  '1.2': {
    title: 'DSP Received from MOH',
    sender: 'Ministry of Health (PMD Directorate)',
    recipient: 'EPSS Head Office',
    criteria: [
      'Official MOH Endorsement Letter with Reference Number',
      'Approved National Allocation Quota Summary',
      'Technical Committee Review Sign-off & Guidelines'
    ]
  },
  '1.3.1': {
    title: 'Map HF to Hub',
    sender: 'EPSS Head Office Technical Operations',
    recipient: 'EPSS Regional Distribution Hubs',
    criteria: [
      'Master Health Facility Registry Code Mapping',
      'Geographic Hub Catchment Proximity Validation',
      'Cold-Chain & Heavy Equipment Transport Feasibility Check'
    ]
  },
  '1.3.2': {
    title: 'Send DSP to Hub',
    sender: 'EPSS Head Office Logistics',
    recipient: 'Regional Distribution Hubs / Plants',
    criteria: [
      'Individual Hub Allocation Breakdown Dispatch',
      'Plant Manager Official Acknowledgment Receipt',
      'Inventory Reserve Hold Authorization'
    ]
  },
  '1.3.3': {
    title: 'Item Aggregation',
    sender: 'EPSS Technical Operations',
    recipient: 'EPSS Executive Directorate & MOH',
    criteria: [
      'Multi-Region Material Requirement Roll-up',
      'Stock Ledger Reconciliation vs Unrestricted Quota',
      'Equipment Specification Normalization'
    ]
  },
  '1.3.4': {
    title: 'Order process',
    sender: 'Procurement & Logistics Directorate',
    recipient: 'EPSS Central Dispatch & Warehouses',
    criteria: [
      'Official Release Order & Purchase Contract Linking',
      'Quality Assurance & Pre-Shipment Clearance Certificate',
      'Transport & Waybill Logistics Scheduling'
    ]
  },
  '2.1': {
    title: 'DSP Received from EPSS',
    sender: 'EPSS Head Office',
    recipient: 'Ministry of Health (PMD Directorate)',
    criteria: [
      'DSP Master Document Receipt Validation',
      'National Priority Alignment Verification',
      'Technical Equipment Specification Approval'
    ]
  },
  '2.2': {
    title: 'DSP Request to RHB',
    sender: 'Ministry of Health (PMD Directorate)',
    recipient: 'Regional Health Bureaus (RHBs)',
    criteria: [
      'Official Ministerial Breakdown Letter',
      'Regional Quota Matrix Spreadsheet',
      'Submission SLA Timeline Notice (Standard 3 Days)'
    ]
  },
  '2.3': {
    title: 'Breakdown Received from RHB',
    sender: 'Regional Health Bureaus (RHBs)',
    recipient: 'Ministry of Health (PMD Directorate)',
    criteria: [
      'RHB Head Official Sign-off & Bureau Stamp',
      'Facility-Level Distribution Matrix (Woreda/Zone/Facility)',
      'Site Readiness & Infrastructure Clearance Checklist'
    ]
  },
  '2.4': {
    title: 'Breakdown Aggregation by hub',
    sender: 'MOH Technical Aggregation Team',
    recipient: 'MOH Executive Council',
    criteria: [
      'Multi-Regional Consolidated Breakdown Validation',
      'Zero-Discrepancy Quantity Cross-Check',
      'Priority Health Facility Coverage Index'
    ]
  },
  '2.5': {
    title: 'DSP Aggr. Submitted to EPSS',
    sender: 'Ministry of Health (PMD Directorate)',
    recipient: 'EPSS Head Office',
    criteria: [
      'Minister / State Minister Final Approval Seal',
      'Final Two-Tier National Breakdown Matrix',
      'EPSS Release Order Authorization Memo'
    ]
  },
  '3.1': {
    title: 'Breakdown Received from MOH',
    sender: 'Ministry of Health (PMD Directorate)',
    recipient: 'Regional Health Bureau (RHB) Planning Team',
    criteria: [
      'Ministerial Allocation Guideline Review',
      'Zonal & Woreda Need Assessment Integration',
      'Target Hospital / Health Center Readiness Screening'
    ]
  },
  '3.2': {
    title: 'Submit Breakdown to MOH',
    sender: 'Regional Health Bureau (RHB)',
    recipient: 'Ministry of Health (PMD Directorate)',
    criteria: [
      'RHB Bureau Head Approval Signature',
      'Completed Two-Tier Health Facility Matrix',
      'Formal Submission Transmittal Letter'
    ]
  },
  '4.1': {
    title: 'Received DSP',
    sender: 'Ministry of Health / EPSS HO',
    recipient: 'EPSS Branch Hubs & Plants',
    criteria: [
      'Branch Inward Dispatch Notice Registration',
      'Health Facility Destination Verification',
      'Stock Physical Lot / Serial Allocation'
    ]
  },
  '4.2': {
    title: 'Analysis & compare with DSP',
    sender: 'EPSS Branch Hub Operations',
    recipient: 'EPSS Quality & Logistics Division',
    criteria: [
      'SOH Ledger vs Allocation Comparison',
      'Discrepancy & Variance Audit Report',
      'Waybill Generation & Final Gate Pass Approval'
    ]
  }
};

export interface DspWorkflowViewProps {
  currentSubTab?: EpssSubTab;
  onSelectSubTab?: (tab: EpssSubTab) => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
  multipleStockItems?: MultipleStockRecord[];
  setMultipleStockItems?: React.Dispatch<React.SetStateAction<MultipleStockRecord[]>>;
  onAddDocument?: (doc: DeviceDocument) => void;
  userId?: string;
  hfListItems?: HealthFacilityRecord[];
  setHfListItems?: React.Dispatch<React.SetStateAction<HealthFacilityRecord[]>>;
  dspRecords?: DspWorkflowRecord[];
  setDspRecords?: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  dsp22Columns?: any[];
  dsp22Rows?: any[];
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

export const DspWorkflowView: React.FC<DspWorkflowViewProps> = ({
  currentSubTab = 'dsp-mgmt',
  onSelectSubTab,
  items = [],
  onSelectItem,
  multipleStockItems = [],
  setMultipleStockItems,
  onAddDocument,
  userId,
  hfListItems = [],
  setHfListItems,
  dspRecords = [],
  setDspRecords,
  dsp22Columns = [],
  dsp22Rows = [],
  onTriggerCloudSync
}) => {
const ALL_ETHIOPIAN_REGIONS = [
  'Oromia',
  'Amhara',
  'Sidama',
  'Somali',
  'Tigray',
  'Afar',
  'South Ethiopia',
  'Central Ethiopia',
  'South West Ethiopia',
  'SNNPR',
  'Benishangul-Gumuz',
  'Gambella',
  'Harari',
  'Addis Ababa',
  'Dire Dawa'
];

  const records = dspRecords;
  const setRecords = setDspRecords || (() => {});
  const [selectedRecord, setSelectedRecord] = useState<DspWorkflowRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agingFilter, setAgingFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [selectedRegionsFilter, setSelectedRegionsFilter] = useState<string[]>([...ALL_ETHIOPIAN_REGIONS]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [isRegionBreakdownModalOpen, setIsRegionBreakdownModalOpen] = useState(false);
  const [isSavedDraftsManagerOpen, setIsSavedDraftsManagerOpen] = useState(false);
  const [stage3ViewMode, setStage3ViewMode] = useState<'matrix' | 'ledger'>('matrix');
  const [stage4ViewMode, setStage4ViewMode] = useState<'matrix' | 'ledger'>('matrix');
  const [stage5ViewMode, setStage5ViewMode] = useState<'hub-aggregation' | 'ledger'>('hub-aggregation');
  const [stageFilter, setStageFilter] = useState('all');
  const [inspectStageInfo, setInspectStageInfo] = useState<{ stageKey: string; stageTitle: string } | null>(null);
  const [summaryViewMode, setSummaryViewMode] = useState<'itemized' | 'dossier'>('dossier');

  // Smart Table Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-indigo-500 ml-1" />
      : <ChevronDown className="w-3 h-3 text-indigo-500 ml-1" />;
  };


  // Take Action modal state for EPSS to MOH requests
  const [actionTargetRecord, setActionTargetRecord] = useState<DspWorkflowRecord | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionDecision, setActionDecision] = useState<'Endorsed & Approved' | 'Proceed to Stage 2 Breakdown' | 'Under MOH Technical Review' | 'Revision Requested'>('Endorsed & Approved');
  const [actionFormDate, setActionFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionFormOfficer, setActionFormOfficer] = useState('Dr. Bethlehem (MOH PMD Directorate)');
  const [actionFormLetterRef, setActionFormLetterRef] = useState('');
  const [actionFormNotes, setActionFormNotes] = useState('DSP allocation quota endorsed and validated as per national priority distribution guidelines.');
  const [actionFormRegions, setActionFormRegions] = useState<string[]>([]);
  const [actionFeedbackToast, setActionFeedbackToast] = useState<string | null>(null);

  // Quick WhatsApp Dispatch Modal State for Stage 2 Breakdown Dossiers
  const [quickWhatsAppModal, setQuickWhatsAppModal] = useState<{
    record: DspWorkflowRecord;
    phone: string;
    messageText: string;
    copied: boolean;
  } | null>(null);

  const handleOpenBreakdownEmail = (rec: DspWorkflowRecord) => {
    const targetRegs = rec.targetedRegions?.length > 0 ? rec.targetedRegions.join(', ') : 'Regional Health Bureaus';
    const subject = `Official Regional Breakdown Request - ${targetRegs} (${rec.dateSubmitted}) [Ref: ${rec.dspRefNumber}]`;
    const deviceList = rec.itemsIncluded.map((it, idx) => `${idx + 1}. ${it.description} (${it.material}) — ${it.quantity} Units`).join('\n');
    const body = `Dear Regional Health Bureau Leadership,\n\nOfficial Medical Equipment Allocation Breakdown Request from Ministry of Health (MOH) Pharmaceuticals & Medical Devices Directorate.\n\nSummary:\n- Reference: ${rec.dspRefNumber}\n- Official Letter: ${rec.officialLetterRef}\n- Date: ${rec.dateSubmitted}\n- Target Regions: ${targetRegs}\n- Total Allocated Units: ${rec.totalQuantity.toLocaleString()} Units\n- Valuation: ${formatCurrency(rec.totalValuationETB)}\n\nAllocated Equipment Groups:\n${deviceList}\n\nPlease proceed to submit your Health Facility Allocation Matrix (Stage 3).\n\nAuthorized Signatory: ${rec.signatory} (${rec.signatoryRole})`;

    const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('rhb.logistics@moh.gov.et')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    setActionFeedbackToast(`✓ Opened Gmail Composer for Breakdown Request ${rec.dspRefNumber}!`);
    setTimeout(() => setActionFeedbackToast(null), 3500);
  };

  const handleOpenBreakdownWhatsApp = (rec: DspWorkflowRecord) => {
    const phone = '+251911234567';
    const targetRegs = rec.targetedRegions?.length > 0 ? rec.targetedRegions.join(', ') : 'Regional Health Bureaus';
    const deviceList = rec.itemsIncluded.map((it, idx) => `• ${it.description} (${it.material}): ${it.quantity} Units`).join('\n');
    const message = `*MINISTRY OF HEALTH (MOH) — ETHIOPIA*
*OFFICIAL REGIONAL MEDICAL EQUIPMENT BREAKDOWN REQUEST*

*Breakdown Ref:* ${rec.dspRefNumber}
*Official Letter:* ${rec.officialLetterRef}
*Date:* ${rec.dateSubmitted}
*Target Regions:* ${targetRegs}
*Total Units:* ${rec.totalQuantity.toLocaleString()} Units
*Valuation:* ${formatCurrency(rec.totalValuationETB)}

*ALLOCATED MEDICAL DEVICES (${rec.itemsIncluded.length}):*
${deviceList}

*Signatory:* ${rec.signatory} (${rec.signatoryRole})
_Protocol: Official Institutional Dispatch via WhatsApp_`;

    setQuickWhatsAppModal({
      record: rec,
      phone,
      messageText: message,
      copied: false
    });
  };

  const handleOpenActionModal = (rec: DspWorkflowRecord) => {
    setActionTargetRecord(rec);
    setActionDecision((rec.actionType as any) || 'Endorsed & Approved');
    setActionFormDate(rec.actionTakenDate || new Date().toISOString().split('T')[0]);
    setActionFormOfficer(rec.actionTakenBy || 'Officer');
    setActionFormLetterRef(rec.actionLetterRef || '');
    setActionFormNotes(rec.actionNotes || '');
    setActionFormRegions(rec.targetedRegions || []);
    setIsActionModalOpen(true);
  };

  const handleSaveAction = () => {
    if (!actionTargetRecord) return;

    const turnaround = computeDateCount(actionTargetRecord.dateSubmitted, actionFormDate).days;
    let newStatus: DspWorkflowRecord['status'] = actionTargetRecord.status;

    if (actionDecision === 'Endorsed & Approved' || actionDecision === 'Proceed to Stage 2 Breakdown') {
      newStatus = 'Endorsed & Approved';
    } else if (actionDecision === 'Under MOH Technical Review') {
      newStatus = 'Under Review';
    } else if (actionDecision === 'Revision Requested') {
      newStatus = 'Draft';
    }

    const updatedRecord: DspWorkflowRecord = {
      ...actionTargetRecord,
      status: newStatus,
      approvedDate: actionDecision.includes('Approved') || actionDecision.includes('Breakdown') ? actionFormDate : actionTargetRecord.approvedDate,
      actionTakenDate: actionFormDate,
      actionTakenBy: actionFormOfficer,
      actionType: actionDecision,
      actionLetterRef: actionFormLetterRef,
      actionNotes: actionFormNotes,
      targetedRegions: actionDecision === 'Proceed to Stage 2 Breakdown' ? actionFormRegions : actionTargetRecord.targetedRegions,
      turnaroundDays: turnaround
    };

    setRecords(prev => {
      const updated = prev.map(r => r.id === actionTargetRecord.id ? updatedRecord : r);
      return updated;
    });

    if (selectedRecord && selectedRecord.id === actionTargetRecord.id) {
      setSelectedRecord(updatedRecord);
    }

    if (onTriggerCloudSync) {
      onTriggerCloudSync(
        `✓ Action recorded on ${actionTargetRecord.dspRefNumber} (Turnaround: ${turnaround} days) and synced to cloud!`,
        {
          type: 'STATUS_CHANGE',
          title: `Action on ${actionTargetRecord.dspRefNumber}`,
          payload: updatedRecord
        }
      );
    }

    setIsActionModalOpen(false);
    setActionFeedbackToast(`Action recorded on ${actionTargetRecord.dspRefNumber}! Turnaround: ${turnaround} days.`);
    setTimeout(() => setActionFeedbackToast(null), 4000);

    // If user chose to proceed to Stage 2 Breakdown Request
    if (actionDecision === 'Proceed to Stage 2 Breakdown') {
      if (onSelectSubTab) {
        onSelectSubTab('dsp-breakdown-moh-rhb');
      }
      setIsBreakdownModalOpen(true);
    }
    setActionTargetRecord(null);
  };

  const handleRemoveItemFromRecord = (recordId: string, itemIdx: number) => {
    setRecords(prev => {
      const targetRecord = prev.find(r => r.id === recordId);
      if (!targetRecord) return prev;

      const newItems = [...targetRecord.itemsIncluded];
      newItems.splice(itemIdx, 1);

      const updatedRecord: DspWorkflowRecord = {
        ...targetRecord,
        totalDevices: newItems.length,
        totalQuantity: newItems.reduce((sum, it) => sum + (it.quantity || 0), 0),
        totalValuationETB: newItems.reduce((sum, it) => {
           // Fallback valuation logic if not explicitly stored per item
           const unitVal = targetRecord.totalValuationETB / (targetRecord.totalQuantity || 1);
           return sum + ((it as any).totalAmount || (it.quantity * unitVal) || 0);
        }, 0),
        itemsIncluded: newItems
      };

      const nextRecs = prev.map(r => r.id === recordId ? updatedRecord : r);
      return nextRecs;
    });
    
    if (onTriggerCloudSync) {
       onTriggerCloudSync(`Item removed from DSP Record ${recordId}`, {
         type: 'UPDATE',
         title: `Update items in ${recordId}`,
       });
    }
  };

  const handleToggleRegion = (reg: string) => {
    setSelectedRegionsFilter(prev => {
      const exists = prev.some(r => r.toLowerCase() === reg.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter(r => r.toLowerCase() !== reg.toLowerCase());
      } else {
        return [...prev, reg];
      }
    });
  };

  const handleSelectAllRegions = () => setSelectedRegionsFilter([...ALL_ETHIOPIAN_REGIONS]);
  const handleClearAllRegions = () => setSelectedRegionsFilter([ALL_ETHIOPIAN_REGIONS[0]]);


  // Map subTab to stage and subStep
  const { currentStage, currentSubStep } = useMemo(() => {
    switch (currentSubTab) {
      // 1. Head office DSP management
      case 'head-office-dsp':
        return { currentStage: 'head-office-dsp', currentSubStep: 'all' };
      case 'dsp-ho-1-1':
      case 'dsp-request-moh-epss':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.1' };
      case 'dsp-ho-1-2':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.2' };
      case 'dsp-ho-1-3':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.3' };
      case 'dsp-ho-1-3-1':
      case 'mapping-breakdown':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.3.1' };
      case 'dsp-ho-1-3-2':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.3.2' };
      case 'dsp-ho-1-3-3':
      case 'dsp-aggregation-epss-ho':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.3.3' };
      case 'dsp-ho-1-3-4':
        return { currentStage: 'head-office-dsp', currentSubStep: '1.3.4' };

      // 2. MOH OSP management
      case 'moh-osp-management':
        return { currentStage: 'moh-osp-management', currentSubStep: 'all' };
      case 'dsp-moh-2-1':
        return { currentStage: 'moh-osp-management', currentSubStep: '2.1' };
      case 'dsp-moh-2-2':
      case 'dsp-breakdown-moh-rhb':
        return { currentStage: 'moh-osp-management', currentSubStep: '2.2' };
      case 'dsp-moh-2-3':
        return { currentStage: 'moh-osp-management', currentSubStep: '2.3' };
      case 'dsp-moh-2-4':
      case 'regional-aggregator':
        return { currentStage: 'moh-osp-management', currentSubStep: '2.4' };
      case 'dsp-moh-2-5':
      case 'dsp-submitted-moh-epss-ho':
        return { currentStage: 'moh-osp-management', currentSubStep: '2.5' };

      // 3. RHB Break down management
      case 'rhb-breakdown-management':
        return { currentStage: 'rhb-breakdown-management', currentSubStep: 'all' };
      case 'dsp-rhb-3-1':
        return { currentStage: 'rhb-breakdown-management', currentSubStep: '3.1' };
      case 'dsp-rhb-3-2':
      case 'dsp-submitted-rhb-moh':
        return { currentStage: 'rhb-breakdown-management', currentSubStep: '3.2' };

      // 4. Branches DSP management
      case 'branches-dsp-management':
        return { currentStage: 'branches-dsp-management', currentSubStep: 'all' };
      case 'dsp-branches-4-1':
      case 'dsp-submitted-epss-branch':
      case 'plant-dsp':
        return { currentStage: 'branches-dsp-management', currentSubStep: '4.1' };
      case 'dsp-branches-4-2':
        return { currentStage: 'branches-dsp-management', currentSubStep: '4.2' };

      default:
        return { currentStage: 'all', currentSubStep: 'all' };
    }
  }, [currentSubTab]);

  const stagesList = [
    { 
      id: 'head-office-dsp', 
      stageKey: 'head-office-dsp', 
      label: 'Head Office DSP Management', 
      color: 'from-blue-600 to-cyan-600', 
      count: records.filter(r => r.stage === 'head-office-dsp').length,
      subSteps: [
        { id: '1.1', label: 'DSP Request to MOH', subTab: 'dsp-ho-1-1' as EpssSubTab },
        { id: '1.2', label: 'DSP Received from MOH', subTab: 'dsp-ho-1-2' as EpssSubTab },
        { id: '1.3.1', label: 'Map HF to Hub', subTab: 'dsp-ho-1-3-1' as EpssSubTab },
        { id: '1.3.2', label: 'Send DSP to Hub', subTab: 'dsp-ho-1-3-2' as EpssSubTab },
        { id: '1.3.3', label: 'Item Aggregation', subTab: 'dsp-ho-1-3-3' as EpssSubTab },
        { id: '1.3.4', label: 'Order process', subTab: 'dsp-ho-1-3-4' as EpssSubTab },
      ]
    },
    { 
      id: 'moh-osp-management', 
      stageKey: 'moh-osp-management', 
      label: 'MOH OSP Management', 
      color: 'from-cyan-600 to-teal-600', 
      count: records.filter(r => r.stage === 'moh-osp-management').length,
      subSteps: [
        { id: '2.1', label: 'DSP Received from EPSS', subTab: 'dsp-moh-2-1' as EpssSubTab },
        { id: '2.2', label: 'DSP Request to RHB', subTab: 'dsp-moh-2-2' as EpssSubTab },
        { id: '2.3', label: 'Breakdown Received from RHB', subTab: 'dsp-moh-2-3' as EpssSubTab },
        { id: '2.4', label: 'Breakdown Aggregation by hub', subTab: 'dsp-moh-2-4' as EpssSubTab },
        { id: '2.5', label: 'DSP Aggr. Submitted to EPSS', subTab: 'dsp-moh-2-5' as EpssSubTab },
      ]
    },
    { 
      id: 'rhb-breakdown-management', 
      stageKey: 'rhb-breakdown-management', 
      label: 'RHB Breakdown Management', 
      color: 'from-amber-600 to-orange-600', 
      count: records.filter(r => r.stage === 'rhb-breakdown-management').length,
      subSteps: [
        { id: '3.1', label: 'Breakdown Received from MOH', subTab: 'dsp-rhb-3-1' as EpssSubTab },
        { id: '3.2', label: 'Submit Breakdown to MOH', subTab: 'dsp-rhb-3-2' as EpssSubTab },
      ]
    },
    { 
      id: 'branches-dsp-management', 
      stageKey: 'branches-dsp-management', 
      label: 'Branches DSP Management', 
      color: 'from-purple-600 to-indigo-600', 
      count: records.filter(r => r.stage === 'branches-dsp-management').length,
      subSteps: [
        { id: '4.1', label: 'Received DSP', subTab: 'dsp-branches-4-1' as EpssSubTab },
        { id: '4.2', label: 'Analysis & compare with DSP', subTab: 'dsp-branches-4-2' as EpssSubTab },
      ]
    },
  ];

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      let matchStage = true;
      if (currentStage !== 'all') {
        matchStage = r.stage === currentStage;
      }

      let matchSubStep = true;
      if (currentSubStep && currentSubStep !== 'all') {
        const recordSubStage = canonicalizeSubStage(r.subStage, r.stage);
        matchSubStep = recordSubStage === currentSubStep || recordSubStage.startsWith(currentSubStep) || currentSubStep.startsWith(recordSubStage);
      }

      const matchSearch =
        r.dspRefNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.officialLetterRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.senderOrg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recipientOrg.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || r.status === statusFilter;

      // Aging SLA Filter
      let matchAging = true;
      if (agingFilter === 'pending') {
        matchAging = !r.actionTakenDate && r.status !== 'Endorsed & Approved';
      } else if (agingFilter === 'overdue') {
        matchAging = !r.actionTakenDate && r.status !== 'Endorsed & Approved' && computeDateCount(r.dateSubmitted).days > 3;
      } else if (agingFilter === 'completed') {
        matchAging = !!r.actionTakenDate || r.status === 'Endorsed & Approved';
      }

      const matchRegion = selectedRegionsFilter.length === 0 || 
        selectedRegionsFilter.length === ALL_ETHIOPIAN_REGIONS.length ||
        r.targetedRegions.some(reg => 
          selectedRegionsFilter.some(sel => sel.toLowerCase() === reg.toLowerCase() || reg.toLowerCase().includes(sel.toLowerCase()))
        );

      const matchStageFilter = stageFilter === 'all' || r.stage === stageFilter;

      return matchStage && matchSubStep && matchSearch && matchStatus && matchAging && matchRegion && matchStageFilter;
    });
  }, [records, currentStage, currentSubStep, searchQuery, statusFilter, agingFilter, selectedRegionsFilter, stageFilter]);

  const allRequestTableItems = useMemo(() => {
    const result: Array<{
      id: string;
      parentRecord: DspWorkflowRecord;
      itemIndex: number;
      material: string;
      description: string;
      quantity: number;
      plant: string;
      allocatedFacility?: string;
      unitPriceETB: number;
      totalValuationETB: number;
    }> = [];

    filteredRecords.forEach((rec) => {
      const totalQty = rec.itemsIncluded.reduce((acc, i) => acc + (i.quantity || 0), 0) || 1;
      const avgValPerUnit = rec.totalValuationETB > 0 ? rec.totalValuationETB / totalQty : 350000;

      rec.itemsIncluded.forEach((item, idx) => {
        const itemQty = item.quantity || 1;
        const val = itemQty * avgValPerUnit;
        result.push({
          id: `${rec.id}-item-${idx}`,
          parentRecord: rec,
          itemIndex: idx,
          material: item.material,
          description: item.description,
          quantity: itemQty,
          plant: item.plant || 'HO01',
          allocatedFacility: item.allocatedFacility || rec.recipientOrg,
          unitPriceETB: Math.round(avgValPerUnit),
          totalValuationETB: Math.round(val)
        });
      });
    });

    return result;
  }, [filteredRecords]);

  const sortedRequestTableItems = useMemo(() => {
    if (!sortConfig) return allRequestTableItems;
    const sorted = [...allRequestTableItems].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'material': aValue = a.material; bValue = b.material; break;
        case 'description': aValue = a.description; bValue = b.description; break;
        case 'stage': aValue = a.parentRecord.stageTitle; bValue = b.parentRecord.stageTitle; break;
        case 'sender': aValue = a.parentRecord.senderOrg; bValue = b.parentRecord.senderOrg; break;
        case 'recipient': aValue = a.parentRecord.recipientOrg; bValue = b.parentRecord.recipientOrg; break;
        case 'qty': aValue = a.quantity; bValue = b.quantity; break;
        case 'unitPrice': aValue = a.unitPriceETB; bValue = b.unitPriceETB; break;
        case 'totalVal': aValue = a.totalValuationETB; bValue = b.totalValuationETB; break;
        case 'date': aValue = a.parentRecord.dateSubmitted; bValue = b.parentRecord.dateSubmitted; break;
        default: return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allRequestTableItems, sortConfig]);

  const totalValuation = useMemo(() => filteredRecords.reduce((s, r) => s + r.totalValuationETB, 0), [filteredRecords]);
  const totalUnits = useMemo(() => filteredRecords.reduce((s, r) => s + r.totalQuantity, 0), [filteredRecords]);
  const totalFacilities = useMemo(() => filteredRecords.reduce((s, r) => s + r.targetedFacilitiesCount, 0), [filteredRecords]);

  const regionalFrequencyData = useMemo(() => {
    const freq: Record<string, number> = {};
    ALL_ETHIOPIAN_REGIONS.forEach(r => { freq[r] = 0; });
    
    records.forEach(r => {
      if (r.targetedRegions && r.targetedRegions.length > 0) {
        r.targetedRegions.forEach(reg => {
          if (freq[reg] !== undefined) {
            freq[reg]++;
          } else {
            const match = ALL_ETHIOPIAN_REGIONS.find(ar => ar.toLowerCase() === reg.toLowerCase());
            if (match) freq[match]++;
          }
        });
      }
    });
    
    return Object.entries(freq)
      .map(([region, count]) => ({ region, count }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [records, ALL_ETHIOPIAN_REGIONS]);

  // Stage 1 Specific Date Count & Action KPI Metrics
  const epssToMohRecords = useMemo(() => records.filter(r => r.stage === 'moh-to-epss'), [records]);
  const stage1PendingCount = useMemo(() => epssToMohRecords.filter(r => !r.actionTakenDate && r.status !== 'Endorsed & Approved').length, [epssToMohRecords]);
  const stage1OverdueCount = useMemo(() => {
    return epssToMohRecords.filter(r => {
      if (r.actionTakenDate || r.status === 'Endorsed & Approved') return false;
      return computeDateCount(r.dateSubmitted).days > 3;
    }).length;
  }, [epssToMohRecords]);

  const avgTurnaroundDays = useMemo(() => {
    const completed = epssToMohRecords.filter(r => r.actionTakenDate || r.turnaroundDays !== undefined || r.status === 'Endorsed & Approved');
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, r) => {
      const count = computeDateCount(r.dateSubmitted, r.actionTakenDate, r.status, r.actionTakenBy, r.actionType, r.turnaroundDays);
      return sum + count.days;
    }, 0);
    return Math.round((total / completed.length) * 10) / 10;
  }, [epssToMohRecords]);

  const handleExportCSV = () => {
    const data = filteredRecords.map((r, idx) => {
      const dateInfo = computeDateCount(r.dateSubmitted, r.actionTakenDate || r.approvedDate, r.status, r.actionTakenBy, r.actionType, r.turnaroundDays);
      return {
        '#': idx + 1,
        'DSP Reference': r.dspRefNumber,
        'Workflow Stage': r.stageTitle,
        'From (Sender)': r.senderOrg,
        'To (Recipient)': r.recipientOrg,
        'Official Letter Ref': r.officialLetterRef,
        'Status': r.status,
        'Submission Date': r.dateSubmitted,
        'Date Count / Turnaround': `${dateInfo.days} Days (${dateInfo.isActionTaken ? 'Action Taken' : 'Pending Action'})`,
        'Action Taken Date': r.actionTakenDate || r.approvedDate || 'Pending',
        'Action Taken By': r.actionTakenBy || 'N/A',
        'Action Decision': r.actionType || r.status,
        'Total Quantity': r.totalQuantity,
        'Valuation (ETB)': r.totalValuationETB,
        'Targeted Facilities': r.targetedFacilitiesCount,
        'Signatory': `${r.signatory} (${r.signatoryRole})`
      };
    });
    downloadCSV(`EPSS_DSP_Workflow_Ledger_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  return (
    <div className="space-y-4">
      {/* Top Workflow Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                DSP Management & Institutional Distribution Workflow
              </h2>
              <span className="text-[10px] font-bold text-amber-600 font-mono tracking-widest uppercase">
                • MOH ⇄ EPSS ⇄ RHB ⇄ Plants
              </span>
            </div>
            <p className="text-xs text-slate-500">
              End-to-end tracking of Distribution Suggestion Plans, official quota requests, regional breakdowns, and plant release orders
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentStage === 'moh-to-epss' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request DSP (EPSS to MOH)</span>
            </button>
          )}
          {currentStage === 'moh-to-rhb' && (
            <button
              onClick={() => setIsBreakdownModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Breakdown Request (MOH to Region)</span>
            </button>
          )}
          {currentStage === 'rhb-to-moh' && (
            <button
              onClick={() => setIsRegionBreakdownModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Region Breakdown (Region to MOH)</span>
            </button>
          )}
          {currentStage === 'epss-ho-aggregation' && (
            <button
              onClick={() => setStage5ViewMode('hub-aggregation')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <GitMerge className="w-3.5 h-3.5 text-emerald-200" />
              <span>Map HF to Hub (HF Master)</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>Export DSP Dossier</span>
          </button>
          <button
            onClick={() => setIsSavedDraftsManagerOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-amber-200 shadow-xs relative"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>Saved Drafts</span>
            {records.filter(r => (r.status as string) === 'Draft' || (r.status as string) === 'Saved Draft').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                {records.filter(r => (r.status as string) === 'Draft' || (r.status as string) === 'Saved Draft').length}
              </span>
            )}
          </button>
        </div>
      </div>
      <DSPRequestModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        items={multipleStockItems}
        hfListItems={hfListItems}
        onSubmit={(data) => {
            console.log('DSP Submitted:', data);
            setIsCreateModalOpen(false);
        }}
        onSuccess={(removedItems, metadata) => {
          // Remove selected items from inventory for EPSS to MOH request as requested
          if (setMultipleStockItems) {
            setMultipleStockItems(prev => prev.filter(item => 
              !removedItems.some(removed => removed.id === item.id)
            ));
          }

          // 2. Record what file i sent with date on my system (Workflow Record)
          const totalQty = removedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0);
          const totalVal = removedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0);
          const refNum = `EPSS/MD-DSP/2026/${Math.floor(100 + Math.random() * 900)}`;

          const newRecord: DspWorkflowRecord = {
            id: `dsp-${Date.now().toString().slice(-6)}`,
            dspRefNumber: refNum,
            stage: 'head-office-dsp',
            subStage: '1.1',
            stageTitle: '1.1 DSP Request to MOH',
            senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
            recipientOrg: metadata.recipient,
            subject: metadata.subject,
            status: 'Submitted & Pending',
            dateSubmitted: metadata.date,
            totalDevices: removedItems.length,
            totalQuantity: totalQty,
            totalValuationETB: totalVal,
            targetedRegions: [...new Set(removedItems.map(i => i.plant))].filter(Boolean) as string[],
            targetedFacilitiesCount: 0,
            officialLetterRef: `REF-${Date.now().toString().slice(-4)}`,
            signatory: 'Mosisa (Authorized User)',
            signatoryRole: 'Directorate Technical Lead',
            itemsIncluded: removedItems.map(i => ({
              material: i.material,
              description: i.materialDescription,
              quantity: i.unrestrictedStock,
              plant: i.plant
            })),
            notes: `Dossier transmitted via Gmail background dispatch. Files: ${metadata.excelName}, ${metadata.letterName}${metadata.zipName ? `, ${metadata.zipName}` : ''}`,
            excelFile: { name: metadata.excelName, blob: metadata.excelBlob },
            pdfFile: { name: metadata.letterName, blob: metadata.letterBlob },
            zipFile: metadata.zipName && metadata.zipBlob ? { name: metadata.zipName, blob: metadata.zipBlob } : undefined
          };

          setRecords(prev => {
            const updated = [newRecord, ...prev];
            return updated;
          });

          if (onTriggerCloudSync) {
            onTriggerCloudSync(
              `✓ DSP Request ${refNum} successfully transmitted and synced to cloud!`,
              {
                type: 'CREATE',
                title: `DSP Request ${refNum}`,
                payload: newRecord
              }
            );
          }

          // 3. Record to Document Archive
          if (onAddDocument) {
            const docRecord: DeviceDocument = {
              id: `SENT-${Date.now().toString().slice(-5)}`,
              referenceNumber: refNum,
              title: metadata.subject,
              deviceModel: removedItems.length > 1 ? `${removedItems[0].materialDescription} (+${removedItems.length - 1} items)` : removedItems[0]?.materialDescription || 'Medical Equipment Fleet',
              type: 'Official EPSS-MOH Dossier (Transmitted)',
              category: 'Official MoH Letters',
              manufacturer: 'EPSS HEAD OFFICE',
              senderFacility: 'EPSS Medical Equipment Directorate',
              recipientFacility: metadata.recipient,
              lastUpdated: metadata.date,
              issuedDate: metadata.date,
              driveLink: 'https://mail.google.com',
              status: 'Dispatched',
              officialSeal: true,
              notes: metadata.body,
              fileSize: 'Generated on Send',
              fileType: metadata.zipName ? 'PDF' : 'XLSX', // Mixed payload
              contentPreview: `DSP TRANSMISSION LOG\nDate: ${metadata.date}\nTo: ${metadata.recipient}\nSubject: ${metadata.subject}\n\nFILES SENT:\n1. ${metadata.excelName}\n2. ${metadata.letterName}${metadata.zipName ? `\n3. ${metadata.zipName}` : ''}\n\nSENT FROM: ${metadata.sender}`
            };
            onAddDocument(docRecord);
          }
        }}
      />
      <BreakdownRequestModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        items={multipleStockItems || []}
        epssToMohRecords={records.filter(r => r.stage === 'moh-to-epss')}
        onSaveDraft={(data) => {
          const refNum = `DRAFT-BRK-${Date.now().toString().slice(-6)}`;
          const draftRecord: DspWorkflowRecord = {
            id: `dsp-brk-${Date.now().toString().slice(-6)}`,
            dspRefNumber: refNum,
            stage: 'moh-to-rhb',
            stageTitle: '2. Breakdown Request MOH to Region',
            senderOrg: 'Ministry of Health (PMD Directorate)',
            recipientOrg: 'Regional Health Bureaus',
            subject: 'Draft: Regional Medical Equipment Breakdown Request',
            status: 'Draft',
            dateSubmitted: data.date,
            totalDevices: data.selectedDevices.length,
            totalQuantity: Object.values(data.regionRows).reduce((acc: number, row: any) => acc + Object.values(row.quantities).reduce((accQ: number, q: any) => accQ + (Number(q) || 0), 0), 0),
            totalValuationETB: 0,
            targetedRegions: Array.from(new Set(data.regionRows.map((r: any) => r.region as string))),
            targetedFacilitiesCount: data.regionRows.length,
            officialLetterRef: 'PENDING',
            signatory: 'Authorized User',
            signatoryRole: 'Technical Lead',
            itemsIncluded: data.selectedDevices.map((d: any) => ({
              material: d.material,
              description: d.materialDescription,
              quantity: 0,
              plant: d.plant
            })),
            notes: 'Draft breakdown request.',
            facilityMatrixData: {
              date: data.date,
              region: data.regionRows[0]?.region || 'All',
              columns: data.selectedDevices.map((d: any) => ({ id: d.id, name: d.materialDescription, code: d.material })),
              rows: data.regionRows
            }
          };
          setRecords(prev => {
            const updated = [...prev, draftRecord];
            return updated;
          });
          setActionFeedbackToast(`✓ Draft saved as ${refNum}!`);
          setTimeout(() => setActionFeedbackToast(null), 3000);
        }}
        onSubmit={(data) => {
          setIsBreakdownModalOpen(false);
          if (data) {
            const refNum = `MOH/PMD-BRK/2026/${Math.floor(100 + Math.random() * 900)}`;
            const newRecord: DspWorkflowRecord = {
              id: `dsp-brk-${Date.now().toString().slice(-6)}`,
              dspRefNumber: refNum,
              stage: 'moh-to-rhb',
              stageTitle: '2. Breakdown Request MOH to Region',
              senderOrg: 'Ministry of Health (PMD Directorate)',
              recipientOrg: (data.targetedRegions && data.targetedRegions.length > 0) ? `${data.targetedRegions.join(', ')} Regional Health Bureaus` : 'All Regional Health Bureaus',
              subject: data.subject || 'Medical Device Regional Breakdown & Allocation Quota Request',
              status: 'Submitted & Pending',
              dateSubmitted: data.date || new Date().toISOString().split('T')[0],
              totalDevices: data.itemsIncluded?.length || 1,
              totalQuantity: data.totalQuantity || 0,
              totalValuationETB: data.totalValuationETB || 0,
              targetedRegions: data.targetedRegions || [],
              targetedFacilitiesCount: data.targetedFacilitiesCount || 0,
              officialLetterRef: data.officialLetterRef || `MOH/LET/${Date.now().toString().slice(-4)}`,
              signatory: data.signatory || 'Dr. Dereje (MOH State Minister)',
              signatoryRole: 'State Minister of Health',
              itemsIncluded: data.itemsIncluded || [],
              notes: data.notes || 'Stage 2 Breakdown allocation dossier transmitted.',
              excelFile: data.excelFile,
              pdfFile: data.pdfFile,
              zipFile: data.zipFile
            };

            setRecords(prev => {
              const updated = [newRecord, ...prev];
              return updated;
            });

            if (onTriggerCloudSync) {
              onTriggerCloudSync(
                `✓ Stage 2 Breakdown Request ${refNum} transmitted and synced to cloud!`,
                {
                  type: 'CREATE',
                  title: `Breakdown Request ${refNum}`,
                  payload: newRecord
                }
              );
            }
          }
        }}
        onSuccess={(removedItems, metadata) => {
          setIsBreakdownModalOpen(false);
          if (metadata) {
            const refNum = `MOH/PMD-BRK/2026/${Math.floor(100 + Math.random() * 900)}`;
            const totalQty = removedItems.reduce((acc, i) => acc + (i.unrestrictedStock || 0), 0);
            const totalVal = removedItems.reduce((acc, i) => acc + (i.currentValueOfUnrestrictedStock || 0), 0);

            const newRecord: DspWorkflowRecord = {
              id: `dsp-brk-${Date.now().toString().slice(-6)}`,
              dspRefNumber: refNum,
              stage: 'moh-to-rhb',
              stageTitle: '2. Breakdown Request MOH to Region',
              senderOrg: 'Ministry of Health (PMD Directorate)',
              recipientOrg: metadata.recipient || 'Regional Health Bureaus',
              subject: metadata.subject || 'Medical Device Regional Breakdown & Allocation Quota Request',
              status: 'Submitted & Pending',
              dateSubmitted: metadata.date || new Date().toISOString().split('T')[0],
              totalDevices: removedItems.length,
              totalQuantity: totalQty,
              totalValuationETB: totalVal,
              targetedRegions: [...new Set(removedItems.map(i => i.plant))].filter(Boolean) as string[],
              targetedFacilitiesCount: 0,
              officialLetterRef: `MOH/LET/${Date.now().toString().slice(-4)}`,
              signatory: 'Dr. Dereje (MOH State Minister)',
              signatoryRole: 'State Minister of Health',
              itemsIncluded: removedItems.map(i => ({
                material: i.material,
                description: i.materialDescription,
                quantity: i.unrestrictedStock,
                plant: i.plant
              })),
              notes: `Stage 2 Breakdown dossier transmitted via ${metadata.recipient?.includes('@') ? 'Gmail' : 'WhatsApp'} background dispatch. Files: ${metadata.excelName}, ${metadata.letterName}${metadata.zipName ? `, ${metadata.zipName}` : ''}`,
              excelFile: metadata.excelBlob ? { name: metadata.excelName, blob: metadata.excelBlob } : undefined,
              pdfFile: metadata.letterBlob && metadata.letterName ? { name: metadata.letterName, blob: metadata.letterBlob } : undefined,
              zipFile: metadata.zipName && metadata.zipBlob ? { name: metadata.zipName, blob: metadata.zipBlob } : undefined
            };

            setRecords(prev => {
              const updated = [newRecord, ...prev];
              return updated;
            });

            if (onTriggerCloudSync) {
              onTriggerCloudSync(
                `✓ Stage 2 Breakdown Request ${refNum} transmitted and synced to cloud!`,
                {
                  type: 'CREATE',
                  title: `Breakdown Request ${refNum}`,
                  payload: newRecord
                }
              );
            }
          }
        }}
      />
      <RegionBreakdownModal
        isOpen={isRegionBreakdownModalOpen}
        onClose={() => setIsRegionBreakdownModalOpen(false)}
        hfListItems={hfListItems}
        onSubmit={(newRecord) => {
          setRecords(prev => {
            const updated = [newRecord, ...prev];
            return updated;
          });

          if (onTriggerCloudSync) {
            onTriggerCloudSync(
              `✓ Stage 3 Regional Breakdown ${newRecord.dspRefNumber} submitted and synced to cloud!`,
              {
                type: 'CREATE',
                title: `Regional Breakdown ${newRecord.dspRefNumber}`,
                payload: newRecord
              }
            );
          }
        }}
      />

      {/* 4-Section DSP Management Interactive Pipeline Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="text-[11px] font-bold text-slate-500 px-1 flex items-center justify-between">
          <span className="uppercase tracking-wider">DSP MANAGEMENT INSTITUTIONAL HIERARCHY</span>
          <span className="text-[10px] text-amber-600 font-medium italic">Click main section or sub-step to view and collect data</span>
        </div>

        {/* 4 Major Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {stagesList
            .filter(stg => currentStage === 'all' || stg.stageKey === currentStage)
            .map((stg) => {
            const isSelected = currentStage === stg.stageKey;
            return (
              <div
                key={stg.id}
                onClick={() => {
                  if (isSelected) {
                    onSelectSubTab?.('dsp-mgmt'); // Reset to all/default
                  } else {
                    onSelectSubTab?.(stg.id as any);
                  }
                }}
                className={`p-4 rounded-2xl text-left transition-all border-b-4 active:border-b-0 active:translate-y-[4px] cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-50 border-amber-500 shadow-[0_4px_0_rgb(245,158,11)] ring-2 ring-amber-500/10'
                    : 'bg-white border-slate-200 shadow-[0_4px_0_rgb(226,232,240)] hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${stg.color}`} />
                  {isSelected && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      ACTIVE STAGE
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {stg.count} Dossiers
                  </span>
                </div>
                <div className={`text-sm font-black leading-snug ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
                  {stg.label}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  {stg.subSteps.length} Sub-Steps
                </div>
                {isSelected && (
                  <div className="absolute top-0 right-0 p-2 text-amber-600 font-bold text-[10px]">
                    Click to show all
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sub-Steps Selector Pills Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2 ml-1">SUB-STEPS:</span>
          {stagesList
            .filter(stg => currentStage === 'all' || currentStage === stg.stageKey)
            .flatMap(stg => stg.subSteps)
            .map((sub) => {
              const isSubSelected = currentSubStep === sub.id;
              const programHpStockCount = (multipleStockItems || []).filter(isProgramHpStockItem).length || 5;
              
              let subCount = records.filter(r => canonicalizeSubStage(r.subStage, r.stage) === sub.id).length;
              if (sub.id === '1.1') {
                subCount = programHpStockCount;
              } else if (sub.id === '1.2') {
                try {
                  const stored = null;
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) subCount = parsed.length;
                  }
                } catch {}
                const r12 = records.find(r => canonicalizeSubStage(r.subStage, r.stage) === '1.2');
                if (r12 && r12.itemsIncluded && r12.itemsIncluded.length > 0 && !r12.id.includes('sample')) {
                  subCount = r12.itemsIncluded.length;
                }
              } else if (sub.id === '2.2') {
                try {
                  const stored = null;
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) subCount = parsed.length;
                  }
                } catch {}
              }

              return (
                <button
                  key={sub.id}
                  onClick={() => onSelectSubTab?.(sub.subTab)}
                  className={`group relative px-4 py-1.5 rounded-full text-xs font-black transition-all duration-200 cursor-pointer flex items-center gap-2 border-b-4 active:border-b-0 active:translate-y-[4px] ${
                    isSubSelected
                      ? 'bg-[#0B1527] text-white border-[#050B15] shadow-[0_4px_0_rgb(5,11,21)]'
                      : 'bg-[#EBF1F6] text-[#1E3A5F] hover:bg-[#DEE7EF] border-[#D5E1EC] shadow-[0_4px_0_rgb(213,225,236)] hover:border-[#CAD6E2]'
                  }`}
                  title={sub.label}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isSubSelected ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-[#8292A2]'}`} />
                  <span className="tracking-tight uppercase">{sub.label}</span>
                  {subCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${isSubSelected ? 'bg-amber-400 text-slate-900' : 'bg-[#D5E1EC] text-[#1E3A5F]'}`}>
                      {subCount}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>





      {/* KPI Cards for Current Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total DSP Dossiers</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{filteredRecords.length} Documents</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Active in Current Stage</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Allocated Medical Devices</div>
            <div className="text-xl font-black text-cyan-600 mt-0.5 font-mono">{totalUnits.toLocaleString()} Units</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Physical Devices Earmarked</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Distribution Valuation</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5 font-mono">{formatCurrency(totalValuation)}</div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5 font-medium">Program & Capital Value</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {currentStage === 'moh-to-epss' ? (
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">MOH Action & Turnaround Tracker</div>
              <div className="text-xl font-black text-amber-600 mt-0.5 font-mono">
                {stage1PendingCount} Pending Action
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                <span className={stage1OverdueCount > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-medium"}>
                  {stage1OverdueCount > 0 ? `• ${stage1OverdueCount} Overdue (>3d)` : `• All within SLA`}
                </span>
                <span>| Avg {avgTurnaroundDays}d turnaround</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Recipient Health Facilities</div>
              <div className="text-xl font-black text-purple-600 mt-0.5 font-mono">{totalFacilities} Centers</div>
              <div className="text-[10px] text-purple-600/80 mt-0.5 font-medium">Hospitals & Health Centers</div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
              <Hospital className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Action Notification Banner */}
      {actionFeedbackToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionFeedbackToast}</span>
          </div>
          <button
            onClick={() => setActionFeedbackToast(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Region Multi-Select Filter Bar */}
      {currentStage === 'moh-to-rhb' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Ethiopian Regions Dynamic Filter ({selectedRegionsFilter.length}/{ALL_ETHIOPIAN_REGIONS.length} Selected)
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={handleSelectAllRegions}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-amber-700 font-bold transition cursor-pointer border border-slate-200"
              >
                Select All (15 Regions)
              </button>
              <button
                onClick={handleClearAllRegions}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition cursor-pointer border border-slate-200"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {ALL_ETHIOPIAN_REGIONS.map((reg) => {
              const isSelected = selectedRegionsFilter.some(r => r.toLowerCase() === reg.toLowerCase());
              return (
                <button
                  key={reg}
                  onClick={() => handleToggleRegion(reg)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span>{reg}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage 3 Format Switcher */}
      {(currentStage === 'rhb-to-moh' || currentStage === 'rhb-breakdown-management' || currentSubStep === '3.2' || currentSubTab === 'dsp-rhb-3-2') && (
        <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-800">Stage 3 Display Format:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setStage3ViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage3ViewMode === 'matrix'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Facility Breakdown Matrix (Official Format)</span>
              </button>
              <button
                onClick={() => setStage3ViewMode('ledger')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage3ViewMode === 'ledger'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossiers Ledger</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
            Two-tier Header: Region / Zone / Woreda / Name of health facility / List of Packeges / Equipment
          </div>
        </div>
      )}

      {/* Stage 4 Format Switcher */}
      {currentStage === 'moh-to-epss-ho' && (
        <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-800">Stage 4 Display Format:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setStage4ViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage4ViewMode === 'matrix'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Facility Breakdown Matrix (Official Format)</span>
              </button>
              <button
                onClick={() => setStage4ViewMode('ledger')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage4ViewMode === 'ledger'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossiers Ledger</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
            Two-tier Header: Region / Zone / Woreda / Name of health facility / List of Packeges / Equipment
          </div>
        </div>
      )}

      {/* Stage 5 Format Switcher */}
      {currentStage === 'epss-ho-aggregation' && (
        <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-800">Stage 5 Display Format:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setStage5ViewMode('hub-aggregation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage5ViewMode === 'hub-aggregation'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Map HF to Hub based on HF Master data</span>
              </button>
              <button
                onClick={() => setStage5ViewMode('ledger')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  stage5ViewMode === 'ledger'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossiers Ledger</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Master Data Mapping: Delivering Plant (EPSS Hub) Assignment</span>
          </div>
        </div>
      )}

      {/* Render Facility Breakdown Matrix directly when in Stage 3 and matrix mode */}
      {(currentStage === 'rhb-to-moh' || currentStage === 'rhb-breakdown-management' || currentSubStep === '3.2' || currentSubTab === 'dsp-rhb-3-2') && stage3ViewMode === 'matrix' ? (
        <RegionBreakdownMatrixTable
          data={
            selectedRecord?.facilityMatrixData ||
            records.find(r => (r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management') && r.facilityMatrixData)?.facilityMatrixData || {
              date: '2026-10-27',
              region: 'Oromia',
              columns: DEFAULT_STAGE_3_COLUMNS,
              rows: DEFAULT_STAGE_3_ROWS
            }
          }
          hfListItems={hfListItems}
          isEditable={true}
          breakdownRequests={records}
          selectedBreakdownRequestId={selectedRecord?.id || records.find(r => r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management')?.id || ''}
          onSelectBreakdownRequest={(reqId) => {
            const req = records.find(r => r.id === reqId);
            if (req) {
              setSelectedRecord(req);
            }
          }}
          onOpenUploadModal={() => setIsRegionBreakdownModalOpen(true)}
          onUpdateData={(updated) => {
            setRecords(prev => {
              const targetId = selectedRecord?.id || prev.find(r => r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management')?.id;
              const existingIdx = targetId ? prev.findIndex(r => r.id === targetId) : prev.findIndex(r => r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management');
              if (existingIdx >= 0) {
                const updatedRec = {
                  ...prev[existingIdx],
                  facilityMatrixData: updated,
                  targetedFacilitiesCount: updated.rows.length,
                  totalQuantity: updated.rows.reduce((sum, r) => {
                    return sum + updated.columns.reduce((csum, c) => csum + (Number(r.quantities[c.id]) || 0), 0);
                  }, 0)
                };
                const copy = [...prev];
                copy[existingIdx] = updatedRec;
                return copy;
              }
              return prev;
            });
          }}
          title="3. DSP Submitted Region to MOH - Health Facility Breakdown Matrix"
          subtitle="Official two-tier template showing medical device allocations per health facility across zones and woredas"
        />
      ) : (currentStage === 'rhb-to-moh' || currentStage === 'rhb-breakdown-management' || currentSubStep === '3.2' || currentSubTab === 'dsp-rhb-3-2') && stage3ViewMode === 'ledger' ? (
        <RegionalSubmittedDataView records={records} />
      )
 : currentStage === 'moh-to-epss-ho' && stage4ViewMode === 'matrix' ? (
        <Stage4MohSubmittedMatrixTable
          data={
            selectedRecord?.stage4MatrixData ||
            records.find(r => r.stage === 'moh-to-epss-ho' && r.stage4MatrixData)?.stage4MatrixData || {
              date: '2026-10-28',
              region: 'Oromia',
              columns: DEFAULT_STAGE_4_COLUMNS,
              rows: DEFAULT_STAGE_4_ROWS
            }
          }
          hfListItems={hfListItems}
          isEditable={true}
          dossiers={records.filter(r => r.stage === 'moh-to-epss-ho')}
          selectedDossierId={selectedRecord?.id || records.find(r => r.stage === 'moh-to-epss-ho')?.id || ''}
          onSelectDossier={(dId) => {
            const req = records.find(r => r.id === dId);
            if (req) {
              setSelectedRecord(req);
            }
          }}
          onUpdateData={(updated) => {
            setRecords(prev => {
              const targetId = selectedRecord?.id || prev.find(r => r.stage === 'moh-to-epss-ho')?.id;
              const existingIdx = targetId ? prev.findIndex(r => r.id === targetId) : prev.findIndex(r => r.stage === 'moh-to-epss-ho');
              if (existingIdx >= 0) {
                const updatedRec = {
                  ...prev[existingIdx],
                  stage4MatrixData: updated,
                  targetedFacilitiesCount: updated.rows.length,
                  totalQuantity: updated.rows.reduce((sum, r) => {
                    return sum + updated.columns.reduce((csum, c) => csum + (Number(r.quantities[c.id]) || 0), 0);
                  }, 0)
                };
                const copy = [...prev];
                copy[existingIdx] = updatedRec;
                return copy;
              }
              return prev;
            });
          }}
          title="4. DSP Submitted MOH to EPSS - Health Facility Breakdown Matrix"
          subtitle="Official breakdown format submitted by MOH PMD to EPSS with two-tier equipment headers"
        />
      ) : (currentSubStep === '1.1' || (currentSubTab as string) === 'dsp-ho-1-1' || (currentSubTab as string) === 'dsp-request-moh-epss') ? (
        <DspRequestMohTemplateView
          multipleStockItems={multipleStockItems}
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
          onOpenDspRequestModal={() => setIsCreateModalOpen(true)}
          onSelectSubTab={onSelectSubTab}
        />
      ) : (currentSubStep === '1.2' || currentSubTab === 'dsp-ho-1-2') ? (
        <DspReceivedFromMohView
          records={records}
          setRecords={setRecords}
          multipleStockItems={multipleStockItems}
          subStageTarget="1.2"
          onSelectSubTab={onSelectSubTab}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '1.3.1' || (currentSubTab as string) === 'dsp-ho-1-3-1' || (currentSubTab as string) === 'map-hf-hub') ? (
        <MappingBreakdownView 
          hfListItems={hfListItems} 
          onUploadHFData={(items, mode) => {
            if (mode === 'replace') {
              setHfListItems?.(items);
            } else {
              setHfListItems?.(prev => [...prev, ...items]);
            }
          }}
          isAdmin={true}
        />
      ) : (currentSubStep === '1.3.2' || (currentSubTab as string) === 'dsp-ho-1-3-2' || (currentSubTab as string) === 'send-dsp-hub') ? (
        <Stage6EpssBranchDispatchView
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '1.3.3' || (currentSubTab as string) === 'dsp-ho-1-3-3' || (currentSubTab as string) === 'item-aggregation' || (currentStage === 'epss-ho-aggregation' && stage5ViewMode === 'hub-aggregation')) ? (
        <Stage5EpssHoAggregationView
          initialTab="aggregated-matrix"
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          setHfListItems={setHfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '1.3.4' || (currentSubTab as string) === 'dsp-ho-1-3-4' || (currentSubTab as string) === 'order-process') ? (
        <Stage5EpssHoAggregationView
          initialTab="order-process"
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          setHfListItems={setHfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentStage === 'epss-ho-aggregation' && stage5ViewMode === 'hub-aggregation') ? (
        <Stage5EpssHoAggregationView
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          setHfListItems={setHfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentStage === 'epss-to-branch') ? (
        <Stage6EpssBranchDispatchView
          records={records}
          setRecords={setRecords}
          hfListItems={hfListItems}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '2.1' || currentSubTab === 'dsp-moh-2-1') ? (
        <DspReceivedFromMohView
          records={records}
          setRecords={setRecords}
          multipleStockItems={multipleStockItems}
          subStageTarget="2.1"
          onSelectSubTab={onSelectSubTab}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '2.2' || currentSubTab === 'dsp-moh-2-2' || currentSubTab === 'dsp-breakdown-moh-rhb') ? (
        <DspBreakdownMohToRhbView
          records={records}
          setRecords={setRecords}
          multipleStockItems={multipleStockItems}
          initialColumns={dsp22Columns}
          initialRows={dsp22Rows}
          dspReceivedEpssRows={
            records.find(r => canonicalizeSubStage(r.subStage, r.stage) === '2.1')?.itemsIncluded || []
          }
          dspReceivedMohRows={
            records.find(r => canonicalizeSubStage(r.subStage, r.stage) === '1.2')?.itemsIncluded || []
          }
          onSelectSubTab={onSelectSubTab}
          onTriggerCloudSync={onTriggerCloudSync}
        />
      ) : (currentSubStep === '2.3' || currentSubTab === 'dsp-moh-2-3') ? (
        <RegionalSubmittedDataView records={records} />
      ) : (currentSubStep === '2.4' || currentSubTab === 'dsp-moh-2-4' || currentSubTab === 'regional-aggregator') ? (
        <RegionBreakdownMatrixTable
          data={
            selectedRecord?.facilityMatrixData ||
            records.find(r => r.facilityMatrixData)?.facilityMatrixData || {
              date: new Date().toISOString().split('T')[0],
              region: 'all',
              columns: DEFAULT_STAGE_3_COLUMNS,
              rows: DEFAULT_STAGE_3_ROWS
            }
          }
          hfListItems={hfListItems}
          isEditable={true}
          breakdownRequests={records}
          selectedBreakdownRequestId={selectedRecord?.id || records.find(r => r.facilityMatrixData)?.id || ''}
          onSelectBreakdownRequest={(reqId) => {
            const req = records.find(r => r.id === reqId);
            if (req) {
              setSelectedRecord(req);
            }
          }}
          onOpenUploadModal={() => setIsRegionBreakdownModalOpen(true)}
          onUpdateData={(updated) => {
            setRecords(prev => {
              const targetId = selectedRecord?.id || prev.find(r => r.facilityMatrixData)?.id;
              const existingIdx = targetId ? prev.findIndex(r => r.id === targetId) : 0;
              if (existingIdx >= 0 && prev[existingIdx]) {
                const updatedRec = {
                  ...prev[existingIdx],
                  facilityMatrixData: updated,
                  targetedFacilitiesCount: updated.rows.length,
                  totalQuantity: updated.rows.reduce((sum, r) => {
                    return sum + updated.columns.reduce((csum, c) => csum + (Number(r.quantities[c.id]) || 0), 0);
                  }, 0)
                };
                const copy = [...prev];
                copy[existingIdx] = updatedRec;
                return copy;
              }
              return prev;
            });
          }}
          title="2.4 Breakdown Aggregation by hub - Multi-Regional Matrix"
          subtitle="Official two-tier matrix aggregating health facility breakdowns across all Ethiopian regions submitted to MOH"
        />
      ) : (currentSubStep === '2.5' || currentSubTab === 'dsp-moh-2-5' || currentSubTab === 'dsp-submitted-moh-epss-ho') ? (
        <Stage4MohSubmittedMatrixTable
          data={
            selectedRecord?.stage4MatrixData ||
            records.find(r => r.stage4MatrixData)?.stage4MatrixData || {
              date: new Date().toISOString().split('T')[0],
              region: 'Oromia',
              columns: DEFAULT_STAGE_4_COLUMNS,
              rows: DEFAULT_STAGE_4_ROWS
            }
          }
          hfListItems={hfListItems}
          isEditable={true}
          dossiers={records}
          selectedDossierId={selectedRecord?.id || records.find(r => r.stage4MatrixData)?.id || ''}
          onSelectDossier={(dId) => {
            const req = records.find(r => r.id === dId);
            if (req) {
              setSelectedRecord(req);
            }
          }}
          onUpdateData={(updated) => {
            setRecords(prev => {
              const targetId = selectedRecord?.id || prev.find(r => r.stage4MatrixData)?.id;
              const existingIdx = targetId ? prev.findIndex(r => r.id === targetId) : 0;
              if (existingIdx >= 0 && prev[existingIdx]) {
                const updatedRec = {
                  ...prev[existingIdx],
                  stage4MatrixData: updated,
                  targetedFacilitiesCount: updated.rows.length,
                  totalQuantity: updated.rows.reduce((sum, r) => {
                    return sum + updated.columns.reduce((csum, c) => csum + (Number(r.quantities[c.id]) || 0), 0);
                  }, 0)
                };
                const copy = [...prev];
                copy[existingIdx] = updatedRec;
                return copy;
              }
              return prev;
            });
          }}
          title="2.5 DSP Aggr. Submitted to EPSS - Health Facility Matrix"
          subtitle="Official two-tier equipment allocation matrix submitted by MOH PMD to EPSS Head Office"
        />
      ) : (
        <>




          {/* Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search material, description, DSP ref, letter number, organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Aging & Date Count SLA Filter */}
              <select
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value="all">All Date Counts & Aging</option>
                <option value="pending">⏳ Awaiting Action (Active Count)</option>
                <option value="overdue">⚠️ Action Overdue (&gt;3 Days)</option>
                <option value="completed">✓ Action Completed (Turnaround)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value="all">All Approval Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted & Pending">Submitted & Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Endorsed & Approved">Endorsed & Approved</option>
                <option value="Dispatched to Plants">Dispatched to Plants</option>
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value="all">All Workflow Stages</option>
                {stagesList.map(s => (
                  <option key={s.id} value={s.stageKey}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

      {/* Mechanism 1: Request Items & Order Process Master Table */}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider whitespace-nowrap">
                  {summaryViewMode === 'itemized' 
                    ? `Itemized Matrix: ${currentStage === 'all' ? 'Unified Tracker' : stagesList.find(s => s.stageKey === currentStage)?.label} (${allRequestTableItems.length} Material Rows)`
                    : `Summary: ${currentStage === 'all' ? 'All Workflow Dossiers' : stagesList.find(s => s.stageKey === currentStage)?.label} (${filteredRecords.length} Documents)`
                  }
                </span>
              </div>

              {/* Template Toggle - Based on user screenshot requirements */}
              <div className="flex items-center gap-1.5 bg-slate-200/50 p-0.5 rounded-lg border border-slate-300/60 shadow-xs">
                <button 
                  onClick={() => setSummaryViewMode('dossier')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    summaryViewMode === 'dossier' 
                      ? 'bg-white text-amber-700 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  SUMMARY TEMPLATE
                </button>
                <button 
                  onClick={() => setSummaryViewMode('itemized')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    summaryViewMode === 'itemized' 
                      ? 'bg-white text-amber-700 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  ITEMIZED MATRIX
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (summaryViewMode === 'itemized') {
                    const csv = sortedRequestTableItems.map((item, idx) => ({
                      'S/N': idx + 1,
                      'MATERIAL CODE': item.material,
                      'ITEM DESCRIPTION': item.description,
                      'HIERARCHY STAGE': item.parentRecord.stageTitle,
                      'SENDER': item.parentRecord.senderOrg,
                      'RECIPIENT': item.parentRecord.recipientOrg,
                      'QTY REQUESTED': item.quantity,
                      'UNIT VAL (ETB)': item.unitPriceETB,
                      'TOTAL VAL (ETB)': item.totalValuationETB,
                      'REQUESTED DATE': item.parentRecord.dateSubmitted,
                      'STATUS': item.parentRecord.status
                    }));
                    downloadCSV(`request-items-matrix-${Date.now()}.csv`, csv);
                  } else {
                    const csv = filteredRecords.map((r, idx) => ({
                      'S/N': idx + 1,
                      'Date': r.dateSubmitted,
                      'DSP Name': r.subject,
                      'Authorized person': r.signatory,
                      'Status': r.status,
                      'Reference': r.dspRefNumber
                    }));
                    downloadCSV(`dossier-summary-${Date.now()}.csv`, csv);
                  }
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export {summaryViewMode === 'itemized' ? 'Matrix' : 'Summary'} CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {summaryViewMode === 'itemized' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 text-center">S/N</th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('material')}>
                      <div className="flex items-center">
                        MATERIAL CODE
                        {renderSortIcon('material')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('description')}>
                      <div className="flex items-center">
                        ITEM DESCRIPTION
                        {renderSortIcon('description')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('stage')}>
                      <div className="flex items-center">
                        HIERARCHY STAGE
                        {renderSortIcon('stage')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('sender')}>
                      <div className="flex items-center">
                        SENDER
                        {renderSortIcon('sender')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('recipient')}>
                      <div className="flex items-center">
                        RECIPIENT
                        {renderSortIcon('recipient')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('qty')}>
                      <div className="flex items-center justify-end">
                        QTY REQUESTED
                        {renderSortIcon('qty')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('unitPrice')}>
                      <div className="flex items-center justify-end">
                        UNIT VAL (ETB)
                        {renderSortIcon('unitPrice')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('totalVal')}>
                      <div className="flex items-center justify-end">
                        TOTAL VAL (ETB)
                        {renderSortIcon('totalVal')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => requestSort('date')}>
                      <div className="flex items-center justify-center">
                        REQUESTED DATE
                        {renderSortIcon('date')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {sortedRequestTableItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Archive className="w-8 h-8 text-slate-200" />
                          <p className="text-slate-400 font-medium">No request table items found in this selection.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRequestTableItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.material}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-[10px]">
                            {item.parentRecord.stageTitle}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-semibold text-slate-800">
                          {item.parentRecord.senderOrg}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-semibold text-slate-800">
                          {item.parentRecord.recipientOrg}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-cyan-700">
                          {formatNumber(item.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-600">
                          {formatCurrency(item.unitPriceETB)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                          {formatCurrency(item.totalValuationETB)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 font-bold">
                          {item.parentRecord.dateSubmitted}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(item.parentRecord)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                          >
                            View Table
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* User-Requested Summary Template (Image 2) */
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-tight select-none">
                    <th className="py-3 px-4 border-r border-slate-200 w-12 text-center">S/N</th>
                    <th className="py-3 px-4 border-r border-slate-200 w-32">Date</th>
                    <th className="py-3 px-4 border-r border-slate-200">DSP Name</th>
                    <th className="py-3 px-4 border-r border-slate-200">Authorized person</th>
                    <th className="py-3 px-4 border-r border-slate-200 text-center w-28">Status</th>
                    <th className="py-3 px-4 text-center w-24">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center bg-slate-50/30">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-8 h-8 text-slate-200" />
                          <p className="text-slate-400 font-medium italic">No dossiers match the current filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => (
                      <tr key={rec.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="py-3 px-4 border-r border-slate-100 text-center font-mono text-slate-500 bg-slate-50/20">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 font-semibold text-slate-600">
                          {rec.dateSubmitted}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors text-xs font-mono">
                                {rec.dspRefNumber} — {rec.dspName || rec.subject} ({formatNumber(rec.totalQuantity || rec.itemsIncluded?.reduce((s, i) => s + (i.quantity || 0), 0) || 0)} Units)
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                              <UserCheck className="w-3 h-3 text-slate-500" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">{rec.signatory}</span>
                              <span className="text-[10px] text-slate-400 leading-tight">{rec.signatoryRole || 'Official Representative'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(rec)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider transition-all border border-amber-200 cursor-pointer shadow-2xs active:scale-95"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </>
      )}

      {/* Detailed DSP Dossier Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Dossier Details</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {selectedRecord.dspName || selectedRecord.subject.match(/DSP \[(.*?)\]/)?.[1] || selectedRecord.subject}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Official Letter Routing Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-tight">SUBMISSION DATE</span>
                  <span className="text-slate-700 font-medium">{selectedRecord.dateSubmitted}</span>
                </div>
              </div>
            </div>

            {/* Date Count & Action Turnaround Card */}
            {(() => {
              const dateInfo = computeDateCount(
                selectedRecord.dateSubmitted,
                selectedRecord.actionTakenDate || selectedRecord.approvedDate,
                selectedRecord.status,
                selectedRecord.actionTakenBy,
                selectedRecord.actionType,
                selectedRecord.turnaroundDays
              );
              return (
                <div className={`p-3.5 rounded-xl border ${dateInfo.badgeClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/90 rounded-xl shadow-2xs shrink-0 mt-0.5">
                      {dateInfo.isActionTaken ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider">
                          {dateInfo.isActionTaken ? 'MOH Action Completed & Turnaround Finalized' : 'Active Date Count Tracker (MOH/RHB to MOH)'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border border-current">
                          {dateInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-medium mt-1">
                        {dateInfo.isActionTaken ? (
                          <>
                            Action Decision: <span className="font-bold text-slate-900">{selectedRecord.actionType || 'Endorsed & Approved'}</span> on <span className="font-mono font-bold text-slate-900">{selectedRecord.actionTakenDate || selectedRecord.dateSubmitted}</span> by <span className="font-semibold text-slate-900">{selectedRecord.actionTakenBy || 'Authorized Officer'}</span>
                            {selectedRecord.actionNotes && (
                              <div className="text-[11px] text-slate-600 italic mt-0.5">
                                &ldquo;{selectedRecord.actionNotes}&rdquo;
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            Transmitted on <span className="font-bold font-mono">{selectedRecord.dateSubmitted}</span>. Date counter is actively running while awaiting MOH review & action.
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedRecord.stage === 'moh-to-epss' && (
                    <button
                      onClick={() => handleOpenActionModal(selectedRecord)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>{dateInfo.isActionTaken ? 'Update Action' : 'Take Action Now'}</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Device Allocation Breakdown: Professional Smart Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Exact Source Data — Medical Device Breakdown List</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                    {selectedRecord.itemsIncluded.length} Material Groups
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = selectedRecord.itemsIncluded.map((item, idx) => {
                        const qty = item.quantity || (item as any).qty || 0;
                        const unitVal = (item as any).unitPrice || (selectedRecord.totalQuantity ? selectedRecord.totalValuationETB / selectedRecord.totalQuantity : 0);
                        const totalVal = (item as any).totalAmount || (qty * unitVal);
                        return {
                          'S/N': idx + 1,
                          'Material Code': item.material,
                          'Item Description': item.description || (item as any).materialDescription || 'N/A',
                          'Qty Requested': qty,
                          'Unit Val (ETB)': unitVal,
                          'Total Val (ETB)': totalVal
                        };
                      });
                      downloadCSV(`dossier-${selectedRecord.dspRefNumber}-items.csv`, csv);
                    }}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-2.5 border-r border-slate-300 w-10 text-center">S/N</th>
                      <th className="p-2.5 border-r border-slate-300 min-w-[110px]">Material Code</th>
                      <th className="p-2.5 border-r border-slate-300 min-w-[200px]">Item Description</th>
                      <th className="p-2.5 border-r border-slate-300 text-right min-w-[100px]">Qty Requested</th>
                      <th className="p-2.5 border-r border-slate-300 text-right min-w-[110px]">Unit Val (ETB)</th>
                      <th className="p-2.5 border-r border-slate-300 text-right min-w-[120px]">Total Val (ETB)</th>
                      <th className="p-2.5 text-center w-14">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedRecord.itemsIncluded.map((item, idx) => {
                      const qty = item.quantity || (item as any).qty || 0;
                      const unitVal = (item as any).unitPrice || (selectedRecord.totalQuantity ? selectedRecord.totalValuationETB / selectedRecord.totalQuantity : 0);
                      const totalVal = (item as any).totalAmount || (qty * unitVal);
                      return (
                        <tr 
                          key={idx} 
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                            {item.material}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-slate-800 font-medium">
                            {item.description || (item as any).materialDescription || 'Medical Equipment'}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-black text-cyan-700">
                            {formatNumber(qty)}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-600">
                            {formatCurrency(unitVal)}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-black text-emerald-700">
                            {formatCurrency(totalVal)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromRecord(selectedRecord.id, idx)}
                              className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="Delete / Remove item from this dossier"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Regional Health Facility Breakdown Matrix (if present) */}
            {selectedRecord.facilityMatrixData && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <RegionBreakdownMatrixTable
                  data={selectedRecord.facilityMatrixData}
                  isEditable={false}
                  title="Official Regional Health Facility Breakdown"
                  subtitle="Two-tier equipment allocation matrix submitted by Regional Health Bureau to MOH"
                />
              </div>
            )}

            {/* Stage 4 MOH to EPSS Breakdown Matrix (if present) */}
            {selectedRecord.stage4MatrixData && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <Stage4MohSubmittedMatrixTable
                  data={selectedRecord.stage4MatrixData}
                  isEditable={false}
                  title="4. DSP Submitted MOH to EPSS - Health Facility Breakdown Matrix"
                  subtitle="Official two-tier equipment allocation matrix submitted by MOH PMD to EPSS"
                />
              </div>
            )}

            {/* Signatory Footnote */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">AUTHORIZED SIGNATORY</span>
                <span className="font-bold text-slate-900">{selectedRecord.signatory}</span>
                <span className="text-[10px] text-slate-500 block font-medium">{selectedRecord.signatoryRole}</span>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">STATUS & DURATION</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    selectedRecord.status === 'Endorsed & Approved' ? 'text-emerald-600' :
                    selectedRecord.status === 'Under Review' ? 'text-amber-600' : 'text-cyan-600'
                  }`}>
                    {selectedRecord.status}
                  </span>
                  {(() => {
                    const dateInfo = computeDateCount(
                      selectedRecord.dateSubmitted,
                      selectedRecord.actionTakenDate || selectedRecord.approvedDate,
                      selectedRecord.status,
                      selectedRecord.actionTakenBy,
                      selectedRecord.actionType,
                      selectedRecord.turnaroundDays
                    );
                    return (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${dateInfo.badgeClass}`}>
                        {dateInfo.isActionTaken ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{dateInfo.days}d to Action</span>
                          </>
                        ) : dateInfo.days > 5 ? (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-600 animate-pulse" />
                            <span>🚨 {dateInfo.days}d Overdue</span>
                          </>
                        ) : dateInfo.days > 2 ? (
                          <>
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>⚠️ {dateInfo.days}d at MOH</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-cyan-600" />
                            <span>{dateInfo.days}d Elapsed</span>
                          </>
                        )}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            {/* Transmitted Files Archive */}
            {(selectedRecord.excelFile || selectedRecord.pdfFile || selectedRecord.zipFile) && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <Archive size={12} className="text-amber-500" />
                  <span>Transmitted Files Archive</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedRecord.excelFile && (
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 border border-emerald-100">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 truncate">{selectedRecord.excelFile.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono font-medium">Excel Dataset</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={async () => {
                            const file = new File([selectedRecord.excelFile!.blob], selectedRecord.excelFile!.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                              try {
                                await navigator.share({ title: selectedRecord.excelFile!.name, files: [file] });
                              } catch (e) {}
                            } else if (navigator.share) {
                              try {
                                await navigator.share({ title: selectedRecord.excelFile!.name, text: `EPSS DSP Excel: ${selectedRecord.excelFile!.name}` });
                              } catch (e) {}
                            } else if (navigator.clipboard && (window as any).ClipboardItem) {
                              try {
                                const item = new (window as any).ClipboardItem({ [file.type]: file });
                                await navigator.clipboard.write([item]);
                                alert(`Copied ${file.name} to clipboard for pasting!`);
                              } catch (e) {
                                alert(`Ready: ${file.name}`);
                              }
                            }
                          }}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition shadow-sm"
                          title="Share Excel File via OS Native Share Sheet"
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            const url = URL.createObjectURL(selectedRecord.excelFile!.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = selectedRecord.excelFile!.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition shadow-sm"
                          title="Download Excel Backup"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedRecord.pdfFile && (
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0 border border-indigo-100">
                          <FileText size={16} />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 truncate">{selectedRecord.pdfFile.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono font-medium">Official PDF Letter</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={async () => {
                            const file = new File([selectedRecord.pdfFile!.blob], selectedRecord.pdfFile!.name, { type: 'application/pdf' });
                            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                              try {
                                await navigator.share({ title: selectedRecord.pdfFile!.name, files: [file] });
                              } catch (e) {}
                            } else if (navigator.share) {
                              try {
                                await navigator.share({ title: selectedRecord.pdfFile!.name, text: `EPSS DSP Letter: ${selectedRecord.pdfFile!.name}` });
                              } catch (e) {}
                            }
                          }}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition shadow-sm"
                          title="Share PDF Letter via OS Native Share Sheet"
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            const url = URL.createObjectURL(selectedRecord.pdfFile!.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = selectedRecord.pdfFile!.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition shadow-sm"
                          title="Download PDF Letter Backup"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedRecord.zipFile && (
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(selectedRecord.zipFile!.blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = selectedRecord.zipFile!.name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="w-full p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-3 hover:bg-purple-100 transition group cursor-pointer shadow-sm"
                  >
                    <div className="p-1.5 bg-white border border-purple-200 rounded-lg text-purple-600 group-hover:scale-110 transition-transform">
                      <Archive size={16} />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-[11px] font-bold text-purple-900 truncate">{selectedRecord.zipFile.name}</div>
                      <div className="text-[9px] text-purple-600 font-mono font-medium uppercase tracking-tighter">Batch Archived Bundle (Full Package)</div>
                    </div>
                    <Download size={14} className="ml-auto text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {selectedRecord.stage === 'moh-to-epss' && (
                <button
                  onClick={() => handleOpenActionModal(selectedRecord)}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{selectedRecord.actionTakenDate || selectedRecord.status === 'Endorsed & Approved' ? 'Update MOH Action' : 'Take Action on Request'}</span>
                </button>
              )}
              {selectedRecord.stage === 'moh-to-rhb' && (
                <>
                  <button
                    onClick={() => handleOpenBreakdownEmail(selectedRecord)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send via Email</span>
                  </button>
                  <button
                    onClick={() => handleOpenBreakdownWhatsApp(selectedRecord)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold transition cursor-pointer border border-slate-200 shadow-sm"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Take Action on DSP Request (EPSS to MOH) Modal */}
      {isActionModalOpen && actionTargetRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-md">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Take Action: DSP Request (EPSS to MOH)
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Submission Date: <span className="font-mono font-bold text-slate-700">{actionTargetRecord.dateSubmitted}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsActionModalOpen(false);
                  setActionTargetRecord(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Count & Aging Status Banner */}
            {(() => {
              const dateInfo = computeDateCount(
                actionTargetRecord.dateSubmitted,
                actionFormDate,
                actionTargetRecord.status,
                actionTargetRecord.actionTakenBy,
                actionTargetRecord.actionType,
                actionTargetRecord.turnaroundDays
              );
              return (
                <div className={`p-3.5 rounded-xl border ${dateInfo.badgeClass} flex items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/80 rounded-lg shadow-2xs">
                      {dateInfo.isActionTaken ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">
                        {dateInfo.isActionTaken ? 'Action Decision Finalized' : 'Active Date Count Tracker'}
                      </div>
                      <div className="text-sm font-black font-mono mt-0.5">
                        {dateInfo.label}
                      </div>
                      <div className="text-[11px] font-medium opacity-90">
                        {dateInfo.isActionTaken 
                          ? `Recording action on ${actionFormDate} sets turnaround to ${dateInfo.days} calendar days.`
                          : `Sent on ${actionTargetRecord.dateSubmitted} (${dateInfo.days} days elapsed awaiting MOH decision).`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Reminder Trigger */}
                  {!dateInfo.isActionTaken && (
                    <button
                      type="button"
                      onClick={() => {
                        const subject = `URGENT FOLLOW-UP: DSP Quota Request ${actionTargetRecord.dspRefNumber} (${dateInfo.days} Days Elapsed)`;
                        const body = `Dear MOH Directorate of Pharmaceuticals and Medical Devices,\n\nThis is an official follow-up reminder regarding DSP Allocation Request Ref: ${actionTargetRecord.dspRefNumber} (Official Letter: ${actionTargetRecord.officialLetterRef}), which was transmitted on ${actionTargetRecord.dateSubmitted}.\n\nIt has been ${dateInfo.days} days since transmittal and is currently awaiting your endorsement / action.\n\nSummary:\n- Allocated Units: ${actionTargetRecord.totalQuantity.toLocaleString()} Units\n- Valuation: ${formatCurrency(actionTargetRecord.totalValuationETB)}\n- Scope: ${actionTargetRecord.subject}\n\nPlease take action or endorse the allocation plan.\n\nThank you,\nEPSS Medical Equipment Directorate`;
                        const mailto = `mailto:${encodeURIComponent(actionTargetRecord.recipientOrg || 'moh@ethiopia.gov.et')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        window.open(mailto, '_blank');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer shrink-0"
                      title="Send official reminder with current elapsed days count"
                    >
                      <BellRing className="w-3 h-3 text-amber-600" />
                      <span>Send Reminder</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Allocation Overview */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">TOTAL UNITS</span>
                <span className="font-mono font-black text-cyan-700">{actionTargetRecord.totalQuantity.toLocaleString()} Units</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">VALUATION</span>
                <span className="font-mono font-black text-emerald-700">{formatCurrency(actionTargetRecord.totalValuationETB)}</span>
              </div>
            </div>

            {/* Action Form */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Select MOH Action Decision
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'Endorsed & Approved',
                      title: 'Endorse & Approve Quota',
                      desc: 'MOH officially endorses allocation quota as transmitted.',
                      icon: CheckCircle2,
                      color: 'text-emerald-600',
                      border: 'border-emerald-200',
                      bg: 'bg-emerald-50/50'
                    },
                    {
                      id: 'Proceed to Stage 2 Breakdown',
                      title: 'Endorse & Launch Breakdown',
                      desc: 'Approve & immediately transition into Stage 2 Regional Breakdown.',
                      icon: ArrowRight,
                      color: 'text-teal-600',
                      border: 'border-teal-200',
                      bg: 'bg-teal-50/50'
                    },
                    {
                      id: 'Under MOH Technical Review',
                      title: 'Mark Under Technical Review',
                      desc: 'MOH technical committee review is actively ongoing.',
                      icon: Clock,
                      color: 'text-amber-600',
                      border: 'border-amber-200',
                      bg: 'bg-amber-50/50'
                    },
                    {
                      id: 'Revision Requested',
                      title: 'Request Revision / Inquiry',
                      desc: 'Return to EPSS with technical comments or quantity inquiries.',
                      icon: AlertCircle,
                      color: 'text-rose-600',
                      border: 'border-rose-200',
                      bg: 'bg-rose-50/50'
                    }
                  ].map(act => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActionDecision(act.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        actionDecision === act.id
                          ? `${act.bg} ${act.border} ring-2 ring-indigo-500/20 shadow-xs`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <act.icon className={`w-4 h-4 shrink-0 mt-0.5 ${act.color}`} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">{act.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{act.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {actionDecision === 'Proceed to Stage 2 Breakdown' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Select Regions for Breakdown Request
                    </label>
                    <div className="flex gap-2">
                       <button 
                        type="button"
                        onClick={() => setActionFormRegions([...ALL_ETHIOPIAN_REGIONS])}
                        className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer"
                       >
                         Select All
                       </button>
                       <button 
                        type="button"
                        onClick={() => setActionFormRegions([])}
                        className="text-[9px] font-bold text-slate-500 hover:underline cursor-pointer"
                       >
                         Clear
                       </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                    {ALL_ETHIOPIAN_REGIONS.map(reg => (
                      <label key={reg} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/60 transition cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={actionFormRegions.includes(reg)}
                          onChange={(e) => {
                            if (e.target.checked) setActionFormRegions(prev => [...prev, reg]);
                            else setActionFormRegions(prev => prev.filter(r => r !== reg));
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className={`text-[11px] font-medium transition-colors ${actionFormRegions.includes(reg) ? 'text-indigo-900 font-bold' : 'text-slate-500'}`}>
                          {reg}
                        </span>
                      </label>
                    ))}
                  </div>
                  {actionFormRegions.length === 0 && (
                    <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                      <AlertCircle size={10} />
                      At least one region must be selected to proceed.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Action Date (Stops Active Date Count)
                  </label>
                  <input
                    type="date"
                    value={actionFormDate}
                    onChange={(e) => setActionFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                    Calculated Turnaround: {computeDateCount(actionTargetRecord.dateSubmitted, actionFormDate).days} calendar days
                  </span>
                </div>


              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Authorized Action Officer / Approver
                </label>
                <input
                  type="text"
                  value={actionFormOfficer}
                  onChange={(e) => setActionFormOfficer(e.target.value)}
                  placeholder="e.g. Dr. Bethlehem (MOH Pharmaceuticals & Medical Devices Director)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Action Decision Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={actionFormNotes}
                  onChange={(e) => setActionFormNotes(e.target.value)}
                  placeholder="Official decision remarks regarding quota approval, facility readiness, or regional allocation criteria..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsActionModalOpen(false);
                  setActionTargetRecord(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold border border-slate-200 cursor-pointer transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveAction}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Action & Record Turnaround</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick WhatsApp Dispatch Modal for Stage 2 Breakdown Request */}
      {quickWhatsAppModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">WhatsApp Regional Breakdown Dispatch</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {quickWhatsAppModal.record.targetedRegions.join(', ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickWhatsAppModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Recipient WhatsApp Phone Number
                </label>
                <input
                  type="text"
                  value={quickWhatsAppModal.phone}
                  onChange={(e) => setQuickWhatsAppModal({ ...quickWhatsAppModal, phone: e.target.value })}
                  placeholder="+251911234567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Formatted WhatsApp Message Body
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(quickWhatsAppModal.messageText);
                      setQuickWhatsAppModal({ ...quickWhatsAppModal, copied: true });
                      setTimeout(() => setQuickWhatsAppModal(prev => prev ? { ...prev, copied: false } : null), 2500);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-emerald-200"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{quickWhatsAppModal.copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={quickWhatsAppModal.messageText}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none resize-none shadow-inner leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickWhatsAppModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const waUrl = `https://wa.me/${quickWhatsAppModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(quickWhatsAppModal.messageText)}`;
                  window.open(waUrl, '_blank');
                  setActionFeedbackToast(`✓ Dispatched Breakdown Request ${quickWhatsAppModal.record.dspRefNumber} to WhatsApp!`);
                  setTimeout(() => setActionFeedbackToast(null), 3500);
                  setQuickWhatsAppModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Open in WhatsApp & Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectStageInfo && (
        <StageSourceDataModal
          isOpen={!!inspectStageInfo}
          onClose={() => setInspectStageInfo(null)}
          stageKey={inspectStageInfo.stageKey}
          stageTitle={inspectStageInfo.stageTitle}
          records={records}
        />
      )}

      <SavedDraftsManagerModal
        isOpen={isSavedDraftsManagerOpen}
        onClose={() => setIsSavedDraftsManagerOpen(false)}
        records={records}
        onUpdateRecord={(updatedRecord) => {
          setRecords(prev => {
            const updated = prev.map(r => r.id === updatedRecord.id ? updatedRecord : r);
            return updated;
          });
        }}
        onDeleteRecord={(id) => {
          setRecords(prev => {
            const updated = prev.filter(r => r.id !== id);
            return updated;
          });
        }}
        onSubmitDraft={(draftRecord) => {
          const submittedRecord = {
            ...draftRecord,
            status: 'Submitted & Pending' as const,
            dateSubmitted: new Date().toISOString().split('T')[0]
          };
          setRecords(prev => {
            const updated = [submittedRecord, ...prev.filter(r => r.id !== draftRecord.id)];
            return updated;
          });
        }}
      />
    </div>
  );
};
