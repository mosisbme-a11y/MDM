import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Hospital,
  Building2,
  ClipboardPaste,
  FileText,
  Trash2,
  Sparkles,
  Info,
  Check,
  UploadCloud
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { HealthFacilityRecord } from '../types';
import { downloadCSV } from '../utils/formatters';
import { uploadAndRecordFile } from '../utils/fileUploadService';
import { fuzzyMatch, matchHealthFacility } from '../utils/fuzzyMatcher';
import { ETHIOPIAN_HEALTH_FACILITIES_7500, ALL_HF_NAMES } from '../data/ethiopianHealthFacilities7500';

export interface HFListUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadHFData: (items: HealthFacilityRecord[], mode: 'replace' | 'append', files?: { name: string, url: string }[]) => void;
  initialItems?: HealthFacilityRecord[];
  initialFileName?: string;
}

export function parseHealthFacilityRows(rawRows: any[], sourceName: string = 'Upload'): HealthFacilityRecord[] {
  if (!rawRows || rawRows.length === 0) return [];

  const cleanKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const items: HealthFacilityRecord[] = [];
  const timestamp = Date.now();

  rawRows.forEach((row, index) => {
    // Build clean key map for flexible column detection
    const rowMap: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      rowMap[cleanKey(k)] = row[k];
    });

    // Skip completely empty rows (spreadsheets often carry thousands of blank formatted rows)
    const hasAnyCode = String(rowMap['customer'] ?? rowMap['customercode'] ?? rowMap['customerno'] ?? rowMap['hfcode'] ?? rowMap['facilitycode'] ?? rowMap['code'] ?? '').trim() !== '';
    const hasAnyName = String(rowMap['customerdescription'] ?? rowMap['customerdesc'] ?? rowMap['healthfacilityname'] ?? rowMap['facilityname'] ?? rowMap['hospitalname'] ?? rowMap['hospital'] ?? rowMap['healthfacility'] ?? rowMap['facility'] ?? rowMap['name'] ?? '').trim() !== '';
    if (!hasAnyCode && !hasAnyName) return;

    // 1. Customer
    const customer = String(
      rowMap['customer'] ||
      rowMap['customercode'] ||
      rowMap['customerno'] ||
      rowMap['hfcode'] ||
      rowMap['facilitycode'] ||
      rowMap['plantcode'] ||
      rowMap['code'] ||
      rowMap['id'] ||
      `100${String(index + 1).padStart(4, '0')}`
    ).trim();

    // 2. Customer Description
    const customerDescription = String(
      rowMap['customerdescription'] ||
      rowMap['customerdesc'] ||
      rowMap['healthfacilityname'] ||
      rowMap['facilityname'] ||
      rowMap['hospitalname'] ||
      rowMap['hospital'] ||
      rowMap['healthfacility'] ||
      rowMap['facility'] ||
      rowMap['name'] ||
      `Health Facility ${customer}`
    ).trim();

    // Prepare incoming location data for better matching
    const incomingRegion = String(
      rowMap['region'] ||
      rowMap['administrativeregion'] ||
      rowMap['zone_region'] ||
      rowMap['state'] ||
      ''
    ).trim();

    const incomingZone = String(
      rowMap['zonedescription'] ||
      rowMap['zone_description'] ||
      rowMap['zone'] ||
      rowMap['zonedesc'] ||
      ''
    ).trim();

    const incomingWoreda = String(
      rowMap['woredadescription'] ||
      rowMap['woreda_description'] ||
      rowMap['woredadesc'] ||
      rowMap['woredaname'] ||
      ''
    ).trim();

    // The upload is the source of truth when it already carries the full SAP columns
    // (Delivering Plant + Region): then no fuzzy matching against the built-in list is needed
    // (that matching is very slow on big files and would overwrite the file's own values).
    const fileHasFullColumns = Boolean(String(rowMap['deliveringplant'] ?? rowMap['deliveryplant'] ?? rowMap['supplyingplant'] ?? '').trim()) &&
      Boolean(incomingRegion);

    // Use enhanced fuzzy matching with location awareness (only for sparse files)
    const masterRecord = fileHasFullColumns ? null : matchHealthFacility(
      { 
        customerDescription, 
        region: incomingRegion, 
        zoneDescription: incomingZone, 
        woredaDescription: incomingWoreda 
      }, 
      ETHIOPIAN_HEALTH_FACILITIES_7500
    );

    // Facility Type
    let facilityType = masterRecord ? (masterRecord.facilityType || 'Hospital') : (() => {
        const rawFacType = String(
          rowMap['facilitytype'] ||
          rowMap['facility_type'] ||
          rowMap['type'] ||
          rowMap['classification'] ||
          rowMap['category'] ||
          ''
        ).trim();
        
        if (rawFacType) return rawFacType;

        const lowerDesc = customerDescription.toLowerCase();
        if (lowerDesc.includes('hospital') || lowerDesc.includes('medical college') || lowerDesc.includes('specialized') || lowerDesc.includes('referral') || lowerDesc.includes('teaching')) {
          return 'Hospital';
        } else if (lowerDesc.includes('health center') || lowerDesc.includes('hc') || lowerDesc.includes('health centre')) {
          return 'Health Center';
        } else if (lowerDesc.includes('clinic') || lowerDesc.includes('health post') || lowerDesc.includes('hp')) {
          return 'Clinic';
        } else {
          return 'Hospital';
        }
    })();

    // 3. Delivering Plant
    const deliveringPlant = masterRecord ? masterRecord.deliveringPlant : String(
      rowMap['deliveringplant'] ||
      rowMap['delivering_plant'] ||
      rowMap['deliveryplant'] ||
      rowMap['supplyingplant'] ||
      rowMap['plant'] ||
      rowMap['hub'] ||
      'AA01'
    ).trim().toUpperCase();

    // 4. Ownership Code
    const ownershipCode = masterRecord ? masterRecord.ownershipCode : String(
      rowMap['ownershipcode'] ||
      rowMap['ownership_code'] ||
      rowMap['owncode'] ||
      rowMap['ownership'] ||
      'GOV'
    ).trim().toUpperCase();

    // 5. Ownership Description
    const ownershipDescription = masterRecord ? masterRecord.ownershipDescription : String(
      rowMap['ownershipdescription'] ||
      rowMap['ownership_description'] ||
      rowMap['ownerdesc'] ||
      rowMap['ownership_desc'] ||
      rowMap['ownertype'] ||
      (ownershipCode === 'GOV' || ownershipCode === 'PUB'
        ? 'Public / Government'
        : ownershipCode === 'PRV'
        ? 'Private Healthcare'
        : ownershipCode === 'NGO'
        ? 'Non-Governmental Organization'
        : 'Public / Government')
    ).trim();

    // 6. Region
    let region = masterRecord ? masterRecord.region : String(
      rowMap['region'] ||
      rowMap['administrativeregion'] ||
      rowMap['zone_region'] ||
      rowMap['state'] ||
      ''
    ).trim();

    if (!region) {
      if (deliveringPlant.startsWith('AA') || customer.startsWith('AA')) region = 'Addis Ababa';
      else if (deliveringPlant.startsWith('AD') || deliveringPlant.startsWith('JM') || deliveringPlant.startsWith('OR')) region = 'Oromia';
      else if (deliveringPlant.startsWith('BD') || deliveringPlant.startsWith('GD') || deliveringPlant.startsWith('AM')) region = 'Amhara';
      else if (deliveringPlant.startsWith('MK') || deliveringPlant.startsWith('TG')) region = 'Tigray';
      else if (deliveringPlant.startsWith('JJ') || deliveringPlant.startsWith('SM')) region = 'Somali';
      else if (deliveringPlant.startsWith('HW') || deliveringPlant.startsWith('SD')) region = 'Sidama';
      else if (deliveringPlant.startsWith('AF')) region = 'Afar';
      else if (deliveringPlant.startsWith('DD')) region = 'Dire Dawa';
      else region = 'Central & Regional Hub';
    }

    // 7. Zone Code
    const zoneCode = masterRecord ? masterRecord.zoneCode : String(
      rowMap['zonecode'] ||
      rowMap['zone_code'] ||
      rowMap['zcode'] ||
      `Z-${String(index + 1).padStart(2, '0')}`
    ).trim();

    // 8. Zone Description
    const zoneDescription = masterRecord ? masterRecord.zoneDescription : String(
      rowMap['zonedescription'] ||
      rowMap['zone_description'] ||
      rowMap['zone'] ||
      rowMap['zonedesc'] ||
      'Central Zone'
    ).trim();

    // 9. Woreda
    const woreda = masterRecord ? masterRecord.woreda : String(
      rowMap['woreda'] ||
      rowMap['woredacode'] ||
      rowMap['woreda_code'] ||
      `W-${String(index + 1).padStart(2, '0')}`
    ).trim();

    // 10. Woreda Description
    const woredaDescription = masterRecord ? masterRecord.woredaDescription : String(
      rowMap['woredadescription'] ||
      rowMap['woreda_description'] ||
      rowMap['woredadesc'] ||
      rowMap['woredaname'] ||
      'General Woreda'
    ).trim();

    items.push({
      id: `hf-${timestamp}-${index}`,
      customer,
      customerDescription,
      facilityType,
      deliveringPlant,
      ownershipCode,
      ownershipDescription,
      region,
      zoneCode,
      zoneDescription,
      woreda,
      woredaDescription,
      uploadedAt: new Date().toISOString()
    });
  });

  return items;
}

