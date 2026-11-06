import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Package,
  Layers,
  Search,
  Filter,
  Download,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CircleDollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  List,
  Grid,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Calendar,
  AlertOctagon,
  MapPin,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Coins,
  Boxes,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Columns,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { MedicalDeviceAgreement, MedicalDeviceItem, AgreementStatus, UploadedAgreementBatch, ProgramMdRecord } from '../types';
import { DEFAULT_MEDICAL_DEVICE_AGREEMENTS } from '../data/defaultAgreements';
import { formatNumber, formatCurrency, downloadCSV } from '../utils/formatters';
import { AgreementDetailModal } from './AgreementDetailModal';
import { AddAgreementModal } from './AddAgreementModal';
import { AgreementStatusBadge } from './AgreementStatusBadge';
import { MultipleAgreementUploadModal } from './MultipleAgreementUploadModal';
import { pushCentralMasterData } from '../utils/centralSyncService';

export interface TotalDeliveryAgreementSectionProps {
  items: MedicalDeviceItem[];
  onNavigateTab?: (tab: string) => void;
  onFilterStatus?: (status: string) => void;
  language?: string;
  onUploadBatchesGlobal?: (batches: UploadedAgreementBatch[]) => void;
  currentSubTab?: string;
  isAdmin?: boolean;
  onSelectItem?: (item: MedicalDeviceItem) => void;
  programMdRecords?: ProgramMdRecord[];
  onUploadProgramMdData?: (records: ProgramMdRecord[], mode?: 'append' | 'replace', files?: { name: string, url: string }[]) => void;
  onClearProgramMdData?: () => void;
  onAddProgramMdRecord?: (record: ProgramMdRecord) => void;
  onUpdateProgramMdRecord?: (record: ProgramMdRecord) => void;
  onDeleteProgramMdRecord?: (id: string) => void;
}

const STATUS_COLORS: Record<AgreementStatus, string> = {
  'Fully Delivered': '#10b981',
  'On Track': '#0284c7',
  'Approaching Deadline': '#f59e0b',
  'Delayed / Critical': '#e11d48',
  'Contract / LC Issue': '#8b5cf6'
};

const FUNDING_COLORS: Record<string, string> = {
  'Revolving Drug Fund (RDF)': '#0284c7',
  'Global Fund (GFATM)': '#10b981',
  'MOH Regular Treasury': '#f59e0b',
  'World Bank Health Program': '#8b5cf6',
  'UNICEF Bilateral Grant': '#ec4899',
  'Bilateral Donor / Other': '#64748b'
};

export const DEFAULT_AGREEMENT_10COL_RECORDS: ProgramMdRecord[] = [];

