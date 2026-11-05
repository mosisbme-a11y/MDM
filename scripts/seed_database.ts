import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MASTER_STOCK_RECORDS, DEFAULT_MASTER_MEDICAL_DEVICES } from '../src/data/defaultInventoryItems';
import { INITIAL_DSP_RECORDS } from '../src/data/defaultDspWorkflows';
import { DEFAULT_RECEIVING_DATA_RECORDS } from '../src/data/defaultReceivingData';
import { DEFAULT_DISTRIBUTION_DATA_RECORDS } from '../src/data/defaultDistributionData';
import { ETHIOPIAN_HEALTH_FACILITIES_7500 } from '../src/data/ethiopianHealthFacilities7500';
import { DEFAULT_DSP_REQUEST_TEMPLATE_ROWS, TODAY_ISO_DATE } from '../src/data/defaultDspRequestTemplateData';
import { saveMasterData } from '../server_store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ETHIOPIAN_REGIONS = [
  'Oromia',
  'Amhara',
  'Somali',
  'Tigray',
  'Afar',
  'Sidama',
  'Central Ethiopia',
  'South Ethiopia',
  'South West Ethiopia',
  'Benishangul-Gumuz',
  'Gambella',
  'Harari',
  'Dire Dawa',
  'Addis Ababa',
  'Federal Special Facilities'
];

async function seed() {
  console.log('Seeding Master Central Dataset into Supabase and local store...');

  // 1. Material Master items generated from Master Stock
  const materialMasterItems = DEFAULT_MASTER_STOCK_RECORDS.map((s, idx) => ({
    id: `mm-rec-${idx + 1}`,
    material: s.material,
    materialDescription: s.materialDescription,
    materialGroupName: s.materialGroupName,
    materialType: 'ZMED',
    valuationType: s.inventoryValuationType,
    baseUom: 'EA',
    price: s.unrestrictedStock > 0 ? Math.round(s.currentValueOfUnrestrictedStock / s.unrestrictedStock) : 65000,
    manufacturer: 'Siemens / Mindray / Certified Supplier',
    uploadedAt: s.uploadedAt || new Date().toISOString()
  }));

  // 2. Sub-step 2.2 Columns (exact 6 columns matching user screenshot)
  const dsp22Columns = [
    { id: 'mat-1', materialCode: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon' },
    { id: 'mat-2', materialCode: '403-XRRD-0101', description: 'Bed - Patient, Fowler, Adult' },
    { id: 'mat-3', materialCode: '403-XRRB-0101N', description: 'Bowel - With Stand, Stainless Steel.' },
    { id: 'mat-4', materialCode: '403-XRRD-0101-001', description: 'Cold box' },
    { id: 'mat-5', materialCode: '401-WICU-0101N', description: 'Couch - Delivery' },
    { id: 'mat-6', materialCode: '401-WICU-0101N', description: 'Couch - Examination' }
  ];

  // 3. Sub-step 2.2 Rows for all 15 Ethiopian Regions with exact allocation
  const dsp22Rows = ETHIOPIAN_REGIONS.map((regionName, idx) => ({
    id: `row-reg-${idx + 1}`,
    sn: idx + 1,
    date: TODAY_ISO_DATE,
    region: regionName,
    budgetSource: '',
    quantities: {
      'mat-1': 10,
      'mat-2': 10,
      'mat-3': 10,
      'mat-4': 10,
      'mat-5': 10,
      'mat-6': 10
    }
  }));

  const fullPayload = {
    items: DEFAULT_MASTER_MEDICAL_DEVICES,
    multipleStockItems: DEFAULT_MASTER_STOCK_RECORDS,
    materialMasterItems: materialMasterItems,
    receivingDataRecords: DEFAULT_RECEIVING_DATA_RECORDS,
    distributionDataRecords: DEFAULT_DISTRIBUTION_DATA_RECORDS,
    hfListItems: ETHIOPIAN_HEALTH_FACILITIES_7500,
    dspWorkflowRecords: INITIAL_DSP_RECORDS,
    dspReceivedMohRows: DEFAULT_DSP_REQUEST_TEMPLATE_ROWS,
    dspReceivedEpssRows: DEFAULT_DSP_REQUEST_TEMPLATE_ROWS,
    dsp22Columns: dsp22Columns,
    dsp22Rows: dsp22Rows,
    categoryThresholds: {},
    updatedBy: 'EPSS Master Database Initializer',
    updateKind: 'Full Central Active App Dataset Provisioning'
  };

  // Push to Supabase system_master_data
  const result = await saveMasterData(fullPayload);
  console.log('Supabase Seed Succeeded! Version:', result.version, 'Counts:', result.counts);

  // Write to local server_data/epss_master_store.json backup with updated version and counts
  const serverDataDir = path.join(rootDir, 'server_data');
  if (!fs.existsSync(serverDataDir)) fs.mkdirSync(serverDataDir, { recursive: true });
  fs.writeFileSync(
    path.join(serverDataDir, 'epss_master_store.json'),
    JSON.stringify({ ...fullPayload, version: result.version || 1, counts: result.counts }, null, 2),
    'utf-8'
  );
  console.log('Saved server_data/epss_master_store.json backup with counts & version.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
