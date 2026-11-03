import { MedicalDeviceItem, NoBkdItem, MaintenanceCalendarEvent, DeviceDocument, AlertNotification } from '../types';

export const MASTER_INVENTORY_COLUMNS = [
  'ID',
  'Plant',
  'Plant Name',
  'Warehouse',
  'Material Code',
  'Material Description',
  'Quantity',
  'Unit Price (ETB)',
  'Total Amount (ETB)',
  'SOH Status',
  'Batch',
  'Expiry Date',
  'Manufacturer',
  'WBS Element',
  'Stock Type',
  'Special Stock Type',
  'Operational Status',
  'Needs Spare Part',
  'Non-Moving Stock',
  'Installation Status',
  'Delivery Status',
  'Next Action',
  'Way of Intervention',
  'Responsible Body',
  'Timeframe',
  'FYA EPSS Status'
];

export const NO_BKD_COLUMNS = [
  'ID',
  'Material Code',
  'Material Description',
  'Quantity',
  'Unit',
  'Plant',
  'Storage Location',
  'WBS Element',
  'Batch',
  'Expiry Date',
  'MOH Approval Status',
  'Remark'
];

// Helper to sanitize header string for fuzzy matching
const normalizeHeader = (h: string): string => {
  return (h || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

// Map all headers by their normalized name to their index
export function mapAllHeaders(headerRow: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  if (!headerRow || !Array.isArray(headerRow)) return map;
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (norm) map[norm] = idx;
  });
  return map;
}

