import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Info,
  ChevronRight,
  Plus,
  Filter,
  Search,
  Building2,
  ArrowRight,
  Check,
  AlertTriangle,
  FileDown,
  FileCheck,
  FileText,
  Link2,
  ShieldCheck,
  Wrench,
  ChevronDown,
  ChevronUp,
  RotateCw,
  UploadCloud,
  Boxes
} from 'lucide-react';
import { MedicalDeviceItem, DeviceDocument, ConfirmedUploadBatch, MultipleStockRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { BatchDataConfirmationModal } from './BatchDataConfirmationModal';

export interface QueuedUploadDocMeta {
  isDocumentEnabled: boolean;
  isDocumentSubmitted: boolean;
  isExpanded: boolean;
  docTitle: string;
  docCategory: 'Official MoH Letters' | 'Breakdown Reports' | 'Technical Documentation';
  docType: string;
  docRefNumber: string;
  docSender: string;
  docRecipient: string;
  docIssuedDate: string;
  docStatus: 'Approved' | 'Action Required' | 'Under Review' | 'Dispatched';
  docNotes: string;
  attachedDocFile?: File | null;
  targetDeviceModel?: string;
  savedDocId?: string;
}

export interface QueuedUploadValidationReport {
  hasErrors: boolean;
  missingBatchRows: number[];
  missingExpiryRows: number[];
  missingMaterialRows: number[];
  missingQtyRows: number[];
  totalRows: number;
}

export interface QueuedUploadItem {
  id: string;
  file: File;
  batchName: string;
  timePeriod: string; // e.g., 'Q1 2026', '2026-05', etc.
  customDate: string; // YYYY-MM-DD
  status: 'pending' | 'parsing' | 'ready' | 'error';
  parsedCount?: number;
  errorMsg?: string;
  parsedItems?: MedicalDeviceItem[];
  nonMovingCount?: number;
  nonMovingValuation?: number;
  docMeta: QueuedUploadDocMeta;
  validationReport?: QueuedUploadValidationReport;
}

export interface UploadedBatchInfo {
  id: string;
  fileName: string;
  batchName: string;
  itemCount: number;
  timePeriod: string; // e.g., 'Q1 2026', '2026-05', etc.
  assignedDate: string; // YYYY-MM-DD
  items: MedicalDeviceItem[];
  nonMovingCount?: number;
  nonMovingValuation?: number;
  officialLetterRef?: string;
  officialLetterDate?: string;
  officialLetterIssuer?: string;
  officialLetterFileName?: string;
  isInterlocked?: boolean;
  attachedDocument?: DeviceDocument;
}

interface MultipleDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadBatches: (batches: UploadedBatchInfo[], confirmedBatch?: ConfirmedUploadBatch) => void;
  onAddDocument?: (doc: DeviceDocument) => void;
  onAcceptAndConfirmBatch?: (confirmedBatch: ConfirmedUploadBatch) => void;
  existingBatchCount?: number;
  initialMode?: 'breakdowns' | 'regionalSummary' | 'all' | 'nonMoving' | 'multipleStock';
  onUploadMultipleStockData?: (records: MultipleStockRecord[], mode?: 'append' | 'replace') => void;
}

