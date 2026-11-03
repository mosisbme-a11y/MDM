import { DEFAULT_MASTER_MEDICAL_DEVICES, DEFAULT_PLANT_SUMMARIES } from './defaultInventoryItems';

const totalUnits = DEFAULT_MASTER_MEDICAL_DEVICES.reduce((acc, i) => acc + (i.qty || 0), 0);
const totalValuation = DEFAULT_MASTER_MEDICAL_DEVICES.reduce((acc, i) => acc + (i.totalAmount || 0), 0);

export const inventoryData = {
  summary: {
    inventoryAnalysisDate: 'Live System Synchronization',
    totalItemsCount: DEFAULT_MASTER_MEDICAL_DEVICES.length,
    totalQuantity: totalUnits,
    totalValuationETB: totalValuation,
    plantCount: DEFAULT_PLANT_SUMMARIES.length,
    plants: DEFAULT_PLANT_SUMMARIES,
    topManufacturers: [
      { manufacturer: 'Siemens Healthineers', totalAmount: 69000000, totalQty: 20 },
      { manufacturer: 'Hamilton Medical AG', totalAmount: 16800000, totalQty: 28 },
      { manufacturer: 'Fresenius Medical Care', totalAmount: 18500000, totalQty: 20 },
      { manufacturer: 'Mindray Medical International', totalAmount: 13500000, totalQty: 45 },
      { manufacturer: 'Roche Diagnostics', totalAmount: 9600000, totalQty: 32 }
    ],
    statusSummary: {
      functional: DEFAULT_MASTER_MEDICAL_DEVICES.length,
      functionalQty: totalUnits,
      defective: 0,
      notFunctionalQty: 0,
      needsSpare: 0,
      needsSparePartsQty: 0,
      nonMoving: 0,
      nonMovingQty: 0,
      withDSP: DEFAULT_MASTER_MEDICAL_DEVICES.filter(i => i.hasDSP).length,
      withDSPQty: DEFAULT_MASTER_MEDICAL_DEVICES.filter(i => i.hasDSP).reduce((a, b) => a + b.qty, 0),
      pendingDSP: 0,
      accessorySpare: 0
    },
    actionSummary: {
      nextActions: { 'Ready for Allocation & Dispatch': DEFAULT_MASTER_MEDICAL_DEVICES.length },
      waysOfIntervention: { 'Routine Maintenance': DEFAULT_MASTER_MEDICAL_DEVICES.length }
    },
    categories: {
      'Diagnostic Imaging': 2,
      'Critical Care & ICU': 1,
      'Clinical Chemistry': 1,
      'Monitoring & Life Support': 1,
      'Neonatal & Maternal Health': 1,
      'Emergency & Resuscitation': 1,
      'Sterilization & Infection Control': 1,
      'Nephrology & Dialysis': 1,
      'Advanced Radiology': 1
    },
    noBkdCount: 0
  },
  regionDistribution: DEFAULT_PLANT_SUMMARIES.map(p => ({
    customer: p.name,
    qty: p.totalQty,
    netValue: p.totalAmount,
    type: 'Regional Distribution Hub'
  })),
  noBkdItems: [],
  items: DEFAULT_MASTER_MEDICAL_DEVICES
};
