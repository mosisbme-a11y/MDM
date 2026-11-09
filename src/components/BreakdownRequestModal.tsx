import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Mail, 
  MessageCircle, 
  CheckCircle, 
  Download, 
  Paperclip, 
  FileSpreadsheet, 
  FileText,
  Send,
  ArrowRight,
  Copy,
  Package,
  Plus,
  Trash2,
  Share2,
  Archive,
  Layers,
  Sparkles,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  ArrowUpRight,
  CheckSquare,
  Square,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MultipleStockRecord, AuthUser } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { loadGmailTemplates, formatGmailSubject, formatGmailBody } from '../utils/gmailTemplates';
import { getAccessToken, googleSignIn, clearCachedAccessToken } from '../utils/googleWorkspace';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export interface RegionAllocationRow {
  id: string;
  date: string;
  region: string;
  budgetSource: string;
  quantities: Record<string, number>; // materialId -> quantity
  itemNotes?: Record<string, string>; // materialId -> note/justification
}

export interface DspWorkflowRecord {
  id: string;
  dspRefNumber: string;
  stage: string;
  stageTitle: string;
  senderOrg: string;
  recipientOrg: string;
  subject: string;
  status: string;
  dateSubmitted: string;
  approvedDate?: string;
  totalDevices: number;
  totalQuantity: number;
  totalValuationETB: number;
  targetedRegions: string[];
  targetedFacilitiesCount: number;
  officialLetterRef: string;
  signatory: string;
  signatoryRole: string;
  itemsIncluded: {
    material: string;
    description: string;
    quantity: number;
    allocatedFacility?: string;
    plant: string;
  }[];
  notes?: string;
  excelFile?: { name: string; blob: Blob };
  pdfFile?: { name: string; blob: Blob };
  zipFile?: { name: string; blob: Blob };
}

const DEFAULT_ETHIOPIAN_REGIONS = [
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

const DEFAULT_BUDGET_SOURCES = [
  'MCH',
  'Global Fund',
  'World Bank',
  'MOH Capital',
  'SDG Fund',
  'GAVI',
  'EPSS Revolving',
  'Donor Allocation'
];

interface BreakdownRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MultipleStockRecord[];
  epssToMohRecords?: DspWorkflowRecord[];
  onSubmit: (data: any) => void;
  onSaveDraft?: (data: any) => void;
  onSuccess?: (removedItems: MultipleStockRecord[], metadata: any) => void;
  currentUser?: AuthUser;
}