export const MultipleDataUploadModal: React.FC<MultipleDataUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadBatches,
  onAddDocument,
  onAcceptAndConfirmBatch,
  existingBatchCount = 0,
  initialMode = 'breakdowns',
  onUploadMultipleStockData
}) => {
  const [analysisMode, setAnalysisMode] = useState<'breakdowns' | 'regionalSummary' | 'nonMoving' | 'multipleStock'>(
    initialMode === 'regionalSummary' ? 'regionalSummary' : initialMode === 'nonMoving' ? 'nonMoving' : initialMode === 'multipleStock' ? 'multipleStock' : 'breakdowns'
  );
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadItem[]>([]);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [showConfirmationReviewModal, setShowConfirmationReviewModal] = useState(false);
  const [showValidationOverlay, setShowValidationOverlay] = useState(false);
  const [selectedValidationFile, setSelectedValidationFile] = useState<QueuedUploadItem | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewBranchFilter, setPreviewBranchFilter] = useState('all');
  const [previewRdfFilter, setPreviewRdfFilter] = useState('all');
  const [previewProgramFilter, setPreviewProgramFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Official Letter Upload & MOH Interlock State
  const [officialLetterFile, setOfficialLetterFile] = useState<File | null>(null);
  const [officialLetterRef, setOfficialLetterRef] = useState<string>('MOH/DD/2026/0894');
  const [officialLetterDate, setOfficialLetterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [officialLetterIssuer, setOfficialLetterIssuer] = useState<string>('FDRE Ministry of Health - Medical Technology Directorate');
  const [isInterlockEnabled, setIsInterlockEnabled] = useState<boolean>(true);
  const letterFileInputRef = useRef<HTMLInputElement>(null);

  // Process raw row from Excel/CSV to MedicalDeviceItem
  const normalizeRowToItem = (
    r: any,
    idx: number,
    batchName: string,
    fallbackDate: string,
    forceNonMovingMode: boolean = false
  ): MedicalDeviceItem => {
    // Detect delivery status
    const rawStatus = (
      r['Delivery Status'] ||
      r['deliveryStatus'] ||
      r['DeliveryStatus'] ||
      r['Status'] ||
      r['Logistics Status'] ||
      ''
    ).toString().toLowerCase();

    let deliveryStatus: MedicalDeviceItem['deliveryStatus'] = 'Delivered & Dispatched';
    if (rawStatus.includes('transit')) deliveryStatus = 'In Transit';
    else if (rawStatus.includes('custom') || rawStatus.includes('port'))
      deliveryStatus = 'Port Customs Clearance';
    else if (rawStatus.includes('pend') || rawStatus.includes('dispatch pending'))
      deliveryStatus = 'Dispatch Pending';
    else if (rawStatus.includes('factor') || rawStatus.includes('manufactur'))
      deliveryStatus = 'Manufacturer Factory';
    else if (rawStatus.includes('deliver') || rawStatus.includes('dispatch'))
      deliveryStatus = 'Delivered & Dispatched';
    else {
      const statuses: MedicalDeviceItem['deliveryStatus'][] = [
        'Delivered & Dispatched',
        'Delivered & Dispatched',
        'In Transit',
        'Port Customs Clearance',
        'Dispatch Pending'
      ];
      deliveryStatus = statuses[idx % statuses.length];
    }

    // Detect non-moving status
    const rawNonMoving = (
      r['Non-Moving'] ||
      r['Non Moving'] ||
      r['Non-Moving Stock'] ||
      r['isNonMoving'] ||
      r['Movement Status'] ||
      r['Movement'] ||
      r['Stock Status'] ||
      r['Operational Status'] ||
      ''
    ).toString().toLowerCase();

    let isNonMoving = forceNonMovingMode;
    if (
      rawNonMoving.includes('yes') ||
      rawNonMoving.includes('true') ||
      rawNonMoving.includes('non-moving') ||
      rawNonMoving.includes('non moving') ||
      rawNonMoving.includes('slow') ||
      rawNonMoving.includes('static') ||
      rawNonMoving.includes('dead') ||
      rawNonMoving.includes('stagnant')
    ) {
      isNonMoving = true;
    }

    // Detect dates from row
    const rawDate =
      r['Delivery Date'] ||
      r['Dispatch Date'] ||
      r['Date'] ||
      r['Shipment Date'] ||
      r['Arrival Date'] ||
      r['Period'] ||
      r['Timestamp'];

    let finalDate = fallbackDate;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        finalDate = parsed.toISOString().split('T')[0];
      }
    }

    const material = String(r['Material'] || r['Material Code'] || r['SAP Code'] || `IMP-${idx + 1}`);
    const materialDescription = String(
      r['Material Description'] ||
      r['Description'] ||
      r['Item Description'] ||
      r['Device Name'] ||
      'Medical Equipment Unit'
    );
    const plantInput = String(r['Plant'] || r['plant'] || r['Branch'] || 'HO01');
    const plantName = plantInput;
    const plant = plantInput.includes('HO') ? 'HO01' : plantInput;
    const wh = String(r['Storage Location'] || r['StorageLocation'] || r['WH'] || r['Warehouse'] || 'WH1');
    const specialStockType = String(r['Special Stock Type'] || r['SpecialStockType'] || '');
    
    const unrestrictedStock = Number(r['Unrestricted Stock'] || r['UnrestrictedStock'] || r['Quantity'] || r['Qty'] || 1);
    const stockInQualityInspection = Number(r['Stock in Quality Inspection'] || r['StockInQualityInspection'] || 0);
    const blockedStock = Number(r['Blocked Stock'] || r['BlockedStock'] || 0);
    const currentValueOfUnrestrictedStock = Number(r['Current Value of Unrestricted Stock'] || r['CurrentValueOfUnrestrictedStock'] || r['Total Amount'] || r['TotalAmount'] || (unrestrictedStock * 65000));
    const inventoryValuationType = String(r['Inventory Valuation Type'] || r['InventoryValuationType'] || r['Stock Type'] || 'V');
    const materialGroupName = String(r['Material Group Name'] || r['MaterialGroupName'] || r['Material Type'] || 'Medical Device');
    const valueOfBlockedStock = Number(r['Value of Blocked Stock'] || r['ValueOfBlockedStock'] || 0);
    const valueOfStockInQualityInspection = Number(r['Value of Stock in Quality Inspection'] || r['ValueOfStockInQualityInspection'] || 0);
    const wbsElement = String(r['WBS Element'] || r['WBS'] || 'RDF-2026-SOH');

    const qty = unrestrictedStock + stockInQualityInspection + blockedStock;
    const totalAmount = currentValueOfUnrestrictedStock + valueOfBlockedStock + valueOfStockInQualityInspection;
    const unitPrice = qty > 0 ? totalAmount / qty : 65000;

    const rdfNumber = String(r['RDF Number'] || r['RDF'] || r['RDF No'] || (idx % 3 === 0 ? 'RDF-2026-001' : idx % 3 === 1 ? 'RDF-2026-002' : 'RDF-2026-003'));
    const programName = String(r['Program'] || r['Program Name'] || r['Project'] || (idx % 4 === 0 ? 'MCH Program' : idx % 4 === 1 ? 'ICU Modernization' : idx % 4 === 2 ? 'Emergency Medical Services' : 'General Healthcare'));

    return {
      id: `MD-BATCH-${Date.now().toString(36)}-${idx + 1}`,
      plant,
      plantName,
      wh,
      material,
      materialDescription,
      qty,
      totalAmount,
      unitPrice,
      stockType: inventoryValuationType,
      specialStockType,
      batch: String(r['Batch'] || r['Lot'] || `LOT-${idx + 1}`),
      expiryDate: String(r['Expiry Date'] || '31.12.2028'),
      wbsElement,
      budgetSource: String(r['Budget Source'] || r['Funding'] || 'Federal Government Treasury (EPSS)'),
      manufacturer: String(r['Manufacturer'] || r['Brand'] || 'Certified Medical Supplier'),
      materialType: materialGroupName,
      additionalAttributes: {
        'Storage Location': wh,
        'Special Stock Type': specialStockType,
        'Unrestricted Stock': String(unrestrictedStock),
        'Stock in Quality Inspection': String(stockInQualityInspection),
        'Blocked Stock': String(blockedStock),
        'Current Value of Unrestricted Stock': String(currentValueOfUnrestrictedStock),
        'Inventory Valuation Type': inventoryValuationType,
        'Material Group Name': materialGroupName,
        'Value of Blocked Stock': String(valueOfBlockedStock),
        'Value of Stock in Quality Inspection': String(valueOfStockInQualityInspection),
        'WBS Element': wbsElement
      },
      isNotFunctional: false,
      needsSparePart: false,
      isNonMoving,
      sohStatus: isNonMoving ? 'Non-Moving Stock' : 'Stock on Hand (Active)',
      fyaEpSSNoBkdStatus: isNonMoving ? 'FYA Non-Moving - No Breakdown' : 'FYA Approved - No Breakdown',
      hasDSP: true,
      isAccessorySpare: false,
      bkdType: 'Onesite',
      nextAction: isNonMoving ? 'Regional Hospital Redistribution / Decommissioning' : 'Delivery Inspection & Installation',
      wayOfIntervention: isNonMoving ? 'Inter-branch Transfer' : 'Direct Logistics Dispatch',
      responsibleBody: 'EPSS Medical Logistics Directorate',
      timeFrame: '2026',
      deliveryStatus,
      deliveryDate: finalDate,
      dispatchDate: finalDate,
      uploadBatchName: batchName,
      poNumber: String(r['PO Number'] || r['PO'] || r['Purchase Order'] || `PO-2026-${1000 + idx}`),
      procurementPackage: String(r['Package'] || r['Procurement Package'] || `PKG-${10 + (idx % 5)}`),
      rdfNumber,
      programName
    };
  };

  // Parse a single file
  const parseFile = async (
    file: File,
    batchName: string,
    fallbackDate: string
  ): Promise<MedicalDeviceItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isJson = file.name.endsWith('.json');

      if (isJson) {
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            const rawRows = Array.isArray(json) ? json : json.items || [];
            
            const missingBatchRows: number[] = [];
            const missingExpiryRows: number[] = [];
            const missingMaterialRows: number[] = [];
            const missingQtyRows: number[] = [];

            rawRows.forEach((r: any, idx: number) => {
              const rowNum = idx + 1; // 1-indexed for JSON items
              const batchVal = r.batch || r.Batch || r.Lot || r.lot;
              const expiryVal = r.expiryDate || r.ExpiryDate || r.Expiry || r.expiry;
              const materialVal = r.material || r.Material || r.MaterialCode || r.materialCode || r.SKU || r.sku;
              const qtyVal = r.qty || r.Qty || r.quantity || r.Quantity;

              if (!batchVal || String(batchVal).trim() === '') {
                missingBatchRows.push(rowNum);
              }
              if (!expiryVal || String(expiryVal).trim() === '') {
                missingExpiryRows.push(rowNum);
              }
              if (!materialVal || String(materialVal).trim() === '') {
                missingMaterialRows.push(rowNum);
              }
              if (!qtyVal || isNaN(Number(qtyVal)) || Number(qtyVal) <= 0) {
                missingQtyRows.push(rowNum);
              }
            });

            const items = rawRows.map((r: any, idx: number) =>
              normalizeRowToItem(r, idx, batchName, fallbackDate, analysisMode === 'nonMoving')
            );

            const report: QueuedUploadValidationReport = {
              hasErrors: missingBatchRows.length > 0 || missingExpiryRows.length > 0 || missingMaterialRows.length > 0 || missingQtyRows.length > 0,
              missingBatchRows,
              missingExpiryRows,
              missingMaterialRows,
              missingQtyRows,
              totalRows: rawRows.length
            };
            (items as any).validationReport = report;

            resolve(items);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsText(file);
      } else {
        // Excel or CSV
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const wb = XLSX.read(data, { type: 'binary' });
            let allItems: MedicalDeviceItem[] = [];
            
            const missingBatchRows: number[] = [];
            const missingExpiryRows: number[] = [];
            const missingMaterialRows: number[] = [];
            const missingQtyRows: number[] = [];
            let totalRowsCount = 0;

            wb.SheetNames.forEach((sheetName) => {
              const ws = wb.Sheets[sheetName];
              const rawRows = XLSX.utils.sheet_to_json<any>(ws);
              
              rawRows.forEach((r, idx) => {
                const rowNum = totalRowsCount + idx + 2; // +2 for excel sheet 1-based index (Header is row 1)
                
                const batchVal = r['Batch'] || r['batch'] || r['Lot'] || r['lot'];
                const expiryVal = r['Expiry Date'] || r['expiryDate'] || r['Expiry'] || r['expiry'] || r['ExpiryDate'];
                const materialVal = r['Material'] || r['Material Code'] || r['material'] || r['materialCode'] || r['SKU'] || r['sku'] || r['MaterialCode'];
                const qtyVal = r['Qty'] || r['Quantity'] || r['qty'] || r['quantity'];

                if (batchVal === undefined || batchVal === null || String(batchVal).trim() === '') {
                  missingBatchRows.push(rowNum);
                }
                if (expiryVal === undefined || expiryVal === null || String(expiryVal).trim() === '') {
                  missingExpiryRows.push(rowNum);
                }
                if (materialVal === undefined || materialVal === null || String(materialVal).trim() === '') {
                  missingMaterialRows.push(rowNum);
                }
                if (qtyVal === undefined || qtyVal === null || isNaN(Number(qtyVal)) || Number(qtyVal) <= 0) {
                  missingQtyRows.push(rowNum);
                }
              });

              totalRowsCount += rawRows.length;

              const items = rawRows.map((r, idx) =>
                normalizeRowToItem(r, allItems.length + idx, batchName, fallbackDate, analysisMode === 'nonMoving')
              );
              allItems = allItems.concat(items);
            });

            const report: QueuedUploadValidationReport = {
              hasErrors: missingBatchRows.length > 0 || missingExpiryRows.length > 0 || missingMaterialRows.length > 0 || missingQtyRows.length > 0,
              missingBatchRows,
              missingExpiryRows,
              missingMaterialRows,
              missingQtyRows,
              totalRows: totalRowsCount
            };
            (allItems as any).validationReport = report;

            resolve(allItems);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsBinaryString(file);
      }
    });
  };

  // Handle file selections with document metadata initialization
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newEntries: QueuedUploadItem[] = [];

    const defaultPeriods = ['Q1 2026 (Jan-Mar)', 'Q2 2026 (Apr-Jun)', 'Q3 2026 (Jul-Sep)', 'Q4 2026 (Oct-Dec)'];
    const defaultDates = ['2026-02-15', '2026-05-15', '2026-08-15', '2026-11-15'];
    const isBreakdown = analysisMode === 'breakdowns';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const batchNum = existingBatchCount + queuedFiles.length + i + 1;
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const periodIdx = (batchNum - 1) % defaultPeriods.length;
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedRef = isBreakdown ? `BKD-2026-${randomSuffix}` : `MoH/EPSS/2026/${randomSuffix}`;
      const docTitle = isBreakdown
        ? `Regional Equipment Breakdown & Defect Report: ${cleanName}`
        : `FDRE MoH Official Allocation & Clearance Directive: ${cleanName}`;
      const docSender = isBreakdown ? 'Regional Referral Hospital - Biomedical Engineering' : 'FDRE Ministry of Health - Medical Device Directorate';
      const docRecipient = 'EPSS Central Medical Operations Directorate';

      newEntries.push({
        id: `queue-${Date.now().toString(36)}-${i}-${batchNum}`,
        file,
        batchName: `Batch ${batchNum}: ${cleanName}`,
        timePeriod: defaultPeriods[periodIdx],
        customDate: defaultDates[periodIdx],
        status: 'pending',
        docMeta: {
          isDocumentEnabled: true,
          isDocumentSubmitted: false,
          isExpanded: false,
          docTitle,
          docCategory: isBreakdown ? 'Breakdown Reports' : 'Official MoH Letters',
          docType: isBreakdown ? 'Breakdown Notice' : 'MoH Approval Letter',
          docRefNumber: generatedRef,
          docSender,
          docRecipient,
          docIssuedDate: defaultDates[periodIdx] || new Date().toISOString().split('T')[0],
          docStatus: isBreakdown ? 'Action Required' : 'Approved',
          docNotes: `Official supporting documentation for batch ${cleanName} dataset ingestion containing medical device verification records and regional delivery specifications.`,
          attachedDocFile: null,
          targetDeviceModel: 'Biomedical Equipment Unit'
        }
      });
    }

    setQueuedFiles((prev) => [...prev, ...newEntries]);

    // Automatically parse each file
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      try {
        const parsed = await parseFile(entry.file, entry.batchName, entry.customDate);
        const nonMoving = parsed.filter(item => item.isNonMoving);
        const nonMovingVal = nonMoving.reduce((sum, item) => sum + (Number(item.totalAmount) || (item.qty * item.unitPrice)), 0);
        const sampleDevice = parsed[0]?.materialDescription || 'Biomedical Equipment Fleet';

        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.file === entry.file
              ? {
                  ...item,
                  status: 'ready',
                  parsedCount: parsed.length,
                  parsedItems: parsed,
                  nonMovingCount: nonMoving.length,
                  nonMovingValuation: nonMovingVal,
                  validationReport: (parsed as any).validationReport,
                  docMeta: {
                    ...item.docMeta,
                    targetDeviceModel: sampleDevice,
                    docNotes: item.docMeta.docNotes || `Verified dataset comprising ${parsed.length} medical device line items (${nonMoving.length} non-moving items audit).`
                  }
                }
              : item
          )
        );
      } catch (err: any) {
        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.file === entry.file
              ? {
                  ...item,
                  status: 'error',
                  errorMsg: err?.message || 'Failed to parse file'
                }
              : item
          )
        );
      }
    }
  };

  // Helper to persist document to archive
  const saveDocumentToArchive = (doc: DeviceDocument) => {
    if (onAddDocument) {
      onAddDocument(doc);
    }
    try {
      const raw = localStorage.getItem('epss_documents_archive');
      let list: DeviceDocument[] = raw ? JSON.parse(raw) : [];
      list = list.filter(d => d.id !== doc.id && (!doc.referenceNumber || d.referenceNumber !== doc.referenceNumber));
      list = [doc, ...list];
      localStorage.setItem('epss_documents_archive', JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('epss:documents:updated', { detail: doc }));
    } catch (err) {
      console.warn('Failed to update localStorage directly:', err);
    }
  };

  // Submit and archive document for an individual queued upload
  const handleSubmitDocumentForUpload = (idx: number) => {
    const q = queuedFiles[idx];
    if (!q) return;

    const finalRef = q.docMeta.docRefNumber.trim() || (q.docMeta.docCategory === 'Breakdown Reports' ? `BKD-2026-${Math.floor(100 + Math.random() * 900)}` : `MoH/EPSS/2026/${Math.floor(100 + Math.random() * 900)}`);
    const finalTitle = q.docMeta.docTitle.trim() || `Official Supporting Document - ${q.batchName}`;
    const docId = q.docMeta.savedDocId || `DOC-BATCH-${Date.now().toString(36)}-${idx + 1}`;

    const newDoc: DeviceDocument = {
      id: docId,
      referenceNumber: finalRef,
      title: finalTitle,
      deviceModel: q.docMeta.targetDeviceModel || q.parsedItems?.[0]?.materialDescription || 'Biomedical Equipment Unit',
      type: q.docMeta.docType || (q.docMeta.docCategory === 'Breakdown Reports' ? 'Breakdown Notice' : 'MoH Approval Letter'),
      category: q.docMeta.docCategory,
      fileSize: q.docMeta.attachedDocFile ? `${(q.docMeta.attachedDocFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(q.file.size / 1024).toFixed(1)} KB`,
      fileType: q.docMeta.attachedDocFile?.name.endsWith('.docx') ? 'DOCX' : q.docMeta.attachedDocFile?.name.endsWith('.xlsx') ? 'XLSX' : 'PDF',
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      issuedDate: new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      driveLink: 'https://drive.google.com',
      manufacturer: q.docMeta.docSender || 'FDRE Ministry of Health',
      senderFacility: q.docMeta.docSender,
      recipientFacility: q.docMeta.docRecipient,
      status: q.docMeta.docStatus,
      officialSeal: true,
      notes: q.docMeta.docNotes,
      contentPreview: `${q.docMeta.docCategory === 'Breakdown Reports' ? 'OFFICIAL REGIONAL BREAKDOWN REPORT' : 'FDRE MINISTRY OF HEALTH OFFICIAL DIRECTIVE'}
Reference: ${finalRef}
Date: ${new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Issuer: ${q.docMeta.docSender}
Recipient: ${q.docMeta.docRecipient}
Target Scope: ${q.docMeta.targetDeviceModel || 'Biomedical Equipment Fleet'}

SUBJECT: ${finalTitle.toUpperCase()}

Executive Summary & Directive:
${q.docMeta.docNotes || 'Official documentation verified and synchronized with EPSS multi-batch dataset ingestion.'}

Batch Ingestion Metrics:
• Associated Batch: ${q.batchName}
• Ingested Units: ${q.parsedCount || 0}
• Non-Moving / Critical: ${q.nonMovingCount || 0}
• Audit Period: ${q.timePeriod}`
    };

    saveDocumentToArchive(newDoc);

    setQueuedFiles(prev => prev.map((item, i) => i === idx ? {
      ...item,
      docMeta: {
        ...item.docMeta,
        isDocumentSubmitted: true,
        savedDocId: docId,
        docRefNumber: finalRef
      }
    } : item));

    setModalSuccessMessage(`✓ Document "${finalTitle}" (Ref: ${finalRef}) submitted and saved to Document Archive!`);
    setTimeout(() => setModalSuccessMessage(null), 5000);
  };

  // One-click submit and archive for all queued uploads
  const handleAutoSubmitAllDocuments = () => {
    let count = 0;
    const updated = queuedFiles.map((q, idx) => {
      const finalRef = q.docMeta.docRefNumber.trim() || (q.docMeta.docCategory === 'Breakdown Reports' ? `BKD-2026-${Math.floor(100 + Math.random() * 900)}` : `MoH/EPSS/2026/${Math.floor(100 + Math.random() * 900)}`);
      const finalTitle = q.docMeta.docTitle.trim() || `Official Supporting Document - ${q.batchName}`;
      const docId = q.docMeta.savedDocId || `DOC-BATCH-${Date.now().toString(36)}-${idx + 1}`;

      const newDoc: DeviceDocument = {
        id: docId,
        referenceNumber: finalRef,
        title: finalTitle,
        deviceModel: q.docMeta.targetDeviceModel || q.parsedItems?.[0]?.materialDescription || 'Biomedical Equipment Unit',
        type: q.docMeta.docType || (q.docMeta.docCategory === 'Breakdown Reports' ? 'Breakdown Notice' : 'MoH Approval Letter'),
        category: q.docMeta.docCategory,
        fileSize: q.docMeta.attachedDocFile ? `${(q.docMeta.attachedDocFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(q.file.size / 1024).toFixed(1)} KB`,
        fileType: q.docMeta.attachedDocFile?.name.endsWith('.docx') ? 'DOCX' : q.docMeta.attachedDocFile?.name.endsWith('.xlsx') ? 'XLSX' : 'PDF',
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        issuedDate: new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        driveLink: 'https://drive.google.com',
        manufacturer: q.docMeta.docSender || 'FDRE Ministry of Health',
        senderFacility: q.docMeta.docSender,
        recipientFacility: q.docMeta.docRecipient,
        status: q.docMeta.docStatus,
        officialSeal: true,
        notes: q.docMeta.docNotes,
        contentPreview: `${q.docMeta.docCategory === 'Breakdown Reports' ? 'OFFICIAL REGIONAL BREAKDOWN REPORT' : 'FDRE MINISTRY OF HEALTH DIRECTIVE'}
Reference: ${finalRef}
Date: ${new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Issuer: ${q.docMeta.docSender}
Recipient: ${q.docMeta.docRecipient}
Target Scope: ${q.docMeta.targetDeviceModel || 'Biomedical Equipment Fleet'}

SUBJECT: ${finalTitle.toUpperCase()}

Executive Summary & Directive:
${q.docMeta.docNotes || 'Official documentation verified and synchronized with EPSS multi-batch dataset ingestion.'}

Batch Ingestion Metrics:
• Associated Batch: ${q.batchName}
• Ingested Units: ${q.parsedCount || 0}
• Audit Period: ${q.timePeriod}`
      };

      saveDocumentToArchive(newDoc);
      count++;

      return {
        ...q,
        docMeta: {
          ...q.docMeta,
          isDocumentSubmitted: true,
          savedDocId: docId,
          docRefNumber: finalRef
        }
      };
    });

    setQueuedFiles(updated);
    setModalSuccessMessage(`✓ Automatically submitted and saved ${count} official document(s) to Document Archive!`);
    setTimeout(() => setModalSuccessMessage(null), 5000);
  };

  // Load Pre-configured Multi-Period Datasets (Demo multi-upload)
  const handleLoadDemoMultiData = (isNonMovingTarget: boolean = false) => {
    const demoPeriods = [
      {
        name: isNonMovingTarget ? 'Q1 2026 Non-Moving Stock Audit' : 'Batch A: Q1 2026 Logistics Dispatch',
        timePeriod: 'Q1 2026 (Jan-Mar)',
        date: '2026-02-20',
        count: isNonMovingTarget ? 38 : 140,
        deliveredRatio: 0.92,
        nonMovingRatio: isNonMovingTarget ? 0.95 : 0.15
      },
      {
        name: isNonMovingTarget ? 'Q2 2026 Regional Hub Stagnant Audit' : 'Batch B: Q2 2026 Regional Shipments',
        timePeriod: 'Q2 2026 (Apr-Jun)',
        date: '2026-05-15',
        count: isNonMovingTarget ? 45 : 190,
        deliveredRatio: 0.78,
        nonMovingRatio: isNonMovingTarget ? 0.92 : 0.18
      },
      {
        name: isNonMovingTarget ? 'Q3 2026 Annual Slow-Moving Reconciliation' : 'Batch C: Q3 2026 Port Customs Clearances',
        timePeriod: 'Q3 2026 (Jul-Sep)',
        date: '2026-08-10',
        count: isNonMovingTarget ? 52 : 165,
        deliveredRatio: 0.65,
        nonMovingRatio: isNonMovingTarget ? 0.90 : 0.12
      }
    ];

    const hubs = [
      'Addis Ababa Central Hub',
      'Hawassa Regional Hub',
      'Bahir Dar Regional Hub',
      'Jimma Regional Hub',
      'Mekelle Regional Hub',
      'Adama Regional Hub'
    ];

    const sampleDevices = [
      'Digital Radiography System 500mA',
      'Intensive Care Ventilator with Monitor',
      'Automated Hematology Analyzer 5-Part',
      'Mobile Operating C-Arm Fluoroscopy',
      'Infant Radiant Warmer with Phototherapy',
      'Surgical Diathermy Unit 400W',
      'Phototherapy Unit Neonatal High Intensity',
      'Anesthesia Machine with Ventilator 3-Gas',
      'Ultrasound Scanner Color Doppler 4D'
    ];

    const programs = ['MCH Program', 'ICU Modernization', 'Emergency Medical Services', 'General Healthcare', 'Infection Control'];
    const rdfs = ['RDF-2026-001', 'RDF-2026-002', 'RDF-2026-003', 'RDF-2026-004'];

    const batches: UploadedBatchInfo[] = demoPeriods.map((dp, bIdx) => {
      const items: MedicalDeviceItem[] = [];
      for (let i = 0; i < dp.count; i++) {
        const isNonMoving = Math.random() < dp.nonMovingRatio;
        const isDelivered = Math.random() < dp.deliveredRatio;
        const status: MedicalDeviceItem['deliveryStatus'] = isDelivered
          ? 'Delivered & Dispatched'
          : Math.random() < 0.5
          ? 'In Transit'
          : 'Port Customs Clearance';

        const qty = isNonMoving ? Math.floor(Math.random() * 12) + 2 : Math.floor(Math.random() * 8) + 1;
        const unitPrice = 75000 + Math.floor(Math.random() * 180000);
        const rdfNumber = rdfs[(bIdx + i) % rdfs.length];
        const programName = programs[(bIdx + i) % programs.length];
        const plantName = hubs[i % hubs.length];

        items.push({
          id: `MD-DEMO-B${bIdx + 1}-${i + 1}`,
          plant: `HUB0${(i % hubs.length) + 1}`,
          plantName,
          wh: `WH-${(i % 3) + 1}`,
          material: `DEV-2026-${bIdx + 1}-${i + 1}`,
          materialDescription: sampleDevices[i % sampleDevices.length],
          qty,
          unitPrice,
          totalAmount: qty * unitPrice,
          stockType: 'Unrestricted',
          specialStockType: '',
          batch: `LOT-2026-${dp.timePeriod.slice(0, 2)}-${i + 1}`,
          expiryDate: '31.12.2029',
          wbsElement: rdfNumber,
          budgetSource: i % 2 === 0 ? 'RDF (Revolving Drug Fund)' : 'Global Fund (GF)',
          manufacturer: 'Certified Biomedical Enterprise',
          materialType: 'Medical Device',
          isNotFunctional: false,
          needsSparePart: false,
          isNonMoving,
          sohStatus: isNonMoving ? 'Non-Moving Stock' : 'Stock on Hand (Active)',
          fyaEpSSNoBkdStatus: isNonMoving ? 'FYA Non-Moving - No Breakdown' : 'FYA Approved - No Breakdown',
          hasDSP: true,
          isAccessorySpare: false,
          bkdType: 'Onesite',
          nextAction: isNonMoving ? 'Regional Hospital Redistribution / Decommissioning' : 'Facility Handover & Commissioning',
          wayOfIntervention: isNonMoving ? 'Inter-branch Transfer' : 'Routine Preventive Maintenance',
          responsibleBody: 'EPSS Engineering Team',
          timeFrame: dp.timePeriod,
          deliveryStatus: status,
          deliveryDate: dp.date,
          dispatchDate: dp.date,
          uploadBatchName: dp.name,
          poNumber: `PO-2026-${1000 + bIdx * 100 + (i % 50)}`,
          procurementPackage: `PKG-${10 + bIdx}-${(i % 5) + 1}`,
          rdfNumber,
          programName
        });
      }

      const nonMovingItems = items.filter(i => i.isNonMoving);
      const nonMovingVal = nonMovingItems.reduce((sum, i) => sum + i.totalAmount, 0);

      // Automatically generate and archive authentic supporting document for each demo batch
      const docCat: 'Official MoH Letters' | 'Breakdown Reports' = bIdx === 1 ? 'Breakdown Reports' : 'Official MoH Letters';
      const demoRef = bIdx === 0 ? 'MoH/EPSS/2026/041' : bIdx === 1 ? 'BKD-2026-118' : 'MoH/EPSS/2026/093';
      const demoDoc: DeviceDocument = {
        id: `DOC-DEMO-${bIdx + 1}-${Date.now().toString(36)}`,
        referenceNumber: demoRef,
        title: bIdx === 1 ? `Regional Defect & Breakdown Notice: ${dp.name}` : `FDRE MoH Authorization Directive: ${dp.name}`,
        deviceModel: items[0]?.materialDescription || 'Biomedical Equipment',
        type: bIdx === 1 ? 'Breakdown Notice' : 'MoH Approval Letter',
        category: docCat,
        fileSize: '1.8 MB',
        fileType: 'PDF',
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        issuedDate: new Date(dp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        driveLink: 'https://drive.google.com',
        manufacturer: bIdx === 1 ? 'Hawassa Referral Hospital Clinical Engineering' : 'FDRE Ministry of Health',
        senderFacility: bIdx === 1 ? 'Hawassa Referral Hospital' : 'FDRE Ministry of Health',
        recipientFacility: 'EPSS Central Medical Logistics Directorate',
        status: bIdx === 1 ? 'Action Required' : 'Approved',
        officialSeal: true,
        notes: `Official supporting documentation verified and archived for ${dp.name} containing ${items.length} units.`,
        contentPreview: `FDRE OFFICIAL DOCUMENT
Reference: ${demoRef}
Date: ${dp.date}
Batch: ${dp.name}
Total Items: ${items.length}
Valuation: ETB ${nonMovingVal.toLocaleString()}`
      };
      saveDocumentToArchive(demoDoc);

      return {
        id: `batch-demo-${bIdx + 1}`,
        fileName: `${dp.name}.xlsx`,
        batchName: dp.name,
        itemCount: items.length,
        timePeriod: dp.timePeriod,
        assignedDate: dp.date,
        items,
        nonMovingCount: nonMovingItems.length,
        nonMovingValuation: nonMovingVal,
        attachedDocument: demoDoc
      };
    });

    onUploadBatches(batches);
    onClose();
  };

  const allParsedReadyItems = useMemo(() => {
    let list: MedicalDeviceItem[] = [];
    queuedFiles.forEach(q => {
      if (q.status === 'ready' && q.parsedItems) {
        list = list.concat(q.parsedItems);
      }
    });
    return list;
  }, [queuedFiles]);

  const readyQueuedFiles = useMemo(() => {
    return queuedFiles.filter(q => q.status === 'ready' && q.parsedItems && q.parsedItems.length > 0);
  }, [queuedFiles]);

  const validationTargetFile = useMemo(() => {
    if (selectedValidationFile && readyQueuedFiles.some((q) => q.id === selectedValidationFile.id)) {
      return selectedValidationFile;
    }
    return readyQueuedFiles.find((q) => q.validationReport?.hasErrors) || readyQueuedFiles[0];
  }, [selectedValidationFile, readyQueuedFiles]);

  // Submit all ready queued files & automatically save uploaded documents
  const handleCommitUploads = (confirmedBatchParam?: ConfirmedUploadBatch) => {
    const letterRefStr = officialLetterRef.trim() || 'MOH/DD/2026/0894';
    const letterNameStr = officialLetterFile ? officialLetterFile.name : 'MOH_Official_Clearance_Letter.pdf';

    let savedDocsCount = 0;

    const readyBatches: UploadedBatchInfo[] = queuedFiles
      .filter((q) => q.status === 'ready' && q.parsedItems && q.parsedItems.length > 0)
      .map((q, idx) => {
        const finalItems = q.parsedItems!.map((item) => ({
          ...item,
          uploadBatchName: q.batchName,
          deliveryDate: q.customDate || item.deliveryDate,
          dispatchDate: q.customDate || item.dispatchDate,
          officialLetterRef: isInterlockEnabled ? (q.docMeta.docRefNumber || letterRefStr) : undefined,
          officialLetterDate: isInterlockEnabled ? (q.docMeta.docIssuedDate || officialLetterDate) : undefined,
          officialLetterIssuer: isInterlockEnabled ? (q.docMeta.docSender || officialLetterIssuer) : undefined,
          officialLetterFileName: isInterlockEnabled ? (q.docMeta.attachedDocFile?.name || letterNameStr) : undefined,
          isInterlocked: isInterlockEnabled
        }));

        const nonMoving = finalItems.filter(i => i.isNonMoving);
        const nonMovingVal = nonMoving.reduce((sum, i) => sum + (Number(i.totalAmount) || (i.qty * i.unitPrice)), 0);

        // Automatically create and save official document to archive for this upload
        let attachedDoc: DeviceDocument | undefined;
        if (q.docMeta && q.docMeta.isDocumentEnabled) {
          const finalRef = q.docMeta.docRefNumber.trim() || (q.docMeta.docCategory === 'Breakdown Reports' ? `BKD-2026-${Math.floor(100 + Math.random() * 900)}` : `MoH/EPSS/2026/${Math.floor(100 + Math.random() * 900)}`);
          const finalTitle = q.docMeta.docTitle.trim() || `Official Supporting Document - ${q.batchName}`;
          const docId = q.docMeta.savedDocId || `DOC-BATCH-${Date.now().toString(36)}-${idx + 1}`;

          attachedDoc = {
            id: docId,
            referenceNumber: finalRef,
            title: finalTitle,
            deviceModel: q.docMeta.targetDeviceModel || finalItems[0]?.materialDescription || 'Biomedical Equipment Unit',
            type: q.docMeta.docType || (q.docMeta.docCategory === 'Breakdown Reports' ? 'Breakdown Notice' : 'MoH Approval Letter'),
            category: q.docMeta.docCategory,
            fileSize: q.docMeta.attachedDocFile ? `${(q.docMeta.attachedDocFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(q.file.size / 1024).toFixed(1)} KB`,
            fileType: q.docMeta.attachedDocFile?.name.endsWith('.docx') ? 'DOCX' : q.docMeta.attachedDocFile?.name.endsWith('.xlsx') ? 'XLSX' : 'PDF',
            lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            issuedDate: new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            driveLink: 'https://drive.google.com',
            manufacturer: q.docMeta.docSender || 'FDRE Ministry of Health',
            senderFacility: q.docMeta.docSender,
            recipientFacility: q.docMeta.docRecipient,
            status: q.docMeta.docStatus,
            officialSeal: true,
            notes: q.docMeta.docNotes,
            contentPreview: `${q.docMeta.docCategory === 'Breakdown Reports' ? 'OFFICIAL REGIONAL BREAKDOWN REPORT' : 'FDRE MINISTRY OF HEALTH OFFICIAL DIRECTIVE'}
Reference: ${finalRef}
Date: ${new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Issuer: ${q.docMeta.docSender}
Recipient: ${q.docMeta.docRecipient}
Target Scope: ${q.docMeta.targetDeviceModel || 'Biomedical Equipment Fleet'} (${finalItems.length} items)

SUBJECT: ${finalTitle.toUpperCase()}

Executive Summary & Directive:
${q.docMeta.docNotes || 'Document verified and synchronized with EPSS multi-batch inventory ingestion.'}

Batch Ingestion Metrics:
• Total Registered Units: ${finalItems.reduce((acc, i) => acc + (Number(i.qty) || 1), 0)}
• Line Items: ${finalItems.length}
• Total Valuation: ETB ${finalItems.reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0).toLocaleString()}
• Ingestion Period: ${q.timePeriod}`
          };

          saveDocumentToArchive(attachedDoc);
          savedDocsCount++;
        }

        return {
          id: `batch-${Date.now()}-${idx}`,
          fileName: q.file.name,
          batchName: q.batchName,
          itemCount: finalItems.length,
          timePeriod: q.timePeriod,
          assignedDate: q.customDate,
          items: finalItems,
          nonMovingCount: nonMoving.length,
          nonMovingValuation: nonMovingVal,
          officialLetterRef: isInterlockEnabled ? (q.docMeta.docRefNumber || letterRefStr) : undefined,
          officialLetterDate: isInterlockEnabled ? (q.docMeta.docIssuedDate || officialLetterDate) : undefined,
          officialLetterIssuer: isInterlockEnabled ? (q.docMeta.docSender || officialLetterIssuer) : undefined,
          officialLetterFileName: isInterlockEnabled ? (q.docMeta.attachedDocFile?.name || letterNameStr) : undefined,
          isInterlocked: isInterlockEnabled,
          attachedDocument: attachedDoc
        };
      });

    if (readyBatches.length > 0) {
      if (confirmedBatchParam) {
        onAcceptAndConfirmBatch?.(confirmedBatchParam);
      }
      onUploadBatches(readyBatches, confirmedBatchParam);
      onClose();
    }
  };

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    const sampleRows = analysisMode === 'breakdowns'
      ? [
          {
            'Material Code': '402-RAD-001',
            'Material Description': 'Stationary Digital X-Ray Machine 500mA',
            'Branch': 'Addis Ababa Central Hub',
            'Facility': 'Tikur Anbessa Specialized Hospital',
            'Quantity': 2,
            'Breakdown Status': 'Defective - High Voltage Generator Fault',
            'Breakdown Category': 'Power / Generator Board',
            'Spare Parts Needed': 'HV Tank Diode Assembly',
            'Maintenance Urgency': 'Critical',
            'Unit Price': 1450000
          },
          {
            'Material Code': '402-ICU-002',
            'Material Description': 'ICU Invasive Mechanical Ventilator',
            'Branch': 'Hawassa Regional Hub',
            'Facility': 'Hawassa University Comprehensive Hospital',
            'Quantity': 3,
            'Breakdown Status': 'Defective - Oxygen Sensor Depleted',
            'Breakdown Category': 'Sensor & Calibration',
            'Spare Parts Needed': 'O2 Fuel Cell Sensor (Galvanic)',
            'Maintenance Urgency': 'High',
            'Unit Price': 850000
          },
          {
            'Material Code': '402-LAB-003',
            'Material Description': 'Automated Clinical Chemistry Analyzer',
            'Branch': 'Jimma Regional Hub',
            'Facility': 'Jimma Medical Center',
            'Quantity': 1,
            'Breakdown Status': 'Non-Functional - Photometer Lamp Failure',
            'Breakdown Category': 'Optics & Lamp',
            'Spare Parts Needed': 'Halogen Lamp 12V 20W',
            'Maintenance Urgency': 'Medium',
            'Unit Price': 620000
          }
        ]
      : analysisMode === 'regionalSummary'
      ? [
          {
            'Regional Hub': 'Addis Ababa Central Hub',
            'Region / Zone': 'Addis Ababa',
            'Material Description': 'Clinical Diagnostic & Imaging Suite',
            'Total Allocated': 48,
            'Operational Devices': 42,
            'Breakdown Devices': 4,
            'Under Commissioning': 2,
            'Reporting Period': 'Q2 2026',
            'Regional Director': 'Dr. Solomon Bekele'
          },
          {
            'Regional Hub': 'Hawassa Regional Hub',
            'Region / Zone': 'Sidama',
            'Material Description': 'Maternal & Neonatal Care Units',
            'Total Allocated': 36,
            'Operational Devices': 31,
            'Breakdown Devices': 3,
            'Under Commissioning': 2,
            'Reporting Period': 'Q2 2026',
            'Regional Director': 'Sr. Meseret Tadesse'
          },
          {
            'Regional Hub': 'Dire Dawa Regional Hub',
            'Region / Zone': 'Dire Dawa Admin',
            'Material Description': 'Emergency & Trauma Equipment',
            'Total Allocated': 24,
            'Operational Devices': 21,
            'Breakdown Devices': 2,
            'Under Commissioning': 1,
            'Reporting Period': 'Q2 2026',
            'Regional Director': 'Eng. Ahmed Nur'
          }
        ]
      : [
          {
            'Material': '402-RAD-001',
            'Material Description': 'Stationary Digital X-Ray Machine 500mA',
            'Plant': 'HO01',
            'Storage Location': 'WH01',
            'Special Stock Type': 'E',
            'Unrestricted Stock': 15,
            'Stock in Quality Inspection': 2,
            'Blocked Stock': 1,
            'Current Value of Unrestricted Stock': 21750000,
            'Inventory Valuation Type': 'V',
            'Material Group Name': 'Diagnostic Imaging',
            'Value of Blocked Stock': 1450000,
            'Value of Stock in Quality Inspection': 2900000,
            'WBS Element': 'WBS-RAD-2026-01'
          },
          {
            'Material': '402-ICU-002',
            'Material Description': 'ICU Invasive Mechanical Ventilator',
            'Plant': 'HW02',
            'Storage Location': 'WH02',
            'Special Stock Type': '',
            'Unrestricted Stock': 22,
            'Stock in Quality Inspection': 3,
            'Blocked Stock': 0,
            'Current Value of Unrestricted Stock': 18700000,
            'Inventory Valuation Type': 'V',
            'Material Group Name': 'Critical Care',
            'Value of Blocked Stock': 0,
            'Value of Stock in Quality Inspection': 2550000,
            'WBS Element': 'WBS-ICU-2026-02'
          }
        ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    const sheetName = analysisMode === 'breakdowns' ? 'Breakdowns_Medical_Device' : analysisMode === 'regionalSummary' ? 'Summary_Regional_Report' : 'Multiple_Stock_Inventory';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileName = analysisMode === 'breakdowns' ? 'MOH_Medical_Device_Breakdowns_Template.xlsx' : analysisMode === 'regionalSummary' ? 'MOH_Regional_Report_Summary_Template.xlsx' : 'EPSS_Multiple_Stock_Inventory_Template.xlsx';
    XLSX.writeFile(wb, fileName);
  };

  // Aggregated preview of all parsed queued items
  const aggregatedParsedItems = useMemo(() => {
    let all: MedicalDeviceItem[] = [];
    queuedFiles.forEach(q => {
      if (q.parsedItems && Array.isArray(q.parsedItems)) {
        all = all.concat(q.parsedItems);
      }
    });
    return all;
  }, [queuedFiles]);

  const filteredPreviewItems = useMemo(() => {
    let list = aggregatedParsedItems;
    if (analysisMode === 'nonMoving') {
      list = list.filter(i => i.isNonMoving);
    }
    if (previewBranchFilter !== 'all') {
      list = list.filter(i => i.plantName === previewBranchFilter);
    }
    if (previewRdfFilter !== 'all') {
      list = list.filter(i => i.rdfNumber === previewRdfFilter);
    }
    if (previewProgramFilter !== 'all') {
      list = list.filter(i => i.programName === previewProgramFilter);
    }
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      list = list.filter(
        i =>
          i.materialDescription.toLowerCase().includes(q) ||
          i.material.toLowerCase().includes(q) ||
          i.plantName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [aggregatedParsedItems, analysisMode, previewBranchFilter, previewRdfFilter, previewProgramFilter, previewSearch]);

  const previewBranchList = useMemo(() => Array.from(new Set(aggregatedParsedItems.map(i => i.plantName).filter(Boolean))).sort(), [aggregatedParsedItems]);
  const previewRdfList = useMemo(() => Array.from(new Set(aggregatedParsedItems.map(i => i.rdfNumber).filter(Boolean))).sort(), [aggregatedParsedItems]);
  const previewProgramList = useMemo(() => Array.from(new Set(aggregatedParsedItems.map(i => i.programName).filter(Boolean))).sort(), [aggregatedParsedItems]);

  const totalPreviewUnits = filteredPreviewItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const totalPreviewValuation = filteredPreviewItems.reduce((sum, i) => sum + (Number(i.totalAmount) || (i.qty * i.unitPrice)), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60 border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-emerald-600 text-white border-emerald-700 shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  MOH Dual-Upload: Official Letter & Technical Reports
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Official MoH Portal (No SOH)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload official Ministry authorization letter interlocked with Breakdowns of Medical Device and Summary of Regional Reports (Stock on Hand / SOH is excluded).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Bar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Report Category:</span>
            <button
              type="button"
              onClick={() => setAnalysisMode('breakdowns')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                analysisMode === 'breakdowns'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Breakdowns of Medical Device</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisMode('regionalSummary')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                analysisMode === 'regionalSummary'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Summary of Regional Report</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisMode('multipleStock')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                analysisMode === 'multipleStock'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Multiple Stock Inventory</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>Download Template</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Multi-file Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelect(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? analysisMode === 'breakdowns' ? 'border-rose-500 bg-rose-50/50' : 'border-emerald-500 bg-emerald-50/50'
                : analysisMode === 'breakdowns' ? 'border-rose-300 hover:border-rose-500 hover:bg-rose-50/30' : 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".xlsx,.xls,.csv,.json"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-3 ${
              analysisMode === 'breakdowns' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}>
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">
              {analysisMode === 'breakdowns'
                ? 'Drop Breakdowns of Medical Device spreadsheets here (.xlsx, .csv, .json)'
                : 'Drop Summary of Regional Report datasets here (.xlsx, .csv, .json)'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {analysisMode === 'breakdowns'
                ? 'Upload equipment breakdown logs, defective device assessments, and spare parts requisition sheets.'
                : 'Upload regional hubs summary reports, regional device distribution, and health facility operational status.'}
            </p>
            <div className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-xs ${
              analysisMode === 'breakdowns' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'
            }`}>
              <Plus className="w-3.5 h-3.5" />
              <span>Select {analysisMode === 'breakdowns' ? 'Breakdown Files' : 'Regional Summary Files'}</span>
            </div>
          </div>

          {/* MOH Official Letter Upload & Interlocking Engine Section */}
          <div className="border border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-extrabold text-sm text-slate-900">
                      FDRE Ministry of Health (MOH) Official Letter Upload
                    </h5>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                      Interlocked Compliance
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Upload official authorization/clearance letter separately to interlock with uploaded multi-data spreadsheets.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs hover:bg-emerald-50 transition self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={isInterlockEnabled}
                  onChange={(e) => setIsInterlockEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-emerald-400 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-950">
                  Interlock Data Batches with Official MOH Letter
                </span>
              </label>
            </div>

            {isInterlockEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Letter Dropzone / Attachment Box */}
                <div
                  onClick={() => letterFileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-white p-4.5 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[145px]"
                >
                  <input
                    type="file"
                    ref={letterFileInputRef}
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setOfficialLetterFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {officialLetterFile ? (
                    <div className="space-y-1.5 text-center">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate max-w-[220px] mx-auto">
                        {officialLetterFile.name}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold">
                        {(officialLetterFile.size / 1024).toFixed(1)} KB • Separate Official Letter Attached
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOfficialLetterFile(null);
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:underline mt-1 cursor-pointer"
                      >
                        Change / Replace Letter File
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                      <span className="font-bold text-xs text-slate-900">Upload Official MOH Letter (PDF/DOC/Image)</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Click or drag official approval document</span>
                      <span className="mt-2 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        Separate Document Upload Slot
                      </span>
                    </>
                  )}
                </div>

                {/* Official Letter Form Metadata */}
                <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-emerald-200 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      Official Letter Reference No. *
                    </label>
                    <input
                      type="text"
                      value={officialLetterRef}
                      onChange={(e) => setOfficialLetterRef(e.target.value)}
                      placeholder="e.g. MOH/DD/2026/0894"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Letter Issue Date
                      </label>
                      <input
                        type="date"
                        value={officialLetterDate}
                        onChange={(e) => setOfficialLetterDate(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Issuing Directorate
                      </label>
                      <input
                        type="text"
                        value={officialLetterIssuer}
                        onChange={(e) => setOfficialLetterIssuer(e.target.value)}
                        placeholder="e.g. MOH Technology Directorate"
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 text-xs"
                      />
                    </div>
                  </div>

                  {/* Interlock Visual Binding Status Card */}
                  <div className="mt-2 p-2 rounded-lg bg-emerald-950 text-emerald-300 flex items-center justify-between text-[11px] border border-emerald-800 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span className="font-extrabold uppercase text-[10px] tracking-wider">Interlocked:</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-200 font-semibold truncate max-w-[190px]">
                      {queuedFiles.length} Data Batches ↔ {officialLetterRef || 'Ref Pending'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Pre-configured Data Banner */}
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-amber-600 shadow-2xs flex items-center justify-center shrink-0 border border-amber-100">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">
                  {analysisMode === 'nonMoving'
                    ? 'Quick Load: Pre-configured Multi-Quarter Non-Moving Stock Audit'
                    : 'Quick Load: Pre-configured Multi-Quarter Datasets'}
                </h5>
                <p className="text-[11px] text-slate-600">
                  {analysisMode === 'nonMoving'
                    ? 'Instantly test multi-batch non-moving stock comparison across Q1, Q2, and Q3 with branch, RDF, and program telemetry.'
                    : 'Instantly load 3 comparative datasets (Q1 2026, Q2 2026, and Q3 2026) with 495 items for immediate testing.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleLoadDemoMultiData(analysisMode === 'nonMoving')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
            >
              <span>Load 3-Period Demo</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* In-modal Success Notification */}
          {modalSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Queued Files List with Document Submission Features */}
          {queuedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span>Queued Datasets & Documents ({queuedFiles.length})</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {queuedFiles.filter(q => q.docMeta?.isDocumentSubmitted).length} of {queuedFiles.length} Submitted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoSubmitAllDocuments}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1.5"
                    title="Generate and save official documents for every queued upload"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Auto-Submit All Documents</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {queuedFiles.map((q, idx) => (
                  <div
                    key={`${q.file.name}-${idx}`}
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs transition hover:border-slate-300"
                  >
                    {/* Top Row: File, Batch Name, Metrics, Date, Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={q.batchName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQueuedFiles((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, batchName: val } : item))
                              );
                            }}
                            className="font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white px-1 py-0.5 rounded outline-hidden truncate w-full sm:w-64"
                          />
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                            <span>{(q.file.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            {q.status === 'ready' && (
                              <span className="text-slate-700 font-medium">
                                <strong className="text-slate-900 font-bold">{q.parsedCount}</strong> total items •{' '}
                                <strong className="text-amber-800 font-bold">{q.nonMovingCount || 0} Non-Moving</strong> ({formatCurrency(q.nonMovingValuation || 0, true)})
                              </span>
                            )}
                            {q.status === 'ready' && q.validationReport && (
                              <>
                                <span>•</span>
                                {q.validationReport.hasErrors ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedValidationFile(q);
                                      setShowValidationOverlay(true);
                                    }}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition inline-flex items-center gap-1 cursor-pointer animate-pulse"
                                    title="Click to view full data validation overlay and rows"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    <span>Validation Warnings (Click to Inspect)</span>
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-150 inline-flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Data Integrity Verified</span>
                                  </span>
                                )}
                              </>
                            )}
                            {q.status === 'parsing' && <span className="text-blue-600 font-medium">Parsing...</span>}
                            {q.status === 'error' && <span className="text-rose-600 font-bold">{q.errorMsg}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Middle & Right Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        {/* Status Badge */}
                        {q.docMeta.isDocumentSubmitted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span>Submitted ({q.docMeta.docRefNumber})</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-indigo-600" />
                            <span>Doc Auto-Save</span>
                          </span>
                        )}

                        <input
                          type="date"
                          value={q.customDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQueuedFiles((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, customDate: val } : item))
                            );
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
                          title="Audit / Ingestion Date"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setQueuedFiles((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, docMeta: { ...item.docMeta, isExpanded: !item.docMeta.isExpanded } }
                                  : item
                              )
                            );
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                            q.docMeta.isExpanded
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{q.docMeta.isDocumentSubmitted ? 'Edit Document' : 'Submit Document'}</span>
                          {q.docMeta.isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => {
                            setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Document Submission Drawer */}
                    {q.docMeta.isExpanded && (
                      <div className="border border-indigo-200 bg-white rounded-xl p-4 space-y-3.5 animate-fadeIn shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                              {q.docMeta.docCategory === 'Breakdown Reports' ? (
                                <Wrench className="w-4 h-4" />
                              ) : (
                                <Building2 className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <h6 className="font-bold text-xs text-slate-900">
                                Associated Official Document Submission
                              </h6>
                              <p className="text-[10px] text-slate-500">
                                This document will be automatically saved to Google Workspace & Uploaded Documents Archive.
                              </p>
                            </div>
                          </div>

                          {/* Category Selector Tabs */}
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                            {(['Official MoH Letters', 'Breakdown Reports', 'Technical Documentation'] as const).map(
                              (cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setQueuedFiles((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? {
                                              ...item,
                                              docMeta: {
                                                ...item.docMeta,
                                                docCategory: cat,
                                                docType: cat === 'Breakdown Reports' ? 'Breakdown Notice' : 'MoH Approval Letter'
                                              }
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                                    q.docMeta.docCategory === cat
                                      ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {cat}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Document Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Document Subject / Title
                            </label>
                            <input
                              type="text"
                              value={q.docMeta.docTitle}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, docTitle: val } } : item
                                  )
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 font-medium"
                              placeholder="e.g., FDRE MoH Clearance Letter or Regional Breakdown Assessment"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                Official Reference Number
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const randomSuffix = Math.floor(100 + Math.random() * 900);
                                  const newRef = q.docMeta.docCategory === 'Breakdown Reports'
                                    ? `BKD-2026-${randomSuffix}`
                                    : `MoH/EPSS/2026/${randomSuffix}`;
                                  setQueuedFiles((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, docMeta: { ...item.docMeta, docRefNumber: newRef } } : item
                                    )
                                  );
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer font-semibold"
                                title="Generate random reference code"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>Regenerate Ref</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={q.docMeta.docRefNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, docRefNumber: val } } : item
                                  )
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-800"
                              placeholder="MoH/EPSS/2026/041"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Issuing Authority / Sender
                            </label>
                            <input
                              type="text"
                              value={q.docMeta.docSender}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, docSender: val } } : item
                                  )
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Recipient Facility / Directorate
                            </label>
                            <input
                              type="text"
                              value={q.docMeta.docRecipient}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, docRecipient: val } } : item
                                  )
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Issued Date
                              </label>
                              <input
                                type="date"
                                value={q.docMeta.docIssuedDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQueuedFiles((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, docMeta: { ...item.docMeta, docIssuedDate: val } } : item
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Document Status
                              </label>
                              <select
                                value={q.docMeta.docStatus}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setQueuedFiles((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, docMeta: { ...item.docMeta, docStatus: val } } : item
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 font-semibold"
                              >
                                <option value="Approved">Approved</option>
                                <option value="Action Required">Action Required</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Dispatched">Dispatched</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Attach File / Scan Copy (Optional)
                            </label>
                            <div className="flex items-center gap-2">
                              <label className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shrink-0">
                                <Upload className="w-3.5 h-3.5 text-slate-600" />
                                <span>{q.docMeta.attachedDocFile ? 'Change File' : 'Attach Document'}</span>
                                <input
                                  type="file"
                                  accept=".pdf,.docx,.xlsx,.png,.jpg"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      const chosen = e.target.files[0];
                                      setQueuedFiles((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, docMeta: { ...item.docMeta, attachedDocFile: chosen } } : item
                                        )
                                      );
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-[11px] text-slate-500 truncate">
                                {q.docMeta.attachedDocFile ? q.docMeta.attachedDocFile.name : 'PDF, DOCX, or scan copy'}
                              </span>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Executive Summary / Findings / Directives
                            </label>
                            <textarea
                              rows={2}
                              value={q.docMeta.docNotes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, docNotes: val } } : item
                                  )
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500"
                              placeholder="Add official notes, breakdown diagnostic conclusions, or allocation specifications..."
                            />
                          </div>
                        </div>

                        {/* Actions for this individual document */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={q.docMeta.isDocumentEnabled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setQueuedFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, docMeta: { ...item.docMeta, isDocumentEnabled: checked } } : item
                                  )
                                );
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs text-slate-700 font-medium">
                              Automatically save this document to Archive during batch import
                            </span>
                          </label>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSubmitDocumentForUpload(idx)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>{q.docMeta.isDocumentSubmitted ? 'Update & Save Document' : 'Submit & Save Document Now'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Batch Preview & Filtering by Branch, RDF, Program */}
          {aggregatedParsedItems.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-600" />
                  <h5 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Multi-Batch Cross-Dataset Filter Preview (Branch • RDF • Program)
                  </h5>
                </div>
                <div className="text-xs font-mono font-bold text-slate-700">
                  Showing <span className="text-amber-700">{formatNumber(totalPreviewUnits)} units</span> ({formatCurrency(totalPreviewValuation, true)})
                </div>
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search device..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900"
                  />
                </div>

                <select
                  value={previewBranchFilter}
                  onChange={(e) => setPreviewBranchFilter(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-900"
                >
                  <option value="all">All Branches ({previewBranchList.length})</option>
                  {previewBranchList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <select
                  value={previewRdfFilter}
                  onChange={(e) => setPreviewRdfFilter(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-900"
                >
                  <option value="all">All RDFs ({previewRdfList.length})</option>
                  {previewRdfList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                  value={previewProgramFilter}
                  onChange={(e) => setPreviewProgramFilter(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none text-slate-900"
                >
                  <option value="all">All Programs ({previewProgramList.length})</option>
                  {previewProgramList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Mini-table of parsed non-moving items */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Device / Material</th>
                      <th className="py-2 px-3">Branch / Hub</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">RDF</th>
                      <th className="py-2 px-3">Program</th>
                      <th className="py-2 px-3">Batch File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                          No items match the selected branch/RDF/program filters
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewItems.slice(0, 30).map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-semibold text-slate-900 truncate max-w-[200px]">{item.materialDescription}</td>
                          <td className="py-1.5 px-3 text-slate-600">{item.plantName}</td>
                          <td className="py-1.5 px-3 font-bold text-amber-800">{item.qty}</td>
                          <td className="py-1.5 px-3 text-slate-500 font-mono text-[10px]">{item.rdfNumber || '-'}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                              {item.programName || 'General'}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-400 text-[10px] truncate max-w-[120px]">{item.uploadBatchName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {queuedFiles.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  {queuedFiles.filter((q) => q.status === 'ready').length} of {queuedFiles.length}{' '}
                  datasets ready ({aggregatedParsedItems.length} total records)
                </span>
                <span>•</span>
                <span className="text-indigo-700 font-semibold flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  {queuedFiles.filter((q) => q.docMeta?.isDocumentEnabled).length} document(s) will automatically save to Archive
                </span>
              </div>
            ) : (
              <span>Upload 1 or more files to start multi-dataset analysis</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              Cancel
            </button>
            
            <button
              disabled={readyQueuedFiles.length === 0}
              onClick={() => {
                const hasErrors = readyQueuedFiles.some((q) => q.validationReport?.hasErrors);
                if (hasErrors) {
                  setShowValidationOverlay(true);
                } else {
                  setShowConfirmationReviewModal(true);
                }
              }}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                readyQueuedFiles.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-700/20'
                  : 'bg-slate-300 cursor-not-allowed shadow-none'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Review & Accept Data Confirmation ({readyQueuedFiles.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accept Data Confirmation Modal Step */}
      {showConfirmationReviewModal && (
        <BatchDataConfirmationModal
          isOpen={showConfirmationReviewModal}
          onClose={() => setShowConfirmationReviewModal(false)}
          pendingItems={allParsedReadyItems}
          sourceFileNames={readyQueuedFiles.map((q) => q.file.name)}
          batchName={`Batch Ingestion (${readyQueuedFiles.length} datasets) - ${new Date().toLocaleDateString()}`}
          pendingDocuments={readyQueuedFiles
            .filter((q) => q.docMeta.isDocumentEnabled)
            .map((q, idx) => ({
              id: q.docMeta.savedDocId || `DOC-BATCH-${Date.now().toString(36)}-${idx + 1}`,
              referenceNumber: q.docMeta.docRefNumber.trim() || `MoH/EPSS/2026/${Math.floor(100 + Math.random() * 900)}`,
              title: q.docMeta.docTitle.trim() || `Official Supporting Document - ${q.batchName}`,
              deviceModel: q.docMeta.targetDeviceModel || q.parsedItems?.[0]?.materialDescription || 'Biomedical Equipment Unit',
              type: q.docMeta.docType || 'MoH Approval Letter',
              category: q.docMeta.docCategory,
              fileSize: q.docMeta.attachedDocFile ? `${(q.docMeta.attachedDocFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(q.file.size / 1024).toFixed(1)} KB`,
              fileType: q.docMeta.attachedDocFile?.name.endsWith('.docx') ? 'DOCX' : q.docMeta.attachedDocFile?.name.endsWith('.xlsx') ? 'XLSX' : 'PDF',
              lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              issuedDate: new Date(q.docMeta.docIssuedDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              driveLink: 'https://drive.google.com',
              manufacturer: q.docMeta.docSender || 'FDRE Ministry of Health',
              senderFacility: q.docMeta.docSender,
              recipientFacility: q.docMeta.docRecipient,
              status: q.docMeta.docStatus,
              officialSeal: true,
              notes: q.docMeta.docNotes
            }))}
          onAcceptAndConfirm={(confirmedBatch) => {
            handleCommitUploads(confirmedBatch);
            setShowConfirmationReviewModal(false);
          }}
        />
      )}

      {/* ⚠️ Bulk Ingestion Data Validation Overlay */}
      {showValidationOverlay && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-amber-500 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Dataset Validation & Compliance Check</h3>
                  <p className="text-xs text-white/90">Review missing or non-compliant cells flagged across spreadsheet records before committing to SOH database</p>
                </div>
              </div>
              <button
                onClick={() => setShowValidationOverlay(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Dashboard Grid */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
              
              {/* Left Sidebar: File list & high-level stats */}
              <div className="col-span-1 md:col-span-4 border-r border-slate-150 bg-slate-50/50 p-4 space-y-3 overflow-y-auto">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Imported Datasets</span>
                <div className="space-y-2">
                  {readyQueuedFiles.map((q) => {
                    const isActive = validationTargetFile?.id === q.id;
                    const report = q.validationReport;
                    const totalIssues = (report?.missingBatchRows.length || 0) + 
                                        (report?.missingExpiryRows.length || 0) + 
                                        (report?.missingMaterialRows.length || 0) + 
                                        (report?.missingQtyRows.length || 0);

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setSelectedValidationFile(q)}
                        className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-rose-50/70 border-rose-200 ring-1 ring-rose-300'
                            : 'bg-white border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-[11px] font-black text-slate-800 truncate block w-full">{q.batchName}</span>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-slate-500 font-mono font-medium">{q.parsedCount} rows total</span>
                          {totalIssues > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 text-[9px] border border-rose-150 inline-flex items-center gap-0.5">
                              {totalIssues} warnings
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 text-[9px] border border-emerald-150">
                              Verified ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel: validation detail focus */}
              <div className="col-span-1 md:col-span-8 p-6 overflow-y-auto space-y-5">
                {validationTargetFile ? (
                  <>
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Compliance Breakdown for:
                      </h4>
                      <p className="text-sm font-bold text-slate-800 truncate mt-1">
                        {validationTargetFile.batchName}
                      </p>
                    </div>

                    {/* Alert banner */}
                    {validationTargetFile.validationReport?.hasErrors ? (
                      <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 flex gap-3 text-xs text-rose-800 leading-relaxed">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold text-rose-900 block mb-0.5">Mandatory Data Fields Missing</strong>
                          This dataset contains empty or invalid fields. The system will auto-apply standard fallbacks to ensure application flow is preserved, but reviewing your source file is recommended.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex gap-3 text-xs text-emerald-800">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <strong className="font-bold text-emerald-900 block">Clean Data Compliance</strong>
                          No missing values or non-compliant rows found. Excel layout is 100% sound.
                        </div>
                      </div>
                    )}

                    {/* Interactive Report Cards */}
                    {validationTargetFile.validationReport && (
                      <div className="space-y-4">
                        {/* 1. Missing Batch / Lot */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                              1. Batch / Lot Numbers
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {validationTargetFile.validationReport.missingBatchRows.length} issues
                            </span>
                          </div>
                          {validationTargetFile.validationReport.missingBatchRows.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-600">
                                Missing on row(s):{' '}
                                <strong className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {validationTargetFile.validationReport.missingBatchRows.join(', ')}
                                </strong>
                              </p>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-500 font-medium">
                                <span className="text-amber-800 font-bold block mb-1">💡 Ingestion Resolution Rule:</span>
                                Automatically assigns a standardized batch name format: <code className="font-mono bg-slate-100 text-slate-800 px-1 rounded">{"LOT-[row_index]"}</code>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-700 font-semibold">✓ Perfect. All batch codes are present.</p>
                          )}
                        </div>

                        {/* 2. Missing Expiry Date */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                              2. Expiry Dates
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {validationTargetFile.validationReport.missingExpiryRows.length} issues
                            </span>
                          </div>
                          {validationTargetFile.validationReport.missingExpiryRows.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-600">
                                Missing on row(s):{' '}
                                <strong className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {validationTargetFile.validationReport.missingExpiryRows.join(', ')}
                                </strong>
                              </p>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-500 font-medium">
                                <span className="text-amber-800 font-bold block mb-1">💡 Ingestion Resolution Rule:</span>
                                Automatically maps a standard fallback validity period: <code className="font-mono bg-slate-100 text-slate-800 px-1 rounded">{"31.12.2028"}</code>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-700 font-semibold">✓ Perfect. All expiration dates are present.</p>
                          )}
                        </div>

                        {/* 3. Missing Material sku */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                              3. Material / SKU Codes
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {validationTargetFile.validationReport.missingMaterialRows.length} issues
                            </span>
                          </div>
                          {validationTargetFile.validationReport.missingMaterialRows.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-600">
                                Missing on row(s):{' '}
                                <strong className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {validationTargetFile.validationReport.missingMaterialRows.join(', ')}
                                </strong>
                              </p>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-500 font-medium">
                                <span className="text-amber-800 font-bold block mb-1">💡 Ingestion Resolution Rule:</span>
                                Assigns unique autogenerated material indexes: <code className="font-mono bg-slate-100 text-slate-800 px-1 rounded">{"IMP-[row_index]"}</code>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-700 font-semibold">✓ Perfect. All material codes are present.</p>
                          )}
                        </div>

                        {/* 4. Missing Qty */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                              4. Quantities / Pcs
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {validationTargetFile.validationReport.missingQtyRows.length} issues
                            </span>
                          </div>
                          {validationTargetFile.validationReport.missingQtyRows.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-600">
                                Invalid on row(s):{' '}
                                <strong className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {validationTargetFile.validationReport.missingQtyRows.join(', ')}
                                </strong>
                              </p>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-500 font-medium">
                                <span className="text-amber-800 font-bold block mb-1">💡 Ingestion Resolution Rule:</span>
                                Enforces default minimum item quantity: <code className="font-mono bg-slate-100 text-slate-800 px-1 rounded">{"1 Pcs"}</code>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-700 font-semibold">✓ Perfect. All quantities are valid.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Select an imported file on the left sidebar to view compliance flags
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setShowValidationOverlay(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Go Back to Fix Source
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowValidationOverlay(false);
                    setShowConfirmationReviewModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-md shadow-amber-600/15 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bypass Warnings & Proceed to Ingestion</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
