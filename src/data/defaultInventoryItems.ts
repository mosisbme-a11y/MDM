// EPSS Master Medical Device Management System - Default Master Inventory & Stock Records

import { MedicalDeviceItem, MultipleStockRecord, PlantSummary } from '../types';

export const DEFAULT_MASTER_STOCK_RECORDS: MultipleStockRecord[] = [
  {
    id: 'mstock-rec-001',
    material: 'MAT-100234',
    materialDescription: 'Ultrasound Machine, Doppler Color 4D with Convex & Linear Probes',
    plant: 'AA01',
    storageLocation: 'Central Store A1',
    specialStockType: '', // Blank = Revolving Drug Fund (RDF)
    unrestrictedStock: 45,
    stockInQualityInspection: 5,
    blockedStock: 2,
    currentValueOfUnrestrictedStock: 13500000,
    inventoryValuationType: 'Moving Average (V)',
    materialGroupName: 'Diagnostic Imaging',
    valueOfBlockedStock: 600000,
    valueOfStockInQualityInspection: 1500000,
    wbsElement: 'WBS-EPSS-IMAG-01',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-002',
    material: 'MAT-100235',
    materialDescription: 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive',
    plant: 'HO01',
    storageLocation: 'Central Warehouse Main',
    specialStockType: 'Q', // Q = Health Program (HP)
    unrestrictedStock: 28,
    stockInQualityInspection: 2,
    blockedStock: 0,
    currentValueOfUnrestrictedStock: 16800000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Critical Care & ICU',
    valueOfBlockedStock: 0,
    valueOfStockInQualityInspection: 1200000,
    wbsElement: 'WBS-EPSS-ICU-02',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-003',
    material: 'MAT-100236',
    materialDescription: 'Digital X-Ray System, Ceiling-Suspended High Frequency 50kW',
    plant: 'HW01',
    storageLocation: 'Hawassa Hub Store',
    specialStockType: '', // RDF
    unrestrictedStock: 14,
    stockInQualityInspection: 1,
    blockedStock: 1,
    currentValueOfUnrestrictedStock: 21000000,
    inventoryValuationType: 'Moving Average (V)',
    materialGroupName: 'Diagnostic Imaging',
    valueOfBlockedStock: 1500000,
    valueOfStockInQualityInspection: 1500000,
    wbsElement: 'WBS-EPSS-XRAY-03',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-004',
    material: 'MAT-100237',
    materialDescription: 'Automated Clinical Chemistry Analyzer, 400 Tests/Hour',
    plant: 'BD01',
    storageLocation: 'Bahir Dar Regional Hub',
    specialStockType: '', // RDF
    unrestrictedStock: 32,
    stockInQualityInspection: 4,
    blockedStock: 1,
    currentValueOfUnrestrictedStock: 9600000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Clinical Chemistry',
    valueOfBlockedStock: 300000,
    valueOfStockInQualityInspection: 1200000,
    wbsElement: 'WBS-EPSS-LAB-04',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-005',
    material: 'MAT-100238',
    materialDescription: 'Multiparameter Patient Monitor 12.1 Inch (ECG, SpO2, NIBP, Temp, Resp)',
    plant: 'MK01',
    storageLocation: 'Mekelle Central Hub',
    specialStockType: '', // RDF
    unrestrictedStock: 60,
    stockInQualityInspection: 6,
    blockedStock: 0,
    currentValueOfUnrestrictedStock: 7200000,
    inventoryValuationType: 'Moving Average (V)',
    materialGroupName: 'Monitoring & Life Support',
    valueOfBlockedStock: 0,
    valueOfStockInQualityInspection: 720000,
    wbsElement: 'WBS-EPSS-MON-05',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-006',
    material: 'MAT-100239',
    materialDescription: 'Infant Radiant Warmer with Phototherapy Unit & Microprocessor Temp Control',
    plant: 'DD01',
    storageLocation: 'Dire Dawa Hub Depo',
    specialStockType: 'Q', // HP
    unrestrictedStock: 35,
    stockInQualityInspection: 3,
    blockedStock: 1,
    currentValueOfUnrestrictedStock: 4200000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Neonatal & Maternal Health',
    valueOfBlockedStock: 120000,
    valueOfStockInQualityInspection: 360000,
    wbsElement: 'WBS-EPSS-NEO-06',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-007',
    material: 'MAT-100240',
    materialDescription: 'Automated External Defibrillator (AED) Biphasic with Adult/Pedi Pads',
    plant: 'AD01',
    storageLocation: 'Adama Distribution Center',
    specialStockType: 'Q', // HP
    unrestrictedStock: 50,
    stockInQualityInspection: 5,
    blockedStock: 0,
    currentValueOfUnrestrictedStock: 5500000,
    inventoryValuationType: 'Moving Average (V)',
    materialGroupName: 'Emergency & Resuscitation',
    valueOfBlockedStock: 0,
    valueOfStockInQualityInspection: 550000,
    wbsElement: 'WBS-EPSS-EMERG-07',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-008',
    material: 'MAT-100241',
    materialDescription: 'Steam Autoclave Sterilizer Horizontal 350L Heavy Duty Hospital Grade',
    plant: 'JW01',
    storageLocation: 'Jimma Regional Depo',
    specialStockType: '', // RDF
    unrestrictedStock: 18,
    stockInQualityInspection: 2,
    blockedStock: 1,
    currentValueOfUnrestrictedStock: 10800000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Sterilization & Infection Control',
    valueOfBlockedStock: 600000,
    valueOfStockInQualityInspection: 1200000,
    wbsElement: 'WBS-EPSS-STERIL-08',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-009',
    material: 'MAT-100242',
    materialDescription: 'Fresenius 4008S Hemodialysis Machine with Endotoxin Filter',
    plant: 'HO01',
    storageLocation: 'Central Bonded Store',
    specialStockType: 'Q', // HP
    unrestrictedStock: 20,
    stockInQualityInspection: 2,
    blockedStock: 0,
    currentValueOfUnrestrictedStock: 18500000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Nephrology & Dialysis',
    valueOfBlockedStock: 0,
    valueOfStockInQualityInspection: 1850000,
    wbsElement: 'WBS-EPSS-DIAL-09',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  },
  {
    id: 'mstock-rec-010',
    material: 'MAT-100243',
    materialDescription: 'Siemens SOMATOM go.Top 64-Slice CT Scanner System',
    plant: 'AA01',
    storageLocation: 'Central Heavy Equipment Store',
    specialStockType: 'Q', // HP
    unrestrictedStock: 6,
    stockInQualityInspection: 1,
    blockedStock: 0,
    currentValueOfUnrestrictedStock: 48000000,
    inventoryValuationType: 'Standard Price (S)',
    materialGroupName: 'Advanced Radiology',
    valueOfBlockedStock: 0,
    valueOfStockInQualityInspection: 8000000,
    wbsElement: 'WBS-EPSS-RAD-10',
    uploadedAt: '2026-03-01T08:00:00.000Z',
    sourceFile: 'EPSS_Central_Stock_Ledger.xlsx'
  }
];

