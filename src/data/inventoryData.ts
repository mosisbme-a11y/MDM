import { DEFAULT_MASTER_MEDICAL_DEVICES, DEFAULT_PLANT_SUMMARIES } from './defaultInventoryItems';

export const inventoryData = {
  summary: {
    inventoryAnalysisDate: 'Live System Synchronization',
    totalItemsCount: 0,
    totalQuantity: 0,
    totalValuationETB: 0,
    plantCount: 0,
    plants: DEFAULT_PLANT_SUMMARIES,
    topManufacturers: [],
    statusSummary: {
      functional: 0,
      functionalQty: 0,
      defective: 0,
      notFunctionalQty: 0,
      needsSpare: 0,
      needsSparePartsQty: 0,
      nonMoving: 0,
      nonMovingQty: 0,
      withDSP: 0,
      withDSPQty: 0,
      pendingDSP: 0,
      accessorySpare: 0
    },
    actionSummary: {
      nextActions: {},
      waysOfIntervention: {}
    },
    categories: {},
    noBkdCount: 0
  },
  regionDistribution: [],
  noBkdItems: [],
  items: DEFAULT_MASTER_MEDICAL_DEVICES
};