// Flexible column index detector
export function mapHeaderIndices(headerRow: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  if (!headerRow || !Array.isArray(headerRow)) return map;

  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;

    if (norm === 'id' || norm === 'deviceid' || norm === 'itemid' || norm === 'sn') map.id = idx;
    else if (norm === 'plant' || norm === 'plantcode' || norm === 'branch') map.plant = idx;
    else if (norm === 'plantname' || norm === 'hubname' || norm === 'hub' || norm === 'facility' || norm === 'facilities' || norm === 'healthfacility' || norm === 'hospital' || norm === 'destination' || norm === 'recipient' || norm === 'client' || norm === 'customer' || norm === 'facilityname' || norm === 'destinationfacility') map.plantName = idx;
    else if (norm === 'warehouse' || norm === 'wh' || norm === 'storagelocation' || norm === 'sloc') {
      map.wh = idx;
      map.storageLocation = idx;
    }
    else if (norm === 'materialcode' || norm === 'material' || norm === 'sapcode' || norm === 'itemcode' || norm === 'code' || norm === 'matcode') map.material = idx;
    else if (norm === 'materialdescription' || norm === 'description' || norm === 'equipmentdescription' || norm === 'devicename' || norm === 'item' || norm === 'itemdescription') map.materialDescription = idx;
    else if (norm === 'quantity' || norm === 'qty' || norm === 'stock' || norm === 'units' || norm === 'count' || norm === 'soh' || norm === 'shippedqty' || norm === 'deliveredqty' || norm === 'dispatchqty' || norm === 'allocatedqty') map.qty = idx;
    else if (norm === 'unitprice' || norm === 'unitpriceetb' || norm === 'unitcost' || norm === 'price' || norm === 'cost') map.unitPrice = idx;
    else if (norm === 'totalamount' || norm === 'totalamountetb' || norm === 'totalvalue' || norm === 'valuation' || norm === 'totalprice') map.totalAmount = idx;
    else if (norm === 'batch' || norm === 'lot' || norm === 'batchnumber') map.batch = idx;
    else if (norm === 'expirydate' || norm === 'expdate' || norm === 'expiry') map.expiryDate = idx;
    else if (norm === 'manufacturer' || norm === 'make' || norm === 'brand' || norm === 'vendor') map.manufacturer = idx;
    else if (norm === 'wbselement' || norm === 'wbs' || norm === 'project' || norm === 'projectcode' || norm === 'account' || norm === 'budgetaccount' || norm === 'fundingaccount' || norm === 'ledger' || norm === 'budget' || norm === 'source' || norm === 'accountcode' || norm === 'funding') map.wbsElement = idx;
    else if (norm === 'stocktype' || norm === 'stockcategory') map.stockType = idx;
    else if (norm === 'specialstocktype' || norm === 'specialstock') map.specialStockType = idx;
    else if (norm === 'operationalstatus' || norm === 'status' || norm === 'condition') map.operationalStatus = idx;
    else if (norm === 'needssparepart' || norm === 'needsspare' || norm === 'sparepart') map.needsSparePart = idx;
    else if (norm === 'nonmovingstock' || norm === 'nonmoving' || norm === 'isnonmoving') map.isNonMoving = idx;
    else if (norm === 'installationstatus' || norm === 'installedstatus' || norm === 'installation' || norm.includes('distributiondatahubtoh') || norm.includes('hubtoh') || norm.includes('distributiondatahub')) map.installationStatus = idx;
    else if (norm === 'deliverystatus' || norm === 'shipmentstatus' || norm === 'delivery' || norm === 'dispatchstatus') map.deliveryStatus = idx;
    else if (norm === 'nextaction' || norm === 'action' || norm === 'actionrequired') map.nextAction = idx;
    else if (norm === 'wayofintervention' || norm === 'intervention' || norm === 'waytointervene') map.wayOfIntervention = idx;
    else if (norm === 'responsiblebody' || norm === 'responsibleperson' || norm === 'owner') map.responsibleBody = idx;
    else if (norm === 'timeframe' || norm === 'timeline' || norm === 'schedule') map.timeFrame = idx;
    else if (norm === 'fyaepssstatus' || norm === 'nobrkdstatus' || norm === 'fyaepssnobkdstatus') map.fyaEpSSNoBkdStatus = idx;
    else if (norm === 'unit' || norm === 'uom') map.unit = idx;
    else if (norm === 'contractissue' || norm === 'contract' || norm === 'contractdepartment' || norm === 'contractdepartmentissue') map.contractIssue = idx;
    else if (norm === 'lc' || norm === 'lcstatus' || norm === 'letterofcredit') map.lcStatus = idx;
    else if (norm === 'shipment' || norm === 'shipmentstatus') map.shipmentStatus = idx;
    else if (norm === 'clearance' || norm === 'clearancestatus' || norm === 'customsclearance') map.clearanceStatus = idx;
    else if (norm === 'assigntrain' || norm === 'train' || norm === 'trainstatus') map.assignTrainStatus = idx;
    else if (norm === 'storagelocation' || norm === 'sloc') map.storageLocation = idx;
    else if (norm === 'mohapprovalstatus' || norm === 'mohstatus' || norm === 'approvalstatus') map.mohApprovalStatus = idx;
    else if (norm === 'remark' || norm === 'notes') map.remark = idx;
    else if (norm === 'date' || norm === 'scheduledate' || norm === 'inspectiondate') map.date = idx;
    else if (norm === 'time' || norm === 'scheduletime') map.time = idx;
    else if (norm === 'title' || norm === 'event' || norm === 'documentname' || norm === 'subject') map.title = idx;
    else if (norm === 'type' || norm === 'category' || norm === 'documenttype' || norm === 'alerttype') map.type = idx;
    else if (norm === 'priority' || norm === 'urgency' || norm === 'level') map.priority = idx;
    else if (
      norm === 'sohstatus' ||
      norm === 'soh' ||
      norm === 'stockstatus' ||
      norm === 'stockonhand' ||
      norm === 'stockonhandstatus' ||
      norm === 'inventorystatus' ||
      norm === 'itemstatus' ||
      norm === 'stockcondition' ||
      norm === 'stockstate' ||
      norm === 'sohstate'
    ) {
      map.sohStatus = idx;
    }
  });

  return map;
}