export const DEFAULT_MASTER_MEDICAL_DEVICES: MedicalDeviceItem[] = DEFAULT_MASTER_STOCK_RECORDS.map((rec, idx) => ({
  id: `dev-item-${idx + 1}`,
  plant: rec.plant,
  plantName: rec.plant === 'AA01' ? 'Addis Ababa Central Hub' :
             rec.plant === 'HO01' ? 'Central Head Office Hub' :
             rec.plant === 'HW01' ? 'Hawassa Regional Hub' :
             rec.plant === 'BD01' ? 'Bahir Dar Regional Hub' :
             rec.plant === 'MK01' ? 'Mekelle Regional Hub' :
             rec.plant === 'DD01' ? 'Dire Dawa Regional Hub' :
             rec.plant === 'AD01' ? 'Adama Regional Hub' : 'Jimma Regional Hub',
  wh: rec.storageLocation,
  material: rec.material,
  materialDescription: rec.materialDescription,
  qty: rec.unrestrictedStock,
  unitPrice: Math.round(rec.currentValueOfUnrestrictedStock / Math.max(1, rec.unrestrictedStock)),
  totalAmount: rec.currentValueOfUnrestrictedStock,
  stockType: rec.inventoryValuationType,
  specialStockType: rec.specialStockType || 'Standard',
  batch: `BATCH-${rec.plant}-2026`,
  expiryDate: '2029-12-31',
  wbsElement: rec.wbsElement,
  budgetSource: rec.specialStockType === 'Q' ? 'Ministry of Health (MOH Special Grant)' : 'EPSS Revolving Drug Fund (RDF)',
  manufacturer: rec.material.includes('100234') ? 'Mindray Medical International' :
                rec.material.includes('100235') ? 'Hamilton Medical AG (Switzerland)' :
                rec.material.includes('100236') ? 'Siemens Healthineers' :
                rec.material.includes('100237') ? 'Roche Diagnostics' :
                rec.material.includes('100238') ? 'Philips Healthcare' :
                rec.material.includes('100239') ? 'GE Healthcare' :
                rec.material.includes('100240') ? 'Zoll Medical' :
                rec.material.includes('100242') ? 'Fresenius Medical Care' :
                rec.material.includes('100243') ? 'Siemens Healthineers' : 'Tuttnauer Medical',
  materialType: rec.materialGroupName,
  isNotFunctional: false,
  needsSparePart: false,
  isNonMoving: false,
  hasDSP: rec.specialStockType === 'Q',
  isAccessorySpare: false,
  bkdType: 'Operational',
  nextAction: 'Ready for Allocation & Dispatch',
  wayOfIntervention: 'Routine Maintenance',
  responsibleBody: 'EPSS Medical Equipment Directorate',
  timeFrame: 'Q1-Q2 2026',
  sohStatus: 'Functional',
  installationStatus: 'Installed',
  deliveryStatus: 'Delivered & Dispatched',
  sheetTabSource: 'EPSS Central Stockpile',
  storageLocation: rec.storageLocation,
  unrestrictedStock: rec.unrestrictedStock,
  stockInQualityInspection: rec.stockInQualityInspection,
  blockedStock: rec.blockedStock,
  currentValueOfUnrestrictedStock: rec.currentValueOfUnrestrictedStock,
  inventoryValuationType: rec.inventoryValuationType,
  materialGroupName: rec.materialGroupName,
  valueOfBlockedStock: rec.valueOfBlockedStock,
  valueOfStockInQualityInspection: rec.valueOfStockInQualityInspection
}));

export const DEFAULT_PLANT_SUMMARIES: PlantSummary[] = [
  { plant: 'AA01', name: 'Addis Ababa Central Hub', itemsCount: 51, totalQty: 51, totalAmount: 61500000 },
  { plant: 'HO01', name: 'Central Head Office Hub', itemsCount: 48, totalQty: 48, totalAmount: 35300000 },
  { plant: 'HW01', name: 'Hawassa Regional Hub', itemsCount: 14, totalQty: 14, totalAmount: 21000000 },
  { plant: 'BD01', name: 'Bahir Dar Regional Hub', itemsCount: 32, totalQty: 32, totalAmount: 9600000 },
  { plant: 'MK01', name: 'Mekelle Regional Hub', itemsCount: 60, totalQty: 60, totalAmount: 7200000 },
  { plant: 'DD01', name: 'Dire Dawa Regional Hub', itemsCount: 35, totalQty: 35, totalAmount: 4200000 },
  { plant: 'AD01', name: 'Adama Regional Hub', itemsCount: 50, totalQty: 50, totalAmount: 5500000 },
  { plant: 'JW01', name: 'Jimma Regional Hub', itemsCount: 18, totalQty: 18, totalAmount: 10800000 }
];