/**
 * Universal multi-sheet and title-aware parser for Health Facility Workbooks
 */
export function parseHealthFacilityWorkbook(wb: XLSX.WorkBook, sourceName: string = 'Upload'): HealthFacilityRecord[] {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
  const allRecords: HealthFacilityRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const aoo = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!aoo || aoo.length === 0) continue;

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(10, aoo.length); r++) {
      const row = aoo[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
      if (
        rowStr.includes('customer') ||
        rowStr.includes('facility') ||
        rowStr.includes('hospital') ||
        rowStr.includes('plant') ||
        rowStr.includes('region')
      ) {
        headerRowIdx = r;
        break;
      }
    }

    let records: HealthFacilityRecord[] = [];
    if (headerRowIdx !== -1) {
      const headers = aoo[headerRowIdx].map((h) => String(h || '').trim());
      const dataRows = aoo.slice(headerRowIdx + 1);
      const objects: any[] = [];
      dataRows.forEach((row) => {
        if (!Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;
        const obj: Record<string, any> = {};
        headers.forEach((h, colIdx) => {
          if (h && colIdx < row.length) {
            obj[h] = row[colIdx];
          }
        });
        objects.push(obj);
      });
      records = parseHealthFacilityRows(objects, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    } else {
      const rawRows = XLSX.utils.sheet_to_json<any>(ws);
      records = parseHealthFacilityRows(rawRows, wb.SheetNames.length > 1 ? `${sourceName} [${sheetName}]` : sourceName);
    }

    if (records.length > 0) {
      allRecords.push(...records);
    }
  }

  return allRecords;
}

export const DEFAULT_SAMPLE_RECORDS: Omit<HealthFacilityRecord, 'id'>[] = [];

export const HFListUploadModal: React.FC<HFListUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadHFData,
  initialItems,
  initialFileName
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);
  const [parsedItems, setParsedItems] = useState<HealthFacilityRecord[]>(initialItems || []);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, url: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial items when modal opens with pre-loaded file
  useEffect(() => {
    if (isOpen && initialItems && initialItems.length > 0) {
      setParsedItems(initialItems);
      setFileName(initialFileName || 'Selected File');
      setSuccessMsg(`✓ Loaded ${initialItems.length} records from browser! Ready to confirm and apply.`);
      setError(null);
    }
  }, [isOpen, initialItems, initialFileName]);

  // Auto-clear message after 4s
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  if (!isOpen) return null;

  const resetState = () => {
    setFileName(null);
    setParsedItems([]);
    setError(null);
    setSuccessMsg(null);
    setPasteText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const cleanKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  const parseRawRows = (rawRows: any[], sourceName: string) => {
    if (!rawRows || rawRows.length === 0) {
      setError('The uploaded file does not contain any readable data rows.');
      return;
    }

    try {
      const items: HealthFacilityRecord[] = [];
      const timestamp = Date.now();

      rawRows.forEach((row, index) => {
        // Build clean key map for flexible column detection
        const rowMap: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          rowMap[cleanKey(k)] = row[k];
        });

        // 1. Customer
        const customer = String(
          rowMap['customer'] ||
          rowMap['customercode'] ||
          rowMap['customerno'] ||
          rowMap['hfcode'] ||
          rowMap['facilitycode'] ||
          rowMap['plantcode'] ||
          rowMap['code'] ||
          rowMap['id'] ||
          `100${String(index + 1).padStart(4, '0')}`
        ).trim();

        // 2. Customer Description
        const customerDescription = String(
          rowMap['customerdescription'] ||
          rowMap['customerdesc'] ||
          rowMap['healthfacilityname'] ||
          rowMap['facilityname'] ||
          rowMap['hospitalname'] ||
          rowMap['hospital'] ||
          rowMap['healthfacility'] ||
          rowMap['facility'] ||
          rowMap['name'] ||
          `Health Facility ${customer}`
        ).trim();

        // Prepare incoming location data for better matching
        const incomingRegion = String(
          rowMap['region'] ||
          rowMap['administrativeregion'] ||
          rowMap['zone_region'] ||
          rowMap['state'] ||
          ''
        ).trim();

        const incomingZone = String(
          rowMap['zonedescription'] ||
          rowMap['zone_description'] ||
          rowMap['zone'] ||
          rowMap['zonedesc'] ||
          ''
        ).trim();

        const incomingWoreda = String(
          rowMap['woredadescription'] ||
          rowMap['woreda_description'] ||
          rowMap['woredadesc'] ||
          rowMap['woredaname'] ||
          ''
        ).trim();

        // Use enhanced fuzzy matching with location awareness
        const masterRecord = matchHealthFacility(
          { 
            customerDescription, 
            region: incomingRegion, 
            zoneDescription: incomingZone, 
            woredaDescription: incomingWoreda 
          }, 
          ETHIOPIAN_HEALTH_FACILITIES_7500
        );

        // Facility Type
        let facilityType = masterRecord ? (masterRecord.facilityType || 'Hospital') : (() => {
            const rawFacType = String(
              rowMap['facilitytype'] ||
              rowMap['facility_type'] ||
              rowMap['type'] ||
              rowMap['classification'] ||
              rowMap['category'] ||
              ''
            ).trim();
            
            if (rawFacType) return rawFacType;

            const lowerDesc = customerDescription.toLowerCase();
            if (lowerDesc.includes('hospital') || lowerDesc.includes('medical college') || lowerDesc.includes('specialized') || lowerDesc.includes('referral') || lowerDesc.includes('teaching')) {
              return 'Hospital';
            } else if (lowerDesc.includes('health center') || lowerDesc.includes('hc') || lowerDesc.includes('health centre')) {
              return 'Health Center';
            } else if (lowerDesc.includes('clinic') || lowerDesc.includes('health post') || lowerDesc.includes('hp')) {
              return 'Clinic';
            } else {
              return 'Hospital';
            }
        })();

        // 3. Delivering Plant (validate against valid hubs if needed)
        let deliveringPlant = masterRecord ? masterRecord.deliveringPlant : String(
          rowMap['deliveringplant'] ||
          rowMap['delivering_plant'] ||
          rowMap['deliveryplant'] ||
          rowMap['supplyingplant'] ||
          rowMap['plant'] ||
          rowMap['hub'] ||
          'AA01'
        ).trim().toUpperCase();

        // 4. Ownership Code
        const ownershipCode = masterRecord ? masterRecord.ownershipCode : String(
          rowMap['ownershipcode'] ||
          rowMap['ownership_code'] ||
          rowMap['owncode'] ||
          rowMap['ownership'] ||
          'GOV'
        ).trim().toUpperCase();

        // 5. Ownership Description
        const ownershipDescription = masterRecord ? masterRecord.ownershipDescription : String(
          rowMap['ownershipdescription'] ||
          rowMap['ownership_description'] ||
          rowMap['ownerdesc'] ||
          rowMap['ownership_desc'] ||
          rowMap['ownertype'] ||
          (ownershipCode === 'GOV' || ownershipCode === 'PUB'
            ? 'Public / Government'
            : ownershipCode === 'PRV'
            ? 'Private Healthcare'
            : ownershipCode === 'NGO'
            ? 'Non-Governmental Organization'
            : 'Public / Government')
        ).trim();

        // 6. Region
        let region = masterRecord ? masterRecord.region : String(
          rowMap['region'] ||
          rowMap['administrativeregion'] ||
          rowMap['zone_region'] ||
          rowMap['state'] ||
          ''
        ).trim();

        if (!region) {
          if (deliveringPlant.startsWith('AA') || customer.startsWith('AA')) region = 'Addis Ababa';
          else if (deliveringPlant.startsWith('AD') || deliveringPlant.startsWith('JM') || deliveringPlant.startsWith('OR')) region = 'Oromia';
          else if (deliveringPlant.startsWith('BD') || deliveringPlant.startsWith('GD') || deliveringPlant.startsWith('AM')) region = 'Amhara';
          else if (deliveringPlant.startsWith('MK') || deliveringPlant.startsWith('TG')) region = 'Tigray';
          else if (deliveringPlant.startsWith('JJ') || deliveringPlant.startsWith('SM')) region = 'Somali';
          else if (deliveringPlant.startsWith('HW') || deliveringPlant.startsWith('SD')) region = 'Sidama';
          else if (deliveringPlant.startsWith('AF')) region = 'Afar';
          else if (deliveringPlant.startsWith('DD')) region = 'Dire Dawa';
          else region = 'Central & Regional Hub';
        }

        // 7. Zone Code
        const zoneCode = masterRecord ? masterRecord.zoneCode : String(
          rowMap['zonecode'] ||
          rowMap['zone_code'] ||
          rowMap['zcode'] ||
          `Z-${String(index + 1).padStart(2, '0')}`
        ).trim();

        // 8. Zone Description
        const zoneDescription = masterRecord ? masterRecord.zoneDescription : String(
          rowMap['zonedescription'] ||
          rowMap['zone_description'] ||
          rowMap['zone'] ||
          rowMap['zonedesc'] ||
          'Central Zone'
        ).trim();

        // 9. Woreda
        const woreda = masterRecord ? masterRecord.woreda : String(
          rowMap['woreda'] ||
          rowMap['woredacode'] ||
          rowMap['woreda_code'] ||
          `W-${String(index + 1).padStart(2, '0')}`
        ).trim();

        // 10. Woreda Description
        const woredaDescription = masterRecord ? masterRecord.woredaDescription : String(
          rowMap['woredadescription'] ||
          rowMap['woreda_description'] ||
          rowMap['woredadesc'] ||
          rowMap['woredaname'] ||
          'General Woreda'
        ).trim();

        items.push({
          id: `hf-${timestamp}-${index}`,
          customer,
          customerDescription,
          facilityType,
          deliveringPlant,
          ownershipCode,
          ownershipDescription,
          region,
          zoneCode,
          zoneDescription,
          woreda,
          woredaDescription,
          uploadedAt: new Date().toISOString()
        });
      });

      setParsedItems(items);
      setError(null);
      setSuccessMsg(`✓ Successfully loaded and verified ${items.length} records! Ready to apply.`);
    } catch (err: any) {
      console.error('Error parsing HF data:', err);
      setError(err?.message || 'Failed to parse records from file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const readFilePromise = (file: File): Promise<any[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      if (file.name.endsWith('.json')) {
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            const rows = Array.isArray(parsed) ? parsed : parsed.items || parsed.facilities || [];
            resolve(rows);
          } catch {
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file);
      } else {
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const records = parseHealthFacilityWorkbook(workbook, file.name);
            resolve(records);
          } catch {
            resolve([]);
          }
        };
        reader.onerror = () => resolve([]);
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFilesUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    const allRows: any[] = [];
    const fileLabels: string[] = [];
    const newUploadedFiles: { name: string, url: string }[] = [];

    for (const file of files) {
      fileLabels.push(file.name);
      
      try {
        const rec = await uploadAndRecordFile(file, 'HF Master List', 0);
        if (rec) newUploadedFiles.push({ name: file.name, url: rec.downloadUrl });
      } catch (err) {
        console.warn('Cloud storage upload skipped:', err);
      }

      const rows = await readFilePromise(file);
      allRows.push(...rows);
    }
    
    setUploadedFiles(newUploadedFiles);

    if (files.length === 1) {
      setFileName(files[0].name);
    } else {
      setFileName(`${files.length} Files: ${files.map((f) => f.name).join(', ')}`);
    }

    if (allRows.length === 0) {
      setError('None of the uploaded files contained readable data rows.');
      setIsProcessing(false);
      return;
    }

    parseRawRows(allRows, fileLabels.join('; '));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      setError('Please paste spreadsheet tabular data or CSV text.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const lines = pasteText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setError('Pasted text must contain at least a header line and one data row.');
        setIsProcessing(false);
        return;
      }

      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      const headers = firstLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());
        const rowObj: Record<string, any> = {};
        headers.forEach((hdr, colIdx) => {
          rowObj[hdr] = values[colIdx] || '';
        });
        rows.push(rowObj);
      }

      setFileName(`Pasted Table (${rows.length} rows)`);
      parseRawRows(rows, 'Direct Table Paste');
    } catch (err: any) {
      setError('Failed to process pasted tabular data.');
      setIsProcessing(false);
    }
  };

  const handleLoadSampleRecords = () => {
    const timestamp = Date.now();
    const records: HealthFacilityRecord[] = DEFAULT_SAMPLE_RECORDS.map((rec, idx) => ({
      ...rec,
      id: `sample-hf-${timestamp}-${idx}`,
      uploadedAt: new Date().toISOString()
    }));
    setFileName('Sample Ethiopian Health Facility Roster (10 Facilities)');
    setParsedItems(records);
    setError(null);
    setSuccessMsg(`✓ Loaded ${records.length} sample health facility records! Click "Apply & Save to HF List" below.`);
  };

  const handleDownloadSampleTemplate = () => {
    const templateData = [{
      "Customer": "e.g. 1000214",
      "Customer Description": "e.g. Tikur Anbessa Specialized Hospital",
      "Facility Type": "Hospital",
      "Delivering Plant": "AA01",
      "Ownership Code": "GOV",
      "Ownership Description": "Public / Federal Referral",
      "Region": "Addis Ababa",
      "Zone Code": "Z-LID",
      "Zone Description": "Lideta Sub-City",
      "Woreda": "W-08",
      "Woreda Description": "Lideta Woreda 08"
    }];
    downloadCSV(`EPSS_HF_List_Template_${new Date().toISOString().split("T")[0]}.csv`, templateData);
  };

  const handleConfirmUpload = () => {
    if (parsedItems.length === 0) {
      setError('Please upload an Excel/CSV file or paste your official data before applying.');
      return;
    }
    onUploadHFData(parsedItems, uploadMode, uploadedFiles);
    handleClose();
  };

  // Preview metrics
  const uniquePlants = React.useMemo(() => {
    const s = new Set<string>();
    parsedItems.forEach((it) => s.add(it.deliveringPlant));
    return s.size;
  }, [parsedItems]);

  const uniqueRegions = React.useMemo(() => {
    const s = new Set<string>();
    parsedItems.forEach((it) => s.add(it.region));
    return s.size;
  }, [parsedItems]);

  const uniqueZones = React.useMemo(() => {
    const s = new Set<string>();
    parsedItems.forEach((it) => s.add(it.zoneDescription));
    return s.size;
  }, [parsedItems]);

  // Modal JSX
  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Off-screen file input OUTSIDE clickable container to avoid click bubbling recursion */}
      <input
        id="hf-modal-file-input"
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          opacity: 0,
          width: '1px',
          height: '1px',
          pointerEvents: 'none'
        }}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesUpload(Array.from(e.target.files));
          }
        }}
      />

      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-2xs">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Upload Health Facility (HF) Master List
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Upload Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Customer, Customer Description, Delivering Plant, Ownership Code & Description, Region, Zone & Woreda
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">
                Standard 10-Field Formats: Excel (.xlsx, .xls), CSV (.csv), JSON
              </span>
            </div>
            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template (.csv)</span>
              </button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`pb-2.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px ${
                activeTab === 'file'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Spreadsheet File Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px ${
                activeTab === 'paste'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste Tabular Data</span>
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60'
                }`}
              >
                <div className="p-3 bg-white border border-slate-200 rounded-2xl text-emerald-600 shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-800">
                    Select or drag and drop your spreadsheet file
                  </div>
                  <div className="text-xs text-slate-500">
                    Supports Excel (.xlsx, .xls) and CSV (.csv) with the 10 standard labels
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select & Browse File(s) (.xlsx, .csv)</span>
                  </button>


                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Direct Paste */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Paste Tabular Data from Excel or Google Sheets
                </label>
                
              </div>

              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Customer&#9;Customer Description&#9;Delivering Plant&#9;Ownership Code&#9;Ownership Description&#9;Region&#9;Zone Code&#9;Zone Description&#9;Woreda&#9;Woreda Description&#10;1000214&#9;Tikur Anbessa Specialized Hospital&#9;AA01&#9;GOV&#9;Public / Federal Referral&#9;Addis Ababa&#9;Z-LID&#9;Lideta Sub-City&#9;W-08&#9;Lideta Woreda 08"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-emerald-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handlePasteProcess}
                  disabled={!pasteText.trim() || isProcessing}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Parse Pasted Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-800 text-xs font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 animate-ping" />
              <span>Parsing and validating Health Facility records...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Parsed Results Live Preview */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-slate-900">
                    Ready to Ingest: {parsedItems.length} Health Facility Records
                  </span>
                </div>
                {fileName && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {fileName}
                  </span>
                )}
              </div>

              {/* Stat badges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Facilities</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                    {parsedItems.length}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Delivering Plants</div>
                  <div className="text-base font-black text-emerald-600 font-mono mt-0.5">
                    {uniquePlants}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Regions / Zones</div>
                  <div className="text-base font-black text-cyan-600 font-mono mt-0.5">
                    {uniqueRegions} Reg / {uniqueZones} Zones
                  </div>
                </div>
              </div>

              {/* Table Preview with Exact 10 Labels */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2 px-3 whitespace-nowrap">Customer</th>
                      <th className="py-2 px-3 whitespace-nowrap">Customer Description</th>
                      <th className="py-2 px-3 whitespace-nowrap">Delivering Plant</th>
                      <th className="py-2 px-3 whitespace-nowrap">Ownership Code</th>
                      <th className="py-2 px-3 whitespace-nowrap">Ownership Description</th>
                      <th className="py-2 px-3 whitespace-nowrap">Region</th>
                      <th className="py-2 px-3 whitespace-nowrap">Zone Code</th>
                      <th className="py-2 px-3 whitespace-nowrap">Zone Description</th>
                      <th className="py-2 px-3 whitespace-nowrap">Woreda</th>
                      <th className="py-2 px-3 whitespace-nowrap">Woreda Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-normal text-slate-800">
                    {parsedItems.slice(0, 10).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold text-cyan-700 whitespace-nowrap">{it.customer}</td>
                        <td className="py-1.5 px-3 font-medium whitespace-nowrap">{it.customerDescription}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-700 whitespace-nowrap">{it.deliveringPlant}</td>
                        <td className="py-1.5 px-3 font-mono text-emerald-700 whitespace-nowrap">{it.ownershipCode}</td>
                        <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{it.ownershipDescription}</td>
                        <td className="py-1.5 px-3 text-slate-700 whitespace-nowrap">{it.region}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-500 whitespace-nowrap">{it.zoneCode}</td>
                        <td className="py-1.5 px-3 text-slate-700 whitespace-nowrap">{it.zoneDescription}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-500 whitespace-nowrap">{it.woreda}</td>
                        <td className="py-1.5 px-3 text-slate-700 whitespace-nowrap">{it.woredaDescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedItems.length > 10 && (
                <div className="text-[11px] text-center text-slate-500 italic">
                  Showing first 10 of {parsedItems.length} records.
                </div>
              )}

              {/* Replace vs Append Option */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700">Import Mode:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="replace"
                      checked={uploadMode === 'replace'}
                      onChange={() => setUploadMode('replace')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Replace All Current HF Records</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="append"
                      checked={uploadMode === 'append'}
                      onChange={() => setUploadMode('append')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Append to Existing List</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetState}
              disabled={parsedItems.length === 0}
              className="px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {parsedItems.length === 0 && (
              <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                Select a valid user file or paste health facility records to activate
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={parsedItems.length === 0}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                parsedItems.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply & Save to HF List {parsedItems.length > 0 ? `(${parsedItems.length})` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