// Convert arbitrary 2D Google Sheets row array into full MedicalDeviceItem[]
export function parseSheetRowsToMedicalDevices(values: any[][], sheetTabName?: string): MedicalDeviceItem[] {
  if (!values || values.length < 1) return [];

  // Find the header row by looking for known keywords (resilient to empty rows at top)
  let headerRowIdx = 0;
  let colMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;
    const tempMap = mapHeaderIndices(row);
    // If we found at least 2 key columns (Material and Qty), assume this is the header row
    if (tempMap.materialDescription !== undefined && tempMap.qty !== undefined) {
      headerRowIdx = i;
      colMap = tempMap;
      break;
    }
  }

  // Fallback: if no headers found, assume row 0 is header and use defaults
  if (Object.keys(colMap).length === 0) {
    headerRowIdx = 0;
    colMap = mapHeaderIndices(values[0]);
  }

  // Get all header mappings for additional attributes
  const allHeaders = mapAllHeaders(values[headerRowIdx]);

  const rows = values.slice(headerRowIdx + 1);
  const results: MedicalDeviceItem[] = [];

  rows
    .filter((r) => r && r.length > 0 && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .forEach((row, idx) => {
      // Access by mapped header, or fallback to standard sequential index
      const getVal = (key: string, defaultIdx: number): string => {
        const i = colMap[key] !== undefined ? colMap[key] : defaultIdx;
        const v = row[i];
        return v !== undefined && v !== null ? String(v).trim() : '';
      };

      const plant = getVal('plant', 1) || 'HO01';
      const hubNamesMap: Record<string, string> = {
        'HO01': 'Head office',
        'AD01': 'Adama',
        'AA01': 'Addis Ababa (Hub 1)',
        'AA02': 'Addis Ababa (Hub 2)',
        'AR01': 'Arba Minch',
        'AS01': 'Assosa',
        'BD01': 'Bahir Dar',
        'DS01': 'Dessie',
        'DD01': 'Dire Dawa',
        'GB01': 'Gambella',
        'GD01': 'Gondar',
        'HW01': 'Hawassa',
        'JM01': 'Jimma',
        'JJ01': 'Jijiga',
        'KB01': 'Kebri-Dehar',
        'MK01': 'Mekelle',
        'NG01': 'Negele',
        'NK01': 'Nekemte',
        'SM01': 'Semera',
        'SH02': 'Shire'
      };
      const plantName = getVal('plantName', 2) || hubNamesMap[plant] || `Hub ${plant}`;
      const wh = getVal('wh', 3) || 'HOM6';
      const material = getVal('material', 4) || '';
      const materialDescription = getVal('materialDescription', 5) || 'Unknown Medical Device';
      
      const rawQty = getVal('qty', 6);
      const qty = Math.max(0, Number(rawQty.replace(/[^0-9.-]/g, '')) || 0);

      const rawUnitPrice = getVal('unitPrice', 7);
      const rawTotalAmount = getVal('totalAmount', 8);

      let unitPrice = Number(rawUnitPrice.replace(/[^0-9.-]/g, '')) || 0;
      let totalAmount = Number(rawTotalAmount.replace(/[^0-9.-]/g, '')) || 0;

      if (totalAmount === 0 && unitPrice > 0 && qty > 0) {
        totalAmount = qty * unitPrice;
      } else if (unitPrice === 0 && totalAmount > 0 && qty > 0) {
        unitPrice = totalAmount / qty;
      }

      // Check if row is purely an aggregate header / blank entry
      const hasMeaningfulContent = material !== '' || (materialDescription !== '' && materialDescription !== 'Unknown Medical Device') || qty > 0 || totalAmount > 0;
      if (!hasMeaningfulContent) {
        return;
      }

      const id = getVal('id', 0) || (sheetTabName ? `${sheetTabName.replace(/[^a-zA-Z0-9]/g, '_')}-${idx + 1}` : `MD-${idx + 1}`);
      const batch = getVal('batch', 10);
      const expiryDate = getVal('expiryDate', 11);
      const manufacturer = getVal('manufacturer', 12) || 'Standard Healthcare Manufacturer';
      const wbsElement = getVal('wbsElement', 13);
      const stockType = getVal('stockType', 14) || 'Unrestricted';
      const specialStockType = getVal('specialStockType', 15) || '';

      const opStatusStr = getVal('operationalStatus', 16).toLowerCase();
      const needsSpareStr = getVal('needsSparePart', 17).toLowerCase();
      const nonMovingStr = getVal('isNonMoving', 18).toLowerCase();
      
      const lowerSheetName = (sheetTabName || '').toLowerCase();

      let isNotFunctional =
        opStatusStr.includes('defect') ||
        opStatusStr.includes('not func') ||
        opStatusStr.includes('break') ||
        opStatusStr === 'false' ||
        lowerSheetName.includes('defect');

      let needsSparePart =
        needsSpareStr.includes('yes') ||
        needsSpareStr.includes('true') ||
        needsSpareStr.includes('need') ||
        opStatusStr.includes('spare') ||
        lowerSheetName.includes('spare');

      let isNonMoving =
        nonMovingStr.includes('yes') ||
        nonMovingStr.includes('true') ||
        nonMovingStr.includes('slow') ||
        nonMovingStr.includes('non') ||
        lowerSheetName.includes('non-moving') ||
        lowerSheetName.includes('non moving');

      // Extract SOH Status (Stock on Hand Status)
      const rawSohStatus = getVal('sohStatus', 9);
      let sohStatus = rawSohStatus;
      if (rawSohStatus) {
        const lowerSoh = rawSohStatus.toLowerCase();
        if (lowerSoh.includes('defect') || lowerSoh.includes('breakdown')) {
          isNotFunctional = true;
          sohStatus = 'Defective';
        } else if (lowerSoh.includes('spare')) {
          needsSparePart = true;
          sohStatus = 'Needs Spare Parts';
        } else if (lowerSoh.includes('non-moving') || lowerSoh.includes('slow')) {
          isNonMoving = true;
          sohStatus = 'Non-Moving Stock';
        } else if (lowerSoh.includes('out of stock') || lowerSoh === 'zero') {
          sohStatus = 'Out of Stock';
        } else if (lowerSoh.includes('low')) {
          sohStatus = 'Low Stock';
        } else if (lowerSoh.includes('in stock') || lowerSoh.includes('hand') || lowerSoh.includes('active') || lowerSoh.includes('avail')) {
          sohStatus = 'Stock on Hand (Active)';
        }
      } else {
        if (isNotFunctional) {
          sohStatus = 'Defective';
        } else if (needsSparePart) {
          sohStatus = 'Needs Spare Parts';
        } else if (isNonMoving) {
          sohStatus = 'Non-Moving Stock';
        } else if (qty === 0) {
          sohStatus = 'Out of Stock';
        } else if (qty < 5) {
          sohStatus = 'Low Stock';
        } else {
          sohStatus = 'Stock on Hand (Active)';
        }
      }

      const rawInstStatus = getVal('installationStatus', 19);
      let installationStatus: any = rawInstStatus;
      if (!installationStatus) {
        if (/not installed/i.test(lowerSheetName)) installationStatus = 'Not Installed';
        else if (/distribution|hub\s*to\s*h/i.test(lowerSheetName)) installationStatus = 'Not Installed';
        else if (/pending|install/i.test(lowerSheetName)) installationStatus = 'Pending Installation';
        else if (isNotFunctional) installationStatus = 'Pending Installation';
        else installationStatus = 'Installed';
      } else {
        // Just normalize some common ones to match UI if needed, but preserve raw strings mostly
        if (/not installed/i.test(rawInstStatus)) installationStatus = 'Not Installed';
        else if (/pending/i.test(rawInstStatus) && !/installation/i.test(rawInstStatus)) installationStatus = 'Pending Installation';
        else if (/commission/i.test(rawInstStatus)) installationStatus = 'Under Commissioning';
        else if (/site|assess/i.test(rawInstStatus)) installationStatus = 'Site Assessment';
        else if (/^install$/i.test(rawInstStatus)) installationStatus = 'Installed';
      }

      const rawDelivStatus = getVal('deliveryStatus', 20);
      let deliveryStatus: MedicalDeviceItem['deliveryStatus'] = 'Delivered & Dispatched';
      if (/transit/i.test(rawDelivStatus)) deliveryStatus = 'In Transit';
      else if (/custom|port/i.test(rawDelivStatus)) deliveryStatus = 'Port Customs Clearance';
      else if (/dispatch|pending/i.test(rawDelivStatus)) deliveryStatus = 'Dispatch Pending';
      else if (/factory/i.test(rawDelivStatus)) deliveryStatus = 'Manufacturer Factory';
      else if (/transit|delivery/i.test(lowerSheetName)) deliveryStatus = 'In Transit';

      const nextAction = getVal('nextAction', 21) || (isNotFunctional ? 'Schedule Field Engineering Service' : 'Standard Routine Inspection');
      const wayOfIntervention = getVal('wayOfIntervention', 22) || (isNotFunctional ? 'Corrective Biomedical Repair' : 'Preventive Maintenance');
      const responsibleBody = getVal('responsibleBody', 23) || 'Biomedical Engineering Directorate';
      const timeFrame = getVal('timeFrame', 24) || 'Q3 2026';
      const budgetSource = getVal('budgetSource', 16) || getVal('budget', 16) || getVal('funding', 16) || getVal('source', 16) || (wbsElement ? `WBS: ${wbsElement}` : 'Federal Government Treasury (EPSS)');
      
      const fyaEpSSNoBkdStatus =
        getVal('fyaEpSSNoBkdStatus', 25) ||
        (isNotFunctional
          ? 'FYA Defective - Breakdown Required'
          : needsSparePart
          ? 'FYA Needs Spare - No Breakdown'
          : isNonMoving
          ? 'FYA Non-Moving - No Breakdown'
          : 'FYA Approved - No Breakdown');

      const dspRaw = getVal('hasDSP', 26) || getVal('dsp', 26) || getVal('DSP', 26);
      const hasDSP = dspRaw.toLowerCase() === 'yes' || dspRaw.toLowerCase() === 'true' || dspRaw.toLowerCase() === '1' || lowerSheetName.includes('dsp');

      // Capture all other columns as additional attributes
      const additionalAttributes: Record<string, string> = {};
      const knownKeyIndices = Object.values(colMap);
      Object.entries(allHeaders).forEach(([headerName, idx]) => {
        if (!knownKeyIndices.includes(idx)) {
          additionalAttributes[headerName] = String(row[idx] || '').trim();
        }
      });

      results.push({
        id,
        plant,
        plantName,
        wh,
        material,
        materialDescription,
        qty,
        unitPrice,
        totalAmount,
        batch,
        expiryDate,
        manufacturer,
        wbsElement,
        budgetSource,
        stockType,
        specialStockType,
        materialType: 'Medical Equipment',
        isNotFunctional,
        needsSparePart,
        isNonMoving,
        hasDSP,
        isAccessorySpare: false,
        bkdType: 'Standard',
        nextAction,
        wayOfIntervention,
        responsibleBody,
        timeFrame,
        fyaEpSSNoBkdStatus,
        sohStatus,
        sheetTabSource: sheetTabName || 'Master SOH',
        installationStatus,
        deliveryStatus,
        contractIssue: getVal('contractIssue', -1),
        lcStatus: getVal('lcStatus', -1),
        shipmentStatus: getVal('shipmentStatus', -1),
        clearanceStatus: getVal('clearanceStatus', -1),
        assignTrainStatus: getVal('assignTrainStatus', -1),
        additionalAttributes
      });
    });

  return results;
}

