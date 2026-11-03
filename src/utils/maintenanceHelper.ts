import { MedicalDeviceItem } from '../types';

export interface MaintenanceLogEntry {
  id: string;
  date: string;
  timestamp: number;
  type: 'Preventive PPM' | 'Electrical Safety & Calibration' | 'Corrective Repair' | 'Pre-Commissioning Inspection' | 'Parts & Sensor Replacement' | 'Performance Verification';
  technician: string;
  department: string;
  status: 'Passed' | 'Calibrated' | 'Action Required' | 'Completed' | 'Pending Parts';
  details: string;
  protocolRef: string;
  operatingHours?: number;
  testValues?: {
    label: string;
    value: string;
    status: 'pass' | 'warning' | 'fail';
  }[];
}

export interface DeviceMaintenanceProfile {
  lastServicedDate: string;
  lastServicedDaysAgo: number;
  nextScheduledDate: string;
  nextScheduledDaysRemaining: number;
  scheduleStatus: 'On Schedule' | 'Upcoming Soon' | 'Overdue' | 'Immediate Action Needed';
  serviceIntervalMonths: number;
  serviceIntervalLabel: string;
  leadTechnician: string;
  biomedicalUnit: string;
  calibrationCertNo: string;
  uptimeRate: number;
  totalOperatingHours: number;
  electricalSafetyStandard: string;
  history: MaintenanceLogEntry[];
}

// In-memory / session override store for user-logged maintenance actions
const customMaintenanceLogs: Record<string, MaintenanceLogEntry[]> = {};

export function addCustomMaintenanceLog(itemId: string, entry: Omit<MaintenanceLogEntry, 'id' | 'timestamp'>): MaintenanceLogEntry {
  const fullEntry: MaintenanceLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };

  if (!customMaintenanceLogs[itemId]) {
    customMaintenanceLogs[itemId] = [];
  }
  customMaintenanceLogs[itemId].unshift(fullEntry);
  return fullEntry;
}

export function getCustomMaintenanceLogs(itemId: string): MaintenanceLogEntry[] {
  return customMaintenanceLogs[itemId] || [];
}

// Simple hash generator for deterministic realistic data per device
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const TECHNICIANS = [
  { name: 'Eng. Abebe Tadesse', dept: 'EPSS Central Biomedical Directorate' },
  { name: 'Dr. Dawit Girmay', dept: 'Clinical Engineering & Radiology Team' },
  { name: 'Eng. Hiwot Mengistu', dept: 'Regional Quality Assurance Lead' },
  { name: 'Eng. Yared Bekele', dept: 'ICU & Anesthesia Specialist Unit' },
  { name: 'Eng. Selamawit Alemu', dept: 'Laboratory Diagnostics Field Service' },
  { name: 'Eng. Michael Wolde', dept: 'Cold Chain & Sterilization Directorate' }
];

