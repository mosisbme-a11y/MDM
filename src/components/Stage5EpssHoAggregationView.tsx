import React, { useState, useMemo } from 'react';
import {
  GitMerge,
  Building2,
  CheckCircle2,
  AlertCircle,
  Download,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  Layers,
  MapPin,
  RefreshCw,
  Truck,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  Send,
  Eye,
  SlidersHorizontal,
  BookmarkCheck,
  Check,
  X,
  Plus,
  Trash2,
  Copy,
  Printer,
  Table,
  CheckSquare,
  Mail,
  MessageCircle,
  Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  DspWorkflowRecord,
  HealthFacilityRecord
} from '../types';
import {
  EPSS_HUBS_REGISTRY,
  EpssHubInfo,
  getHubByCode,
  mapFacilityToHub,
  MapHfToHubResult
} from '../data/epssHubs';
import { formatNumber } from '../utils/formatters';

export interface Stage5AllocationItem {
  id: string;
  healthFacility: string;
  region: string;
  zone: string;
  woreda: string;
  packages: string;
  hubCode: string;
  hubName: string;
  masterCustomerCode?: string;
  masterFacilityName?: string;
  matchMethod: 'exact-master' | 'fuzzy-master' | 'zone-region-fallback' | 'manual-override' | 'unmapped';
  matchConfidence: number;
  quantities: Record<string, number>;
  totalQty: number;
}

export interface Stage5Column {
  id: string;
  name: string;
  code: string;
}

// Order Process Line Item (SAP Stock Transport Order - STO)
export interface OrderProcessLineItem {
  id: string;
  itemCategory: string; // 'U' (Auto U)
  material: string;     // Material code of item (e.g. '403-XRRD-0101')
  materialDescription: string;
  quantity: number;     // Summary quantity
  plant: string;        // Mapped HUB (Receiving Plant, e.g. 'AD01')
  plantName: string;    // e.g. 'Adama Hub'
  storageLocation: string; // Stor.Location (e.g. '0001')
  purchasingGroup: string; // PGr: 'HP4' (Auto HP4)
  supplyingPlant: string;  // SPlt: 'HO01' (Auto HO01)
  purchasingOrg: string;   // POrg: 'HP02' (Auto HP02)
  contributingFacilities: {
    facilityName: string;
    region: string;
    zone: string;
    woreda: string;
    qty: number;
  }[];
}

interface Stage5EpssHoAggregationViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems: HealthFacilityRecord[];
  setHfListItems?: React.Dispatch<React.SetStateAction<HealthFacilityRecord[]>>;
  initialTab?: 'aggregated-matrix' | 'order-process' | 'hub-summary' | 'catchment-flow' | 'branch-dispatch';
  onNavigateToMapHfToHub?: () => void;
  onProceedToOrderProcess?: () => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

