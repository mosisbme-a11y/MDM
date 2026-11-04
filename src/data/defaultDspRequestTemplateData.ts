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
  'Sr. No',
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
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-02',
    srNo: 2,
    material: '403-XRRD-0101',
    materialDescription: 'Bed - Patient, Fowler, Adult',
    qty: 30,
    totalAmount: 2850000.00,
    valuationTypeDesc: 'Paramount Bed Co.',
    wbsElement: 'SDG-ME-23-001-012',
    budgetSource: 'WB',
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-03',
    srNo: 3,
    material: '403-XRRB-0101N',
    materialDescription: 'Bowel - With Stand, Stainless Steel.',
    qty: 25,
    totalAmount: 487500.00,
    valuationTypeDesc: 'Surgicon Medical',
    wbsElement: 'SDG-ME-23-001-015',
    budgetSource: 'MOH',
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-04',
    srNo: 4,
    material: '403-XRRD-0101-001',
    materialDescription: 'Cold box',
    qty: 15,
    totalAmount: 1275000.00,
    valuationTypeDesc: 'Dometic Medical',
    wbsElement: 'SDG-ME-23-001-018',
    budgetSource: 'WB',
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-05',
    srNo: 5,
    material: '401-WICU-0101N',
    materialDescription: 'Couch - Delivery',
    qty: 15,
    totalAmount: 1890000.00,
    valuationTypeDesc: 'Lojer Medical',
    wbsElement: 'SDG-ME-23-001-022',
    budgetSource: 'Global Fund',
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  },
  {
    id: 'dsp-req-row-06',
    srNo: 6,
    material: '401-WICU-0101N',
    materialDescription: 'Couch - Examination',
    qty: 15,
    totalAmount: 1350000.00,
    valuationTypeDesc: 'Lojer Medical',
    wbsElement: 'SDG-ME-23-001-024',
    budgetSource: 'Treasury',
    requestDate: '2026-10-24',
    dspRequestTo: 'MOH'
  }
];

export function generateDspRequestExcelBlob(rows: DspRequestTemplateRow[]): { blob: Blob; fileName: string } {
  const exportData = rows.map((r, idx) => ({
    'Sr. No': idx + 1,
    'Material': r.material,
    'Material Description': r.materialDescription,
    'Qty': r.qty,
    'Total Amount': r.totalAmount,
    'Valuation Type Desc': r.valuationTypeDesc,
    'WBS Element': r.wbsElement,
    'Budget Source': r.budgetSource,
    'Request Date': r.requestDate || '',
    'DSP request to': r.dspRequestTo || 'MOH'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData, {
    header: [...DSP_REQUEST_TEMPLATE_COLUMNS]
  });

  worksheet['!cols'] = [
    { wch: 8 },  // Sr. No
    { wch: 18 }, // Material
    { wch: 40 }, // Material Description
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
    fileName: `DSP_Request_to_MOH_Template_${new Date().toISOString().slice(0, 10)}.xlsx`
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

export function downloadDspRequestCSV(rows: DspRequestTemplateRow[], fileName = 'DSP_Request_to_MOH.csv'): void {
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
      escapeCsv(r.requestDate),
      escapeCsv(r.dspRequestTo)
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
