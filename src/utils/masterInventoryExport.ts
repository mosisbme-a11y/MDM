import * as XLSX from 'xlsx';
import { MedicalDeviceItem } from '../types';
import { downloadCSV } from './formatters';

export const STORAGE_KEY_IMPORTED_COLUMNS = 'epss_master_imported_columns';

/**
 * The 14 authentic standard EPSS columns:
 * 1. Material
 * 2. Material Description
 * 3. Plant
 * 4. Storage Location
 * 5. Special Stock Type
 * 6. Unrestricted Stock
 * 7. Stock in Quality Inspection
 * 8. Blocked Stock
 * 9. Current Value of Unrestricted Stock
 * 10. Inventory Valuation Type
 * 11. Material Group Name
 * 12. Value of Blocked Stock
 * 13. Value of Stock in Quality Inspection
 * 14. WBS Element
 */
export const STANDARD_EPSS_MASTER_COLUMNS: string[] = [
  'Material',
  'Material Description',
  'Plant',
  'Storage Location',
  'Special Stock Type',
  'Unrestricted Stock',
  'Stock in Quality Inspection',
  'Blocked Stock',
  'Current Value of Unrestricted Stock',
  'Inventory Valuation Type',
  'Material Group Name',
  'Value of Blocked Stock',
  'Value of Stock in Quality Inspection',
  'WBS Element'
];

let memoryImportedColumns: string[] = [];

/**
 * Retrieve saved imported column names from memory
 */
export function getStoredImportedColumns(): string[] {
  return [...memoryImportedColumns];
}

/**
 * Save detected imported columns into memory
 */
export function saveStoredImportedColumns(columns: string[]): void {
  if (columns && Array.isArray(columns) && columns.length > 0) {
    memoryImportedColumns = columns
      .filter((c) => typeof c === 'string' && c.trim().length > 0 && !c.startsWith('__EMPTY'))
      .map((c) => c.trim());
  }
}

/**
 * Clear stored imported columns from memory
 */
export function clearStoredImportedColumns(): void {
  memoryImportedColumns = [];
}

/**
 * Determine the exact export columns to use:
 * Priority 1: explicitly passed customColumns (if non-empty)
 * Priority 2: stored imported columns from localStorage
 * Priority 3: columns present in the items' rawImportedRow
 * Priority 4: all 14 standard EPSS columns
 */
export function getExportColumns(customColumns?: string[], items?: MedicalDeviceItem[]): string[] {
  if (customColumns && customColumns.length > 0) {
    return customColumns;
  }

  const stored = getStoredImportedColumns();
  if (stored && stored.length > 0) {
    return stored;
  }

  if (items && items.length > 0) {
    for (const item of items) {
      if (item.rawImportedRow && typeof item.rawImportedRow === 'object') {
        const keys = Object.keys(item.rawImportedRow).filter(
          (k) => k && !k.startsWith('__EMPTY') && k.trim().length > 0
        );
        if (keys.length > 0) {
          return keys;
        }
      }
    }
  }

  return STANDARD_EPSS_MASTER_COLUMNS;
}

/**
 * Retrieve real data for a given column from a MedicalDeviceItem.
 * Preserves the exact imported raw value without modifying anything inside the excel file,
 * while providing direct fallback mapping to all 14 standard EPSS columns and item fields.
 */
