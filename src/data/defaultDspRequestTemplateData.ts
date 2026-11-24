import * as XLSX from 'xlsx';

export interface DspRequestTemplateRow {
  id: string;
  srNo: number;
  material: string;
  materialDescription: string;
  qty: number;
  totalAmount: number;
  valuationTypeDesc: string;
  wbsElement: string;
  budgetSource: string;
  requestDate: string;
  dspRequestTo: string;
  rawColumns?: string[];
  rawRowData?: Record<string, any>;
}

export const DSP_REQUEST_TEMPLATE_COLUMNS = [
  'S/N',
  'Material',
  'Material Description',
  'Qty',
  'Total Amount',
  'Valuation Type Desc',
  'WBS Element',
  'Budget Source',
  'Request Date',
  'DSP request to'
] as const;

export const TODAY_ISO_DATE = new Date().toISOString().slice(0, 10);

export const DEFAULT_SAMPLE_HP_STOCK_ITEMS = [
  {
    id: 'hp-stock-1',
    material: '401-BEDP-001',
    materialDescription: 'Bed - Patient, ICU Electric',
    plant: 'HO01',
    unrestrictedStock: 44,
    currentValueOfUnrestrictedStock: 2500000,
    inventoryValuationType: 'Siemens Healthineers',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'Global Fund',
    specialStockType: 'Q'
  },
  {
    id: 'hp-stock-2',
    material: '403-CEGP-002',
    materialDescription: 'Centrifuge - General Laboratory',
    plant: 'HO01',
    unrestrictedStock: 113,
    currentValueOfUnrestrictedStock: 4500000,
    inventoryValuationType: 'Eppendorf',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'MOH Treasury',
    specialStockType: 'Q'
  },
  {
    id: 'hp-stock-3',
    material: '402-CPAM-003',
    materialDescription: 'CPAP Machine with Humidifier',
    plant: 'HO01',
    unrestrictedStock: 44,
    currentValueOfUnrestrictedStock: 1800000,
    inventoryValuationType: 'ResMed',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'World Bank',
    specialStockType: 'Q'
  },
  {
    id: 'hp-stock-4',
    material: '401-CODE-004',
    materialDescription: 'Couch - Examination / Delivery',
    plant: 'HO01',
    unrestrictedStock: 206,
    currentValueOfUnrestrictedStock: 3100000,
    inventoryValuationType: 'Standard Medical',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'SDG Fund',
    specialStockType: 'Q'
  },
  {
    id: 'hp-stock-5',
    material: '402-CYOX-005',
    materialDescription: 'Cylinder - Oxygen, 40L Medical',
    plant: 'HO01',
    unrestrictedStock: 120,
    currentValueOfUnrestrictedStock: 960000,
    inventoryValuationType: 'Local Med',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'MOH Treasury',
    specialStockType: 'Q'
  }
];

// Strictly pure user uploaded records only (No default/sample data)
export const DEFAULT_DSP_REQUEST_TEMPLATE_ROWS: DspRequestTemplateRow[] = [];

/**
 * Checks whether a Multiple Stock record belongs strictly to Program (HP) items (Special Stock Q)
 */
export function isProgramHpStockItem(item: any): boolean {
  if (!item) return false;
  const spec = (item.specialStockType || '').trim().toUpperCase();
  return spec === 'Q';
}

/**
 * Builds DSP Request template rows from active Multiple Stock, filtering strictly to Special Stock 'Q' items
 * and sorting them alphabetically by material description, auto-filling Request Date and DSP Request To 'MOH'.
 */
