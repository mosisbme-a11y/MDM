export interface MedicalDeviceItem {
  id: string;
  plant: string;
  plantName: string;
  wh: string;
  material: string;
  materialDescription: string;
  qty: number;
  totalAmount: number;
  unitPrice: number;
  stockType: string;
  specialStockType: string;
  batch: string;
  expiryDate: string;
  wbsElement: string;
  budgetSource?: string;
  manufacturer: string;
  materialType: string;
  isNotFunctional: boolean;
  needsSparePart: boolean;
  isNonMoving: boolean;
  hasDSP: boolean;
  isAccessorySpare: boolean;
  bkdType: string;
  nextAction: string;
  wayOfIntervention: string;
  responsibleBody: string;
  timeFrame: string;
  fyaEpSSNoBkdStatus?: string;
  sohStatus?: string;
  sheetTabSource?: string;
  installationStatus?: string;
  deliveryStatus?: 'Delivered & Dispatched' | 'In Transit' | 'Port Customs Clearance' | 'Dispatch Pending' | 'Manufacturer Factory';
  contractIssue?: string;
  lcStatus?: string;
  shipmentStatus?: string;
  clearanceStatus?: string;
  assignTrainStatus?: string;
  deliveryDate?: string;
  dispatchDate?: string;
  receivingDate?: string;
  docDate?: string;
  uploadBatchId?: string;
  uploadBatchName?: string;
  poNumber?: string;
  procurementPackage?: string;
  rdfNumber?: string;
  programName?: string;
  officialLetterRef?: string;
  officialLetterDate?: string;
  officialLetterIssuer?: string;
  officialLetterFileName?: string;
  isInterlocked?: boolean;
  autoCategoryTags?: string[];
  isAutoCategorized?: boolean;
  additionalAttributes?: Record<string, string>;
  
  // New SOH Schema fields
  storageLocation?: string;
  unrestrictedStock?: number;
  stockInQualityInspection?: number;
  blockedStock?: number;
  currentValueOfUnrestrictedStock?: number;
  inventoryValuationType?: string;
  materialGroupName?: string;
  valueOfBlockedStock?: number;
  valueOfStockInQualityInspection?: number;
  rawImportedRow?: Record<string, any>;
  userId?: string;
  syncStatus?: 'synced' | 'pending' | 'offline';
}

export interface HealthFacilityRecord {
  id: string;
  customer: string;                 // Customer
  customerDescription: string;      // Customer Description
  facilityType?: string;            // Facility Type (e.g., Hospital, Health Center, Clinic)
  deliveringPlant: string;          // Delivering Plant
  ownershipCode: string;            // Ownership Code
  ownershipDescription: string;     // Ownership Description
  region: string;                   // Region
  zoneCode: string;                 // Zone Code
  zoneDescription: string;          // Zone Description
  woreda: string;                   // Woreda
  woredaDescription: string;        // Woreda Description
  hub?: string;                     // Hub
  uploadedAt?: string;
  sourceFile?: string;
  syncStatus?: 'synced' | 'pending' | 'offline';
}

export interface MaterialMasterRecord {
  id: string;
  product: string;                   // Product (Item / Device Name)
  material: string;                  // Material Code / ID
  plant: string;                     // Plant / Delivering Plant (HO01, AA01, etc.)
  productType: string;               // Product Type (e.g., Medical Device, Equipment, Consumable, Reagent)
  productGroup: string;              // Product Group (e.g., Diagnostic Imaging, Surgical, Patient Monitor, Laboratory)
  uploadedAt?: string;
  sourceFile?: string;
  syncStatus?: 'synced' | 'pending' | 'offline';
}

