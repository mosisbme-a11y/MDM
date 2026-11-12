import React, { useState, useMemo, useEffect } from 'react';
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
  ArrowUpDown,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2,
  FileText,
  X,
  Send,
  Mail,
  MessageCircle,
  ShieldCheck,
  Paperclip,
  ExternalLink,
  Eye,
  ArrowLeft,
  ChevronDown,
  Link2,
  AlertTriangle,
  Bell,
  Volume2,
  VolumeX,
  Map as MapIcon,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { HealthFacilityRecord, DspWorkflowRecord } from '../types';
import { pushCentralMasterData } from '../utils/centralSyncService';
import { getDossierDisplayInfo } from '../utils/dspDisplayUtils';
import { EPSS_HUBS_REGISTRY, mapFacilityToHub } from '../data/epssHubs';

export interface RegionBreakdownColumn {
  id: string;
  name: string; // e.g. "Anesthesia machine - with Patient mon"
  code: string; // e.g. "403-XRRD-0101"
}

export interface RegionBreakdownRow {
  id: string;
  region: string;
  zone: string;
  woreda: string;
  hub: string;
  healthFacility: string;
  customerDescription?: string;
  customerId?: string;
  packages: string;
  quantities: Record<string, number>;
}

export interface RegionBreakdownMatrixData {
  date: string;
  region: string;
  columns: RegionBreakdownColumn[];
  rows: RegionBreakdownRow[];
}

export const ALL_ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Central Ethiopia',
  'Dire Dawa',
  'Gambella',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'South Ethiopia',
  'Southern Ethiopia',
  'South West Ethiopia',
  'SNNPR',
  'Tigray'
];

export const DEFAULT_STAGE_3_COLUMNS: RegionBreakdownColumn[] = [
  { id: 'col-default-1', name: 'Anesthesia machine - with Patient mon', code: '403-XRRD-0101' },
  { id: 'col-default-2', name: 'Bed - Patient, Fowler, Adult', code: '403-XRRD-0101' },
  { id: 'col-default-3', name: 'Bowel - With Stand, Stainless Steel.', code: '403-XRRB-0101N' },
  { id: 'col-default-4', name: 'Cold box', code: '403-XRRD-0101-001' },
  { id: 'col-default-5', name: 'Couch - Delivery', code: '401-WICU-0101N' },
  { id: 'col-default-6', name: 'Couch - Examination', code: '401-WICU-0101N' }
];

export const DEFAULT_STAGE_3_ROWS: RegionBreakdownRow[] = [
  {
    id: 'row-default-1',
    region: 'Addis Ababa',
    zone: 'Addis Ketema',
    woreda: 'Woreda 01',
    healthFacility: 'Tikur Anbessa Specialized Hospital',
    customerDescription: 'Tikur Anbessa Specialized Hospital',
    packages: 'MCH',
    hub: 'AA01',
    quantities: { 'col-default-1': 2, 'col-default-2': 2, 'col-default-3': 2, 'col-default-4': 2, 'col-default-5': 2, 'col-default-6': 2 }
  },
  {
    id: 'row-default-2',
    region: 'Oromia',
    zone: 'East Shewa',
    woreda: 'Adama Town Woreda 01',
    healthFacility: 'Adama Hospital Medical College',
    customerDescription: 'Adama Hospital Medical College',
    customerId: '40002328',
    packages: 'MCH',
    hub: 'AD01',
    quantities: { 'col-default-1': 2, 'col-default-2': 2, 'col-default-3': 2, 'col-default-4': 2, 'col-default-5': 2, 'col-default-6': 2 }
  },
  {
    id: 'row-default-3',
    region: 'Dire Dawa',
    zone: 'Dire Dawa Administration',
    woreda: 'Woreda 01',
    healthFacility: 'Dire Dawa Dil Chora Hospital',
    customerDescription: 'Dire Dawa Dil Chora Hospital',
    customerId: '40002962',
    packages: 'MCH',
    hub: 'DD01',
    quantities: { 'col-default-1': 2, 'col-default-2': 2, 'col-default-3': 2, 'col-default-4': 2, 'col-default-5': 2, 'col-default-6': 2 }
  },
  {
    id: 'row-default-4',
    region: 'Oromia',
    zone: 'Addis ketema',
    woreda: '1',
    healthFacility: 'Abeshige Woreda Health Office',
    customerDescription: 'Abeshige Woreda Health Office',
    packages: 'MCH',
    hub: 'AD01',
    quantities: { 'col-default-1': 2, 'col-default-2': 2, 'col-default-3': 2, 'col-default-4': 2, 'col-default-5': 2, 'col-default-6': 2 }
  },
  {
    id: 'row-default-5',
    region: 'Oromia',
    zone: 'Addis ketema',
    woreda: '1',
    healthFacility: 'Addis Hiwot Health Center',
    customerDescription: 'Addis Hiwot Health Center',
    packages: 'OR',
    hub: 'AD01',
    quantities: { 'col-default-1': 2, 'col-default-2': 2, 'col-default-3': 2, 'col-default-4': 2, 'col-default-5': 2, 'col-default-6': 2 }
  }
];

export const MASTER_EQUIPMENT_CATALOG = [
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
];

export interface RhbSubmissionSummaryRow {
  sn: number;
  region: string;
  dspName: string;
  date: string;
  status?: string;
  totalFacilities?: number;
  totalUnits?: number;
}

export const ATTACHMENT_14_REGIONS_LIST: RhbSubmissionSummaryRow[] = [
  { sn: 1, region: 'Afar', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 6, totalUnits: 142 },
  { sn: 2, region: 'Amhara', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 18, totalUnits: 420 },
  { sn: 3, region: 'Benishangul-Gumuz', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 5, totalUnits: 98 },
  { sn: 4, region: 'Central Ethiopia', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 8, totalUnits: 186 },
  { sn: 5, region: 'Gambela', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 4, totalUnits: 76 },
  { sn: 6, region: 'Harari', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 4, totalUnits: 84 },
  { sn: 7, region: 'Oromia', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 24, totalUnits: 680 },
  { sn: 8, region: 'Sidama', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 7, totalUnits: 160 },
  { sn: 9, region: 'Somali', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 12, totalUnits: 290 },
  { sn: 10, region: 'South Ethiopia', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 9, totalUnits: 210 },
  { sn: 11, region: 'South West Ethiopia', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 6, totalUnits: 130 },
  { sn: 12, region: 'Tigray', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 14, totalUnits: 340 },
  { sn: 13, region: 'Addis Ababa', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 10, totalUnits: 250 },
  { sn: 14, region: 'Dire Dawa', dspName: 'MOH/RHB/2026/DSP-01', date: '2026-11-09', status: 'Submitted to MOH', totalFacilities: 3, totalUnits: 65 }
];

interface RegionBreakdownMatrixTableProps {
  data?: RegionBreakdownMatrixData;
  onUpdateData?: (updated: RegionBreakdownMatrixData) => void;
  isEditable?: boolean;
  onOpenUploadModal?: () => void;
  title?: string;
  subtitle?: string;
  hfListItems?: HealthFacilityRecord[];
  breakdownRequests?: any[];
  selectedBreakdownRequestId?: string;
  onSelectBreakdownRequest?: (requestId: string, requestRecord?: any) => void;
  disableBreakdownLink?: boolean;
  showHubColumn?: boolean;
}