export const TotalDeliveryAgreementSection: React.FC<TotalDeliveryAgreementSectionProps> = ({
  items,
  onNavigateTab,
  onFilterStatus,
  language = 'en',
  onUploadBatchesGlobal,
  currentSubTab,
  isAdmin = false,
  programMdRecords = [],
  onUploadProgramMdData,
  onClearProgramMdData,
  onAddProgramMdRecord,
  onUpdateProgramMdRecord,
  onDeleteProgramMdRecord,
  onSelectItem
}) => {
  // Agreements state - initialized to empty as we strictly use cloud data
  const [agreements, setAgreements] = useState<MedicalDeviceAgreement[]>([]);

  // Uploaded Multi-Data Batches State - initialized to empty
  const [uploadedBatches, setUploadedBatches] = useState<UploadedAgreementBatch[]>([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all'); // 'all', 'baseline', or batch id
  const [isMultiUploadModalOpen, setIsMultiUploadModalOpen] = useState(false);

  // UI state & Multi-criteria filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<string>('all');
  const [selectedFunding, setSelectedFunding] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedValueBracket, setSelectedValueBracket] = useState<string>('all');
  const [customMinValue, setCustomMinValue] = useState<string>('');
  const [customMaxValue, setCustomMaxValue] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [selectedRemains, setSelectedRemains] = useState<string>('all');
  const [customMinRemains, setCustomMinRemains] = useState<string>('');
  const [customMaxRemains, setCustomMaxRemains] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('default');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'uploaded-10col' | 'cards' | 'table' | 'analytics' | 'letters'>('uploaded-10col');
  const [selectedAgreementForModal, setSelectedAgreementForModal] = useState<MedicalDeviceAgreement | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 10-Column Agreement Requisition View State (SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, Request Year)
  const [pmdSearch, setPmdSearch] = useState('');
  const [pmdStatusFilter, setPmdStatusFilter] = useState('all');
  const [pmdYearFilter, setPmdYearFilter] = useState<string>('all');
  const [pmdSupplierFilter, setPmdSupplierFilter] = useState('all');
  const [pmdOwnerFilter, setPmdOwnerFilter] = useState('all');
  const [is10ColUploadOpen, setIs10ColUploadOpen] = useState(false);
  const [upload10ColError, setUpload10ColError] = useState<string | null>(null);
  const [editing10ColRecord, setEditing10ColRecord] = useState<ProgramMdRecord | null>(null);
  const [isAdd10ColModalOpen, setIsAdd10ColModalOpen] = useState(false);
  const [rawPasted10ColText, setRawPasted10ColText] = useState('');
  const [tenColUploadTab, setTenColUploadTab] = useState<'file' | 'paste'>('file');

  // Form data for adding/editing 10-column record
  const [form10Col, setForm10Col] = useState<Omit<ProgramMdRecord, 'id'>>({
    sapPo: '',
    itemDescription: '',
    unit: 'PCS',
    quantity: 1,
    deliveryAmountEtb: 0,
    supplier: '',
    deviceOwner: '',
    currentStatus: 'Active',
    managementApproach: '',
    requestYear: new Date().getFullYear().toString()
  });

  // Effective 10-column agreement requisitions (user uploaded records or default framework sample records)
  const effective10ColRecords = useMemo(() => {
    if (programMdRecords && programMdRecords.length > 0) {
      return programMdRecords;
    }
    return DEFAULT_AGREEMENT_10COL_RECORDS;
  }, [programMdRecords]);

  // Column Visibility State for the 10 requested columns (all visible by default)
  const [visibleColumns, setVisibleColumns] = useState({
    sapPo: true,
    itemDescription: true,
    unit: true,
    quantity: true,
    deliveryAmountEtb: true,
    supplier: true,
    deviceOwner: true,
    currentStatus: true,
    managementApproach: true,
    requestYear: true
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  const visibleColumnCount = useMemo(() => {
    return Object.values(visibleColumns).filter(Boolean).length;
  }, [visibleColumns]);

  const toggleAllColumns = (val: boolean) => {
    setVisibleColumns({
      sapPo: val,
      itemDescription: val,
      unit: val,
      quantity: val,
      deliveryAmountEtb: val,
      supplier: val,
      deviceOwner: val,
      currentStatus: val,
      managementApproach: val,
      requestYear: val
    });
  };

  useEffect(() => {
    const handleClickOutsideColumns = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideColumns);
    return () => document.removeEventListener('mousedown', handleClickOutsideColumns);
  }, []);

  useEffect(() => {
    const handleSyncFromNav = () => {
      // transient state
    };

    handleSyncFromNav();
    window.addEventListener('epss:navigate_agreement_source', handleSyncFromNav);
    return () => {
      window.removeEventListener('epss:navigate_agreement_source', handleSyncFromNav);
    };
  }, []);

  const uniquePmdStatuses = useMemo(() => {
    const set = new Set<string>();
    effective10ColRecords.forEach(r => r.currentStatus && set.add(r.currentStatus));
    return Array.from(set).sort();
  }, [effective10ColRecords]);

  const uniquePmdYears = useMemo(() => {
    const set = new Set<string>();
    effective10ColRecords.forEach(r => r.requestYear && set.add(String(r.requestYear)));
    return Array.from(set).sort();
  }, [effective10ColRecords]);

  const uniquePmdSuppliers = useMemo(() => {
    const set = new Set<string>();
    effective10ColRecords.forEach(r => r.supplier && set.add(r.supplier));
    return Array.from(set).sort();
  }, [effective10ColRecords]);

  const uniquePmdOwners = useMemo(() => {
    const set = new Set<string>();
    effective10ColRecords.forEach(r => r.deviceOwner && set.add(r.deviceOwner));
    return Array.from(set).sort();
  }, [effective10ColRecords]);

  const filtered10ColRecords = useMemo(() => {
    return effective10ColRecords.filter(rec => {
      const q = pmdSearch.toLowerCase().trim();
      const matchSearch = !q ||
        rec.sapPo?.toLowerCase().includes(q) ||
        rec.itemDescription?.toLowerCase().includes(q) ||
        rec.supplier?.toLowerCase().includes(q) ||
        rec.deviceOwner?.toLowerCase().includes(q) ||
        rec.currentStatus?.toLowerCase().includes(q) ||
        rec.managementApproach?.toLowerCase().includes(q) ||
        String(rec.requestYear || '').includes(q);

      const matchStatus = pmdStatusFilter === 'all' || rec.currentStatus === pmdStatusFilter;
      const matchYear = pmdYearFilter === 'all' || String(rec.requestYear) === pmdYearFilter;
      const matchSupplier = pmdSupplierFilter === 'all' || rec.supplier === pmdSupplierFilter;
      const matchOwner = pmdOwnerFilter === 'all' || rec.deviceOwner === pmdOwnerFilter;

      return matchSearch && matchStatus && matchYear && matchSupplier && matchOwner;
    });
  }, [effective10ColRecords, pmdSearch, pmdStatusFilter, pmdYearFilter, pmdSupplierFilter, pmdOwnerFilter]);

  const total10ColQuantity = useMemo(() => {
    return filtered10ColRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [filtered10ColRecords]);

  const total10ColAmountETB = useMemo(() => {
    return filtered10ColRecords.reduce((sum, r) => sum + (Number(r.deliveryAmountEtb) || 0), 0);
  }, [filtered10ColRecords]);

  const unique10ColPOsCount = useMemo(() => {
    return new Set(filtered10ColRecords.map(r => r.sapPo).filter(Boolean)).size;
  }, [filtered10ColRecords]);

  const parse10ColRows = (rows: any[], fileName?: string): ProgramMdRecord[] => {
    const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const parsed: ProgramMdRecord[] = [];

    rows.forEach((row: any, idx) => {
      if (!row || typeof row !== 'object') return;
      let sapPo = '';
      let itemDescription = '';
      let unit = 'PCS';
      let quantity = 0;
      let deliveryAmountEtb = 0;
      let supplier = '';
      let deviceOwner = '';
      let currentStatus = 'Active';
      let managementApproach = '';
      let requestYear: string = new Date().getFullYear().toString();

      Object.keys(row).forEach(rawKey => {
        const norm = normalizeKey(rawKey);
        const val = row[rawKey];
        if (val === undefined || val === null) return;

        if (norm.includes('sappo') || norm.includes('ponumber') || norm === 'po' || norm.includes('purchaseorder') || norm.includes('sap')) {
          sapPo = String(val).trim();
        } else if (norm.includes('itemdescription') || norm.includes('materialdescription') || norm === 'description' || norm === 'item') {
          itemDescription = String(val).trim();
        } else if (norm === 'unit' || norm === 'uom' || norm.includes('unitofmeasure')) {
          unit = String(val).trim();
        } else if (norm.includes('quantity') || norm === 'qty') {
          quantity = Number(val) || 0;
        } else if (norm.includes('deliveryamount') || norm.includes('amountinetb') || norm.includes('etb') || norm.includes('deliverycost') || norm.includes('totalamount') || norm === 'amount') {
          deliveryAmountEtb = Number(val) || 0;
        } else if (norm.includes('supplier') || norm.includes('vendor')) {
          supplier = String(val).trim();
        } else if (norm.includes('deviceowner') || norm.includes('owner') || norm.includes('facility') || norm.includes('healthfacility') || norm.includes('hospital')) {
          deviceOwner = String(val).trim();
        } else if (norm.includes('currentstatus') || norm === 'status' || norm === 'stage') {
          currentStatus = String(val).trim();
        } else if (norm.includes('managementapproach') || norm.includes('approach') || norm.includes('strategy')) {
          managementApproach = String(val).trim();
        } else if (norm.includes('requestyear') || norm === 'year' || norm.includes('reqyear')) {
          requestYear = String(val).trim();
        }
      });

      if (itemDescription || sapPo || supplier || deviceOwner) {
        parsed.push({
          id: `pmd-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          sapPo,
          itemDescription: itemDescription || 'Medical Device Equipment Requisition',
          unit: unit || 'PCS',
          quantity,
          deliveryAmountEtb,
          supplier,
          deviceOwner: deviceOwner || 'Health Facility',
          currentStatus: currentStatus || 'Active',
          managementApproach: managementApproach || 'Standard Procurement',
          requestYear,
          uploadedAt: new Date().toISOString(),
          sourceFile: fileName || 'Uploaded File'
        });
      }
    });

    return parsed;
  };

  const handle10ColFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpload10ColError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (!rows || rows.length === 0) {
          setUpload10ColError('The selected spreadsheet appears to be empty.');
          return;
        }
        const parsed = parse10ColRows(rows, file.name);
        if (parsed.length === 0) {
          setUpload10ColError('Could not find valid columns. Required: SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, Request Year.');
          return;
        }
        onUploadProgramMdData?.(parsed, 'append', [{ name: file.name, url: '' }]);
        setIs10ColUploadOpen(false);
      } catch (err: any) {
        setUpload10ColError(`Error parsing spreadsheet: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handle10ColPasteUpload = () => {
    if (!rawPasted10ColText.trim()) {
      setUpload10ColError('Please paste tab- or comma-separated rows.');
      return;
    }
    try {
      const lines = rawPasted10ColText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setUpload10ColError('Pasted text must include a header line and at least one data row.');
        return;
      }
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, hIdx) => {
          rowObj[h] = cols[hIdx] !== undefined ? cols[hIdx] : '';
        });
        rows.push(rowObj);
      }
      const parsed = parse10ColRows(rows, 'Pasted Data');
      if (parsed.length === 0) {
        setUpload10ColError('Could not find valid columns in pasted content.');
        return;
      }
      onUploadProgramMdData?.(parsed, 'append', [{ name: 'Pasted Agreement Requisitions', url: '' }]);
      setRawPasted10ColText('');
      setIs10ColUploadOpen(false);
    } catch (err: any) {
      setUpload10ColError(`Failed to parse pasted data: ${err.message || err}`);
    }
  };

  const export10ColToExcel = () => {
    if (filtered10ColRecords.length === 0) return;
    const exportData = filtered10ColRecords.map(r => ({
      'SAP PO': r.sapPo,
      'Item Description': r.itemDescription,
      'Unit': r.unit,
      'Quantity': r.quantity,
      'Delivery Amount in ETB': r.deliveryAmountEtb,
      'Supplier': r.supplier,
      'Device Owner': r.deviceOwner,
      'Current Status': r.currentStatus,
      'Management Approach': r.managementApproach,
      'Request Year': r.requestYear
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreement Requisitions');
    XLSX.writeFile(wb, 'EPSS_Agreement_Requisitions_10_Columns.xlsx');
  };

  const export10ColToCSV = () => {
    if (filtered10ColRecords.length === 0) return;
    const exportData = filtered10ColRecords.map(r => ({
      'SAP PO': r.sapPo,
      'Item Description': r.itemDescription,
      'Unit': r.unit,
      'Quantity': r.quantity,
      'Delivery Amount in ETB': r.deliveryAmountEtb,
      'Supplier': r.supplier,
      'Device Owner': r.deviceOwner,
      'Current Status': r.currentStatus,
      'Management Approach': r.managementApproach,
      'Request Year': r.requestYear
    }));
    downloadCSV('EPSS_Agreement_Requisitions_10_Columns.csv', exportData);
  };

  const download10ColTemplate = () => {
    const templateData = [
      {
        'SAP PO': 'PO-450012891',
        'Item Description': 'Digital Diagnostic Ultrasound Scanner',
        'Unit': 'SET',
        'Quantity': 12,
        'Delivery Amount in ETB': 18500000,
        'Supplier': 'Mindray Biomedical Co.',
        'Device Owner': 'St. Paul Millennium Hospital',
        'Current Status': 'Active',
        'Management Approach': 'Framework Agreement',
        'Request Year': '2026'
      },
      {
        'SAP PO': 'PO-450012892',
        'Item Description': 'ICU Mechanical Ventilator',
        'Unit': 'UNIT',
        'Quantity': 8,
        'Delivery Amount in ETB': 14200000,
        'Supplier': 'Getinge Medical Solutions',
        'Device Owner': 'Tikur Anbessa Hospital',
        'Current Status': 'In Transit',
        'Management Approach': 'Turnkey Supply',
        'Request Year': '2026'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreement_Template');
    XLSX.writeFile(wb, 'Agreement_10_Columns_Template.xlsx');
  };

  useEffect(() => {
    if (currentSubTab === 'agreement-delivery-rate') {
      setViewMode('analytics');
    } else if (currentSubTab === 'agreement-cards') {
      setViewMode('cards');
    } else if (currentSubTab === 'agreement-procurement-status') {
      setViewMode('table');
    } else if (currentSubTab === 'agreement-official-letter') {
      setViewMode('letters');
    } else {
      // Default view when clicking Agreement: 10 standard columns are visible immediately!
      setViewMode('uploaded-10col');
    }
  }, [currentSubTab]);

  // Sync agreements to Supabase
  useEffect(() => {
    pushCentralMasterData({ agreements, updateKind: `Agreements Sync (${agreements.length} items)` });
  }, [agreements]);

  // Sync uploaded batches to Supabase
  useEffect(() => {
    pushCentralMasterData({ uploadedAgreementBatches: uploadedBatches, updateKind: `Uploaded Batches Sync (${uploadedBatches.length} batches)` });
  }, [uploadedBatches]);

  // Aggregate active agreements depending on selected batch filter
  const allActiveAgreements = useMemo(() => {
    if (selectedBatchFilter === 'baseline') {
      return agreements;
    }
    if (selectedBatchFilter !== 'all') {
      const foundBatch = uploadedBatches.find((b) => b.id === selectedBatchFilter);
      return foundBatch ? foundBatch.agreements : [];
    }
    // 'all': base agreements plus all uploaded batches
    const batchAccords = uploadedBatches.flatMap((b) => b.agreements);
    return [...agreements, ...batchAccords];
  }, [agreements, uploadedBatches, selectedBatchFilter]);

  // Comparative batch data for analysis matrix
  const batchComparisonData = useMemo(() => {
    if (uploadedBatches.length === 0) return [];

    const baseAgreed = agreements.reduce((s, a) => s + a.totalAgreedUnits, 0);
    const baseDelivered = agreements.reduce((s, a) => s + a.deliveredUnits, 0);
    const baseRemains = agreements.reduce((s, a) => s + Math.max(0, a.totalAgreedUnits - a.deliveredUnits), 0);
    const baseTotalVal = agreements.reduce((s, a) => s + a.totalContractValueETB, 0);
    const baseDeliveredVal = agreements.reduce((s, a) => s + a.deliveredValueETB, 0);

    const baseRow = {
      id: 'baseline',
      name: 'Base EPSS Framework Accords',
      source: 'EPSS Core Procurement',
      period: 'FY 2025/2026',
      accordCount: agreements.length,
      agreedUnits: baseAgreed,
      deliveredUnits: baseDelivered,
      remainsUnits: baseRemains,
      totalValueETB: baseTotalVal,
      deliveredValueETB: baseDeliveredVal,
      fulfillmentRate: baseAgreed > 0 ? Math.round((baseDelivered / baseAgreed) * 100) : 0
    };

    const batchRows = uploadedBatches.map((b) => {
      const agreed = b.agreements.reduce((s, a) => s + a.totalAgreedUnits, 0);
      const delivered = b.agreements.reduce((s, a) => s + a.deliveredUnits, 0);
      const remains = b.agreements.reduce((s, a) => s + Math.max(0, a.totalAgreedUnits - a.deliveredUnits), 0);
      const totalVal = b.agreements.reduce((s, a) => s + a.totalContractValueETB, 0);
      const deliveredVal = b.agreements.reduce((s, a) => s + a.deliveredValueETB, 0);

      return {
        id: b.id,
        name: b.batchName,
        source: b.source,
        period: b.timePeriod,
        accordCount: b.agreements.length,
        agreedUnits: agreed,
        deliveredUnits: delivered,
        remainsUnits: remains,
        totalValueETB: totalVal,
        deliveredValueETB: deliveredVal,
        fulfillmentRate: agreed > 0 ? Math.round((delivered / agreed) * 100) : 0
      };
    });

    return [baseRow, ...batchRows];
  }, [agreements, uploadedBatches]);

  // Dynamically reconcile live inventory with agreements
  // If active items contain items from Mindray, GE, Roche, Siemens, etc., update metrics
  const liveAgreements = useMemo(() => {
    return allActiveAgreements.map((agr) => {
      // If agreement has keywords, calculate live matching units in inventory
      const keywords = (agr.linkedKeywords || []).map((k) => k.toLowerCase());
      const supplierNorm = (agr.supplier || '').toLowerCase();

      const matchingItems = items.filter((item) => {
        const desc = (item.materialDescription || '').toLowerCase();
        const mfg = (item.manufacturer || '').toLowerCase();
        const issue = (item.contractIssue || '').toLowerCase();
        if (supplierNorm && mfg.includes(supplierNorm.split(' ')[0])) return true;
        if (issue.includes(agr.agreementNumber.toLowerCase())) return true;
        return keywords.some((kw) => desc.includes(kw) || mfg.includes(kw));
      });

      // If active items match, calculate live physical counts
      const liveDeliveredFromItems = matchingItems
        .filter((it) => it.deliveryStatus === 'Delivered & Dispatched' || (!it.deliveryStatus && !it.isNotFunctional))
        .reduce((sum, it) => sum + (it.qty || 0), 0);

      const liveTransitFromItems = matchingItems
        .filter((it) => it.deliveryStatus === 'In Transit')
        .reduce((sum, it) => sum + (it.qty || 0), 0);

      const liveCustomsFromItems = matchingItems
        .filter((it) => it.deliveryStatus === 'Port Customs Clearance')
        .reduce((sum, it) => sum + (it.qty || 0), 0);

      // Use live counts if greater than 0, otherwise maintain baseline agreement stats
      const effectiveDelivered = Math.max(agr.deliveredUnits, liveDeliveredFromItems);
      const effectiveTransit = Math.max(agr.inTransitUnits, liveTransitFromItems);
      const effectiveCustoms = Math.max(agr.customsUnits, liveCustomsFromItems);
      const effectivePending = Math.max(0, agr.totalAgreedUnits - effectiveDelivered - effectiveTransit - effectiveCustoms);
      
      const effectiveDeliveredVal = agr.totalAgreedUnits > 0
        ? Math.round((effectiveDelivered / agr.totalAgreedUnits) * agr.totalContractValueETB)
        : agr.deliveredValueETB;

      return {
        ...agr,
        deliveredUnits: effectiveDelivered,
        inTransitUnits: effectiveTransit,
        customsUnits: effectiveCustoms,
        pendingUnits: effectivePending,
        deliveredValueETB: effectiveDeliveredVal
      };
    });
  }, [allActiveAgreements, items]);

  // Overall Delivery Agreement KPI Calculations
  const metrics = useMemo(() => {
    let totalAgreed = 0;
    let totalDelivered = 0;
    let totalInTransit = 0;
    let totalCustoms = 0;
    let totalPending = 0;
    let totalValue = 0;
    let deliveredValue = 0;
    let criticalIssuesCount = 0;
    let fullyDeliveredCount = 0;

    liveAgreements.forEach((a) => {
      totalAgreed += a.totalAgreedUnits;
      totalDelivered += a.deliveredUnits;
      totalInTransit += a.inTransitUnits;
      totalCustoms += a.customsUnits;
      totalPending += a.pendingUnits;
      totalValue += a.totalContractValueETB;
      deliveredValue += a.deliveredValueETB;
      if (a.status === 'Delayed / Critical' || a.status === 'Contract / LC Issue') {
        criticalIssuesCount++;
      }
      if (a.status === 'Fully Delivered' || a.deliveredUnits >= a.totalAgreedUnits) {
        fullyDeliveredCount++;
      }
    });

    const fulfillmentRate = totalAgreed > 0 ? Math.round((totalDelivered / totalAgreed) * 100) : 0;
    const financialRate = totalValue > 0 ? Math.round((deliveredValue / totalValue) * 100) : 0;

    return {
      totalAgreements: liveAgreements.length,
      totalAgreed,
      totalDelivered,
      totalInTransit,
      totalCustoms,
      totalPending,
      totalValue,
      deliveredValue,
      fulfillmentRate,
      financialRate,
      criticalIssuesCount,
      fullyDeliveredCount
    };
  }, [liveAgreements]);

  // Schedule status breakdown counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: liveAgreements.length,
      'On Track': 0,
      'Approaching Deadline': 0,
      'Delayed / Critical': 0,
      'Contract / LC Issue': 0,
      'Fully Delivered': 0
    };
    liveAgreements.forEach((agr) => {
      if (counts[agr.status] !== undefined) {
        counts[agr.status]++;
      }
    });
    return counts;
  }, [liveAgreements]);

  // Dynamic list of Health Facilities / EPSS Hubs extracted from agreements and inventory
  const healthFacilities = useMemo(() => {
    const facilityMap: Record<string, { count: number; totalUnits: number }> = {};

    liveAgreements.forEach((agr) => {
      (agr.assignedPlants || []).forEach((plant) => {
        const trimmed = plant.trim();
        if (!trimmed) return;
        if (!facilityMap[trimmed]) {
          facilityMap[trimmed] = { count: 0, totalUnits: 0 };
        }
        facilityMap[trimmed].count += 1;
        facilityMap[trimmed].totalUnits += agr.totalAgreedUnits;
      });
    });

    // Also include any plantName from items if not present
    items.forEach((item) => {
      const pName = (item.plantName || '').trim();
      if (pName && !facilityMap[pName]) {
        facilityMap[pName] = { count: 0, totalUnits: 0 };
      }
    });

    return Object.entries(facilityMap)
      .map(([name, stat]) => ({
        name,
        agreementCount: stat.count,
        totalUnits: stat.totalUnits
      }))
      .sort((a, b) => {
        if (a.name.includes('All 19')) return -1;
        if (b.name.includes('All 19')) return 1;
        if (a.name.includes('Addis Ababa')) return -1;
        if (b.name.includes('Addis Ababa')) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [liveAgreements, items]);

  // Value bracket distribution counts
  const valueCounts = useMemo(() => {
    let under100m = 0;
    let from100mTo150m = 0;
    let over150m = 0;
    liveAgreements.forEach((a) => {
      const v = a.totalContractValueETB;
      if (v < 100_000_000) under100m++;
      else if (v <= 150_000_000) from100mTo150m++;
      else over150m++;
    });
    return { all: liveAgreements.length, under100m, from100mTo150m, over150m };
  }, [liveAgreements]);

  // Remains bracket distribution counts (unfulfilled units)
  const remainsCounts = useMemo(() => {
    let hasRemains = 0;
    let zeroRemains = 0;
    let under150 = 0;
    let from150To300 = 0;
    let over300 = 0;
    liveAgreements.forEach((a) => {
      const rem = Math.max(0, a.totalAgreedUnits - a.deliveredUnits);
      if (rem === 0) {
        zeroRemains++;
      } else {
        hasRemains++;
        if (rem <= 150) under150++;
        else if (rem <= 300) from150To300++;
        else over300++;
      }
    });
    return { all: liveAgreements.length, hasRemains, zeroRemains, under150, from150To300, over300 };
  }, [liveAgreements]);

  // Filtered and Sorted Agreements
  const filteredAgreements = useMemo(() => {
    const list = liveAgreements.filter((agr) => {
      // 1. Text Search across identifiers, names, suppliers, and assigned health facilities
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = agr.agreementNumber.toLowerCase().includes(q);
        const matchTitle = agr.title.toLowerCase().includes(q);
        const matchSupplier = agr.supplier.toLowerCase().includes(q);
        const matchPkg = agr.procurementPackage.toLowerCase().includes(q);
        const matchFunding = agr.fundingSource.toLowerCase().includes(q);
        const matchPlants = (agr.assignedPlants || []).some((p) => p.toLowerCase().includes(q));
        if (!matchNumber && !matchTitle && !matchSupplier && !matchPkg && !matchFunding && !matchPlants) {
          return false;
        }
      }

      // 2. Schedule Delivery Status Filter
      if (selectedStatus !== 'all' && agr.status !== selectedStatus) {
        return false;
      }

      // 3. Procurement Package Filter
      if (selectedPackage !== 'all' && agr.procurementPackage !== selectedPackage) {
        return false;
      }

      // 4. Funding Stream Filter
      if (selectedFunding !== 'all' && agr.fundingSource !== selectedFunding) {
        return false;
      }

      // 5. Value Filter (Total Contract Value ETB)
      const val = agr.totalContractValueETB;
      if (selectedValueBracket === 'under_100m' && val >= 100_000_000) {
        return false;
      }
      if (selectedValueBracket === '100m_150m' && (val < 100_000_000 || val > 150_000_000)) {
        return false;
      }
      if (selectedValueBracket === 'over_150m' && val <= 150_000_000) {
        return false;
      }
      if (selectedValueBracket === 'custom') {
        const min = customMinValue.trim() ? parseFloat(customMinValue) : null;
        const max = customMaxValue.trim() ? parseFloat(customMaxValue) : null;
        if (min !== null && !isNaN(min) && val < min) return false;
        if (max !== null && !isNaN(max) && val > max) return false;
      }
      // Direct custom input support even if bracket isn't explicitly set to 'custom'
      if (customMinValue.trim()) {
        const minVal = parseFloat(customMinValue);
        if (!isNaN(minVal) && val < minVal) return false;
      }
      if (customMaxValue.trim()) {
        const maxVal = parseFloat(customMaxValue);
        if (!isNaN(maxVal) && val > maxVal) return false;
      }

      // 6. Health Facility / EPSS Regional Hub Filter
      if (selectedFacility !== 'all') {
        const facQuery = selectedFacility.toLowerCase().trim();
        const matchesAssigned = (agr.assignedPlants || []).some((plant) => {
          const p = plant.toLowerCase();
          if (p === facQuery) return true;
          if (p.includes('all 19') || p.includes('all regional') || p.includes('all epss hubs')) return true;
          return p.includes(facQuery) || facQuery.includes(p);
        });

        // Also check if any inventory item linked to this agreement resides at this health facility
        const matchesLinkedItems = items.some((item) => {
          const itemFacility = (item.plantName || item.wh || '').toLowerCase();
          if (!itemFacility) return false;
          const isItemLinked =
            (agr.linkedKeywords || []).some((kw) => (item.materialDescription || '').toLowerCase().includes(kw.toLowerCase())) ||
            (item.contractIssue || '').toLowerCase().includes(agr.agreementNumber.toLowerCase()) ||
            ((agr.supplier || '').toLowerCase().split(' ')[0] && (item.manufacturer || '').toLowerCase().includes((agr.supplier || '').toLowerCase().split(' ')[0]));

          return isItemLinked && (itemFacility.includes(facQuery) || facQuery.includes(itemFacility));
        });

        if (!matchesAssigned && !matchesLinkedItems) {
          return false;
        }
      }

      // 7. Request Year Filter
      if (selectedYear !== 'all' && new Date(agr.contractSignDate).getFullYear().toString() !== selectedYear) {
        return false;
      }

      // 8. Remains Filter (Outstanding Units Contracted minus Delivered)
      const remains = Math.max(0, agr.totalAgreedUnits - agr.deliveredUnits);
      if (selectedRemains === 'has_remains' && remains === 0) {
        return false;
      }
      if (selectedRemains === 'zero_remains' && remains > 0) {
        return false;
      }
      if (selectedRemains === 'under_150' && (remains === 0 || remains > 150)) {
        return false;
      }
      if (selectedRemains === '150_300' && (remains < 150 || remains > 300)) {
        return false;
      }
      if (selectedRemains === 'over_300' && remains <= 300) {
        return false;
      }
      if (selectedRemains === 'custom') {
        const minR = customMinRemains.trim() ? parseInt(customMinRemains, 10) : null;
        const maxR = customMaxRemains.trim() ? parseInt(customMaxRemains, 10) : null;
        if (minR !== null && !isNaN(minR) && remains < minR) return false;
        if (maxR !== null && !isNaN(maxR) && remains > maxR) return false;
      }
      // Direct custom remains unit inputs
      if (customMinRemains.trim()) {
        const minRem = parseInt(customMinRemains, 10);
        if (!isNaN(minRem) && remains < minRem) return false;
      }
      if (customMaxRemains.trim()) {
        const maxRem = parseInt(customMaxRemains, 10);
        if (!isNaN(maxRem) && remains > maxRem) return false;
      }

      return true;
    });

    // Multi-attribute sorting
    list.sort((a, b) => {
      const remA = Math.max(0, a.totalAgreedUnits - a.deliveredUnits);
      const remB = Math.max(0, b.totalAgreedUnits - b.deliveredUnits);

      if (sortBy === 'value_desc') return b.totalContractValueETB - a.totalContractValueETB;
      if (sortBy === 'value_asc') return a.totalContractValueETB - b.totalContractValueETB;
      if (sortBy === 'remains_desc') return remB - remA;
      if (sortBy === 'remains_asc') return remA - remB;
      if (sortBy === 'rate_desc') {
        const rA = a.totalAgreedUnits > 0 ? a.deliveredUnits / a.totalAgreedUnits : 0;
        const rB = b.totalAgreedUnits > 0 ? b.deliveredUnits / b.totalAgreedUnits : 0;
        return rB - rA;
      }
      if (sortBy === 'rate_asc') {
        const rA = a.totalAgreedUnits > 0 ? a.deliveredUnits / a.totalAgreedUnits : 0;
        const rB = b.totalAgreedUnits > 0 ? b.deliveredUnits / b.totalAgreedUnits : 0;
        return rA - rB;
      }
      if (sortBy === 'target_desc') return b.totalAgreedUnits - a.totalAgreedUnits;
      if (sortBy === 'target_asc') return a.totalAgreedUnits - b.totalAgreedUnits;

      // Default: prioritize Delayed/Critical, then delivery date
      if (a.status === 'Delayed / Critical' && b.status !== 'Delayed / Critical') return -1;
      if (b.status === 'Delayed / Critical' && a.status !== 'Delayed / Critical') return 1;
      return new Date(a.committedDeliveryDate).getTime() - new Date(b.committedDeliveryDate).getTime();
    });

    return list;
  }, [
    liveAgreements,
    items,
    searchQuery,
    selectedStatus,
    selectedPackage,
    selectedFunding,
    selectedValueBracket,
    customMinValue,
    customMaxValue,
    selectedFacility,
    selectedRemains,
    customMinRemains,
    customMaxRemains,
    sortBy,
    selectedYear
  ]);

  // Aggregate metrics across currently filtered dataset
  const filteredMetrics = useMemo(() => {
    let totalAgreed = 0;
    let totalDelivered = 0;
    let totalValue = 0;
    let deliveredValue = 0;
    let totalRemainsUnits = 0;
    let totalRemainsValue = 0;

    filteredAgreements.forEach((agr) => {
      totalAgreed += agr.totalAgreedUnits;
      totalDelivered += agr.deliveredUnits;
      totalValue += agr.totalContractValueETB;
      deliveredValue += agr.deliveredValueETB;
      const rem = Math.max(0, agr.totalAgreedUnits - agr.deliveredUnits);
      totalRemainsUnits += rem;
      const remVal = agr.totalAgreedUnits > 0 ? Math.round((rem / agr.totalAgreedUnits) * agr.totalContractValueETB) : 0;
      totalRemainsValue += remVal;
    });

    return {
      count: filteredAgreements.length,
      totalAgreed,
      totalDelivered,
      totalValue,
      deliveredValue,
      totalRemainsUnits,
      totalRemainsValue,
      fulfillmentRate: totalAgreed > 0 ? Math.round((totalDelivered / totalAgreed) * 100) : 0
    };
  }, [filteredAgreements]);

  // Check if any filter is active
  const isAnyFilterActive =
    searchQuery.trim() !== '' ||
    selectedStatus !== 'all' ||
    selectedPackage !== 'all' ||
    selectedFunding !== 'all' ||
    selectedValueBracket !== 'all' ||
    customMinValue.trim() !== '' ||
    customMaxValue.trim() !== '' ||
    selectedFacility !== 'all' ||
    selectedRemains !== 'all' ||
    customMinRemains.trim() !== '' ||
    customMaxRemains.trim() !== '' ||
    sortBy !== 'default' ||
    selectedYear !== 'all';

  // Handler to reset all filters to default
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedPackage('all');
    setSelectedFunding('all');
    setSelectedValueBracket('all');
    setCustomMinValue('');
    setCustomMaxValue('');
    setSelectedFacility('all');
    setSelectedRemains('all');
    setCustomMinRemains('');
    setCustomMaxRemains('');
    setSortBy('default');
    setSelectedYear('all');
  };

  // Chart Data: Agreement Fulfillment Comparison
  const agreementBarChartData = useMemo(() => {
    return liveAgreements.map((agr) => ({
      name: agr.agreementNumber.replace('AGR-', ''),
      title: agr.title,
      agreed: agr.totalAgreedUnits,
      delivered: agr.deliveredUnits,
      pipeline: agr.inTransitUnits + agr.customsUnits,
      pending: agr.pendingUnits,
      rate: agr.totalAgreedUnits > 0 ? Math.round((agr.deliveredUnits / agr.totalAgreedUnits) * 100) : 0
    }));
  }, [liveAgreements]);

  // Chart Data: Funding Source Donut
  const fundingDonutData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    liveAgreements.forEach((agr) => {
      const src = agr.fundingSource || 'Other';
      if (!map[src]) map[src] = { count: 0, value: 0 };
      map[src].count += 1;
      map[src].value += agr.totalContractValueETB;
    });
    return Object.entries(map).map(([name, stat]) => ({
      name,
      count: stat.count,
      value: stat.value,
      color: FUNDING_COLORS[name] || '#64748b'
    }));
  }, [liveAgreements]);

  // Chart Data: Status Pie
  const statusPieData = useMemo(() => {
    const map: Record<string, number> = {};
    liveAgreements.forEach((agr) => {
      map[agr.status] = (map[agr.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({
      name,
      value: count,
      color: STATUS_COLORS[name as AgreementStatus] || '#64748b'
    }));
  }, [liveAgreements]);

  // Annual Delivery Volume and Value for MD Agreements
  const annualDeliveryMetrics = useMemo(() => {
    const annualData: Record<string, { deliveredValue: number; items: number; lineItems: number }> = {};
    
    if (effective10ColRecords && effective10ColRecords.length > 0) {
      effective10ColRecords.forEach((rec) => {
        const year = String(rec.requestYear || '2026');
        if (!annualData[year]) {
          annualData[year] = { deliveredValue: 0, items: 0, lineItems: 0 };
        }
        annualData[year].deliveredValue += (Number(rec.deliveryAmountEtb) || 0);
        annualData[year].items += (Number(rec.quantity) || 1);
        annualData[year].lineItems += 1;
      });
    } else {
      liveAgreements.forEach((agr) => {
        const year = new Date(agr.contractSignDate).getFullYear().toString();
        if (!annualData[year]) annualData[year] = { deliveredValue: 0, items: 0, lineItems: 0 };
        annualData[year].deliveredValue += agr.deliveredValueETB;
        annualData[year].items += agr.totalAgreedUnits;
        annualData[year].lineItems += 1;
      });
    }

    return Object.entries(annualData)
      .map(([year, data]) => ({
        year,
        ...data,
        lineItems: data.lineItems || data.items
      }))
      .sort((a, b) => Number(a.year) - Number(b.year));
  }, [liveAgreements, effective10ColRecords]);

  // Reset to default agreements
  const handleResetDefaults = () => {
    if (window.confirm('Reset all agreements to the standard EPSS National Framework Accords? Custom agreements will be cleared.')) {
      setAgreements(DEFAULT_MEDICAL_DEVICE_AGREEMENTS);
    }
  };

  // Add agreement
  const handleAddAgreement = (newAgr: MedicalDeviceAgreement) => {
    setAgreements((prev) => [newAgr, ...prev]);
  };

  // Multiple Data Batches Handlers
  const handleBatchesUploaded = (newBatches: UploadedAgreementBatch[]) => {
    setUploadedBatches((prev) => [...prev, ...newBatches]);
    setSelectedBatchFilter('all');
    if (onUploadBatchesGlobal) {
      onUploadBatchesGlobal(newBatches);
    }
  };

  const handleRemoveBatch = (batchId: string) => {
    setUploadedBatches((prev) => prev.filter((b) => b.id !== batchId));
    if (selectedBatchFilter === batchId) {
      setSelectedBatchFilter('all');
    }
  };

  const handleClearAllBatches = () => {
    if (window.confirm('Clear all uploaded agreement datasets and return to standard framework accords?')) {
      setUploadedBatches([]);
      setSelectedBatchFilter('all');
    }
  };

  // Export CSV (exports active filtered view or complete database)
  const handleExportAllAgreementsCSV = () => {
    const datasetToExport = isAnyFilterActive ? filteredAgreements : liveAgreements;
    const exportData = datasetToExport.map((agr) => {
      const remains = Math.max(0, agr.totalAgreedUnits - agr.deliveredUnits);
      const remainsVal = agr.totalAgreedUnits > 0 ? Math.round((remains / agr.totalAgreedUnits) * agr.totalContractValueETB) : 0;
      return {
        'Agreement Number': agr.agreementNumber,
        'Title': agr.title,
        'Supplier': agr.supplier,
        'Supplier Country': agr.supplierCountry || '',
        'Package': agr.procurementPackage,
        'Funding Source': agr.fundingSource,
        'Data Source / Batch': agr.uploadBatchName || 'Base EPSS Framework',
        'Contract Sign Date': agr.contractSignDate,
        'Committed Delivery Date': agr.committedDeliveryDate,
        'Total Agreed Units': agr.totalAgreedUnits,
        'Delivered Units': agr.deliveredUnits,
        'Remains (Units)': remains,
        'Remains Value (ETB)': remainsVal,
        'In Transit Units': agr.inTransitUnits,
        'Customs Units': agr.customsUnits,
        'Pending Units': agr.pendingUnits,
        'Delivery Fulfillment %': `${agr.totalAgreedUnits > 0 ? Math.round((agr.deliveredUnits / agr.totalAgreedUnits) * 100) : 0}%`,
        'Total Contract Value (ETB)': agr.totalContractValueETB,
        'Delivered Value (ETB)': agr.deliveredValueETB,
        'Status': agr.status,
        'SLA Compliance Score %': `${agr.slaComplianceScore}%`,
        'Warranty (Years)': agr.warrantyYears,
        'Maintenance Terms': agr.maintenanceTerms,
        'Assigned Health Facilities & Hubs': agr.assignedPlants.join('; ')
      };
    });
    const filename = isAnyFilterActive
      ? `Filtered_Medical_Device_Agreements_${filteredAgreements.length}_Records.csv`
      : 'Total_Delivery_Medical_Device_Agreements_Report.csv';
    downloadCSV(filename, exportData);
  };

  const getStatusBadge = (status: AgreementStatus) => {
    switch (status) {
      case 'Fully Delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'On Track':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Approaching Deadline':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Delayed / Critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Contract / LC Issue':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div id="total-delivery-agreement-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Multi-Source Ingestion Management & Batch Filter Strip */}
      {uploadedBatches.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50 to-purple-50/80 p-4 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">


            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMultiUploadModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload More</span>
              </button>
              <button
                onClick={handleClearAllBatches}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center gap-1 cursor-pointer"
                title="Clear all uploaded data batches"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Batches</span>
              </button>
            </div>
          </div>

          {/* Quick Dataset Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-thin">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">Filter Scope:</span>
            
            <button
              onClick={() => setSelectedBatchFilter('all')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedBatchFilter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>All Datasets Combined</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedBatchFilter === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {agreements.length + uploadedBatches.reduce((acc, b) => acc + b.agreements.length, 0)}
              </span>
            </button>

            <button
              onClick={() => setSelectedBatchFilter('baseline')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedBatchFilter === 'baseline'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Base EPSS Accords</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedBatchFilter === 'baseline' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {agreements.length}
              </span>
            </button>

            {uploadedBatches.map((batch) => {
              const isSelected = selectedBatchFilter === batch.id;
              const totalBatchVal = batch.agreements.reduce((sum, a) => sum + a.totalContractValueETB, 0);
              return (
                <div
                  key={batch.id}
                  className={`flex items-center rounded-xl border transition shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => setSelectedBatchFilter(batch.id)}
                    className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="truncate max-w-[150px]">{batch.batchName}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-700'}`}>
                      {batch.agreements.length}
                    </span>
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {formatCurrency(totalBatchVal, true)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBatch(batch.id);
                    }}
                    className={`pr-2.5 pl-1 py-1.5 hover:opacity-75 cursor-pointer ${isSelected ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-rose-600'}`}
                    title="Remove this uploaded batch"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Schedule Health Performance Indicator Filter Bar - Framework Agreements */}
      {viewMode !== 'uploaded-10col' && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">

          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              selectedStatus === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Statuses</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedStatus === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {statusCounts.all}
            </span>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === 'On Track' ? 'all' : 'On Track')}
            className="cursor-pointer transition"
            title="Filter agreements strictly on track"
          >
            <div className={`transition ${selectedStatus === 'On Track' ? 'ring-2 ring-sky-500 ring-offset-2 rounded-full' : 'opacity-85 hover:opacity-100'}`}>
              <AgreementStatusBadge
                status="On Track"
                variant="pill"
                size="xs"
                showScheduleDelay={false}
                className="cursor-pointer"
              />
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === 'Approaching Deadline' ? 'all' : 'Approaching Deadline')}
            className="cursor-pointer transition"
            title="Filter agreements with deadlines due within 30 days"
          >
            <div className={`transition ${selectedStatus === 'Approaching Deadline' ? 'ring-2 ring-amber-500 ring-offset-2 rounded-full' : 'opacity-85 hover:opacity-100'}`}>
              <AgreementStatusBadge
                status="Approaching Deadline"
                variant="pill"
                size="xs"
                showScheduleDelay={false}
                className="cursor-pointer"
              />
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === 'Delayed / Critical' ? 'all' : 'Delayed / Critical')}
            className="cursor-pointer transition"
            title="Filter agreements experiencing critical schedule delays"
          >
            <div className={`transition ${selectedStatus === 'Delayed / Critical' ? 'ring-2 ring-rose-500 ring-offset-2 rounded-full' : 'opacity-85 hover:opacity-100'}`}>
              <AgreementStatusBadge
                status="Delayed / Critical"
                variant="pill"
                size="xs"
                showScheduleDelay={false}
                className="cursor-pointer"
              />
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === 'Contract / LC Issue' ? 'all' : 'Contract / LC Issue')}
            className="cursor-pointer transition"
            title="Filter agreements blocked by Letter of Credit or contract disputes"
          >
            <div className={`transition ${selectedStatus === 'Contract / LC Issue' ? 'ring-2 ring-purple-500 ring-offset-2 rounded-full' : 'opacity-85 hover:opacity-100'}`}>
              <AgreementStatusBadge
                status="Contract / LC Issue"
                variant="pill"
                size="xs"
                showScheduleDelay={false}
                className="cursor-pointer"
              />
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === 'Fully Delivered' ? 'all' : 'Fully Delivered')}
            className="cursor-pointer transition"
            title="Filter agreements with 100% consignment delivered"
          >
            <div className={`transition ${selectedStatus === 'Fully Delivered' ? 'ring-2 ring-emerald-500 ring-offset-2 rounded-full' : 'opacity-85 hover:opacity-100'}`}>
              <AgreementStatusBadge
                status="Fully Delivered"
                variant="pill"
                size="xs"
                showScheduleDelay={false}
                className="cursor-pointer"
              />
            </div>
          </button>
        </div>
      )}

      {/* 10-Column Uploaded Requisitions View */}
      {viewMode === 'uploaded-10col' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Action Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Uploaded Agreement Requisitions & Purchase Orders</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      10 Standard Columns
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live view matching your uploaded columns: <strong>SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, Request Year</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIs10ColUploadOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Agreement File</span>
              </button>
              <button
                onClick={download10ColTemplate}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                title="Download standard 10-column Excel template"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Template (.xlsx)</span>
              </button>
              <button
                onClick={export10ColToExcel}
                disabled={filtered10ColRecords.length === 0}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
                title="Export filtered records to Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={export10ColToCSV}
                disabled={filtered10ColRecords.length === 0}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
                title="Export filtered records to CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-600" />
                <span>Export CSV</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditing10ColRecord(null);
                    setForm10Col({
                      sapPo: '',
                      itemDescription: '',
                      unit: 'PCS',
                      quantity: 1,
                      deliveryAmountEtb: 0,
                      supplier: '',
                      deviceOwner: '',
                      currentStatus: 'Active',
                      managementApproach: '',
                      requestYear: new Date().getFullYear().toString()
                    });
                    setIsAdd10ColModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Requisition</span>
                </button>
              )}
              {isAdmin && programMdRecords.length > 0 && onClearProgramMdData && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all uploaded agreement requisitions?')) {
                      onClearProgramMdData();
                    }
                  }}
                  className="px-2.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                  title="Clear dataset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Total Requisitions</span>
                <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {filtered10ColRecords.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-semibold text-amber-700">{unique10ColPOsCount}</span> distinct SAP PO numbers
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Total Quantity</span>
                <span className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(total10ColQuantity)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Total contracted & requisitioned device units
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Delivery Amount (ETB)</span>
                <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                  <Coins className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatCurrency(total10ColAmountETB, true)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Total valuation in Ethiopian Birr
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Partners & Owners</span>
                <span className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {uniquePmdOwners.length} <span className="text-xs text-slate-400 font-normal">Facilities</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {uniquePmdSuppliers.length} active contracted suppliers
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={pmdSearch}
                onChange={(e) => setPmdSearch(e.target.value)}
                placeholder="Search by SAP PO, Item Description, Supplier, Device Owner, Status..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {pmdSearch && (
                <button
                  onClick={() => setPmdSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <select
                value={pmdStatusFilter}
                onChange={(e) => setPmdStatusFilter(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {uniquePmdStatuses.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Year Filter */}
              <select
                value={pmdYearFilter}
                onChange={(e) => setPmdYearFilter(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                <option value="all">All Request Years</option>
                {uniquePmdYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              {/* Supplier Filter */}
              <select
                value={pmdSupplierFilter}
                onChange={(e) => setPmdSupplierFilter(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">All Suppliers</option>
                {uniquePmdSuppliers.map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>

              {/* Device Owner Filter */}
              <select
                value={pmdOwnerFilter}
                onChange={(e) => setPmdOwnerFilter(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer max-w-[160px] truncate"
              >
                <option value="all">All Device Owners</option>
                {uniquePmdOwners.map(ow => (
                  <option key={ow} value={ow}>{ow}</option>
                ))}
              </select>

              {/* Column Visibility Selector */}
              <div className="relative" ref={columnDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 shadow-2xs cursor-pointer transition ${
                    visibleColumnCount < 10
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title="Toggle visibility of the 10 columns"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Columns ({visibleColumnCount}/10)</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isColumnDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-30 space-y-2 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-800">Toggle 10 Columns</span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => toggleAllColumns(true)}
                          className="text-amber-600 hover:underline font-semibold cursor-pointer"
                        >
                          Show All
                        </button>
                        <span>&bull;</span>
                        <button
                          type="button"
                          onClick={() => toggleAllColumns(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Hide All
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {[
                        { key: 'sapPo', label: '1. SAP PO' },
                        { key: 'itemDescription', label: '2. Item Description' },
                        { key: 'unit', label: '3. Unit' },
                        { key: 'quantity', label: '4. Quantity' },
                        { key: 'deliveryAmountEtb', label: '5. Delivery Amount in ETB' },
                        { key: 'supplier', label: '6. Supplier' },
                        { key: 'deviceOwner', label: '7. Device Owner' },
                        { key: 'currentStatus', label: '8. Current Status' },
                        { key: 'managementApproach', label: '9. Management Approach' },
                        { key: 'requestYear', label: '10. Request Year' }
                      ].map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key as keyof typeof visibleColumns]}
                            onChange={(e) =>
                              setVisibleColumns(prev => ({
                                ...prev,
                                [col.key]: e.target.checked
                              }))
                            }
                            className="rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="font-medium truncate">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(pmdSearch || pmdStatusFilter !== 'all' || pmdYearFilter !== 'all' || pmdSupplierFilter !== 'all' || pmdOwnerFilter !== 'all') && (
                <button
                  onClick={() => {
                    setPmdSearch('');
                    setPmdStatusFilter('all');
                    setPmdYearFilter('all');
                    setPmdSupplierFilter('all');
                    setPmdOwnerFilter('all');
                  }}
                  className="px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Reset all filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* The 10-Column Data Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none">
                  <tr>
                    {visibleColumns.sapPo && (
                      <th className="py-3 px-3.5 font-bold tracking-tight whitespace-nowrap">
                        1. SAP PO
                      </th>
                    )}
                    {visibleColumns.itemDescription && (
                      <th className="py-3 px-3.5 font-bold tracking-tight min-w-[220px]">
                        2. Item Description
                      </th>
                    )}
                    {visibleColumns.unit && (
                      <th className="py-3 px-3 font-bold tracking-tight text-center whitespace-nowrap">
                        3. Unit
                      </th>
                    )}
                    {visibleColumns.quantity && (
                      <th className="py-3 px-3.5 font-bold tracking-tight text-right whitespace-nowrap">
                        4. Quantity
                      </th>
                    )}
                    {visibleColumns.deliveryAmountEtb && (
                      <th className="py-3 px-3.5 font-bold tracking-tight text-right whitespace-nowrap">
                        5. Delivery Amount in ETB
                      </th>
                    )}
                    {visibleColumns.supplier && (
                      <th className="py-3 px-3.5 font-bold tracking-tight whitespace-nowrap">
                        6. Supplier
                      </th>
                    )}
                    {visibleColumns.deviceOwner && (
                      <th className="py-3 px-3.5 font-bold tracking-tight whitespace-nowrap">
                        7. Device Owner
                      </th>
                    )}
                    {visibleColumns.currentStatus && (
                      <th className="py-3 px-3.5 font-bold tracking-tight text-center whitespace-nowrap">
                        8. Current Status
                      </th>
                    )}
                    {visibleColumns.managementApproach && (
                      <th className="py-3 px-3.5 font-bold tracking-tight whitespace-nowrap">
                        9. Management Approach
                      </th>
                    )}
                    {visibleColumns.requestYear && (
                      <th className="py-3 px-3 font-bold tracking-tight text-center whitespace-nowrap">
                        10. Request Year
                      </th>
                    )}
                    {isAdmin && (
                      <th className="py-3 px-3 font-bold tracking-tight text-center whitespace-nowrap">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered10ColRecords.map((rec) => {
                    const statusStr = (rec.currentStatus || 'Active').toLowerCase();
                    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (statusStr.includes('deliver') || statusStr.includes('complet') || statusStr.includes('receiv')) {
                      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                    } else if (statusStr.includes('transit') || statusStr.includes('ship')) {
                      badgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-200 font-bold';
                    } else if (statusStr.includes('activ') || statusStr.includes('track') || statusStr.includes('progress')) {
                      badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                    } else if (statusStr.includes('pend') || statusStr.includes('approv') || statusStr.includes('deadlin')) {
                      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                    } else if (statusStr.includes('delay') || statusStr.includes('crit') || statusStr.includes('cancel')) {
                      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                    }

                    return (
                      <tr key={rec.id} className="hover:bg-amber-50/30 transition">
                        {/* 1. SAP PO */}
                        {visibleColumns.sapPo && (
                          <td className="py-3 px-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">
                            {rec.sapPo || <span className="text-slate-300 italic font-normal">N/A</span>}
                          </td>
                        )}

                        {/* 2. Item Description */}
                        {visibleColumns.itemDescription && (
                          <td className="py-3 px-3.5 font-semibold text-slate-900 max-w-[260px]">
                            <div className="truncate" title={rec.itemDescription}>
                              {rec.itemDescription}
                            </div>
                            {rec.sourceFile && (
                              <span className="text-[10px] text-slate-400 block truncate" title={rec.sourceFile}>
                                {rec.sourceFile}
                              </span>
                            )}
                          </td>
                        )}

                        {/* 3. Unit */}
                        {visibleColumns.unit && (
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {rec.unit || 'PCS'}
                            </span>
                          </td>
                        )}

                        {/* 4. Quantity */}
                        {visibleColumns.quantity && (
                          <td className="py-3 px-3.5 font-bold text-slate-800 text-right whitespace-nowrap">
                            {formatNumber(rec.quantity || 0)}
                          </td>
                        )}

                        {/* 5. Delivery Amount in ETB */}
                        {visibleColumns.deliveryAmountEtb && (
                          <td className="py-3 px-3.5 font-mono font-bold text-emerald-700 text-right whitespace-nowrap">
                            {formatCurrency(rec.deliveryAmountEtb || 0, true)}
                          </td>
                        )}

                        {/* 6. Supplier */}
                        {visibleColumns.supplier && (
                          <td className="py-3 px-3.5 text-slate-800 font-medium whitespace-nowrap max-w-[180px]">
                            <span className="truncate block" title={rec.supplier}>
                              {rec.supplier || <span className="text-slate-300 italic font-normal">Unspecified</span>}
                            </span>
                          </td>
                        )}

                        {/* 7. Device Owner */}
                        {visibleColumns.deviceOwner && (
                          <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap max-w-[180px]">
                            <div className="flex items-center gap-1.5 truncate" title={rec.deviceOwner}>
                              <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate font-medium">{rec.deviceOwner || 'Health Facility'}</span>
                            </div>
                          </td>
                        )}

                        {/* 8. Current Status */}
                        {visibleColumns.currentStatus && (
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] border ${badgeClass}`}>
                              {rec.currentStatus || 'Active'}
                            </span>
                          </td>
                        )}

                        {/* 9. Management Approach */}
                        {visibleColumns.managementApproach && (
                          <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap max-w-[160px]">
                            <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px] truncate block" title={rec.managementApproach}>
                              {rec.managementApproach || 'Standard'}
                            </span>
                          </td>
                        )}

                        {/* 10. Request Year */}
                        {visibleColumns.requestYear && (
                          <td className="py-3 px-3 text-center font-mono font-medium text-slate-700 whitespace-nowrap">
                            {rec.requestYear || '-'}
                          </td>
                        )}

                        {/* Action */}
                        {isAdmin && (
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditing10ColRecord(rec);
                                  setForm10Col({
                                    sapPo: rec.sapPo || '',
                                    itemDescription: rec.itemDescription || '',
                                    unit: rec.unit || 'PCS',
                                    quantity: rec.quantity || 1,
                                    deliveryAmountEtb: rec.deliveryAmountEtb || 0,
                                    supplier: rec.supplier || '',
                                    deviceOwner: rec.deviceOwner || '',
                                    currentStatus: rec.currentStatus || 'Active',
                                    managementApproach: rec.managementApproach || '',
                                    requestYear: String(rec.requestYear || new Date().getFullYear())
                                  });
                                  setIsAdd10ColModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                title="Edit Requisition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete requisition for SAP PO: ${rec.sapPo}?`)) {
                                    onDeleteProgramMdRecord?.(rec.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state inside 10-column table */}
            {filtered10ColRecords.length === 0 && (
              <div className="py-16 text-center space-y-3 bg-slate-50/50">
                <FileSpreadsheet className="w-10 h-10 text-amber-500/60 mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  {programMdRecords.length === 0 ? 'No Agreement Requisitions Recorded Yet' : 'No Requisitions Match Your Filters'}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {programMdRecords.length === 0
                    ? 'Upload an Excel (.xlsx/.xls) or CSV spreadsheet matching the 10 required columns: SAP PO, Item Description, Unit, Quantity, Delivery Amount in ETB, Supplier, Device Owner, Current Status, Management Approach, and Request Year.'
                    : 'Try clearing your search query or adjusting status, year, supplier, or device owner dropdowns.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {programMdRecords.length === 0 ? (
                    <>
                      <button
                        onClick={() => setIs10ColUploadOpen(true)}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Agreement Spreadsheet</span>
                      </button>
                      <button
                        onClick={download10ColTemplate}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Download Template</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setPmdSearch('');
                        setPmdStatusFilter('all');
                        setPmdYearFilter('all');
                        setPmdSupplierFilter('all');
                        setPmdOwnerFilter('all');
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Visualizations (Shown in 'analytics' view or top overview) */}
      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Agreement Delivery Volume Comparison Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-600" />
                  Delivery Units Fulfillment by Agreement
                </h4>
                <p className="text-xs text-slate-500">
                  Compares contracted target volume against verified delivered units and current transit pipeline.
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                Unit Volume
              </span>
            </div>

            <div className="h-72 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={agreementBarChartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 max-w-xs">
                          <p className="font-bold text-cyan-300">{data.title}</p>
                          <p className="text-[11px] text-slate-300 font-mono">Ref: {data.name}</p>
                          <div className="pt-1 space-y-0.5 border-t border-slate-700 text-[11px]">
                            <p className="flex justify-between">
                              <span className="text-slate-400">Contracted:</span>
                              <span className="font-bold">{formatNumber(data.agreed)}</span>
                            </p>
                            <p className="flex justify-between text-emerald-400">
                              <span>Delivered:</span>
                              <span className="font-bold">{formatNumber(data.delivered)} ({data.rate}%)</span>
                            </p>
                            <p className="flex justify-between text-blue-300">
                              <span>In Pipeline:</span>
                              <span className="font-bold">{formatNumber(data.pipeline)}</span>
                            </p>
                            <p className="flex justify-between text-slate-400">
                              <span>Pending:</span>
                              <span className="font-bold">{formatNumber(data.pending)}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                  <Bar dataKey="delivered" name="Delivered Units" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pipeline" name="In Transit / Customs" fill="#0284c7" stackId="a" />
                  <Bar dataKey="pending" name="Outstanding Balance" fill="#cbd5e1" radius={[4, 4, 0, 0]} stackId="a" />
                  <Line type="monotone" dataKey="agreed" name="Contract Target" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Funding Stream Breakdown Donut */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-indigo-600" />
                  Committed Value by Funding Stream
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Valuation distribution across RDF, Global Fund, and donor agreements.
              </p>
            </div>

            <div className="h-56 w-full flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fundingDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {fundingDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0, true), 'Committed Value']}
                    contentStyle={{ borderRadius: 12, fontSize: 11, backgroundColor: '#0f172a', color: '#fff', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-2 text-[11px]">
              {fundingDonutData.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <span className="truncate max-w-[150px]">{f.name}</span>
                  </span>
                  <span className="font-bold text-slate-800">{formatCurrency(f.value, true)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Annual Delivery Metrics Bar Chart */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Annual Delivery Performance
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Total delivered value (ETB) and total delivery of line items per year.
              </p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={annualDeliveryMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-emerald-400">Year {label} Delivery</p>
                          <div className="space-y-1 border-t border-slate-700 pt-1">
                            <p className="flex justify-between gap-3">
                              <span className="text-slate-300">Delivered Value:</span>
                              <span className="font-mono font-bold text-emerald-400">{formatCurrency(data.deliveredValue, true)}</span>
                            </p>
                            <p className="flex justify-between gap-3">
                              <span className="text-slate-300">Total Delivery of Line Items:</span>
                              <span className="font-mono font-bold text-sky-300">{formatNumber(data.lineItems)} Lines</span>
                            </p>
                            {data.items > 0 && (
                              <p className="flex justify-between gap-3 text-slate-400">
                                <span>Physical Quantity:</span>
                                <span className="font-mono font-bold">{formatNumber(data.items)} Units</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                  <Bar yAxisId="left" dataKey="deliveredValue" name="Value (ETB)" fill="#10b981" radius={[4, 4, 0, 0]} onClick={(data: any) => { setSelectedYear(data.payload.year); setViewMode('table'); }} className="cursor-pointer" />
                  <Line yAxisId="right" type="monotone" dataKey="lineItems" name="Total Delivery of Line Items per Year" stroke="#0284c7" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Multi-Source Comparative Analysis Matrix (shown if multiple batches exist) */}
          {uploadedBatches.length > 0 && (
            <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Multi-Source Comparative Analysis Matrix
                    </h4>
                    <p className="text-xs text-slate-500">
                      Comparing procurement volume, delivery milestones, consignment remains, and financial execution across data sources.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    {batchComparisonData.length} Data Sources Compared
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Dataset / Batch</th>
                      <th className="py-2.5 px-3">Source & Period</th>
                      <th className="py-2.5 px-3 text-center">Accords</th>
                      <th className="py-2.5 px-3 text-right">Target Units</th>
                      <th className="py-2.5 px-3 text-right">Delivered Units</th>
                      <th className="py-2.5 px-3 text-right">Consignment Remains</th>
                      <th className="py-2.5 px-3 text-center">Fulfillment Rate</th>
                      <th className="py-2.5 px-3 text-right">Total Value (ETB)</th>
                      <th className="py-2.5 px-3 text-right">Disbursed (ETB)</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchComparisonData.map((row) => {
                      const isCurrentFilter = selectedBatchFilter === row.id;
                      return (
                        <tr key={row.id} className={`transition ${isCurrentFilter ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {row.id === 'baseline' ? (
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              ) : (
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              )}
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <div>{row.source}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{row.period}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {row.accordCount}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900">
                            {formatNumber(row.agreedUnits)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600">
                            {formatNumber(row.deliveredUnits)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-cyan-900">
                            {formatNumber(row.remainsUnits)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-600 rounded-full"
                                  style={{ width: `${Math.min(100, row.fulfillmentRate)}%` }}
                                />
                              </div>
                              <span className="font-extrabold text-cyan-800 text-[11px]">{row.fulfillmentRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                            {formatCurrency(row.totalValueETB, true)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(row.deliveredValueETB, true)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => setSelectedBatchFilter(row.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                isCurrentFilter
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {isCurrentFilter ? 'Filtered' : 'Filter View'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAgreements.map((agr) => {
            const fulfillment = agr.totalAgreedUnits > 0
              ? Math.min(100, Math.round((agr.deliveredUnits / agr.totalAgreedUnits) * 100))
              : 0;

            const now = new Date();
            const deadline = new Date(agr.committedDeliveryDate);
            const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isOverdue = diffDays < 0 && fulfillment < 100;

            return (
              <div
                key={agr.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {agr.agreementNumber}
                    </span>
                    <AgreementStatusBadge
                      agreement={agr}
                      variant="badge"
                      size="sm"
                    />
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-cyan-700 transition leading-snug">
                      {agr.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{agr.supplier}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {agr.procurementPackage.split(':')[0]}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-100">
                      {agr.fundingSource}
                    </span>
                    {agr.uploadBatchName && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-purple-600" />
                        <span className="truncate max-w-[130px]">{agr.uploadBatchName}</span>
                      </span>
                    )}
                  </div>

                  {/* Delivery Fulfillment Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-slate-600">Fulfillment Velocity</span>
                      <span className="font-extrabold text-cyan-700">{fulfillment}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${(agr.deliveredUnits / agr.totalAgreedUnits) * 100}%` }}
                        className="bg-emerald-500"
                        title={`Delivered: ${agr.deliveredUnits}`}
                      />
                      <div
                        style={{ width: `${(agr.inTransitUnits / agr.totalAgreedUnits) * 100}%` }}
                        className="bg-cyan-500"
                        title={`In Transit: ${agr.inTransitUnits}`}
                      />
                      <div
                        style={{ width: `${(agr.customsUnits / agr.totalAgreedUnits) * 100}%` }}
                        className="bg-amber-400"
                        title={`Customs: ${agr.customsUnits}`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>{formatNumber(agr.deliveredUnits)} Delivered</span>
                      <span>Target: {formatNumber(agr.totalAgreedUnits)} Units</span>
                    </div>
                  </div>

                  {/* Values, Remains, and Delivery Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Contract Value</span>
                      <span className="font-bold text-slate-900">{formatCurrency(agr.totalContractValueETB, true)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignment Remains</span>
                      {(() => {
                        const remains = Math.max(0, agr.totalAgreedUnits - agr.deliveredUnits);
                        if (remains === 0) {
                          return <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">0 Units (Fulfilled)</span>;
                        }
                        return (
                          <span className="font-bold text-cyan-900 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 text-[11px]">
                            {formatNumber(remains)} Units Left
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Health Facility & Hub Destinations */}
                  <div className="pt-2 border-t border-slate-100/80">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-slate-700">Health Facilities:</span>
                      <span className="truncate text-slate-600 font-medium" title={agr.assignedPlants.join(', ')}>
                        {agr.assignedPlants.slice(0, 2).join(', ')}
                        {agr.assignedPlants.length > 2 ? ` (+${agr.assignedPlants.length - 2} more)` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                      Due: {agr.committedDeliveryDate}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAgreementForModal(agr)}
                    className="font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 cursor-pointer group-hover:translate-x-0.5 transition"
                  >
                    <span>View Dossier</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Official Letters View */}
      {viewMode === 'letters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {filteredAgreements.map((agr, idx) => {
            const letterRef = `MOH/BME/${new Date(agr.contractSignDate).getFullYear()}/${1000 + (idx * 17) % 900}`;
            const letterDate = new Date(new Date(agr.contractSignDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const letterIssuer = "Ministry of Health, Medical Technology Infrastructure Directorate";
            const approvedBy = "Dr. Dereje Duguma (State Minister of Health)";
            const fileName = `Official_Clearance_Accord_${agr.agreementNumber}.pdf`;

            return (
              <div
                key={agr.id}
                className="bg-white rounded-3xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition duration-200 overflow-hidden flex flex-col justify-between"
              >
                {/* Official Letter Head Structure */}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between border-b border-dashed border-slate-200 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Official Letter Dispatch</div>
                        <div className="text-xs font-bold text-slate-800 font-mono">{letterRef}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Certified Copy
                    </span>
                  </div>

                  {/* Letter Body Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs relative overflow-hidden space-y-3">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
                    
                    <div className="flex justify-between items-baseline text-[11px] font-medium text-slate-500">
                      <span>Date: <strong className="text-slate-700 font-mono font-bold">{letterDate}</strong></span>
                      <span>Addis Ababa, Ethiopia</span>
                    </div>

                    <div className="text-[11px] leading-relaxed text-slate-600">
                      <p className="font-semibold text-slate-800 mb-1">TO: Federal Medicine & Medical Equipment Procurement Bureau (EPSS)</p>
                      <p>
                        Pursuant to the bilateral technical review committee authorization, the Ministry of Health hereby transmits the official clearance for the execution of <strong className="text-slate-800">{agr.title}</strong> with <strong className="text-slate-800">{agr.supplier} ({agr.supplierCountry})</strong>.
                      </p>
                      <p className="mt-1.5">
                        This accord is fully certified under the <strong className="text-slate-800">{agr.fundingSource}</strong> with a total financial commitment of <strong className="text-slate-800 font-mono font-bold">{formatCurrency(agr.totalContractValueETB)}</strong> for the supply and physical delivery of <strong className="text-slate-800">{formatNumber(agr.totalAgreedUnits)} target units</strong> of vital clinical machinery.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center flex-wrap gap-1">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Issuer Directorate</span>
                        <span className="font-semibold text-slate-700">{letterIssuer}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Signed Authority</span>
                        <span className="font-bold text-indigo-700">{approvedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Linked Agreement Information */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Linked Framework Agreement</span>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{agr.title}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1">
                      <span>Ref: <strong className="text-slate-700 font-semibold">{agr.agreementNumber}</strong></span>
                      <span>•</span>
                      <span>Value: <strong className="text-indigo-700 font-bold">{formatCurrency(agr.totalContractValueETB, true)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* File Attachment Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate max-w-[200px] text-[11px] font-mono font-semibold" title={fileName}>{fileName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        alert(`Opening certified official letter:\nReference: ${letterRef}\nSubject: Framework Accord Clearance\nFile: ${fileName}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Letter</span>
                    </button>
                    <button
                      onClick={() => setSelectedAgreementForModal(agr)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <span>Accord Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Table View */}
      {viewMode === 'table' && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Agreement Ref & Title</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Assigned Health Facilities</th>
                  <th className="py-3 px-4 text-center">Deadline</th>
                  <th className="py-3 px-4 text-right">Target Units</th>
                  <th className="py-3 px-4 text-right">Delivered</th>
                  <th className="py-3 px-4 text-right">Remains</th>
                  <th className="py-3 px-4 text-center">Fulfillment</th>
                  <th className="py-3 px-4 text-right">Contract Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAgreements.map((agr) => {
                  const fulfillment = agr.totalAgreedUnits > 0
                    ? Math.min(100, Math.round((agr.deliveredUnits / agr.totalAgreedUnits) * 100))
                    : 0;
                  const remains = Math.max(0, agr.totalAgreedUnits - agr.deliveredUnits);

                  return (
                    <tr key={agr.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate" title={agr.title}>{agr.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-mono text-[11px] text-cyan-700 font-semibold">{agr.agreementNumber}</span>
                          <span className="text-[10px] text-indigo-700 font-medium">{agr.procurementPackage.split(':')[0]}</span>
                          {agr.uploadBatchName && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold truncate max-w-[120px]" title={agr.uploadBatchName}>
                              {agr.uploadBatchName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        <div>{agr.supplier}</div>
                        {agr.supplierCountry && <span className="text-[10px] text-slate-400">{agr.supplierCountry}</span>}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="flex items-center gap-1 text-slate-700 font-medium truncate" title={agr.assignedPlants.join(', ')}>
                          <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate">{agr.assignedPlants.join(', ')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600 whitespace-nowrap">
                        {agr.committedDeliveryDate}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatNumber(agr.totalAgreedUnits)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatNumber(agr.deliveredUnits)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {remains === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                            0 (Complete)
                          </span>
                        ) : (
                          <span className="text-cyan-950 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200 text-[11px]">
                            {formatNumber(remains)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-cyan-800">
                          <span>{fulfillment}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {formatCurrency(agr.totalContractValueETB, true)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <AgreementStatusBadge
                          agreement={agr}
                          variant="pill"
                          size="xs"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedAgreementForModal(agr)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 transition cursor-pointer"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Zero State if Filter Yields Nothing */}
      {filteredAgreements.length === 0 && viewMode !== 'uploaded-10col' && (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-700">No Medical Device Agreements match your filters</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keywords, status, package, or funding stream selection.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('all');
              setSelectedPackage('all');
              setSelectedFunding('all');
            }}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Bottom Information Callout */}
      <div className="p-4 bg-gradient-to-r from-blue-50/60 via-indigo-50/60 to-cyan-50/60 rounded-2xl border border-blue-200 flex items-start gap-3 text-xs text-slate-700">
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-indigo-950 block">Contractual SLA & Liquidated Damages Standard</span>
          <p className="leading-relaxed text-slate-600">
            Agreements registered under the EPSS National Supply Framework enforce a standard <strong>0.1% daily liquidated damages clause</strong> for unfulfilled consignments past the committed delivery milestone, capped at 10% contract value. Warranty and spare parts availability agreements are backed by dedicated local biomedical service centers in Addis Ababa, Hawassa, and Jimma.
          </p>
        </div>
      </div>

      {/* Modals */}
      <AgreementDetailModal
        agreement={selectedAgreementForModal}
        items={items}
        isOpen={Boolean(selectedAgreementForModal)}
        onClose={() => setSelectedAgreementForModal(null)}
        onFilterInventory={(agreementTitle) => {
          if (onNavigateTab) {
            onNavigateTab('inventory');
          }
        }}
        language={language}
      />

      <AddAgreementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddAgreement}
      />

      {isAdmin && isMultiUploadModalOpen && (
        <MultipleAgreementUploadModal
          isOpen={isMultiUploadModalOpen}
          onClose={() => setIsMultiUploadModalOpen(false)}
          onUploadBatches={handleBatchesUploaded}
          existingBatchCount={uploadedBatches.length}
        />
      )}

      {/* Upload 10-Column Agreement Requisitions Modal */}
      {is10ColUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Agreement Requisitions</h3>
                  <p className="text-xs text-slate-500">Spreadsheet matching the 10 standard columns</p>
                </div>
              </div>
              <button
                onClick={() => setIs10ColUploadOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs: File / Paste */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setTenColUploadTab('file')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  tenColUploadTab === 'file' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Upload Excel / CSV File
              </button>
              <button
                onClick={() => setTenColUploadTab('paste')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  tenColUploadTab === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Paste Table Data
              </button>
            </div>

            {upload10ColError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{upload10ColError}</span>
              </div>
            )}

            {tenColUploadTab === 'file' ? (
              <div className="space-y-4">
                <label className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50 hover:bg-amber-50/30 transition text-center group">
                  <div className="p-3 rounded-full bg-white shadow-xs group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Click to browse or drag & drop</span>
                    <span className="text-[11px] text-slate-500">Supports .xlsx, .xls, .csv files</span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handle10ColFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold block">10 Required Columns:</span>
                  <p className="leading-relaxed">
                    1. SAP PO, 2. Item Description, 3. Unit, 4. Quantity, 5. Delivery Amount in ETB, 6. Supplier, 7. Device Owner, 8. Current Status, 9. Management Approach, 10. Request Year.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rawPasted10ColText}
                  onChange={(e) => setRawPasted10ColText(e.target.value)}
                  placeholder="Paste rows copied from Excel (tab-separated) or CSV with headers:
SAP PO	Item Description	Unit	Quantity	Delivery Amount in ETB	Supplier	Device Owner	Current Status	Management Approach	Request Year"
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  onClick={handle10ColPasteUpload}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer"
                >
                  Parse and Ingest Pasted Rows
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={download10ColTemplate}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
              <button
                onClick={() => setIs10ColUploadOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Single 10-Column Record Modal */}
      {isAdd10ColModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500 text-white">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {editing10ColRecord ? 'Edit Agreement Requisition' : 'Add Agreement Requisition'}
                </h3>
              </div>
              <button
                onClick={() => setIsAdd10ColModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form10Col.sapPo || !form10Col.itemDescription) return;

                if (editing10ColRecord) {
                  onUpdateProgramMdRecord?.({
                    ...editing10ColRecord,
                    ...form10Col,
                    quantity: Number(form10Col.quantity) || 0,
                    deliveryAmountEtb: Number(form10Col.deliveryAmountEtb) || 0
                  });
                } else {
                  onAddProgramMdRecord?.({
                    id: `pmd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    ...form10Col,
                    quantity: Number(form10Col.quantity) || 0,
                    deliveryAmountEtb: Number(form10Col.deliveryAmountEtb) || 0,
                    uploadedAt: new Date().toISOString()
                  });
                }
                setIsAdd10ColModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">1. SAP PO *</label>
                  <input
                    type="text"
                    required
                    value={form10Col.sapPo}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, sapPo: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="e.g. PO-450012891"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">2. Item Description *</label>
                  <input
                    type="text"
                    required
                    value={form10Col.itemDescription}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, itemDescription: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="e.g. Ultrasound Machine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">3. Unit</label>
                  <input
                    type="text"
                    value={form10Col.unit}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="PCS / SET"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">4. Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={form10Col.quantity}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">5. Delivery Amount in ETB</label>
                  <input
                    type="number"
                    min="0"
                    value={form10Col.deliveryAmountEtb}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, deliveryAmountEtb: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">6. Supplier</label>
                  <input
                    type="text"
                    value={form10Col.supplier}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, supplier: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Supplier Name"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">7. Device Owner</label>
                  <input
                    type="text"
                    value={form10Col.deviceOwner}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, deviceOwner: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Health Facility / Hospital"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">8. Current Status</label>
                  <select
                    value={form10Col.currentStatus}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, currentStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="Active">Active</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Pending">Pending</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">9. Management Approach</label>
                  <input
                    type="text"
                    value={form10Col.managementApproach}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, managementApproach: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="e.g. Framework Agreement"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">10. Request Year</label>
                  <input
                    type="text"
                    value={form10Col.requestYear}
                    onChange={(e) => setForm10Col(prev => ({ ...prev, requestYear: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdd10ColModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer"
                >
                  {editing10ColRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
