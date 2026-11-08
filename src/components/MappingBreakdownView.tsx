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
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RegionBreakdownMatrixTable, RegionBreakdownMatrixData, RegionBreakdownRow, RegionBreakdownColumn } from './RegionBreakdownMatrixTable';
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
    quantities: Record<string, number>;
  }> = {};

  if (isListMode) {
    // Collect all unique items to form columns preserving exact description and code
    const itemMap: Record<string, { name: string, code: string }> = {};
    rowsJson.forEach(row => {
      const rawItemName = String(row[listItemCol!] || 'Unknown Item').trim();
      const rawItemCode = listCodeCol ? String(row[listCodeCol!] || '').trim() : '';

      const { name, code } = extractCodeAndName(rawItemName, rawItemCode || `CODE-${rawItemName.slice(0, 3).toUpperCase()}`);
      const finalCode = rawItemCode || code;

      if (!itemMap[rawItemName]) {
        itemMap[rawItemName] = { name: name || rawItemName, code: finalCode || rawItemName };
      }
    });

    finalColumns = Object.keys(itemMap).map((rawName, i) => ({
      id: `col-up-${i}`,
      name: itemMap[rawName].name,
      code: itemMap[rawName].code
    }));

    // Group and aggregate
    rowsJson.forEach(row => {
      const facilityName = String(row[facilityCol!] || 'Unknown Facility').trim();
      const rawItemName = String(row[listItemCol!] || 'Unknown Item').trim();
      const qty = Number(row[listQtyCol!] || 0);
      
      const colObj = finalColumns.find(c => c.name === itemMap[rawItemName]?.name || c.name === rawItemName);
      if (!colObj) return;

      if (!facilityGroups[facilityName]) {
        // Find master data match
        const masterMatch = hfMasterData.find(hf => 
          hf.customerDescription.toLowerCase() === facilityName.toLowerCase() || 
          hf.customer === facilityName ||
          hf.customerDescription.toLowerCase().includes(facilityName.toLowerCase()) ||
          facilityName.toLowerCase().includes(hf.customerDescription.toLowerCase())
        );

        const officialMapping = mapFacilityToHub(
          facilityName,
          masterMatch ? masterMatch.region : String(row[regionCol!] || ''),
          masterMatch ? masterMatch.zoneDescription : String(row[zoneCol!] || ''),
          masterMatch ? masterMatch.woredaDescription : String(row[woredaCol!] || ''),
          hfMasterData
        );

        facilityGroups[facilityName] = {
          facility: masterMatch ? masterMatch.customerDescription : facilityName,
          region: masterMatch ? masterMatch.region : String(row[regionCol!] || 'Auto Region'),
          zone: masterMatch ? masterMatch.zoneDescription : String(row[zoneCol!] || ''),
          woreda: masterMatch ? masterMatch.woredaDescription : String(row[woredaCol!] || ''),
          hub: officialMapping.hubName,
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

    // Check if row 0 of rowsJson contains explicit item codes for each column (e.g. 2-tier header files)
    const firstRowData = rowsJson[0] || {};
    
    // Improvement: Better detection of 2-tier headers as shown in user screenshot {C0871FED-A796-4A43-868D-774FC3A71926}.png
    const hasCodeRowInFirstRow = equipmentHeaders.some(h => {
      const val = String(firstRowData[h] || '').trim();
      // If it looks like a code (uppercase with dashes) or specifically mentioned in the screenshot like "ITEM-1"
      return val && isNaN(Number(val)) && (/[A-Z0-9]{3,}/i.test(val) || val.includes('-') || val.startsWith('ITEM-'));
    });

    let effectiveRowsJson = rowsJson;

    finalColumns = equipmentHeaders.map((h, i) => {
      let codeVal = '';
      let nameVal = h;

      if (hasCodeRowInFirstRow) {
        codeVal = String(firstRowData[h] || '').trim();
        // If the header itself is an empty marker like "__EMPTY_1", use the first row data as the name if it's not a pure code
        if (h.startsWith('__EMPTY_') || h.toLowerCase() === 'item') {
          nameVal = codeVal;
        }
      }

      const { name, code } = extractCodeAndName(nameVal, codeVal || `ITEM-${i + 1}`);
      return {
        id: `col-adhoc-${i}`,
        name: name,
        code: codeVal || code
      };
    });

    if (hasCodeRowInFirstRow) {
      effectiveRowsJson = rowsJson.slice(1);
    }

    effectiveRowsJson.forEach(row => {
      const facilityName = String(row[facilityCol!] || 'Unknown Facility').trim();
      if (!facilityName || facilityName === 'Unknown Facility') return;

      if (!facilityGroups[facilityName]) {
        const masterMatch = hfMasterData.find(hf => 
          hf.customerDescription.toLowerCase() === facilityName.toLowerCase() || 
          hf.customer === facilityName ||
          hf.customerDescription.toLowerCase().includes(facilityName.toLowerCase()) ||
          facilityName.toLowerCase().includes(hf.customerDescription.toLowerCase())
        );

        const officialMapping = mapFacilityToHub(
          facilityName,
          masterMatch ? masterMatch.region : String(row[regionCol!] || ''),
          masterMatch ? masterMatch.zoneDescription : String(row[zoneCol!] || ''),
          masterMatch ? masterMatch.woredaDescription : String(row[woredaCol!] || ''),
          hfMasterData
        );

        facilityGroups[facilityName] = {
          facility: masterMatch ? masterMatch.customerDescription : facilityName,
          region: masterMatch ? masterMatch.region : String(row[regionCol!] || 'Auto Region'),
          zone: masterMatch ? masterMatch.zoneDescription : String(row[zoneCol!] || ''),
          woreda: masterMatch ? masterMatch.woredaDescription : String(row[woredaCol!] || ''),
          hub: officialMapping.hubName,
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
      packages: 'P-1',
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
    setUploadFeedback({ message: 'Analyzing facilities and mapping to official regional hubs...', type: 'info' });
    
    setTimeout(() => {
      if (adHocDataActive && matrixData) {
        // Map Hubs for Ad-hoc Data using official registry
        const updatedRows = matrixData.rows.map(row => {
          const mapping = mapFacilityToHub(
            row.healthFacility,
            row.region,
            row.zone,
            row.woreda,
            hfListItems
          );
          
          return {
            ...row,
            hub: mapping.hubName // Use the official name (e.g. "Adama Hub")
          };
        });
        
        setMatrixData({
          ...matrixData,
          rows: updatedRows
        });
        setUploadFeedback({ message: '✓ Analysis complete: Facilities mapped with official Hub names.', type: 'success' });
      } else {
        // Map Hubs for Master Data and persist the changes
        const updated = hfListItems.map(hf => {
          const mapping = mapFacilityToHub(
            hf.customerDescription,
            hf.region,
            hf.zoneDescription,
            hf.woredaDescription,
            hfListItems
          );
          
          return {
            ...hf,
            hub: mapping.hubName // This writes the "official name" into the master data
          };
        });

        if (onUploadHFData) {
          onUploadHFData(updated, 'replace');
        }
        setUploadFeedback({ message: '✓ Mapping analysis completed: All master facilities updated with official hub names.', type: 'success' });
      }
      setIsAnalyzing(false);
    }, 800);
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
        setUploadFeedback({ 
          message: `✓ Analysis complete for "${file.name}". Processed ${parsedResult.rows.length} facilities and ${parsedResult.columns.length} data columns. Auto-detected Facility: "${parsedResult.detectedFacilityHeader}" & Region: "${parsedResult.detectedRegionHeader}". Click "Map with Hub" to perform regional hub allocation.`, 
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
  
  const handleDownloadMappedData = () => {
    if (adHocDataActive && matrixData) {
      // Export the current Matrix (Aggregated)
      const exportData = matrixData.rows.map(row => {
        const entry: any = {
          'Region': row.region,
          'Zone': row.zone,
          'Woreda': row.woreda,
          'HUB': row.hub || '',
          'Name of health facility': row.healthFacility,
          'List of Packages': row.packages
        };
        
        // Add item columns
        matrixData.columns.forEach(col => {
          entry[col.name] = row.quantities[col.id] || 0;
        });
        
        return entry;
      });
      
      downloadCSV(`Mapped_Breakdown_Matrix_${new Date().toISOString().split('T')[0]}.csv`, exportData);
      setUploadFeedback({ message: `Exported ${matrixData.rows.length} rows from active mapping matrix.`, type: 'success' });
    } else {
      // Fallback: Export Master List with HUBs
      const exportData = hfListItems.map(hf => ({
        'Region': hf.region,
        'Zone': hf.zoneDescription,
        'Woreda': hf.woredaDescription,
        'HUB': hf.hub || hf.deliveringPlant || '',
        'Name of health facility': hf.customerDescription,
        'Customer ID': hf.customer
      }));
      
      downloadCSV(`Master_HF_List_${new Date().toISOString().split('T')[0]}.csv`, exportData);
      setUploadFeedback({ message: `Exported ${hfListItems.length} records from Master HF Data.`, type: 'success' });
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <MapIcon size={160} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight uppercase">Mapping Breakdown System</h2>
            </div>
            <p className="text-cyan-100 text-sm font-medium max-w-2xl">
              Upload any file (Excel, CSV, Word, text) to analyze health facility distribution. 
              Universal zero-fail engine automatically detects equipment columns and maps facilities to regional hubs for decision support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {adHocDataActive && (
                  <button
                    onClick={handleResetToMaster}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-rose-500 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw size={16} />
                    <span>Reset to Master</span>
                  </button>
                )}
                  <button
                    onClick={handleMapWithHubs}
                    disabled={isAnalyzing || (!adHocDataActive && hfListItems.length === 0)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-emerald-500 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="Analyze and map currently viewed facilities to regional hubs"
                  >
                    <MapIcon size={16} />
                    <span>{isAnalyzing ? 'Analyzing...' : 'Map with Hubs'}</span>
                  </button>

                <button
                  onClick={handleDownloadMismatched}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                  title="Download CSV of facilities missing regional mappings"
                >
                  <Download size={16} />
                  <span>Download Mismatched Mappings</span>
                </button>
                
                <button
                  onClick={handleDownloadMappedData}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-500 transition active:scale-95 cursor-pointer"
                  title="Download CSV of all mapped facilities"
                >
                  <Download size={16} />
                  <span>Download Mapped Data</span>
                </button>


                
                <div className="flex flex-col items-end">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-xl font-bold text-xs shadow-lg hover:bg-cyan-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="Upload any Excel or CSV file for ad-hoc mapping analysis"
                  >
                    <Upload size={16} />
                    <span>{isUploading ? 'Analyzing...' : 'Analyze Any File'}</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                    className="hidden"
                  />
                </div>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2.5">
              <div className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider">Analysis Mode</div>
              <div className="flex items-center gap-2 mt-0.5">
                {adHocDataActive ? <FileText className="w-4 h-4 text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                <span className="text-sm font-bold">{adHocDataActive ? 'Ad-hoc File Data' : 'Master Registry'}</span>
              </div>
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

      {/* Stats KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Viewed Facilities</div>
            <div className="text-xl font-black text-slate-900 font-mono">{(adHocDataActive ? matrixData?.rows.length : stats.total)?.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mapped Status</div>
            <div className="text-xl font-black text-emerald-700 font-mono">
              {adHocDataActive ? 'Active Analysis' : stats.mapped.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Mappings</div>
            <div className="text-xl font-black text-rose-700 font-mono">{adHocDataActive ? '0' : stats.missing.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <RegionBreakdownMatrixTable 
          title={adHocDataActive ? "Ad-hoc Mapping Analysis Matrix" : "Equipment Distribution Mapping Matrix"}
          subtitle={adHocDataActive ? "Currently analyzing uploaded file data with auto-detected columns" : "Map medical device shipments to health facilities linked to master registry"}
          hfListItems={hfListItems}
          isEditable={isAdmin}
          data={matrixData}
          onUpdateData={setMatrixData}
          disableBreakdownLink={true}
        />
      </div>

      {/* Operational Help Footers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl h-fit border border-amber-200 shadow-2xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">Comprehensive File Analysis</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload any spreadsheet or CSV regardless of column naming conventions. The universal parsing engine 
              detects facility names, regions, zones, and equipment columns automatically.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl h-fit border border-indigo-200 shadow-2xs">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">Decision Support Export</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mapped facility data can be exported directly to Excel for procurement decisions, hub allocation, 
              and regional distribution planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