// Convert MedicalDeviceItem[] to 2D array with ALL 26 columns (including SOH Status)
export function generateMasterInventorySheetData(items: MedicalDeviceItem[]): any[][] {
  const rows = items.map((i) => [
    i.id,
    i.plant,
    i.plantName || (i.plant === 'HO01' ? 'Central Hub Addis Ababa' : `Regional Hub ${i.plant}`),
    i.wh,
    i.material,
    i.materialDescription,
    i.qty,
    i.unitPrice || (i.qty > 0 ? i.totalAmount / i.qty : 0),
    i.totalAmount,
    i.sohStatus || (i.isNotFunctional ? 'Defective' : i.qty === 0 ? 'Out of Stock' : i.qty < 5 ? 'Low Stock' : 'Stock on Hand (Active)'),
    i.batch || '',
    i.expiryDate || '',
    i.manufacturer || 'Standard Healthcare',
    i.wbsElement || '',
    i.stockType || 'Unrestricted',
    i.specialStockType || '',
    i.isNotFunctional ? 'Defective' : 'Functional',
    i.needsSparePart ? 'Yes' : 'No',
    i.isNonMoving ? 'Yes' : 'No',
    i.installationStatus || 'Installed',
    i.deliveryStatus || 'Delivered & Dispatched',
    i.nextAction || '',
    i.wayOfIntervention || '',
    i.responsibleBody || '',
    i.timeFrame || '',
    i.fyaEpSSNoBkdStatus || (i.isNotFunctional ? 'FYA Defective - Breakdown Required' : 'FYA Approved - No Breakdown')
  ]);

  return [MASTER_INVENTORY_COLUMNS, ...rows];
}