export function generateDeviceMaintenanceProfile(item: MedicalDeviceItem): DeviceMaintenanceProfile {
  const seed = hashString(`${item.id || ''}-${item.material || ''}-${item.batch || ''}-${item.plant || ''}`);
  const baseTime = new Date('2026-09-15T09:00:00Z').getTime(); // Reference app date context (September 2026)

  // Interval: 3, 6, or 12 months based on device category & condition
  const isHighRisk = /icu|ventilator|anesthesia|defibrillator|x-ray|ct|mri|autoclave|oxygen/i.test(item.materialDescription || '');
  const intervalMonths = isHighRisk ? 3 : (seed % 2 === 0 ? 6 : 12);
  const intervalLabel = intervalMonths === 3 ? 'Quarterly (90 Days)' : intervalMonths === 6 ? 'Semi-Annual (180 Days)' : 'Annual PPM (365 Days)';

  // Calculate Last Serviced Date
  // If defective, last service was recent when issue was detected, or overdue
  let daysAgo: number;
  if (item.isNotFunctional) {
    daysAgo = (seed % 14) + 2; // 2 to 16 days ago
  } else if (item.needsSparePart) {
    daysAgo = (seed % 28) + 5; // 5 to 33 days ago
  } else {
    daysAgo = (seed % 75) + 12; // 12 to 87 days ago
  }

  const lastServicedTimestamp = baseTime - daysAgo * 24 * 60 * 60 * 1000;
  const lastServicedDateObj = new Date(lastServicedTimestamp);
  const lastServicedDate = lastServicedDateObj.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Calculate Next Scheduled Service Date
  const nextScheduledTimestamp = lastServicedTimestamp + intervalMonths * 30 * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((nextScheduledTimestamp - baseTime) / (24 * 60 * 60 * 1000));
  const nextScheduledDateObj = new Date(nextScheduledTimestamp);
  const nextScheduledDate = nextScheduledDateObj.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let scheduleStatus: DeviceMaintenanceProfile['scheduleStatus'] = 'On Schedule';
  if (item.isNotFunctional || item.needsSparePart) {
    scheduleStatus = 'Immediate Action Needed';
  } else if (daysRemaining < 0) {
    scheduleStatus = 'Overdue';
  } else if (daysRemaining <= 30) {
    scheduleStatus = 'Upcoming Soon';
  }

  const techIndex = seed % TECHNICIANS.length;
  const tech = TECHNICIANS[techIndex];

  // Calculated uptime & operating hours
  let uptimeRate = 99.2 - (seed % 15) * 0.2;
  if (item.isNotFunctional) uptimeRate = 58.4 - (seed % 20);
  if (item.needsSparePart) uptimeRate = 74.2 - (seed % 15);
  uptimeRate = Math.max(40, Math.min(100, uptimeRate));

  const totalOperatingHours = 1200 + (seed % 6800);
  const certNum = `EPSS-CAL-2026-${item.plant || 'HO01'}-${(1000 + (seed % 9000))}`;

  // Default chronological history logs
  const history: MaintenanceLogEntry[] = [];

  // Entry 1 (Most recent)
  const log1Date = new Date(lastServicedTimestamp);
  let log1Type: MaintenanceLogEntry['type'] = 'Preventive PPM';
  let log1Status: MaintenanceLogEntry['status'] = 'Passed';
  let log1Notes = 'Complete physical inspection, optical sensor cleanout, power supply test, and baseline calibration performed. Passed all IEC 60601-1 safety parameters.';

  if (item.isNotFunctional) {
    log1Type = 'Corrective Repair';
    log1Status = 'Action Required';
    log1Notes = item.nextAction || 'Critical fault identified during operational inspection. Unit decommissioned pending circuit motherboard replacement.';
  } else if (item.needsSparePart) {
    log1Type = 'Preventive PPM';
    log1Status = 'Pending Parts';
    log1Notes = item.nextAction || 'PPM inspection completed. Transducer seal worn; spare part requisition dispatched to central EPSS logistics.';
  } else if (item.installationStatus === 'Under Commissioning') {
    log1Type = 'Pre-Commissioning Inspection';
    log1Status = 'Calibrated';
    log1Notes = 'Initial site commissioning & electrical grounding verification. Biomedical safety protocol validated with regional facility team.';
  }

  history.push({
    id: `log-seed-1-${item.id}`,
    date: log1Date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    timestamp: lastServicedTimestamp,
    type: log1Type,
    technician: tech.name,
    department: tech.dept,
    status: log1Status,
    details: log1Notes,
    protocolRef: `${certNum}-A`,
    operatingHours: totalOperatingHours,
    testValues: [
      { label: 'Ground Wire Resistance', value: `${(0.04 + (seed % 6) * 0.01).toFixed(2)} Ω`, status: 'pass' },
      { label: 'Chassis Leakage Current', value: `${(18 + (seed % 30)).toFixed(0)} µA`, status: 'pass' },
      { label: 'Calibration Tolerance', value: '±0.4%', status: item.isNotFunctional ? 'fail' : 'pass' }
    ]
  });

  // Entry 2 (Previous service ~90-180 days prior)
  const log2Timestamp = lastServicedTimestamp - (intervalMonths * 30 + (seed % 15)) * 24 * 60 * 60 * 1000;
  const log2Date = new Date(log2Timestamp);
  const tech2 = TECHNICIANS[(techIndex + 1) % TECHNICIANS.length];

  history.push({
    id: `log-seed-2-${item.id}`,
    date: log2Date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    timestamp: log2Timestamp,
    type: 'Electrical Safety & Calibration',
    technician: tech2.name,
    department: tech2.dept,
    status: 'Passed',
    details: 'Scheduled bi-annual calibration run with certified Fluke Biomedical electrical analyzer. Firmware diagnostics and self-test 100% OK.',
    protocolRef: `${certNum}-B`,
    operatingHours: Math.max(300, totalOperatingHours - (seed % 800 + 400)),
    testValues: [
      { label: 'Dielectric Insulation', value: '> 100 MΩ', status: 'pass' },
      { label: 'Output Accuracy', value: '99.8%', status: 'pass' }
    ]
  });

  // Entry 3 (Installation / Initial Receiving inspection)
  const log3Timestamp = log2Timestamp - 120 * 24 * 60 * 60 * 1000;
  const log3Date = new Date(log3Timestamp);
  const tech3 = TECHNICIANS[(techIndex + 2) % TECHNICIANS.length];

  history.push({
    id: `log-seed-3-${item.id}`,
    date: log3Date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    timestamp: log3Timestamp,
    type: 'Pre-Commissioning Inspection',
    technician: tech3.name,
    department: tech3.dept,
    status: 'Completed',
    details: `Warehouse receiving acceptance test at Hub ${item.plant || 'HO01'}. Packaging integrity verified, accessories inventoried, barcode assigned.`,
    protocolRef: `EPSS-RCV-${item.plant || 'HO01'}-${item.material}`,
    operatingHours: 0
  });

  // Combine with any user-added custom session logs
  const customLogs = getCustomMaintenanceLogs(item.id);
  const allHistory = [...customLogs, ...history];

  return {
    lastServicedDate,
    lastServicedDaysAgo: daysAgo,
    nextScheduledDate,
    nextScheduledDaysRemaining: daysRemaining,
    scheduleStatus,
    serviceIntervalMonths: intervalMonths,
    serviceIntervalLabel: intervalLabel,
    leadTechnician: tech.name,
    biomedicalUnit: tech.dept,
    calibrationCertNo: certNum,
    uptimeRate: Math.round(uptimeRate * 10) / 10,
    totalOperatingHours,
    electricalSafetyStandard: 'IEC 60601-1 / ISO 13485 Certified',
    history: allHistory
  };
}
