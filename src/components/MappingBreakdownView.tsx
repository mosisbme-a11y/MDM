import React, { useState, useRef, useMemo } from 'react';
import { 
  Layers, 
  Map as MapIcon, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  Download, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Upload,
  AlertCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Sparkles,
  Info,
  Send,
  Mail,
  MessageCircle,
  ChevronDown,
  Building,
  Truck,
  Check,
  Share2,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  RegionBreakdownMatrixTable, 
  RegionBreakdownMatrixData, 
  RegionBreakdownRow, 
  RegionBreakdownColumn,
  DEFAULT_STAGE_3_COLUMNS,
  DEFAULT_STAGE_3_ROWS
} from './RegionBreakdownMatrixTable';
import { HealthFacilityRecord } from '../types';
import { downloadCSV } from '../utils/formatters';
import Papa from 'papaparse';
import { pushCentralMasterData } from '../utils/centralSyncService';

import { mapFacilityToHub, EPSS_HUBS_REGISTRY } from '../data/epssHubs';

interface MappingBreakdownViewProps {
  hfListItems: HealthFacilityRecord[];
  onUploadHFData?: (items: HealthFacilityRecord[], mode: 'replace' | 'append') => void;
  isAdmin?: boolean;
}

const KNOWN_ETHIOPIAN_REGIONS = [
  'addis ababa', 'oromia', 'amhara', 'tigray', 'sidama', 'snnpr', 
  'afar', 'somali', 'harari', 'dire dawa', 'gambella', 'benishangul', 
  'south ethiopia', 'central ethiopia', 'south west ethiopia', 'south west'
];

/**
 * Universal Zero-Fail Analyzer for ANY Uploaded File (Excel, CSV, Text)
 * Automatically detects or infers Facility Name, Region, Zone, Woreda, and Equipment/Quantities.
 * Preserves exact uploaded item descriptions and item codes.
 */