export function parseSheetRowsToNoBkdItems(values: any[][]): NoBkdItem[] {
  if (!values || values.length < 1) return [];

  // Find the header row by looking for known keywords (resilient to empty rows at top)
  let headerRowIdx = 0;
  let colMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;
    const tempMap = mapHeaderIndices(row);
    // If we found at least 2 key columns (Description and Qty), assume this is the header row
    if (tempMap.materialDescription !== undefined && tempMap.qty !== undefined) {
      headerRowIdx = i;
      colMap = tempMap;
      break;
    }
  }

  // Fallback: if no headers found, assume row 0 is header and use defaults
  if (Object.keys(colMap).length === 0) {
    headerRowIdx = 0;
    colMap = mapHeaderIndices(values[0]);
  }

  const rows = values.slice(headerRowIdx + 1);
  const results: NoBkdItem[] = [];

  rows
    .filter((r) => r && r.length > 0 && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .forEach((row, idx) => {
      const getVal = (key: string, defaultIdx: number): string => {
        const i = colMap[key] !== undefined ? colMap[key] : defaultIdx;
        const v = row[i];
        return v !== undefined && v !== null ? String(v).trim() : '';
      };

      const material = getVal('material', 0);
      const materialDescription = getVal('materialDescription', 1);
      
      const rawQty = getVal('qty', 2);
      const qty = Math.max(0, Number(rawQty.replace(/[^0-9.-]/g, '')) || 0);

      // Even more permissive: if we have either a code or a description, it's a valid row
      if (!material && !materialDescription) return;

      const id = getVal('id', -1) || `NOBKD-${idx + 1}`;
      const unit = getVal('unit', 3) || 'EA';
      const plant = getVal('plant', 4) || 'HO01';
      const storageLocation = getVal('storageLocation', 5) || 'HOM6';
      const wbsElement = getVal('wbsElement', 6) || '';
      const batch = getVal('batch', 7);
      const expiryDate = getVal('expiryDate', 8);
      
      const rawMohStatus = getVal('mohApprovalStatus', 9) || '';
      let mohApprovalStatus: 'Pending' | 'Approved' | 'Rejected' = 'Pending';
      if (/approve/i.test(rawMohStatus)) mohApprovalStatus = 'Approved';
      else if (/reject/i.test(rawMohStatus)) mohApprovalStatus = 'Rejected';

      const remark = getVal('remark', 11) || '';

      results.push({
        id,
        code: material,
        description: materialDescription,
        qty,
        unit,
        plant,
        storageLocation,
        wbsElement,
        batch,
        expiryDate,
        mohApprovalStatus,
        remark
      });
    });

  return results;
}

