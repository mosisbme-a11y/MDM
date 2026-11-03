import * as XLSX from 'xlsx';
import { ReceivingDataRecord } from '../types';
import { downloadCSV } from '../utils/formatters';

export const RECEIVING_DATA_COLUMNS = [
  'Purchase order',
  'Reference',
  'Material',
  'Material Description',
  'Batch',
  'Quantity',
  'Storage Location',
  'Amt.in Loc.Cur.',
  'Movement Type',
  'Special Stock',
  'WBS Element',
  'Plant',
  'Posting Date'
] as const;

export interface ExactPostingDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  formattedDate: string; // "YYYY-MM-DD"
  rawSource?: any;
}

/**
 * Parses any date format found in Excel or CSV sources into exact day, month, and year.
 * Handles:
 *  - Excel numeric serials (e.g. 45361 -> 2024-03-10 via XLSX.SSF.parse_date_code)
 *  - String numeric serials ("45361")
 *  - JavaScript Date instances (from XLSX cellDates: true)
 *  - SAP compact date: YYYYMMDD (e.g. "20240315")
 *  - ISO date: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 *  - European / SAP date: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
 *  - US date: MM/DD/YYYY
 *  - Named month strings: DD-MMM-YYYY, DD MMM YYYY, MMM DD YYYY (e.g. "12-Mar-2024", "15 April 2024")
 *  - Separate Excel columns: Posting Year, Posting Month, Posting Day
 */
