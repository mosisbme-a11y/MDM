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
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { HealthFacilityRecord, DspWorkflowRecord } from '../types';
import { DEFAULT_SAMPLE_RECORDS } from './HFListUploadModal';
import { pushCentralMasterData } from '../utils/centralSyncService';
import { saveDspRecordsToIndexedDB } from '../utils/indexedDbCache';

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
  { id: 'col-anesthesia', name: 'Anesthesia machine - with Patient mon', code: '403-XRRD-0101' },
  { id: 'col-bed', name: 'Bed - Patient, Fowler, Adult', code: '403-XRRD-0101' },
  { id: 'col-bowel', name: 'Bowel - With Stand, Stainless Steel.', code: '403-XRRB-0101N' },
  { id: 'col-coldbox', name: 'Cold box', code: '403-XRRD-0101-001' },
  { id: 'col-delivery', name: 'Couch - Delivery', code: '401-WICU-0101N' },
  { id: 'col-exam', name: 'Couch - Examination', code: '401-WICU-0101N' },
];

export const DEFAULT_STAGE_3_ROWS: RegionBreakdownRow[] = [
  {
    id: 'row-1',
    region: 'Oromia',
    zone: 'Addis ketema',
    woreda: '1',
    hub: 'General Regional Hub',
    healthFacility: '100012',
    customerDescription: 'Abeshige Woreda Health Office',
    packages: 'MCH',
    quantities: {
      'col-anesthesia': 2,
      'col-bed': 3,
      'col-bowel': 3,
      'col-coldbox': 2,
      'col-delivery': 2,
      'col-exam': 2,
    }
  },
  {
    id: 'row-2',
    region: 'Oromia',
    zone: 'Addis ketema',
    woreda: '1',
    hub: 'General Regional Hub',
    healthFacility: '100015',
    customerDescription: 'Addis Hiwot Health Center',
    packages: 'OR',
    quantities: {
      'col-anesthesia': 2,
      'col-bed': 3,
      'col-bowel': 3,
      'col-coldbox': 2,
      'col-delivery': 2,
      'col-exam': 2,
    }
  },
  {
    id: 'row-3',
    region: 'Oromia',
    zone: 'Addis ketema',
    woreda: '1',
    hub: 'General Regional Hub',
    healthFacility: '100019',
    customerDescription: 'Adama Health Center',
    packages: 'ICU',
    quantities: {
      'col-anesthesia': 2,
      'col-bed': 1,
      'col-bowel': 1,
      'col-coldbox': 2,
      'col-delivery': 2,
      'col-exam': 2,
    }
  },
  {
    id: 'row-4',
    region: 'Oromia',
    zone: 'kirkose',
    woreda: '3',
    hub: 'General Regional Hub',
    healthFacility: '100015',
    customerDescription: 'Addis Hiwot Health Center',
    packages: 'MCH',
    quantities: {
      'col-anesthesia': 2,
      'col-bed': 0,
      'col-bowel': 0,
      'col-coldbox': 2,
      'col-delivery': 2,
      'col-exam': 2,
    }
  },
  {
    id: 'row-5',
    region: 'Oromia',
    zone: 'kirkose',
    woreda: '3',
    hub: 'General Regional Hub',
    healthFacility: '100022',
    customerDescription: 'Abala Primary Hospital',
    packages: 'OR',
    quantities: {
      'col-anesthesia': 2,
      'col-bed': 3,
      'col-bowel': 3,
      'col-coldbox': 2,
      'col-delivery': 2,
      'col-exam': 2,
    }
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

  // Breakdown Request Selector & Column Configurator State
  const [selectedRequestId, setSelectedRequestId] = useState<string>(selectedBreakdownRequestId || '');
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

  // Effective Master HF list items (prop -> localStorage -> default sample records)
  const masterHfItems = useMemo<HealthFacilityRecord[]>(() => {
    if (hfListItems && hfListItems.length > 0) return hfListItems;
    try {
      const saved = localStorage.getItem('epss_hf_list_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SAMPLE_RECORDS as unknown as HealthFacilityRecord[];
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
          } else {
            updatedRow.customerDescription = '';
            updatedRow.healthFacility = '';
            updatedRow.zone = '';
            updatedRow.woreda = '';
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

  // Export to Excel in exact 2-tier format
  const handleExportExcel = () => {
    const aoa: any[][] = [];

    // Row 1: Date
    aoa.push(['Date', internalDate]);

    // Row 2: Top Tier Headers
    aoa.push([
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'List of Packeges',
      ...columns.map(c => c.name)
    ]);

    // Row 3: Bottom Tier Headers (Item Codes)
    aoa.push([
      '',
      '',
      '',
      '',
      '',
      ...columns.map(c => c.code)
    ]);

    // Data rows
    filteredRows.forEach(r => {
      aoa.push([
        r.region,
        r.zone,
        r.woreda,
        r.healthFacility,
        r.packages,
        ...columns.map(c => {
          const val = r.quantities[c.id];
          return val === 0 ? '' : (val ?? '');
        })
      ]);
    });

    // Totals row
    aoa.push([
      'TOTAL',
      '',
      '',
      `${filteredRows.length} Facilities`,
      '',
      ...columns.map(c => columnTotals[c.id] || 0)
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 32 },
      { wch: 18 },
      ...columns.map(() => ({ wch: 22 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facility Breakdown');
    const filename = `DSP_Region_To_MOH_Breakdown_${selectedRegionFilter !== 'all' ? selectedRegionFilter : 'All_Regions'}_${internalDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`✓ Exported ${filename}`);
  };

  // Download official blank template
  const handleDownloadTemplate = () => {
    const aoa: any[][] = [
      ['Date', new Date().toISOString().split('T')[0]],
      [
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
        'List of Packeges',
        'Anesthesia machine - with Patient mon',
        'Bed - Patient, Fowler, Adult',
        'Bowel - With Stand, Stainless Steel.',
        'Cold box',
        'Couch - Delivery',
        'Couch - Examination'
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '403-XRRD-0101',
        '403-XRRD-0101',
        '403-XRRB-0101N',
        '403-XRRD-0101-001',
        '401-WICU-0101N',
        '401-WICU-0101N'
      ],
      ['Oromia', 'Addis ketema', '1', 'Abeshige Woreda Health Office', 'MCH', 2, 3, 3, 2, 2, 2],
      ['Oromia', 'Addis ketema', '1', 'Addis Hiwot Health Center', 'OR', 2, 3, 3, 2, 2, 2],
      ['Oromia', 'Addis ketema', '1', 'Adama Health Center', 'ICU', 2, 1, 1, 2, 2, 2],
      ['Oromia', 'kirkose', '3', 'Addis Hiwot Health Center', 'MCH', 2, '', '', 2, 2, 2],
      ['Oromia', 'kirkose', '3', 'Abala Primary Hospital', 'OR', 2, 3, 3, 2, 2, 2]
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 32 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'EPSS_DSP_Region_To_MOH_Template.xlsx');
    showToast('✓ Downloaded EPSS_DSP_Region_To_MOH_Template.xlsx');
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
          {/* Send TO MOH Button */}
          <button
            type="button"
            onClick={() => setIsTransmitModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-amber-400 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
            title="Send official Region Breakdown Matrix to MOH PMD Directorate"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" />
            <span>Send TO MOH</span>
          </button>

          {/* Via Email Button */}
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
            title="Dispatch matrix via email to MOH"
          >
            <Mail className="w-3.5 h-3.5 text-white" />
            <span>Via email</span>
          </button>

          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
            title="Share matrix payload via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" />
            <span>WhatsApp</span>
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
            {/* Breakdown Request Dropdown (Only shown if not unlinked) */}
            {!disableBreakdownLink && breakdownRequests && breakdownRequests.length > 0 && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-amber-300 shadow-2xs">
                <span className="text-xs font-bold text-slate-700 pl-1">Request:</span>
                <select
                  value={selectedRequestId}
                  onChange={(e) => handleSelectBreakdownRequest(e.target.value)}
                  className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-amber-900 font-bold cursor-pointer focus:outline-none focus:border-amber-500 max-w-xs truncate"
                >
                  <option value="">-- Select Breakdown Request --</option>
                  {breakdownRequests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.dspRefNumber || 'Request'} — {req.subject || req.senderOrg} ({req.totalQuantity || 0} Units)
                    </option>
                  ))}
                </select>
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
                  colSpan={columns.length + 6} 
                  className="p-2.5 bg-slate-50 text-right text-[11px] font-mono text-slate-400 font-normal pr-4"
                >
                  Regional Health Bureau ➔ MOH PMD Medical Device Distribution Matrix ({selectedRegionFilter === 'all' ? 'All Regions' : selectedRegionFilter})
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
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[180px]">
                  Name of health facility
                </th>
                <th className="p-2.5 italic bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[120px]">
                  HUB
                </th>
                <th className="p-2.5 bg-[#fed7aa] text-slate-900 border-r border-slate-300 font-semibold min-w-[240px]">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#fef08a] border border-[#fde047] text-[#854d0e] font-bold shadow-2xs not-italic">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Customer Description</span>
                  </div>
                </th>
                <th className="p-2.5 italic bg-[#dbeafe] text-slate-900 border-r border-slate-300 font-semibold min-w-[120px] text-center">
                  List of Packeges
                </th>
                {columns.map(col => (
                  <th 
                    key={col.id} 
                    className="p-2.5 bg-slate-50 text-slate-900 border-r border-slate-300 font-semibold text-left min-w-[160px] max-w-[200px] leading-tight"
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
                <th className="p-2 bg-[#ffedd5] border-r border-slate-300"></th>
                <th className="p-2 bg-[#fef9c3] border-r border-slate-300"></th>
                <th className="p-2 bg-[#eff6ff] border-r border-slate-300"></th>
                {columns.map(col => (
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
                <th className="p-2 bg-indigo-50/40 border-r border-slate-300 font-mono text-[10px] text-indigo-700 font-bold text-center">
                  New Column
                </th>
                {isEditingMode && <th className="p-2 bg-slate-100"></th>}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 6 + (isEditingMode ? 1 : 0)} className="p-8 text-center text-slate-400">
                    No facility rows matching the selected region or filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
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
                  const isRecentlyLoaded = recentlyLoadedToken && Date.now() - recentlyLoadedToken < 30000;

                  return (
                    <tr key={row.id} className={`transition-all duration-700 ${isRecentlyLoaded ? 'bg-amber-50/90 border-l-4 border-amber-500 shadow-2xs' : 'hover:bg-slate-50/70'}`}>
                      {/* 1. Region */}
                      <td className="p-2 text-slate-800 border-r border-slate-200 font-medium min-w-[110px]">
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
                      <td className="p-2 text-slate-800 border-r border-slate-200 min-w-[120px]">
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
                          row.zone
                        )}
                      </td>

                      {/* 3. Woreda (Strictly filtered for selected region) */}
                      <td className="p-2 text-slate-800 border-r border-slate-200 font-mono text-center min-w-[80px]">
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
                          row.woreda
                        )}
                      </td>

                      {/* 4. Name of health facility (Customer Code or Facility Short Name) */}
                      <td className="p-2 text-slate-900 border-r border-slate-200 min-w-[170px] font-mono">
                        {isEditingMode ? (
                          <input
                            type="text"
                            value={row.healthFacility}
                            onChange={(e) => handleRowFieldChange(row.id, 'healthFacility', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-cyan-800"
                            placeholder="Facility / Customer ID..."
                          />
                        ) : (
                          <div className="font-bold text-cyan-800 flex items-center justify-between">
                            <span>{row.healthFacility}</span>
                          </div>
                        )}
                      </td>

                      {/* 5. HUB */}
                      <td className="p-2 text-slate-800 border-r border-slate-200 min-w-[120px] font-bold">
                        {row.hub}
                      </td>

                      {/* 6. Customer Description (STRICTLY FILTERED FOR SELECTED REGION ONLY) */}
                      <td className="p-2 text-slate-900 border-r border-slate-200 min-w-[250px] bg-amber-50/20">
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
                              <span>{activeCustDesc}</span>
                              <button
                                type="button"
                                onClick={() => setIsEditingMode(true)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-700 transition"
                                title="Edit customer description"
                              >
                                <Edit3 size={11} />
                              </button>
                            </div>
                            {matchedHf && (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                                <span className="text-amber-700 font-semibold">Plant:</span>
                                <span className="font-bold text-slate-700">{matchedHf.deliveringPlant || 'HO01'}</span>
                                {matchedHf.zoneDescription && <span className="text-slate-400">• {matchedHf.zoneDescription}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                    {/* List of Packeges */}
                    <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-center bg-[#eff6ff]/40 text-blue-800">
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

                    {/* Equipment Quantity Cells */}
                    {columns.map(col => {
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

                    {/* Quick Add Column placeholder cell */}
                    <td className="p-2 border-r border-slate-200 text-center bg-slate-50/20 text-slate-300 font-mono text-[10px]">
                      -
                    </td>

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
              }))}

              {/* Inline Add Facility Row Button Row */}
              <tr className="bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
                <td colSpan={columns.length + 6 + (isEditingMode ? 1 : 0)} className="p-2.5 text-center">
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
                <td className="p-2.5 border-r border-slate-300 text-center font-mono text-blue-700">
                  -
                </td>
                {columns.map(col => (
                  <td 
                    key={col.id} 
                    className="p-2.5 border-r border-slate-300 text-right font-mono font-black text-amber-700 bg-amber-50/50"
                  >
                    {columnTotals[col.id] || 0}
                  </td>
                ))}
                <td className="p-2.5 border-r border-slate-300 text-center font-mono text-indigo-700 font-bold text-[11px] bg-indigo-50/30">
                  -
                </td>
                {isEditingMode && <td className="p-2"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODAL 1: SEND TO MOH (DIRECT INSTITUTIONAL TRANSMITTAL) */}
      {isTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Send Region Breakdown Matrix to MOH</h3>
                  <p className="text-[11px] text-slate-400">Official Health Facility breakdown transmittal to Ministry of Health</p>
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
                  Submitting this matrix will transmit exact Region, Zone, Woreda, Health Facility Name, and Equipment quantities directly to MOH PMD Directorate (Sub-step 3.2 & 2.3).
                </p>
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
                    try {
                      localStorage.setItem('epss_dsp_3_2_rows', JSON.stringify(filteredRows));
                      pushCentralMasterData({
                        dspReceivedMohRows: filteredRows,
                        updatedBy: 'RHB Regional Logistics',
                        updateKind: `Transmit Region Breakdown Matrix to MOH (${filteredRows.length} Facilities, ${grandTotalUnits} Units)`
                      });
                    } catch (e) {
                      console.warn(e);
                    }
                    setIsTransmitModalOpen(false);
                    showToast(`✓ Regional Breakdown Matrix (${filteredRows.length} Facilities) transmitted to MOH PMD Directorate!`);
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-amber-400 rounded-xl font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Transmit to MOH</span>
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
    </div>
  );
};
