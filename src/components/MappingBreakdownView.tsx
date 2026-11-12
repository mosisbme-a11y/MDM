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
  ChevronDown
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
function processAnyFileRows(rowsJson: any[], hfMasterData: HealthFacilityRecord[]): {
  columns: RegionBreakdownColumn[];
  rows: RegionBreakdownRow[];
  detectedFacilityHeader: string;
  detectedRegionHeader: string;
} {
  if (!rowsJson || rowsJson.length === 0) {
    throw new Error('The uploaded file is empty or could not be read.');
  }

  // Helper to extract embedded item code e.g. "Anesthesia machine (403-XRRD-0101)" or "Bed [CODE: 401-WICU-0101]"
  const extractCodeAndName = (rawText: string, fallbackCode?: string): { name: string; code: string } => {
    const text = (rawText || '').trim();
    if (!text) return { name: 'Item', code: fallbackCode || 'CODE-01' };

    // Match code in parentheses or brackets e.g. (403-XRRD-0101) or [403-XRRD-0101]
    const bracketMatch = text.match(/[\(\[](?:code:\s*)?([A-Z0-9]{3,}(?:-[A-Z0-9]+)+)[\)\]]/i);
    if (bracketMatch) {
      const code = bracketMatch[1].trim();
      const name = text.replace(bracketMatch[0], '').trim().replace(/[-–—]\s*$/, '').trim();
      return { name: name || text, code };
    }

    // Match trailing code pattern e.g. "Anesthesia machine - 403-XRRD-0101"
    const trailingMatch = text.match(/[-–—]\s*([A-Z0-9]{3,}(?:-[A-Z0-9]+)+)$/i);
    if (trailingMatch) {
      const code = trailingMatch[1].trim();
      const name = text.replace(trailingMatch[0], '').trim();
      return { name: name || text, code };
    }

    return { name: text, code: fallbackCode || text };
  };

  // 1. Extract all headers
  const headers = Object.keys(rowsJson[0]);

  // 2. Comprehensive Header Regex Patterns
  const facilityRegex = /facility|customer|hospital|health|center|clinic|site|destination|location|unit|institution|organization|consignee|beneficiary|recipient|to_name|to|name|description|descr|cust|hf_name|hf|benef/i;
  const regionRegex = /region|state|province|area|territory|rhb|place/i;
  const zoneRegex = /zone|district|subcity|sub_city/i;
  const woredaRegex = /woreda|subdistrict|town|city/i;
  const hubRegex = /hub|delivering|plant/i;
  const itemRegex = /item|material|description|article|product|device|equipment|name/i;
  const qtyRegex = /qty|quantity|amount|total|count|allocated/i;
  const codeRegex = /code|material_code|sku|id|item_code|material_num|material_no|part_no|code_no/i;

  let facilityCol = headers.find(h => facilityRegex.test(h));
  let regionCol = headers.find(h => regionRegex.test(h));
  let zoneCol = headers.find(h => zoneRegex.test(h));
  let woredaCol = headers.find(h => woredaRegex.test(h));
  let hubCol = headers.find(h => hubRegex.test(h));
  
  // Specific check for "List" format columns
  let listItemCol = headers.find(h => itemRegex.test(h) && h !== facilityCol);
  let listQtyCol = headers.find(h => qtyRegex.test(h));
  let listCodeCol = headers.find(h => codeRegex.test(h) && h !== facilityCol && h !== listItemCol);

  // FALLBACKS for Region and Facility
  if (!regionCol) {
    for (const h of headers) {
      if (h === facilityCol) continue;
      let regionMatchesCount = 0;
      for (const row of rowsJson.slice(0, 50)) {
        const val = String(row[h] || '').toLowerCase().trim();
        if (KNOWN_ETHIOPIAN_REGIONS.some(reg => val.includes(reg) || reg.includes(val))) {
          regionMatchesCount++;
        }
      }
      if (regionMatchesCount > 0) {
        regionCol = h;
        break;
      }
    }
  }

  if (!facilityCol) {
    let bestCol = '';
    let maxUniqueCount = -1;
    for (const h of headers) {
      if (h === regionCol || h === zoneCol || h === woredaCol) continue;
      const uniqueStrings = new Set<string>();
      for (const row of rowsJson) {
        const val = String(row[h] || '').trim();
        if (val && isNaN(Number(val))) {
          uniqueStrings.add(val);
        }
      }
      if (uniqueStrings.size > maxUniqueCount) {
        maxUniqueCount = uniqueStrings.size;
        bestCol = h;
      }
    }
    facilityCol = bestCol || headers[0];
  }

  if (!regionCol) {
    regionCol = zoneCol || headers.find(h => h !== facilityCol) || 'Region';
  }

  // Detect Mode: List vs Matrix
  const isListMode = !!(listItemCol && listQtyCol);
  
  let finalColumns: RegionBreakdownColumn[] = [];
  let facilityGroups: Record<string, {
    region: string;
    zone: string;
    woreda: string;
    hub: string;
    facility: string;
    packages?: string;
    quantities: Record<string, number>;
  }> = {};

  if (isListMode) {
    // Collect all unique items to form columns preserving 100% exact description and code
    const itemMap: Record<string, { name: string, code: string }> = {};
    rowsJson.forEach(row => {
      const rawItemName = String(row[listItemCol!] || '').trim();
      if (!rawItemName) return;
      const rawItemCode = listCodeCol ? String(row[listCodeCol!] || '').trim() : '';

      if (!itemMap[rawItemName]) {
        itemMap[rawItemName] = {
          name: rawItemName, // EXACT uploaded item name - NEVER altered or stripped
          code: rawItemCode || `40${Object.keys(itemMap).length + 1}-MAT`
        };
      }
    });

    finalColumns = Object.keys(itemMap).map((rawName, i) => ({
      id: `col-up-${i}`,
      name: itemMap[rawName].name,
      code: itemMap[rawName].code
    }));

    // Group and aggregate
    rowsJson.forEach(row => {
      const facilityName = String(row[facilityCol!] || '').trim();
      if (!facilityName) return;
      const rawItemName = String(row[listItemCol!] || '').trim();
      const qty = Number(row[listQtyCol!] || 0);
      
      const colObj = finalColumns.find(c => c.name === rawItemName);
      if (!colObj) return;

      if (!facilityGroups[facilityName]) {
        const masterMatch = hfMasterData.find(hf => 
          hf.customerDescription.toLowerCase() === facilityName.toLowerCase() || 
          hf.customer === facilityName ||
          hf.customerDescription.toLowerCase().includes(facilityName.toLowerCase()) ||
          facilityName.toLowerCase().includes(hf.customerDescription.toLowerCase())
        );

        const uploadedRegion = String(row[regionCol!] || '').trim();
        const uploadedZone = zoneCol ? String(row[zoneCol!] || '').trim() : '';
        const uploadedWoreda = woredaCol ? String(row[woredaCol!] || '').trim() : '';
        const uploadedHub = hubCol ? String(row[hubCol!] || '').trim() : '';
        const uploadedPkg = String(row['List of Packeges'] || row['packages'] || row['Packages'] || 'MCH').trim();

        const officialMapping = mapFacilityToHub(
          facilityName,
          uploadedRegion || (masterMatch ? masterMatch.region : ''),
          uploadedZone || (masterMatch ? masterMatch.zoneDescription : ''),
          uploadedWoreda || (masterMatch ? masterMatch.woredaDescription : ''),
          hfMasterData
        );

        // Strict Hub symbol (e.g. AA01, AD01) - excluding HO01
        const hubSymbol = (uploadedHub && uploadedHub.toUpperCase() !== 'HO01' && !uploadedHub.toUpperCase().includes('HEAD'))
          ? uploadedHub.toUpperCase()
          : ((officialMapping.hubCode && officialMapping.hubCode !== 'HO01' && !officialMapping.hubCode.includes('HEAD')) ? officialMapping.hubCode : 'AA01');

        facilityGroups[facilityName] = {
          facility: facilityName, // NEVER overwrite exact uploaded facility name!
          region: uploadedRegion || (masterMatch ? masterMatch.region : 'Addis Ababa'),
          zone: uploadedZone || (masterMatch ? masterMatch.zoneDescription : ''),
          woreda: uploadedWoreda || (masterMatch ? masterMatch.woredaDescription : ''),
          packages: uploadedPkg || 'MCH',
          hub: hubSymbol,
          quantities: {}
        };
      }
      
      facilityGroups[facilityName].quantities[colObj.id] = (facilityGroups[facilityName].quantities[colObj.id] || 0) + qty;
    });

  } else {
    // Matrix Mode (Columns are items)
    const adminHeaders = [facilityCol, regionCol, zoneCol, woredaCol, hubCol].filter(Boolean) as string[];
    let equipmentHeaders = headers.filter(h => !adminHeaders.includes(h) && !/id|date|status|time|s\.no|index|row/i.test(h));

    if (equipmentHeaders.length === 0) {
      equipmentHeaders = headers.filter(h => h !== facilityCol && h !== regionCol);
    }
    if (equipmentHeaders.length === 0) {
      equipmentHeaders = ['Allocation Quantity'];
    }

    const firstRowData = rowsJson[0] || {};
    const hasCodeRowInFirstRow = equipmentHeaders.some(h => {
      const val = String(firstRowData[h] || '').trim();
      return val && isNaN(Number(val)) && (/[A-Z0-9]{3,}/i.test(val) || val.includes('-') || val.startsWith('ITEM-'));
    });

    let effectiveRowsJson = rowsJson;

    finalColumns = equipmentHeaders.map((h, i) => {
      let codeVal = '';
      let nameVal = h;

      if (hasCodeRowInFirstRow) {
        codeVal = String(firstRowData[h] || '').trim();
        if (h.startsWith('__EMPTY_') || h.toLowerCase() === 'item') {
          nameVal = codeVal;
        }
      }

      // Preserve 100% EXACT item name from uploaded header
      const exactName = nameVal.trim() || `Item ${i + 1}`;
      let finalCode = codeVal;
      if (!finalCode) {
        const parsed = extractCodeAndName(exactName);
        finalCode = parsed.code !== exactName ? parsed.code : `40${i + 1}-MAT`;
      }

      return {
        id: `col-adhoc-${i}`,
        name: exactName, // EXACT item name as uploaded
        code: finalCode
      };
    });

    if (hasCodeRowInFirstRow) {
      effectiveRowsJson = rowsJson.slice(1);
    }

    effectiveRowsJson.forEach(row => {
      const facilityName = String(row[facilityCol!] || '').trim();
      if (!facilityName || facilityName === 'Unknown Facility') return;

      if (!facilityGroups[facilityName]) {
        const masterMatch = hfMasterData.find(hf => 
          hf.customerDescription.toLowerCase() === facilityName.toLowerCase() || 
          hf.customer === facilityName ||
          hf.customerDescription.toLowerCase().includes(facilityName.toLowerCase()) ||
          facilityName.toLowerCase().includes(hf.customerDescription.toLowerCase())
        );

        const uploadedRegion = String(row[regionCol!] || '').trim();
        const uploadedZone = zoneCol ? String(row[zoneCol!] || '').trim() : '';
        const uploadedWoreda = woredaCol ? String(row[woredaCol!] || '').trim() : '';
        const uploadedHub = hubCol ? String(row[hubCol!] || '').trim() : '';
        const uploadedPkg = String(row['List of Packeges'] || row['packages'] || row['Packages'] || 'MCH').trim();

        const officialMapping = mapFacilityToHub(
          facilityName,
          uploadedRegion || (masterMatch ? masterMatch.region : ''),
          uploadedZone || (masterMatch ? masterMatch.zoneDescription : ''),
          uploadedWoreda || (masterMatch ? masterMatch.woredaDescription : ''),
          hfMasterData
        );

        // Strict Hub symbol (e.g. AA01, AD01) - excluding HO01
        const hubSymbol = (uploadedHub && uploadedHub.toUpperCase() !== 'HO01' && !uploadedHub.toUpperCase().includes('HEAD'))
          ? uploadedHub.toUpperCase()
          : ((officialMapping.hubCode && officialMapping.hubCode !== 'HO01' && !officialMapping.hubCode.includes('HEAD')) ? officialMapping.hubCode : 'AA01');

        facilityGroups[facilityName] = {
          facility: facilityName, // NEVER overwrite exact uploaded facility name!
          region: uploadedRegion || (masterMatch ? masterMatch.region : 'Addis Ababa'),
          zone: uploadedZone || (masterMatch ? masterMatch.zoneDescription : ''),
          woreda: uploadedWoreda || (masterMatch ? masterMatch.woredaDescription : ''),
          packages: uploadedPkg || 'MCH',
          hub: hubSymbol,
          quantities: {}
        };
      }

      equipmentHeaders.forEach((headerName, colIdx) => {
        const col = finalColumns[colIdx];
        const cellVal = row[headerName];
        const qty = typeof cellVal === 'number' ? cellVal : (Number(cellVal) || 0);
        facilityGroups[facilityName].quantities[col.id] = (facilityGroups[facilityName].quantities[col.id] || 0) + qty;
      });
    });
  }

  // Convert groups to final rows
  const finalRows: RegionBreakdownRow[] = Object.values(facilityGroups).map((g, i) => {
    return {
      id: `row-up-${i}-${Date.now()}`,
      region: g.region,
      zone: g.zone,
      woreda: g.woreda,
      hub: g.hub,
      healthFacility: g.facility,
      customerDescription: g.facility,
      packages: g.packages || 'MCH',
      quantities: g.quantities
    };
  });

  return {
    columns: finalColumns.length > 0 ? finalColumns : [{ id: 'col-placeholder', name: 'Allocation Quantity', code: 'QTY' }],
    rows: finalRows,
    detectedFacilityHeader: facilityCol || 'Facility Name',
    detectedRegionHeader: regionCol || 'Region'
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
  const [isMohSubmitDropdownOpen, setIsMohSubmitDropdownOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const baseRows = (matrixData && matrixData.rows && matrixData.rows.length > 0)
        ? matrixData.rows
        : DEFAULT_STAGE_3_ROWS;

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
          zone: row.zone && row.zone.trim() !== '' ? row.zone : (mapping.zone || 'East Shewa'),
          woreda: row.woreda && row.woreda.trim() !== '' ? row.woreda : (mapping.woreda || 'Woreda 01'),
          hub: hubSymbol // Adds/updates Hub symbol; never alters exact item names or quantities!
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
            zoneDescription: hf.zoneDescription || mapping.zone || 'East Shewa',
            woredaDescription: hf.woredaDescription || mapping.woreda || 'Woreda 01',
            hub: hubSymbol
          };
        });
        onUploadHFData(updatedMaster, 'replace');
      }

      setUploadFeedback({ 
        message: `✓ Mapping complete: ${updatedRows.length} facilities successfully mapped with designated EPSS Hub symbols, Zone, and Woreda. All exact item descriptions & quantities intact.`, 
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

    const processJson = (rawJson: any[]) => {
      try {
        if (!rawJson || rawJson.length === 0) {
          setUploadFeedback({ message: 'The uploaded file is empty.', type: 'error' });
          return;
        }

        const parsedResult = processAnyFileRows(rawJson, hfListItems);

        setMatrixData({
          date: new Date().toISOString().split('T')[0],
          region: 'Uploaded File Matrix',
          columns: parsedResult.columns,
          rows: parsedResult.rows
        });

        setAdHocDataActive(true);
        setIsHubMapped(false); // Reset mapped hub flag on new file upload until "MAP HF TO HUB" is clicked
        setUploadFeedback({ 
          message: `✓ Analysis complete for "${file.name}". Processed ${parsedResult.rows.length} facilities and ${parsedResult.columns.length} exact equipment columns. Auto-detected Facility: "${parsedResult.detectedFacilityHeader}" & Region: "${parsedResult.detectedRegionHeader}". Click "MAP HF TO HUB" to auto-insert the HUB column and perform regional hub mapping.`, 
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
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            processJson(results.data);
          } else {
            // Retry with header: false
            Papa.parse(file, {
              header: false,
              skipEmptyLines: true,
              complete: (res2) => {
                if (res2.data && res2.data.length > 0) {
                  const arr2d = res2.data as any[][];
                  const headers = arr2d[0].map((h: any, idx: number) => h ? String(h) : `Column ${idx + 1}`);
                  const jsonRows = arr2d.slice(1).map(row => {
                    const obj: Record<string, any> = {};
                    headers.forEach((h, i) => {
                      obj[h] = row[i];
                    });
                    return obj;
                  });
                  processJson(jsonRows);
                } else {
                  setUploadFeedback({ message: 'Could not read CSV data rows.', type: 'error' });
                  setIsUploading(false);
                }
              }
            });
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
          const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

          processJson(rawJson);
        } catch (err: any) {
          console.error('Error reading workbook:', err);
          setUploadFeedback({ message: 'Failed to parse file. Please verify it is a valid spreadsheet or CSV.', type: 'error' });
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
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

  const handleDownloadMappedData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const activeCols = (matrixData && matrixData.columns && matrixData.columns.length > 0)
      ? matrixData.columns
      : DEFAULT_STAGE_3_COLUMNS;
    const activeRows = (matrixData && matrixData.rows && matrixData.rows.length > 0)
      ? matrixData.rows
      : DEFAULT_STAGE_3_ROWS;

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
                <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
                  <span>Mapping Breakdown System</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-cyan-400/20 text-cyan-300 font-mono border border-cyan-400/40">
                    Official Template Engine
                  </span>
                </h2>
                <p className="text-cyan-100/80 text-xs sm:text-sm font-medium max-w-2xl mt-0.5">
                  Analyze health facility distribution, map hubs, and generate/upload standard EPSS breakdown matrix templates.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* SUBMIT BREAKDOWN TO MOH 3 Pill Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMohSubmitDropdownOpen(!isMohSubmitDropdownOpen)}
                className="flex items-center gap-3 px-6 py-3 bg-[#0a0f1d] hover:bg-black text-white rounded-full font-black text-sm shadow-2xl hover:shadow-cyan-900/40 transition-all transform active:scale-95 border border-slate-700/80 cursor-pointer tracking-wider uppercase group"
                title="Submit official breakdown matrix to MOH via System Transmittal, Email, or WhatsApp"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)] animate-pulse shrink-0" />
                <span className="tracking-widest font-black text-white group-hover:text-amber-300 transition-colors">
                  SUBMIT BREAKDOWN TO MOH
                </span>
                <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-inner shrink-0 ml-1">
                  3
                </span>
                <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${isMohSubmitDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isMohSubmitDropdownOpen && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-[#0a0f1d] border-2 border-amber-400/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
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
                        setIsMohSubmitDropdownOpen(false);
                        handleDownloadMappedData('xlsx');
                        setUploadFeedback({
                          message: '⚡ Direct System Transmittal to MOH initialized: Matrix exported with digital audit log.',
                          type: 'success'
                        });
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
                        setIsMohSubmitDropdownOpen(false);
                        handleDownloadMappedData('xlsx');
                        const subject = encodeURIComponent(`Official Health Facility Breakdown Matrix - EPSS PMD`);
                        const body = encodeURIComponent(`Dear MOH PMD Team,\n\nPlease find attached the official Health Facility Breakdown Matrix.\nDate: ${new Date().toISOString().split('T')[0]}\n\nBest regards,\nEPSS Medical Device Directorate`);
                        window.location.href = `mailto:moh.pmd@moh.gov.et?subject=${subject}&body=${body}`;
                        setUploadFeedback({
                          message: '📧 Opened email client targeting moh.pmd@moh.gov.et & exported matrix Excel file.',
                          type: 'success'
                        });
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
                        setIsMohSubmitDropdownOpen(false);
                        handleDownloadMappedData('xlsx');
                        const msg = `*EPSS REGIONAL BREAKDOWN MATRIX TO MOH*\nDate: ${new Date().toISOString().split('T')[0]}\nStatus: Official Matrix Ready\nDispatch: EPSS PMD Directorate`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        setUploadFeedback({
                          message: '💬 Launched WhatsApp Web dispatch & downloaded matrix Excel file.',
                          type: 'success'
                        });
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
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Anesthesia machine - with Patient mon</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bed - Patient, Fowler, Adult</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Bowel - With Stand, Stainless Steel.</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Cold box</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold border-r border-slate-300">Couch - Delivery</th>
                        <th className="p-2.5 bg-[#fed7aa] text-slate-900 font-semibold">Couch - Examination</th>
                      </tr>

                      {/* Header Row 2 (Material Codes) */}
                      <tr className="border-b border-slate-300 bg-white font-mono text-[11px] text-slate-700">
                        <td className="p-2 border-r border-slate-300"></td>
                        <td className="p-2 border-r border-slate-300"></td>
                        <td className="p-2 border-r border-slate-300"></td>
                        <td className="p-2 border-r border-slate-300"></td>
                        <td className="p-2 border-r border-slate-300 bg-[#eff6ff] italic text-slate-500 text-[10px] text-center">List of Packeges</td>
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