export const Stage5EpssHoAggregationView: React.FC<Stage5EpssHoAggregationViewProps> = ({
  records,
  setRecords,
  hfListItems = [],
  setHfListItems,
  initialTab = 'aggregated-matrix',
  onNavigateToMapHfToHub,
  onProceedToOrderProcess,
  onTriggerCloudSync
}) => {
  // Strictly source ONLY dossiers that already received mapped HF->Hub data from 1.3.1 Map HF to Hub
  const stage5Dossiers = useMemo(() => {
    return records.filter(r =>
      r.hubAggregationData?.mappedFromMapHfToHub === true ||
      (r.hubAggregationData?.status === 'Mapped & Ready' &&
        Array.isArray(r.hubAggregationData?.allocations) &&
        r.hubAggregationData.allocations.length > 0 &&
        Array.isArray(r.hubAggregationData?.columns) &&
        r.hubAggregationData.columns.length > 0) ||
      (r.stage === 'epss-ho-aggregation' &&
        (r.subStage === '1.3.1' || r.subStage === '1.3') &&
        Boolean(r.facilityMatrixData?.rows?.some(row => Boolean(row.hub && row.hub.trim() && row.hub !== 'HO01'))))
    );
  }, [records]);

  // Selected Dossier State
  const [selectedDossierId, setSelectedDossierId] = useState<string>(() => {
    return stage5Dossiers[0]?.id || '';
  });

  React.useEffect(() => {
    if (stage5Dossiers.length > 0 && !stage5Dossiers.some(d => d.id === selectedDossierId)) {
      setSelectedDossierId(stage5Dossiers[0].id);
    } else if (stage5Dossiers.length === 0 && selectedDossierId !== '') {
      setSelectedDossierId('');
    }
  }, [stage5Dossiers, selectedDossierId]);

  // Current selected dossier
  const currentDossier = useMemo(() => {
    return stage5Dossiers.find(d => d.id === selectedDossierId) || stage5Dossiers[0] || null;
  }, [stage5Dossiers, selectedDossierId]);

  // View Mode: 'aggregated-matrix' | 'order-process' | 'hub-summary' | 'catchment-flow' | 'branch-dispatch'
  const [viewTab, setViewTab] = useState<'aggregated-matrix' | 'order-process' | 'hub-summary' | 'catchment-flow' | 'branch-dispatch'>(initialTab);
  const [showContributingFacilities, setShowContributingFacilities] = useState(false);

  React.useEffect(() => {
    if (initialTab) {
      setViewTab(initialTab);
    }
  }, [initialTab]);
  const [dispatchHubModal, setDispatchHubModal] = useState<{
    hubCode: string;
    hubName: string;
    manager: string;
    phone: string;
    email: string;
    totalQuantity: number;
    facilities: Stage5AllocationItem[];
    quantitiesByItem: Record<string, number>;
  } | null>(null);
  const [dispatchChannel, setDispatchChannel] = useState<'email' | 'whatsapp'>('email');
  const [dispatchCopied, setDispatchCopied] = useState(false);

  const handleOpenBranchDispatch = (
    hubSummary: { hub: EpssHubInfo; facilities: Stage5AllocationItem[]; totalQuantity: number; quantitiesByItem: Record<string, number> },
    channel: 'email' | 'whatsapp'
  ) => {
    setDispatchHubModal({
      hubCode: hubSummary.hub.code,
      hubName: hubSummary.hub.name,
      manager: hubSummary.hub.manager || 'Branch Manager',
      phone: hubSummary.hub.phone || '+251911000000',
      email: `${hubSummary.hub.code.toLowerCase()}@epss.gov.et`,
      totalQuantity: hubSummary.totalQuantity,
      facilities: hubSummary.facilities,
      quantitiesByItem: hubSummary.quantitiesByItem
    });
    setDispatchChannel(channel);
  };

  // Search & Filters for Matrix
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('all');

  // Search & Filters for Order Process
  const [orderProcessSearch, setOrderProcessSearch] = useState('');
  const [orderProcessPlantFilter, setOrderProcessPlantFilter] = useState('all');
  const [orderProcessOverrides, setOrderProcessOverrides] = useState<Record<string, { storageLocation?: string; quantity?: number }>>({});
  const [expandedOrderLineId, setExpandedOrderLineId] = useState<string | null>(null);
  const [showSapPreviewModal, setShowSapPreviewModal] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Modal to add new facility row
  const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);
  const [newFacilityForm, setNewFacilityForm] = useState({
    region: 'Oromia',
    zone: '',
    woreda: '',
    healthFacility: '',
    packages: 'MCH',
    defaultQty: 2
  });

  // Equipment Columns strictly from the mapped 1.3.1 Map HF to Hub dossier (no fake defaults)
  const equipmentColumns: Stage5Column[] = useMemo(() => {
    if (!currentDossier) return [];
    if (currentDossier.hubAggregationData?.columns && currentDossier.hubAggregationData.columns.length > 0) {
      return currentDossier.hubAggregationData.columns;
    }
    if (
      currentDossier.facilityMatrixData?.columns &&
      currentDossier.facilityMatrixData.columns.length > 0 &&
      currentDossier.facilityMatrixData.rows?.some(row => Boolean(row.hub && row.hub.trim() && row.hub !== 'HO01'))
    ) {
      return currentDossier.facilityMatrixData.columns.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code
      }));
    }
    return [];
  }, [currentDossier]);

  // Mapped Health Facility Allocations strictly from 1.3.1 Map HF to Hub (no hardcoded fake rows)
  const allocations: Stage5AllocationItem[] = useMemo(() => {
    if (!currentDossier) return [];
    if (currentDossier.hubAggregationData?.allocations && currentDossier.hubAggregationData.allocations.length > 0) {
      return currentDossier.hubAggregationData.allocations;
    }

    const mappedRows = (currentDossier.facilityMatrixData?.rows || []).filter(
      row => Boolean(row.hub && row.hub.trim() && row.hub !== 'HO01')
    );

    if (mappedRows.length > 0) {
      return mappedRows.map((r: any, idx: number) => {
        const match = mapFacilityToHub(
          r.healthFacility || r.customerDescription || '',
          r.region || '',
          r.zone || '',
          r.woreda || '',
          hfListItems
        );
        const hubCode = (r.hub || '').trim();
        const hubInfo = getHubByCode(hubCode);
        const quantities = r.quantities || {};
        const totalQty = Object.values(quantities).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0) as number;

        return {
          id: r.id || `alloc-s5-${idx}`,
          healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
          region: r.region || match.region || 'Unspecified',
          zone: r.zone || match.zone || '-',
          woreda: r.woreda || match.woreda || '-',
          packages: r.packages || 'MCH',
          hubCode,
          hubName: hubInfo?.name || match.hubName || hubCode,
          masterCustomerCode: match.masterCustomerCode,
          masterFacilityName: match.masterFacilityName,
          matchMethod: match.matchMethod,
          matchConfidence: match.matchConfidence,
          quantities,
          totalQty
        };
      });
    }

    return [];
  }, [currentDossier, hfListItems]);

  // Item Aggregation grouped strictly by Plant (Mapped Hub from 1.3.1 Map HF to Hub)
  const plantAggregatedRows = useMemo(() => {
    if (allocations.length === 0 || equipmentColumns.length === 0) return [];

    const plantMap = new Map<
      string,
      {
        plant: string;
        plantName: string;
        facilityCount: number;
        quantities: Record<string, number>;
        totalQty: number;
        facilities: Stage5AllocationItem[];
      }
    >();

    allocations.forEach((alloc) => {
      const plantCode = (alloc.hubCode || '').trim().toUpperCase();
      if (!plantCode || plantCode === 'HO01') return;
      const hubInfo = getHubByCode(plantCode);

      let entry = plantMap.get(plantCode);
      if (!entry) {
        entry = {
          plant: plantCode,
          plantName: hubInfo?.name || alloc.hubName || plantCode,
          facilityCount: 0,
          quantities: {},
          totalQty: 0,
          facilities: []
        };
        plantMap.set(plantCode, entry);
      }

      entry.facilityCount += 1;
      entry.facilities.push(alloc);

      equipmentColumns.forEach((col) => {
        const qty = Number(alloc.quantities[col.id]) || 0;
        entry!.quantities[col.id] = (entry!.quantities[col.id] || 0) + qty;
        entry!.totalQty += qty;
      });
    });

    return Array.from(plantMap.values())
      .sort((a, b) => a.plant.localeCompare(b.plant))
      .map((entry, idx) => ({
        sn: idx + 1,
        ...entry
      }));
  }, [allocations, equipmentColumns]);

  const filteredPlantRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return plantAggregatedRows.filter((row) => {
      const matchesHub = selectedHubFilter === 'all' || row.plant === selectedHubFilter;
      const matchesSearch =
        !q ||
        row.plant.toLowerCase().includes(q) ||
        row.plantName.toLowerCase().includes(q) ||
        row.facilities.some((f) => f.healthFacility.toLowerCase().includes(q) || f.region.toLowerCase().includes(q));
      return matchesHub && matchesSearch;
    });
  }, [plantAggregatedRows, searchQuery, selectedHubFilter]);

  // Unique regions
  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(allocations.map(a => a.region).filter(Boolean))).sort();
  }, [allocations]);

  // ============================================================================
  // ORDER PROCESS ENGINE (SAP STO Transfer Order Generation)
  // Summarizes allocations by Receiving Plant (Mapped HUB) and Material (code of item)
  // Columns: I (Auto U), Material (code of item), Quantity (summary), Plant (Mapped HUB),
  //          Stor.Location (default 0001), PGr (Auto HP4), SPlt (Auto HO01), POrg (Auto HP02)
  // ============================================================================
  const orderProcessItems: OrderProcessLineItem[] = useMemo(() => {
    // Map of key `${hubCode}__${materialCode}`
    const map = new Map<string, {
      hubCode: string;
      hubName: string;
      materialCode: string;
      materialName: string;
      totalQty: number;
      facilities: { facilityName: string; region: string; zone: string; woreda: string; qty: number }[];
    }>();

    allocations.forEach(alloc => {
      const hubCode = alloc.hubCode || 'HO01';
      const hubInfo = getHubByCode(hubCode);
      const hubName = hubInfo?.name || alloc.hubName || 'EPSS Hub';

      equipmentColumns.forEach(col => {
        const qty = Number(alloc.quantities[col.id]) || 0;
        if (qty > 0) {
          const key = `${hubCode}__${col.code}`;
          if (!map.has(key)) {
            map.set(key, {
              hubCode,
              hubName,
              materialCode: col.code,
              materialName: col.name,
              totalQty: 0,
              facilities: []
            });
          }
          const entry = map.get(key)!;
          entry.totalQty += qty;
          entry.facilities.push({
            facilityName: alloc.healthFacility,
            region: alloc.region,
            zone: alloc.zone,
            woreda: alloc.woreda,
            qty
          });
        }
      });
    });

    const lines: OrderProcessLineItem[] = [];
    map.forEach((entry, key) => {
      const lineId = `sto-${key}`;
      const override = orderProcessOverrides[lineId];

      lines.push({
        id: lineId,
        itemCategory: 'U', // under I column You fill Auto U
        material: entry.materialCode, // Material means code of item
        materialDescription: entry.materialName,
        quantity: override?.quantity !== undefined ? override.quantity : entry.totalQty, // quantity is summery
        plant: entry.hubCode, // Plant is Mapped HUB
        plantName: entry.hubName,
        storageLocation: override?.storageLocation || '0001', // Stor.Location
        purchasingGroup: 'HP4', // under PGr Column you fill auto HP4
        supplyingPlant: 'HO01', // under SPlt Column you fill auto HO01
        purchasingOrg: 'HP02',  // under POrg Column you fill auto HP02
        contributingFacilities: entry.facilities
      });
    });

    // Sort by Plant (Mapped Hub) then Material code
    return lines.sort((a, b) => a.plant.localeCompare(b.plant) || a.material.localeCompare(b.material));
  }, [allocations, equipmentColumns, orderProcessOverrides]);

  // Filtered Order Process items
  const filteredOrderProcessItems = useMemo(() => {
    return orderProcessItems.filter(item => {
      const matchesSearch =
        item.material.toLowerCase().includes(orderProcessSearch.toLowerCase()) ||
        item.materialDescription.toLowerCase().includes(orderProcessSearch.toLowerCase()) ||
        item.plant.toLowerCase().includes(orderProcessSearch.toLowerCase()) ||
        item.plantName.toLowerCase().includes(orderProcessSearch.toLowerCase());

      const matchesPlant = orderProcessPlantFilter === 'all' || item.plant === orderProcessPlantFilter;

      return matchesSearch && matchesPlant;
    });
  }, [orderProcessItems, orderProcessSearch, orderProcessPlantFilter]);

  // Aggregation by EPSS Hub
  const hubSummaries = useMemo(() => {
    const hubMap = new Map<string, {
      hub: EpssHubInfo;
      facilities: Stage5AllocationItem[];
      totalQuantity: number;
      quantitiesByItem: Record<string, number>;
    }>();

    allocations.forEach((item) => {
      const hubCode = item.hubCode || 'HO01';
      const hubInfo = getHubByCode(hubCode) || {
        code: hubCode,
        name: item.hubName || 'EPSS Hub',
        region: item.region || 'National',
        manager: 'Branch Logistics Officer',
        phone: '+251 11 000 0000'
      };

      if (!hubMap.has(hubCode)) {
        hubMap.set(hubCode, {
          hub: hubInfo,
          facilities: [],
          totalQuantity: 0,
          quantitiesByItem: {}
        });
      }

      const entry = hubMap.get(hubCode)!;
      entry.facilities.push(item);
      entry.totalQuantity += item.totalQty;

      Object.entries(item.quantities || {}).forEach(([colId, qty]) => {
        entry.quantitiesByItem[colId] = (entry.quantitiesByItem[colId] || 0) + (Number(qty) || 0);
      });
    });

    return Array.from(hubMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [allocations]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalFacilities = allocations.length;
    const totalUnits = allocations.reduce((sum, a) => sum + a.totalQty, 0);
    const activeHubsCount = hubSummaries.length;
    const exactMatches = allocations.filter(a => a.matchMethod === 'exact-master').length;
    const fuzzyMatches = allocations.filter(a => a.matchMethod === 'fuzzy-master').length;
    const mappedFacilities = allocations.filter(a => a.matchMethod !== 'unmapped').length;
    const coveragePercent = totalFacilities > 0 ? Math.round((mappedFacilities / totalFacilities) * 100) : 0;
    const totalOrderProcessLines = orderProcessItems.length;
    const totalOrderProcessQty = orderProcessItems.reduce((acc, i) => acc + i.quantity, 0);

    return {
      totalFacilities,
      totalUnits,
      activeHubsCount,
      exactMatches,
      fuzzyMatches,
      mappedFacilities,
      coveragePercent,
      totalOrderProcessLines,
      totalOrderProcessQty
    };
  }, [allocations, hubSummaries, orderProcessItems]);

  // 1. ACTION: Add new health facility row
  const handleAddFacilityRow = () => {
    if (!newFacilityForm.healthFacility.trim() || !currentDossier) return;

    const match = mapFacilityToHub(
      newFacilityForm.healthFacility,
      newFacilityForm.region,
      newFacilityForm.zone,
      newFacilityForm.woreda,
      hfListItems
    );

    const initialQuantities: Record<string, number> = {};
    equipmentColumns.forEach(c => {
      initialQuantities[c.id] = newFacilityForm.defaultQty;
    });

    const newAlloc: Stage5AllocationItem = {
      id: `alloc-new-${Date.now()}`,
      healthFacility: newFacilityForm.healthFacility.trim(),
      region: newFacilityForm.region,
      zone: newFacilityForm.zone.trim() || 'Central',
      woreda: newFacilityForm.woreda.trim() || '01',
      packages: newFacilityForm.packages,
      hubCode: match.hubCode,
      hubName: match.hubName,
      masterCustomerCode: match.masterCustomerCode,
      masterFacilityName: match.masterFacilityName,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
      quantities: initialQuantities,
      totalQty: newFacilityForm.defaultQty * equipmentColumns.length
    };

    const updatedAllocations = [...allocations, newAlloc];
    const updatedDossier: DspWorkflowRecord = {
      ...currentDossier,
      targetedFacilitiesCount: updatedAllocations.length,
      totalQuantity: updatedAllocations.reduce((sum, a) => sum + a.totalQty, 0),
      hubAggregationData: {
        ...(currentDossier.hubAggregationData || {}),
        columns: equipmentColumns,
        allocations: updatedAllocations
      }
    };

    setRecords(prev => prev.map(r => r.id === currentDossier.id ? updatedDossier : r));
    setIsAddFacilityModalOpen(false);
    setNewFacilityForm({
      region: 'Oromia',
      zone: '',
      woreda: '',
      healthFacility: '',
      packages: 'MCH',
      defaultQty: 2
    });

    setNotification({
      type: 'success',
      message: `Added ${newAlloc.healthFacility} and auto-mapped to ${newAlloc.hubName}!`
    });
  };

  // 7. ACTION: Export Item Aggregation Excel (.xlsx) matching exact S/N | Plant | Item Name / SAP Code format
  const handleExportExcel = () => {
    if (!currentDossier || plantAggregatedRows.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Exact Item Aggregation by Plant format
    const aggRow1 = ['S/N', 'Plant', ...equipmentColumns.map(c => c.name)];
    const aggRow2 = ['', '', ...equipmentColumns.map(c => c.code)];
    const aggDataRows = filteredPlantRows.map(r => [
      r.sn,
      r.plant,
      ...equipmentColumns.map(c => r.quantities[c.id] || 0)
    ]);

    const wsAgg = XLSX.utils.aoa_to_sheet([aggRow1, aggRow2, ...aggDataRows]);
    wsAgg['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      ...equipmentColumns.map(() => ({ wch: 24 }))
    ];
    XLSX.utils.book_append_sheet(wb, wsAgg, 'Item_Aggregation_By_Plant');

    // Sheet 2: Source Mapped Facilities from 1.3.1 Map HF to Hub
    const srcRow1 = ['Region', 'Zone', 'Woreda', 'Name of health facility', 'List of Packages', 'Plant', ...equipmentColumns.map(c => c.name)];
    const srcRow2 = ['', '', '', '', 'List of Packages', 'Plant', ...equipmentColumns.map(c => c.code)];
    const srcDataRows = allocations.map(item => [
      item.region,
      item.zone,
      item.woreda,
      item.healthFacility,
      item.packages,
      item.hubCode,
      ...equipmentColumns.map(c => item.quantities[c.id] || 0)
    ]);
    const wsSource = XLSX.utils.aoa_to_sheet([srcRow1, srcRow2, ...srcDataRows]);
    XLSX.utils.book_append_sheet(wb, wsSource, 'Source_Map_HF_to_Hub');

    XLSX.writeFile(wb, `EPSS_Item_Aggregation_By_Plant_${currentDossier.dspRefNumber.replace(/[\/\\]/g, '_')}.xlsx`);

    setNotification({
      type: 'success',
      message: 'Exported Item Aggregation by Plant spreadsheet (.xlsx) matching official two-tier format!'
    });
  };

  // 8. ORDER PROCESS ACTIONS:
  // 8A. Copy SAP STO Table (Clipboard TSV ready for SAP ME21N)
  const handleCopySapClipboard = () => {
    // Columns exactly matching user request:
    // I  Material  Quantity  Plant  Stor.Location  PGr  SPlt  POrg
    const headers = ['I', 'Material', 'Quantity', 'Plant', 'Stor.Location', 'PGr', 'SPlt', 'POrg'];
    const rows = filteredOrderProcessItems.map(item => [
      item.itemCategory,    // 'U'
      item.material,        // code of item
      item.quantity,        // summary quantity
      item.plant,           // Mapped HUB code
      item.storageLocation, // Stor.Location (0001)
      item.purchasingGroup, // 'HP4'
      item.supplyingPlant,  // 'HO01'
      item.purchasingOrg    // 'HP02'
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent).then(() => {
      setNotification({
        type: 'success',
        message: `Copied ${filteredOrderProcessItems.length} SAP STO lines to clipboard (I=U, PGr=HP4, SPlt=HO01, POrg=HP02). Paste (Ctrl+V) directly into SAP ME21N table!`
      });
    }).catch(() => {
      setShowSapPreviewModal(true);
    });
  };

  // 8B. Export Order Process Excel (.xlsx)
  const handleExportOrderProcessExcel = () => {
    if (!currentDossier) return;

    // Exact required columns:
    // I | Material | Quantity | Plant | Stor.Location | PGr | SPlt | POrg
    const headers = [
      'I',
      'Material',
      'Quantity',
      'Plant',
      'Stor.Location',
      'PGr',
      'SPlt',
      'POrg',
      'Material Description',
      'Plant Name (Mapped HUB)',
      'Source Facilities Count'
    ];

    const rows = filteredOrderProcessItems.map(item => [
      item.itemCategory,    // Auto U
      item.material,        // Material code
      item.quantity,        // Summary quantity
      item.plant,           // Mapped HUB
      item.storageLocation, // Stor.Location
      item.purchasingGroup, // Auto HP4
      item.supplyingPlant,  // Auto HO01
      item.purchasingOrg,   // Auto HP02
      item.materialDescription,
      item.plantName,
      item.contributingFacilities.length
    ]);

    const totalRow = [
      'TOTAL',
      `${filteredOrderProcessItems.length} STO Lines`,
      filteredOrderProcessItems.reduce((sum, item) => sum + item.quantity, 0),
      `${Array.from(new Set(filteredOrderProcessItems.map(i => i.plant))).length} Plants`,
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow]);
    ws['!cols'] = [
      { wch: 6 },  // I
      { wch: 18 }, // Material
      { wch: 12 }, // Quantity
      { wch: 10 }, // Plant
      { wch: 14 }, // Stor.Location
      { wch: 8 },  // PGr
      { wch: 8 },  // SPlt
      { wch: 8 },  // POrg
      { wch: 32 }, // Material Description
      { wch: 24 }, // Plant Name
      { wch: 18 }  // Source Facilities
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SAP_STO_Order_Process');
    XLSX.writeFile(wb, `EPSS_SAP_Order_Process_${currentDossier.dspRefNumber.replace(/[\/\\]/g, '_')}.xlsx`);

    setNotification({
      type: 'success',
      message: 'Exported SAP Order Process (STO) spreadsheet (.xlsx) successfully!'
    });
  };

  // 8C. Export Order Process CSV
  const handleExportOrderProcessCSV = () => {
    if (!currentDossier) return;

    const headers = ['I', 'Material', 'Quantity', 'Plant', 'Stor.Location', 'PGr', 'SPlt', 'POrg'];
    const rows = filteredOrderProcessItems.map(item => [
      `"${item.itemCategory}"`,
      `"${item.material}"`,
      item.quantity,
      `"${item.plant}"`,
      `"${item.storageLocation}"`,
      `"${item.purchasingGroup}"`,
      `"${item.supplyingPlant}"`,
      `"${item.purchasingOrg}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EPSS_SAP_Order_Process_${currentDossier.dspRefNumber.replace(/[\/\\]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({
      type: 'success',
      message: 'Exported SAP Order Process to CSV successfully!'
    });
  };

  // 9. ACTION: Advance to Stage 6 Branch Dispatch Order
  const handleAdvanceToStage6 = () => {
    if (!currentDossier) return;

    const newStage6Dossier: DspWorkflowRecord = {
      id: `dsp-stage6-${Date.now()}`,
      dspRefNumber: currentDossier.dspRefNumber.replace('HO-AGG', 'BRANCH-DISP').replace('MOH', 'EPSS-DISP'),
      stage: 'epss-to-branch',
      stageTitle: '6. DSP Dispatched to EPSS Branch',
      senderOrg: 'EPSS Head Office (Central Logistics Directorate)',
      recipientOrg: `EPSS Branch Hubs (${hubSummaries.map(h => h.hub.name).slice(0, 3).join(', ')}${hubSummaries.length > 3 ? '...' : ''})`,
      subject: `Branch Dispatch Packing & Transport Order - ${currentDossier.subject}`,
      status: 'Submitted & Pending',
      dateSubmitted: new Date().toISOString().split('T')[0],
      totalDevices: equipmentColumns.length,
      totalQuantity: stats.totalUnits,
      totalValuationETB: currentDossier.totalValuationETB || 18500000,
      targetedRegions: uniqueRegions,
      targetedFacilitiesCount: stats.totalFacilities,
      officialLetterRef: `EPSS/DISP/LET/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      signatory: 'Dr. Solomon Abebe (EPSS DG)',
      signatoryRole: 'Director General',
      itemsIncluded: currentDossier.itemsIncluded,
      notes: `Generated from Stage 5 Hub Aggregation & SAP Order Process. Total ${orderProcessItems.length} STO lines mapped to ${hubSummaries.length} EPSS branch plants.`,
      hubAggregationData: {
        ...(currentDossier.hubAggregationData || {}),
        orderProcessLines: orderProcessItems
      }
    };

    setRecords(prev => [newStage6Dossier, ...prev]);

    setNotification({
      type: 'success',
      message: `Generated Stage 6 Branch Dispatch Order (${newStage6Dossier.dspRefNumber}) with ${orderProcessItems.length} SAP STO lines for ${hubSummaries.length} EPSS Branch Hubs!`
    });

    if (onTriggerCloudSync) {
      onTriggerCloudSync(`Advanced to Stage 6 Branch Dispatch: ${newStage6Dossier.dspRefNumber}`, {
        type: 'CREATE',
        title: 'Stage 6 Branch Dispatch Created',
        payload: newStage6Dossier
      });
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : notification.type === 'info'
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-md transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Bar: Dossier Selector + Format Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm">
        {/* Dossier Picker */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700 flex-shrink-0">Stage 5 Dossier:</span>
          {stage5Dossiers.length > 0 ? (
            <select
              value={selectedDossierId}
              onChange={(e) => setSelectedDossierId(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm max-w-sm truncate"
            >
              {stage5Dossiers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.dspRefNumber} - {d.subject.slice(0, 45)}... ({d.targetedFacilitiesCount} HFs)
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              No mapped data from 1.3.1 Map HF to Hub yet.
            </span>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setViewTab('aggregated-matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewTab === 'aggregated-matrix'
                ? 'bg-[#0B1527] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>Item Aggregation (By Plant)</span>
          </button>

          <button
            onClick={() => setViewTab('order-process')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewTab === 'order-process'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>ORDER PROCESS (SAP STO)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              viewTab === 'order-process' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {orderProcessItems.length}
            </span>
          </button>

          <button
            onClick={() => setViewTab('hub-summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewTab === 'hub-summary'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>By EPSS Hub ({hubSummaries.length})</span>
          </button>

          <button
            onClick={() => setViewTab('catchment-flow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewTab === 'catchment-flow'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Hub Catchment Flow</span>
          </button>

          <button
            onClick={() => setViewTab('branch-dispatch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewTab === 'branch-dispatch'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Branch Dispatch (Email & WhatsApp)</span>
          </button>
        </div>
      </div>

      {/* ============================================================================
          VIEW 1: 1.3.3 ITEM AGGREGATION BY PLANT (EXACTLY FROM 1.3.1 MAP HF TO HUB)
          Format: S/N | Plant (Yellow) | Equipment Description (Peach) / SAP Code (White)
          ============================================================================ */}
      {viewTab === 'aggregated-matrix' && (
        <div className="space-y-3">
          {plantAggregatedRows.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1 max-w-lg mx-auto">
                <h3 className="text-base font-black text-slate-900">
                  No Mapped Data Received from 1.3.1 Map HF to Hub Yet
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong>1.3.3 Item Aggregation</strong> aggregates equipment quantities per <strong>Plant</strong> exclusively from facilities mapped in <strong>1.3.1 Map HF to Hub</strong>. Go to <strong>Map HF to Hub</strong>, map your health facilities to EPSS Plants/Hubs, and click <strong>Save &amp; Aggregate by Plant (1.3.3)</strong>.
                </p>
              </div>
              {onNavigateToMapHfToHub && (
                <button
                  type="button"
                  onClick={onNavigateToMapHfToHub}
                  className="px-5 py-2.5 rounded-xl bg-[#0B1527] hover:bg-black text-amber-400 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-md transition"
                >
                  <GitMerge className="w-4 h-4" />
                  <span>Go to 1.3.1 Map HF to Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Compact Summary & Action Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B1527] text-white text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Sourced strictly from 1.3.1 Map HF to Hub</span>
                    <span className="text-amber-300 font-mono">
                      ({plantAggregatedRows.length} Plants • {allocations.length} Mapped HFs • {formatNumber(stats.totalUnits)} Units)
                    </span>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter Plant (AA01, AD01)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <select
                    value={selectedHubFilter}
                    onChange={(e) => setSelectedHubFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">All Mapped Plants ({plantAggregatedRows.length})</option>
                    {plantAggregatedRows.map(pr => (
                      <option key={pr.plant} value={pr.plant}>
                        {pr.plant} - {pr.plantName} ({pr.facilityCount} HFs)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowContributingFacilities(!showContributingFacilities)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showContributingFacilities ? 'Hide Source HFs' : `Source HFs (${allocations.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onProceedToOrderProcess) {
                        onProceedToOrderProcess();
                      } else {
                        setViewTab('order-process');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Proceed to Order Process (1.3.4)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* EXACT ITEM AGGREGATION SPREADSHEET TABLE (S/N | Plant [Yellow] | Equipment Name [Peach] / SAP Code [White]) */}
              <div className="bg-white border border-slate-400 rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                  <table className="w-full text-left border-collapse select-text text-xs">
                    <thead>
                      {/* TIER 1 HEADER ROW: S/N | Plant (Yellow) | Equipment Description (Peach) */}
                      <tr>
                        <th className="bg-white text-slate-900 font-semibold border border-slate-400 py-2 px-3 text-left w-14 align-bottom">
                          S/N
                        </th>
                        <th className="bg-[#ffff00] text-slate-950 font-semibold border border-slate-400 py-2 px-3 text-left min-w-[110px] align-bottom">
                          Plant
                        </th>
                        {equipmentColumns.map(col => (
                          <th
                            key={col.id}
                            className="bg-[#fed7aa] text-slate-900 font-normal border border-slate-400 py-2 px-3 text-left min-w-[165px] leading-tight align-middle"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>

                      {/* TIER 2 SUBHEADER ROW: Blank | Blank | SAP Material Codes */}
                      <tr>
                        <th className="bg-white border border-slate-400 py-1.5 px-3"></th>
                        <th className="bg-white border border-slate-400 py-1.5 px-3"></th>
                        {equipmentColumns.map(col => (
                          <th
                            key={`code-${col.id}`}
                            className="bg-white text-slate-900 font-mono text-xs border border-slate-400 py-1.5 px-3 text-left font-normal"
                          >
                            {col.code}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="text-xs text-slate-900 bg-white">
                      {filteredPlantRows.map((plantRow) => (
                        <tr key={plantRow.plant} className="hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 px-3 border border-slate-400 text-right font-mono tabular-nums text-slate-900">
                            {plantRow.sn}
                          </td>
                          <td
                            className="py-1.5 px-3 border border-slate-400 bg-[#ffff00] font-semibold text-slate-950"
                            title={`${plantRow.plantName} (${plantRow.facilityCount} mapped facilities)`}
                          >
                            {plantRow.plant}
                          </td>
                          {equipmentColumns.map(col => (
                            <td
                              key={`${plantRow.plant}-${col.id}`}
                              className="py-1.5 px-3 border border-slate-400 text-right font-mono tabular-nums text-slate-900"
                            >
                              {formatNumber(plantRow.quantities[col.id] || 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                        <td className="py-2 px-3 border border-slate-400 text-right font-mono">-</td>
                        <td className="py-2 px-3 border border-slate-400 bg-[#fef08a] font-black text-slate-950">
                          TOTAL ({filteredPlantRows.length} Plants)
                        </td>
                        {equipmentColumns.map(col => {
                          const total = filteredPlantRows.reduce((sum, r) => sum + (r.quantities[col.id] || 0), 0);
                          return (
                            <td
                              key={`tot-${col.id}`}
                              className="py-2 px-3 border border-slate-400 text-right font-mono font-black text-slate-950"
                            >
                              {formatNumber(total)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Optional Source Facilities Breakdown Drawer from 1.3.1 Map HF to Hub */}
              {showContributingFacilities && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Contributing Health Facilities from 1.3.1 Map HF to Hub ({allocations.length} Facilities)
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      Aggregated into {plantAggregatedRows.length} Plant rows above
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredPlantRows.map((pr) => (
                      <div key={`src-${pr.plant}`} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-[#ffff00] border border-amber-400 font-black text-xs text-slate-950">
                            {pr.plant} — {pr.plantName}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-600">
                            {pr.facilityCount} HFs • {formatNumber(pr.totalQty)} Units
                          </span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {pr.facilities.map((fac) => (
                            <div key={fac.id} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                              <div className="truncate mr-2">
                                <div className="font-semibold text-slate-900 truncate">{fac.healthFacility}</div>
                                <div className="text-[10px] text-slate-500">{fac.region} · {fac.zone}</div>
                              </div>
                              <span className="font-mono font-bold text-emerald-700 shrink-0">{fac.totalQty} units</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================================
          VIEW 2: ORDER PROCESS (SAP Stock Transport Order - STO)
          Columns: I (Auto U) | Material | Quantity | Plant | Stor.Location | PGr | SPlt | POrg
          ============================================================================ */}
      {viewTab === 'order-process' && (
        <div className="space-y-4">
          {/* SAP STO Context Callout */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-sm border border-blue-700/40 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base flex items-center gap-2">
                    EPSS SAP Stock Transport Order (STO) Process
                    <span className="text-[10px] font-mono font-bold bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30">
                      ME21N Format
                    </span>
                  </h3>
                  <p className="text-xs text-blue-200/90 mt-0.5">
                    Order lines summarized by <strong>Plant (Mapped HUB)</strong> and <strong>Material (Item Code)</strong> from the aggregated health facility breakdown.
                  </p>
                </div>
              </div>

              {/* SAP Rule Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                  <strong className="text-blue-300">I:</strong> U (Stock Transfer)
                </span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                  <strong className="text-blue-300">PGr:</strong> HP4
                </span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                  <strong className="text-blue-300">SPlt:</strong> HO01
                </span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                  <strong className="text-blue-300">POrg:</strong> HP02
                </span>
              </div>
            </div>
          </div>

          {/* Order Process Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Material code, Plant, Hub..."
                  value={orderProcessSearch}
                  onChange={(e) => setOrderProcessSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Plant Filter */}
              <select
                value={orderProcessPlantFilter}
                onChange={(e) => setOrderProcessPlantFilter(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="all">All Receiving Plants / Hubs ({hubSummaries.length})</option>
                {hubSummaries.map(({ hub, totalQuantity }) => (
                  <option key={hub.code} value={hub.code}>
                    {hub.code} - {hub.name} ({totalQuantity} units)
                  </option>
                ))}
              </select>

              <button
                onClick={() => setOrderProcessOverrides({})}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Reset any manual edits to summary quantities or storage locations"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-sync from Matrix</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {/* Copy for SAP GUI Button */}
              <button
                onClick={handleCopySapClipboard}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                title="Copy TSV table to clipboard ready to paste (Ctrl+V) directly into SAP ME21N"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for SAP GUI</span>
              </button>

              <button
                onClick={handleExportOrderProcessExcel}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Export formatted Excel file for SAP bulk import"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportOrderProcessCSV}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => setShowSapPreviewModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                title="View plain text table preview"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Preview</span>
              </button>
            </div>
          </div>

          {/* THE ORDER PROCESS TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">SAP Stock Transport Order Table</span>
                <span className="text-[11px] text-slate-500">• 8 Standard Columns Required</span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                Showing <strong>{filteredOrderProcessItems.length}</strong> Order Lines ({formatNumber(filteredOrderProcessItems.reduce((acc, i) => acc + i.quantity, 0))} Units)
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse select-text text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-slate-700 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-14 text-center bg-blue-900/60" title="Item Category: Stock Transfer (U)">
                      I
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 min-w-[150px]" title="Material: Code of item">
                      MATERIAL
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 min-w-[160px]">
                      DESCRIPTION
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-center w-24 bg-amber-900/40" title="Quantity: Summary total across all assigned facilities">
                      QUANTITY
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 min-w-[140px]" title="Plant: Mapped HUB (Receiving Plant)">
                      PLANT
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-24 text-center" title="Stor.Location: Storage Location (e.g. 0001)">
                      STOR.LOCATION
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-16 text-center" title="PGR: Purchasing Group (Auto HP4)">
                      PGR
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-16 text-center" title="SPLT: Supplying Plant (Auto HO01)">
                      SPLT
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-16 text-center" title="PORG: Purchasing Organization (Auto HP02)">
                      PORG
                    </th>
                    <th className="py-2.5 px-3 min-w-[150px] text-center">
                      SOURCE FACILITIES
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredOrderProcessItems.length > 0 ? (
                    filteredOrderProcessItems.map((item, idx) => {
                      const isExpanded = expandedOrderLineId === item.id;
                      const lineNum = (idx + 1) * 10;

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            {/* Line # */}
                            <td className="py-2.5 px-3 font-mono text-xs text-slate-400 text-center border-r border-slate-100">
                              {lineNum}
                            </td>

                            {/* 1. I (Item Category: Auto U) */}
                            <td className="py-2.5 px-2 text-center border-r border-slate-100 bg-blue-50/40">
                              <span className="inline-block px-2 py-0.5 rounded font-mono font-black text-xs bg-blue-600 text-white shadow-xs">
                                {item.itemCategory}
                              </span>
                            </td>

                            {/* 2. Material (Code of Item) */}
                            <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-slate-900">
                              {item.material}
                            </td>

                            {/* Description (Auxiliary helper) */}
                            <td className="py-2.5 px-3 border-r border-slate-100 text-slate-700 font-medium">
                              <div className="truncate max-w-xs" title={item.materialDescription}>
                                {item.materialDescription}
                              </div>
                            </td>

                            {/* 3. Quantity (Summary Quantity, Editable) */}
                            <td className="py-2 px-2 text-center border-r border-slate-100 bg-amber-50/40">
                              <input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setOrderProcessOverrides(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      quantity: val
                                    }
                                  }));
                                }}
                                className="w-16 text-center font-mono font-black text-xs text-amber-950 bg-white border-2 border-amber-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
                              />
                            </td>

                            {/* 4. Plant (Mapped HUB) */}
                            <td className="py-2.5 px-3 border-r border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-xs text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                  {item.plant}
                                </span>
                                <span className="font-semibold text-slate-800 text-xs truncate">
                                  {item.plantName}
                                </span>
                              </div>
                            </td>

                            {/* 5. Stor.Location (Default 0001, Editable) */}
                            <td className="py-2 px-2 text-center border-r border-slate-100">
                              <input
                                type="text"
                                value={item.storageLocation}
                                onChange={(e) => {
                                  setOrderProcessOverrides(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      storageLocation: e.target.value
                                    }
                                  }));
                                }}
                                className="w-16 text-center font-mono font-medium text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                              />
                            </td>

                            {/* 6. PGR (Auto HP4) */}
                            <td className="py-2.5 px-2 text-center border-r border-slate-100 font-mono font-bold text-slate-800 bg-slate-50">
                              {item.purchasingGroup}
                            </td>

                            {/* 7. SPLT (Auto HO01) */}
                            <td className="py-2.5 px-2 text-center border-r border-slate-100 font-mono font-bold text-emerald-700 bg-emerald-50/50">
                              {item.supplyingPlant}
                            </td>

                            {/* 8. PORG (Auto HP02) */}
                            <td className="py-2.5 px-2 text-center border-r border-slate-100 font-mono font-bold text-purple-700 bg-purple-50/50">
                              {item.purchasingOrg}
                            </td>

                            {/* Source Facilities Breakdown Button */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => setExpandedOrderLineId(isExpanded ? null : item.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{item.contributingFacilities.length} Facilities</span>
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>

                          {/* Accordion Drawer showing source facilities */}
                          {isExpanded && (
                            <tr className="bg-blue-50/30 border-b border-blue-100 animate-fadeIn">
                              <td colSpan={11} className="p-3 pl-12">
                                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-blue-200 text-xs">
                                  <div className="font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span>
                                      Contributing Facilities for <strong>{item.materialDescription}</strong> ({item.material}) | Plant <strong>{item.plant}</strong> ({item.plantName}):
                                    </span>
                                    <span className="font-mono text-blue-700 font-black">
                                      Sum = {item.quantity} Units
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                    {item.contributingFacilities.map((fac, fidx) => (
                                      <div key={fidx} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                          <div className="font-semibold text-slate-900 truncate">{fac.facilityName}</div>
                                          <div className="text-[10px] text-slate-500">{fac.region} · {fac.woreda}</div>
                                        </div>
                                        <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs flex-shrink-0">
                                          {fac.qty} units
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-slate-600 text-sm">No order lines match filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Footer with totals */}
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700 text-xs">
                    <td className="py-3 px-3 text-center" colSpan={4}>
                      ORDER PROCESS TOTAL ({filteredOrderProcessItems.length} STO Lines)
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-black text-amber-300 bg-slate-950 text-sm">
                      {filteredOrderProcessItems.reduce((acc, i) => acc + i.quantity, 0)}
                    </td>
                    <td className="py-3 px-3 font-mono text-purple-300" colSpan={6}>
                      Auto SAP Parameters: I=U · Stor.Loc=0001 · PGr=HP4 · SPlt=HO01 · POrg=HP02
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          VIEW 3: BY EPSS DISTRIBUTION HUB
          ============================================================================ */}
      {viewTab === 'hub-summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubSummaries.map(({ hub, facilities, totalQuantity, quantitiesByItem }) => (
              <div
                key={hub.code}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border border-amber-200">
                      {hub.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{hub.name}</h4>
                      <p className="text-[11px] text-slate-500">{hub.region} Region</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {totalQuantity} Units
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] space-y-1 text-slate-600 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Hub Manager:</span>
                    <span className="font-semibold text-slate-800">{hub.manager}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-mono text-slate-800">{hub.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Facilities Mapped:</span>
                    <span className="font-bold text-emerald-700">{facilities.length} Health Facilities</span>
                  </div>
                </div>

                {/* Facilities List inside this Hub */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Assigned Facilities ({facilities.length})
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                    {facilities.map(fac => (
                      <div
                        key={fac.id}
                        className="bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs transition"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-slate-900 truncate">{fac.healthFacility}</div>
                          <div className="text-[10px] text-slate-500">{fac.region} · {fac.zone}</div>
                        </div>
                        <span className="font-bold text-amber-800 text-xs flex-shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {fac.totalQty} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Equipment quantities summary */}
                <div className="border-t border-slate-100 pt-2 flex flex-wrap gap-1">
                  {equipmentColumns.map(col => {
                    const q = quantitiesByItem[col.id] || 0;
                    if (q === 0) return null;
                    return (
                      <span key={col.id} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                        {col.name.slice(0, 15)}: <strong className="text-slate-900">{q}</strong>
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenBranchDispatch({ hub, facilities, totalQuantity, quantitiesByItem }, 'email')}
                    className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-indigo-200"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Branch</span>
                  </button>
                  <button
                    onClick={() => handleOpenBranchDispatch({ hub, facilities, totalQuantity, quantitiesByItem }, 'whatsapp')}
                    className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-emerald-200"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================================
          VIEW 4: CATCHMENT & ROUTING FLOW
          ============================================================================ */}
      {viewTab === 'catchment-flow' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="max-w-3xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <span>EPSS National Supply Chain Catchment & Logistics Routing</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hierarchical flow: EPSS Head Office aggregates and maps each facility to its designated EPSS branch hub for transport packing and release order dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EPSS_HUBS_REGISTRY.map(hub => {
              const matchedSummary = hubSummaries.find(h => h.hub.code === hub.code);
              const isActive = !!matchedSummary;

              return (
                <div
                  key={hub.code}
                  className={`rounded-2xl p-4 border transition-all ${
                    isActive
                      ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/10'
                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {hub.code}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5">{hub.name}</h4>
                      <p className="text-[11px] text-slate-500">{hub.region}</p>
                    </div>
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                        {matchedSummary.facilities.length} HFs Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                        Standby
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-[11px] text-slate-600 space-y-1">
                    <div><strong>Manager:</strong> {hub.manager}</div>
                    <div><strong>Phone:</strong> {hub.phone}</div>
                    <div><strong>Address:</strong> {hub.address}</div>
                  </div>

                  {hub.catchmentZones && hub.catchmentZones.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Catchment Zones:</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {hub.catchmentZones.map(cz => (
                          <span key={cz} className="text-[10px] bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {cz}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isActive && (
                    <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                      <span>Total Allocated:</span>
                      <span>{matchedSummary.totalQuantity} units</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: ADD HEALTH FACILITY ROW */}
      {isAddFacilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Add Facility Allocation Row</h3>
              </div>
              <button
                onClick={() => setIsAddFacilityModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Region</label>
                <select
                  value={newFacilityForm.region}
                  onChange={(e) => setNewFacilityForm({ ...newFacilityForm, region: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  {['Oromia', 'Amhara', 'Sidama', 'Tigray', 'Somali', 'Addis Ababa', 'Afar', 'South Ethiopia', 'Dire Dawa', 'Harari', 'Benishangul-Gumuz', 'Gambella'].map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Zone</label>
                  <input
                    type="text"
                    placeholder="e.g. East Shewa"
                    value={newFacilityForm.zone}
                    onChange={(e) => setNewFacilityForm({ ...newFacilityForm, zone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Woreda</label>
                  <input
                    type="text"
                    placeholder="e.g. Adama Woreda"
                    value={newFacilityForm.woreda}
                    onChange={(e) => setNewFacilityForm({ ...newFacilityForm, woreda: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Name of Health Facility *</label>
                <input
                  type="text"
                  placeholder="e.g. Adama General Hospital"
                  value={newFacilityForm.healthFacility}
                  onChange={(e) => setNewFacilityForm({ ...newFacilityForm, healthFacility: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">List of Packages</label>
                  <input
                    type="text"
                    value={newFacilityForm.packages}
                    onChange={(e) => setNewFacilityForm({ ...newFacilityForm, packages: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Qty per Device</label>
                  <input
                    type="number"
                    min={1}
                    value={newFacilityForm.defaultQty}
                    onChange={(e) => setNewFacilityForm({ ...newFacilityForm, defaultQty: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                Upon adding, the facility will automatically be matched to its designated EPSS Hub using the HF Master dataset.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAddFacilityModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFacilityRow}
                disabled={!newFacilityForm.healthFacility.trim()}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Add & Auto-Map Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAP TSV PREVIEW & COPY MODAL */}
      {showSapPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">SAP STO Clipboard Preview (ME21N)</h3>
              </div>
              <button
                onClick={() => setShowSapPreviewModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              This formatted text contains all 8 required SAP STO columns separated by tabs. You can copy and paste directly into SAP GUI ME21N:
            </p>

            <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto max-h-72 border border-slate-700">
              <pre className="whitespace-pre">
                {['I', 'Material', 'Quantity', 'Plant', 'Stor.Location', 'PGr', 'SPlt', 'POrg'].join('\t') + '\n'}
                {filteredOrderProcessItems.map(item => [
                  item.itemCategory,
                  item.material,
                  item.quantity,
                  item.plant,
                  item.storageLocation,
                  item.purchasingGroup,
                  item.supplyingPlant,
                  item.purchasingOrg
                ].join('\t')).join('\n')}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-mono">
                {filteredOrderProcessItems.length} lines ready for SAP
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSapPreviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleCopySapClipboard}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy TSV to Clipboard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          VIEW 5: BRANCH DISPATCH (EMAIL & WHATSAPP)
          ============================================================================ */}
      {viewTab === 'branch-dispatch' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <Send className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">EPSS Branch Dispatch & Communication Center</h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Send consolidated and mapped health facility allocation data from EPSS Head Office to regional branch hubs via Email and WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-white/10 border border-white/20 text-xs font-mono">
                {hubSummaries.length} Active Branch Hubs
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubSummaries.map(({ hub, facilities, totalQuantity, quantitiesByItem }) => (
              <div key={hub.code} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      Plant: {hub.code}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1.5">{hub.name}</h4>
                    <p className="text-[11px] text-slate-500">Manager: {hub.manager} ({hub.phone})</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-slate-900 text-emerald-400">
                    {totalQuantity} Units
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <div><strong>Assigned Facilities:</strong> {facilities.length} Health Centers/Hospitals</div>
                  <div><strong>Region Catchment:</strong> {hub.region}</div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenBranchDispatch({ hub, facilities, totalQuantity, quantitiesByItem }, 'email')}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Branch</span>
                  </button>
                  <button
                    onClick={() => handleOpenBranchDispatch({ hub, facilities, totalQuantity, quantitiesByItem }, 'whatsapp')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: BRANCH DISPATCH (EMAIL / WHATSAPP) */}
      {dispatchHubModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${dispatchChannel === 'email' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                  {dispatchChannel === 'email' ? <Mail className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {dispatchChannel === 'email' ? 'Send Mapped Data via Email' : 'Send Mapped Data via WhatsApp'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    EPSS Hub: <strong className="text-slate-800">{dispatchHubModal.hubName} ({dispatchHubModal.hubCode})</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchHubModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  {dispatchChannel === 'email' ? 'Recipient Branch Email' : 'Recipient WhatsApp Phone'}
                </label>
                <input
                  type="text"
                  defaultValue={dispatchChannel === 'email' ? dispatchHubModal.email : dispatchHubModal.phone}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Formatted Dispatch Message & Summary
                  </label>
                  <button
                    onClick={() => {
                      const text = `EPSS HO MAPPED DATA DISPATCH\nHub: ${dispatchHubModal.hubName} (${dispatchHubModal.hubCode})\nManager: ${dispatchHubModal.manager}\nTotal Assigned Units: ${dispatchHubModal.totalQuantity}\nFacilities: ${dispatchHubModal.facilities.length}\n\nFacilities List:\n` +
                        dispatchHubModal.facilities.map(f => `- ${f.healthFacility} (${f.region}): ${f.totalQty} units`).join('\n');
                      navigator.clipboard.writeText(text);
                      setDispatchCopied(true);
                      setTimeout(() => setDispatchCopied(false), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{dispatchCopied ? 'Copied!' : 'Copy Summary'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={`EPSS HEAD OFFICE - MAPPED DATA DISPATCH\n----------------------------------------\nTo: ${dispatchHubModal.hubName} Hub Management (${dispatchHubModal.manager})\nPlant Code: ${dispatchHubModal.hubCode}\n\nWe have completed the National DSP Aggregation and mapped ${dispatchHubModal.facilities.length} health facilities in your catchment region with a total allocation of ${dispatchHubModal.totalQuantity} units.\n\nAssigned Facilities Breakdown:\n` +
                    dispatchHubModal.facilities.map(f => `• ${f.healthFacility} (${f.region}, ${f.zone}): ${f.totalQty} units`).join('\n') +
                    `\nPlease prepare your branch warehouse for receiving and dispatching according to the SAP STO transfer orders.\n\nEPSS Medical Equipment Directorate`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none resize-none shadow-inner leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDispatchHubModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dispatchChannel === 'email') {
                    const subject = `EPSS Mapped Data Dispatch - ${dispatchHubModal.hubName} (${dispatchHubModal.hubCode})`;
                    const body = `Dear ${dispatchHubModal.manager},\n\nPlease find attached the aggregated and mapped health facility allocations for ${dispatchHubModal.hubName} (${dispatchHubModal.totalQuantity} total units across ${dispatchHubModal.facilities.length} facilities).\n\nEPSS HO`;
                    window.open(`mailto:${dispatchHubModal.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                  } else {
                    const text = `EPSS Mapped Data Dispatch for ${dispatchHubModal.hubName} (${dispatchHubModal.hubCode}): ${dispatchHubModal.totalQuantity} Units across ${dispatchHubModal.facilities.length} facilities. Please check SAP STO.`;
                    window.open(`https://wa.me/${dispatchHubModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                  }
                  setNotification({
                    type: 'success',
                    message: `Dispatched mapped data for ${dispatchHubModal.hubName} via ${dispatchChannel === 'email' ? 'Email' : 'WhatsApp'} successfully!`
                  });
                  setDispatchHubModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md ${dispatchChannel === 'email' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{dispatchChannel === 'email' ? 'Launch Email Client' : 'Open WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