// Convert NoBkdItem[] to 2D array for No Breakdown sheet tab
export function generateNoBkdSheetData(noBkdItems: NoBkdItem[]): any[][] {
  const rows = noBkdItems.map((item) => [
    item.id,
    item.code,
    item.description,
    item.qty,
    item.unit || 'EA',
    item.plant,
    item.storageLocation,
    item.wbsElement || '',
    item.batch || '',
    item.expiryDate || '',
    item.mohApprovalStatus || 'Pending',
    item.remark || ''
  ]);

  return [NO_BKD_COLUMNS, ...rows];
}

// Regional Hub Summary Sheet tab data
export function generateRegionalHubSheetData(items: MedicalDeviceItem[]): any[][] {
  const headers = ['Plant Code', 'Hub Name', 'Total Line Items', 'Total Equipment Units', 'Total Valuation (ETB)'];
  const plantMap = new Map<string, { name: string; items: number; qty: number; value: number }>();

  items.forEach((item) => {
    const p = item.plant || 'HO01';
    const existing = plantMap.get(p) || {
      name: item.plantName || p,
      items: 0,
      qty: 0,
      value: 0
    };
    existing.items += 1;
    existing.qty += item.qty || 0;
    existing.value += item.totalAmount || 0;
    plantMap.set(p, existing);
  });

  const rows = Array.from(plantMap.entries()).map(([plant, data]) => [
    plant,
    data.name,
    data.items,
    data.qty,
    data.value
  ]);

  return [headers, ...rows];
}