export interface MultipleStockRecord {
  id: string;
  material: string;                  // Material Code
  materialDescription: string;       // Material Description
  plant: string;                     // Plant
  storageLocation: string;           // Storage Location
  specialStockType: string;          // Special Stock Type
  unrestrictedStock: number;         // Unrestricted Stock
  stockInQualityInspection: number;  // Stock in Quality Inspection
  blockedStock: number;              // Blocked Stock
  currentValueOfUnrestrictedStock: number; // Current Value of Unrestricted Stock
  inventoryValuationType: string;    // Inventory Valuation Type
  materialGroupName: string;         // Material Group Name
  valueOfBlockedStock: number;       // Value of Blocked Stock
  valueOfStockInQualityInspection: number; // Value of Stock in Quality Inspection
  wbsElement: string;                // WBS Element
  uploadedAt?: string;
  sourceFile?: string;
  syncStatus?: 'synced' | 'pending' | 'offline';
}

export interface ReceivingDataRecord {
  id: string;
  purchaseOrder: string;             // Purchase order
  reference?: string;                // Reference
  material: string;                  // Material
  materialDescription: string;       // Material Description
  batch?: string;                    // Batch
  quantity: number;                  // Quantity
  storageLocation: string;           // Storage Location
  amtInLocCur: number;               // Amt.in Loc.Cur.
  movementType: string;              // Movement Type
  specialStock: string;              // Special Stock
  wbsElement: string;                // WBS Element
  plant: string;                     // Plant
  postingDate?: string;              // Posting Date
  postingYear?: number;              // Exact Posting Year from Excel source
  postingMonth?: number;             // Exact Posting Month from Excel source (1-12)
  postingDay?: number;               // Exact Posting Day from Excel source (1-31)
  rawPostingDate?: string | number;  // Exact raw Posting Date value as read from Excel
  stockHoldingDays?: number;         // Stock Holding Days (Posting Date - Today auto-calculated in days)
  entryDate?: string;                // Legacy Entry Date
  baseUnitOfMeasure?: string;        // Legacy UoM
  supplier?: string;                 // Legacy Supplier
  userName?: string;                 // Legacy User Name
  valuationType?: string;            // Legacy Valuation Type
  movementTypeText?: string;         // Legacy Movement Type Text
  qtyInUnitOfEntry?: number;         // Legacy Qty in unit of entry
  unitOfEntry?: string;              // Legacy Unit of Entry
  documentDate?: string;             // Legacy Document Date
  timeOfEntry?: string;              // Legacy Time of Entry
  materialDocYear?: string;          // Legacy Doc Year
  currency?: string;                 // Legacy Currency
  uploadedAt?: string;
  sourceFile?: string;
  rawImportedRow?: Record<string, any>;
}

export interface DistributionDataRecord {
  id: string;
  plant: string;                 // Plant
  salesOrgDescr: string;         // Sales Org Descr
  customerName: string;          // Customer Name
  materialCode: string;          // Material Code
  materialDescr: string;         // Material Descr
  quantity: number;              // Quantity
  unit: string;                  // Unit
  netValue: number;              // Net Value
  manufacturerDescr: string;     // Manufacturer Descr
  batch: string;                 // Batch
  wbsElementDescr: string;       // Wbs Element Descr
  materialTypeDescr: string;     // Material Type Descr
  regionDescr: string;           // Region Descr
  zoneDescr: string;             // Zone Descr
  woredaDescr: string;           // Woreda Descr
  podStatus: string;             // POD status
  deliveryDate: string;          // Delivery Date
  podNumbers: string;            // POD Numbers
  uploadedAt?: string;
  sourceFile?: string;
  rawImportedRow?: Record<string, any>;
}

export interface ProgramMdRecord {
  id: string;
  sapPo: string;                   // SAP PO
  itemDescription: string;         // Item Description
  unit: string;                    // Unit
  quantity: number;                // Quantity
  deliveryAmountEtb: number;       // Delivery Amount in ETB
  supplier: string;                // Supplier
  deviceOwner: string;             // Device Owner
  currentStatus: string;           // Current Status
  managementApproach: string;      // Management Approach
  requestYear: string | number;    // Request Year
  uploadedAt?: string;
  sourceFile?: string;
}