export function buildDspTemplateRowsFromStock(stockItems: any[], todayStr?: string): DspRequestTemplateRow[] {
  const dateVal = todayStr || TODAY_ISO_DATE;
  let sourceList = stockItems && stockItems.length > 0 ? stockItems : DEFAULT_SAMPLE_HP_STOCK_ITEMS;
  let hpItems = (sourceList || []).filter(isProgramHpStockItem);

  if (hpItems.length === 0 && (!stockItems || stockItems.length === 0)) {
    hpItems = DEFAULT_SAMPLE_HP_STOCK_ITEMS.filter(isProgramHpStockItem);
  }

  // Sort alphabetically by material description or material code
  const sortedItems = [...hpItems].sort((a, b) => {
    const descA = (a.materialDescription || a.material || '').trim().toLowerCase();
    const descB = (b.materialDescription || b.material || '').trim().toLowerCase();
    return descA.localeCompare(descB);
  });

  return sortedItems.map((s, idx) => {
    return {
      id: `stock-hp-${s.id || idx}`,
      srNo: idx + 1,
      material: s.material || '',
      materialDescription: s.materialDescription || '',
      qty: s.unrestrictedStock || (s as any).qty || 0,
      totalAmount: s.currentValueOfUnrestrictedStock || (s as any).totalAmount || 0,
      valuationTypeDesc: s.inventoryValuationType || '',
      wbsElement: s.wbsElement || '',
      budgetSource: s.budgetSource || '',
      requestDate: dateVal,
      dspRequestTo: 'MOH'
    };
  });
}

export function generateDspRequestExcelBlob(rows: DspRequestTemplateRow[]): { blob: Blob; fileName: string } {
  const customCols = rows[0]?.rawColumns && rows[0].rawColumns.length > 0 ? rows[0].rawColumns : null;
  const headers = customCols ? customCols : [...DSP_REQUEST_TEMPLATE_COLUMNS];

  const exportData = rows.map((r, idx) => {
    if (customCols && r.rawRowData) {
      const obj: Record<string, any> = {};
      customCols.forEach(col => {
        obj[col] = r.rawRowData?.[col] ?? '';
      });
      return obj;
    }
    return {
      'S/N': r.srNo || idx + 1,
      'Material': r.material,
      'Material Description': r.materialDescription,
      'Qty': r.qty,
      'Total Amount': r.totalAmount,
      'Valuation Type Desc': r.valuationTypeDesc,
      'WBS Element': r.wbsElement,
      'Budget Source': r.budgetSource,
      'Request Date': r.requestDate || TODAY_ISO_DATE,
      'DSP request to': r.dspRequestTo || 'MOH'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, {
    header: headers
  });

  worksheet['!cols'] = headers.map((h) => {
    const lower = h.toLowerCase();
    if (lower === 's/n' || lower === '#') return { wch: 8 };
    if (lower.includes('description')) return { wch: 42 };
    if (lower === 'qty' || lower.includes('quantity')) return { wch: 10 };
    if (lower.includes('amount') || lower.includes('valuation')) return { wch: 22 };
    return { wch: 18 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DSP_Request_MOH');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return {
    blob,
    fileName: `DSP_Request_to_MOH_Program_HP_${TODAY_ISO_DATE}.xlsx`
  };
}

export function downloadDspRequestTemplateExcel(rows: DspRequestTemplateRow[] = DEFAULT_DSP_REQUEST_TEMPLATE_ROWS): void {
  const { blob, fileName } = generateDspRequestExcelBlob(rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDspRequestCSV(rows: DspRequestTemplateRow[], fileName = `DSP_Request_to_MOH_Program_HP_${TODAY_ISO_DATE}.csv`): void {
  const customCols = rows[0]?.rawColumns && rows[0].rawColumns.length > 0 ? rows[0].rawColumns : null;
  const cols = customCols ? customCols : [...DSP_REQUEST_TEMPLATE_COLUMNS];

  const escapeCsv = (val: any) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = cols.map(escapeCsv).join(',');
  const lines = rows.map((r, idx) => {
    if (customCols && r.rawRowData) {
      return customCols.map(col => escapeCsv(r.rawRowData?.[col] ?? '')).join(',');
    }
    return [
      r.srNo || idx + 1,
      escapeCsv(r.material),
      escapeCsv(r.materialDescription),
      r.qty,
      r.totalAmount,
      escapeCsv(r.valuationTypeDesc),
      escapeCsv(r.wbsElement),
      escapeCsv(r.budgetSource),
      escapeCsv(r.requestDate || TODAY_ISO_DATE),
      escapeCsv(r.dspRequestTo || 'MOH')
    ].join(',');
  });

  const csvContent = [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