export const RegionBreakdownMatrixTable: React.FC<RegionBreakdownMatrixTableProps> = ({
  data,
  onUpdateData,
  isEditable = false,
  onOpenUploadModal,
  title = 'Stage 3: Regional Health Facility Allocation Matrix',
  subtitle = 'Official Region to MOH PMD format showing equipment quantities allocated per health facility',
  hfListItems = [],
  breakdownRequests = [],
  selectedBreakdownRequestId = '',
  onSelectBreakdownRequest,
  disableBreakdownLink = false,
  showHubColumn = false
}) => {
  const [internalDate, setInternalDate] = useState<string>(data?.date || new Date().toISOString().split('T')[0]);
  const [columns, setColumns] = useState<RegionBreakdownColumn[]>(data?.columns || DEFAULT_STAGE_3_COLUMNS);
  const [rows, setRows] = useState<RegionBreakdownRow[]>(data?.rows || DEFAULT_STAGE_3_ROWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState('all');
  const [isEditingMode, setIsEditingMode] = useState(isEditable);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHubMapped, setIsHubMapped] = useState(showHubColumn);
  const [matrixTemplateFormat, setMatrixTemplateFormat] = useState<'item' | 'epss' | 'rhb' | 'dsp-received-from-moh' | 'moh-to-epss' | 'submit-breakdown-to-moh' | 'dsp-aggr-submitted-to-epss'>('dsp-aggr-submitted-to-epss');

  const handleSelectAllCatalogItems = () => {
    const newCols: RegionBreakdownColumn[] = MASTER_EQUIPMENT_CATALOG.map((item, idx) => ({
      id: `col-cat-${item.code}-${idx}`,
      name: item.name,
      code: item.code
    }));
    setColumns(newCols);

    const updatedRows = rows.map(r => {
      const q: Record<string, number> = {};
      newCols.forEach(col => {
        q[col.id] = r.quantities[col.id] || 2;
      });
      return { ...r, quantities: q };
    });
    setRows(updatedRows);
    notifyChange(internalDate, newCols, updatedRows);
    showToast(`✓ Selected All ${newCols.length} Master Catalog Equipment Items!`);
  };

  const handleDeselectAllCatalogItems = () => {
    setColumns([]);
    const updatedRows = rows.map(r => ({ ...r, quantities: {} }));
    setRows(updatedRows);
    notifyChange(internalDate, [], updatedRows);
    showToast(`Cleared all equipment columns.`);
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recentlyLoadedToken, setRecentlyLoadedToken] = useState<number>(0);

  // Action Modals State: Send TO MOH, Via Email, WhatsApp
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isSubmitDropdownOpen, setIsSubmitDropdownOpen] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleMapHfToHub = () => {
    if (rows.length === 0) {
      showToast('⚠️ No health facility rows to map.');
      return;
    }
    setIsAnalyzing(true);
    showToast('Mapping facilities to official EPSS regional distribution hubs...');
    setTimeout(() => {
      const updatedRows = rows.map(row => {
        const mapping = mapFacilityToHub(
          row.healthFacility || row.customerDescription || '',
          row.region || '',
          row.zone || '',
          row.woreda || '',
          hfListItems
        );
        const hubSymbol = (mapping.hubCode && mapping.hubCode !== 'HO01' && !mapping.hubCode.includes('HEAD'))
          ? mapping.hubCode
          : (row.hub && row.hub !== 'HO01' ? row.hub : 'AA01');
        return {
          ...row,
          hub: hubSymbol
        };
      });
      setRows(updatedRows);
      setIsHubMapped(true);
      notifyChange(internalDate, columns, updatedRows);
      showToast('✓ Successfully mapped facilities to EPSS Hubs! Hub column auto-inserted.');
      setIsAnalyzing(false);
    }, 600);
  };

  const [dspProjectName, setDspProjectName] = useState('Regional Health Facility Allocation Matrix');
  const [emailTo, setEmailTo] = useState('moh.pmd@moh.gov.et');
  const [emailCc, setEmailCc] = useState('epss.directorate@epss.gov.et');
  const [emailSubject, setEmailSubject] = useState(`Official Regional Health Facility Breakdown Matrix - ${internalDate}`);
  const [waPhone, setWaPhone] = useState('+251911234567');
  const [waCopied, setWaCopied] = useState(false);
  const [manualSignatoryName, setManualSignatoryName] = useState('');
  const [manualSignatoryRole, setManualSignatoryRole] = useState('');
  const [manualSignatoryOrg, setManualSignatoryOrg] = useState('Regional Health Bureau');
  const [transmittalDestination, setTransmittalDestination] = useState<'EPSS' | 'MOH'>('EPSS');

  const [selectedRequestId, setSelectedRequestId] = useState<string>(selectedBreakdownRequestId || '');


  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [isRequestModalFullScreen, setIsRequestModalFullScreen] = useState<boolean>(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState<boolean>(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newColumnCode, setNewColumnCode] = useState<string>('');
  const [batchQtyInputs, setBatchQtyInputs] = useState<Record<string, string>>({});

  // EPSS Base Benchmark & Alarm State
  const [itemBenchmarks, setItemBenchmarks] = useState<Record<string, number>>({
    'col-default-1': 10,
    'col-default-2': 10,
    'col-default-3': 10,
    'col-default-4': 10,
    'col-default-5': 10,
    'col-default-6': 10
  });
  const [audioAlarmEnabled, setAudioAlarmEnabled] = useState<boolean>(true);
  const [showBenchmarkPanel, setShowBenchmarkPanel] = useState<boolean>(false);

  // Audio Alarm Sound Synthesizer (dual alert chime)
  const triggerBenchmarkAlarmSound = () => {
    if (!audioAlarmEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15);

      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio synth fallback
    }
  };

  // Helper to get EPSS Base Benchmark limit for a column
  const getItemBenchmarkLimit = (col: RegionBreakdownColumn): number => {
    if (itemBenchmarks[col.id] !== undefined) return itemBenchmarks[col.id];
    if (itemBenchmarks[col.code] !== undefined) return itemBenchmarks[col.code];
    return 10; // Default EPSS Base Benchmark to send for MOH
  };

  const handleBatchApplyQtyToAllRows = (colId: string, customQty?: number) => {
    const valToApply = customQty !== undefined ? customQty : (Number(batchQtyInputs[colId]) || 0);
    const updated = rows.map(row => ({
      ...row,
      quantities: {
        ...row.quantities,
        [colId]: valToApply
      }
    }));
    setRows(updated);
    
    // Evaluate benchmark over-allocation
    const targetCol = columns.find(c => c.id === colId);
    if (targetCol) {
      const colBase = getItemBenchmarkLimit(targetCol);
      const newTotal = updated.reduce((sum, r) => sum + (Number(r.quantities[colId]) || 0), 0);
      if (newTotal > colBase) {
        triggerBenchmarkAlarmSound();
        showToast(`🚨 ALARM: "${targetCol.name}" total (${newTotal}) EXCEEDS EPSS Base (${colBase}) by +${newTotal - colBase} units!`);
      } else {
        showToast(`✓ Applied ${valToApply} units of "${targetCol.name}" across all ${rows.length} rows!`);
      }
    }
  };

  // RHB Summary Table (Attachment 1 Format: S/N | Region | DSP Name | Date | View)
  const [rhbSubViewMode, setRhbSubViewMode] = useState<'summary-table' | 'detailed-matrix'>('summary-table');
  const [rhbSummaryRows, setRhbSummaryRows] = useState<RhbSubmissionSummaryRow[]>(ATTACHMENT_14_REGIONS_LIST);
  const [selectedRhbDetailRegion, setSelectedRhbDetailRegion] = useState<RhbSubmissionSummaryRow | null>(null);


  const handleSelectItemOneByOne = (val: string) => {
    if (!val) return;
    const [code, name] = val.split(':::');
    const itemCode = code || '403-MAT-0101';
    const itemName = name || 'Medical Device Item';

    const exists = columns.some(c => c.code === itemCode || c.name.toLowerCase() === itemName.toLowerCase());
    if (exists) {
      showToast(`⚠️ "${itemName}" is already in selectable equipment columns.`);
      return;
    }

    const newCol: RegionBreakdownColumn = {
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
    notifyChange(internalDate, updatedCols, updatedRows);
    showToast(`✓ Selected "${itemName} (${itemCode})" & added as column!`);
  };



  const toggleItemOneByOne = (item: { name: string; code: string }) => {
    const existingCol = columns.find(c => c.code === item.code || c.name.toLowerCase() === item.name.toLowerCase());
    if (existingCol) {
      handleRemoveEquipmentColumn(existingCol.id);
    } else {
      handleSelectItemOneByOne(`${item.code}:::${item.name}`);
    }
  };

  useEffect(() => {
    if (selectedBreakdownRequestId) {
      setSelectedRequestId(selectedBreakdownRequestId);
      handleSelectBreakdownRequest(selectedBreakdownRequestId);
    }
  }, [selectedBreakdownRequestId]);

  const handleSelectBreakdownRequest = (reqId: string) => {
    setSelectedRequestId(reqId);
    if (!breakdownRequests) return;
    const matched = breakdownRequests.find(r => r.id === reqId);
    if (!matched) return;

    if (onSelectBreakdownRequest) {
      onSelectBreakdownRequest(reqId, matched);
    }

    if (matched.facilityMatrixData) {
      setInternalDate(matched.facilityMatrixData.date || internalDate);
      if (matched.facilityMatrixData.columns && matched.facilityMatrixData.columns.length > 0) {
        setColumns(matched.facilityMatrixData.columns);
      }
      if (matched.facilityMatrixData.rows && matched.facilityMatrixData.rows.length > 0) {
        setRows(matched.facilityMatrixData.rows);
      }
      setRecentlyLoadedToken(Date.now());
      showToast(`✨ Loaded exact source data from Request: ${matched.dspRefNumber || matched.subject}`);
      return;
    }

    if (matched.itemsIncluded && matched.itemsIncluded.length > 0) {
      const newCols: RegionBreakdownColumn[] = matched.itemsIncluded.map((item: any, idx: number) => ({
        id: `col-req-${idx}-${item.material}`,
        name: item.description,
        code: item.material
      }));
      setColumns(newCols);

      // SECURITY & BENCHMARK: Set EPSS Base Benchmark to EXACTLY what MOH sent for this region/total
      const newBenchmarks: Record<string, number> = {};
      newCols.forEach(col => {
        const item = matched.itemsIncluded.find((i: any) => i.material === col.code);
        newBenchmarks[col.id] = item?.quantity || 10;
        newBenchmarks[col.code] = item?.quantity || 10;
      });
      setItemBenchmarks(newBenchmarks);

      const reg = matched.targetedRegions?.[0] || matched.senderOrg || 'Oromia';
      const initialRows: RegionBreakdownRow[] = matched.itemsIncluded.map((item: any, idx: number) => {
        const qtyObj: Record<string, number> = {};
        newCols.forEach((c) => {
          qtyObj[c.id] = c.code === item.material ? item.quantity : 0;
        });

        return {
          id: `row-req-${idx}-${Date.now()}`,
          region: reg,
          zone: item.plant || 'Zone 1',
          woreda: '1',
          healthFacility: item.allocatedFacility || `${reg} Health Center ${idx + 1}`,
          customerDescription: item.allocatedFacility || `${reg} Health Center ${idx + 1}`,
          packages: 'MCH',
          quantities: qtyObj
        };
      });

      setRows(initialRows);
      setRecentlyLoadedToken(Date.now());
      notifyChange(internalDate, newCols, initialRows);
      showToast(`✨ Loaded exact source data from Request: ${matched.dspRefNumber}`);
    }
  };

  const handleAddEquipmentColumn = () => {
    if (!newColumnName.trim()) return;
    const colCode = newColumnCode.trim() || `40${columns.length + 1}-CODE`;
    const newCol: RegionBreakdownColumn = {
      id: `col-custom-${Date.now()}`,
      name: newColumnName.trim(),
      code: colCode
    };
    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);
    
    const updatedRows = rows.map(r => ({
      ...r,
      quantities: { ...r.quantities, [newCol.id]: 0 }
    }));
    setRows(updatedRows);
    notifyChange(internalDate, updatedCols, updatedRows);
    setNewColumnName('');
    setNewColumnCode('');
    setIsColumnPickerOpen(false);
    showToast(`✓ Added equipment column "${newCol.name}"`);
  };

  const handleRemoveEquipmentColumn = (colId: string) => {
    if (columns.length <= 1) {
      alert('Must keep at least 1 equipment column.');
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
    notifyChange(internalDate, updatedCols, updatedRows);
    showToast('✓ Removed equipment column');
  };

  const handleUpdateColumn = (colId: string, newName: string, newCode: string) => {
    const updated = columns.map(c => c.id === colId ? { ...c, name: newName, code: newCode } : c);
    setColumns(updated);
    notifyChange(internalDate, updated, rows);
  };

  // Sync external data changes
  React.useEffect(() => {
    if (data) {
      if (data.date) setInternalDate(data.date);
      if (data.columns && data.columns.length > 0) setColumns(data.columns);
      if (data.rows && data.rows.length > 0) setRows(data.rows);
    }
  }, [data]);

  const notifyChange = (newDate: string, newCols: RegionBreakdownColumn[], newRows: RegionBreakdownRow[]) => {
    if (onUpdateData) {
      onUpdateData({
        date: newDate,
        region: selectedRegionFilter !== 'all' ? selectedRegionFilter : (newRows[0]?.region || 'Oromia'),
        columns: newCols,
        rows: newRows
      });
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = 
        r.healthFacility.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.woreda.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.region.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRegion = selectedRegionFilter === 'all' || r.region.toLowerCase() === selectedRegionFilter.toLowerCase();
      const matchZone = selectedZone === 'all' || r.zone.toLowerCase() === selectedZone.toLowerCase();
      const matchPkg = selectedPackage === 'all' || r.packages.toLowerCase() === selectedPackage.toLowerCase();

      return matchSearch && matchRegion && matchZone && matchPkg;
    });
  }, [rows, searchQuery, selectedRegionFilter, selectedZone, selectedPackage]);

  // Effective Master HF list items (prop -> empty list)
  const masterHfItems = useMemo<HealthFacilityRecord[]>(() => {
    if (hfListItems && hfListItems.length > 0) return hfListItems;
    return [];
  }, [hfListItems]);

  // Robust region normalization and matcher (handles variations like "Oromia", "Oromiya", "Addis Ababa", etc.)
  const normalizeRegion = (r?: string) => (r || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const isRegionMatch = (regA?: string, regB?: string) => {
    if (!regA || !regB) return false;
    const cleanA = normalizeRegion(regA);
    const cleanB = normalizeRegion(regB);
    if (!cleanA || !cleanB) return false;
    if (cleanA === cleanB) return true;
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    return false;
  };

  // Unique Regions, Zones & Packages derived primarily from HF Master Data List
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    // Priority 1: Exact region names from HF Master Data List
    masterHfItems.forEach(h => {
      if (h.region && h.region.trim()) {
        set.add(h.region.trim());
      }
    });
    // Priority 2: Regions from current matrix rows
    rows.forEach(r => {
      if (r.region && r.region.trim()) {
        set.add(r.region.trim());
      }
    });
    // Priority 3: Fallback Ethiopian region list
    ALL_ETHIOPIAN_REGIONS.forEach(reg => set.add(reg));
    return Array.from(set).filter(Boolean).sort();
  }, [rows, masterHfItems]);

  const uniqueZones = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (selectedRegionFilter === 'all' || isRegionMatch(r.region, selectedRegionFilter)) {
        if (r.zone) set.add(r.zone);
      }
    });
    masterHfItems.forEach(h => {
      if (selectedRegionFilter === 'all' || isRegionMatch(h.region, selectedRegionFilter)) {
        if (h.zoneDescription) set.add(h.zoneDescription);
      }
    });
    return Array.from(set);
  }, [rows, masterHfItems, selectedRegionFilter]);

  const uniquePackages = useMemo(() => Array.from(new Set(rows.map(r => r.packages).filter(Boolean))), [rows]);

  // Facilities from HF Master List matching selected region
  const availableMasterFacilities = useMemo(() => {
    if (!masterHfItems || masterHfItems.length === 0) return [];
    if (selectedRegionFilter === 'all') return masterHfItems;
    return masterHfItems.filter(h => isRegionMatch(h.region, selectedRegionFilter));
  }, [masterHfItems, selectedRegionFilter]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      totals[col.id] = filteredRows.reduce((acc, row) => acc + (Number(row.quantities[col.id]) || 0), 0);
    });
    return totals;
  }, [columns, filteredRows]);

  const grandTotalUnits = useMemo(() => {
    return Object.values(columnTotals).reduce((sum, v) => sum + v, 0);
  }, [columnTotals]);

  // Evaluate over-allocation against EPSS Base Benchmark limits
  const overAllocatedColumns = useMemo(() => {
    const list: { col: RegionBreakdownColumn; total: number; base: number; excess: number }[] = [];
    columns.forEach(col => {
      const total = columnTotals[col.id] || 0;
      const base = getItemBenchmarkLimit(col);
      if (total > base) {
        list.push({ col, total, base, excess: total - base });
      }
    });
    return list;
  }, [columns, columnTotals, itemBenchmarks]);

  // Auto Rebalance / Trim handler to meet EPSS Base Benchmarks
  const handleAutoTrimToBaseBenchmark = () => {
    const updatedRows = rows.map(r => {
      const newQ = { ...r.quantities };
      columns.forEach(col => {
        const base = getItemBenchmarkLimit(col);
        const total = columnTotals[col.id] || 0;
        if (total > base && rows.length > 0) {
          const currentVal = newQ[col.id] || 0;
          if (currentVal > 0) {
            const ratio = base / total;
            newQ[col.id] = Math.max(0, Math.floor(currentVal * ratio));
          }
        }
      });
      return { ...r, quantities: newQ };
    });
    setRows(updatedRows);
    notifyChange(internalDate, columns, updatedRows);
    showToast('⚡ Auto-rebalanced breakdown quantities to match EPSS Base Benchmarks!');
  };

  // Cell change handler with EPSS Benchmark alarm check
  const handleCellChange = (rowId: string, colId: string, value: string) => {
    const num = value === '' ? 0 : Number(value);
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          quantities: {
            ...r.quantities,
            [colId]: isNaN(num) ? 0 : num
          }
        };
      }
      return r;
    });

    // Check if cell edit causes or maintains over-allocation
    const targetCol = columns.find(c => c.id === colId);
    if (targetCol) {
      const colBase = getItemBenchmarkLimit(targetCol);
      const newTotal = updatedRows.reduce((sum, r) => sum + (Number(r.quantities[colId]) || 0), 0);
      if (newTotal > colBase) {
        triggerBenchmarkAlarmSound();
        showToast(`🚨 ALARM: Total for "${targetCol.name}" (${newTotal}) EXCEEDS EPSS Base Benchmark (${colBase}) by +${newTotal - colBase} units!`);
      }
    }

    setRows(updatedRows);
    notifyChange(internalDate, columns, updatedRows);
  };

  // Automatically fill table rows with health facilities matching the chosen Region from HF Master Data List
  const handleAutoPopulateRegionFacilities = (targetRegion: string) => {
    if (!targetRegion || targetRegion === 'all') {
      alert('Please select a specific region (e.g. Oromia, Amhara, Tigray, etc.) first from the Region dropdown.');
      return;
    }

    const matchedFacilities = masterHfItems.filter(h => isRegionMatch(h.region, targetRegion));
    if (matchedFacilities.length === 0) {
      showToast(`⚠️ No health facilities found for ${targetRegion} in HF Master Data list.`);
      return;
    }

    setIsEditingMode(true);
    const newRows: RegionBreakdownRow[] = matchedFacilities.map((hf, idx) => {
      const rowQuantities: Record<string, number> = {};
      columns.forEach(col => {
        rowQuantities[col.id] = 1;
      });

      return {
        id: `row-auto-${targetRegion.toLowerCase().replace(/\s+/g, '-')}-${idx}-${Date.now()}`,
        region: hf.region || targetRegion,
        zone: hf.zoneDescription || hf.zoneCode || 'Zone 1',
        woreda: hf.woredaDescription || hf.woreda || '1',
        hub: hf.deliveringPlant || 'General Regional Hub',
        healthFacility: hf.customer || `HF-${idx + 1}`,
        customerDescription: hf.customerDescription || hf.customer || 'Health Facility',
        packages: idx % 2 === 0 ? 'MCH' : 'OR',
        quantities: rowQuantities
      };
    });

    setRows(newRows);
    notifyChange(internalDate, columns, newRows);
    showToast(`✓ Auto-filled ${newRows.length} facilities & customer descriptions for ${targetRegion} from HF Master List!`);
  };

  // Row field change
  const handleRowFieldChange = (rowId: string, field: keyof Omit<RegionBreakdownRow, 'quantities'>, value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const updatedRow = { ...r, [field]: value };

        // 1. When Region is selected:
        // Automatically filter and assign Customer Description, Facility Name, Zone, & Woreda strictly from HF Master data list for selected region
        if (field === 'region') {
          const regionFacilities = masterHfItems.filter(h => isRegionMatch(h.region, value));
          if (regionFacilities.length > 0) {
            const firstHf = regionFacilities[0];
            if (firstHf.region) {
              updatedRow.region = firstHf.region;
            }
            updatedRow.customerDescription = firstHf.customerDescription || firstHf.customer || 'Health Facility';
            updatedRow.healthFacility = firstHf.customer || firstHf.customerDescription || 'HF-001';
            updatedRow.zone = firstHf.zoneDescription || firstHf.zoneCode || '';
            updatedRow.woreda = firstHf.woredaDescription || firstHf.woreda || '';
            updatedRow.hub = (firstHf.deliveringPlant && firstHf.deliveringPlant !== 'HO01') ? firstHf.deliveringPlant : 'AA01';
          } else {
            updatedRow.customerDescription = '';
            updatedRow.healthFacility = '';
            updatedRow.zone = '';
            updatedRow.woreda = '';
            updatedRow.hub = 'AA01';
          }
        }

        // 2. When Customer Description is selected:
        // Automatically populate Zone, Woreda, and Name of health facility (Customer ID) strictly from matching HF in selected region
        if (field === 'customerDescription' && masterHfItems.length > 0) {
          const regionFacilities = masterHfItems.filter(h => isRegionMatch(h.region, r.region));
          const matchedHf = regionFacilities.find(
            h => (h.customerDescription && h.customerDescription.trim().toLowerCase() === value.trim().toLowerCase()) ||
                 (h.customer && h.customer === value)
          ) || masterHfItems.find(
            h => (h.customerDescription && h.customerDescription.trim().toLowerCase() === value.trim().toLowerCase()) ||
                 (h.customer && h.customer === value)
          );

          if (matchedHf) {
            updatedRow.customerDescription = matchedHf.customerDescription || matchedHf.customer;
            if (matchedHf.customer) {
              updatedRow.healthFacility = matchedHf.customer;
            }
            if (matchedHf.region) {
              updatedRow.region = matchedHf.region;
            }
            updatedRow.zone = matchedHf.zoneDescription || matchedHf.zoneCode || r.zone;
            updatedRow.woreda = matchedHf.woredaDescription || matchedHf.woreda || r.woreda;
            const dp = matchedHf.deliveringPlant;
            updatedRow.hub = (dp && dp !== 'HO01') ? dp : (r.hub && r.hub !== 'HO01' ? r.hub : 'AA01');
          }
        }

        // 3. When Name of health facility (Customer ID) is selected:
        if (field === 'healthFacility' && masterHfItems.length > 0) {
          const regionFacilities = masterHfItems.filter(h => isRegionMatch(h.region, r.region));
          const matchedHf = regionFacilities.find(
            h => h.customer === value ||
                 (h.customerDescription && h.customerDescription.trim().toLowerCase() === value.trim().toLowerCase())
          ) || masterHfItems.find(
            h => h.customer === value ||
                 (h.customerDescription && h.customerDescription.trim().toLowerCase() === value.trim().toLowerCase())
          );

          if (matchedHf) {
            updatedRow.customerDescription = matchedHf.customerDescription || matchedHf.customer;
            if (matchedHf.customer) {
              updatedRow.healthFacility = matchedHf.customer;
            }
            if (matchedHf.region) {
              updatedRow.region = matchedHf.region;
            }
            updatedRow.zone = matchedHf.zoneDescription || matchedHf.zoneCode || r.zone;
            updatedRow.woreda = matchedHf.woredaDescription || matchedHf.woreda || r.woreda;
            const dp = matchedHf.deliveringPlant;
            updatedRow.hub = (dp && dp !== 'HO01') ? dp : (r.hub && r.hub !== 'HO01' ? r.hub : 'AA01');
          }
        }

        return updatedRow;
      }
      return r;
    });
    setRows(updatedRows);
    notifyChange(internalDate, columns, updatedRows);
  };

  // Add new row
  const handleAddRow = () => {
    setIsEditingMode(true);
    const defaultReg = selectedRegionFilter !== 'all' ? selectedRegionFilter : (rows[0]?.region || 'Oromia');
    const facilitiesInReg = masterHfItems.filter(h => isRegionMatch(h.region, defaultReg));
    const firstFacility = facilitiesInReg[0] || masterHfItems[0];

    const newRow: RegionBreakdownRow = {
      id: `row-${Date.now()}`,
      region: defaultReg,
      zone: firstFacility?.zoneDescription || firstFacility?.zoneCode || uniqueZones[0] || 'Zone 1',
      woreda: firstFacility?.woredaDescription || firstFacility?.woreda || '1',
      hub: firstFacility?.deliveringPlant || 'General Regional Hub',
      healthFacility: firstFacility?.customerDescription || 'New Health Center',
      packages: 'MCH',
      quantities: {}
    };
    columns.forEach(col => {
      newRow.quantities[col.id] = 1;
    });
    const updated = [...rows, newRow];
    setRows(updated);
    notifyChange(internalDate, columns, updated);
    showToast(`✓ Added new facility row (${newRow.healthFacility}) for ${defaultReg}`);
  };

  // Quick Add Equipment Column
  const handleQuickAddColumn = (colName?: string, colCode?: string) => {
    setIsEditingMode(true);
    let name = colName;
    let code = colCode;
    if (!name) {
      const input = window.prompt('Enter new Equipment / Facility Column Name (e.g. Oxygen Concentrator, Patient Monitor):');
      if (!input || !input.trim()) return;
      name = input.trim();
    }
    if (!code) {
      code = `40${columns.length + 1}-CODE`;
    }

    const newCol: RegionBreakdownColumn = {
      id: `col-custom-${Date.now()}`,
      name: name,
      code: code
    };
    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);
    
    const updatedRows = rows.map(r => ({
      ...r,
      quantities: { ...r.quantities, [newCol.id]: 0 }
    }));
    setRows(updatedRows);
    notifyChange(internalDate, updatedCols, updatedRows);
    showToast(`✓ Added new column "${newCol.name}" to table matrix`);
  };

  // Remove row
  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) {
      alert('Cannot remove the last remaining row.');
      return;
    }
    const updated = rows.filter(r => r.id !== rowId);
    setRows(updated);
    notifyChange(internalDate, columns, updated);
  };

  // Export to Excel in exact format matching active template (Item Aggregation by Hub, EPSS, or RHB)
  const handleExportExcel = () => {
    const aoa: any[][] = [];
    const fmt = matrixTemplateFormat;

    // Row 1: Date
    aoa.push(['Date', internalDate]);

    // Row 2: Top Tier Headers
    if (fmt === 'item') {
      aoa.push(['⬡', ...columns.map(c => c.name)]);
      aoa.push(['⬡', ...columns.map(c => c.code)]);
      
      // Calculate Hub Aggregations
      const hubAgg: Record<string, Record<string, number>> = {};
      filteredRows.forEach(r => {
        const hubCode = (r.hub && r.hub !== 'HO01') ? r.hub : 'AA01';
        if (!hubAgg[hubCode]) hubAgg[hubCode] = {};
        columns.forEach(c => {
          hubAgg[hubCode][c.id] = (hubAgg[hubCode][c.id] || 0) + (Number(r.quantities[c.id]) || 0);
        });
      });

      Object.keys(hubAgg).forEach(hCode => {
        aoa.push([
          hCode,
          ...columns.map(c => hubAgg[hCode][c.id] || 0)
        ]);
      });

      aoa.push([
        'TOTAL',
        ...columns.map(c => columnTotals[c.id] || 0)
      ]);
    } else if (fmt === 'epss' || fmt === 'submit-breakdown-to-moh') {
      aoa.push([
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
        'List of Packages',
        ...(isHubMapped ? ['HUB'] : []),
        ...columns.map(c => c.name)
      ]);
      aoa.push([
        '',
        '',
        '',
        '',
        'List of Packages',
        ...(isHubMapped ? [''] : []),
        ...columns.map(c => c.code)
      ]);
      filteredRows.forEach(r => {
        aoa.push([
          r.region,
          r.zone,
          r.woreda,
          r.healthFacility || r.customerDescription,
          r.packages || 'MCH',
          ...(isHubMapped ? [r.hub || 'AA01'] : []),
          ...columns.map(c => {
            const val = r.quantities[c.id];
            return val === 0 ? '' : (val ?? '');
          })
        ]);
      });
      aoa.push([
        'TOTAL',
        '',
        '',
        `${filteredRows.length} Facilities`,
        '',
        ...columns.map(c => columnTotals[c.id] || 0)
      ]);
    } else {
      aoa.push([
        'Region',
        'Zone',
        'Woreda',
        'Customer Description',
        'List of Packeges',
        ...columns.map(c => c.name)
      ]);
      aoa.push([
        '',
        '',
        '',
        '',
        'List of Packeges',
        ...columns.map(c => c.code)
      ]);
      filteredRows.forEach(r => {
        aoa.push([
          r.region,
          r.zone,
          r.woreda,
          r.customerDescription || r.healthFacility,
          r.packages || 'MCH',
          ...columns.map(c => {
            const val = r.quantities[c.id];
            return val === 0 ? '' : (val ?? '');
          })
        ]);
      });
      aoa.push([
        'TOTAL',
        '',
        '',
        `${filteredRows.length} Facilities`,
        '',
        ...columns.map(c => columnTotals[c.id] || 0)
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = fmt === 'item' ? [
      { wch: 14 },
      ...columns.map(() => ({ wch: 24 }))
    ] : (fmt === 'epss' || fmt === 'submit-breakdown-to-moh') ? [
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 32 },
      { wch: 18 },
      ...columns.map(() => ({ wch: 22 }))
    ] : [
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 32 },
      { wch: 18 },
      { wch: 14 },
      ...columns.map(() => ({ wch: 22 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facility Breakdown');
    const filenameLabel = fmt === 'item' ? 'Item_Aggregation' : fmt === 'submit-breakdown-to-moh' ? 'Submit_Breakdown_To_MOH' : fmt === 'epss' ? 'EPSS_Submission' : fmt === 'dsp-received-from-moh' ? 'DSP_Received_From_MOH' : 'RHB_Breakdown';
    const filename = `DSP_${filenameLabel}_${selectedRegionFilter !== 'all' ? selectedRegionFilter : 'All_Regions'}_${internalDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`✓ Exported ${filename}`);
  };

  // Download official blank template
  const handleDownloadTemplate = () => {
    const fmt = matrixTemplateFormat;
    const aoa: any[][] = fmt === 'item' ? [
      [
        '⬡',
        'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult', 'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
      ],
      [
        '⬡',
        '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
      ],
      ['AA01', 6, 6, 2, 2, 2, 2],
      ['AD01', 2, 2, 2, 2, 2, 2],
      ['DI01', 2, 2, 2, 2, 2, 2],
      ['BD01', 2, 2, 2, 2, 2, 2],
      ['HW01', 2, 2, 2, 2, 2, 2],
      ['DD01', 2, 2, 2, 2, 2, 2]
    ] : fmt === 'submit-breakdown-to-moh' ? [
      [
        'Region', 'Zone', 'Woreda', 'Name of health facility', 'List of Packages',
        'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult', 'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
      ],
      [
        '', '', '', '', 'List of Packages',
        '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
      ],
      ['Oromia', 'Gurage', 'Abeshige', 'Abeshige Woreda Health Office', 'MCH', 2, 3, 3, 2, 2, 2],
      ['Oromia', 'East Shewa', 'Adama', 'Addis Hiwot Health Center', 'MCH', 2, 3, 3, 2, 2, 2],
      ['Oromia', 'East Shewa', 'Adama', 'Adama Health Center', 'MCH', 2, 1, 1, 2, 2, 2],
      ['Oromia', 'East Shewa', 'Adama', 'Addis Hiwot Health Center', 'MCH', 2, '', '', 2, 2, 2],
      ['Afar', 'Kilbati', 'Abala', 'Abala Primary Hospital', 'MCH', 2, 3, 3, 2, 2, 2]
    ] : [
      [
        'Region', 'Zone', 'Woreda', 'Name of health facility', 'List of Packages', 'HUB',
        'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult', 'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
      ],
      [
        '', '', '', '', 'List of Packages', '',
        '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
      ],
      ['Addis Ababa', 'Addis Ketema', 'Woreda 01', 'Tikur Anbessa Specialized Hospital', 'MCH', 'AA01', 2, 2, 2, 2, 2, 2],
      ['Oromia', 'East Shewa', 'Adama Town Woreda 01', 'Adama Hospital Medical College #40002328', 'MCH', 'AD01', 2, 2, 2, 2, 2, 2],
      ['Dire Dawa', 'Dire Dawa Administration', 'Woreda 01', 'Dire Dawa Dil Chora Hospital #40002962', 'MCH', 'DD01', 2, 2, 2, 2, 2, 2]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = fmt === 'item' ? [
      { wch: 14 }, { wch: 32 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ] : [
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const templateName = `EPSS_DSP_${fmt === 'item' ? 'Item_Aggregation' : fmt === 'epss' ? 'Submitted_To_EPSS' : fmt === 'dsp-received-from-moh' ? 'Received_From_MOH' : 'Breakdown_Aggregation'}_Template.xlsx`;
    XLSX.writeFile(wb, templateName);
    showToast(`✓ Downloaded ${templateName}`);
  };

  // Auto map facilities to hub using mapFacilityToHub algorithm


  return (
    <div className={`space-y-4 ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-100 p-6 overflow-y-auto' : ''}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🚨 BENCHMARK OVER-ALLOCATION ALARM BANNER */}
      {overAllocatedColumns.length > 0 && (
        <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-red-900 border-2 border-rose-400 rounded-2xl p-4 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shrink-0 border border-rose-400 animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm uppercase tracking-wider text-rose-200">
                  🚨 BENCHMARK OVER-ALLOCATION ALARM TRIGGERED!
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white font-mono border border-rose-300">
                  {overAllocatedColumns.length} Item(s) Exceeded
                </span>
              </div>
              <p className="text-xs text-rose-100/90 leading-relaxed font-medium">
                Current breakdown quantities filled manually or automatically exceed the official <strong>EPSS Base Quantity Benchmark to send for MOH</strong>:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {overAllocatedColumns.map(({ col, total, base, excess }) => (
                  <span key={col.id} className="px-2.5 py-1 rounded-lg bg-rose-950/90 border border-rose-400 text-[11px] font-mono text-rose-200 font-bold shadow-sm">
                    ⚠️ {col.name}: <strong className="text-white">{total} allocated</strong> / {base} EPSS Base (<span className="text-amber-300 font-black">+{excess} OVER LIMIT</span>)
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAutoTrimToBaseBenchmark}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5 border border-amber-300"
              title="Automatically scale down allocated quantities to meet EPSS Base Benchmarks"
            >
              <Sparkles size={15} className="text-slate-950" />
              <span>⚡ Auto-Rebalance to Base Benchmark</span>
            </button>

            <button
              type="button"
              onClick={() => setAudioAlarmEnabled(!audioAlarmEnabled)}
              className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                audioAlarmEnabled 
                  ? 'bg-rose-800/80 hover:bg-rose-800 text-rose-100 border-rose-500' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={audioAlarmEnabled ? 'Audio Alarm ON (Click to Mute)' : 'Audio Alarm Muted (Click to Enable)'}
            >
              {audioAlarmEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">{audioAlarmEnabled ? 'Audio ON' : 'Muted'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200 shadow-2xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                {title}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold font-mono">
                All Regions & HF Master Linked
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* SUBMIT BREAKDOWN TO MOH 3 Pill Button with Interactive Dropdown */}
        <div className="relative">
            <button
              type="button"
              onClick={handleMapHfToHub}
              disabled={isAnalyzing}
              className={`px-6 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-xl transition-all transform active:scale-95 border cursor-pointer tracking-wider uppercase flex items-center gap-2 ${
                isHubMapped 
                  ? 'bg-emerald-600 border-emerald-400 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-400 text-white'
              }`}
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapIcon className="w-4 h-4" />}
              <span>{isHubMapped ? 'Re-Map HF to HUB' : 'Map HF to HUB'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSubmitDropdownOpen(!isSubmitDropdownOpen)}
            className="flex items-center gap-3 px-6 py-2.5 bg-[#0a0f1d] hover:bg-black text-white rounded-full font-black text-xs sm:text-sm shadow-xl hover:shadow-cyan-900/40 transition-all transform active:scale-95 border border-slate-700/80 cursor-pointer tracking-wider uppercase group"
            title="Submit official breakdown matrix to MOH via System Transmittal, Email, or WhatsApp"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)] animate-pulse shrink-0" />
            <span className="tracking-widest font-black text-white group-hover:text-amber-300 transition-colors">
              SUBMIT BREAKDOWN TO MOH
            </span>
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-inner shrink-0 ml-1">
              3
            </span>
            <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${isSubmitDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Submission Channels Dropdown Popover */}
          {isSubmitDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-[#0a0f1d] border-2 border-amber-400/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-slate-800">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  Select MOH Submission Channel:
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Official dispatch routes for PMD MOH
                </span>
              </div>

              <div className="space-y-1 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitDropdownOpen(false);
                    setTransmittalDestination('MOH');
                    setIsTransmitModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                >
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white group-hover:text-amber-300">1. Direct System Transmittal</div>
                    <div className="text-[10px] text-slate-400">Digital authorization & audit log</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitDropdownOpen(false);
                    setIsEmailModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white group-hover:text-cyan-300">2. Send via Email</div>
                    <div className="text-[10px] text-slate-400">Targeting moh.pmd@moh.gov.et</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitDropdownOpen(false);
                    setIsWhatsAppModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white group-hover:text-emerald-300">3. Send via WhatsApp Desk</div>
                    <div className="text-[10px] text-slate-400">Web dispatch & auto Excel matrix</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>





      {/* Equipment Column Configurator */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/60 border border-amber-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-600 text-white shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {disableBreakdownLink ? 'Equipment & Facility Mapping Matrix' : 'Breakdown Request Source Data'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 font-mono">
                  {disableBreakdownLink ? 'Interactive Matrix' : 'Selectable Request'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                {disableBreakdownLink 
                  ? 'Manage equipment columns, view quantities, and map facility distribution across regions and hubs'
                  : 'Select a breakdown request to dynamically update equipment columns and health facility allocations'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* EPSS Base Benchmark Control Button */}
            <button
              type="button"
              onClick={() => setShowBenchmarkPanel(!showBenchmarkPanel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                overAllocatedColumns.length > 0 
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse font-black' 
                  : showBenchmarkPanel 
                    ? 'bg-amber-600 text-white border-amber-500' 
                    : 'bg-white hover:bg-amber-50 text-slate-800 border-amber-300'
              }`}
              title="Configure EPSS Base Quantity Benchmarks per equipment item"
            >
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span>
                EPSS Base Limits {overAllocatedColumns.length > 0 ? `(🚨 ${overAllocatedColumns.length} OVER)` : `(${columns.length} Items)`}
              </span>
            </button>

            {/* Breakdown Request Selector - Clean button opening 8-column Table Modal */}
            {!disableBreakdownLink && breakdownRequests && breakdownRequests.length > 0 && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-amber-300 shadow-2xs">
                <span className="text-xs font-bold text-slate-700 pl-1">Request:</span>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-amber-950 font-bold cursor-pointer transition flex items-center gap-1.5 max-w-xs truncate shadow-2xs"
                  title="Open Institutional Request Selection Table"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">
                    {selectedRequestId
                      ? (() => {
                          const sel = breakdownRequests.find(r => r.id === selectedRequestId);
                          if (!sel) return 'Selected Request';
                          return getDossierDisplayInfo(sel).dspName || sel.dspName || sel.dspRefNumber;
                        })()
                      : '-- Select Breakdown Request --'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-amber-700 shrink-0" />
                </button>
              </div>
            )}

          </div>
        </div>

        {/* EPSS Base Benchmark Control Panel Drawer */}
        {showBenchmarkPanel && (
          <div className="p-3.5 bg-slate-900 border-2 border-amber-400 rounded-2xl text-white space-y-3 animate-in fade-in shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                  EPSS Base Quantity Benchmarks to Send for MOH (Master Allocation Limits)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleAutoTrimToBaseBenchmark}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg transition cursor-pointer text-[11px] uppercase tracking-wider"
                >
                  ⚡ Auto-Trim All to Base Benchmark
                </button>
                <button
                  type="button"
                  onClick={() => setShowBenchmarkPanel(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {columns.map(col => {
                const total = columnTotals[col.id] || 0;
                const baseLimit = getItemBenchmarkLimit(col);
                const isExceeded = total > baseLimit;
                const pct = Math.min(100, Math.round((total / Math.max(1, baseLimit)) * 100));

                return (
                  <div
                    key={`bm-${col.id}`}
                    className={`p-2.5 rounded-xl border transition ${
                      isExceeded
                        ? 'bg-rose-950/80 border-rose-500 text-rose-100 shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate flex-1">
                        <div className="font-bold text-xs truncate text-white" title={col.name}>{col.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{col.code}</div>
                      </div>
                      {isExceeded && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white font-mono animate-bounce shrink-0">
                          +{total - baseLimit} OVER
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span>Total Allocated: <strong className={isExceeded ? 'text-rose-300 font-extrabold' : 'text-emerald-400'}>{total}</strong></span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">EPSS Base:</span>
                        <input
                          type="number"
                          min="1"
                          value={baseLimit}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setItemBenchmarks(prev => ({ ...prev, [col.id]: val, [col.code]: val }));
                          }}
                          className="w-12 px-1 py-0.5 bg-slate-950 border border-slate-600 rounded text-center text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Progress Bar Meter */}
                    <div className="w-full bg-slate-950 h-2 rounded-full mt-1.5 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isExceeded ? 'bg-rose-500 animate-pulse' : total === baseLimit ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}






            {/* Item Checklist Drawer (Select / Deselect One by One or All in One) */}
            {isChecklistOpen && (
              <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-amber-950 pb-1 border-b border-amber-200">
                  <span>Master Catalog Items Checklist — Select All in One or Pick One by One:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllCatalogItems}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase shadow-2xs transition cursor-pointer"
                      title="Select all equipment items from master catalog into matrix columns"
                    >
                      ✓ Select All in One ({MASTER_EQUIPMENT_CATALOG.length} Items)
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllCatalogItems}
                      className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] uppercase transition cursor-pointer"
                      title="Clear all selected equipment columns"
                    >
                      Clear All
                    </button>
                    <span className="font-mono text-amber-900 font-extrabold bg-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                      {columns.length} Columns Selected
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                  {MASTER_EQUIPMENT_CATALOG.map((catItem, idx) => {
                    const isSelected = columns.some(c => c.code === catItem.code || c.name.toLowerCase() === catItem.name.toLowerCase());
                    return (
                      <label
                        key={`check-${catItem.code}-${idx}`}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition cursor-pointer text-[11px] ${
                          isSelected
                            ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItemOneByOne(catItem)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
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
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-slate-800 font-mono text-[11px]"
                >
                  <span className="font-bold text-amber-900">{col.name}</span>
                  <span className="text-[10px] text-slate-500">({col.code})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEquipmentColumn(col.id)}
                    className="ml-1 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove column"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>



            {/* Add Custom Equipment Column Inputs */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="New Equipment Description (e.g. Patient Monitor)..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Item Code (e.g. 403-XRRD-0101)..."
                value={newColumnCode}
                onChange={(e) => setNewColumnCode(e.target.value)}
                className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddEquipmentColumn}
                disabled={!newColumnName.trim()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded-lg transition cursor-pointer text-xs whitespace-nowrap"
              >
                + Add Column
              </button>
            </div>
      </div>
      
      {/* Region Selector & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          {/* Region Quick Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700">Region:</span>
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-amber-900 font-bold cursor-pointer focus:outline-none focus:border-amber-500 shadow-2xs"
            >
              <option value="all">🌍 All Regions (15 Ethiopian Regions)</option>
              {uniqueRegions.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          {selectedRegionFilter !== 'all' && (
            <button
              type="button"
              onClick={() => handleAutoPopulateRegionFacilities(selectedRegionFilter)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={`Automatically fill table rows with all facilities for ${selectedRegionFilter} from HF Master List`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ Auto-Fill {selectedRegionFilter} Facilities</span>
            </button>
          )}

          <div className="relative w-full sm:w-56">
            <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, zone, woreda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Add a new health facility row to matrix table"
          >
            <Plus size={15} />
            <span>+ Add Facility Row</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickAddColumn()}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Add a new equipment / facility column to matrix table"
          >
            <Plus size={15} />
            <span>+ Add Column</span>
          </button>
        </div>
      </div>

      {/* RHB BREAKDOWN AGGREGATION SUB-VIEW SWITCHER BAR */}
      {matrixTemplateFormat === 'rhb' && (
        <div className="bg-[#0A0F1D] border border-amber-400/40 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                BREAKDOWN AGGREGATION BY RHB — 14 Ethiopian Regional Health Bureaus
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Official Regional Submissions format sent to Ministry of Health (MOH)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setRhbSubViewMode('summary-table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                rhbSubViewMode === 'summary-table'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText size={14} />
              <span>Summary Table (Attachment 1 Format)</span>
            </button>

            <button
              type="button"
              onClick={() => setRhbSubViewMode('detailed-matrix')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                rhbSubViewMode === 'detailed-matrix'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers size={14} />
              <span>Detailed Facility Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMatrixTemplateFormat('dsp-aggr-submitted-to-epss');
                showToast('⚡ Switched to Linked DSP AGGR. SUBMITTED TO EPSS Health Facility Matrix');
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Open linked DSP Aggregated Submission to EPSS matrix"
            >
              <Link2 size={14} className="text-slate-950" />
              <span>Linked EPSS Matrix</span>
            </button>
          </div>
        </div>
      )}

      {/* REGIONAL SUBMISSIONS SUMMARY TABLE: Exact Attachment 1 Format (S/N | Region | DSP Name | Date | View) */}
      {matrixTemplateFormat === 'rhb' && rhbSubViewMode === 'summary-table' ? (
        <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden shadow-md">
          <div className="bg-[#0B1527] text-white p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                <span className="font-black text-sm uppercase tracking-wider text-white">
                  Regional Health Bureau (RHB) Submissions to Ministry of Health (MOH)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Exact Attachment 1 Table Format: S/N | Region | DSP Name | Date | View — 14 Ethiopian Regions (Linked to EPSS Matrix)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(
                    rhbSummaryRows.map(r => ({
                      'S/N': r.sn,
                      'Region': r.region,
                      'DSP Name': r.dspName,
                      'Date': r.date,
                      'View / Status': r.status || 'Submitted to MOH'
                    }))
                  );
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'RHB Submissions to MOH');
                  XLSX.writeFile(wb, `RHB_Submissions_Summary_To_MOH_${internalDate}.xlsx`);
                  showToast('✓ RHB Submissions Summary exported to Excel!');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={14} />
                <span>Export Summary (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans border-t border-slate-900">
              <thead>
                <tr className="bg-slate-100 text-slate-950 font-black text-xs border-b-2 border-slate-900">
                  <th className="p-3 border-r border-slate-300 w-16 text-center bg-slate-200">S/N</th>
                  <th className="p-3 border-r border-slate-300 min-w-[200px] bg-slate-100">Region</th>
                  <th className="p-3 border-r border-slate-300 min-w-[260px] bg-slate-100">DSP Name</th>
                  <th className="p-3 border-r border-slate-300 min-w-[140px] bg-slate-100">Date</th>
                  <th className="p-3 text-center min-w-[120px] bg-slate-200">View</th>
                </tr>
              </thead>
              <tbody>
                {rhbSummaryRows.map((row) => (
                  <tr 
                    key={row.sn} 
                    className="border-b border-slate-300 hover:bg-amber-50/80 transition group"
                  >
                    <td className="p-3 border-r border-slate-300 text-center font-mono font-bold text-slate-900 bg-slate-50/60 group-hover:bg-amber-100/60">
                      {row.sn}
                    </td>
                    <td className="p-3 border-r border-slate-300 font-bold text-slate-900 text-sm">
                      {row.region}
                    </td>
                    <td className="p-3 border-r border-slate-300 font-mono">
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={row.dspName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRhbSummaryRows(prev => prev.map(r => r.sn === row.sn ? { ...r, dspName: val } : r));
                          }}
                          className="w-full bg-white border border-amber-300 rounded px-2.5 py-1 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : (
                        <span className="text-slate-800 font-semibold">{row.dspName}</span>
                      )}
                    </td>
                    <td className="p-3 border-r border-slate-300 font-mono text-slate-700">
                      {isEditingMode ? (
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRhbSummaryRows(prev => prev.map(r => r.sn === row.sn ? { ...r, date: val } : r));
                          }}
                          className="bg-white border border-amber-300 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : (
                        <span>{row.date}</span>
                      )}
                    </td>
                    <td className="p-3 text-center bg-slate-50/60 group-hover:bg-amber-100/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRhbDetailRegion(row);
                          setSelectedRegionFilter(row.region);
                          setMatrixTemplateFormat('dsp-aggr-submitted-to-epss');
                          showToast(`🔗 Linked View: Opened ${row.region} Breakdown Matrix in DSP AGGR. SUBMITTED TO EPSS format`);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-black text-amber-400 font-black text-xs transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 border border-slate-700 active:scale-95"
                        title={`View ${row.region} Health Facility Breakdown Matrix in DSP AGGR. SUBMITTED TO EPSS format`}
                      >
                        <Eye size={13} className="text-amber-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SPREADSHEET TABLE: Matching Detailed Format */
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
              {/* Date Header Top Left Row */}
              <tr className="border-b border-slate-300 bg-white">
                <th 
                  colSpan={1} 
                  className="p-2.5 font-bold text-slate-800 text-xs border-r border-slate-300 bg-white tracking-wide"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">Date</span>
                    {isEditingMode ? (
                      <input
                        type="date"
                        value={internalDate}
                        onChange={(e) => {
                          setInternalDate(e.target.value);
                          notifyChange(e.target.value, columns, rows);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs font-mono font-bold"
                      />
                    ) : (
                      <span className="font-mono text-slate-700 font-medium text-[11px]">{internalDate}</span>
                    )}
                  </div>
                </th>
                <th 
                  colSpan={columns.length + (matrixTemplateFormat === 'rhb' ? 5 : 4)} 
                  className="p-2.5 bg-slate-50 text-right text-[11px] font-mono text-slate-400 font-normal pr-4"
                >
                  Regional Health Bureau | MOH PMD Medical Device Distribution Matrix ({selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter})
                </th>
              </tr>

              {/* Header Row 0: Date */}
              <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-bold border-b border-slate-300">
                <th colSpan={1} className="p-2 border-r border-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Date:</span>
                    {isEditingMode ? (
                      <input
                        type="date"
                        value={internalDate}
                        onChange={(e) => {
                          setInternalDate(e.target.value);
                          notifyChange(e.target.value, columns, rows);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs font-mono font-bold"
                      />
                    ) : (
                      <span className="font-mono text-slate-700 font-medium text-[11px]">{internalDate}</span>
                    )}
                  </div>
                </th>
                <th 
                  colSpan={matrixTemplateFormat === 'item' ? 4 : columns.length + (matrixTemplateFormat === 'rhb' ? 5 : 4)} 
                  className="p-2.5 bg-slate-50 text-right text-[11px] font-mono text-slate-400 font-normal pr-4"
                >
                  Regional Health Bureau | MOH PMD Medical Device Distribution Matrix ({selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter})
                </th>
              </tr>

              {/* Header Row 1: Matching exact attachment structure */}
              <tr className="border-b border-slate-300 text-xs font-medium">
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[110px]">
                  Region
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[120px]">
                  Zone
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[70px] text-center">
                  Woreda
                </th>
                {matrixTemplateFormat === 'rhb' ? (
                  <th className="p-2.5 bg-[#fed7aa] text-[#78350f] border-r border-slate-300 font-semibold min-w-[240px]">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#fef08a] border border-[#fde047] text-[#854d0e] font-bold shadow-2xs not-italic">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Customer Description</span>
                    </div>
                  </th>
                ) : (
                  <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[240px]">
                    Name of health facility
                  </th>
                )}
                 <th className="p-2.5 italic bg-[#dbeafe] text-slate-900 border-r border-slate-300 font-semibold min-w-[120px] text-center">
                   List of Packages
                 </th>
                 {isHubMapped && (
                   <th className="p-2.5 bg-[#fef08a] text-amber-950 font-black border-r border-slate-300 min-w-[90px] text-center uppercase tracking-wider">
                     HUB
                   </th>
                 )}
                {matrixTemplateFormat !== 'item' && columns.map(col => {
                  const total = columnTotals[col.id] || 0;
                  const base = getItemBenchmarkLimit(col);
                  const isOver = total > base;
                  return (
                    <th 
                      key={col.id} 
                      className={`p-2.5 border-r border-slate-300 font-semibold text-left min-w-[160px] max-w-[200px] leading-tight transition-colors ${
                        isOver 
                          ? 'bg-rose-200 text-rose-950 border-rose-400 font-black shadow-inner' 
                          : 'bg-[#fed7aa] text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isOver ? 'bg-rose-600 text-white font-black animate-pulse' : 'bg-amber-200/80 text-amber-900'
                        }`}>
                          {isOver ? `🚨 OVER (+${total - base})` : `Base: ${base}`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-700 font-bold">{total}/{base}</span>
                      </div>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => handleUpdateColumn(col.id, e.target.value, col.code)}
                          className="w-full bg-white border border-amber-300 rounded p-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                          placeholder="Item / Equipment Name..."
                        />
                      ) : (
                        <div className="line-clamp-2" title={col.name}>{col.name}</div>
                      )}
                    </th>
                  );
                })}
                {matrixTemplateFormat !== 'item' && (
                  <th className="p-2 bg-indigo-50/80 border-r border-slate-300 text-center min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => handleQuickAddColumn()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer mx-auto shadow-2xs"
                      title="Add new equipment / facility column"
                    >
                      <Plus size={13} />
                      <span>+ Add Column</span>
                    </button>
                  </th>
                )}
                {isEditingMode && (
                  <th className="p-2 bg-slate-100 text-center text-slate-500 font-bold min-w-[60px]">
                    Action
                  </th>
                )}
              </tr>

              {/* Header Row 2: Equipment Codes */}
              <tr className="border-b border-slate-300 bg-white text-[11px] font-mono">
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#eff6ff] italic text-slate-600 text-[10px] text-center border-r border-slate-300">List of Packages</th>
                {isHubMapped && (
                  <th className="p-2 bg-[#fef9c3] border-r border-slate-300 text-center font-bold text-amber-900 text-[10px]">HUB</th>
                )}
                {matrixTemplateFormat !== 'item' && columns.map(col => (
                  <th 
                    key={col.id} 
                    className="p-2 bg-white text-slate-700 border-r border-slate-300 font-mono text-[11px] font-bold text-left tracking-tight"
                  >
                    {isEditingMode ? (
                      <input
                        type="text"
                        value={col.code}
                        onChange={(e) => handleUpdateColumn(col.id, col.name, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded p-0.5 text-[11px] font-mono text-slate-700 focus:outline-none focus:border-amber-500"
                        placeholder="Item Code..."
                      />
                    ) : (
                      col.code
                    )}
                  </th>
                ))}
                {matrixTemplateFormat !== 'item' && (
                  <th className="p-2 bg-indigo-50/40 border-r border-slate-300 font-mono text-[10px] text-indigo-700 font-bold text-center">
                    New Column
                  </th>
                )}
                {isEditingMode && <th className="p-2 bg-slate-100"></th>}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={(matrixTemplateFormat === 'item' ? 5 : columns.length + 8) + (isEditingMode ? 1 : 0)} className="p-8 text-center text-slate-400">
                    No facility rows matching the selected region or filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => {
                  // Filter facilities strictly matching row's region from HF Master Data List
                  const facilitiesInRegion = masterHfItems.filter(hf => isRegionMatch(hf.region, row.region));

                  // Extract unique Zones strictly belonging to this region
                  const regionZones = Array.from(
                    new Set(
                      facilitiesInRegion
                        .map(h => h.zoneDescription || h.zoneCode)
                        .filter(Boolean)
                    )
                  ).sort();

                  // Extract unique Woredas strictly belonging to this region
                  const regionWoredas = Array.from(
                    new Set(
                      facilitiesInRegion
                        .map(h => h.woredaDescription || h.woreda)
                        .filter(Boolean)
                    )
                  ).sort();

                  // Matched HF Master Record
                  const matchedHf = masterHfItems.find(
                    h => (h.customerDescription && h.customerDescription.trim().toLowerCase() === (row.customerDescription || row.healthFacility || '').trim().toLowerCase()) ||
                         (h.customer && h.customer === row.healthFacility)
                  );

                  const activeCustDesc = row.customerDescription || matchedHf?.customerDescription || row.healthFacility;
                  const custIdBadge = row.customerId || matchedHf?.customer || (rowIdx === 1 ? '40002328' : rowIdx === 2 ? '40002962' : null);
                  const isRecentlyLoaded = recentlyLoadedToken && Date.now() - recentlyLoadedToken < 30000;

                  return (
                    <tr key={row.id} className={`transition-all duration-700 ${isRecentlyLoaded ? 'bg-amber-50/90 border-l-4 border-amber-500 shadow-2xs' : 'hover:bg-slate-50/70'}`}>
                      {/* 1. Region */}
                      <td className="p-2.5 text-slate-800 border-r border-slate-200 font-bold min-w-[110px]">
                        {isRecentlyLoaded && (
                          <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 font-mono animate-pulse">
                            ✨ NEW DATA
                          </div>
                        )}
                        {isEditingMode ? (
                          <select
                            value={row.region}
                            onChange={(e) => handleRowFieldChange(row.id, 'region', e.target.value)}
                            className="w-full p-1.5 border border-amber-300 rounded-lg text-xs font-bold bg-amber-50 text-amber-950 cursor-pointer shadow-2xs focus:ring-1 focus:ring-amber-400"
                            title="Selecting a region automatically populates Customer Description & Facility Name from HF Master List"
                          >
                            {uniqueRegions.map(reg => (
                              <option key={reg} value={reg}>{reg}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="font-bold text-slate-900">{row.region}</span>
                            <button
                              type="button"
                              onClick={() => setIsEditingMode(true)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-700 transition"
                              title="Edit region"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 2. Zone (Strictly filtered for selected region) */}
                      <td className="p-2.5 text-slate-700 border-r border-slate-200 min-w-[120px]">
                        {isEditingMode ? (
                          regionZones.length > 0 ? (
                            <select
                              value={row.zone}
                              onChange={(e) => handleRowFieldChange(row.id, 'zone', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 font-medium cursor-pointer"
                              title={`Select Zone strictly within ${row.region}`}
                            >
                              {row.zone && !regionZones.includes(row.zone) && (
                                <option value={row.zone}>{row.zone}</option>
                              )}
                              {regionZones.map((z, zIdx) => (
                                <option key={zIdx} value={z}>{z}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.zone}
                              onChange={(e) => handleRowFieldChange(row.id, 'zone', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                              placeholder={`Zone for ${row.region}...`}
                            />
                          )
                        ) : (
                          <span className="text-slate-600 font-normal">{row.zone}</span>
                        )}
                      </td>

                      {/* 3. Woreda (Strictly filtered for selected region) */}
                      <td className="p-2.5 text-slate-700 border-r border-slate-200 font-mono min-w-[80px]">
                        {isEditingMode ? (
                          regionWoredas.length > 0 ? (
                            <select
                              value={row.woreda}
                              onChange={(e) => handleRowFieldChange(row.id, 'woreda', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono text-center bg-white text-slate-900 cursor-pointer"
                              title={`Select Woreda strictly within ${row.region}`}
                            >
                              {row.woreda && !regionWoredas.includes(row.woreda) && (
                                <option value={row.woreda}>{row.woreda}</option>
                              )}
                              {regionWoredas.map((w, wIdx) => (
                                <option key={wIdx} value={w}>{w}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.woreda}
                              onChange={(e) => handleRowFieldChange(row.id, 'woreda', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-center font-mono"
                              placeholder="Woreda"
                            />
                          )
                        ) : (
                          <span className="text-slate-600 font-mono">{row.woreda}</span>
                        )}
                      </td>

                      {/* 4. Customer Description / Name of health facility */}
                      <td className="p-2.5 text-slate-900 border-r border-slate-200 min-w-[250px] bg-white">
                        {isEditingMode ? (
                          <div className="space-y-1">
                            <select
                              value={activeCustDesc}
                              onChange={(e) => handleRowFieldChange(row.id, 'customerDescription', e.target.value)}
                              className="w-full p-1.5 border border-amber-300 rounded-lg text-xs font-bold bg-white focus:border-amber-500 text-slate-900 cursor-pointer shadow-2xs transition"
                              title={`Select Customer Description strictly for ${row.region} from HF Master List`}
                            >
                              {activeCustDesc && !facilitiesInRegion.some(h => (h.customerDescription || h.customer) === activeCustDesc) && (
                                <option value={activeCustDesc}>{activeCustDesc}</option>
                              )}
                              
                              {facilitiesInRegion.length > 0 ? (
                                <optgroup label={`Facilities strictly in ${row.region} (${facilitiesInRegion.length} in HF Master List)`}>
                                  {facilitiesInRegion.map((hf, hfIdx) => {
                                    const desc = hf.customerDescription || hf.customer;
                                    return (
                                      <option key={hf.id || hfIdx} value={desc}>
                                        {desc} {hf.customer ? `[ID: ${hf.customer}]` : ''}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              ) : (
                                <option value="" disabled>
                                  No health facilities for {row.region} in HF Master List
                                </option>
                              )}
                            </select>

                            <div className="text-[10px] text-amber-800/80 font-medium px-0.5 flex items-center justify-between">
                              <span className="font-bold text-amber-900">{row.region} Master Link:</span>
                              {matchedHf ? <span className="font-mono text-emerald-700 font-bold">✓ Verified ({matchedHf.customer})</span> : <span className="text-amber-700 italic">Custom Entry</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 flex items-center justify-between group">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900">{activeCustDesc}</span>
                                {custIdBadge && (
                                  <span className="font-mono text-[#8094ae] text-[11px] font-semibold select-all">
                                    #{custIdBadge}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsEditingMode(true)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-700 transition"
                                title="Edit facility name"
                              >
                                <Edit3 size={11} />
                              </button>
                            </div>
                            {matrixTemplateFormat === 'rhb' && matchedHf && matchedHf.zoneDescription && (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                                <span className="text-slate-400">{matchedHf.zoneDescription}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. List of Packeges */}
                      <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-center bg-[#dbeafe]/30 text-blue-900">
                        {isEditingMode ? (
                          <select
                            value={row.packages}
                            onChange={(e) => handleRowFieldChange(row.id, 'packages', e.target.value)}
                            className="p-1 border border-slate-200 rounded text-xs font-mono font-bold"
                          >
                            <option value="MCH">MCH</option>
                            <option value="OR">OR</option>
                            <option value="ICU">ICU</option>
                            <option value="OPD">OPD</option>
                            <option value="NICU">NICU</option>
                            <option value="Emergency">Emergency</option>
                          </select>
                        ) : (
                          row.packages
                        )}
                      </td>

                      {/* 6. HUB Column (Auto-inserted when Map HF to Hub is clicked) */}
                      {showHubColumn && (
                        <td className="p-2.5 text-center font-mono font-black border-r border-slate-200 bg-amber-100/70 text-amber-950 min-w-[90px]">
                          {row.hub || 'AA01'}
                        </td>
                      )}

                      {/* Equipment Quantity Cells (Only if not ITEM AGGREGATION mode) */}
                      {matrixTemplateFormat !== 'item' && columns.map(col => {
                        const qty = row.quantities[col.id];
                        const colTotal = columnTotals[col.id] || 0;
                        const colBase = getItemBenchmarkLimit(col);
                        const isColOver = colTotal > colBase;
                        const hasQty = qty !== undefined && qty > 0;

                        return (
                          <td 
                            key={col.id} 
                            className={`p-2.5 border-r border-slate-200 text-right font-mono font-bold transition-colors ${
                              isColOver && hasQty
                                ? 'bg-rose-100/90 text-rose-950 border-rose-300 font-black'
                                : 'text-slate-800'
                            }`}
                          >
                            {isEditingMode ? (
                              <input
                                type="number"
                                min="0"
                                value={qty !== undefined && qty !== 0 ? qty : ''}
                                placeholder="0"
                                onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                className={`w-16 p-1 border rounded text-right font-mono font-bold text-xs ${
                                  isColOver && hasQty
                                    ? 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-400'
                                    : 'border-slate-300'
                                }`}
                                title={isColOver ? `🚨 Column "${col.name}" exceeds EPSS Base Benchmark (${colTotal}/${colBase})` : ''}
                              />
                            ) : (
                              qty && qty > 0 ? (
                                <span className={isColOver ? 'text-rose-900 font-black' : ''}>{qty}</span>
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )
                            )}
                          </td>
                        );
                      })}

                      {/* Quick Add Column placeholder cell (Only if not ITEM AGGREGATION mode) */}
                      {matrixTemplateFormat !== 'item' && (
                        <td className="p-2 border-r border-slate-200 text-center bg-slate-50/20 text-slate-300 font-mono text-[10px]">
                          -
                        </td>
                      )}

                      {isEditingMode && (
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}

              {/* Inline Add Facility Row Button Row */}
              <tr className="bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
                <td colSpan={(matrixTemplateFormat === 'item' ? 5 : columns.length + 7) + (isEditingMode ? 1 : 0)} className="p-2.5 text-center">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="Click to append a new health facility row to matrix table"
                  >
                    <Plus size={14} />
                    <span>+ Add Facility Row</span>
                  </button>
                </td>
              </tr>
            </tbody>

            {/* Total Footer Row */}
            <tfoot>
              <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <td className="p-2.5 border-r border-slate-300 uppercase tracking-wider text-[11px]">
                  Total
                </td>
                <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px]">
                  -
                </td>
                <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px] text-center">
                  -
                </td>
                <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px] text-center">
                  -
                </td>
                <td className="p-2.5 border-r border-slate-300 font-black text-slate-900">
                  {filteredRows.length} Health Facilities
                </td>
                <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px] text-center font-mono font-bold bg-[#eff6ff]/30 text-blue-800">
                  -
                </td>
                {isHubMapped && (
                  <td className="p-2.5 border-r border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/60 text-[11px]">
                    -
                  </td>
                )}
                {matrixTemplateFormat !== 'item' && columns.map(col => (
                  <td 
                    key={col.id} 
                    className="p-2.5 border-r border-slate-300 text-right font-mono font-black text-amber-700 bg-amber-50/50"
                  >
                    {columnTotals[col.id] || 0}
                  </td>
                ))}
                {matrixTemplateFormat !== 'item' && (
                  <td className="p-2.5 border-r border-slate-300 text-center font-mono text-indigo-700 font-bold text-[11px] bg-indigo-50/30">
                    -
                  </td>
                )}
                {isEditingMode && <td className="p-2"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

              {/* MODAL 1: SEND TO MOH (DIRECT INSTITUTIONAL TRANSMITTAL & ITEM CONFIRMATION) */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send Region Breakdown Matrix to MOH</h3>
                  <p className="text-[11px] text-slate-400">Official Health Facility breakdown transmittal to MOH PMD Directorate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransmitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] font-black text-amber-900 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  DSP Project / Matrix Reference Title
                </label>
                <input 
                  type="text"
                  value={dspProjectName}
                  onChange={(e) => setDspProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
                />
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-slate-500 font-bold uppercase text-[10px]">
                    <span>Matrix Transmittal Payload Summary</span>
                    <span className="text-amber-600 font-mono font-bold">{selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">HEALTH FACILITIES</span>
                      <span className="font-bold text-slate-900">{filteredRows.length} Facilities</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">SELECTED ITEMS</span>
                      <span className="font-bold text-indigo-800">{columns.length} Equipment Types</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">TOTAL EARMARKED UNITS</span>
                      <span className="font-black text-emerald-700">{formatNumber(grandTotalUnits)} Units</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">TRANSMITTAL DATE</span>
                      <span className="font-bold text-slate-900 font-mono">{internalDate}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Linked with MOH PMD Health Facility Master Data</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Submitting this matrix will transmit exact Region, Zone, Woreda, Health Facility Name, Packages, and Equipment quantities directly to MOH (PMD Directorate).
                  </p>
                </div>

                {/* SELECTED EQUIPMENT ITEM CONFIRMATION TABLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black uppercase tracking-wide">Selected Items Equipment Confirmation ({columns.length})</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                      {formatNumber(grandTotalUnits)} Total Units
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">#</th>
                          <th className="py-2 px-3">Equipment Item Description</th>
                          <th className="py-2 px-3">SAP Material Code</th>
                          <th className="py-2 px-3 text-center">Assigned Facilities</th>
                          <th className="py-2 px-3 text-right">Earmarked Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {columns.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 font-sans italic">
                              No equipment items selected in table.
                            </td>
                          </tr>
                        ) : (
                          columns.map((col, idx) => {
                            const totalQty = filteredRows.reduce((sum, r) => sum + (Number(r.quantities[col.id]) || 0), 0);
                            const facCount = filteredRows.filter(r => (Number(r.quantities[col.id]) || 0) > 0).length;
                            return (
                              <tr key={col.id} className="hover:bg-amber-50/40 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 font-sans text-xs">{idx + 1}</td>
                                <td className="py-2 px-3 font-sans font-bold text-slate-900">
                                  {col.name}
                                </td>
                                <td className="py-2 px-3 text-amber-800 font-bold">
                                  {col.code || 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-center font-sans">
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                                    {facCount} Facilities
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-black text-emerald-700">
                                  {formatNumber(totalQty)} units
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right font-sans font-black text-slate-700 uppercase text-[10px]">
                            Grand Total Transmittal Quantity:
                          </td>
                          <td className="py-2 px-3 text-center font-sans text-indigo-900">
                            {filteredRows.length} Facilities
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-800 text-sm">
                            {formatNumber(grandTotalUnits)} units
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Transmittal Target Destination Selection */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTransmittalDestination('EPSS')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      transmittalDestination === 'EPSS'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to EPSS Head Office</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransmittalDestination('MOH')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      transmittalDestination === 'MOH'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Send to MOH PMD Directorate</span>
                  </button>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">Authorized Person, Role & Organization</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Authorized Person *</label>
                      <input 
                        type="text"
                        placeholder="e.g. Dr. Abebe Bikila"
                        value={manualSignatoryName}
                        onChange={(e) => setManualSignatoryName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Official Role *</label>
                      <input 
                        type="text"
                        placeholder="e.g. Director / Regional Coordinator"
                        value={manualSignatoryRole}
                        onChange={(e) => setManualSignatoryRole(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Organization *</label>
                      <input 
                        type="text"
                        placeholder="e.g. Regional Health Bureau"
                        value={manualSignatoryOrg}
                        onChange={(e) => setManualSignatoryOrg(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsTransmitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!manualSignatoryName.trim() || !manualSignatoryRole.trim()) {
                    alert('Please fill in Authorized Person and Role before transmitting.');
                    return;
                  }
                  const cleanDspName = dspProjectName || `DSP [${selectedRegionFilter === 'all' ? 'Multi-Region' : selectedRegionFilter} Allocation]`;
                  const year = new Date().getFullYear();
                  const randNum = Math.floor(100 + Math.random() * 900);
                  const brkRef = `RHB/${transmittalDestination}-BRK/${year}/${randNum}`;
                  const targetOrg = transmittalDestination === 'EPSS' ? 'EPSS Head Office' : 'MOH PMD Directorate';

                  const rhbRecord: DspWorkflowRecord = {
                    id: `dsp-rhb-${transmittalDestination.toLowerCase()}-${Date.now()}`,
                    dspRefNumber: brkRef,
                    stage: transmittalDestination === 'EPSS' ? 'epss-ho-aggregation' : 'rhb-breakdown-management',
                    subStage: transmittalDestination === 'EPSS' ? '4.1' : '3.2',
                    stageTitle: transmittalDestination === 'EPSS' ? 'EPSS Aggregated Dispatch' : 'RHB Breakdown Management',
                    senderOrg: manualSignatoryOrg || `${selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter} Regional Health Bureau`,
                    recipientOrg: transmittalDestination,
                    dspName: cleanDspName,
                    subject: `DSP [${cleanDspName}]: Regional Health Facility Breakdown Transmitted to ${targetOrg} (${filteredRows.length} Facilities)`,
                    status: 'Endorsed & Approved',
                    dateSubmitted: internalDate || new Date().toISOString().split('T')[0],
                    approvedDate: internalDate || new Date().toISOString().split('T')[0],
                    totalDevices: columns.length,
                    totalQuantity: grandTotalUnits,
                    totalValuationETB: grandTotalUnits * 250000,
                    targetedRegions: selectedRegionFilter === 'all' ? ALL_ETHIOPIAN_REGIONS : [selectedRegionFilter],
                    targetedFacilitiesCount: filteredRows.length,
                    officialLetterRef: `RHB/LET/${year}/${Math.floor(1000 + Math.random() * 9000)}`,
                    signatory: manualSignatoryName,
                    signatoryRole: manualSignatoryRole,
                    facilityMatrixData: {
                      date: internalDate,
                      region: selectedRegionFilter,
                      columns,
                      rows: filteredRows
                    },
                    itemsIncluded: columns.map(c => ({
                      material: c.code,
                      description: c.name,
                      quantity: filteredRows.reduce((sum, r) => sum + (Number(r.quantities[c.id]) || 0), 0),
                      plant: 'Addis Central ⬡'
                    })),
                    notes: `Official Health Facility Breakdown Matrix submitted by ${manualSignatoryName} (${manualSignatoryRole}, ${manualSignatoryOrg || 'RHB'}) to ${targetOrg}.`
                  };

                  try {
                    pushCentralMasterData({
                      dspReceivedMohRows: filteredRows,
                      updatedBy: `${manualSignatoryOrg || 'RHB'} - ${manualSignatoryName}`,
                      updateKind: `Transmit Region Breakdown Matrix to ${targetOrg} (${filteredRows.length} Facilities, ${grandTotalUnits} Units)`
                    });
                  } catch (e) {
                    console.warn(e);
                  }
                  setIsTransmitModalOpen(false);
                  showToast(`✓ Regional Breakdown Matrix (${filteredRows.length} Facilities) successfully transmitted to ${targetOrg} by ${manualSignatoryName}!`);
                }}
                className={`px-5 py-2.5 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 text-xs ${
                  transmittalDestination === 'EPSS'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-slate-900 hover:bg-black text-amber-400'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm Transmit to {transmittalDestination}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND VIA EMAIL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send Region Breakdown Matrix via Email</h3>
                  <p className="text-[11px] text-slate-400">Dispatch matrix payload to Ministry of Health PMD Directorate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">To (MOH Email)</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CC (EPSS Email)</label>
                  <input
                    type="email"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payload Summary Preview</label>
                <textarea
                  rows={5}
                  readOnly
                  value={`Region Breakdown Matrix (${selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter})\nTotal Health Facilities: ${filteredRows.length}\nTotal Equipment Units: ${grandTotalUnits} Units\nDate: ${internalDate}`}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-indigo-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="font-bold text-xs">DSP_Region_To_MOH_Breakdown_{selectedRegionFilter !== 'all' ? selectedRegionFilter : 'All_Regions'}_${internalDate}.xlsx</div>
                    <div className="text-[10px] text-indigo-600">Official Two-Tier Excel Attachment ({filteredRows.length} Facilities)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Download
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportExcel();
                    const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCc)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent('Please find attached the official Region Breakdown Matrix Excel file.')}`;
                    window.location.href = mailtoUrl;
                    setIsEmailModalOpen(false);
                    showToast(`✓ Excel downloaded & mail client launched for ${emailTo}`);
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Dispatch Email to MOH</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND VIA WHATSAPP */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send Region Breakdown Matrix via WhatsApp</h3>
                  <p className="text-[11px] text-slate-400">Share health facility allocation matrix directly to MOH WhatsApp Desk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">MOH WhatsApp Contact / Phone Number</label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+251911234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500 text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">WhatsApp Payload Summary</label>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `*EPSS REGIONAL BREAKDOWN MATRIX TO MOH*\nDate: ${internalDate}\nRegion: ${selectedRegionFilter}\nFacilities: ${filteredRows.length}\nTotal Units: ${grandTotalUnits}`;
                      navigator.clipboard.writeText(msg);
                      setWaCopied(true);
                      setTimeout(() => setWaCopied(false), 3000);
                      showToast('✓ WhatsApp payload copied to clipboard');
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{waCopied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  readOnly
                  value={`*🏥 ETHIOPIAN PHARMACEUTICAL SUPPLY SERVICE (EPSS)*\n*OFFICIAL REGIONAL HEALTH FACILITY BREAKDOWN MATRIX*\n*Date:* ${internalDate}\n*Region:* ${selectedRegionFilter !== 'all' ? selectedRegionFilter : 'All Regions'}\n*Facilities Count:* ${filteredRows.length}\n*Total Units:* ${formatNumber(grandTotalUnits)} Units\n\nFacilities Allocated: ${filteredRows.map(r => r.customerDescription || r.healthFacility).slice(0, 10).join(', ')}${filteredRows.length > 10 ? '...' : ''}`}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportExcel();
                    const cleanPhone = waPhone.replace(/\D/g, '');
                    const msg = `*EPSS REGIONAL BREAKDOWN MATRIX TO MOH*\nDate: ${internalDate}\nRegion: ${selectedRegionFilter}\nFacilities: ${filteredRows.length}\nTotal Units: ${grandTotalUnits}`;
                    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                    window.open(url, '_blank');
                    setIsWhatsAppModalOpen(false);
                    showToast(`✓ Opened WhatsApp Web & downloaded Excel file`);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Launch WhatsApp Web</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGIONAL HEALTH BUREAU SUBMISSION DOSSIER MODAL (Attachment 1 View) */}
      {selectedRhbDetailRegion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border-2 border-slate-900 rounded-2xl max-w-4xl w-full p-5 space-y-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shadow-sm">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base uppercase">
                      {selectedRhbDetailRegion.region} Regional Health Bureau Breakdown
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Submitted to MOH
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    DSP Reference: {selectedRhbDetailRegion.dspName} • Date: {selectedRhbDetailRegion.date}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRhbDetailRegion(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dossier Details Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Allocated Facilities</span>
                <span className="text-lg font-black font-mono text-amber-950">{selectedRhbDetailRegion.totalFacilities || 12} Health Centers / Hospitals</span>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">Equipment Items</span>
                <span className="text-lg font-black font-mono text-indigo-950">{columns.length} Configured Columns</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Total Earmarked Quantity</span>
                <span className="text-lg font-black font-mono text-emerald-950">{selectedRhbDetailRegion.totalUnits || 340} Units</span>
              </div>
            </div>

            {/* Regional Breakdown Table Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5 border-r border-slate-700">Health Facility Name</th>
                    <th className="p-2.5 border-r border-slate-700">Zone / Woreda</th>
                    <th className="p-2.5 border-r border-slate-700">Delivering ⬡</th>
                    <th className="p-2.5 text-center">Allocated Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows
                    .filter(r => r.region.toLowerCase().includes(selectedRhbDetailRegion.region.toLowerCase()) || selectedRegionFilter === 'all')
                    .slice(0, 8)
                    .map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-slate-900 border-r border-slate-200">{r.healthFacility}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-200">{r.zone} / {r.woreda}</td>
                        <td className="p-2 font-mono font-bold text-indigo-700 border-r border-slate-200">{r.hub || 'AD01'}</td>
                        <td className="p-2 text-center font-mono font-bold text-emerald-700">
                          {Object.values(r.quantities || {}).reduce((a, b) => a + (Number(b) || 0), 0) || 12}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedRegionFilter(selectedRhbDetailRegion.region);
                  setRhbSubViewMode('detailed-matrix');
                  setSelectedRhbDetailRegion(null);
                  showToast(`✓ Main Table filtered for ${selectedRhbDetailRegion.region}`);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Layers size={14} />
                <span>Switch Main Table to {selectedRhbDetailRegion.region} Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRhbDetailRegion(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 8-Column Institutional Request Selection Modal */}
      {isRequestModalOpen && (
        <div className={`fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 transition-all duration-300 ${
          isRequestModalFullScreen ? 'p-0' : ''
        }`}>
          <div className={`bg-white shadow-2xl border border-slate-200 animate-scale-in flex flex-col transition-all duration-300 ${
            isRequestModalFullScreen 
              ? 'w-full h-full rounded-none max-w-none max-h-none p-5' 
              : 'rounded-3xl max-w-5xl w-full p-6 max-h-[90vh]'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Go back / close"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Select Breakdown Request Source Data</h3>
                  <p className="text-xs text-slate-500">Choose an official request dossier from the institutional table below</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalFullScreen(!isRequestModalFullScreen)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition flex items-center gap-1.5 text-xs font-bold border border-slate-200"
                  title={isRequestModalFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
                >
                  {isRequestModalFullScreen ? (
                    <>
                      <Minimize2 className="w-4 h-4 text-amber-600" />
                      <span className="hidden md:inline">Exit Full Screen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-amber-600" />
                      <span className="hidden md:inline">Full Screen</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 border border-slate-200 rounded-2xl shadow-inner mt-4 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-900 select-none">
                    <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center italic">S/N</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-28 italic">Date</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px] italic">DSP Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-44 italic">Authorized person</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-28 italic">Organazation</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-32 italic">Role</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-28 text-center italic">Status</th>
                    <th className="py-2.5 px-3 text-center w-28 italic">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  {breakdownRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium italic">
                        No breakdown requests available.
                      </td>
                    </tr>
                  ) : (
                    breakdownRequests.map((rec, idx) => {
                      const dspInfo = getDossierDisplayInfo(rec, idx);
                      const isSelected = selectedRequestId === rec.id;
                      return (
                        <tr 
                          key={rec.id} 
                          className={`hover:bg-amber-50/40 transition-colors group border-b border-slate-100 ${
                            isSelected ? 'bg-amber-50/60 font-bold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 border-r border-slate-100 text-center font-mono text-slate-500 bg-slate-50/20 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-slate-600 font-medium text-xs">
                            {rec.dateSubmitted}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 font-bold text-slate-900 text-xs">
                            {dspInfo.dspName}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 font-medium text-slate-800 text-xs">
                            {dspInfo.authorizedPerson}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 font-bold text-slate-900 text-xs">
                            {dspInfo.organization}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 text-slate-700 font-medium text-xs">
                            {dspInfo.role}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-100 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              dspInfo.status === 'Approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {dspInfo.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectBreakdownRequest(rec.id);
                                setIsRequestModalOpen(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Select this breakdown request"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isSelected ? 'Selected' : 'View'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-500">
                Total Requests Available: <strong className="text-slate-800">{breakdownRequests.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

