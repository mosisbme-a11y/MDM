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

// Strictly pure user uploaded records only (No default/sample data)
export const DEFAULT_DSP_REQUEST_TEMPLATE_ROWS: DspRequestTemplateRow[] = [];

/**
 * Checks whether a Multiple Stock record belongs strictly to Program (HP) items
 */
export function isProgramHpStockItem(item: any): boolean {
  if (!item) return false;
  const spec = (item.specialStockType || '').trim().toUpperCase();
  const wbs = (item.wbsElement || '').toUpperCase();
  const valType = (item.inventoryValuationType || '').toUpperCase();
  const group = (item.materialGroupName || '').toUpperCase();
  const desc = (item.materialDescription || '').toUpperCase();
  const mat = (item.material || '').toUpperCase();

  // Strictly filter by Special Stock 'Q' as requested by the user
  if (spec === 'Q') {
    return true;
  }
  return false;
}

/**
 * Builds DSP Request template rows from active Multiple Stock, filtering to ONLY Program (HP) items
 * and auto-filling Request Date with today's date and DSP Request To with 'MOH'.
 */
export function buildDspTemplateRowsFromStock(stockItems: any[], todayStr?: string): DspRequestTemplateRow[] {
  const dateVal = todayStr || TODAY_ISO_DATE;
  const hpItems = (stockItems || []).filter(isProgramHpStockItem);

  if (hpItems.length === 0) {
    return [];
  }

  return hpItems.map((s, idx) => {
    return {
      id: `stock-hp-${s.id || idx}`,
      srNo: idx + 1,
      material: s.material || '',
      materialDescription: s.materialDescription || '',
      qty: s.unrestrictedStock || 0,
      totalAmount: s.currentValueOfUnrestrictedStock || 0,
      valuationTypeDesc: s.inventoryValuationType || '',
      wbsElement: s.wbsElement || '',
      budgetSource: s.budgetSource || '',
      requestDate: dateVal,
      dspRequestTo: 'MOH'
    };
  });
}

export function generateDspRequestExcelBlob(rows: DspRequestTemplateRow[]): { blob: Blob; fileName: string } {
  const exportData = rows.map((r, idx) => ({
    'S/N': idx + 1,
    'Material': r.material,
    'Material Description': r.materialDescription,
    'Qty': r.qty,
    'Total Amount': r.totalAmount,
    'Valuation Type Desc': r.valuationTypeDesc,
    'WBS Element': r.wbsElement,
    'Budget Source': r.budgetSource,
    'Request Date': r.requestDate || TODAY_ISO_DATE,
    'DSP request to': r.dspRequestTo || 'MOH'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData, {
    header: [...DSP_REQUEST_TEMPLATE_COLUMNS]
  });

  worksheet['!cols'] = [
    { wch: 8 },  // S/N
    { wch: 18 }, // Material
    { wch: 42 }, // Material Description
    { wch: 10 }, // Qty
    { wch: 20 }, // Total Amount
    { wch: 24 }, // Valuation Type Desc
    { wch: 22 }, // WBS Element
    { wch: 16 }, // Budget Source
    { wch: 16 }, // Request Date
    { wch: 18 }  // DSP request to
  ];

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
  const headers = [...DSP_REQUEST_TEMPLATE_COLUMNS].join(',');
  const lines = rows.map((r, idx) => {
    const escapeCsv = (val: any) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    return [
      idx + 1,
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
