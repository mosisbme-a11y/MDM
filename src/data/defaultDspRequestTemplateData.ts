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

// Exactly 5 Program (HP) items matching user screenshot counter (5) and template
export const DEFAULT_DSP_REQUEST_TEMPLATE_ROWS: DspRequestTemplateRow[] = [
  {
    id: 'dsp-req-row-01',
    srNo: 1,
    material: '403-XRRD-0101',
    materialDescription: 'Anesthesia machine - with Patient mon',
    qty: 3,
    totalAmount: 16568693.19,
    valuationTypeDesc: 'Siemens Healthineers',
    wbsElement: 'SDG-ME-23-001-011',
    budgetSource: 'WB',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-02',
    srNo: 2,
    material: 'MAT-100235',
    materialDescription: 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive',
    qty: 28,
    totalAmount: 16800000.00,
    valuationTypeDesc: 'Standard Price (S)',
    wbsElement: 'WBS-EPSS-ICU-02',
    budgetSource: 'WB',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-03',
    srNo: 3,
    material: 'MAT-100239',
    materialDescription: 'Infant Radiant Warmer with Phototherapy Unit & Microprocessor Temp Control',
    qty: 35,
    totalAmount: 4200000.00,
    valuationTypeDesc: 'Standard Price (S)',
    wbsElement: 'WBS-EPSS-NEO-06',
    budgetSource: 'Global Fund',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-04',
    srNo: 4,
    material: 'MAT-100240',
    materialDescription: 'Automated External Defibrillator (AED) Biphasic with Adult/Pedi Pads',
    qty: 50,
    totalAmount: 5500000.00,
    valuationTypeDesc: 'Moving Average (V)',
    wbsElement: 'WBS-EPSS-EMERG-07',
    budgetSource: 'MOH',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-05',
    srNo: 5,
    material: 'MAT-100242',
    materialDescription: 'Fresenius 4008S Hemodialysis Machine with Endotoxin Filter',
    qty: 20,
    totalAmount: 18500000.00,
    valuationTypeDesc: 'Standard Price (S)',
    wbsElement: 'WBS-EPSS-DIAL-09',
    budgetSource: 'Treasury',
    requestDate: TODAY_ISO_DATE,
    dspRequestTo: 'MOH'
  }
];

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
    return DEFAULT_DSP_REQUEST_TEMPLATE_ROWS.map(r => ({
      ...r,
      requestDate: dateVal,
      dspRequestTo: 'MOH'
    }));
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