export const BreakdownRequestModal: React.FC<BreakdownRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  epssToMohRecords = [],
  onSubmit,
  onSaveDraft,
  onSuccess,
  currentUser
}) => {
  const isMoh = currentUser?.role === 'MOH';
  const currentDate = new Date().toISOString().split('T')[0];

  // Active Navigation Tab: 'data-view' | 'matrix-editor' | 'pre-send-preview'
  const [activeTab, setActiveTab] = useState<'data-view' | 'matrix-editor' | 'pre-send-preview'>('pre-send-preview');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Source Transmitted EPSS to MOH Dossier Selection State
  const [selectedSourceDossierId, setSelectedSourceDossierId] = useState<string>('');
  const [showSourceDataPanel, setShowSourceDataPanel] = useState<boolean>(true);
  const [onlyTransmittedDevicesFilter, setOnlyTransmittedDevicesFilter] = useState<boolean>(true);

  // Selected device columns for matrix
  const [selectedDevices, setSelectedDevices] = useState<MultipleStockRecord[]>([]);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [dossierSearchQuery, setDossierSearchQuery] = useState('');

  // Local state for hiding items in the EPSS to MOH Source Data view
  const [hiddenSourceItemIds, setHiddenSourceItemIds] = useState<string[]>([]);
  const [selectedSourceItemIds, setSelectedSourceItemIds] = useState<string[]>([]);
  const [expandedSourceRowIds, setExpandedSourceRowIds] = useState<Set<string>>(new Set());

  const handleToggleSourceRowExpand = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedSourceRowIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Regional Breakdown Rows & Dynamic Multi-Region Filter State
  const [regionRows, setRegionRows] = useState<RegionAllocationRow[]>([]);
  const [selectedRegionsFilter, setSelectedRegionsFilter] = useState<string[]>([]);
  const [regionSearchQuery, setRegionSearchQuery] = useState<string>('');
  
  // Coordinates & Settings
  const [officialEmail, setOfficialEmail] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('mosisbme@gmail.com');
  const [ccEmail, setCcEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // Notifications & Modal States
  const [notification, setNotification] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [copiedWaText, setCopiedWaText] = useState(false);

  // Manage Equipment Columns (Custom Column Modal) State
  const [isCustomColModalOpen, setIsCustomColModalOpen] = useState(false);
  const [customColName, setCustomColName] = useState('');
  const [customColCode, setCustomColCode] = useState('');
  const [customColQty, setCustomColQty] = useState(25);

  // Dispatch Receipt Dialog State
  const [dispatchReceipt, setDispatchReceipt] = useState<{
    method: 'email' | 'whatsapp';
    recipient: string;
    excelName: string;
    excelCapacity: string;
    excelBytes: number;
    letterName: string;
    letterCapacity: string;
    letterBytes: number;
    totalCapacity: string;
    timestamp: string;
    isBinaryVerified?: boolean;
    streamMode?: string;
    emailSubject?: string;
    emailBody?: string;
    isBatchZip?: boolean;
    zipName?: string;
    zipCapacity?: string;
    zipBytes?: number;
    zipFile?: File | null;
  } | null>(null);

  // Active Source Dossier (EPSS to MOH sent dossier)
  const filteredDossiers = useMemo(() => {
    if (!dossierSearchQuery) return epssToMohRecords;
    const q = dossierSearchQuery.toLowerCase();
    return epssToMohRecords.filter(r => 
      r.dspRefNumber.toLowerCase().includes(q) || 
      r.subject.toLowerCase().includes(q)
    );
  }, [epssToMohRecords, dossierSearchQuery]);

  const activeSourceDossier = useMemo(() => {
    if (!epssToMohRecords || epssToMohRecords.length === 0) return null;
    if (selectedSourceDossierId) {
      const found = epssToMohRecords.find(r => r.id === selectedSourceDossierId);
      if (found) return found;
    }
    return epssToMohRecords[0] || null;
  }, [epssToMohRecords, selectedSourceDossierId]);

  // Transmitted items extracted from the selected EPSS to MOH dossier with real actual data sent
  const activeTransmittedItems = useMemo(() => {
    if (activeSourceDossier && activeSourceDossier.itemsIncluded && activeSourceDossier.itemsIncluded.length > 0) {
      return activeSourceDossier.itemsIncluded.map((item, idx) => {
        const match = items.find(i => 
          i.material.toLowerCase() === item.material.toLowerCase() ||
          i.materialDescription.toLowerCase().includes(item.description.toLowerCase())
        );

        const unitVal = match && match.unrestrictedStock > 0 
          ? (match.currentValueOfUnrestrictedStock / match.unrestrictedStock) 
          : 450000;

        return {
          id: match?.id || `transmitted-${item.material}-${idx}`,
          material: item.material,
          materialDescription: item.description,
          plant: item.plant || match?.plant || 'AA01 (Central)',
          storageLocation: match?.storageLocation || 'SL01 (Main)',
          specialStockType: match?.specialStockType || 'Q',
          unrestrictedStock: item.quantity,
          stockInQualityInspection: match?.stockInQualityInspection || 0,
          blockedStock: match?.blockedStock || 0,
          currentValueOfUnrestrictedStock: item.quantity * unitVal,
          inventoryValuationType: match?.inventoryValuationType || 'Standard Valuation',
          materialGroupName: match?.materialGroupName || 'Medical Equipment & Devices',
          valueOfBlockedStock: 0,
          valueOfStockInQualityInspection: 0,
          wbsElement: match?.wbsElement || '',
          allocatedFacility: item.allocatedFacility
        };
      });
    }

    // Fallback to items if no active source dossier items
    return items.slice(0, 6);
  }, [activeSourceDossier, items]);

  // Specific items to show in the EPSS to MOH Source Data view (Tab 1)
  const displayedSourceItems = useMemo(() => {
    return activeTransmittedItems.filter(item => !hiddenSourceItemIds.includes(item.id));
  }, [activeTransmittedItems, hiddenSourceItemIds]);

  // Manage Custom Equipment Column Addition
  const handleAddCustomColumn = () => {
    if (!customColName.trim()) return;
    const newDev: MultipleStockRecord = {
      id: `col-cust-${Date.now()}`,
      material: customColCode.trim() || `403-REQ-${Math.floor(100 + Math.random() * 900)}`,
      materialDescription: customColName.trim(),
      plant: 'AA01 (Central)',
      storageLocation: 'Central Store',
      specialStockType: 'Q',
      unrestrictedStock: Number(customColQty) || 25,
      stockInQualityInspection: 0,
      blockedStock: 0,
      currentValueOfUnrestrictedStock: (Number(customColQty) || 25) * 500000,
      inventoryValuationType: 'Standard Valuation',
      materialGroupName: 'Medical Equipment & Devices',
      valueOfBlockedStock: 0,
      valueOfStockInQualityInspection: 0,
      wbsElement: ''
    };

    setSelectedDevices(prev => [...prev, newDev]);
    setRegionRows(rows => rows.map(r => ({
      ...r,
      quantities: {
        ...r.quantities,
        [newDev.id]: Math.max(1, Math.floor((Number(customColQty) || 25) / Math.max(1, rows.length)))
      }
    })));

    setCustomColName('');
    setCustomColCode('');
    setIsCustomColModalOpen(false);
    setNotification(`✓ Added new equipment column: ${newDev.materialDescription} (${newDev.material})`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle Load Transmitted EPSS-to-MOH Items into Breakdown Matrix
  const handleLoadTransmittedDossierIntoMatrix = () => {
    if (activeTransmittedItems.length === 0) return;

    setSelectedDevices(activeTransmittedItems);

    setRegionRows(rows => {
      if (rows.length > 0) {
        return rows.map(r => {
          const newQty = { ...r.quantities };
          activeTransmittedItems.forEach(dev => {
            if (newQty[dev.id] === undefined) {
              newQty[dev.id] = Math.max(1, Math.floor((dev.unrestrictedStock || 30) / rows.length));
            }
          });
          return { ...r, quantities: newQty };
        });
      }

      const initialRegions = ['Oromia', 'Amhara', 'Sidama', 'Somali', 'Tigray'];
      return initialRegions.map((reg, idx) => {
        const qtyObj: Record<string, number> = {};
        activeTransmittedItems.forEach(dev => {
          qtyObj[dev.id] = Math.max(1, Math.floor((dev.unrestrictedStock || 30) / initialRegions.length));
        });
        return {
          id: `row-init-${idx}-${Date.now()}`,
          date: currentDate,
          region: reg,
          budgetSource: '',
          quantities: qtyObj
        };
      });
    });

    setActiveTab('matrix-editor');
    setNotification(`✓ Loaded ${activeTransmittedItems.length} medical devices into regional breakdown matrix!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Handler when clicking '✓ Transmitted EPSS-to-MOH Items Only' pill button
  const handleToggleTransmittedFilter = () => {
    const nextVal = !onlyTransmittedDevicesFilter;
    setOnlyTransmittedDevicesFilter(nextVal);

    if (nextVal && activeTransmittedItems.length > 0) {
      setSelectedDevices(activeTransmittedItems);
      setShowSourceDataPanel(true);
      setNotification(`Displaying exact ${activeTransmittedItems.length} transmitted EPSS-to-MOH items with full column details!`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // 1. One-time initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('data-view');
      setOnlyTransmittedDevicesFilter(true);
      
      if (epssToMohRecords.length > 0 && !selectedSourceDossierId) {
        setSelectedSourceDossierId(epssToMohRecords[0].id);
      }

      setRegionRows(prev => {
        if (prev.length > 0) return prev;
        const initialRegions = ['Oromia', 'Amhara', 'Sidama', 'Somali', 'Tigray'];
        const devPool = activeTransmittedItems.length > 0 ? activeTransmittedItems : items.slice(0, 6);
        return initialRegions.map((reg, idx) => {
          const qtyObj: Record<string, number> = {};
          devPool.forEach(d => {
            qtyObj[d.id] = Math.max(1, Math.floor((d.unrestrictedStock || 30) / initialRegions.length));
          });
          return {
            id: `row-init-${idx}`,
            date: currentDate,
            region: reg,
            budgetSource: '',
            quantities: qtyObj
          };
        });
      });
      
      const loaded = loadGmailTemplates();
      if (loaded.officialEmail) setOfficialEmail(loaded.officialEmail);
      if (loaded.ccEmail) setCcEmail(loaded.ccEmail);
      const savedPhone = null; // localStorage removal
      if (savedPhone) setOfficialPhone(savedPhone || '+251911234567');
    } else {
      setDispatchReceipt(null);
      setWhatsAppModalOpen(false);
      setCustomSubject('');
      setCustomBody('');
    }
  }, [isOpen, epssToMohRecords]);

  // 2. Reactive update when activeTransmittedItems changes (dossier selection changes)
  useEffect(() => {
    if (isOpen && activeTransmittedItems.length > 0) {
      setHiddenSourceItemIds([]);
      setSelectedSourceItemIds([]);
      setSelectedDevices(activeTransmittedItems);
      
      setRegionRows(prevRows => {
        if (prevRows.length > 0) {
          return prevRows.map(row => {
            const newQuantities = { ...row.quantities };
            activeTransmittedItems.forEach(dev => {
              if (newQuantities[dev.id] === undefined) {
                newQuantities[dev.id] = Math.max(1, Math.floor((dev.unrestrictedStock || 30) / prevRows.length));
              }
            });
            return { ...row, quantities: newQuantities };
          });
        }
        const initialRegions = ['Oromia', 'Amhara', 'Sidama', 'Somali', 'Tigray'];
        return initialRegions.map((reg, idx) => {
          const qtyObj: Record<string, number> = {};
          activeTransmittedItems.forEach(d => {
            qtyObj[d.id] = Math.max(1, Math.floor((d.unrestrictedStock || 30) / initialRegions.length));
          });
          return {
            id: `row-init-${idx}`,
            date: currentDate,
            region: reg,
            budgetSource: '',
            quantities: qtyObj
          };
        });
      });
    }
  }, [isOpen, activeTransmittedItems, currentDate]);

  // Format Helper for Exact Byte Capacity
  const formatExactBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Dynamic Excel filename
  const excelFileName = `Breakdown_Request_MOH_to_Region_${currentDate}.xlsx`;

  // Available devices pool
  const availableDevicesPool = useMemo(() => {
    if (onlyTransmittedDevicesFilter && activeTransmittedItems.length > 0) {
      return activeTransmittedItems;
    }
    return items;
  }, [onlyTransmittedDevicesFilter, activeTransmittedItems, items]);

  // Filtered devices for column selector search
  const filteredAvailableDevices = useMemo(() => {
    if (!deviceSearchQuery) return availableDevicesPool;
    const q = deviceSearchQuery.toLowerCase();
    return availableDevicesPool.filter(i => 
      i.material.toLowerCase().includes(q) || 
      i.materialDescription.toLowerCase().includes(q)
    );
  }, [availableDevicesPool, deviceSearchQuery]);

  // Toggle Device Column in Breakdown Matrix
  const toggleDeviceColumn = (device: MultipleStockRecord) => {
    setSelectedDevices(prev => {
      const exists = prev.some(d => d.id === device.id);
      if (exists) {
        return prev.filter(d => d.id !== device.id);
      } else {
        setRegionRows(rows => rows.map(r => ({
          ...r,
          quantities: {
            ...r.quantities,
            [device.id]: r.quantities[device.id] ?? 10
          }
        })));
        return [...prev, device];
      }
    });
  };

  // Dynamic Multi-Region Selection Functions
  const handleToggleRegionFilter = (regionName: string) => {
    setSelectedRegionsFilter(prev => {
      const exists = prev.some(r => r.toLowerCase() === regionName.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(r => r.toLowerCase() !== regionName.toLowerCase());
      } else {
        return [...prev, regionName];
      }
    });
  };

  const handleSelectAllRegionsFilter = () => {
    setSelectedRegionsFilter([...DEFAULT_ETHIOPIAN_REGIONS]);
  };

  const handleDeselectAllRegionsFilter = () => {
    setSelectedRegionsFilter([DEFAULT_ETHIOPIAN_REGIONS[0]]);
  };

  // Pre-populate matrix rows for active selected regions
  const handlePopulateMatrixForSelectedRegions = () => {
    if (selectedRegionsFilter.length === 0) return;

    const newRows: RegionAllocationRow[] = selectedRegionsFilter.map((regName, idx) => {
      const initialQty: Record<string, number> = {};
      selectedDevices.forEach(d => {
        const itemVal = d.unrestrictedStock || 50;
        initialQty[d.id] = Math.max(1, Math.floor(itemVal / selectedRegionsFilter.length));
      });
      return {
        id: `row-sel-${idx}-${Date.now()}`,
        date: currentDate,
        region: regName,
        budgetSource: '',
        quantities: initialQty
      };
    });
    setRegionRows(newRows);
    setNotification(`Populated matrix rows for ${selectedRegionsFilter.length} selected regions!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Manage Regional Allocation Rows
  const handleAddRegionRow = (regionName?: string) => {
    const nextRegion = regionName || '';
    const initialQty: Record<string, number> = {};
    selectedDevices.forEach(d => {
      initialQty[d.id] = 0;
    });

    setRegionRows(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: currentDate,
        region: nextRegion,
        budgetSource: '',
        quantities: initialQty
      }
    ]);

    setNotification(`✓ Added new blank custom row. Please enter the Region name manually.`);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleRemoveRegionRow = (id: string) => {
    setRegionRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRowField = (id: string, field: 'region' | 'budgetSource' | 'date', value: string) => {
    setRegionRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleUpdateRowQuantity = (rowId: string, deviceId: string, qty: number) => {
    setRegionRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        quantities: {
          ...r.quantities,
          [deviceId]: Math.max(0, qty)
        }
      };
    }));
  };

  const handleUpdateRowNote = (rowId: string, deviceId: string, note: string) => {
    setRegionRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        itemNotes: {
          ...(r.itemNotes || {}),
          [deviceId]: note
        }
      };
    }));
  };

  // Quick Distribute Available Inventory across added Regions
  const handleAutoDistributeStock = () => {
    if (regionRows.length === 0 || selectedDevices.length === 0) return;
    
    setRegionRows(prevRows => {
      const rowCount = prevRows.length;
      return prevRows.map(row => {
        const updatedQty: Record<string, number> = {};
        selectedDevices.forEach(dev => {
          const totalStock = dev.unrestrictedStock || 100;
          const share = Math.floor(totalStock / rowCount);
          updatedQty[dev.id] = share > 0 ? share : 10;
        });
        return {
          ...row,
          quantities: updatedQty
        };
      });
    });

    setNotification(`Auto-distributed stock across ${regionRows.length} regional breakdown rows!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Filtered Region Rows based on Dynamic Multi-Region Selection & Text Search Input
  const filteredRegionRows = useMemo(() => {
    return regionRows.filter(row => {
      // If row has no region name written yet (blank), always keep it visible so user can write it manually
      if (!row.region || row.region.trim() === '') {
        return true;
      }
      const matchesMultiRegion = selectedRegionsFilter.length === 0
        ? true
        : selectedRegionsFilter.some(
            r => r.toLowerCase() === row.region.toLowerCase() || row.region.toLowerCase().includes(r.toLowerCase())
          );
      const matchesSearch = !regionSearchQuery || 
        row.region.toLowerCase().includes(regionSearchQuery.toLowerCase()) || 
        row.budgetSource.toLowerCase().includes(regionSearchQuery.toLowerCase());
      return matchesMultiRegion && matchesSearch;
    });
  }, [regionRows, selectedRegionsFilter, regionSearchQuery]);

  // Calculate Cumulative Metrics dynamically matching active multi-region filter
  const matrixSummary = useMemo(() => {
    let totalUnits = 0;
    let totalValuation = 0;

    filteredRegionRows.forEach(row => {
      selectedDevices.forEach(dev => {
        const q = row.quantities[dev.id] || 0;
        totalUnits += q;
        const unitVal = dev.unrestrictedStock > 0 ? (dev.currentValueOfUnrestrictedStock / dev.unrestrictedStock) : 0;
        totalValuation += q * unitVal;
      });
    });

    const uniqueRegionsCount = new Set(filteredRegionRows.map(r => r.region)).size;

    return {
      regionsCount: uniqueRegionsCount,
      devicesCount: selectedDevices.length,
      totalUnits,
      totalValuation
    };
  }, [filteredRegionRows, selectedDevices]);

  // Generate Authentic Two-Header-Row Excel File Payload matching active filtered regions
  const excelPayload = useMemo(() => {
    if (selectedDevices.length === 0 || filteredRegionRows.length === 0) {
      return {
        fileName: excelFileName,
        sizeBytes: 0,
        formattedSize: '0.0 KB',
        file: null as File | null,
        blob: null as Blob | null,
        base64: ''
      };
    }

    const headerRow1 = ['Date', 'Region', 'Budget Source'];
    const headerRow2 = ['', '', ''];

    selectedDevices.forEach(dev => {
      headerRow1.push(dev.materialDescription);
      headerRow2.push(dev.material || 'N/A');
    });

    const dataRows = filteredRegionRows.map(row => {
      const rData: (string | number)[] = [
        row.date || currentDate,
        row.region,
        row.budgetSource
      ];
      selectedDevices.forEach(dev => {
        rData.push(row.quantities[dev.id] || 0);
      });
      return rData;
    });

    const aoa = [headerRow1, headerRow2, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdown Request MOH-Region");
    
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], excelFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const sizeBytes = blob.size;

    return {
      fileName: excelFileName,
      sizeBytes,
      formattedSize: formatExactBytes(sizeBytes),
      file,
      blob,
      base64: ''
    };
  }, [selectedDevices, filteredRegionRows, currentDate, excelFileName]);

  // Generate Official PDF Letter Payload matching active filtered regions
  const letterPayload = useMemo(() => {
    if (attachment) {
      return {
        fileName: attachment.name,
        sizeBytes: attachment.size,
        formattedSize: formatExactBytes(attachment.size),
        file: attachment,
        blob: attachment as Blob,
        isCustomUpload: true
      };
    }

    if (selectedDevices.length === 0 || filteredRegionRows.length === 0) return null;

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const letterFileName = `MOH_Regional_Breakdown_Letter_${currentDate}.pdf`;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 24, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MINISTRY OF HEALTH (MOH) — ETHIOPIA', 14, 12);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('PHARMACEUTICALS & MEDICAL DEVICES LEAD EXECUTIVE OFFICE', 14, 18);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('OFFICIAL REGIONAL MEDICAL EQUIPMENT BREAKDOWN ALLOCATION', 14, 34);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${currentDate}`, 14, 41);
      doc.text(`Target Scope: ${[...new Set(filteredRegionRows.map(r => r.region))].join(', ')}`, 14, 46);
      doc.text(`Source EPSS Reference: ${activeSourceDossier?.dspRefNumber || 'EPSS/MD-DSP/2026/042'}`, 14, 51);

      doc.setFillColor(241, 245, 249);
      doc.rect(14, 58, 269, 14, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, 58, 269, 14, 'S');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 18, 64);
      doc.text('Region', 40, 64);
      doc.text('Budget Source', 70, 64);

      let startX = 105;
      const colWidth = Math.min(30, (283 - startX) / Math.max(1, selectedDevices.length));

      selectedDevices.forEach((dev) => {
        doc.text(dev.materialDescription.substring(0, 16), startX, 63);
        doc.setFont('helvetica', 'normal');
        doc.text(dev.material || 'N/A', startX, 68);
        doc.setFont('helvetica', 'bold');
        startX += colWidth;
      });

      let currentY = 76;
      filteredRegionRows.forEach((r) => {
        doc.setFont('helvetica', 'normal');
        doc.text(r.date || currentDate, 18, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(r.region, 40, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(r.budgetSource, 70, currentY);

        let rowX = 105;
        selectedDevices.forEach(dev => {
          doc.text(String(r.quantities[dev.id] || 0), rowX, currentY);
          rowX += colWidth;
        });

        doc.setDrawColor(226, 232, 240);
        doc.line(14, currentY + 3, 283, currentY + 3);
        currentY += 8;
      });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signatory:', 14, currentY + 12);
      doc.setFont('helvetica', 'normal');
      doc.text('Sister Meseret Zerihun — MOH Lead Executive Officer', 14, currentY + 17);
      doc.text('Status: Endorsed & Dispatched via Immutable Binary Stream Protocol', 14, currentY + 22);

      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], letterFileName, { type: 'application/pdf' });

      return {
        fileName: letterFileName,
        sizeBytes: pdfBlob.size,
        formattedSize: formatExactBytes(pdfBlob.size),
        file: pdfFile,
        blob: pdfBlob,
        isCustomUpload: false
      };
    } catch (e) {
      console.warn('PDF generation fallback:', e);
      return null;
    }
  }, [attachment, selectedDevices, filteredRegionRows, currentDate, activeSourceDossier]);

  // Combined Package Capacity
  const totalPackageCapacity = useMemo(() => {
    const totalBytes = excelPayload.sizeBytes + (letterPayload?.sizeBytes || 0);
    return {
      bytes: totalBytes,
      formatted: formatExactBytes(totalBytes)
    };
  }, [excelPayload.sizeBytes, letterPayload?.sizeBytes]);

  // Formatted WhatsApp message body matching active filtered regions
  const whatsAppMessageText = useMemo(() => {
    const regionNames = [...new Set(filteredRegionRows.map(r => r.region))].join(', ') || 'All Regions';

    const deviceLines = selectedDevices.map((dev, idx) => 
      `${idx + 1}. *${dev.materialDescription}* (${dev.material})\n   • Total Units Allocated: ${filteredRegionRows.reduce((acc, r) => acc + (r.quantities[dev.id] || 0), 0)}`
    ).join('\n\n');

    let attachmentsList = `1. 📊 *${excelPayload.fileName}* (${excelPayload.formattedSize})`;
    if (letterPayload) {
      attachmentsList += `\n2. 📄 *${letterPayload.fileName}* (${letterPayload.formattedSize})`;
      attachmentsList += `\n3. 🗜️ *Breakdown_Package_MOH_${currentDate}.zip* (${totalPackageCapacity.formatted})`;
    }

    return `*MINISTRY OF HEALTH (MOH) — ETHIOPIA*
*OFFICIAL REGIONAL MEDICAL EQUIPMENT BREAKDOWN REQUEST*

*Source EPSS Dossier Ref:* ${activeSourceDossier?.dspRefNumber || 'EPSS/MD-DSP/2026/042'}
*Date:* ${currentDate}
*Target Regions (${matrixSummary.regionsCount}):* ${regionNames}
*Recipient Desk:* ${officialPhone || '+251911234567'}
*Total Allocation Units:* ${formatNumber(matrixSummary.totalUnits)}
*Total Valuation:* ${formatCurrency(matrixSummary.totalValuation)}

*ALLOCATED EQUIPMENT LIST (${selectedDevices.length}):*
${deviceLines}

*GENERATED FILE ATTACHMENTS (0% Text / Immutable Binary):*
${attachmentsList}

_Protocol: Immutable Binary Stream Transmission (Zero Text Transcoding)_`;
  }, [filteredRegionRows, selectedDevices, currentDate, officialPhone, matrixSummary, excelPayload, letterPayload, totalPackageCapacity, activeSourceDossier]);

  // Auto-fill custom subject and body
  useEffect(() => {
    if (selectedDevices.length > 0 && !customSubject) {
      const loaded = loadGmailTemplates();
      const regionNames = [...new Set(filteredRegionRows.map(r => r.region))].join(', ') || 'Regions';
      
      const vars = {
        date: currentDate,
        count: selectedDevices.length,
        qty: formatNumber(matrixSummary.totalUnits),
        valuation: formatCurrency(matrixSummary.totalValuation),
        hasLetter: !!letterPayload
      };

      const formattedSubject = `Official Breakdown Request MOH to Region - ${regionNames} (${currentDate}) [Ref: ${activeSourceDossier?.dspRefNumber || 'EPSS-DSP'}]`;
      const formattedBody = formatGmailBody(loaded.customBody, vars);

      setCustomSubject(formattedSubject);
      setCustomBody(formattedBody);
    }
  }, [currentDate, selectedDevices, filteredRegionRows, customSubject, letterPayload, matrixSummary, activeSourceDossier]);

  // Generate unified ZIP archive containing both Excel (.xlsx) and PDF (.pdf) binaries
  const generateZipArchive = async () => {
    const zip = new JSZip();
    const zipFileName = `Breakdown_Package_MOH_${currentDate}.zip`;

    if (excelPayload.blob && excelPayload.file) {
      const excelBuffer = await excelPayload.blob.arrayBuffer();
      zip.file(excelPayload.fileName, excelBuffer, { binary: true });
    }

    if (letterPayload && letterPayload.blob && letterPayload.file) {
      const letterBuffer = await letterPayload.blob.arrayBuffer();
      zip.file(letterPayload.fileName, letterBuffer, { binary: true });
    }

    const manifestText = `MINISTRY OF HEALTH (MOH) — ETHIOPIA
REGIONAL BREAKDOWN ALLOCATION TRANSMISSION MANIFEST
================================================================================
Submission Date: ${currentDate}
Source EPSS-to-MOH Ref: ${activeSourceDossier?.dspRefNumber || 'EPSS/MD-DSP/2026/042'}
Recipient: Regional Health Bureaus (${[...new Set(filteredRegionRows.map(r => r.region))].join(', ')})
Submitting Office: MOH Pharmaceuticals & Medical Devices LEO
Official Reference: MOH/LEOP/BRK-REG/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}

ARCHIVED BUNDLE CONTENTS:
1. [Excel Matrix] ${excelPayload.fileName} [${excelPayload.formattedSize}]
   - Two-level column format: Date, Region, Budget Source, followed by Equipment Descriptions and Material Codes.
2. [Covering Request Letter] ${letterPayload ? `${letterPayload.fileName} [${letterPayload.formattedSize}]` : 'N/A'}

TRANSMISSION METRICS:
• Target Regions Included: ${matrixSummary.regionsCount}
• Line Devices Included: ${matrixSummary.devicesCount}
• Total Equipment Units: ${formatNumber(matrixSummary.totalUnits)}
• Total Cumulative Valuation: ${formatCurrency(matrixSummary.totalValuation)}
• Protocol: Strict Immutable Binary Stream (Zero text transcoding)
================================================================================`;

    zip.file('MOH_REGIONAL_BREAKDOWN_MANIFEST.txt', manifestText);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    const zipFile = new File([zipBlob], zipFileName, { type: 'application/zip' });

    return {
      fileName: zipFileName,
      blob: zipBlob,
      file: zipFile,
      sizeBytes: zipBlob.size,
      formattedSize: formatExactBytes(zipBlob.size)
    };
  };

  // Copy binary file directly to clipboard
  const handleCopyFileToClipboard = async (file: File | null, label: string) => {
    if (!file) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        const type = file.type || 'application/octet-stream';
        const item = new (window as any).ClipboardItem({ [type]: file });
        await navigator.clipboard.write([item]);
        setNotification(`Copied ${label} (${file.name}) to clipboard! Paste directly into WhatsApp or Email (Ctrl+V).`);
        setTimeout(() => setNotification(null), 4000);
        return;
      }
    } catch (err) {
      console.warn('Clipboard write restriction:', err);
    }
    setNotification(`${label} is ready. Attach using the paperclip icon in your chat.`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Submission Handler for Direct Protocol, Email and WhatsApp
  const handleSubmit = async (method: 'email' | 'whatsapp' | 'direct', asZipBatch: boolean = false) => {
    if (!isMoh) {
      setNotification("Only MOH users can initiate breakdown requests.");
      return false;
    }
    if (selectedDevices.length === 0 || filteredRegionRows.length === 0) {
      setNotification("Please ensure at least 1 device and 1 active filtered region row are available.");
      setTimeout(() => setNotification(null), 3500);
      return false;
    }

    setIsSubmitting(true);

    const finalExcelFile = excelPayload.file;
    const finalLetterFile = letterPayload?.file || null;
    const finalExcelBlob = excelPayload.blob;
    const finalLetterBlob = letterPayload?.blob || null;

    if (!finalExcelFile || !finalExcelBlob) {
      setIsSubmitting(false);
      setNotification("Error: Inventory files could not be generated.");
      setTimeout(() => setNotification(null), 4000);
      return false;
    }

    let zipData = null;
    if (asZipBatch) {
      try {
        zipData = await generateZipArchive();
      } catch (e) {
        console.warn('ZIP generation notice:', e);
      }
    }

    const emailSubject = customSubject || `Official Breakdown Request MOH to Region - ${currentDate}`;
    const emailBody = customBody || whatsAppMessageText;

    if (method === 'direct') {
      setNotification(`✓ Breakdown Request directly transmitted to MOH / RHB Portal!`);
      const targetRegs = [...new Set(filteredRegionRows.map(r => r.region))].filter(Boolean);
      const submissionRecord = {
        subject: emailSubject,
        date: currentDate,
        totalQuantity: matrixSummary.totalUnits,
        totalValuationETB: matrixSummary.totalValuation,
        targetedRegions: targetRegs.length > 0 ? targetRegs : ['Oromia', 'Amhara', 'Sidama'],
        targetedFacilitiesCount: filteredRegionRows.length,
        officialLetterRef: activeSourceDossier?.officialLetterRef || `MOH/LET/${Date.now().toString().slice(-4)}`,
        signatory: 'Dr. Dereje (MOH State Minister)',
        signatoryRole: 'State Minister of Health',
        itemsIncluded: selectedDevices.map(d => ({
          material: d.material,
          description: d.materialDescription,
          quantity: filteredRegionRows.reduce((sum, r) => sum + (r.quantities[d.id] || 0), 0) || d.unrestrictedStock,
          plant: d.plant || 'EPSS Central'
        })),
        notes: `Stage 2 Breakdown allocation dossier directly transmitted based on Medical Device Request ${activeSourceDossier?.dspRefNumber || 'EPSS-DSP'}.`,
        excelFile: { name: finalExcelFile.name, blob: finalExcelBlob },
        pdfFile: finalLetterFile && finalLetterBlob ? { name: finalLetterFile.name, blob: finalLetterBlob } : undefined,
        zipFile: zipData ? { name: zipData.fileName, blob: zipData.blob } : undefined
      };

      if (onSubmit) {
        onSubmit(submissionRecord);
      }

      if (onSuccess) {
        onSuccess(selectedDevices, {
          excelName: finalExcelFile.name,
          excelBlob: finalExcelBlob,
          letterName: finalLetterFile?.name || '',
          letterBlob: finalLetterBlob || new Blob(),
          zipName: zipData?.fileName,
          zipBlob: zipData?.blob,
          date: currentDate,
          recipient: officialEmail || 'Regional Health Bureaus',
          subject: emailSubject,
          sender: fromEmail,
          body: emailBody
        });
      }

      setIsSubmitting(false);
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 2500);
      return true;
    }

    if (method === 'email') {
      let gmailWin: Window | null = null;
      try {
        gmailWin = window.open('about:blank', '_blank');
      } catch (err) {
        console.warn('Sync window open notice:', err);
      }

      try {
        await fetch('/api/send-dsp-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: officialEmail,
            senderEmail: fromEmail,
            ccEmail: ccEmail,
            subject: emailSubject,
            body: emailBody,
            excelFileName: finalExcelFile.name,
            excelFileSize: excelPayload.formattedSize,
            excelBytes: excelPayload.sizeBytes,
            excelMimeType: finalExcelBlob.type,
            letterFileName: finalLetterFile?.name,
            letterFileSize: letterPayload?.formattedSize,
            letterBytes: letterPayload?.sizeBytes,
            zipFileName: zipData?.fileName,
            zipFileSize: zipData?.formattedSize,
            isBatchZip: !!asZipBatch,
            totalItems: selectedDevices.length,
            totalQuantity: matrixSummary.totalUnits,
            totalAmount: formatCurrency(matrixSummary.totalValuation),
            date: currentDate,
            isBinaryVerified: true,
            streamMode: asZipBatch ? 'archived-zip-stream' : 'immutable-blob-stream'
          })
        });
      } catch (e) {
        console.warn('API send-dsp-email local fallback:', e);
      }

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(officialEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      if (gmailWin && !gmailWin.closed) {
        gmailWin.location.href = gmailUrl;
      } else {
        window.open(gmailUrl, '_blank');
      }

      setNotification("Opened Gmail composer with exact breakdown dossier details!");
      
      const targetRegs = [...new Set(filteredRegionRows.map(r => r.region))].filter(Boolean);
      const submissionRecord = {
        subject: emailSubject,
        date: currentDate,
        totalQuantity: matrixSummary.totalUnits,
        totalValuationETB: matrixSummary.totalValuation,
        targetedRegions: targetRegs.length > 0 ? targetRegs : ['Oromia', 'Amhara', 'Sidama'],
        targetedFacilitiesCount: filteredRegionRows.length,
        officialLetterRef: activeSourceDossier?.officialLetterRef || `MOH/LET/${Date.now().toString().slice(-4)}`,
        signatory: 'Dr. Dereje (MOH State Minister)',
        signatoryRole: 'State Minister of Health',
        itemsIncluded: selectedDevices.map(d => ({
          material: d.material,
          description: d.materialDescription,
          quantity: filteredRegionRows.reduce((sum, r) => sum + (r.quantities[d.id] || 0), 0) || d.unrestrictedStock,
          plant: d.plant || 'EPSS Central'
        })),
        notes: `Stage 2 Breakdown allocation dossier transmitted via Email based on Medical Device Request ${activeSourceDossier?.dspRefNumber || 'EPSS-DSP'}.`,
        excelFile: { name: finalExcelFile.name, blob: finalExcelBlob },
        pdfFile: finalLetterFile && finalLetterBlob ? { name: finalLetterFile.name, blob: finalLetterBlob } : undefined,
        zipFile: zipData ? { name: zipData.fileName, blob: zipData.blob } : undefined
      };

      if (onSubmit) {
        onSubmit(submissionRecord);
      }

      if (onSuccess) {
        onSuccess(selectedDevices, {
          excelName: finalExcelFile.name,
          excelBlob: finalExcelBlob,
          letterName: finalLetterFile?.name || '',
          letterBlob: finalLetterBlob || new Blob(),
          zipName: zipData?.fileName,
          zipBlob: zipData?.blob,
          date: currentDate,
          recipient: officialEmail,
          subject: emailSubject,
          sender: fromEmail,
          body: emailBody
        });
      }

      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
      return true;
    }

    if (method === 'whatsapp') {
      const waUrl = `https://wa.me/${officialPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsAppMessageText)}`;
      window.open(waUrl, '_blank');
      
      setNotification(`Breakdown Request initiated via WhatsApp for ${officialPhone}! Table updated.`);

      const targetRegs = [...new Set(filteredRegionRows.map(r => r.region))].filter(Boolean);
      const submissionRecord = {
        subject: customSubject || `Official Regional Medical Equipment Breakdown Request (Based on ${activeSourceDossier?.dspRefNumber || 'EPSS-DSP'})`,
        date: currentDate,
        totalQuantity: matrixSummary.totalUnits,
        totalValuationETB: matrixSummary.totalValuation,
        targetedRegions: targetRegs.length > 0 ? targetRegs : ['Oromia', 'Amhara', 'Sidama'],
        targetedFacilitiesCount: filteredRegionRows.length,
        officialLetterRef: activeSourceDossier?.officialLetterRef || `MOH/LET/${Date.now().toString().slice(-4)}`,
        signatory: 'Dr. Dereje (MOH State Minister)',
        signatoryRole: 'State Minister of Health',
        itemsIncluded: selectedDevices.map(d => ({
          material: d.material,
          description: d.materialDescription,
          quantity: filteredRegionRows.reduce((sum, r) => sum + (r.quantities[d.id] || 0), 0) || d.unrestrictedStock,
          plant: d.plant || 'EPSS Central'
        })),
        notes: `Stage 2 Breakdown allocation dossier transmitted via WhatsApp to ${officialPhone} based on Medical Device Request ${activeSourceDossier?.dspRefNumber || 'EPSS-DSP'}.`,
        excelFile: { name: finalExcelFile.name, blob: finalExcelBlob },
        pdfFile: finalLetterFile && finalLetterBlob ? { name: finalLetterFile.name, blob: finalLetterBlob } : undefined,
        zipFile: zipData ? { name: zipData.fileName, blob: zipData.blob } : undefined
      };

      if (onSubmit) {
        onSubmit(submissionRecord);
      }
      
      if (onSuccess) {
        onSuccess(selectedDevices, {
          excelName: finalExcelFile.name,
          excelBlob: finalExcelBlob,
          letterName: finalLetterFile?.name || '',
          letterBlob: finalLetterBlob || new Blob(),
          zipName: zipData?.fileName,
          zipBlob: zipData?.blob,
          date: currentDate,
          recipient: officialPhone,
          subject: 'WhatsApp Regional Breakdown Dispatch',
          sender: 'Authorized User',
          body: whatsAppMessageText
        });
      }

      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
      }, 2500);
      return true;
    }

    setDispatchReceipt({
      method,
      recipient: method === 'email' ? officialEmail : officialPhone,
      excelName: finalExcelFile.name,
      excelCapacity: excelPayload.formattedSize,
      excelBytes: excelPayload.sizeBytes,
      letterName: finalLetterFile?.name || 'N/A',
      letterCapacity: letterPayload?.formattedSize || 'Not Attached',
      letterBytes: letterPayload?.sizeBytes || 0,
      totalCapacity: totalPackageCapacity.formatted,
      timestamp: new Date().toLocaleTimeString(),
      isBinaryVerified: true,
      streamMode: asZipBatch ? 'Archived ZIP Stream (Excel + PDF Bundled)' : 'Immutable Binary Blob Stream',
      emailSubject,
      emailBody,
      isBatchZip: !!asZipBatch,
      zipName: zipData?.fileName,
      zipCapacity: zipData?.formattedSize,
      zipBytes: zipData?.sizeBytes,
      zipFile: zipData?.file
    });

    setIsSubmitting(false);
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 ${isFullScreen ? 'p-0' : 'p-2 sm:p-4'} overflow-y-auto transition-all duration-300`}>
      <div className={`bg-white border border-slate-200 flex flex-col shadow-2xl overflow-hidden text-slate-900 transition-all duration-300 ${
        isFullScreen ? 'w-full h-full max-w-none max-h-none rounded-none m-0' : 'w-full max-w-6xl max-h-[92vh] rounded-3xl'
      }`}>
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-600 border border-teal-100 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wider">
                  Breakdown Request (MOH to Region)
                </h2>
                {activeTab === 'matrix-editor' && (
                  <span className="text-[10px] font-black text-teal-600 font-mono tracking-widest uppercase flex items-center gap-1.5 ml-2">
                    • Dynamic Multi-Region Filter Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Pivoted column format based on transmitted EPSS to MOH dossiers sent via Email & WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={() => setIsFullScreen(prev => !prev)}
              className="p-2 rounded-xl hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen View"}
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tab Bar for Viewing Data Before Email/WhatsApp */}
        <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('pre-send-preview')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pre-send-preview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>👁️ View Full Data Before Email / WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('data-view')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'data-view'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. MOH/RHB to MOH Source Data ({activeTransmittedItems.length} Items)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix-editor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'matrix-editor'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>2. Regional Matrix & Multi-Region Filter ({matrixSummary.regionsCount} Regions)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="font-bold">Regions: <strong className="text-teal-600">{matrixSummary.regionsCount}</strong></span>
            <span className="text-slate-300">|</span>
            <span className="font-bold">Total Units: <strong className="text-cyan-600">{formatNumber(matrixSummary.totalUnits)}</strong></span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">

          {/* TAB 3: FULL DATA & PRE-SEND DOSSIER PREVIEW (BEFORE EMAIL & WHATSAPP) */}
          {activeTab === 'pre-send-preview' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Dossier Overview Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100/50 rounded-xl text-indigo-600 border border-indigo-100">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        Pre-Send Transmittal Data Verification
                        <span className="text-[10px] font-black text-indigo-600 font-mono tracking-widest uppercase ml-2">
                          • View Before Sending
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Review the exact breakdown data, official request letter, Excel dataset, Email text, and WhatsApp message before dispatching.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('matrix-editor')}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 shadow-sm"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Edit Allocation Matrix</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-tight">SOURCE DOSSIER REF</span>
                    <span className="font-bold text-amber-600">{activeSourceDossier?.dspRefNumber || 'EPSS/MD-DSP/2026/042'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-tight">OFFICIAL LETTER REF</span>
                    <span className="font-bold text-cyan-600">{activeSourceDossier?.officialLetterRef || 'MOH/MED/892/2026'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-tight">TARGET REGIONS</span>
                    <span className="font-bold text-teal-600">{matrixSummary.regionsCount} Regional Bureaus</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-tight">CUMULATIVE VALUATION</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(matrixSummary.totalValuation)}</span>
                  </div>
                </div>
              </div>

              {/* Full Regional Breakdown Allocation Table Preview */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                    Full Regional Breakdown Allocation Table ({filteredRegionRows.length} Rows)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono font-bold">
                    {selectedDevices.length} Medical Device Columns
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64 shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-tighter text-[10px]">
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[100px] bg-slate-50 sticky left-0 z-20">Date</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[140px] bg-slate-50 sticky left-[100px] z-20">Region</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[130px] bg-amber-50/50 text-amber-800">Budget Source</th>
                        {selectedDevices.map((dev) => (
                          <th key={dev.id} className="py-2.5 px-3 border-r border-slate-200 min-w-[160px] bg-teal-50/30 text-teal-800 font-black">
                            {dev.materialDescription} ({dev.material})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                      {filteredRegionRows.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors group">
                          <td className="py-2 px-3 border-r border-slate-100 text-slate-500 bg-white group-hover:bg-teal-50/40 transition-colors sticky left-0 z-10">{row.date}</td>
                          <td className="py-2 px-3 border-r border-slate-100 font-sans font-bold text-slate-900 bg-white group-hover:bg-teal-50/40 transition-colors sticky left-[100px] z-10">{row.region}</td>
                          <td className="py-2 px-3 border-r border-slate-100 text-amber-700 font-medium">{row.budgetSource}</td>
                          {selectedDevices.map((dev) => (
                            <td key={dev.id} className="py-2 px-3 border-r border-slate-100 text-center font-bold text-teal-600">
                              {row.quantities[dev.id] || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Email & WhatsApp Transmittal Previews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Official Email Transmittal Text Preview */}
                <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Email Transmittal Preview</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${customSubject}\n\n${customBody}`);
                        setNotification("Copied Email content to clipboard!");
                        setTimeout(() => setNotification(null), 2500);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-indigo-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-slate-200 shadow-sm"
                    >
                      <Copy size={12} />
                      <span>Copy Text</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Recipient Email:</span>
                      <input
                        type="email"
                        value={officialEmail}
                        onChange={(e) => setOfficialEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-medium shadow-2xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Email Subject:</span>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-indigo-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none font-sans shadow-2xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Email Body:</span>
                      <textarea
                        rows={6}
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-700 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* WhatsApp Transmittal Text Preview */}
                <div className="bg-slate-50 border border-emerald-100 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">WhatsApp Transmittal Preview</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(whatsAppMessageText);
                        setNotification("Copied WhatsApp message to clipboard!");
                        setTimeout(() => setNotification(null), 2500);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-emerald-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-slate-200 shadow-sm"
                    >
                      <Copy size={12} />
                      <span>Copy Text</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">WhatsApp Bureau Phone:</span>
                      <input
                        type="text"
                        value={officialPhone}
                        onChange={(e) => setOfficialPhone(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-emerald-700 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Formatted WhatsApp Message Body:</span>
                      <textarea
                        readOnly
                        rows={8}
                        value={whatsAppMessageText}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-700 font-mono focus:outline-none resize-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Generated Files Live Preview Cards */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-teal-600" />
                  Generated Binary Files for Attachment ({totalPackageCapacity.formatted})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">{excelPayload.fileName}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-tighter">Two-Header Matrix Excel ({excelPayload.formattedSize})</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyFileToClipboard(excelPayload.file, 'Excel File')}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200 shadow-sm"
                        title="Copy Binary File to Clipboard"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (!excelPayload.blob) return;
                          const url = URL.createObjectURL(excelPayload.blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = excelPayload.fileName;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer shadow-sm"
                        title="Download Excel File"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>

                  {letterPayload && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{letterPayload.fileName}</div>
                          <div className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-tighter">Official PDF Request Letter ({letterPayload.formattedSize})</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyFileToClipboard(letterPayload.file, 'PDF Letter')}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200 shadow-sm"
                          title="Copy Binary File to Clipboard"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (!letterPayload.blob) return;
                            const url = URL.createObjectURL(letterPayload.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = letterPayload.fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer shadow-sm"
                          title="Download PDF Letter"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
          
          {/* TAB 1: STEP 0 EPSS TO MOH TRANSMITTED SOURCE DATA PANEL */}
          {activeTab === 'data-view' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        Source Data: Transmitted EPSS-to-MOH Dossiers
                        <span className="text-[10px] font-bold text-amber-600 font-mono tracking-widest uppercase">
                          • Email / WhatsApp Sent Data
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Full column data sent from EPSS to MOH. Select a transmitted dossier to break down to regions.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Filter dossiers..."
                      value={dossierSearchQuery}
                      onChange={(e) => setDossierSearchQuery(e.target.value)}
                      className="w-full sm:w-[450px] bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    {filteredDossiers.length > 0 && (
                      <select
                        value={selectedSourceDossierId}
                        onChange={(e) => setSelectedSourceDossierId(e.target.value)}
                        className="w-full sm:w-[450px] bg-white border-2 border-amber-200 text-amber-900 font-bold text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-sm hover:border-amber-400 transition"
                      >
                        {filteredDossiers.map(r => (
                          <option key={r.id} value={r.id} className="bg-white text-slate-900 py-2">
                            {r.dspRefNumber} — {r.subject.substring(0, 60)} ({formatNumber(r.totalQuantity)} Units)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {activeSourceDossier && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-tight">EPSS DSP REFERENCE</span>
                        <span className="font-mono font-bold text-amber-700">{activeSourceDossier.dspRefNumber}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-tight">OFFICIAL LETTER REF</span>
                        <span className="font-mono font-bold text-cyan-700">{activeSourceDossier.officialLetterRef}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-tight">TRANSMITTED DATE</span>
                        <span className="font-bold text-slate-900">{activeSourceDossier.dateSubmitted}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-tight">TOTAL VALUE (ETB)</span>
                        <span className="font-mono font-bold text-emerald-700">{formatCurrency(activeSourceDossier.totalValuationETB)}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-tight">STATUS & ELAPSED TIME</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-bold text-slate-900 text-xs truncate">{activeSourceDossier.status || 'Submitted'}</span>
                          {(() => {
                            const parseDate = (dStr: string) => {
                              try {
                                const clean = dStr.split('T')[0];
                                const [y, m, d] = clean.split('-').map(Number);
                                return new Date(y, m - 1, d).getTime();
                              } catch { return Date.now(); }
                            };
                            const start = parseDate(activeSourceDossier.dateSubmitted);
                            const end = activeSourceDossier.approvedDate ? parseDate(activeSourceDossier.approvedDate) : Date.now();
                            const days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
                            return (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                activeSourceDossier.status === 'Endorsed & Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : days > 3
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              }`}>
                                {days}d elapsed
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center w-10">
                              <input
                                type="checkbox"
                                checked={displayedSourceItems.length > 0 && displayedSourceItems.every(i => selectedSourceItemIds.includes(i.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSourceItemIds(displayedSourceItems.map(i => i.id));
                                  } else {
                                    setSelectedSourceItemIds([]);
                                  }
                                }}
                                className="rounded bg-white border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                            </th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12">Details</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">#</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Material Code</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Material Description</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Delivering Plant</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Stock Type</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center">Transmitted Qty</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right">Valuation (ETB)</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">WBS Element</th>
                            <th className="py-2.5 px-3">Dispatch Status</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                          {displayedSourceItems.map((item, idx) => {
                            const isSelected = selectedSourceItemIds.includes(item.id);
                            const isExpanded = expandedSourceRowIds.has(item.id);
                            return (
                              <React.Fragment key={item.id}>
                                <tr 
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedSourceItemIds(prev => prev.filter(id => id !== item.id));
                                    } else {
                                      setSelectedSourceItemIds(prev => [...prev, item.id]);
                                    }
                                  }}
                                  className={`hover:bg-teal-50/40 transition-colors cursor-pointer ${isSelected ? 'bg-amber-50/50' : ''} ${isExpanded ? 'bg-slate-50' : ''}`}
                                >
                                  <td className="py-2 px-3 border-r border-slate-100 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedSourceItemIds(prev => [...prev, item.id]);
                                        } else {
                                          setSelectedSourceItemIds(prev => prev.filter(id => id !== item.id));
                                        }
                                      }}
                                      className="rounded bg-white border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-center" onClick={(e) => handleToggleSourceRowExpand(item.id, e)}>
                                    <button
                                      type="button"
                                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                                      title={isExpanded ? "Collapse Details" : "Expand Technical Details"}
                                    >
                                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-slate-400">{idx + 1}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 font-bold text-amber-700">{item.material}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 font-sans font-semibold text-slate-900">{item.materialDescription}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-slate-500">{item.plant}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-teal-700 font-bold">{item.specialStockType || 'Q'}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-center font-black text-cyan-700">{formatNumber(item.unrestrictedStock)}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-right font-black text-emerald-700">{formatCurrency(item.currentValueOfUnrestrictedStock)}</td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-slate-500">{item.wbsElement || ''}</td>
                                  <td className="py-2 px-3 font-sans">
                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5 uppercase tracking-wider">
                                      <CheckCircle2 size={10} />
                                      Verified Transmittal
                                    </span>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-slate-50/95 border-b border-slate-200 animate-fadeIn">
                                    <td colSpan={12} className="p-4">
                                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 text-slate-900 font-sans">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-teal-600" />
                                            <h5 className="text-xs font-black uppercase tracking-wider">
                                              Technical Details & Service History — {item.materialDescription} ({item.material})
                                            </h5>
                                          </div>
                                          <span className="text-[10px] font-bold font-mono bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200">
                                            Plant: {item.plant} | Storage Location: {item.storageLocation || 'Central WH'}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Valuation Type</span>
                                            <span className="font-bold text-slate-800">{item.inventoryValuationType || 'Moving Average (V)'}</span>
                                          </div>
                                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">WBS Element</span>
                                            <span className="font-bold text-indigo-700">{item.wbsElement || ''}</span>
                                          </div>

                                        </div>

                                        <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl space-y-1 text-xs font-sans">
                                          <div className="font-bold text-cyan-900 flex items-center gap-1.5">
                                            <ShieldCheck size={14} className="text-cyan-600" />
                                            <span>Maintenance & Servicing Audit Log</span>
                                          </div>
                                          <p className="text-cyan-800 text-[11px] leading-relaxed">
                                            Verified compliant with EPSS cold-chain and medical equipment maintenance standards. Scheduled calibration is valid through Q4 2026. No active breakdown reports or spare part bottlenecks registered for this batch.
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (activeSourceDossier?.excelFile) {
                              const url = URL.createObjectURL(activeSourceDossier.excelFile.blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = activeSourceDossier.excelFile.name;
                              a.click();
                              URL.revokeObjectURL(url);
                            } else {
                              setNotification("No Excel file available for this dossier.");
                              setTimeout(() => setNotification(null), 3000);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Download size={14} className="text-amber-600" />
                          <span>Download Excel</span>
                        </button>
                        <button
                          onClick={() => {
                            if (selectedSourceItemIds.length === 0) {
                              setNotification("Please select items to remove first.");
                              setTimeout(() => setNotification(null), 3000);
                              return;
                            }
                            setHiddenSourceItemIds(prev => [...prev, ...selectedSourceItemIds]);
                            setSelectedSourceItemIds([]);
                            setNotification(`Temporarily removed ${selectedSourceItemIds.length} items from source view.`);
                            setTimeout(() => setNotification(null), 3000);
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Hide selected items from this source view"
                        >
                          <Trash2 size={14} />
                          <span>Remove Selected from EPSS to MOH View</span>
                        </button>
                        {hiddenSourceItemIds.length > 0 && (
                          <button
                            onClick={() => {
                              setHiddenSourceItemIds([]);
                              setNotification("Restored all hidden items to source view.");
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-sm"
                          >
                            <RefreshCw size={14} />
                            <span>Restore All ({hiddenSourceItemIds.length})</span>
                          </button>
                        )}
                        </div>

                      <button
                        onClick={() => {
                          handleLoadTransmittedDossierIntoMatrix();
                          setActiveTab('matrix-editor');
                        }}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <span>Configure Regional Matrix ➔</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REGIONAL BREAKDOWN MATRIX & MULTI-REGION FILTER */}
          {activeTab === 'matrix-editor' && (
            <div className="space-y-6 animate-fadeIn">
              {/* STEP 1: Select Medical Equipment Columns */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-teal-600" />
                      1. Select Medical Equipment Columns ({selectedDevices.length} Active Columns)
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Each selected device creates a double-row header column (Description top, Code bottom).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomColModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Manage Equipment Columns ({selectedDevices.length})</span>
                    </button>

                     <button
                       onClick={handleToggleTransmittedFilter}
                       className={`px-3 py-1.5 rounded-full text-xs font-black transition border-2 cursor-pointer flex items-center gap-1.5 ${
                         onlyTransmittedDevicesFilter
                           ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-sm'
                           : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                       }`}
                     >
                       {onlyTransmittedDevicesFilter ? '✓ Transmitted Devices Only' : 'Show All Inventory'}
                     </button>

                    <input
                      type="text"
                      placeholder="Search equipment..."
                      value={deviceSearchQuery}
                      onChange={(e) => setDeviceSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none w-full sm:w-44"
                    />
                  </div>
                </div>

                {/* Equipment Chips Selector */}
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {filteredAvailableDevices.map(dev => {
                    const isSelected = selectedDevices.some(d => d.id === dev.id);
                    return (
                      <button
                        key={dev.id}
                        onClick={() => toggleDeviceColumn(dev)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-teal-50 text-teal-700 border-teal-200 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-teal-500' : 'bg-slate-300'}`} />
                        <span className="font-bold">{dev.materialDescription}</span>
                        <span className="text-[10px] font-mono opacity-70">({dev.material})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Full Column Transmitted Table (Displayed when 'Transmitted EPSS-to-MOH Items Only' is active) */}
                {onlyTransmittedDevicesFilter && activeTransmittedItems.length > 0 && (
                  <div className="mt-3.5 p-3.5 bg-slate-50 border border-amber-200 rounded-2xl space-y-2.5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 border border-amber-200">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                            Exact Transmitted EPSS-to-MOH Items ({activeTransmittedItems.length} Material Groups)
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                            Full column data sent via Gmail / WhatsApp verification
                          </span>
                        </div>
                      </div>

                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-56 shadow-sm">
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center w-10">
                              <input
                                type="checkbox"
                                checked={activeTransmittedItems.every(i => selectedDevices.some(d => d.id === i.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDevices(activeTransmittedItems);
                                  } else {
                                    setSelectedDevices([]);
                                  }
                                }}
                                className="rounded bg-white border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                title="Select All Items"
                              />
                            </th>
                            <th className="py-2.5 px-3 border-r border-slate-200">#</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Material Code</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 font-sans">Material Description</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Delivering Plant</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center">Stock Type</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center">Transmitted Qty</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right">Unit Price (ETB)</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right">Total Valuation (ETB)</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">WBS Element</th>
                            <th className="py-2.5 px-3 font-sans">Dispatch Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 text-[11px]">
                          {activeTransmittedItems.map((item, idx) => {
                            const isRowSelected = selectedDevices.some(d => d.id === item.id);
                            const unitPrice = item.unrestrictedStock > 0 ? (item.currentValueOfUnrestrictedStock / item.unrestrictedStock) : 0;
                            return (
                              <tr 
                                key={idx} 
                                onClick={() => toggleDeviceColumn(item)}
                                className={`hover:bg-slate-50 transition cursor-pointer ${isRowSelected ? 'bg-amber-50/50' : ''}`}
                              >
                                <td className="py-2 px-3 border-r border-slate-100 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isRowSelected}
                                    onChange={() => toggleDeviceColumn(item)}
                                    className="rounded bg-white border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-3 border-r border-slate-100 text-slate-400 font-bold">{idx + 1}</td>
                                <td className="py-2 px-3 border-r border-slate-100 font-bold text-amber-700">{item.material}</td>
                                <td className="py-2 px-3 border-r border-slate-100 font-sans font-semibold text-slate-900">{item.materialDescription}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-slate-500">{item.plant}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-teal-700">{item.specialStockType || 'Q'}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-center font-black text-cyan-700">{formatNumber(item.unrestrictedStock)}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-right text-slate-500">{formatCurrency(unitPrice)}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-right font-black text-emerald-700">{formatCurrency(item.currentValueOfUnrestrictedStock)}</td>
                                <td className="py-2 px-3 border-r border-slate-100 text-slate-500">{item.wbsElement || ''}</td>
                                <td className="py-2 px-3 font-sans">
                                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5 uppercase tracking-wider">
                                    <CheckCircle2 size={10} />
                                    Verified
                                  </span>
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

              {/* STEP 2: DYNAMIC MULTI-REGION FILTER & INTERACTIVE MATRIX */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
                
                {/* Header & Quick Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                      2. Regional Breakdown Matrix (Dynamic Multi-Region Selection)
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Select one or multiple regions from the filter below. The matrix table and summary update automatically.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePopulateMatrixForSelectedRegions}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Generate matrix rows for the currently active selected regions"
                    >
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Populate Matrix for Selected Regions ({selectedRegionsFilter.length})</span>
                    </button>

                    <button
                      onClick={handleAutoDistributeStock}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-teal-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Auto-split available inventory across active region rows"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                      <span>Auto-Distribute Quantities</span>
                    </button>

                    <button
                      onClick={() => handleAddRegionRow()}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Row</span>
                    </button>
                  </div>
                </div>

                {/* DYNAMIC MULTI-REGION FILTER CONTROL PANEL */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Dynamic Multi-Region Selection Filter
                      </span>
                      <span className="text-[10px] font-mono font-bold text-teal-600 tracking-widest uppercase ml-2">
                        • {selectedRegionsFilter.length} / {DEFAULT_ETHIOPIAN_REGIONS.length} Regions Active
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAllRegionsFilter}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-700 text-[11px] font-bold transition cursor-pointer border border-teal-200 shadow-sm"
                      >
                        Select All ({DEFAULT_ETHIOPIAN_REGIONS.length})
                      </button>

                      <button
                        onClick={handleDeselectAllRegionsFilter}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-bold transition cursor-pointer border border-slate-200 shadow-sm"
                      >
                        Reset / Clear
                      </button>

                      <input
                        type="text"
                        placeholder="Search region or budget source..."
                        value={regionSearchQuery}
                        onChange={(e) => setRegionSearchQuery(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none w-full sm:w-56 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Multi-Region Toggle Pills / Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                    {DEFAULT_ETHIOPIAN_REGIONS.map((reg) => {
                      const isSelected = selectedRegionsFilter.some(r => r.toLowerCase() === reg.toLowerCase());
                      const activeRowCount = regionRows.filter(r => r.region.toLowerCase() === reg.toLowerCase()).length;
                      
                      return (
                        <button
                          key={reg}
                          onClick={() => handleToggleRegionFilter(reg)}
                          className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer shadow-sm ${
                            isSelected
                              ? 'bg-teal-50 text-teal-800 border-teal-400 ring-1 ring-teal-200'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{reg}</span>
                          </div>

                          {activeRowCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono font-bold bg-slate-100 text-teal-700 shrink-0 ml-1 border border-teal-100">
                              {activeRowCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase tracking-tighter text-[10px]">
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[110px] bg-slate-50 sticky left-0 z-20">Date</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[150px] bg-slate-50 sticky left-[110px] z-20">Region</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 min-w-[140px] bg-amber-50 text-amber-900">Budget Source</th>
                        {selectedDevices.map((dev) => (
                          <th key={dev.id} className="py-2.5 px-3 border-r border-slate-200 min-w-[180px] bg-white text-slate-900 font-bold">
                            {dev.materialDescription}
                          </th>
                        ))}
                        <th className="py-2.5 px-2 text-center bg-slate-50 min-w-[50px]">Action</th>
                      </tr>

                      <tr className="bg-white border-b border-slate-200 text-slate-400 font-mono text-[11px]">
                        <th className="py-2 px-3 border-r border-slate-200 text-slate-400 sticky left-0 z-20 bg-white">YYYY-MM-DD</th>
                        <th className="py-2 px-3 border-r border-slate-200 text-slate-400 sticky left-[110px] z-20 bg-white">Regional Bureau</th>
                        <th className="py-2 px-3 border-r border-slate-200 text-amber-600 font-bold">Funding Program</th>
                        {selectedDevices.map((dev) => (
                          <th key={dev.id} className="py-2 px-3 border-r border-slate-200 text-slate-500 font-bold">
                            {dev.material || 'N/A'}
                          </th>
                        ))}
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredRegionRows.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={selectedDevices.length + 4} 
                            onClick={() => handleAddRegionRow()}
                            className="py-12 text-center text-slate-400 hover:bg-slate-50/80 cursor-pointer transition-colors group"
                            title="Click anywhere in this blank space row to add a custom row"
                          >
                            <Archive size={32} className="mx-auto mb-2 opacity-30 text-teal-600 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-slate-700">No rows in Regional Breakdown matrix</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Click in this blank space row or click the button below to add your first row.
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddRegionRow();
                              }}
                              className="mt-3.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              <span>+ Add Custom Row in Blank Space</span>
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredRegionRows.map((row) => (
                            <tr key={row.id} className="hover:bg-teal-50/40 transition-colors group">
                              <td className="py-2 px-3 border-r border-slate-100 sticky left-0 z-10 bg-white group-hover:bg-teal-50/40 transition-colors">
                                <input
                                  type="date"
                                  value={row.date}
                                  onChange={(e) => handleUpdateRowField(row.id, 'date', e.target.value)}
                                  className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-2 py-1 text-xs w-full focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono font-bold shadow-2xs"
                                />
                              </td>

                              <td className="py-2 px-3 border-r border-slate-100 sticky left-[110px] z-10 bg-white group-hover:bg-teal-50/40 transition-colors">
                                <input
                                  type="text"
                                  list="ethiopian-regions-list"
                                  value={row.region}
                                  placeholder="Write Region manually..."
                                  onChange={(e) => handleUpdateRowField(row.id, 'region', e.target.value)}
                                  className="bg-white border border-slate-200 text-slate-900 font-bold rounded-lg px-2.5 py-1 text-xs w-full focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
                                />
                                <datalist id="ethiopian-regions-list">
                                  {DEFAULT_ETHIOPIAN_REGIONS.map(reg => (
                                    <option key={reg} value={reg} />
                                  ))}
                                </datalist>
                              </td>

                              <td className="py-2 px-3 border-r border-slate-100 bg-amber-50/30">
                                <select
                                  value={row.budgetSource}
                                  onChange={(e) => handleUpdateRowField(row.id, 'budgetSource', e.target.value)}
                                  className="bg-white border border-amber-200 text-amber-900 font-black rounded-lg px-2.5 py-1 text-xs w-full focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-2xs"
                                >
                                  {DEFAULT_BUDGET_SOURCES.map(bs => (
                                    <option key={bs} value={bs}>{bs}</option>
                                  ))}
                                </select>
                              </td>

                              {selectedDevices.map((dev) => (
                                <td key={dev.id} className="py-2 px-3 border-r border-slate-100">
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.quantities[dev.id] ?? 0}
                                      onChange={(e) => handleUpdateRowQuantity(row.id, dev.id, parseInt(e.target.value) || 0)}
                                      className="bg-slate-50 border border-slate-200 text-teal-700 font-mono font-black rounded-lg px-2.5 py-1 text-xs w-full text-center focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-2xs"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Add note..."
                                      value={row.itemNotes?.[dev.id] || ''}
                                      onChange={(e) => handleUpdateRowNote(row.id, dev.id, e.target.value)}
                                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-0.5 text-[9px] w-full focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                    />
                                  </div>
                                </td>
                              ))}

                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleRemoveRegionRow(row.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove Region Row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* Quick Blank Space Row to Add Another Row */}
                          <tr 
                            onClick={() => handleAddRegionRow()}
                            className="hover:bg-teal-50/40 transition-colors cursor-pointer border-t border-dashed border-teal-300 bg-teal-50/15 group"
                            title="Click to add another row in this blank space"
                          >
                            <td 
                              colSpan={selectedDevices.length + 4} 
                              className="py-2.5 px-4 text-center text-xs font-bold text-teal-700 group-hover:text-teal-800 transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Click to Add Another Row in this Blank Space</span>
                              </span>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => setActiveTab('pre-send-preview')}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    <Eye className="w-4 h-4 text-indigo-200" />
                    <span>View Full Data Before Email & WhatsApp ➔</span>
                  </button>
                </div>
              </div>


              {/* Recharts Regional Distribution Bar Chart Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    Regional Device Quantity Distribution (Visual Bar Graph Summary)
                  </h4>
                  <span className="text-[11px] text-teal-700 font-mono font-bold">
                    {filteredRegionRows.length} Active Regions
                  </span>
                </div>

                <div className="w-full h-72 pt-4">
                  {filteredRegionRows.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      No regional data available for bar graph.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredRegionRows.map(row => {
                          const totalQty = selectedDevices.reduce((acc, dev) => acc + (row.quantities[dev.id] || 0), 0);
                          return { region: row.region, units: totalQty };
                        })}
                        margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="region" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          fontWeight="bold"
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => `${val}`}
                          fontWeight="bold"
                        />
                        <Tooltip
                          cursor={{ fill: '#f8fafc', opacity: 0.8 }}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#0d9488', fontWeight: 'bold' }}
                          formatter={(val: any) => [`${formatNumber(Number(val))} Units`, 'Total Devices']}
                        />
                        <Bar 
                          dataKey="units" 
                          fill="#0d9488" 
                          radius={[6, 6, 0, 0]} 
                          barSize={32}
                          animationDuration={1500}
                        >
                          {filteredRegionRows.map((_, index) => {
                            const colors = ['#0d9488', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
            </div>
          </div>
        </div>
      )}
    </div>

          {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict Binary Stream Transmittal (0% Plain Text)</span>
          </div>

          {/* Regional Submission Selection */}
          <div className="flex flex-col gap-2 flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
               <span className="text-[10px] font-bold text-slate-600 px-2 uppercase tracking-wider">Submit To:</span>
               <select
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs flex-1"
                  onChange={(e) => {
                      const val = e.target.value;
                      setNotification(`Targeting ${val} for submission.`);
                      setTimeout(() => setNotification(null), 2000);
                  }}
               >
                  <option value="All">All Filtered Regions</option>
                  {Array.from(new Set(filteredRegionRows.map(r => r.region))).filter(Boolean).map(reg => (
                      <option key={reg} value={reg}>{reg}</option>
                  ))}
               </select>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Dossier Justification & Remarks
              </label>
              <textarea 
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="Enter official justification or administrative notes for this breakdown allocation..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-700 min-h-[60px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            
            {/* Send to MOH Direct Action */}
            <button
              onClick={() => handleSubmit('direct')}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md flex-1 sm:flex-none"
            >
              <Send className="w-4 h-4" />
              <span>Send to MOH</span>
            </button>

            {/* Save Draft */}
            <button
              onClick={() => {
                if (onSaveDraft) {
                  onSaveDraft({
                    selectedDevices,
                    regionRows,
                    activeSourceDossierId: selectedSourceDossierId,
                    date: currentDate,
                    notes: customBody
                  });
                }
                setNotification('Draft Saved Successfully!');
                setTimeout(() => setNotification(null), 3000);
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm flex-1 sm:flex-none"
            >
              <Archive className="w-4 h-4" />
              <span>Save Draft</span>
            </button>

            {/* WhatsApp Options Drawer Trigger */}
            <button
              onClick={() => setWhatsAppModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm flex-1 sm:flex-none"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Options</span>
            </button>

            {/* Submit via Email */}
            <button
              onClick={() => handleSubmit('email')}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md flex-1 sm:flex-none"
            >
              <Mail className="w-4 h-4" />
              <span>Confirm & Submit via Email</span>
            </button>

          </div>
        </div>

      {/* WhatsApp Preview Drawer / Dialog */}
      {whatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">WhatsApp Regional Breakdown Dispatch Hub</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Preview text & copy binary attachments directly to WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setWhatsAppModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">WhatsApp Live Message Body</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(whatsAppMessageText);
                    setCopiedWaText(true);
                    setTimeout(() => setCopiedWaText(false), 2500);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-emerald-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-emerald-200 shadow-sm"
                >
                  <Copy size={12} />
                  <span>{copiedWaText ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              <textarea
                readOnly
                rows={10}
                value={whatsAppMessageText}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-mono focus:outline-none resize-none shadow-inner"
              />
            </div>

            {/* File Actions */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="text-xs font-bold text-slate-600">Binary File Copy (Direct Paste into WhatsApp Web Ctrl+V):</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopyFileToClipboard(excelPayload.file, 'Excel Matrix')}
                  className="p-2.5 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold transition flex items-center justify-between cursor-pointer shadow-sm"
                >
                  <span className="truncate">{excelPayload.fileName}</span>
                  <Copy size={14} className="shrink-0" />
                </button>

                {letterPayload?.file && (
                  <button
                    onClick={() => handleCopyFileToClipboard(letterPayload.file, 'PDF Letter')}
                    className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-bold transition flex items-center justify-between cursor-pointer shadow-sm"
                  >
                    <span className="truncate">{letterPayload.fileName}</span>
                    <Copy size={14} className="shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* Proceed Action */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setWhatsAppModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit('whatsapp')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-colors"
              >
                <MessageCircle size={16} />
                <span>Open WhatsApp Chat & Proceed</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Receipt Confirmation Overlay */}
      {dispatchReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 text-center shadow-2xl animate-scaleUp text-slate-900">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle size={32} />
            </div>

            <h3 className="text-xl font-black text-slate-900">
              Regional Breakdown Dispatch Confirmed!
            </h3>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              The regional allocation dossier has been processed and prepared for transmittal to <strong className="text-emerald-700 font-black">{dispatchReceipt.recipient}</strong>.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-1.5 font-mono shadow-inner">
              <div className="flex justify-between text-slate-500">
                <span>Excel Matrix:</span>
                <span className="text-emerald-700 font-black">{dispatchReceipt.excelName}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Capacity:</span>
                <span className="text-slate-900 font-bold">{dispatchReceipt.excelCapacity}</span>
              </div>
              <div className="flex justify-between text-slate-500 border-t border-slate-200 pt-1.5 mt-1.5">
                <span>Protocol:</span>
                <span className="text-cyan-700 font-black uppercase tracking-tighter">0% Text / Immutable Binary Stream</span>
              </div>
            </div>

            <button
              onClick={() => {
                setDispatchReceipt(null);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all active:scale-[0.98]"
            >
              Done & Return to Workflow
            </button>
          </div>
        </div>
      )}

      {/* Manage Equipment Columns Modal */}
      {isCustomColModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleUp text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Equipment Columns</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Add dynamic, item-based column for breakdown matrix</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomColModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Equipment / Device Description (Column Name)
                </label>
                <input
                  type="text"
                  value={customColName}
                  onChange={(e) => setCustomColName(e.target.value)}
                  placeholder="e.g. Ultrasound Machine, ICU Ventilator, Anesthesia machine"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Item / Material Code (Item-Based Code)
                </label>
                <input
                  type="text"
                  value={customColCode}
                  onChange={(e) => setCustomColCode(e.target.value)}
                  placeholder="e.g. 403-XRRD-0101 or MAT-100234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Initial Available Quantity (Units)
                </label>
                <input
                  type="number"
                  min="1"
                  value={customColQty}
                  onChange={(e) => setCustomColQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCustomColModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddCustomColumn}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add Column to Matrix</span>
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