function processAnyFileRows(rawInput: any, hfMasterData: HealthFacilityRecord[]): {
  columns: RegionBreakdownColumn[];
  rows: RegionBreakdownRow[];
  detectedFacilityHeader: string;
  detectedRegionHeader: string;
} {
  if (!rawInput) {
    throw new Error('The uploaded file is empty or could not be read.');
  }

  // 1. Convert input to 2D array of rows (aoa)
  let aoa: any[][] = [];
  if (Array.isArray(rawInput)) {
    if (rawInput.length > 0 && Array.isArray(rawInput[0])) {
      aoa = rawInput as any[][];
    } else if (rawInput.length > 0 && typeof rawInput[0] === 'object') {
      const keys = Object.keys(rawInput[0]);
      aoa = [keys, ...rawInput.map(r => keys.map(k => r[k]))];
    }
  }

  if (aoa.length === 0) {
    throw new Error('The uploaded file contains no rows.');
  }

  // Helper to extract embedded item code e.g. "Anesthesia machine (403-XRRD-0101)" or "Bed [CODE: 401-WICU-0101]"
  const extractCodeAndName = (rawText: string, fallbackCode?: string): { name: string; code: string } => {
    const text = (rawText || '').trim();
    if (!text) return { name: 'Item', code: fallbackCode || 'CODE-01' };

    const bracketMatch = text.match(/[\(\[](?:code:\s*)?([A-Z0-9]{3,}(?:-[A-Z0-9]+)+)[\)\]]/i);
    if (bracketMatch) {
      const code = bracketMatch[1].trim();
      const name = text.replace(bracketMatch[0], '').trim().replace(/[-–—]\s*$/, '').trim();
      return { name: name || text, code };
    }

    const trailingMatch = text.match(/[-–—]\s*([A-Z0-9]{3,}(?:-[A-Z0-9]+)+)$/i);
    if (trailingMatch) {
      const code = trailingMatch[1].trim();
      const name = text.replace(trailingMatch[0], '').trim();
      return { name: name || text, code };
    }

    return { name: text, code: fallbackCode || text };
  };

  // 2. Scan first 6 rows to locate the administrative header row
  let adminHeaderRowIdx = -1;
  let regionIdx = -1;
  let zoneIdx = -1;
  let woredaIdx = -1;
  let facilityIdx = -1;
  let hubIdx = -1;
  let packagesIdx = -1;
  let detectedFacilityHeader = 'Name of health facility';
  let detectedRegionHeader = 'Region';

  for (let r = 0; r < Math.min(aoa.length, 6); r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;

    let tempRegion = -1;
    let tempZone = -1;
    let tempWoreda = -1;
    let tempFacility = -1;
    let tempHub = -1;
    let tempPackages = -1;
    let matchScore = 0;

    row.forEach((cell, cIdx) => {
      const text = String(cell || '').trim();
      if (!text) return;
      const tLower = text.toLowerCase();

      // Check Zone
      if (/^(?:zone|sub[\s_-]?city|district|administrative[\s_-]?zone)$/i.test(text) || 
          (tLower.includes('zone') && !tLower.includes('facility') && !tLower.includes('item') && !tLower.includes('material'))) {
        if (tempZone === -1) { tempZone = cIdx; matchScore += 2; }
      }
      // Check Woreda
      else if (/^(?:woreda|wereda|subdistrict|sub[\s_-]?district|town)$/i.test(text) ||
               (tLower.includes('woreda') && !tLower.includes('facility') && !tLower.includes('item') && !tLower.includes('material'))) {
        if (tempWoreda === -1) { tempWoreda = cIdx; matchScore += 2; }
      }
      // Check Region
      else if (/^(?:region|rhb|state|province)$/i.test(text) ||
               (tLower.includes('region') && !tLower.includes('facility') && !tLower.includes('item') && !tLower.includes('material'))) {
        if (tempRegion === -1) { tempRegion = cIdx; matchScore += 2; }
      }
      // Check Health Facility Name
      else if (/^(?:name\s*of\s*(?:health\s*)?facility|health\s*facility(?:\s*name)?|facility\s*name|hf\s*name|hospital(?:\s*name)?|health\s*center|customer\s*description|customer\s*name|facility|hospital|customer|clinic)$/i.test(text) ||
               ((tLower.includes('facility') || tLower.includes('hospital') || tLower.includes('hf') || tLower.includes('customer')) && !tLower.includes('item') && !tLower.includes('code') && !tLower.includes('qty'))) {
        if (tempFacility === -1) { tempFacility = cIdx; matchScore += 3; }
      }
      // Check Packages
      else if (/package|packege|list\s*of\s*pack/i.test(text)) {
        if (tempPackages === -1) { tempPackages = cIdx; }
      }
      // Check Hub / Delivering Plant
      else if (/^(?:hub|delivering[\s_-]?plant|plant)$/i.test(text)) {
        if (tempHub === -1) { tempHub = cIdx; }
      }
    });

    if (tempFacility !== -1 || (tempRegion !== -1 && tempZone !== -1) || matchScore >= 4) {
      adminHeaderRowIdx = r;
      regionIdx = tempRegion;
      zoneIdx = tempZone;
      woredaIdx = tempWoreda;
      facilityIdx = tempFacility;
      hubIdx = tempHub;
      packagesIdx = tempPackages;
      if (tempFacility !== -1) detectedFacilityHeader = String(row[tempFacility] || 'Name of health facility').trim();
      if (tempRegion !== -1) detectedRegionHeader = String(row[tempRegion] || 'Region').trim();
      break;
    }
  }

  // Fallback if not detected above
  if (adminHeaderRowIdx === -1) {
    adminHeaderRowIdx = 0;
    const row = aoa[0] || [];
    row.forEach((cell, cIdx) => {
      const text = String(cell || '').trim();
      if (!text) return;
      if (regionIdx === -1 && /region|rhb|state/i.test(text)) regionIdx = cIdx;
      if (zoneIdx === -1 && /zone|district/i.test(text)) zoneIdx = cIdx;
      if (woredaIdx === -1 && /woreda|town/i.test(text)) woredaIdx = cIdx;
      if (facilityIdx === -1 && /facility|hospital|health|customer|name/i.test(text) && !/item|material|code/i.test(text)) facilityIdx = cIdx;
      if (hubIdx === -1 && /hub|plant/i.test(text)) hubIdx = cIdx;
      if (packagesIdx === -1 && /package/i.test(text)) packagesIdx = cIdx;
    });
  }

  // If packages column not found in admin row, check previous row (row 0 in 2-tier template)
  if (packagesIdx === -1 && adminHeaderRowIdx > 0) {
    const prevRow = aoa[adminHeaderRowIdx - 1] || [];
    prevRow.forEach((cell, cIdx) => {
      if (/package|packege|list\s*of\s*pack/i.test(String(cell || ''))) {
        packagesIdx = cIdx;
      }
    });
  }

  // If facility column still not found, search for column with non-numeric strings
  if (facilityIdx === -1) {
    const row = aoa[adminHeaderRowIdx] || [];
    for (let c = 0; c < row.length; c++) {
      if (c === regionIdx || c === zoneIdx || c === woredaIdx || c === hubIdx || c === packagesIdx) continue;
      facilityIdx = c;
      break;
    }
    if (facilityIdx === -1) facilityIdx = 0;
  }

  // 3. Find Equipment Columns
  const adminColIndices = [regionIdx, zoneIdx, woredaIdx, facilityIdx, hubIdx, packagesIdx].filter(idx => idx >= 0);
  const maxRowLength = Math.max(...aoa.slice(0, 10).map(r => (Array.isArray(r) ? r.length : 0)));
  const equipmentCols: { colIdx: number; name: string; code: string }[] = [];

  for (let c = 0; c < maxRowLength; c++) {
    if (adminColIndices.includes(c)) continue;

    const cellAdminRow = String(aoa[adminHeaderRowIdx]?.[c] || '').trim();
    const cellPrevRow = adminHeaderRowIdx > 0 ? String(aoa[adminHeaderRowIdx - 1]?.[c] || '').trim() : '';

    // Ignore row indexing columns
    if (/^(?:s\/?n|no|#|index|date)$/i.test(cellAdminRow) || /^(?:s\/?n|no|#|index|date)$/i.test(cellPrevRow)) {
      continue;
    }

    let itemName = '';
    let itemCode = '';

    if (adminHeaderRowIdx > 0 && cellPrevRow && cellPrevRow !== 'List of Packeges') {
      itemName = cellPrevRow;
      itemCode = cellAdminRow || `40${equipmentCols.length + 1}-MAT`;
    } else if (cellAdminRow) {
      const parsed = extractCodeAndName(cellAdminRow, `40${equipmentCols.length + 1}-MAT`);
      itemName = parsed.name;
      itemCode = parsed.code;
    } else if (cellPrevRow && cellPrevRow !== 'List of Packeges') {
      const parsed = extractCodeAndName(cellPrevRow, `40${equipmentCols.length + 1}-MAT`);
      itemName = parsed.name;
      itemCode = parsed.code;
    }

    if (itemName || itemCode) {
      equipmentCols.push({
        colIdx: c,
        name: itemName || itemCode || `Item ${equipmentCols.length + 1}`,
        code: itemCode || `40${equipmentCols.length + 1}-MAT`
      });
    }
  }

  if (equipmentCols.length === 0) {
    equipmentCols.push({
      colIdx: maxRowLength > adminColIndices.length ? adminColIndices.length : maxRowLength,
      name: 'Allocation Quantity',
      code: 'QTY'
    });
  }

  // 4. Data Rows Starting Point
  let dataStartRowIdx = adminHeaderRowIdx + 1;
  if (dataStartRowIdx < aoa.length) {
    const checkCell = String(aoa[dataStartRowIdx]?.[facilityIdx] || '').trim();
    if (!checkCell || /^(?:40[0-9]|item|code|description)/i.test(checkCell)) {
      dataStartRowIdx++;
    }
  }

  const finalColumns: RegionBreakdownColumn[] = equipmentCols.map((col, idx) => ({
    id: `col-adhoc-${idx}`,
    name: col.name, // 100% EXACT UPLOADED ITEM NAME - NEVER ALTERED
    code: col.code
  }));

  const finalRows: RegionBreakdownRow[] = [];

  for (let r = dataStartRowIdx; r < aoa.length; r++) {
    const rowData = aoa[r];
    if (!Array.isArray(rowData) || rowData.length === 0) continue;

    const rawFacility = facilityIdx >= 0 ? String(rowData[facilityIdx] ?? '').trim() : '';
    // Skip empty lines, repeated headers, or summary rows
    if (!rawFacility || /^(?:total|grand\s*total|name\s*of\s*health\s*facility|facility|hf\s*name)$/i.test(rawFacility)) {
      continue;
    }

    // CRITICAL USER REQUIREMENT: EXACT NAME WHAT USER UPLOADS ONLY!
    const exactHFName = rawFacility;
    const exactZone = zoneIdx >= 0 ? String(rowData[zoneIdx] ?? '').trim() : '';
    const exactWoreda = woredaIdx >= 0 ? String(rowData[woredaIdx] ?? '').trim() : '';
    const exactRegion = regionIdx >= 0 ? String(rowData[regionIdx] ?? '').trim() : '';
    const exactPkg = packagesIdx >= 0 ? String(rowData[packagesIdx] ?? 'MCH').trim() : 'MCH';
    const exactHub = hubIdx >= 0 ? String(rowData[hubIdx] ?? '').trim() : '';

    // Map facility to Hub based on exact uploaded information
    const mapping = mapFacilityToHub(
      exactHFName,
      exactRegion,
      exactZone,
      exactWoreda,
      hfMasterData
    );

    const hubSymbol = (exactHub && exactHub.toUpperCase() !== 'HO01' && !exactHub.toUpperCase().includes('HEAD'))
      ? exactHub.toUpperCase()
      : ((mapping.hubCode && mapping.hubCode !== 'HO01' && !mapping.hubCode.includes('HEAD')) ? mapping.hubCode : 'AA01');

    // Extract quantities for each column
    const quantities: Record<string, number> = {};
    equipmentCols.forEach((col, cIdx) => {
      const cellVal = rowData[col.colIdx];
      quantities[`col-adhoc-${cIdx}`] = typeof cellVal === 'number' ? cellVal : (Number(cellVal) || 0);
    });

    finalRows.push({
      id: `row-up-${r}-${Date.now()}`,
      region: exactRegion || mapping.region || 'Oromia',
      zone: exactZone, // 100% EXACT NAME WHAT USER UPLOADS ONLY - NEVER OVERWRITTEN!
      woreda: exactWoreda, // 100% EXACT NAME WHAT USER UPLOADS ONLY - NEVER OVERWRITTEN!
      healthFacility: exactHFName, // 100% EXACT NAME WHAT USER UPLOADS ONLY - NEVER OVERWRITTEN!
      customerDescription: exactHFName, // 100% EXACT NAME WHAT USER UPLOADS ONLY - NEVER OVERWRITTEN!
      packages: exactPkg || 'MCH',
      hub: hubSymbol,
      quantities
    });
  }

  return {
    columns: finalColumns,
    rows: finalRows,
    detectedFacilityHeader: detectedFacilityHeader || 'Name of health facility',
    detectedRegionHeader: detectedRegionHeader || 'Region'
  };
}

export const MappingBreakdownView: React.FC<MappingBreakdownViewProps> = ({
  hfListItems,
  onUploadHFData,
  isAdmin = false
}) => {
  const [matrixData, setMatrixData] = useState<RegionBreakdownMatrixData | undefined>(undefined);
  const [adHocDataActive, setAdHocDataActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isHubMapped, setIsHubMapped] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [isHubSubmitDropdownOpen, setIsHubSubmitDropdownOpen] = useState(false);
  const [isHubTransmitModalOpen, setIsHubTransmitModalOpen] = useState(false);
  const [isHubEmailModalOpen, setIsHubEmailModalOpen] = useState(false);
  const [isHubWhatsAppModalOpen, setIsHubWhatsAppModalOpen] = useState(false);
  const [transmittalRef, setTransmittalRef] = useState(`EPSS/HUB-DISPATCH/2026/${Math.floor(1000 + Math.random() * 9000)}`);
  const [signatoryName, setSignatoryName] = useState('Dr. Kassahun M.');
  const [signatoryRole, setSignatoryRole] = useState('EPSS Medical Devices Directorate Director');
  const [signatoryOrg, setSignatoryOrg] = useState('EPSS Head Office - Distribution Directorate');
  const [selectedHubTarget, setSelectedHubTarget] = useState<'all' | string>('all');
  const [uploadFeedback, setUploadFeedback] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentRows = matrixData
    ? matrixData.rows
    : DEFAULT_STAGE_3_ROWS;

  const currentCols = (matrixData && matrixData.columns && matrixData.columns.length > 0)
    ? matrixData.columns
    : DEFAULT_STAGE_3_COLUMNS;

  // Hub distribution breakdown
  const hubAllocations = useMemo(() => {
    const map: Record<string, { hubCode: string; name: string; region: string; facilitiesCount: number; unitsCount: number; manager?: string }> = {};
    
    currentRows.forEach(row => {
      const hubCode = row.hub || 'AA01';
      if (!map[hubCode]) {
        const hubInfo = EPSS_HUBS_REGISTRY.find(h => h.code === hubCode);
        map[hubCode] = {
          hubCode,
          name: hubInfo?.name || hubCode,
          region: hubInfo?.region || row.region || 'Regional Hub',
          facilitiesCount: 0,
          unitsCount: 0,
          manager: hubInfo?.manager
        };
      }
      map[hubCode].facilitiesCount += 1;
      currentCols.forEach(col => {
        map[hubCode].unitsCount += Number(row.quantities[col.id]) || 0;
      });
    });

    return Object.values(map).sort((a, b) => b.unitsCount - a.unitsCount);
  }, [currentRows, currentCols]);

  const uniqueHubsCount = hubAllocations.length;
  const totalAllocatedUnits = currentRows.reduce((sum, r) => {
    return sum + currentCols.reduce((cSum, c) => cSum + (Number(r.quantities[c.id]) || 0), 0);
  }, 0);

  const stats = useMemo(() => {
    const total = hfListItems.length;
    const mapped = hfListItems.filter(hf => hf.region && hf.region.trim() !== '').length;
    const missing = total - mapped;
    return { total, mapped, missing };
  }, [hfListItems]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleMapWithHubs = () => {
    setIsAnalyzing(true);
    setUploadFeedback({ message: 'Analyzing facilities and mapping to official regional EPSS hub symbols...', type: 'info' });
    
    setTimeout(() => {
      const baseRows = matrixData
        ? matrixData.rows
        : DEFAULT_STAGE_3_ROWS;

      if (baseRows.length === 0) {
        setIsAnalyzing(false);
        setUploadFeedback({
          message: 'All data is cleared (0 facilities). Please upload an Excel/CSV file or add facility rows before clicking "Map HF to HUB".',
          type: 'error'
        });
        return;
      }

      const baseCols = (matrixData && matrixData.columns && matrixData.columns.length > 0)
        ? matrixData.columns
        : DEFAULT_STAGE_3_COLUMNS;

      const updatedRows = baseRows.map(row => {
        const mapping = mapFacilityToHub(
          row.healthFacility || row.customerDescription || '',
          row.region || '',
          row.zone || '',
          row.woreda || '',
          hfListItems
        );
        
        // Pure Hub symbol (e.g. AA01, AD01, DI01) - excluding HO01
        const hubSymbol = (mapping.hubCode && mapping.hubCode !== 'HO01' && !mapping.hubCode.includes('HEAD'))
          ? mapping.hubCode
          : 'AA01';

        return {
          ...row,
          // CRITICAL: KEEP 100% EXACT UPLOADED NAMES - NEVER ALTER OR OVERWRITE HF NAME, WOREDA, OR ZONE!
          healthFacility: row.healthFacility || row.customerDescription || 'Health Facility',
          customerDescription: row.customerDescription || row.healthFacility || 'Health Facility',
          zone: row.zone || '', // KEEP EXACT UPLOADED ZONE ONLY
          woreda: row.woreda || '', // KEEP EXACT UPLOADED WOREDA ONLY
          region: row.region || '', // KEEP EXACT UPLOADED REGION
          hub: hubSymbol // ONLY assign / update the Hub symbol!
        };
      });
      
      setMatrixData({
        date: matrixData?.date || new Date().toISOString().split('T')[0],
        region: matrixData?.region || 'Mapped Matrix',
        columns: baseCols, // PRESERVE 100% EXACT ITEM COLUMNS AND CODES
        rows: updatedRows
      });

      setIsHubMapped(true); // AUTO INSERT HUB COLUMN UPON MAPPING

      if (hfListItems && hfListItems.length > 0 && onUploadHFData) {
        const updatedMaster = hfListItems.map(hf => {
          const mapping = mapFacilityToHub(
            hf.customerDescription,
            hf.region,
            hf.zoneDescription,
            hf.woredaDescription,
            hfListItems
          );
          const hubSymbol = (mapping.hubCode && mapping.hubCode !== 'HO01' && !mapping.hubCode.includes('HEAD'))
            ? mapping.hubCode
            : 'AA01';
          return {
            ...hf,
            zoneDescription: hf.zoneDescription || '',
            woredaDescription: hf.woredaDescription || '',
            hub: hubSymbol
          };
        });
        onUploadHFData(updatedMaster, 'replace');
      }

      setUploadFeedback({ 
        message: `✓ Mapping complete: ${updatedRows.length} facilities successfully mapped to EPSS Hubs. Exact uploaded HF Name, Woreda, and Zone are 100% preserved. Download Option (.xlsx / .csv) is ready in the header!`, 
        type: 'success' 
      });
      setIsAnalyzing(false);
    }, 600);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback({ message: `Reading and analyzing file "${file.name}"...`, type: 'info' });

    const processUniversal = (rawData: any) => {
      try {
        if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
          setUploadFeedback({ message: 'The uploaded file is empty.', type: 'error' });
          setIsUploading(false);
          return;
        }

        const parsedResult = processAnyFileRows(rawData, hfListItems);

        setMatrixData({
          date: new Date().toISOString().split('T')[0],
          region: 'Uploaded File Matrix',
          columns: parsedResult.columns,
          rows: parsedResult.rows
        });

        setAdHocDataActive(true);
        setIsHubMapped(false); // Reset mapped hub flag on new file upload until "MAP HF TO HUB" is clicked
        setUploadFeedback({ 
          message: `✓ Analysis complete for "${file.name}". Processed ${parsedResult.rows.length} facilities with exact uploaded HF Name, Woreda, and Zone preserved. Click "MAP HF TO HUB" to map all facilities to designated EPSS Hubs!`, 
          type: 'success' 
        });

      } catch (err: any) {
        console.error('Error in file analysis:', err);
        setUploadFeedback({ message: `Failed to process file: ${err.message || 'Unknown format'}`, type: 'error' });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            processUniversal(results.data as any[][]);
          } else {
            setUploadFeedback({ message: 'Could not read CSV data rows.', type: 'error' });
            setIsUploading(false);
          }
        },
        error: (err) => {
          setUploadFeedback({ message: `CSV parsing error: ${err.message}`, type: 'error' });
          setIsUploading(false);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

          processUniversal(aoa);
        } catch (err: any) {
          console.error('Error reading workbook:', err);
          setUploadFeedback({ message: 'Failed to parse file. Please verify it is a valid spreadsheet or CSV.', type: 'error' });
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleClearAllData = () => {
    setMatrixData({
      date: new Date().toISOString().split('T')[0],
      region: 'Cleared Workspace',
      columns: DEFAULT_STAGE_3_COLUMNS,
      rows: []
    });
    setAdHocDataActive(false);
    setIsHubMapped(false);
    setIsDownloadDropdownOpen(false);
    setIsHubSubmitDropdownOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadFeedback({
      message: '✓ All Clear complete: All matrix rows, uploaded records, and hub mappings have been cleared. You can now upload fresh data and map cleanly.',
      type: 'info'
    });
  };

  const handleResetToMaster = () => {
    setMatrixData(undefined);
    setAdHocDataActive(false);
    setIsHubMapped(false);
    setUploadFeedback({ message: 'Reset to System Master Health Facility records.', type: 'info' });
  };

  const handleDownloadMismatched = () => {
    const mismatched = hfListItems.filter(hf => !hf.region || hf.region.trim() === '');
    if (mismatched.length === 0) {
      setUploadFeedback({ message: 'No mismatched mappings found. All facilities have regional assignments.', type: 'success' });
      return;
    }
    
    const exportData = mismatched.map(hf => ({
      'Customer ID': hf.customer,
      'Facility Name': hf.customerDescription,
      'Current Region': hf.region || '',
      'Status': 'Missing Mapping',
      'Last Uploaded': hf.uploadedAt || 'N/A'
    }));
    
    downloadCSV(`Mismatched_Mappings_${new Date().toISOString().split('T')[0]}.csv`, exportData);
    setUploadFeedback({ message: `Exported ${mismatched.length} facilities with missing regional mappings.`, type: 'success' });
  };

  const handleDownloadHubAllocationList = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (currentRows.length === 0) {
      setUploadFeedback({ message: 'No facility data available to export. Upload or add facilities first.', type: 'error' });
      return;
    }
    const currentDateStr = new Date().toISOString().split('T')[0];
    const exportRows = currentRows.map((r, idx) => {
      const hubCode = r.hub || 'AA01';
      const hubInfo = EPSS_HUBS_REGISTRY.find(h => h.code === hubCode);
      const totalUnits = currentCols.reduce((sum, c) => sum + (Number(r.quantities[c.id]) || 0), 0);
      return {
        'S/N': idx + 1,
        'Region': r.region || '',
        'Zone': r.zone || '',
        'Woreda': r.woreda || '',
        'Health Facility Name': r.healthFacility || r.customerDescription || '',
        'Package': r.packages || 'MCH',
        'Delivering Hub Code': hubCode,
        'Delivering Hub Name': hubInfo?.name || hubCode,
        'Hub Regional Area': hubInfo?.region || r.region || '',
        'Total Allocated Items': totalUnits
      };
    });

    if (format === 'csv') {
      downloadCSV(`EPSS_Facility_to_Hub_Mapping_${currentDateStr}.csv`, exportRows);
      setUploadFeedback({ message: `✓ Exported facility to Hub mapping directory CSV (${exportRows.length} facilities).`, type: 'success' });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 40 },
      { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HF to Hub Mapping');
    XLSX.writeFile(wb, `EPSS_Facility_to_Hub_Mapping_${currentDateStr}.xlsx`);
    setUploadFeedback({ message: `✓ Exported official Facility to Hub mapping directory Excel (.xlsx) with ${exportRows.length} facilities!`, type: 'success' });
  };

  const handleDownloadMappedData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const activeCols = (matrixData && matrixData.columns && matrixData.columns.length > 0)
      ? matrixData.columns
      : DEFAULT_STAGE_3_COLUMNS;
    const activeRows = matrixData
      ? matrixData.rows
      : DEFAULT_STAGE_3_ROWS;

    if (activeRows.length === 0) {
      setUploadFeedback({ message: 'No facility data available to export. Upload or add facilities first.', type: 'error' });
      return;
    }

    const currentDateStr = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const aoa: any[][] = [];
      aoa.push(['Date', currentDateStr]);
      aoa.push([
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
        'List of Packeges',
        ...(isHubMapped ? ['HUB'] : []),
        ...activeCols.map(c => c.name) // EXACT item names as uploaded - NEVER altered
      ]);
      aoa.push([
        '',
        '',
        '',
        '',
        'List of Packeges',
        ...(isHubMapped ? ['HUB'] : []),
        ...activeCols.map(c => c.code)
      ]);

      activeRows.forEach(r => {
        aoa.push([
          r.region,
          r.zone,
          r.woreda,
          r.healthFacility || r.customerDescription,
          r.packages || 'MCH',
          ...(isHubMapped ? [r.hub || 'AA01'] : []),
          ...activeCols.map(c => {
            const val = r.quantities[c.id];
            return val === undefined || val === null ? 0 : val;
          })
        ]);
      });

      // Total summary row
      aoa.push([
        'TOTAL',
        '',
        '',
        `${activeRows.length} Facilities`,
        '',
        ...(isHubMapped ? [''] : []),
        ...activeCols.map(c => activeRows.reduce((sum, r) => sum + (Number(r.quantities[c.id]) || 0), 0))
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 38 }, { wch: 16 },
        ...(isHubMapped ? [{ wch: 12 }] : []),
        ...activeCols.map(() => ({ wch: 22 }))
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mapped Breakdown Matrix');
      XLSX.writeFile(wb, `Mapped_Breakdown_Matrix_${currentDateStr}.xlsx`);
      setUploadFeedback({ message: `✓ Exported complete Excel file (.xlsx) with ${activeRows.length} facilities${isHubMapped ? ', auto-inserted HUBs' : ''}, and ${activeCols.length} exact equipment columns.`, type: 'success' });
    } else {
      // CSV format
      const exportData = activeRows.map(row => {
        const entry: any = {
          'Region': row.region,
          'Zone': row.zone,
          'Woreda': row.woreda,
          'Name of health facility': row.healthFacility || row.customerDescription,
          'List of Packages': row.packages || 'MCH'
        };
        if (isHubMapped) {
          entry['HUB'] = row.hub || 'AA01';
        }
        activeCols.forEach(col => {
          entry[col.name] = row.quantities[col.id] !== undefined ? row.quantities[col.id] : 0;
        });
        return entry;
      });

      downloadCSV(`Mapped_Breakdown_Matrix_${currentDateStr}.csv`, exportData);
      setUploadFeedback({ message: `✓ Exported complete CSV with ${activeRows.length} facilities${isHubMapped ? ', auto-inserted HUBs' : ''}, and ${activeCols.length} exact equipment columns.`, type: 'success' });
    }
  };

  const handleDownloadItemAggregationTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const headersRow1 = [
      'Hub',
      'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult',
      'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
    ];
    const headersRow2 = [
      '',
      '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
    ];

    const hubRows = [
      ['AA01', 6, 6, 2, 2, 2, 2],
      ['AD01', 2, 2, 2, 2, 2, 2],
      ['DI01', 2, 2, 2, 2, 2, 2],
      ['BD01', 2, 2, 2, 2, 2, 2],
      ['HW01', 2, 2, 2, 2, 2, 2],
      ['DD01', 2, 2, 2, 2, 2, 2]
    ];

    if (format === 'csv') {
      const csvData = [
        headersRow1,
        headersRow2,
        ...hubRows
      ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Item_Aggregation_By_Hub_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setUploadFeedback({ message: '✓ Downloaded Item Aggregation CSV template matching Hub layout!', type: 'success' });
      return;
    }

    const aoa = [
      headersRow1,
      headersRow2,
      ...hubRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 32 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Aggregation');
    XLSX.writeFile(wb, `Item_Aggregation_By_Hub_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`);
    setUploadFeedback({ message: '✓ Downloaded Item Aggregation Excel (.xlsx) template matching Hub layout!', type: 'success' });
  };

  const handleDownloadExactTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const headersRow1 = [
      '', '', '', '', 'List of Packeges',
      'Anesthesia machine - with Patient mon', 'Bed - Patient, Fowler, Adult',
      'Bowel - With Stand, Stainless Steel.', 'Cold box', 'Couch - Delivery', 'Couch - Examination'
    ];
    const headersRow2 = [
      'Region', 'Zone', 'Woreda', 'Name of health facility', '',
      '403-XRRD-0101', '403-XRRD-0101', '403-XRRB-0101N', '403-XRRD-0101-001', '401-WICU-0101N', '401-WICU-0101N'
    ];

    let facilityRows: any[][] = [];

    if (hfListItems && hfListItems.length > 0) {
      facilityRows = hfListItems.map(hf => [
        hf.region || 'Oromia',
        hf.zoneDescription || hf.zoneCode || 'East Shewa',
        hf.woredaDescription || hf.woreda || 'Woreda 01',
        hf.customerDescription || hf.customer,
        'MCH',
        2, 2, 2, 2, 2, 2
      ]);
    } else {
      facilityRows = [
        ['Addis Ababa', 'Addis Ketema', 'Woreda 01', 'Tikur Anbessa Specialized Hospital', 'MCH', 2, 2, 2, 2, 2, 2],
        ['Oromia', 'East Shewa', 'Woreda 01', 'Adama Hospital Medical College', 'MCH', 2, 2, 2, 2, 2, 2],
        ['Dire Dawa', 'Dire Dawa Administration', 'Woreda 01', 'Dire Dawa Dil Chora Hospital', 'MCH', 2, 2, 2, 2, 2, 2],
        ['Amhara', 'West Gojjam', 'Bahir Dar', 'Felege Hiwot Comprehensive Specialized Hospital', 'MCH', 2, 2, 2, 2, 2, 2],
        ['Tigray', 'Mekelle', 'Mekelle', 'Ayder Comprehensive Specialized Hospital', 'MCH', 2, 2, 2, 2, 2, 2],
        ['Sidama', 'Hawassa', 'Hawassa', 'Hawassa University Comprehensive Specialized Hospital', 'MCH', 2, 2, 2, 2, 2, 2]
      ];
    }

    if (format === 'csv') {
      const csvData = [
        headersRow1,
        headersRow2,
        ...facilityRows
      ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Health_Facility_Allocation_Matrix_Template_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setUploadFeedback({ message: `✓ Downloaded Health Facility Allocation Matrix CSV template with ${facilityRows.length} facilities!`, type: 'success' });
      return;
    }

    const aoa = [
      headersRow1,
      headersRow2,
      ...facilityRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 42 }, { wch: 12 },
      { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HF Allocation Matrix');
    XLSX.writeFile(wb, `Health_Facility_Allocation_Matrix_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
    setUploadFeedback({ message: `✓ Downloaded Health Facility Allocation Matrix Excel (.xlsx) template with ${facilityRows.length} facilities!`, type: 'success' });
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'item-agg' | 'hf-matrix'>('item-agg');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-cyan-500/30">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <MapIcon size={160} />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/20 backdrop-blur-md rounded-2xl border border-cyan-400/30 text-cyan-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 flex-wrap">
                  <span>Mapping Breakdown System</span>
                  {isHubMapped && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-400/50 flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      HUBs Mapped & Ready for Download
                    </span>
                  )}
                </h2>
                <p className="text-cyan-100/80 text-xs sm:text-sm font-medium max-w-2xl mt-0.5">
                  Analyze health facility distribution, map hubs, and generate/upload standard EPSS breakdown matrix templates.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />

            <button
              type="button"
              onClick={handleClearAllData}
              disabled={isAnalyzing || isUploading || currentRows.length === 0}
              className={`px-4 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-lg transition-all transform active:scale-95 border tracking-wider uppercase flex items-center gap-2 ${
                currentRows.length === 0
                  ? 'bg-slate-800/50 border-slate-700/60 text-slate-500 cursor-not-allowed'
                  : 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/70 text-white cursor-pointer'
              }`}
              title="Clear all matrix data and previous uploads before mapping"
            >
              <Trash2 className="w-4 h-4" />
              <span>All Clear</span>
            </button>

            <button
              type="button"
              onClick={handleMapWithHubs}
              disabled={isAnalyzing}
              className={`px-5 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-xl transition-all transform active:scale-95 border cursor-pointer tracking-wider uppercase flex items-center gap-2 ${
                isHubMapped 
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-400 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-400 text-white'
              }`}
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapIcon className="w-4 h-4" />}
              <span>{isHubMapped ? 'Re-Map HF to HUB' : 'Map HF to HUB'}</span>
            </button>

            {/* Direct Download Option - prominently available and highlighted after MAP HF to Hub */}
            <div className="relative">
              {isHubMapped ? (
                <>
                  <div className="flex items-center rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-xl border border-emerald-300 text-slate-950 font-black transition-all transform active:scale-95 group">
                    <button
                      type="button"
                      onClick={() => handleDownloadMappedData('xlsx')}
                      className="px-4 py-2.5 text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2 cursor-pointer font-black text-slate-950 hover:text-black transition rounded-l-full"
                      title="Download complete mapped health facility to hub matrix as Microsoft Excel (.xlsx)"
                    >
                      <Download className="w-4 h-4 text-slate-950" />
                      <span>Download Mapped Data (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                      className="px-3 py-2.5 border-l border-emerald-600/40 hover:bg-emerald-600 text-slate-950 cursor-pointer rounded-r-full transition flex items-center justify-center"
                      title="Choose download format (.xlsx or .csv)"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isDownloadDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsDownloadDropdownOpen(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-84 bg-[#0a0f1d] border-2 border-emerald-400/80 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 text-slate-100">
                        <div className="px-3 py-2 border-b border-slate-800">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                            Download Mapped Hub Data Options
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Official EPSS matrix with auto-inserted HUB delivering plants
                          </span>
                        </div>
                        <div className="p-1 space-y-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadMappedData('xlsx');
                              setIsDownloadDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-500/20 text-left transition group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                                <FileSpreadsheet className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white group-hover:text-emerald-300">1. Full Breakdown Matrix (.xlsx)</p>
                                <p className="text-[10px] text-slate-400">Multi-tier equipment header, HUB column & totals</p>
                              </div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadHubAllocationList('xlsx');
                              setIsDownloadDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-teal-500/20 text-left transition group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white group-hover:text-teal-300">2. HF to Hub Directory (.xlsx)</p>
                                <p className="text-[10px] text-slate-400">Clean list of facilities & designated EPSS Hubs</p>
                              </div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadMappedData('csv');
                              setIsDownloadDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-cyan-500/20 text-left transition group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white group-hover:text-cyan-300">3. Standard CSV Matrix (.csv)</p>
                                <p className="text-[10px] text-slate-400">Comma-separated matrix with HUB column</p>
                              </div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadItemAggregationTemplate('xlsx');
                              setIsDownloadDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-500/20 text-left transition group cursor-pointer border-t border-slate-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                                <Building className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white group-hover:text-amber-300">4. Hub Item Aggregation Matrix (.xlsx)</p>
                                <p className="text-[10px] text-slate-400">Aggregated quantities per delivering Hub</p>
                              </div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMapWithHubs()}
                  className="px-4 py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-600/70 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition shadow-md"
                  title="Click to Map HF to HUB first to enable Mapped Matrix download"
                >
                  <Download size={15} className="text-slate-400" />
                  <span>Download Option</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                    Map First
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs sm:text-sm transition shadow-lg cursor-pointer flex items-center gap-2 border border-cyan-400/40"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload size={15} />}
              <span>Upload File</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="px-4 py-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition shadow cursor-pointer flex items-center gap-2 border border-slate-600"
            >
              <FileSpreadsheet size={15} />
              <span>Templates</span>
            </button>

            {/* SUBMIT BREAKDOWN FOR HUB/BRANCHES Pill Button matching user specification */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHubSubmitDropdownOpen(!isHubSubmitDropdownOpen)}
                className="flex items-center gap-3 px-6 py-3 bg-[#0a0f1d] hover:bg-black text-white rounded-full font-black text-sm shadow-2xl hover:shadow-emerald-900/40 transition-all transform active:scale-95 border border-slate-700/80 cursor-pointer tracking-wider uppercase group"
                title="Submit official breakdown matrix to EPSS Hubs and Branches for distribution execution"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)] animate-pulse shrink-0" />
                <span className="tracking-widest font-black text-white group-hover:text-emerald-300 transition-colors">
                  SUBMIT BREAKDOWN FOR HUB/BRANCHES
                </span>
                <span className="w-6 h-6 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-inner shrink-0 ml-1">
                  3
                </span>
                <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform ${isHubSubmitDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Hub Submission Channels Dropdown Menu */}
              {isHubSubmitDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0a0f1d] border-2 border-emerald-400/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                      Select Hub / Branch Submission Channel:
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Official dispatch routes for EPSS Hubs & Delivering Branches
                    </span>
                  </div>

                  <div className="space-y-1 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHubSubmitDropdownOpen(false);
                        setIsHubTransmitModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-emerald-300">1. Direct System Transmittal</div>
                        <div className="text-[10px] text-slate-400">Digital dispatch manifest to {uniqueHubsCount || 20} Hubs/Branches</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHubSubmitDropdownOpen(false);
                        setIsHubEmailModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                    >
                      <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-cyan-300">2. Send via Email to Hub Managers</div>
                        <div className="text-[10px] text-slate-400">Targeting hubs-dispatch@epss.gov.et & branches</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHubSubmitDropdownOpen(false);
                        setIsHubWhatsAppModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-emerald-300">3. Send via WhatsApp Hub Desk</div>
                        <div className="text-[10px] text-slate-400">Regional hub coordinators & branch logistics</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHubSubmitDropdownOpen(false);
                        handleDownloadMappedData('xlsx');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition cursor-pointer text-xs group border-t border-slate-800 mt-1"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-amber-300">4. Export Hubs Allocation Matrix</div>
                        <div className="text-[10px] text-slate-400">Excel (.xlsx) with HUB delivering plants</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {uploadFeedback && (
          <div className={`mt-4 p-3 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
            uploadFeedback.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-white' : 
            uploadFeedback.type === 'info' ? 'bg-cyan-500/20 border border-cyan-500/40 text-white' : 
            'bg-rose-500/20 border border-rose-500/40 text-white'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
              {uploadFeedback.type === 'success' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
              <span>{uploadFeedback.message}</span>
            </div>
            <button onClick={() => setUploadFeedback(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}
      </div>



      {/* Main Breakdown Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <RegionBreakdownMatrixTable
          data={matrixData}
          onUpdateData={(updated) => setMatrixData(updated)}
          isEditable={true}
          title="EPSS Health Facility Breakdown to Hubs/Branches Matrix"
          subtitle="Official Health Facility breakdown showing delivering plants (Hubs/Branches) and allocated medical devices"
          hfListItems={hfListItems}
          showHubColumn={true}
          isHubMappedInitially={true}
          onOpenUploadModal={() => fileInputRef.current?.click()}
        />
      </div>

      {/* MODAL 1: TRANSMIT BREAKDOWN TO EPSS HUBS & BRANCHES */}
      {isHubTransmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <span>Submit Breakdown to Hubs & Branches</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      Direct Transmittal
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official transmittal authorizing delivering plant warehouses to receive & dispatch equipment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHubTransmitModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Target Recipients</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{uniqueHubsCount} Regional Hubs</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Delivering Plants Active</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Health Facilities</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{currentRows.length} Facilities</div>
                  <div className="text-[10px] text-slate-500">Mapped with catchment hubs</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Equipment Quantity</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{totalAllocatedUnits.toLocaleString()} Units</div>
                  <div className="text-[10px] text-slate-500">{currentCols.length} Device Types</div>
                </div>
              </div>

              {/* Hub Allocations Summary List */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Allocations by Delivering Hub / Branch:</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{hubAllocations.length} Hubs assigned</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pt-1">
                  {hubAllocations.map(hub => (
                    <div key={hub.hubCode} className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-yellow-300 text-slate-950 font-mono">
                          {hub.hubCode}
                        </span>
                        <span className="font-black text-xs text-emerald-700">
                          {hub.unitsCount} <span className="text-[9px] text-slate-400 font-normal">units</span>
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 truncate mt-1">{hub.name}</div>
                      <div className="text-[9px] text-slate-400">{hub.facilitiesCount} facilities</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transmittal Metadata */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-[11px] font-black text-slate-900 uppercase">Official Transmittal & Signatory Authority</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Transmittal Ref *</label>
                    <input 
                      type="text"
                      value={transmittalRef}
                      onChange={(e) => setTransmittalRef(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Authorized Dispatcher *</label>
                    <input 
                      type="text"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Official Role *</label>
                    <input 
                      type="text"
                      value={signatoryRole}
                      onChange={(e) => setSignatoryRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsHubTransmitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await pushCentralMasterData({
                      dspReceivedMohRows: currentRows,
                      updatedBy: `${signatoryName} (${signatoryRole})`,
                      updateKind: `Transmitted Breakdown to ${uniqueHubsCount} EPSS Hubs & Branches (${currentRows.length} Facilities, ${totalAllocatedUnits} Units)`
                    });
                  } catch (e) {
                    console.warn(e);
                  }
                  handleDownloadMappedData('xlsx');
                  setIsHubTransmitModalOpen(false);
                  setUploadFeedback({
                    message: `✓ Breakdown successfully submitted to ${uniqueHubsCount} EPSS Hubs & Branches under Transmittal Ref #${transmittalRef}. Branch dispatch manifests generated.`,
                    type: 'success'
                  });
                }}
                className="px-6 py-2.5 rounded-xl font-black transition cursor-pointer flex items-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 text-xs"
              >
                <Send className="w-4 h-4" />
                <span>Confirm & Dispatch to {uniqueHubsCount || 20} Hubs/Branches</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND BREAKDOWN VIA EMAIL TO HUB MANAGERS */}
      {isHubEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-200">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Send Breakdown Email to Hub Managers</h3>
                  <p className="text-[11px] text-slate-400">Official dispatch payload to EPSS Regional Hub & Branch Logistics Teams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHubEmailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">To (Hub Distribution Logistics Desk)</label>
                <input
                  type="text"
                  readOnly
                  value="hubs-dispatch@epss.gov.et, aa01@epss.gov.et, ad01@epss.gov.et, bd01@epss.gov.et, di01@epss.gov.et, hw01@epss.gov.et"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Subject</label>
                <input
                  type="text"
                  readOnly
                  value={`Official EPSS Health Facility Allocation Matrix for Regional Hubs & Branches - ${new Date().toISOString().split('T')[0]}`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Payload Summary Preview</label>
                <textarea
                  rows={4}
                  readOnly
                  value={`EPSS Health Facility Breakdown Matrix for Regional Hubs & Branches\nDate: ${new Date().toISOString().split('T')[0]}\nTotal Delivering Hubs: ${uniqueHubsCount} Plants\nTotal Health Facilities: ${currentRows.length}\nTotal Equipment: ${totalAllocatedUnits} Units\nStatus: Approved for Receiving & Branch Dispatch`}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 flex items-center justify-between text-cyan-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
                  <div>
                    <div className="font-bold text-xs">EPSS_Hub_Branch_Allocation_Matrix_${new Date().toISOString().split('T')[0]}.xlsx</div>
                    <div className="text-[10px] text-cyan-700">Official Matrix with Delivering Plant (HUB) Column</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadMappedData('xlsx')}
                  className="px-2.5 py-1 bg-white hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Download
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsHubEmailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHubEmailModalOpen(false);
                  handleDownloadMappedData('xlsx');
                  const subject = encodeURIComponent(`Official EPSS Health Facility Allocation Matrix for Regional Hubs & Branches`);
                  const body = encodeURIComponent(`Dear EPSS Hub & Branch Logistics Teams,\n\nPlease find attached the official Health Facility Breakdown & Allocation Matrix for regional warehouse dispatch and facility delivery.\nTotal Facilities: ${currentRows.length}\nTotal Equipment Units: ${totalAllocatedUnits}\nDate: ${new Date().toISOString().split('T')[0]}\n\nBest regards,\nEPSS Medical Device Directorate`);
                  window.location.href = `mailto:hubs-dispatch@epss.gov.et?subject=${subject}&body=${body}`;
                  setUploadFeedback({
                    message: '📧 Opened email client targeting EPSS Hub Managers & downloaded matrix Excel file.',
                    type: 'success'
                  });
                }}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span>Open Email Client & Download Matrix</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND BREAKDOWN VIA WHATSAPP HUB OPERATIONS DESK */}
      {isHubWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Hub Logistics WhatsApp Dispatch Desk</h3>
                  <p className="text-[11px] text-slate-400">Broadcast breakdown transmittal to EPSS Regional Hub Coordinators</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHubWhatsAppModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Dispatch Broadcast Message</label>
                <textarea
                  rows={6}
                  readOnly
                  value={`*EPSS HEALTH FACILITY BREAKDOWN DISPATCH TO HUBS & BRANCHES*\nDate: ${new Date().toISOString().split('T')[0]}\nStatus: Official Allocation Matrix Ready for Branch Receiving & Dispatch\nDelivering Hubs: Regional Hub Network (${uniqueHubsCount} Hubs)\nTotal Facilities: ${currentRows.length}\nTotal Units: ${totalAllocatedUnits} Units\nDispatch Authority: EPSS Medical Device Directorate\nAttached File: EPSS_Hub_Branch_Allocation_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Transmittal payload prepared for Regional Hub Coordinators</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Clicking below will launch WhatsApp Web and automatically download the complete Excel allocation matrix.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsHubWhatsAppModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHubWhatsAppModalOpen(false);
                  handleDownloadMappedData('xlsx');
                  const msg = `*EPSS HEALTH FACILITY BREAKDOWN DISPATCH TO HUBS & BRANCHES*\nDate: ${new Date().toISOString().split('T')[0]}\nStatus: Official Allocation Matrix Ready for Branch Receiving & Dispatch\nDelivering Hubs: Regional Hub Network (${uniqueHubsCount} Hubs)\nTotal Facilities: ${currentRows.length}\nTotal Units: ${totalAllocatedUnits} Units\nDispatch Authority: EPSS Medical Device Directorate`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  setUploadFeedback({
                    message: '💬 Launched Hub WhatsApp dispatch desk & downloaded breakdown matrix Excel file.',
                    type: 'success'
                  });
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Launch WhatsApp Desk & Download Matrix</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Matrix Template Preview & Download Modal matching {94FE6776-C928-45B7-9B5E-5EABF286140A}.png */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full p-6 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl border border-amber-200">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <span>Equipment Breakdown Matrix Template</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-mono font-bold">
                      Standard EPSS Format
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official 2-tier matrix structure with item codes, package designations, and highlighted Hub column
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Selector in Modal */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveTemplateTab('item-agg')}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
                  activeTemplateTab === 'item-agg'
                    ? 'bg-slate-900 text-white border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
                <span>Item Aggregation Template (by Hub)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTemplateTab('hf-matrix')}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
                  activeTemplateTab === 'hf-matrix'
                    ? 'bg-slate-900 text-white border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Health Facility Allocation Matrix Template</span>
              </button>
            </div>

            {/* Visual Table Preview Matching Screenshot _9598E1A0-64C7-499C-AB8E-E07C5E3430AB__68d203a0.png or {94FE6776-C928-45B7-9B5E-5EABF286140A}.png */}
            {activeTemplateTab === 'item-agg' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Item Aggregation Layout (by EPSS Distribution Hub):</span>
                  <span className="text-[11px] font-mono text-slate-500">Hub column + Equipment columns with catalog codes</span>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-inner bg-slate-50 max-h-80">
                  <table className="w-full text-left text-xs border-collapse font-sans min-w-[700px]">
                    <thead>
                      {/* Header Row 1 */}
                      <tr className="border-b border-slate-300">
                        <th className="p-2.5 bg-yellow-300 text-slate-950 font-black border-r border-slate-300 min-w-[90px]">⬡</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Anesthesia machine - with Patient mon</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bed - Patient, Fowler, Adult</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bowel - With Stand, Stainless Steel.</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Cold box</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Couch - Delivery</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold">Couch - Examination</th>
                      </tr>

                      {/* Header Row 2 (Material Codes) */}
                      <tr className="border-b border-slate-300 bg-white font-mono text-[11px] text-slate-700">
                        <td className="p-2 border-r border-slate-300 bg-yellow-100 font-bold text-yellow-950">⬡</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRB-0101N</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101-001</td>
                        <td className="p-2 border-r border-slate-300 font-bold">401-WICU-0101N</td>
                        <td className="p-2 font-bold">401-WICU-0101N</td>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                      <tr>
                        <td className="p-2 border-r border-slate-200 font-black bg-yellow-300 text-slate-950">AA01</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">6</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">6</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 text-right font-bold pr-6">2</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200 font-black bg-yellow-300 text-slate-950">AD01</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 text-right font-bold pr-6">2</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200 font-black bg-yellow-300 text-slate-950">DI01</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold pr-6">2</td>
                        <td className="p-2 text-right font-bold pr-6">2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Health Facility Allocation Layout:</span>
                  <span className="text-[11px] font-mono text-slate-500">6 Equipment Columns & 6 Location Attributes</span>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-inner bg-slate-50 max-h-80">
                  <table className="w-full text-left text-xs border-collapse font-sans min-w-[900px]">
                    <thead>
                      {/* Header Row 1 */}
                      <tr className="border-b border-slate-300">
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold italic border-r border-slate-300">Region</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold italic border-r border-slate-300">Zone</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold italic border-r border-slate-300">Woreda</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold italic border-r border-slate-300">Name of health facility</th>
                        <th className="p-2.5 bg-[#dbeafe] text-slate-900 font-semibold italic border-r border-slate-300 text-center">List of Packeges</th>
                        <th className="p-2.5 bg-[#ffff00] text-slate-950 font-black italic border-r border-slate-300 text-center uppercase tracking-wider">Plant</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Anesthesia machine - with Patient mon</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bed - Patient, Fowler, Adult</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bowel - With Stand, Stainless Steel.</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Cold box</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Couch - Delivery</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold">Couch - Examination</th>
                      </tr>

                      {/* Header Row 2 (Material Codes) */}
                      <tr className="border-b border-slate-300 bg-white font-mono text-[11px] text-slate-700">
                        <td className="p-2 border-r border-slate-300 bg-[#fed7aa] italic font-semibold text-slate-900">Region</td>
                        <td className="p-2 border-r border-slate-300 bg-[#fed7aa] italic font-semibold text-slate-900">Zone</td>
                        <td className="p-2 border-r border-slate-300 bg-[#fed7aa] italic font-semibold text-slate-900">Woreda</td>
                        <td className="p-2 border-r border-slate-300 bg-[#fed7aa] italic font-semibold text-slate-900">Name of health facility</td>
                        <td className="p-2 border-r border-slate-300 bg-[#dbeafe] italic text-slate-900 text-[10px] text-center font-semibold">List of Packeges</td>
                        <td className="p-2 border-r border-slate-300 bg-[#ffff00] font-black text-slate-950 text-center text-xs">Plant</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRB-0101N</td>
                        <td className="p-2 border-r border-slate-300 font-bold">403-XRRD-0101-001</td>
                        <td className="p-2 border-r border-slate-300 font-bold">401-WICU-0101N</td>
                        <td className="p-2 font-bold">401-WICU-0101N</td>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                      <tr>
                        <td className="p-2 border-r border-slate-200">Addis Ababa</td>
                        <td className="p-2 border-r border-slate-200">Addis Ketema</td>
                        <td className="p-2 border-r border-slate-200">Woreda 01</td>
                        <td className="p-2 border-r border-slate-200 font-sans font-medium">Tikur Anbessa Specialized Hospital</td>
                        <td className="p-2 border-r border-slate-200 text-center font-sans">MCH</td>
                        <td className="p-2 border-r border-slate-200 text-center font-black bg-[#ffff00] text-slate-950">AA01</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 text-center font-bold">2</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">Oromia</td>
                        <td className="p-2 border-r border-slate-200">East Shewa</td>
                        <td className="p-2 border-r border-slate-200">Woreda 01</td>
                        <td className="p-2 border-r border-slate-200 font-sans font-medium">Adama Hospital Medical College #40002328</td>
                        <td className="p-2 border-r border-slate-200 text-center font-sans">MCH</td>
                        <td className="p-2 border-r border-slate-200 text-center font-black bg-[#ffff00] text-slate-950">AD01</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 text-center font-bold">2</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">Dire Dawa</td>
                        <td className="p-2 border-r border-slate-200">Dire Dawa Administration</td>
                        <td className="p-2 border-r border-slate-200">Woreda 01</td>
                        <td className="p-2 border-r border-slate-200 font-sans font-medium">Dire Dawa Dil Chora Hospital #40002962</td>
                        <td className="p-2 border-r border-slate-200 text-center font-sans">MCH</td>
                        <td className="p-2 border-r border-slate-200 text-center font-black bg-[#ffff00] text-slate-950">DI01</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                        <td className="p-2 text-center font-bold">2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Select format to download active template:
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (activeTemplateTab === 'item-agg') {
                      handleDownloadItemAggregationTemplate('csv');
                    } else {
                      handleDownloadExactTemplate('csv');
                    }
                    setShowTemplateModal(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <Download size={15} />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={() => {
                    if (activeTemplateTab === 'item-agg') {
                      handleDownloadItemAggregationTemplate('xlsx');
                    } else {
                      handleDownloadExactTemplate('xlsx');
                    }
                    setShowTemplateModal(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