export function parseExactPostingDate(val: any, rowMap: Record<string, any> = {}): ExactPostingDate | null {
  // Check if separate year, month, day columns exist in the spreadsheet
  if (val === undefined || val === null || val === '') {
    const yVal = rowMap['postingyear'] || rowMap['year'] || rowMap['gjahr'] || rowMap['docyear'];
    const mVal = rowMap['postingmonth'] || rowMap['month'] || rowMap['monat'];
    const dVal = rowMap['postingday'] || rowMap['day'] || rowMap['tag'] || 1;
    if (yVal && mVal) {
      const y = parseInt(String(yVal).replace(/[^0-9]/g, ''), 10);
      const m = parseInt(String(mVal).replace(/[^0-9]/g, ''), 10);
      const d = parseInt(String(dVal).replace(/[^0-9]/g, ''), 10) || 1;
      if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          year: y,
          month: m,
          day: d,
          formattedDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          rawSource: `Year: ${yVal}, Month: ${mVal}, Day: ${dVal}`
        };
      }
    }
    return null;
  }

  // 1. JavaScript Date object (e.g. from XLSX read with cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = val.getUTCMonth() + 1;
    const d = val.getUTCDate();
    return {
      year: y,
      month: m,
      day: d,
      formattedDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      rawSource: val
    };
  }

  // 2. Excel numeric date serials (e.g. 45361 or "45361" or 45361.5)
  const isNumericSerial =
    typeof val === 'number' ||
    (typeof val === 'string' && /^\d{4,5}(\.\d+)?$/.test(val.trim()));

  if (isNumericSerial) {
    const num = typeof val === 'number' ? val : parseFloat(val.trim());
    if (num >= 1000 && num <= 85000) {
      try {
        const parsed = XLSX.SSF.parse_date_code(num);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          return {
            year: parsed.y,
            month: parsed.m,
            day: parsed.d,
            formattedDate: `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`,
            rawSource: val
          };
        }
      } catch {
        // Continue to string parsing fallback
      }
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // 3. SAP compact YYYYMMDD (e.g. "20240315")
  const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const y = parseInt(compactMatch[1], 10);
    const m = parseInt(compactMatch[2], 10);
    const d = parseInt(compactMatch[3], 10);
    if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        year: y,
        month: m,
        day: d,
        formattedDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  // 4. ISO YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s.*)?$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        year: y,
        month: m,
        day: d,
        formattedDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  // 5. European / SAP DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, or US MM/DD/YYYY
  const dmyMatch = str.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})(?:\s.*)?$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const sep = dmyMatch[2];
    const p2 = parseInt(dmyMatch[3], 10);
    let y = parseInt(dmyMatch[4], 10);
    if (y < 100) y += y < 70 ? 2000 : 1900;

    let day = p1;
    let month = p2;

    // In German / European / SAP standard, dot separator (.) is ALWAYS DD.MM.YYYY
    if (sep === '.') {
      day = p1;
      month = p2;
    } else if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    } else {
      // Both numbers <= 12. Standard SAP/international format is DD/MM/YYYY
      day = p1;
      month = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year: y,
        month,
        day,
        formattedDate: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  // 6. Named Month: "12-Mar-2024", "15 Mar 2024", "March 15, 2024", "15-April-2026"
  const monthNames: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  const mmmMatch = str.match(/^(\d{1,2})[-/\s]([a-zA-Z]{3,9})[-/\s](\d{2,4})(?:\s.*)?$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const mStr = mmmMatch[2].toLowerCase();
    const month = monthNames[mStr] || monthNames[mStr.slice(0, 3)];
    let y = parseInt(mmmMatch[3], 10);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (month && day >= 1 && day <= 31) {
      return {
        year: y,
        month,
        day,
        formattedDate: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  const mmmMatchRev = str.match(/^([a-zA-Z]{3,9})[-/\s](\d{1,2})[,]?[-/\s](\d{2,4})(?:\s.*)?$/);
  if (mmmMatchRev) {
    const mStr = mmmMatchRev[1].toLowerCase();
    const month = monthNames[mStr] || monthNames[mStr.slice(0, 3)];
    const day = parseInt(mmmMatchRev[2], 10);
    let y = parseInt(mmmMatchRev[3], 10);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (month && day >= 1 && day <= 31) {
      return {
        year: y,
        month,
        day,
        formattedDate: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  // 7. General JS Date parse fallback
  const dObj = new Date(str);
  if (!isNaN(dObj.getTime())) {
    const y = dObj.getFullYear();
    const m = dObj.getMonth() + 1;
    const d = dObj.getDate();
    if (y >= 1970 && y <= 2100) {
      return {
        year: y,
        month: m,
        day: d,
        formattedDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        rawSource: str
      };
    }
  }

  return null;
}

export interface DateRecordInput {
  postingYear?: number;
  postingMonth?: number;
  postingDay?: number;
  postingDate?: string;
  year?: number;
  month?: number;
  day?: number;
  formattedDate?: string;
  entryDate?: string;
}

/**
 * Calculates stock holding days: difference between today's date and the exact posting date (in days).
 * Uses exact calendar date difference via UTC to avoid timezone/DST drift.
 * Automatically updates every day as the calendar advances.
 */
export function calculateStockHoldingDays(
  dateInput?: string | number | Date | null,
  record?: DateRecordInput | null
): number | null {
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  // Direct year, month, day if already extracted
  if (record) {
    if (record.postingYear && record.postingMonth && record.postingDay) {
      y = record.postingYear;
      m = record.postingMonth;
      d = record.postingDay;
    } else if (record.year && record.month && record.day) {
      y = record.year;
      m = record.month;
      d = record.day;
    }
  }

  if (y === undefined || m === undefined || d === undefined) {
    const target =
      dateInput !== undefined && dateInput !== null && dateInput !== ''
        ? dateInput
        : record?.postingDate || record?.formattedDate || record?.entryDate;

    if (target !== undefined && target !== null && target !== '') {
      const parsed = parseExactPostingDate(target);
      if (parsed) {
        y = parsed.year;
        m = parsed.month;
        d = parsed.day;
      }
    }
  }

  if (y === undefined || m === undefined || d === undefined) {
    return null;
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const postUtc = Date.UTC(y, m - 1, d);

  const diffDays = Math.round((todayUtc - postUtc) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Checks if a movement type corresponds to Movement Type 641 (MD Transfer to Plant)
 */
export function isMovementType641(movementType?: string | null): boolean {
  if (!movementType) return false;
  const cleaned = String(movementType).trim().toLowerCase();
  return (
    cleaned === '641' ||
    cleaned.startsWith('641') ||
    cleaned.includes('tf to plant') ||
    cleaned.includes('transfer to plant') ||
    cleaned.includes('md transfer')
  );
}

/**
 * Determines whether a receiving / transfer record belongs to Revolving Drug Fund (RDF)
 * or Health Program (HP - Grants / MOH Projects).
 */
export function getReceivingFundStream(rec: Partial<ReceivingDataRecord>): 'RDF' | 'HP' {
  const spec = (rec.specialStock || '').trim().toUpperCase();
  const wbs = (rec.wbsElement || '').toUpperCase();
  const valType = (rec.valuationType || '').toUpperCase();
  const ref = (rec.reference || '').toUpperCase();
  const po = (rec.purchaseOrder || '').toUpperCase();
  const desc = (rec.materialDescription || '').toUpperCase();

  // Program stock indicators (Grants, Global Fund, PEPFAR, MOH Projects, Special stock 'Q')
  if (
    spec === 'Q' ||
    wbs.includes('HP') ||
    wbs.includes('GF') ||
    wbs.includes('MOH') ||
    wbs.includes('PEPFAR') ||
    wbs.includes('PROGRAM') ||
    wbs.includes('SDG') ||
    valType.includes('HP') ||
    ref.includes('HP') ||
    po.includes('HP')
  ) {
    return 'HP';
  }

  // Revolving Drug Fund indicators
  if (
    spec === 'RDF' ||
    wbs.includes('RDF') ||
    valType.includes('RDF') ||
    ref.includes('RDF') ||
    desc.includes('RDF')
  ) {
    return 'RDF';
  }

  // Default SAP rule: if special stock is 'Q' it is HP, otherwise RDF
  return spec === 'Q' ? 'HP' : 'RDF';
}

export const DEFAULT_RECEIVING_DATA_RECORDS: Omit<ReceivingDataRecord, 'id'>[] = [];

export const SAMPLE_MD_TRANSFER_641_RECORDS: ReceivingDataRecord[] = DEFAULT_RECEIVING_DATA_RECORDS.filter(
  (r) => r.movementType === '641'
).map((r, i) => ({
  ...r,
  id: `sample-trf-641-${i}`
}));

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses raw uploaded rows (from XLSX / CSV / TSV) into validated ReceivingDataRecord items.
 * Extracts exact Posting Date, Month, and Year directly from the Excel source.
 */
export function parseReceivingDataRows(rawRows: any[], sourceName: string = 'Upload'): ReceivingDataRecord[] {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return [];

  const records: ReceivingDataRecord[] = [];
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

    const getRaw = (aliases: string[]): any => {
      for (const alias of aliases) {
        const val = rowMap[normalizeKey(alias)];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
      return undefined;
    };

    const getStr = (aliases: string[], fallback: string = ''): string => {
      const raw = getRaw(aliases);
      if (raw !== undefined && raw !== null) {
        return String(raw).trim();
      }
      return fallback;
    };

    const getNum = (aliases: string[], fallback: number = 0): number => {
      const raw = getRaw(aliases);
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) return num;
      }
      return fallback;
    };

    const materialDesc = getStr(['materialdescription', 'materialdesc', 'description', 'maktx', 'itemdescription', 'product', 'itemname']);
    const materialCode = getStr(['material', 'materialnumber', 'materialcode', 'matnr', 'itemcode', 'partnumber', 'sku']);
    
    if (!materialDesc && !materialCode) return;

    const qty = getNum(['quantity', 'qty', 'menge', 'quantityinbaseunit', 'grqty'], 1);
    const amt = getNum(['amtinloccur', 'amtinloccurrency', 'amountinlocalcurrency', 'dmbtr', 'totalamount', 'valuation', 'netamount'], 0);
    const mvtType = getStr(['movementtype', 'mvt', 'bwart', 'mvttype'], '101');

    // Extract exact posting date from Excel source
    const rawPostingDate = getRaw([
      'postingdate',
      'pstngdate',
      'budat',
      'cpudt',
      'postingdt',
      'entrydate',
      'grdate',
      'receiptdate',
      'bldat',
      'documentdate',
      'date',
      'posting_date'
    ]);

    const parsedDate = parseExactPostingDate(rawPostingDate, rowMap);

    let postingDateStr: string;
    let postingYear: number | undefined;
    let postingMonth: number | undefined;
    let postingDay: number | undefined;
    let holdingDays: number | null = null;

    if (parsedDate) {
      postingDateStr = parsedDate.formattedDate;
      postingYear = parsedDate.year;
      postingMonth = parsedDate.month;
      postingDay = parsedDate.day;
      holdingDays = calculateStockHoldingDays(null, parsedDate);
    } else if (rawPostingDate) {
      postingDateStr = String(rawPostingDate).trim();
      holdingDays = calculateStockHoldingDays(postingDateStr);
    } else {
      postingDateStr = '';
    }

    records.push({
      id: `rec-${now}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
      purchaseOrder: getStr(['purchaseorder', 'po', 'ponumber', 'ebeln', 'purchasingdoc'], `PO-${40000 + idx}`),
      reference: getStr(['reference', 'ref', 'xblnr', 'deliverynote'], `REF-${idx + 1}`),
      material: materialCode || `MAT-${100000 + idx}`,
      materialDescription: materialDesc || 'Medical Supply Item',
      batch: getStr(['batch', 'charg', 'lot'], `BATCH-${idx + 1}`),
      quantity: qty,
      storageLocation: getStr(['storagelocation', 'sloc', 'lgort'], 'SL01'),
      amtInLocCur: amt,
      movementType: mvtType,
      specialStock: getStr(['specialstock', 'sobkz'], ''),
      wbsElement: getStr(['wbselement', 'wbs', 'project', 'posid'], ''),
      plant: getStr(['plant', 'werks', 'hub'], 'AA01'),
      postingDate: postingDateStr,
      postingYear,
      postingMonth,
      postingDay,
      rawPostingDate: rawPostingDate !== undefined ? rawPostingDate : undefined,
      stockHoldingDays: holdingDays !== null ? holdingDays : undefined,
      uploadedAt: new Date().toISOString(),
      sourceFile: sourceName,
      rawImportedRow: row
    });
  });

  return records;
}

export function downloadReceivingDataTemplateCSV(): void {
  const data = DEFAULT_RECEIVING_DATA_RECORDS.map((r) => {
    const holdingDays = calculateStockHoldingDays(r.postingDate, r);
    return {
      'Purchase order': r.purchaseOrder,
      'Reference': r.reference,
      'Material': r.material,
      'Material Description': r.materialDescription,
      'Batch': r.batch,
      'Quantity': r.quantity,
      'Storage Location': r.storageLocation,
      'Amt.in Loc.Cur.': r.amtInLocCur,
      'Movement Type': r.movementType,
      'Special Stock': r.specialStock,
      'WBS Element': r.wbsElement,
      'Plant': r.plant,
      'Posting Date': r.postingDate,
      'Stock Holding Days': holdingDays !== null ? `${holdingDays} Days` : '-'
    };
  });

  downloadCSV(`EPSS_Receiving_Data_Template_${new Date().toISOString().split('T')[0]}.csv`, data);
}

export function downloadReceivingDataTemplateExcel(): void {
  const rows = DEFAULT_RECEIVING_DATA_RECORDS.map((r) => {
    const holdingDays = calculateStockHoldingDays(r.postingDate, r);
    return {
      'Purchase order': r.purchaseOrder,
      'Reference': r.reference,
      'Material': r.material,
      'Material Description': r.materialDescription,
      'Batch': r.batch,
      'Quantity': r.quantity,
      'Storage Location': r.storageLocation,
      'Amt.in Loc.Cur.': r.amtInLocCur,
      'Movement Type': r.movementType,
      'Special Stock': r.specialStock,
      'WBS Element': r.wbsElement,
      'Plant': r.plant,
      'Posting Date': r.postingDate,
      'Stock Holding Days': holdingDays !== null ? `${holdingDays} Days` : '-'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...RECEIVING_DATA_COLUMNS, 'Stock Holding Days']
  });

  worksheet['!cols'] = [
    { wch: 15 }, // Purchase order
    { wch: 15 }, // Reference
    { wch: 14 }, // Material
    { wch: 45 }, // Material Description
    { wch: 12 }, // Batch
    { wch: 10 }, // Quantity
    { wch: 14 }, // Storage Location
    { wch: 16 }, // Amt.in Loc.Cur.
    { wch: 14 }, // Movement Type
    { wch: 12 }, // Special Stock
    { wch: 22 }, // WBS Element
    { wch: 10 }, // Plant
    { wch: 14 }, // Posting Date
    { wch: 18 }  // Stock Holding Days
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receiving Data');
  XLSX.writeFile(workbook, `EPSS_Receiving_Data_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function generateReceivingDataCSVText(): string {
  const headers = [...RECEIVING_DATA_COLUMNS, 'Stock Holding Days'].join(',');
  const lines = DEFAULT_RECEIVING_DATA_RECORDS.map((r) => {
    const holdingDays = calculateStockHoldingDays(r.postingDate, r);
    return [
      `"${r.purchaseOrder}"`,
      `"${r.reference}"`,
      `"${r.material}"`,
      `"${r.materialDescription.replace(/"/g, '""')}"`,
      `"${r.batch}"`,
      r.quantity,
      `"${r.storageLocation}"`,
      r.amtInLocCur.toFixed(2),
      `"${r.movementType}"`,
      `"${r.specialStock}"`,
      `"${r.wbsElement}"`,
      `"${r.plant}"`,
      r.postingDate,
      `"${holdingDays !== null ? `${holdingDays} Days` : '-'}"`
    ].join(',');
  });

  return [headers, ...lines].join('\n');
}