export function getFieldValueForColumn(item: MedicalDeviceItem, col: string): any {
  // 1. If item has rawImportedRow recorded when imported, check if it contains this column:
  if (item.rawImportedRow && typeof item.rawImportedRow === 'object') {
    // Direct exact column key match:
    if (col in item.rawImportedRow && item.rawImportedRow[col] !== undefined && item.rawImportedRow[col] !== null) {
      return item.rawImportedRow[col];
    }

    // Case-insensitive / trimmed match in rawImportedRow:
    const colClean = col.trim().toLowerCase();
    for (const key of Object.keys(item.rawImportedRow)) {
      if (key.trim().toLowerCase() === colClean) {
        const val = item.rawImportedRow[key];
        if (val !== undefined && val !== null) {
          return val;
        }
      }
    }

    // Normalized alphanumeric match (handles spaces, underscores, symbols):
    const normCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of Object.keys(item.rawImportedRow)) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normKey === normCol) {
        const val = item.rawImportedRow[key];
        if (val !== undefined && val !== null) {
          return val;
        }
      }
    }
  }

  // 2. Direct mapping for all 14 standard EPSS columns
  const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (norm) {
    case 'material':
    case 'materialcode':
      return item.material || '';
    case 'materialdescription':
    case 'description':
      return item.materialDescription || '';
    case 'plant':
      return item.plant || '';
    case 'storagelocation':
    case 'wh':
    case 'warehouse':
      return item.storageLocation || item.wh || '';
    case 'specialstocktype':
    case 'stocktype':
      return item.specialStockType || item.stockType || '';
    case 'unrestrictedstock':
    case 'qty':
    case 'quantity':
      return item.unrestrictedStock !== undefined ? item.unrestrictedStock : (item.qty ?? 0);
    case 'stockinqualityinspection':
      return item.stockInQualityInspection !== undefined ? item.stockInQualityInspection : 0;
    case 'blockedstock':
      return item.blockedStock !== undefined ? item.blockedStock : 0;
    case 'currentvalueofunrestrictedstock':
      return item.currentValueOfUnrestrictedStock !== undefined
        ? item.currentValueOfUnrestrictedStock
        : (item.totalAmount ?? 0);
    case 'inventoryvaluationtype':
      return item.inventoryValuationType || 'Standard';
    case 'materialgroupname':
      return item.materialGroupName || '';
    case 'valueofblockedstock':
      return item.valueOfBlockedStock !== undefined ? item.valueOfBlockedStock : 0;
    case 'valueofstockinqualityinspection':
      return item.valueOfStockInQualityInspection !== undefined
        ? item.valueOfStockInQualityInspection
        : 0;
    case 'wbselement':
      return item.wbsElement || '';

    // Additional common medical device inventory attributes (for backwards compatibility)
    case 'plantname':
      return item.plantName || '';
    case 'totalamount':
    case 'totalamountetb':
      return item.totalAmount !== undefined ? item.totalAmount : 0;
    case 'unitprice':
    case 'unitpriceetb':
      return item.unitPrice !== undefined ? item.unitPrice : 0;
    case 'batch':
      return item.batch || '';
    case 'expirydate':
      return item.expiryDate || '';
    case 'manufacturer':
      return item.manufacturer || '';
    case 'operationalstatus':
    case 'stockcondition':
    case 'status':
      if (item.isNotFunctional) return 'Defective';
      if (item.needsSparePart) return 'Needs Spare Part';
      return 'Functional';
    case 'nonmoving':
    case 'nonmovingstock':
      return item.isNonMoving ? 'Yes' : 'No';
    case 'nextaction':
    case 'nextrecommendedaction':
      return item.nextAction || '';
    case 'wayofintervention':
    case 'intervention':
      return item.wayOfIntervention || '';
    case 'responsiblebody':
      return item.responsibleBody || '';
    case 'timeframe':
      return item.timeFrame || '';
    case 'sohstatus':
      return item.sohStatus || '';
    case 'installationstatus':
      return item.installationStatus || '';
    case 'deliverystatus':
      return item.deliveryStatus || '';
    default:
      return '';
  }
}

/**
 * Builds an exported data row containing real values matching the exact column names
 */
export function buildExportRow(item: MedicalDeviceItem, columns: string[]): Record<string, any> {
  const row: Record<string, any> = {};
  columns.forEach((col) => {
    row[col] = getFieldValueForColumn(item, col);
  });
  return row;
}

/**
 * Export data to native Excel (.xlsx) file with imported columns and real data
 */
export function exportMasterInventoryToExcel(
  items: MedicalDeviceItem[],
  filename?: string,
  customColumns?: string[],
  sheetName: string = 'Master Inventory'
): void {
  if (!items || items.length === 0) return;
  const columns = getExportColumns(customColumns, items);
  const data = items.map((item) => buildExportRow(item, columns));
  const ws = XLSX.utils.json_to_sheet(data, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const dateStr = new Date().toISOString().slice(0, 10);
  const actualFilename = filename || `EPSS_Master_Medical_Device_Inventory_${dateStr}.xlsx`;
  XLSX.writeFile(wb, actualFilename);
}

/**
 * Export data to CSV file with imported columns and real data
 */
export function exportMasterInventoryToCSV(
  items: MedicalDeviceItem[],
  filename?: string,
  customColumns?: string[]
): void {
  if (!items || items.length === 0) return;
  const columns = getExportColumns(customColumns, items);
  const data = items.map((item) => buildExportRow(item, columns));
  const dateStr = new Date().toISOString().slice(0, 10);
  const actualFilename = filename || `EPSS_Master_Medical_Device_Inventory_${dateStr}.csv`;
  downloadCSV(actualFilename, data);
}

/**
 * Generate 2D array representation for sheets / xlsx utils
 */
export function generateMasterInventorySheetData(
  itemsList: MedicalDeviceItem[],
  customColumns?: string[]
): any[][] {
  const columns = getExportColumns(customColumns, itemsList);
  const rows = itemsList.map((item) => {
    const rowObj = buildExportRow(item, columns);
    return columns.map((col) => rowObj[col] ?? '');
  });
  return [columns, ...rows];
}
