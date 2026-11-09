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
  ChevronDown
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
    hub: 'HO01',
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
  disableBreakdownLink = false
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
  const [matrixTemplateFormat, setMatrixTemplateFormat] = useState<'item' | 'epss' | 'rhb' | 'dsp-received-from-moh' | 'moh-to-epss'>('item');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recentlyLoadedToken, setRecentlyLoadedToken] = useState<number>(0);

  // Action Modals State: Send TO MOH, Via Email, WhatsApp
  const [isTransmitModalOpen, setIsTransmitModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const [dspProjectName, setDspProjectName] = useState('Regional Health Facility Allocation Matrix');
  const [emailTo, setEmailTo] = useState('moh.pmd@moh.gov.et');
  const [emailCc, setEmailCc] = useState('epss.directorate@epss.gov.et');
  const [emailSubject, setEmailSubject] = useState(`Official Regional Health Facility Breakdown Matrix - ${internalDate}`);
  const [waPhone, setWaPhone] = useState('+251911234567');
  const [waCopied, setWaCopied] = useState(false);
  const [manualSignatoryName, setManualSignatoryName] = useState('');
  const [manualSignatoryRole, setManualSignatoryRole] = useState('');

  // Breakdown Request Selector & Column Configurator State
  const [selectedRequestId, setSelectedRequestId] = useState<string>(selectedBreakdownRequestId || '');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [isRequestModalFullScreen, setIsRequestModalFullScreen] = useState<boolean>(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newColumnCode, setNewColumnCode] = useState<string>('');

  useEffect(() => {
    if (selectedBreakdownRequestId) {
      setSelectedRequestId(selectedBreakdownRequestId);
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

  // Cell change handler
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
            updatedRow.hub = firstHf.deliveringPlant || 'HO01';
          } else {
            updatedRow.customerDescription = '';
            updatedRow.healthFacility = '';
            updatedRow.zone = '';
            updatedRow.woreda = '';
            updatedRow.hub = 'HO01';
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
            updatedRow.hub = matchedHf.deliveringPlant || r.hub || 'HO01';
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
            updatedRow.hub = matchedHf.deliveringPlant || r.hub || 'HO01';
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
      aoa.push(['Hub', ...columns.map(c => c.name)]);
      aoa.push(['Hub', ...columns.map(c => c.code)]);
      
      // Calculate Hub Aggregations
      const hubAgg: Record<string, Record<string, number>> = {};
      filteredRows.forEach(r => {
        const hubCode = r.hub || 'HO01';
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
    } else if (fmt === 'epss') {
      aoa.push([
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
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
          r.healthFacility || r.customerDescription,
          r.packages,
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
        'Hub',
        ...columns.map(c => c.name)
      ]);
      aoa.push([
        '',
        '',
        '',
        '',
        '',
        '',
        ...columns.map(c => c.code)
      ]);
      filteredRows.forEach(r => {
        aoa.push([
          r.region,
          r.zone,
          r.woreda,
          r.customerDescription || r.healthFacility,
          r.packages,
          r.hub || 'HO01',
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
        '',
        ...columns.map(c => columnTotals[c.id] || 0)
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = fmt === 'item' ? [
      { wch: 14 },
      ...columns.map(() => ({ wch: 24 }))
    ] : fmt === 'epss' ? [
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
    const filenameLabel = fmt === 'item' ? 'Item_Aggregation' : fmt === 'epss' ? 'EPSS_Submission' : fmt === 'dsp-received-from-moh' ? 'DSP_Received_From_MOH' : 'RHB_Breakdown';
    const filename = `DSP_${filenameLabel}_${selectedRegionFilter !== 'all' ? selectedRegionFilter : 'All_Regions'}_${internalDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`✓ Exported ${filename}`);
  };

  // Download official blank template
  const handleDownloadTemplate = () => {
    const fmt = matrixTemplateFormat;
    const aoa: any[][] = fmt === 'item' ? [
      [
        'Hub',
        'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult', 'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
      ],
      [
        'Hub',
        '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
      ],
      ['AA01', 6, 6, 2, 2, 2, 2],
      ['AD01', 2, 2, 2, 2, 2, 2],
      ['DI01', 2, 2, 2, 2, 2, 2],
      ['BD01', 2, 2, 2, 2, 2, 2],
      ['HW01', 2, 2, 2, 2, 2, 2],
      ['DD01', 2, 2, 2, 2, 2, 2]
    ] : [
      [
        'Region', 'Zone', 'Woreda', 'Name of health facility', 'List of Packeges', 'Hub',
        'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult', 'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
      ],
      [
        '', '', '', '', 'List of Packeges', '',
        '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
      ],
      ['Addis Ababa', 'Addis Ketema', 'Woreda 01', 'Tikur Anbessa Specialized Hospital', 'MCH', 'HO01', 2, 2, 2, 2, 2, 2],
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
  const handleMapHfToHub = () => {
    if (rows.length === 0) {
      showToast('⚠️ No health facility rows to map.');
      return;
    }

    const updatedRows = rows.map((r) => {
      const facilityName = r.customerDescription || r.healthFacility || '';
      const result = mapFacilityToHub(facilityName, r.region, r.zone, r.woreda, masterHfItems);
      return {
        ...r,
        hub: result.hubCode || r.hub || 'HO01'
      };
    });

    setRows(updatedRows);
    notifyChange(internalDate, columns, updatedRows);
    showToast(`⚡ Successfully mapped all ${updatedRows.length} facilities to designated EPSS Distribution Hubs!`);
  };

  return (
    <div className={`space-y-4 ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-100 p-6 overflow-y-auto' : ''}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
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

        <div className="flex flex-wrap items-center gap-2">
          {/* ITEM AGGREGATION Button: Matching Attachment _23108371-8084-4E3E-8152-291A78533F75__0d333217.png */}
          <button
            type="button"
            onClick={() => {
              setMatrixTemplateFormat('item');
              showToast('⚡ Switched to Item Aggregation Format (Region, Zone, Woreda, Name of health facility, List of Packages)');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 border ${
              matrixTemplateFormat === 'item'
                ? 'bg-[#0a0f1d] text-white border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-slate-900 hover:bg-black text-slate-300 border-slate-700'
            }`}
            title="Switch to Item Aggregation View (5-Column Health Facility List)"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
            <span className="uppercase font-black tracking-wide text-white">ITEM AGGREGATION</span>
          </button>

          {/* DSP RECEIVED FROM MOH Button */}
          <button
            type="button"
            onClick={() => {
              setMatrixTemplateFormat('dsp-received-from-moh');
              showToast('⚡ Switched to DSP RECEIVED FROM MOH Format');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 border ${
              matrixTemplateFormat === 'dsp-received-from-moh'
                ? 'bg-[#0a0f1d] text-white border-slate-400 ring-2 ring-slate-400/40'
                : 'bg-slate-900 hover:bg-black text-slate-300 border-slate-700'
            }`}
            title="Switch to DSP Received from MOH View"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.9)]" />
            <span className="uppercase font-black tracking-wide text-white">DSP RECEIVED FROM MOH</span>
          </button>

          {/* MOH TO EPSS MATRIX Button */}
          <button
            type="button"
            onClick={() => {
              setMatrixTemplateFormat('moh-to-epss');
              showToast('⚡ Switched to MOH TO EPSS MATRIX (Hub Mapped) Format');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 border ${
              matrixTemplateFormat === 'moh-to-epss'
                ? 'bg-[#0a0f1d] text-white border-slate-400 ring-2 ring-slate-400/40'
                : 'bg-slate-900 hover:bg-black text-slate-300 border-slate-700'
            }`}
            title="Switch to MOH TO EPSS MATRIX (Hub Mapped) View"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.9)]" />
            <span className="uppercase font-black tracking-wide text-white">MOH TO EPSS MATRIX (HUB MAPPED)</span>
          </button>

          {/* BREAKDOWN AGGREGATION BY RHB Button: Matching Attachment _D13E96D7-26B7-4EE7-8BAC-DBD4D4A1D1D8__38b63b76.png */}
          <button
            type="button"
            onClick={() => {
              setMatrixTemplateFormat('rhb');
              handleMapHfToHub();
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 border ${
              matrixTemplateFormat === 'rhb'
                ? 'bg-[#0a0f1d] text-white border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-slate-900 hover:bg-black text-slate-300 border-slate-700'
            }`}
            title="Automatically aggregate breakdown by RHB and map Health Facilities to designated EPSS Distribution Hubs"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
            <span className="uppercase font-black tracking-wide text-white">BREAKDOWN AGGREGATION BY RHB</span>
          </button>

          {/* Send TO MOH Button */}
          <button
            type="button"
            onClick={() => setIsTransmitModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-amber-400 font-black text-xs flex items-center gap-1.5 cursor-pointer border-b-4 border-[#050B15] shadow-[0_4px_0_rgb(5,11,21)] transition-all active:border-b-0 active:translate-y-[4px]"
            title="Send official Region Breakdown Matrix to MOH PMD Directorate"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" />
            <span className="uppercase">Send TO MOH</span>
          </button>

          {/* Via Email Button */}
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border-b-4 border-indigo-800 shadow-[0_4px_0_rgb(55,48,163)] transition-all active:border-b-0 active:translate-y-[4px]"
            title="Dispatch matrix via email to MOH"
          >
            <Mail className="w-3.5 h-3.5 text-white" />
            <span className="uppercase">Via email</span>
          </button>

          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border-b-4 border-emerald-800 shadow-[0_4px_0_rgb(6,95,70)] transition-all active:border-b-0 active:translate-y-[4px]"
            title="Share matrix payload via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" />
            <span className="uppercase">WhatsApp</span>
          </button>

          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus size={14} />
              <span>Submit / Upload Matrix</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export current table to Excel with two-tier headers"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Download the official blank Excel template"
          >
            <Download size={14} className="text-amber-500" />
            <span>Download Template</span>
          </button>

          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              isEditingMode
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Edit3 size={14} />
            <span>{isEditingMode ? 'Finish Editing' : 'Edit Matrix'}</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 cursor-pointer transition"
            title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Region Filter</div>
          <div className="text-sm font-black font-mono text-amber-700 mt-0.5 flex items-center gap-1.5">
            <Building2 size={14} className="text-amber-600" />
            <span>{selectedRegionFilter === 'all' ? 'All 15 Regions' : selectedRegionFilter}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocated Health Facilities</div>
          <div className="text-sm font-black font-mono text-indigo-700 mt-0.5">
            {filteredRows.length} Center{filteredRows.length !== 1 ? 's' : ''} (of {rows.length})
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HF Master List Link</div>
          <div className="text-sm font-black font-mono text-purple-700 mt-0.5">
            {hfListItems.length > 0 ? `${hfListItems.length} Master Facilities` : 'Default Sample List'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Quantity Earmarked</div>
          <div className="text-sm font-black font-mono text-emerald-700 mt-0.5">
            {formatNumber(grandTotalUnits)} Units
          </div>
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

            {/* Manage / Add Equipment Columns Button */}
            <button
              type="button"
              onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isColumnPickerOpen ? 'Hide Column Picker' : 'Manage Equipment Columns (' + columns.length + ')'}</span>
            </button>
          </div>
        </div>

        {/* Equipment Column Picker & Add Modal */}
        {isColumnPickerOpen && (
          <div className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Selectable Equipment Columns in Matrix ({columns.length})</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Click 'X' to remove equipment or enter custom equipment below</span>
            </div>

            {/* Active Columns Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
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
        )}
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

          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Zones ({uniqueZones.length})</option>
            {uniqueZones.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
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

      {/* SPREADSHEET TABLE: Matching Exact User Attachment Format */}
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
                  List of Packeges
                </th>
                <th className="p-2.5 bg-yellow-300 text-slate-950 border-r border-slate-300 font-black min-w-[110px] text-center uppercase tracking-wide">
                  Hub
                </th>
                {matrixTemplateFormat !== 'item' && columns.map(col => (
                  <th 
                    key={col.id} 
                    className="p-2.5 bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold text-left min-w-[160px] max-w-[200px] leading-tight"
                  >
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
                ))}
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
                <th className="p-2 bg-[#eff6ff] italic text-slate-600 text-[10px] text-center border-r border-slate-300">List of Packeges</th>
                <th className="p-2 bg-yellow-100 border-r border-slate-300"></th>
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
                  <td colSpan={(matrixTemplateFormat === 'item' ? 5 : columns.length + (matrixTemplateFormat === 'rhb' ? 5 : 4)) + (isEditingMode ? 1 : 0)} className="p-8 text-center text-slate-400">
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
                            {matrixTemplateFormat === 'rhb' && matchedHf && (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                                <span className="text-amber-700 font-semibold">Plant:</span>
                                <span className="font-bold text-slate-700">{matchedHf.deliveringPlant || 'HO01'}</span>
                                {matchedHf.zoneDescription && <span className="text-slate-400">• {matchedHf.zoneDescription}</span>}
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

                      {/* 6. Hub (Always visible, highlighted in yellow matching image 94FE6776) */}
                      <td className="p-2 text-slate-900 border-r border-slate-200 min-w-[110px] text-center bg-yellow-50/50">
                        {isEditingMode ? (
                          <select
                            value={row.hub || matchedHf?.deliveringPlant || 'HO01'}
                            onChange={(e) => handleRowFieldChange(row.id, 'hub', e.target.value)}
                            className="w-full p-1.5 border border-amber-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 cursor-pointer shadow-2xs focus:border-amber-500"
                            title="Select EPSS Distribution Hub"
                          >
                            {EPSS_HUBS_REGISTRY.map(h => (
                              <option key={h.code} value={h.code}>
                                {h.code} - {h.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center justify-center gap-1 group">
                            <span className="px-2 py-0.5 rounded bg-yellow-200/90 text-yellow-950 font-mono font-black text-[11px] border border-yellow-300 shadow-2xs">
                              {row.hub || matchedHf?.deliveringPlant || 'HO01'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsEditingMode(true)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-700 transition"
                              title="Edit hub"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Equipment Quantity Cells (Only if not ITEM AGGREGATION mode) */}
                      {matrixTemplateFormat !== 'item' && columns.map(col => {
                        const qty = row.quantities[col.id];
                        return (
                          <td 
                            key={col.id} 
                            className="p-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800"
                          >
                            {isEditingMode ? (
                              <input
                                type="number"
                                min="0"
                                value={qty !== undefined && qty !== 0 ? qty : ''}
                                placeholder="0"
                                onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                className="w-16 p-1 border border-slate-300 rounded text-right font-mono font-bold text-xs"
                              />
                            ) : (
                              qty && qty > 0 ? (
                                <span>{qty}</span>
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
                <td colSpan={(matrixTemplateFormat === 'item' ? 5 : columns.length + (matrixTemplateFormat === 'rhb' ? 5 : 4)) + (isEditingMode ? 1 : 0)} className="p-2.5 text-center">
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
                <td className="p-2.5 border-r border-slate-300 font-black text-slate-900">
                  {filteredRows.length} Health Facilities
                </td>
                <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px] text-center font-mono font-bold bg-[#eff6ff]/30 text-blue-800">
                  -
                </td>
                {matrixTemplateFormat === 'rhb' && (
                  <td className="p-2.5 border-r border-slate-300 text-slate-500 text-[11px] text-center font-mono font-bold bg-amber-50/30 text-amber-800">
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

              {/* MODAL 1: SEND TO EPSS (DIRECT INSTITUTIONAL TRANSMITTAL) */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send Region Breakdown Matrix to EPSS</h3>
                  <p className="text-[11px] text-slate-400">Official Health Facility breakdown transmittal to EPSS</p>
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
                  <span>Matrix Payload Summary</span>
                  <span className="text-amber-600 font-mono font-bold">{selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">HEALTH FACILITIES</span>
                    <span className="font-bold text-slate-900">{filteredRows.length} Facilities</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">EQUIPMENT TYPES</span>
                    <span className="font-bold text-indigo-800">{columns.length} Columns</span>
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

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Linked with Health Facility Master Data</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Submitting this matrix will transmit exact Region, Zone, Woreda, Health Facility Name, and Equipment quantities directly to EPSS (Sub-step 3.2 & 2.3).
                </p>
              </div>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-[11px] font-black text-slate-900 uppercase">Authorized Regional Signatory</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Authorized Person</label>
                    <input 
                      type="text"
                      placeholder="Name"
                      value={manualSignatoryName}
                      onChange={(e) => setManualSignatoryName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Official Role</label>
                    <input 
                      type="text"
                      placeholder="Title"
                      value={manualSignatoryRole}
                      onChange={(e) => setManualSignatoryRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransmitModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
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
                    const brkRef = `RHB/EPSS-BRK/${year}/${randNum}`;

                    const rhbRecord: DspWorkflowRecord = {
                      id: `dsp-rhb-epss-${Date.now()}`,
                      dspRefNumber: brkRef,
                      stage: 'rhb-breakdown-management',
                      subStage: '3.2',
                      stageTitle: 'RHB Breakdown Management',
                      senderOrg: `${selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter} Regional Health Bureau`,
                      recipientOrg: 'EPSS',
                      dspName: cleanDspName,
                      subject: `DSP [${cleanDspName}]: Regional Health Facility Breakdown Submitted to EPSS (${filteredRows.length} Facilities)`,
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
                        plant: 'AA01 Central'
                      })),
                      notes: `Official Regional Health Facility Breakdown Matrix submitted to EPSS (${filteredRows.length} Facilities).`
                    };

                    try {
                      pushCentralMasterData({
                        dspReceivedMohRows: filteredRows,
                        updatedBy: 'RHB Regional Logistics',
                        updateKind: `Transmit Region Breakdown Matrix to EPSS (${filteredRows.length} Facilities, ${grandTotalUnits} Units)`
                      });
                    } catch (e) {
                      console.warn(e);
                    }
                    setIsTransmitModalOpen(false);
                    showToast(`✓ Regional Breakdown Matrix (${filteredRows.length} Facilities) transmitted to EPSS as Dossier [${cleanDspName}]!`);
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-amber-400 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Transmit to EPSS</span>
                </button>
              </div>
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