export type EpssSubTab =
  | 'master'
  | 'material-master'
  | 'hf-list'
  | 'inventory-mgmt'
  | 'multiple-stock'
  | 'receiving-data'
  | 'distribution-data'
  | 'inventory-analysis'
  | 'dsp-mgmt'
  | 'dsp-request-moh-epss'
  | 'dsp-breakdown-moh-rhb'
  | 'dsp-submitted-rhb-moh'
  | 'dsp-submitted-moh-epss-ho'
  | 'dsp-aggregation-epss-ho'
  | 'dsp-submitted-epss-branch'
  | 'plant-dsp'
  | 'plant-receiving-dsp'
  | 'plant-distribution-status'
  | 'plant-receiving-status'
  | 'distribution'
  | 'distribution-delivery-rate'
  | 'distribution-remain-soh'
  | 'installation'
  | 'installation-performance'
  | 'installation-status-record'
  | 'installation-payment-status'
  | 'cdss-management'
  | 'cdss-procurement-status'
  | 'cdss-committed-demand'
  | 'cdss-delivery-status'
  | 'agreement-columns'
  | 'agreement-list-facility'
  | 'agreement-official-letter'
  | 'agreement-procurement-status'
  | 'agreement-delivery-rate'
  | 'hp-management'
  | 'hp-procurement-request-list'
  | 'hp-procurement-status'
  | 'hp-receiving-status'
  | 'donation-receiving-status'
  | 'donation-donor-body'
  | 'donation-analysis'
  | 'outbound-installation'
  | 'outbound-contract'
  | 'outbound-procurement'
  | 'outbound-analysis'
  | 'hubs'
  | 'workspace'
  | 'dashboard'
  | 'procurement'
  | 'regional-aggregator'
  | 'mapping-breakdown';

export interface PipelineStageMetric {
  units: number;
  lineItems: number;
  valuation: number;
}

export interface PipelineMetrics {
  letterOfCredit: Record<string, PipelineStageMetric>;
  shipment: Record<string, PipelineStageMetric>;
  clearance: Record<string, PipelineStageMetric>;
  assignTrain: Record<string, PipelineStageMetric>;
}

export interface PlantSummary {
  plant: string;
  name: string;
  totalQty: number;
  totalAmount: number;
  itemsCount: number;
}

export interface ManufacturerStat {
  manufacturer: string;
  totalAmount: number;
  totalQty: number;
}

export interface InstallationStatusMetric {
  units: number;
  lineItems: number;
  valuation: number;
}

export interface InventorySummary {
  inventoryAnalysisDate: string;
  totalItemsCount: number;
  totalQuantity: number;
  totalValuationETB: number;
  plantCount: number;
  plants: PlantSummary[];
  topManufacturers: ManufacturerStat[];
  statusSummary: {
    functional: number;
    defective: number;
    needsSpare: number;
    nonMoving: number;
    hasDSP: number;
    functionalLineItems?: number;
    defectiveLineItems?: number;
    needsSpareLineItems?: number;
    nonMovingLineItems?: number;
  };
  actionSummary: {
    nextActions: Record<string, number>;
    waysOfIntervention: Record<string, number>;
  };
  categories: Record<string, number>;
  noBkdCount: number;
  noBkdStatusSummary?: Record<string, number>;
  installationStatusSummary?: Record<string, number>;
  installationStatusMetrics?: Record<string, InstallationStatusMetric>;
  accountSummary?: Record<string, { units: number; lineItems: number; valuation: number }>;
  sohSummary?: Record<string, { units: number; lineItems: number }>;
  pipelineMetrics?: PipelineMetrics;
}

export interface RegionDistribution {
  customer: string;
  qty: number;
  netValue: number;
  type: string;
  lineItems?: number;
  deliveredStatus?: 'Delivered & Dispatched' | 'In Transit' | 'Port Customs Clearance' | 'Dispatch Pending' | string;
  deliveryDate?: string;
  trackingRef?: string;
}

export interface NoBkdItem {
  id: string;
  code: string;
  description: string;
  qty: number;
  unit: string;
  plant: string;
  storageLocation: string;
  wbsElement: string;
  remark: string;
  batch?: string;
  expiryDate?: string;
  mohApprovalStatus?: 'Pending' | 'Approved' | 'Rejected';
}

