import * as XLSX from 'xlsx';
import { DistributionDataRecord } from '../types';
import { downloadCSV } from '../utils/formatters';
import { matchHealthFacility } from '../utils/fuzzyMatcher';
import { ETHIOPIAN_HEALTH_FACILITIES_7500 } from './ethiopianHealthFacilities7500';

export const DISTRIBUTION_DATA_COLUMNS = [
  'Plant',
  'Sales Org Descr',
  'Customer Name',
  'Material Code',
  'Material Descr',
  'Quantity',
  'Unit',
  'Net Value',
  'Manufacturer Descr',
  'Batch',
  'Wbs Element Descr',
  'Material Type Descr',
  'Region Descr',
  'Zone Descr',
  'Woreda Descr',
  'POD status',
  'Delivery Date',
  'POD Numbers'
] as const;

export const DEFAULT_DISTRIBUTION_DATA_RECORDS: Omit<DistributionDataRecord, 'id'>[] = [];

/**
 * Categorizes a distribution record into Revolving Drug Fund (RDF) or Health Program (HP)
 */
export function getDistributionFundStream(rec: Partial<DistributionDataRecord>): 'RDF' | 'HP' {
  const wbs = (rec.wbsElementDescr || '').trim();
  // If Wbs Element Descr has a value, it's HP; otherwise RDF
  if (wbs !== '') {
    return 'HP';
  }
  return 'RDF';
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseDistributionDataRows(rawRows: any[], sourceName: string = 'Upload'): DistributionDataRecord[] {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return [];

  const records: DistributionDataRecord[] = [];
  const now = Date.now();

  rawRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;

    const hasValues = Object.values(row).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!hasValues) return;

    const rowMap: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      rowMap[normalizeKey(k)] = row[k];
    });

    const getStr = (aliases: string[], fallback: string = ''): string => {
      for (const alias of aliases) {
        const val = rowMap[normalizeKey(alias)];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
      return fallback;
    };

    const getNum = (aliases: string[], fallback: number = 0): number => {
      for (const alias of aliases) {
        const val = rowMap[normalizeKey(alias)];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
      return fallback;
    };

    const materialDesc = getStr(['materialdescr', 'materialdescription', 'description', 'product', 'itemdescription']);
    const materialCode = getStr(['materialcode', 'material', 'materialnumber', 'matnr', 'itemcode']);

    if (!materialDesc && !materialCode) return;

    const qty = getNum(['quantity', 'qty', 'menge'], 1);
    const netVal = getNum(['netvalue', 'amount', 'totalamount', 'value', 'dmbtr'], 0);
    const plant = getStr(['plant', 'werks', 'hub'], 'AA01');
    const salesOrg = getStr(['salesorgdescr', 'salesorg', 'salesorganization'], 'EPSS Central Hub Sales');
    
    // Facility/Customer Mapping logic
    const rawCustomer = getStr(['customername', 'customer', 'facility', 'hospital'], 'Specialized Hospital');
    const rawRegion = getStr(['regiondescr', 'region'], '');
    const rawZone = getStr(['zonedescr', 'zone'], '');
    const rawWoreda = getStr(['woredadescr', 'woreda'], '');

    // Try to match against master data
    const matchedHF = matchHealthFacility(
      {
        customerDescription: rawCustomer,
        region: rawRegion,
        zoneDescription: rawZone,
        woredaDescription: rawWoreda
      },
      ETHIOPIAN_HEALTH_FACILITIES_7500
    );

    // Use matched values or fallback to provided values
    const customer = matchedHF ? matchedHF.customerDescription : rawCustomer;
    const region = matchedHF ? matchedHF.region : (rawRegion || 'Addis Ababa City Administration');
    const zone = matchedHF ? matchedHF.zoneDescription : (rawZone || 'Addis Ababa Central');
    const woreda = matchedHF ? matchedHF.woredaDescription : (rawWoreda || 'Arada Sub-City');
    const deliveringPlant = matchedHF ? matchedHF.deliveringPlant : plant;

    const unit = getStr(['unit', 'uom', 'baseunitofmeasure'], 'EA');
    const manufacturer = getStr(['manufacturerdescr', 'manufacturer', 'vendor'], 'Direct Manufacturer');
    const batch = getStr(['batch', 'charg'], 'BATCH-2026-01');
    const wbs = getStr(['wbselementdescr', 'wbselement', 'wbs'], '');
    const matType = getStr(['materialtypedescr', 'materialtype', 'mtart'], 'Medical Equipment');
    const podStatus = getStr(['podstatus', 'status', 'deliverystatus'], 'Confirmed & Signed');
    const deliveryDate = getStr(['deliverydate', 'date'], new Date().toISOString().split('T')[0]);
    const podNumbers = getStr(['podnumbers', 'podnumber', 'podnum'], `POD-2026-${8000 + idx}`);

    records.push({
      id: `dist-${now}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
      plant: deliveringPlant,
      salesOrgDescr: salesOrg,
      customerName: customer,
      materialCode: materialCode || `MAT-${100000 + idx}`,
      materialDescr: materialDesc || 'Medical Supply Item',
      quantity: qty,
      unit,
      netValue: netVal,
      manufacturerDescr: manufacturer,
      batch,
      wbsElementDescr: wbs,
      materialTypeDescr: matType,
      regionDescr: region,
      zoneDescr: zone,
      woredaDescr: woreda,
      podStatus,
      deliveryDate,
      podNumbers,
      uploadedAt: new Date().toISOString(),
      sourceFile: sourceName,
      rawImportedRow: row
    });
  });

  return records;
}

export function downloadDistributionDataTemplateCSV(): void {
  const data = DEFAULT_DISTRIBUTION_DATA_RECORDS.map((r) => ({
    'Plant': r.plant,
    'Sales Org Descr': r.salesOrgDescr,
    'Customer Name': r.customerName,
    'Material Code': r.materialCode,
    'Material Descr': r.materialDescr,
    'Quantity': r.quantity,
    'Unit': r.unit,
    'Net Value': r.netValue,
    'Manufacturer Descr': r.manufacturerDescr,
    'Batch': r.batch,
    'Wbs Element Descr': r.wbsElementDescr,
    'Material Type Descr': r.materialTypeDescr,
    'Region Descr': r.regionDescr,
    'Zone Descr': r.zoneDescr,
    'Woreda Descr': r.woredaDescr,
    'POD status': r.podStatus,
    'Delivery Date': r.deliveryDate,
    'POD Numbers': r.podNumbers
  }));

  downloadCSV(`EPSS_Distribution_Data_Template_18Col_${new Date().toISOString().split('T')[0]}.csv`, data);
}

export function downloadDistributionDataTemplateExcel(): void {
  const rows = DEFAULT_DISTRIBUTION_DATA_RECORDS.map((r) => ({
    'Plant': r.plant,
    'Sales Org Descr': r.salesOrgDescr,
    'Customer Name': r.customerName,
    'Material Code': r.materialCode,
    'Material Descr': r.materialDescr,
    'Quantity': r.quantity,
    'Unit': r.unit,
    'Net Value': r.netValue,
    'Manufacturer Descr': r.manufacturerDescr,
    'Batch': r.batch,
    'Wbs Element Descr': r.wbsElementDescr,
    'Material Type Descr': r.materialTypeDescr,
    'Region Descr': r.regionDescr,
    'Zone Descr': r.zoneDescr,
    'Woreda Descr': r.woredaDescr,
    'POD status': r.podStatus,
    'Delivery Date': r.deliveryDate,
    'POD Numbers': r.podNumbers
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...DISTRIBUTION_DATA_COLUMNS]
  });

  worksheet['!cols'] = [
    { wch: 10 }, // Plant
    { wch: 30 }, // Sales Org Descr
    { wch: 35 }, // Customer Name
    { wch: 14 }, // Material Code
    { wch: 45 }, // Material Descr
    { wch: 10 }, // Quantity
    { wch: 10 }, // Unit
    { wch: 16 }, // Net Value
    { wch: 28 }, // Manufacturer Descr
    { wch: 16 }, // Batch
    { wch: 35 }, // Wbs Element Descr
    { wch: 24 }, // Material Type Descr
    { wch: 26 }, // Region Descr
    { wch: 22 }, // Zone Descr
    { wch: 22 }, // Woreda Descr
    { wch: 18 }, // POD status
    { wch: 14 }, // Delivery Date
    { wch: 16 }  // POD Numbers
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Distribution Data');
  XLSX.writeFile(workbook, `EPSS_Distribution_Data_Template_18Col_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function generateDistributionDataCSVText(): string {
  const headers = [...DISTRIBUTION_DATA_COLUMNS].join(',');
  const lines = DEFAULT_DISTRIBUTION_DATA_RECORDS.map((r) => {
    return [
      `"${r.plant}"`,
      `"${r.salesOrgDescr.replace(/"/g, '""')}"`,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.materialCode}"`,
      `"${r.materialDescr.replace(/"/g, '""')}"`,
      r.quantity,
      `"${r.unit}"`,
      r.netValue.toFixed(2),
      `"${r.manufacturerDescr.replace(/"/g, '""')}"`,
      `"${r.batch}"`,
      `"${r.wbsElementDescr.replace(/"/g, '""')}"`,
      `"${r.materialTypeDescr}"`,
      `"${r.regionDescr}"`,
      `"${r.zoneDescr}"`,
      `"${r.woredaDescr}"`,
      `"${r.podStatus}"`,
      r.deliveryDate,
      `"${r.podNumbers}"`
    ].join(',');
  });

  return [headers, ...lines].join('\n');
}
