import React, { useState, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Building2,
  CircleDollarSign,
  Package,
  Plus
} from 'lucide-react';
import { MedicalDeviceAgreement, AgreementStatus, UploadedAgreementBatch } from '../types';

interface QueuedAgreementFile {
  id: string;
  file: File;
  batchName: string;
  source: string;
  timePeriod: string;
  status: 'pending' | 'parsing' | 'ready' | 'error';
  parsedCount?: number;
  totalAgreedUnits?: number;
  totalValueETB?: number;
  errorMsg?: string;
  parsedAgreements?: MedicalDeviceAgreement[];
  showPreview?: boolean;
}

interface MultipleAgreementUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadBatches: (batches: UploadedAgreementBatch[]) => void;
  existingBatchCount?: number;
}

export const MultipleAgreementUploadModal: React.FC<MultipleAgreementUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadBatches,
  existingBatchCount = 0
}) => {
  const [queuedFiles, setQueuedFiles] = useState<QueuedAgreementFile[]>([]);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to normalize column header strings
  const cleanHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Map raw spreadsheet row to MedicalDeviceAgreement
  const normalizeRowToAgreement = (
    r: any,
    idx: number,
    batchId: string,
    batchName: string,
    defaultSource: string,
    defaultPeriod: string
  ): MedicalDeviceAgreement => {
    // Build lookup with cleaned keys
    const rowMap: Record<string, any> = {};
    Object.keys(r).forEach((key) => {
      rowMap[cleanHeader(key)] = r[key];
    });

    const getVal = (...aliases: string[]) => {
      for (const alias of aliases) {
        const cleaned = cleanHeader(alias);
        if (rowMap[cleaned] !== undefined && rowMap[cleaned] !== null && String(rowMap[cleaned]).trim() !== '') {
          return rowMap[cleaned];
        }
      }
      return undefined;
    };

    // Agreement Number
    const rawNumber = getVal(
      'agreementnumber',
      'agreementno',
      'contractnumber',
      'contractno',
      'accordno',
      'ref',
      'ponumber',
      'id'
    );
    const agreementNumber = rawNumber ? String(rawNumber).trim() : `EPSS/MDA/UP-${Date.now().toString().slice(-4)}-${idx + 1}`;

    // Title / Equipment Description
    const rawTitle = getVal(
      'title',
      'devicename',
      'description',
      'medicaldevice',
      'equipment',
      'scope',
      'itemdescription'
    );
    const title = rawTitle ? String(rawTitle).trim() : `Medical Device Consignment ${idx + 1}`;

    // Supplier / Vendor
    const rawSupplier = getVal('supplier', 'vendor', 'manufacturer', 'company', 'contractor');
    const supplier = rawSupplier ? String(rawSupplier).trim() : 'Contracted Medical Device Vendor';

    // Supplier Country
    const rawCountry = getVal('suppliercountry', 'country', 'origin', 'manufacturerorigin');
    const supplierCountry = rawCountry ? String(rawCountry).trim() : 'International';

    // Procurement Package
    const rawPkg = getVal('procurementpackage', 'package', 'pkg', 'category', 'lot');
    let procurementPackage = 'Package 1: Imaging & Radiology';
    if (rawPkg) {
      const pStr = String(rawPkg).toLowerCase();
      if (pStr.includes('icu') || pStr.includes('life support') || pStr.includes('ventilator')) {
        procurementPackage = 'Package 2: ICU & Life Support';
      } else if (pStr.includes('lab') || pStr.includes('diagnost')) {
        procurementPackage = 'Package 3: Laboratory & Diagnostics';
      } else if (pStr.includes('surg') || pStr.includes('theatre') || pStr.includes('or')) {
        procurementPackage = 'Package 4: Surgical & Theatre';
      } else if (pStr.includes('matern') || pStr.includes('neonat') || pStr.includes('child') || pStr.includes('infant')) {
        procurementPackage = 'Package 5: Maternal, Neonatal & Child Health';
      } else if (pStr.includes('general') || pStr.includes('hospital') || pStr.includes('bed')) {
        procurementPackage = 'Package 6: General Medical & Hospital Equipment';
      } else if (pStr.includes('imag') || pStr.includes('radio') || pStr.includes('x-ray') || pStr.includes('scan')) {
        procurementPackage = 'Package 1: Imaging & Radiology';
      } else {
        procurementPackage = String(rawPkg);
      }
    }

    // Funding Source
    const rawFunding = getVal('fundingsource', 'funding', 'donor', 'financestream', 'financedby');
    let fundingSource = defaultSource || 'MOH Regular Treasury';
    if (rawFunding) {
      const fStr = String(rawFunding).toLowerCase();
      if (fStr.includes('rdf') || fStr.includes('revolving')) {
        fundingSource = 'Revolving Drug Fund (RDF)';
      } else if (fStr.includes('global fund') || fStr.includes('gfatm')) {
        fundingSource = 'Global Fund (GFATM)';
      } else if (fStr.includes('world bank') || fStr.includes('wb')) {
        fundingSource = 'World Bank Health Program';
      } else if (fStr.includes('unicef')) {
        fundingSource = 'UNICEF Bilateral Grant';
      } else if (fStr.includes('treasury') || fStr.includes('moh')) {
        fundingSource = 'MOH Regular Treasury';
      } else {
        fundingSource = String(rawFunding);
      }
    }

    // Dates
    const rawSignDate = getVal('contractsigndate', 'signdate', 'agreementdate', 'startdate');
    let contractSignDate = '2025-10-01';
    if (rawSignDate) {
      const parsed = new Date(rawSignDate);
      if (!isNaN(parsed.getTime())) {
        contractSignDate = parsed.toISOString().split('T')[0];
      } else {
        contractSignDate = String(rawSignDate).trim();
      }
    }

    const rawDeliveryDate = getVal('committeddeliverydate', 'deliverydate', 'deadline', 'targetdate', 'duedate');
    let committedDeliveryDate = '2026-06-30';
    if (rawDeliveryDate) {
      const parsed = new Date(rawDeliveryDate);
      if (!isNaN(parsed.getTime())) {
        committedDeliveryDate = parsed.toISOString().split('T')[0];
      } else {
        committedDeliveryDate = String(rawDeliveryDate).trim();
      }
    }

    // Quantities
    const totalAgreedUnits = Math.max(
      1,
      Number(getVal('totalagreedunits', 'agreedunits', 'targetunits', 'contractedqty', 'totalunits', 'qty', 'quantity') || 100)
    );
    const deliveredUnits = Math.max(
      0,
      Number(getVal('deliveredunits', 'delivered', 'fulfilledunits', 'receivedqty') || Math.round(totalAgreedUnits * 0.65))
    );
    const inTransitUnits = Math.max(
      0,
      Number(getVal('intransitunits', 'intransit', 'transitunits', 'shipped') || 0)
    );
    const customsUnits = Math.max(
      0,
      Number(getVal('customsunits', 'customs', 'portcustoms', 'customsclearance') || 0)
    );
    const pendingUnits = Math.max(0, totalAgreedUnits - (deliveredUnits + inTransitUnits + customsUnits));

    // Values (ETB)
    const rawVal = getVal('totalcontractvalueetb', 'contractvalue', 'totalvalue', 'totalcontractvalue', 'amountetb', 'valueetb');
    const totalContractValueETB = Math.max(
      100000,
      Number(rawVal || totalAgreedUnits * 1250000)
    );

    const rawDeliveredVal = getVal('deliveredvalueetb', 'deliveredvalue', 'disbursedetb');
    const deliveredValueETB = rawDeliveredVal !== undefined
      ? Number(rawDeliveredVal)
      : Math.round((deliveredUnits / totalAgreedUnits) * totalContractValueETB);

    // Status
    const rawStatus = getVal('status', 'deliverystatus', 'agreementstatus');
    let status: AgreementStatus = 'On Track';
    if (rawStatus) {
      const s = String(rawStatus).toLowerCase();
      if (s.includes('fully') || s.includes('100') || s.includes('complete')) {
        status = 'Fully Delivered';
      } else if (s.includes('approach') || s.includes('near')) {
        status = 'Approaching Deadline';
      } else if (s.includes('delay') || s.includes('critic')) {
        status = 'Delayed / Critical';
      } else if (s.includes('lc') || s.includes('contract issue')) {
        status = 'Contract / LC Issue';
      } else if (s.includes('track')) {
        status = 'On Track';
      }
    } else {
      if (deliveredUnits >= totalAgreedUnits) {
        status = 'Fully Delivered';
      } else if (deliveredUnits / totalAgreedUnits < 0.4 && new Date(committedDeliveryDate) < new Date('2026-06-01')) {
        status = 'Approaching Deadline';
      } else {
        status = 'On Track';
      }
    }

    // SLA & Warranty
    const slaComplianceScore = Math.min(
      100,
      Math.max(50, Number(getVal('slacompliancescore', 'sla', 'slascore') || (status === 'Fully Delivered' ? 98 : status === 'Delayed / Critical' ? 68 : 88)))
    );
    const warrantyYears = Math.max(1, Number(getVal('warrantyyears', 'warranty') || 3));
    const maintenanceTerms = String(
      getVal('maintenanceterms', 'maintenance', 'supportterms') || `${warrantyYears * 12} Months Comprehensive PPM & Onsite Maintenance`
    );
    const penaltyRatePerDay = Number(getVal('penaltyrateperday', 'penaltyrate') || 0.001);

    // Assigned Health Facilities / Hubs
    const rawPlants = getVal('assignedplants', 'assignedhubs', 'healthfacilities', 'facilities', 'hubs', 'destinations');
    let assignedPlants: string[] = ['Addis Ababa Central Hub', 'Hawassa Hub', 'Jimma Hub'];
    if (rawPlants) {
      if (Array.isArray(rawPlants)) {
        assignedPlants = rawPlants.map((p) => String(p).trim()).filter(Boolean);
      } else {
        assignedPlants = String(rawPlants)
          .split(/[,;\/|]/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
    }

    // Keywords
    const linkedKeywords = [
      title.toLowerCase(),
      supplier.toLowerCase().split(' ')[0],
      procurementPackage.toLowerCase().split(':')[0]
    ];

    return {
      id: `agr-upload-${batchId}-${idx + 1}-${Date.now().toString().slice(-4)}`,
      agreementNumber,
      title,
      supplier,
      supplierCountry,
      procurementPackage,
      fundingSource,
      contractSignDate,
      committedDeliveryDate,
      totalAgreedUnits,
      deliveredUnits,
      inTransitUnits,
      customsUnits,
      pendingUnits,
      totalContractValueETB,
      deliveredValueETB,
      status,
      slaComplianceScore,
      warrantyYears,
      maintenanceTerms,
      penaltyRatePerDay,
      assignedPlants,
      contactPerson: String(getVal('contactperson', 'contact') || 'EPSS Procurement Director'),
      contactEmail: String(getVal('contactemail', 'email') || 'procurement@epss.gov.et'),
      linkedKeywords,
      notes: String(getVal('notes', 'remark') || `Imported via ${batchName} (${defaultPeriod})`),
      isCustom: true,
      uploadBatchId: batchId,
      uploadBatchName: batchName
    };
  };

  // Parse a single file (JSON, XLSX, CSV)
  const parseAgreementFile = async (
    file: File,
    batchId: string,
    batchName: string,
    source: string,
    period: string
  ): Promise<MedicalDeviceAgreement[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isJson = file.name.endsWith('.json');

      if (isJson) {
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            const rawRows = Array.isArray(json) ? json : json.agreements || json.items || [];
            const parsed = rawRows.map((r: any, idx: number) =>
              normalizeRowToAgreement(r, idx, batchId, batchName, source, period)
            );
            resolve(parsed);
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
            let allAccords: MedicalDeviceAgreement[] = [];

            wb.SheetNames.forEach((sheetName) => {
              const ws = wb.Sheets[sheetName];
              const rawRows = XLSX.utils.sheet_to_json<any>(ws);
              const accords = rawRows.map((r, idx) =>
                normalizeRowToAgreement(r, allAccords.length + idx, batchId, batchName, source, period)
              );
              allAccords = allAccords.concat(accords);
            });

            resolve(allAccords);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsBinaryString(file);
      }
    });
  };

  // Handle multi-file selection via file input or drag-and-drop
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const defaultSources = [
      'MOH Regular Treasury',
      'Global Fund (GFATM)',
      'World Bank Health Program',
      'Revolving Drug Fund (RDF)',
      'UNICEF Bilateral Grant'
    ];
    const defaultPeriods = ['FY 2025/2026', 'Q2 2026', 'Q3 2026', '2026 Emergency Expansion'];

    const newEntries: QueuedAgreementFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const batchNum = existingBatchCount + queuedFiles.length + i + 1;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const sourceIdx = (batchNum - 1) % defaultSources.length;
      const periodIdx = (batchNum - 1) % defaultPeriods.length;
      const batchId = `batch-${Date.now().toString().slice(-6)}-${i + 1}`;

      newEntries.push({
        id: batchId,
        file,
        batchName: `Batch ${batchNum}: ${cleanName}`,
        source: defaultSources[sourceIdx],
        timePeriod: defaultPeriods[periodIdx],
        status: 'pending'
      });
    }

    setQueuedFiles((prev) => [...prev, ...newEntries]);

    // Automatically parse each file in sequence
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      try {
        setQueuedFiles((prev) =>
          prev.map((item) => (item.id === entry.id ? { ...item, status: 'parsing' } : item))
        );

        const parsed = await parseAgreementFile(
          entry.file,
          entry.id,
          entry.batchName,
          entry.source,
          entry.timePeriod
        );

        const totalUnits = parsed.reduce((sum, a) => sum + a.totalAgreedUnits, 0);
        const totalVal = parsed.reduce((sum, a) => sum + a.totalContractValueETB, 0);

        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: 'ready',
                  parsedCount: parsed.length,
                  totalAgreedUnits: totalUnits,
                  totalValueETB: totalVal,
                  parsedAgreements: parsed
                }
              : item
          )
        );
      } catch (err: any) {
        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: 'error',
                  errorMsg: err?.message || 'Failed to parse file format'
                }
              : item
          )
        );
      }
    }
  };

  // Re-parse when batch parameters (source / period / batchName) change
  const handleUpdateBatchMeta = async (
    batchId: string,
    field: 'batchName' | 'source' | 'timePeriod',
    value: string
  ) => {
    setQueuedFiles((prev) =>
      prev.map((q) => {
        if (q.id !== batchId) return q;
        const updated = { ...q, [field]: value };
        // If agreements exist, update their embedded batch properties
        if (updated.parsedAgreements) {
          updated.parsedAgreements = updated.parsedAgreements.map((a) => ({
            ...a,
            uploadBatchName: field === 'batchName' ? value : a.uploadBatchName,
            fundingSource: field === 'source' ? value : a.fundingSource,
            notes: field === 'timePeriod' ? `Imported via ${updated.batchName} (${value})` : a.notes
          }));
        }
        return updated;
      })
    );
  };

  const handleRemoveQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((q) => q.id !== id));
  };

  const togglePreview = (id: string) => {
    setQueuedFiles((prev) =>
      prev.map((q) => (q.id === id ? { ...q, showPreview: !q.showPreview } : q))
    );
  };

  // Load 3 Pre-configured Multi-Source Datasets (Demo Multi-Data Upload)
  const handleLoadDemoMultiData = () => {
    setIsProcessing(true);

    const demoSources = [
      {
        batchName: 'MOH Regular Treasury - 2026 Maternal & Child Health Accord',
        source: 'MOH Regular Treasury',
        period: 'FY 2025/2026',
        accords: [
          {
            agreementNumber: 'MOH/MDA/2026/041',
            title: 'Digital Mammography & Comprehensive Diagnostic Stations',
            supplier: 'Hologic & Planmed Consortium',
            supplierCountry: 'USA / Finland',
            procurementPackage: 'Package 1: Imaging & Radiology',
            fundingSource: 'MOH Regular Treasury',
            contractSignDate: '2025-11-20',
            committedDeliveryDate: '2026-05-30',
            totalAgreedUnits: 140,
            deliveredUnits: 95,
            inTransitUnits: 30,
            customsUnits: 15,
            pendingUnits: 0,
            totalContractValueETB: 185000000,
            deliveredValueETB: 125500000,
            status: 'On Track' as AgreementStatus,
            slaComplianceScore: 94,
            warrantyYears: 3,
            maintenanceTerms: '36 Months Comprehensive Onsite PPM & Calibration',
            penaltyRatePerDay: 0.001,
            assignedPlants: ['Addis Ababa Central Hub', 'Hawassa Hub', 'Dire Dawa Hub'],
            contactPerson: 'Dr. Almaz Kebede (MOH Director)',
            contactEmail: 'maternal.procure@moh.gov.et',
            linkedKeywords: ['mammography', 'imaging', 'planmed', 'hologic'],
            notes: 'MOH 2026 Priority maternal imaging framework'
          },
          {
            agreementNumber: 'MOH/MDA/2026/042',
            title: 'Advanced Infant Radiant Warmers & Neonatal Phototherapy',
            supplier: 'GE Healthcare Maternal Division',
            supplierCountry: 'USA',
            procurementPackage: 'Package 5: Maternal, Neonatal & Child Health',
            fundingSource: 'MOH Regular Treasury',
            contractSignDate: '2025-12-05',
            committedDeliveryDate: '2026-06-15',
            totalAgreedUnits: 260,
            deliveredUnits: 180,
            inTransitUnits: 50,
            customsUnits: 30,
            pendingUnits: 0,
            totalContractValueETB: 112000000,
            deliveredValueETB: 77500000,
            status: 'On Track' as AgreementStatus,
            slaComplianceScore: 96,
            warrantyYears: 2,
            maintenanceTerms: '24 Months Replacement Parts & Sensor Calibration',
            penaltyRatePerDay: 0.001,
            assignedPlants: ['All 19 EPSS Regional Hubs & Teaching Hospitals'],
            contactPerson: 'W/ro Selamawit Hailu',
            contactEmail: 'neonatal.epss@moh.gov.et',
            linkedKeywords: ['warmer', 'phototherapy', 'neonatal', 'infant'],
            notes: 'Nationwide distribution to primary maternal wards'
          }
        ]
      },
      {
        batchName: 'Global Fund (GFATM) - 2026 Diagnostic Laboratory Package',
        source: 'Global Fund (GFATM)',
        period: 'Q2 2026',
        accords: [
          {
            agreementNumber: 'GFATM/ETH/2026/LAB-08',
            title: 'Automated High-Throughput Clinical Chemistry & Immunoassay Analyzers',
            supplier: 'Roche Diagnostics Middle East',
            supplierCountry: 'Switzerland',
            procurementPackage: 'Package 3: Laboratory & Diagnostics',
            fundingSource: 'Global Fund (GFATM)',
            contractSignDate: '2025-09-15',
            committedDeliveryDate: '2026-04-20',
            totalAgreedUnits: 175,
            deliveredUnits: 175,
            inTransitUnits: 0,
            customsUnits: 0,
            pendingUnits: 0,
            totalContractValueETB: 215000000,
            deliveredValueETB: 215000000,
            status: 'Fully Delivered' as AgreementStatus,
            slaComplianceScore: 99,
            warrantyYears: 3,
            maintenanceTerms: 'Reagent Rental Integration & 36 Months 24/7 Hotline Support',
            penaltyRatePerDay: 0.0015,
            assignedPlants: ['Addis Ababa Central Hub', 'Jimma Hub', 'Mekelle Hub', 'Bahir Dar Hub'],
            contactPerson: 'Tadesse Girma (GFATM Grant Mgr)',
            contactEmail: 'gfatm.lab@epss.gov.et',
            linkedKeywords: ['chemistry', 'roche', 'immunoassay', 'laboratory'],
            notes: 'Grant milestone 4 complete 100% verified fulfillment'
          },
          {
            agreementNumber: 'GFATM/ETH/2026/LAB-09',
            title: 'Molecular PCR Amplification & Viral Load Platforms',
            supplier: 'Cepheid International',
            supplierCountry: 'Sweden',
            procurementPackage: 'Package 3: Laboratory & Diagnostics',
            fundingSource: 'Global Fund (GFATM)',
            contractSignDate: '2025-10-10',
            committedDeliveryDate: '2026-07-31',
            totalAgreedUnits: 120,
            deliveredUnits: 60,
            inTransitUnits: 35,
            customsUnits: 15,
            pendingUnits: 10,
            totalContractValueETB: 148000000,
            deliveredValueETB: 74000000,
            status: 'Approaching Deadline' as AgreementStatus,
            slaComplianceScore: 89,
            warrantyYears: 3,
            maintenanceTerms: '36 Months Module Swap Guarantee & Calibration',
            penaltyRatePerDay: 0.001,
            assignedPlants: ['Adama Hub', 'Gondar Hub', 'Dessie Hub', 'Hawassa Hub'],
            contactPerson: 'Dr. Solomon Abera',
            contactEmail: 'molecular@epss.gov.et',
            linkedKeywords: ['genexpert', 'pcr', 'cepheid', 'viral load'],
            notes: 'Critical TB/HIV diagnostics consignment'
          }
        ]
      },
      {
        batchName: 'World Bank Health Program - 2026 ICU & Surgical Care Accord',
        source: 'World Bank Health Program',
        period: '2026-2027 Expansion',
        accords: [
          {
            agreementNumber: 'WB/HSDP/2026/SURG-19',
            title: 'Laparoscopic Surgical Towers & HD Endoscopic Suites',
            supplier: 'Karl Storz SE & Co. KG',
            supplierCountry: 'Germany',
            procurementPackage: 'Package 4: Surgical & Theatre',
            fundingSource: 'World Bank Health Program',
            contractSignDate: '2025-11-01',
            committedDeliveryDate: '2026-08-30',
            totalAgreedUnits: 90,
            deliveredUnits: 45,
            inTransitUnits: 25,
            customsUnits: 10,
            pendingUnits: 10,
            totalContractValueETB: 168000000,
            deliveredValueETB: 84000000,
            status: 'On Track' as AgreementStatus,
            slaComplianceScore: 92,
            warrantyYears: 3,
            maintenanceTerms: 'Biomedical Engineer Onsite Training & 3 Years Parts Replacement',
            penaltyRatePerDay: 0.001,
            assignedPlants: ['Black Lion Hospital', 'St. Paul Millennium', 'Tibebe Ghion Hub', 'Jimma Hub'],
            contactPerson: 'Eng. Yohannes Tesfaye',
            contactEmail: 'surgical.wb@moh.gov.et',
            linkedKeywords: ['laparoscopy', 'karl storz', 'endoscopy', 'surgical tower'],
            notes: 'Minimally invasive surgical upgrade initiative'
          },
          {
            agreementNumber: 'WB/HSDP/2026/ICU-20',
            title: 'Adult & Pediatric Invasive ICU Ventilators',
            supplier: 'Hamilton Medical AG',
            supplierCountry: 'Switzerland',
            procurementPackage: 'Package 2: ICU & Life Support',
            fundingSource: 'World Bank Health Program',
            contractSignDate: '2025-10-15',
            committedDeliveryDate: '2026-06-10',
            totalAgreedUnits: 150,
            deliveredUnits: 70,
            inTransitUnits: 40,
            customsUnits: 25,
            pendingUnits: 15,
            totalContractValueETB: 195000000,
            deliveredValueETB: 91000000,
            status: 'On Track' as AgreementStatus,
            slaComplianceScore: 95,
            warrantyYears: 3,
            maintenanceTerms: '36 Months Turbine Replacement & Sensor Coverage',
            penaltyRatePerDay: 0.001,
            assignedPlants: ['Addis Ababa Central Hub', 'Hawassa Hub', 'Bahir Dar Hub', 'Mekelle Hub'],
            contactPerson: 'Dr. Michael Desta',
            contactEmail: 'criticalcare@epss.gov.et',
            linkedKeywords: ['ventilator', 'hamilton', 'icu', 'respiratory'],
            notes: 'Secondary & tertiary referral ICU expansion'
          }
        ]
      }
    ];

    const batches: UploadedAgreementBatch[] = demoSources.map((ds, bIdx) => {
      const bId = `batch-demo-${Date.now().toString().slice(-6)}-${bIdx + 1}`;
      const agreements: MedicalDeviceAgreement[] = ds.accords.map((a, aIdx) => ({
        ...a,
        id: `demo-agr-${bIdx + 1}-${aIdx + 1}-${Date.now().toString().slice(-4)}`,
        isCustom: true,
        uploadBatchId: bId,
        uploadBatchName: ds.batchName
      }));

      const totalAgreed = agreements.reduce((s, a) => s + a.totalAgreedUnits, 0);
      const totalDelivered = agreements.reduce((s, a) => s + a.deliveredUnits, 0);
      const totalVal = agreements.reduce((s, a) => s + a.totalContractValueETB, 0);

      return {
        id: bId,
        fileName: `${ds.batchName.split(' - ')[0].replace(/\s+/g, '_')}_Accords.xlsx`,
        batchName: ds.batchName,
        source: ds.source,
        timePeriod: ds.period,
        uploadDate: new Date().toISOString().split('T')[0],
        agreementCount: agreements.length,
        totalAgreedUnits: totalAgreed,
        totalDeliveredUnits: totalDelivered,
        totalValueETB: totalVal,
        agreements
      };
    });

    setTimeout(() => {
      setIsProcessing(false);
      onUploadBatches(batches);
      onClose();
    }, 400);
  };

  // Commit all queued and ready files into the application
  const handleCommitUploads = () => {
    const readyBatches: UploadedAgreementBatch[] = queuedFiles
      .filter((q) => q.status === 'ready' && q.parsedAgreements && q.parsedAgreements.length > 0)
      .map((q) => {
        const accords = q.parsedAgreements!;
        const totalAgreed = accords.reduce((s, a) => s + a.totalAgreedUnits, 0);
        const totalDelivered = accords.reduce((s, a) => s + a.deliveredUnits, 0);
        const totalVal = accords.reduce((s, a) => s + a.totalContractValueETB, 0);

        return {
          id: q.id,
          fileName: q.file.name,
          batchName: q.batchName,
          source: q.source,
          timePeriod: q.timePeriod,
          uploadDate: new Date().toISOString().split('T')[0],
          agreementCount: accords.length,
          totalAgreedUnits: totalAgreed,
          totalDeliveredUnits: totalDelivered,
          totalValueETB: totalVal,
          agreements: accords
        };
      });

    if (readyBatches.length > 0) {
      onUploadBatches(readyBatches);
      onClose();
    }
  };

  // Download Agreement Spreadsheet Template (Excel)
  const handleDownloadExcelTemplate = () => {
    const sampleRows = [
      {
        'Agreement Number': 'EPSS/MDA/2026/099',
        'Title': 'Digital Mobile C-Arm Imaging Systems',
        'Supplier': 'Siemens Healthineers',
        'Supplier Country': 'Germany',
        'Procurement Package': 'Package 1: Imaging & Radiology',
        'Funding Source': 'MOH Regular Treasury',
        'Contract Sign Date': '2025-11-15',
        'Committed Delivery Date': '2026-06-30',
        'Total Agreed Units': 85,
        'Delivered Units': 50,
        'In Transit Units': 25,
        'Customs Units': 10,
        'Total Contract Value (ETB)': 125000000,
        'Delivered Value (ETB)': 73500000,
        'Status': 'On Track',
        'SLA Compliance Score %': 95,
        'Warranty (Years)': 3,
        'Maintenance Terms': '36 Months Comprehensive Onsite PPM',
        'Assigned Hubs': 'Addis Ababa Central Hub, Hawassa Hub, Jimma Hub',
        'Contact Person': 'Dr. Kebede Worku',
        'Contact Email': 'procure@siemens.com'
      },
      {
        'Agreement Number': 'EPSS/MDA/2026/100',
        'Title': 'Automated Blood Gas & Electrolyte Analyzers',
        'Supplier': 'Radiometer Medical ApS',
        'Supplier Country': 'Denmark',
        'Procurement Package': 'Package 3: Laboratory & Diagnostics',
        'Funding Source': 'Global Fund (GFATM)',
        'Contract Sign Date': '2025-10-01',
        'Committed Delivery Date': '2026-05-15',
        'Total Agreed Units': 120,
        'Delivered Units': 120,
        'In Transit Units': 0,
        'Customs Units': 0,
        'Total Contract Value (ETB)': 98000000,
        'Delivered Value (ETB)': 98000000,
        'Status': 'Fully Delivered',
        'SLA Compliance Score %': 98,
        'Warranty (Years)': 2,
        'Maintenance Terms': '24 Months Sensor Reagents & PPM Support',
        'Assigned Hubs': 'All 19 EPSS Regional Hubs',
        'Contact Person': 'W/ro Bethlehem Tadesse',
        'Contact Email': 'support@radiometer.com'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreements_Template');
    XLSX.writeFile(wb, 'EPSS_Medical_Device_Agreements_Template.xlsx');
  };

  // Download CSV Template
  const handleDownloadCsvTemplate = () => {
    const csvContent =
      'Agreement Number,Title,Supplier,Supplier Country,Procurement Package,Funding Source,Contract Sign Date,Committed Delivery Date,Total Agreed Units,Delivered Units,In Transit Units,Customs Units,Total Contract Value (ETB),Delivered Value (ETB),Status,SLA Compliance Score %,Warranty (Years),Maintenance Terms,Assigned Hubs,Contact Person,Contact Email\n' +
      'EPSS/MDA/2026/099,Digital Mobile C-Arm Imaging Systems,Siemens Healthineers,Germany,Package 1: Imaging & Radiology,MOH Regular Treasury,2025-11-15,2026-06-30,85,50,25,10,125000000,73500000,On Track,95,3,36 Months Comprehensive Onsite PPM,"Addis Ababa Central Hub, Hawassa Hub, Jimma Hub",Dr. Kebede Worku,procure@siemens.com\n' +
      'EPSS/MDA/2026/100,Automated Blood Gas & Electrolyte Analyzers,Radiometer Medical,Denmark,Package 3: Laboratory & Diagnostics,Global Fund (GFATM),2025-10-01,2026-05-15,120,120,0,0,98000000,98000000,Fully Delivered,98,2,24 Months Sensor Reagents & PPM Support,All 19 EPSS Regional Hubs,W/ro Bethlehem Tadesse,support@radiometer.com\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'EPSS_Medical_Device_Agreements_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const readyFilesCount = queuedFiles.filter((q) => q.status === 'ready').length;
  const totalAgreementsToImport = queuedFiles.reduce((sum, q) => sum + (q.parsedCount || 0), 0);
  const totalValueToImport = queuedFiles.reduce((sum, q) => sum + (q.totalValueETB || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 via-blue-900 to-cyan-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Upload className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  Upload Multiple Agreement Datasets
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                  Multi-Batch Ingestion
                </span>
              </div>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Ingest multiple Excel, CSV, or JSON agreement files simultaneously to perform comparative and aggregated delivery analysis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Quick Demo Pre-load Bar */}
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 p-4 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Instant Multi-Source Demonstration (3 Preconfigured Accords)
                </h4>
                <p className="text-[11px] text-slate-600">
                  Load MOH Treasury, Global Fund, and World Bank agreement datasets with a single click.
                </p>
              </div>
            </div>
            <button
              onClick={handleLoadDemoMultiData}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Load 3 Multi-Source Datasets</span>
            </button>
          </div>

          {/* Drag & Drop Upload Zone */}
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
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/60 scale-[0.99]'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.json"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 shadow-inner">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-black text-slate-800">
              Drag & Drop Multiple Agreement Files Here
            </h4>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Select multiple <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, or <strong>.json</strong> files. Each file is parsed into a distinct agreement batch for comparative tracking.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300">
                Browse Files
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadExcelTemplate();
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel Template</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadCsvTemplate();
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV Template</span>
              </button>
            </div>
          </div>

          {/* Queued Files / Datasets List */}
          {queuedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Queued Agreement Datasets ({queuedFiles.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    &bull; {readyFilesCount} Ready &bull; {totalAgreementsToImport} Total Accords
                  </span>
                </div>
                <button
                  onClick={() => setQueuedFiles([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>

              <div className="space-y-3">
                {queuedFiles.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            q.status === 'ready'
                              ? 'bg-emerald-50 text-emerald-600'
                              : q.status === 'error'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          {q.status === 'ready' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : q.status === 'error' ? (
                            <AlertCircle className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5 animate-spin" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {q.file.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({(q.file.size / 1024).toFixed(1)} KB)
                            </span>
                            {q.status === 'ready' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {q.parsedCount} Accords &bull; {q.totalAgreedUnits?.toLocaleString()} Units
                              </span>
                            )}
                            {q.status === 'error' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Parsing Error
                              </span>
                            )}
                          </div>
                          {q.errorMsg && (
                            <p className="text-[11px] text-rose-600 mt-0.5 font-medium">{q.errorMsg}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {q.status === 'ready' && q.parsedAgreements && (
                          <button
                            type="button"
                            onClick={() => togglePreview(q.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Preview Rows</span>
                            {q.showPreview ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveQueuedFile(q.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Remove file from upload queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Editable Batch Metadata Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Batch / Source Name
                        </label>
                        <input
                          type="text"
                          value={q.batchName}
                          onChange={(e) => handleUpdateBatchMeta(q.id, 'batchName', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                          placeholder="e.g. MOH Batch 2026"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Funding Stream
                        </label>
                        <select
                          value={q.source}
                          onChange={(e) => handleUpdateBatchMeta(q.id, 'source', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                        >
                          <option value="MOH Regular Treasury">MOH Regular Treasury</option>
                          <option value="Global Fund (GFATM)">Global Fund (GFATM)</option>
                          <option value="World Bank Health Program">World Bank Health Program</option>
                          <option value="Revolving Drug Fund (RDF)">Revolving Drug Fund (RDF)</option>
                          <option value="UNICEF Bilateral Grant">UNICEF Bilateral Grant</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Fiscal Period / Tag
                        </label>
                        <input
                          type="text"
                          value={q.timePeriod}
                          onChange={(e) => handleUpdateBatchMeta(q.id, 'timePeriod', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                          placeholder="e.g. FY 2025/2026 or Q2 2026"
                        />
                      </div>
                    </div>

                    {/* Accord Preview Drawer */}
                    {q.showPreview && q.parsedAgreements && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>Preview of Parsed Agreements ({q.parsedAgreements.length}):</span>
                          <span className="text-[10px] text-slate-500">
                            Total Valuation: ETB {q.totalValueETB?.toLocaleString()}
                          </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 font-bold text-slate-600 sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="py-1.5 px-2.5">Agreement #</th>
                                <th className="py-1.5 px-2.5">Title</th>
                                <th className="py-1.5 px-2.5">Supplier</th>
                                <th className="py-1.5 px-2.5 text-right">Target Units</th>
                                <th className="py-1.5 px-2.5 text-right">Contract Value</th>
                                <th className="py-1.5 px-2.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {q.parsedAgreements.map((agr, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-2.5 font-mono text-cyan-800">{agr.agreementNumber}</td>
                                  <td className="py-1.5 px-2.5 font-semibold text-slate-900 truncate max-w-[180px]">
                                    {agr.title}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-slate-600">{agr.supplier}</td>
                                  <td className="py-1.5 px-2.5 text-right font-bold">{agr.totalAgreedUnits}</td>
                                  <td className="py-1.5 px-2.5 text-right font-mono">
                                    {(agr.totalContractValueETB / 1000000).toFixed(1)}M ETB
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                      {agr.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helper Tips */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block mb-0.5">
                How Multiple Agreement Ingestion Works:
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>
                  You can upload files from multiple sources (e.g. MOH central allocations, donor grants, regional emergency frameworks).
                </li>
                <li>
                  Each dataset is tagged with its source name and fiscal period so you can filter by batch or analyze all agreements combined.
                </li>
                <li>
                  Missing columns like SLA score, delivery status, or delivered value are automatically inferred from quantities and deadlines.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {readyFilesCount > 0 ? (
              <span>
                <strong>{readyFilesCount}</strong> dataset{readyFilesCount === 1 ? '' : 's'} ready ({totalAgreementsToImport} agreements, ETB {(totalValueToImport / 1000000).toFixed(1)}M)
              </span>
            ) : (
              <span className="text-slate-400">Upload 1 or more files to initiate multi-agreement analysis</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>

            {!isConfirmingSubmit ? (
              <button
                type="button"
                disabled={readyFilesCount === 0 || isProcessing}
                onClick={() => setIsConfirmingSubmit(true)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  Submit {readyFilesCount > 0 ? `${readyFilesCount} Datasets` : 'Datasets'} for Confirmation
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[11px] text-amber-800 font-bold mr-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Finalize {readyFilesCount} agreement batch(es)?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmingSubmit(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCommitUploads}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Import Now</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