export interface MaintenanceCalendarEvent {
  id: string;
  title: string;
  deviceId: string;
  deviceDescription: string;
  plant: string;
  date: string;
  time: string;
  type: 'Time frame' | 'Approved' | 'Rejected' | 'Repair' | 'Inspection';
  assignedEngineer: string;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
}

export interface DeviceDocument {
  id: string;
  title: string;
  deviceModel: string;
  type: 'User Manual' | 'Service Manual' | 'Calibration Certificate' | 'Technical Specs' | 'Official Request Letter' | 'MoH Approval Letter' | 'Breakdown Notice' | 'Procurement Memo' | 'Regional Breakdown Report' | 'Official MoH Allocation Letter' | string;
  fileSize: string;
  lastUpdated: string;
  driveLink: string;
  manufacturer: string;
  category?: 'Official MoH Letters' | 'Breakdown Reports' | 'Technical Documentation';
  referenceNumber?: string;
  issuedDate?: string;
  status?: 'Approved' | 'Under Review' | 'Dispatched' | 'Action Required' | 'Resolved';
  senderFacility?: string;
  recipientFacility?: string;
  officialSeal?: boolean;
  contentPreview?: string;
  fileType?: 'PDF' | 'XLSX' | 'DOCX';
  fileUrl?: string; // URL of the file in Firebase Storage
  notes?: string;
}

export interface AlertNotification {
  id: string;
  recipient: string;
  subject: string;
  date: string;
  priority: 'Critical' | 'Warning' | 'Info';
  status: 'Draft' | 'Sent';
  category: 'Spare Part Need' | 'Defect Notice' | 'Non-Moving Alert';
  body: string;
}

export interface AuthUser {
  id: string;
  uid?: string;
  username: string;
  name: string;
  email: string;
  role: string;
  hub: string;
  isAdmin?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
}

export interface CategoryThreshold {
  category: string;
  threshold: number;
  notifyEmail: boolean;
  notifyToast: boolean;
  emailAddress: string;
}

export type AgreementStatus =
  | 'Fully Delivered'
  | 'On Track'
  | 'Approaching Deadline'
  | 'Delayed / Critical'
  | 'Contract / LC Issue';

export interface MedicalDeviceAgreement {
  id: string;
  agreementNumber: string;
  title: string;
  supplier: string;
  supplierCountry?: string;
  procurementPackage: string;
  fundingSource: string;
  contractSignDate: string;
  committedDeliveryDate: string;
  totalAgreedUnits: number;
  deliveredUnits: number;
  inTransitUnits: number;
  customsUnits: number;
  pendingUnits: number;
  totalContractValueETB: number;
  deliveredValueETB: number;
  status: AgreementStatus;
  slaComplianceScore: number;
  warrantyYears: number;
  maintenanceTerms: string;
  penaltyRatePerDay: number;
  assignedPlants: string[];
  contactPerson?: string;
  contactEmail?: string;
  linkedKeywords: string[];
  notes?: string;
  isCustom?: boolean;
  uploadBatchId?: string;
  uploadBatchName?: string;
}

export interface UploadedAgreementBatch {
  id: string;
  fileName: string;
  batchName: string;
  source: string;
  timePeriod: string;
  uploadDate: string;
  agreementCount: number;
  totalAgreedUnits: number;
  totalDeliveredUnits: number;
  totalValueETB: number;
  agreements: MedicalDeviceAgreement[];
}

export interface NavDomainDistribution {
  epssCount: number;
  epssValuation: number;
  mohCount: number;
  mohValuation: number;
  rhbCount: number;
  rhbRegions: string[];
  hubCount: number;
  hubPlants: string[];
  healthFacilitiesCount: number;
  defectiveOrSpareCount: number;
  workStationDocsCount: number;
  workStationEventsCount: number;
}

export interface ConfirmedUploadBatch {
  id: string;
  batchName: string;
  confirmedAt: string; // ISO String
  confirmedBy: string;
  sourceFileNames: string[];
  totalRecords: number;
  totalQuantity: number;
  totalValuation: number;
  distribution: NavDomainDistribution;
  items: MedicalDeviceItem[];
  attachedDocuments?: DeviceDocument[];
  status: 'Confirmed & Accepted';
  notes?: string;
}