// Convert arbitrary 2D Google Sheets row array into MaintenanceCalendarEvent[]
export function parseSheetRowsToCalendarEvents(values: any[][]): MaintenanceCalendarEvent[] {
  if (!values || values.length < 1) return [];

  const headerRow = values[0];
  const colMap = mapHeaderIndices(headerRow);
  const rows = values.slice(1);
  const results: MaintenanceCalendarEvent[] = [];

  rows
    .filter((r) => r && r.length > 0 && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .forEach((row, idx) => {
      const getVal = (key: string, defaultIdx: number): string => {
        const i = colMap[key] !== undefined ? colMap[key] : defaultIdx;
        const v = row[i];
        return v !== undefined && v !== null ? String(v).trim() : '';
      };

      const title = getVal('title', 1) || getVal('description', 1) || 'Untitled Event';
      if (!title) return;

      results.push({
        id: getVal('id', 0) || `CAL-${idx + 1}`,
        title,
        deviceId: getVal('material', 2) || '',
        deviceDescription: getVal('materialDescription', 3) || '',
        plant: getVal('plant', 4) || '',
        date: getVal('date', 5) || new Date().toISOString().split('T')[0],
        time: getVal('time', 6) || '09:00 AM',
        type: (getVal('type', 7) as any) || 'Inspection',
        assignedEngineer: getVal('responsibleBody', 8) || 'Biomedical Engineer',
        status: (getVal('status', 9) as any) || 'Scheduled',
        priority: (getVal('priority', 10) as any) || 'Medium'
      });
    });

  return results;
}

// Convert arbitrary 2D Google Sheets row array into DeviceDocument[]
export function parseSheetRowsToDocuments(values: any[][]): DeviceDocument[] {
  if (!values || values.length < 1) return [];

  const headerRow = values[0];
  const colMap = mapHeaderIndices(headerRow);
  const rows = values.slice(1);
  const results: DeviceDocument[] = [];

  rows
    .filter((r) => r && r.length > 0 && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .forEach((row, idx) => {
      const getVal = (key: string, defaultIdx: number): string => {
        const i = colMap[key] !== undefined ? colMap[key] : defaultIdx;
        const v = row[i];
        return v !== undefined && v !== null ? String(v).trim() : '';
      };

      const title = getVal('title', 1) || 'Manual';
      results.push({
        id: getVal('id', 0) || `DOC-${idx + 1}`,
        title,
        deviceModel: getVal('description', 2) || '',
        type: (getVal('type', 3) as any) || 'Technical Specs',
        fileSize: getVal('qty', 4) ? `${getVal('qty', 4)} MB` : '0 MB',
        lastUpdated: getVal('date', 5) || 'Recent',
        driveLink: getVal('remark', 6) || 'https://drive.google.com',
        manufacturer: getVal('manufacturer', 7) || 'Unknown'
      });
    });

  return results;
}

// Convert arbitrary 2D Google Sheets row array into AlertNotification[]
export function parseSheetRowsToAlerts(values: any[][]): AlertNotification[] {
  if (!values || values.length < 1) return [];

  const headerRow = values[0];
  const colMap = mapHeaderIndices(headerRow);
  const rows = values.slice(1);
  const results: AlertNotification[] = [];

  rows
    .filter((r) => r && r.length > 0 && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .forEach((row, idx) => {
      const getVal = (key: string, defaultIdx: number): string => {
        const i = colMap[key] !== undefined ? colMap[key] : defaultIdx;
        const v = row[i];
        return v !== undefined && v !== null ? String(v).trim() : '';
      };

      results.push({
        id: getVal('id', 0) || `ALR-${idx + 1}`,
        recipient: getVal('responsibleBody', 1) || 'Directorate',
        subject: getVal('title', 2) || 'Inventory Alert',
        date: getVal('date', 3) || new Date().toISOString().split('T')[0],
        priority: (getVal('priority', 4) as any) || 'Info',
        status: (getVal('status', 5) as any) || 'Sent',
        category: (getVal('type', 6) as any) || 'Info',
        body: getVal('remark', 7) || ''
      });
    });

  return results;
}

export interface SheetDefinition {
  title: string;
  description: string;
  data: any[][];
}

// Generate all 9 standard EPSS inventory sheets
export function generateAll9Sheets(items: MedicalDeviceItem[], noBkdItems: NoBkdItem[] = []): SheetDefinition[] {
  // 1. Master Inventory
  const masterData = generateMasterInventorySheetData(items);

  // 2. No Breakdown Items
  const noBkdData = generateNoBkdSheetData(noBkdItems);

  // 3. Regional Hubs Summary
  const regionalData = generateRegionalHubSheetData(items);

  // 4. Defective & Breakdown Units
  const defectiveItems = items.filter(i => i.isNotFunctional);
  const defectiveData = generateMasterInventorySheetData(defectiveItems.length > 0 ? defectiveItems : items.slice(0, 50));

  // 5. Spare Parts & Accessories
  const spareItems = items.filter(i => i.needsSparePart || i.isAccessorySpare);
  const spareData = generateMasterInventorySheetData(spareItems.length > 0 ? spareItems : items.slice(0, 50));

  // 6. Non-Moving Stock
  const nonMovingItems = items.filter(i => i.isNonMoving);
  const nonMovingData = generateMasterInventorySheetData(nonMovingItems.length > 0 ? nonMovingItems : items.slice(0, 50));

  // 7. Installation & Commissioning
  const installHeaders = ['ID', 'Plant', 'Material', 'Description', 'Quantity', 'Installation Status', 'Delivery Status', 'Responsible Body'];
  const installRows = items.map(i => [
    i.id,
    i.plant,
    i.material,
    i.materialDescription,
    i.qty,
    i.installationStatus || 'Installed',
    i.deliveryStatus || 'Delivered & Dispatched',
    i.responsibleBody || 'Biomedical Engineering'
  ]);
  const installData = [installHeaders, ...installRows];

  // 8. Delivery & Dispatch Logistics
  const deliveryHeaders = ['ID', 'Plant', 'Warehouse', 'Material', 'Description', 'Quantity', 'Delivery Status', 'Timeframe', 'Next Action'];
  const deliveryRows = items.map(i => [
    i.id,
    i.plant,
    i.wh,
    i.material,
    i.materialDescription,
    i.qty,
    i.deliveryStatus || 'Delivered & Dispatched',
    i.timeFrame || 'Q3 2026',
    i.nextAction || 'Standard Delivery'
  ]);
  const deliveryData = [deliveryHeaders, ...deliveryRows];

  // 9. Central Hub Addis Ababa (HO01)
  const hoItems = items.filter(i => i.plant === 'HO01');
  const hoData = generateMasterInventorySheetData(hoItems.length > 0 ? hoItems : items);

  // 10. Regional Health Programs & RDF Distribution
  const programHeaders = ['Plant Code', 'Hub Name', 'Total Items', 'Total Units', 'Valuation (ETB)', 'Stock Allocation Category'];
  const programRows = Array.from(new Set(items.map(i => i.plant))).map((plant, idx) => {
    const plantItems = items.filter(i => i.plant === plant);
    const totalQty = plantItems.reduce((sum, cur) => sum + (cur.qty || 0), 0);
    const totalVal = plantItems.reduce((sum, cur) => sum + (cur.totalAmount || 0), 0);
    return [
      plant,
      plantItems[0]?.plantName || `Hub ${plant}`,
      plantItems.length,
      totalQty,
      totalVal,
      idx % 2 === 0 ? 'RDF (Revolving Drug Fund)' : 'Health Program'
    ];
  });
  const programData = [programHeaders, ...programRows];

  // 11. Action Plan & Interventions
  const actionHeaders = ['ID', 'Material Code', 'Description', 'Plant', 'Status', 'Next Action Required', 'Way of Intervention', 'Responsible Directorate', 'Timeline'];
  const actionRows = items.map(i => [
    i.id,
    i.material,
    i.materialDescription,
    i.plant,
    i.isNotFunctional ? 'Defective' : i.needsSparePart ? 'Needs Spare' : 'Operational',
    i.nextAction || 'Routine Scheduled Inspection',
    i.wayOfIntervention || 'Preventive Maintenance',
    i.responsibleBody || 'EPSS Directorate of Biomedical Engineering',
    i.timeFrame || 'Q3 2026'
  ]);
  const actionData = [actionHeaders, ...actionRows];

  return [
    { title: '1. Master Inventory SOH', description: `Complete ${items.length.toLocaleString()} stock on hand items with all columns`, data: masterData },
    { title: '2. No Breakdown Items', description: `${noBkdItems.length.toLocaleString()} central unallocated spare parts & equipment at HOM6`, data: noBkdData },
    { title: '3. Regional Hubs Summary', description: `${new Set(items.map(i => i.plant)).size} Regional Hubs inventory & financial distribution summary`, data: regionalData },
    { title: '4. Defective Equipment', description: 'Defective and non-functional biomedical devices requiring breakdown', data: defectiveData },
    { title: '5. Spare Parts & Accessories', description: 'Sensors, circuit boards, valves, and spare components', data: spareData },
    { title: '6. Non-Moving Stock', description: 'Slow-moving equipment flagged for redistribution or intervention', data: nonMovingData },
    { title: '7. Installation Status', description: 'Installation, commissioning, and site assessment status tracking', data: installData },
    { title: '8. Delivery Logistics', description: 'In-transit, customs clearance, and dispatched equipment logistics', data: deliveryData },
    { title: '9. Central Hub & Action Plan', description: 'Head Office Central Warehouse and corrective action timelines', data: hoData }
  ];
}



export const generateAll11Sheets = generateAll9Sheets;