export interface PrintReportConfig {
  includeValuation?: boolean;
  includeOperationalStatus?: boolean;
  includeInstallationStatus?: boolean;
  includeRegionalHubs?: boolean;
  includeFundingSource?: boolean;
}

export interface DashboardFilterState {
  plant: string;
  group: string;
  status: string;
  startDate: string;
  endDate: string;
  wbsElement: string;
  searchQuery: string;
  soh: {
    search: string;
    branch: string;
    rdf: string;
    program: string;
  };
  nonMoving: {
    search: string;
    branch: string;
    rdf: string;
    program: string;
  };
  warehouseReceived: {
    po: string;
    package: string;
    rdf: string;
    program: string;
    plant: string;
    supplier: string;
    movement: string;
    datePreset: string;
    startDate: string;
    endDate: string;
  };
}

export type HeaderNavThemeId =
  | 'professional-white'
  | 'professional-gray'
  | 'taupe-bronze'
  | 'slate-dark'
  | 'medical-cyan'
  | 'royal-navy'
  | 'ethiopian-emerald'
  | 'clinical-light'
  | 'amethyst-carbon'
  | 'frosted-glass'
  | 'custom-admin'
  | (string & {});

export interface HeaderNavCustomStyles {
  headerBgColor?: string;
  headerBorderColor?: string;
  sidebarBgColor?: string;
  sidebarBorderColor?: string;
  sidebarHeaderBgColor?: string;
  navActiveBgColor?: string;
  navActiveTextColor?: string;
  accentColor?: string;
  textColor?: string;
  subtextColor?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
}

export interface HeaderNavThemeOption {
  id: HeaderNavThemeId;
  name: string;
  category: 'dark' | 'light' | 'special';
  description: string;
  headerBg: string;
  headerBorder: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarHeaderBg: string;
  navActiveBg: string;
  navInactiveHover: string;
  accentColor: string;
  textColor: string;
  subtextColor: string;
  badgeActiveBg: string;
  searchBg: string;
  previewGradient: string;
  isCustom?: boolean;
  customStyles?: HeaderNavCustomStyles;
}

export interface MasterDataLog {
  id: string;
  userId: string;
  type: 'Master Inventory' | 'HF Master' | 'Material Master' | 'Stock' | 'Agreement' | 'Receiving' | 'Distribution' | (string & {});
  fileName: string;
  fileUrl?: string;
  rowCount: number;
  uploadedAt: string;
  status: string;
}

export interface RegionBreakdownColumn {
  id: string;
  name: string;
  code: string;
}

export interface RegionBreakdownRow {
  id: string;
  region: string;
  zone: string;
  woreda: string;
  hub: string;
  healthFacility: string;
  packages: string;
  quantities: Record<string, number>;
}

export interface RegionBreakdownMatrixData {
  date: string;
  region: string;
  columns: RegionBreakdownColumn[];
  rows: RegionBreakdownRow[];
}

export interface DspWorkflowRecord {
  id: string;
  dspRefNumber: string;
  stage: 'moh-to-epss' | 'moh-to-rhb' | 'rhb-to-moh' | 'moh-to-epss-ho' | 'epss-ho-aggregation' | 'epss-to-branch';
  stageTitle: string;
  senderOrg: string;
  recipientOrg: string;
  subject: string;
  status: 'Draft' | 'Submitted & Pending' | 'Under Review' | 'Endorsed & Approved' | 'Dispatched to Plants';
  dateSubmitted: string;
  approvedDate?: string;
  actionTakenDate?: string;
  actionTakenBy?: string;
  actionType?: 'Endorsed & Approved' | 'Proceed to Stage 2 Breakdown' | 'Under MOH Technical Review' | 'Revision Requested';
  actionLetterRef?: string;
  actionNotes?: string;
  turnaroundDays?: number;
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
  facilityMatrixData?: RegionBreakdownMatrixData;
  stage4MatrixData?: any;
  hubAggregationData?: any;
}
