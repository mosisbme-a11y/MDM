import { DspWorkflowRecord } from '../types';
import { DEFAULT_STAGE_3_COLUMNS, DEFAULT_STAGE_3_ROWS } from '../components/RegionBreakdownMatrixTable';
import { DEFAULT_STAGE_4_COLUMNS, DEFAULT_STAGE_4_ROWS } from '../components/Stage4MohSubmittedMatrixTable';

// Canonicalize subStage strings to standard hierarchy keys
export const canonicalizeSubStage = (s?: string, stage?: string): string => {
  if (!s && !stage) return '1.1';
  const clean = (s || '').trim().toLowerCase();

  if (clean === '1.1' || clean.includes('1.1') || clean.includes('dsp-ho-1-1') || clean.includes('dsp-request') || clean.includes('request to moh') || clean.includes('epss to moh')) return '1.1';
  if (clean === '1.2' || clean.includes('1.2') || clean.includes('dsp-ho-1-2') || clean.includes('received from moh')) return '1.2';
  if (clean === '1.3.1' || clean.includes('1.3.1') || clean.includes('dsp-ho-1-3-1') || clean.includes('mapping') || clean.includes('map hf')) return '1.3.1';
  if (clean === '1.3.2' || clean.includes('1.3.2') || clean.includes('dsp-ho-1-3-2') || clean.includes('send dsp to hubs')) return '1.3.2';
  if (clean === '1.3.3' || clean.includes('1.3.3') || clean.includes('dsp-ho-1-3-3') || clean.includes('item aggregation')) return '1.3.3';
  if (clean === '1.3.4' || clean.includes('1.3.4') || clean.includes('dsp-ho-1-3-4') || clean.includes('order process')) return '1.3.4';

  if (clean === '2.1' || clean.includes('2.1') || clean.includes('dsp-moh-2-1') || clean.includes('received from epss')) return '2.1';
  if (clean === '2.2' || clean.includes('2.2') || clean.includes('dsp-moh-2-2') || clean.includes('breakdown request to rhb')) return '2.2';
  if (clean === '2.3' || clean.includes('2.3') || clean.includes('dsp-moh-2-3') || clean.includes('breakdown received from rhb')) return '2.3';
  if (clean === '2.4' || clean.includes('2.4') || clean.includes('dsp-moh-2-4') || clean.includes('aggregation by rhb')) return '2.4';
  if (clean === '2.5' || clean.includes('2.5') || clean.includes('dsp-moh-2-5') || clean.includes('submitted to epss')) return '2.5';

  if (clean === '3.1' || clean.includes('3.1') || clean.includes('dsp-rhb-3-1') || clean.includes('breakdown received from moh')) return '3.1';
  if (clean === '3.2' || clean.includes('3.2') || clean.includes('dsp-rhb-3-2') || clean.includes('submit breakdown to moh')) return '3.2';

  if (clean === '4.1' || clean.includes('4.1') || clean.includes('dsp-branches-4-1') || clean.includes('received dsp')) return '4.1';
  if (clean === '4.2' || clean.includes('4.2') || clean.includes('dsp-branches-4-2') || clean.includes('analysis and comparing')) return '4.2';

  if (stage === 'head-office-dsp' || stage === 'moh-to-epss') return '1.1';
  if (stage === 'moh-osp-management' || stage === 'moh-to-rhb') return '2.2';
  if (stage === 'rhb-breakdown-management' || stage === 'rhb-to-moh') return '3.2';
  if (stage === 'branches-dsp-management' || stage === 'epss-to-branch') return '4.1';

  return '1.1';
};

// Helper function to ensure all records follow the professional 4-tier DSP hierarchy structure
export const normalizeDspRecord = (r: DspWorkflowRecord): DspWorkflowRecord => {
  let stage = r.stage;
  let stageTitle = r.stageTitle;

  if (r.stage === 'moh-to-epss' || r.stage === 'head-office-dsp') {
    stage = 'head-office-dsp';
    stageTitle = 'Head Office DSP Management';
  } else if (r.stage === 'moh-to-rhb' || r.stage === 'moh-osp-management') {
    stage = 'moh-osp-management';
    stageTitle = 'MOH OSP Management';
  } else if (r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management') {
    stage = 'rhb-breakdown-management';
    stageTitle = 'RHB Breakdown Management';
  } else if (r.stage === 'epss-to-branch' || r.stage === 'branches-dsp-management') {
    stage = 'branches-dsp-management';
    stageTitle = 'Branches DSP Management';
  } else if (r.stage === 'moh-to-epss-ho') {
    stage = 'moh-osp-management';
    stageTitle = 'MOH OSP Management';
  } else if (r.stage === 'epss-ho-aggregation') {
    stage = 'head-office-dsp';
    stageTitle = 'Head Office DSP Management';
  }

  const subStage = canonicalizeSubStage(r.subStage, stage);

  return {
    ...r,
    stage,
    subStage,
    stageTitle
  };
};

// 1. HEAD OFFICE DSP MANAGEMENT RECORDS
export const DEFAULT_STAGE_1_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-epss-sample-01',
  dspRefNumber: 'EPSS/MD-DSP/2026/042',
  stage: 'head-office-dsp',
  subStage: '1.1',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'DSP Request to MOH: Priority MCH & Critical Care Equipment Allocation Request',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-24',
  approvedDate: '2026-10-25',
  actionTakenDate: '2026-10-25',
  actionTakenBy: 'Dr. Bethlehem (MOH PMD Directorate)',
  actionType: 'Proceed to Stage 2 Breakdown',
  actionLetterRef: 'MOH/PMD/ACT/2026/042',
  actionNotes: 'Endorsed for immediate regional breakdown allocation across RHBs.',
  turnaroundDays: 1,
  totalDevices: 6,
  totalQuantity: 120,
  totalValuationETB: 42500000,
  targetedRegions: ['Oromia', 'Amhara', 'Sidama'],
  targetedFacilitiesCount: 18,
  officialLetterRef: 'EPSS/LET/2026/782',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon', quantity: 3, plant: 'AA01 Central' },
    { material: '403-XRRD-0101', description: 'Bed - Patient, Fowler, Adult', quantity: 30, plant: 'AA01 Central' },
    { material: '403-XRRB-0101N', description: 'Bowel - With Stand, Stainless Steel.', quantity: 25, plant: 'HW01 Hawassa' },
    { material: '403-XRRD-0101-001', description: 'Cold box', quantity: 15, plant: 'BD01 Bahir Dar' },
    { material: '401-WICU-0101N', description: 'Couch - Delivery', quantity: 15, plant: 'MK01 Mekelle' },
    { material: '401-WICU-0101N', description: 'Couch - Examination', quantity: 15, plant: 'AA01 Central' }
  ],
  notes: 'Transmitted via Gmail & WhatsApp dispatch with full Excel inventory and official PDF request letter.'
};

export const DEFAULT_STAGE_1_DOSSIER_2: DspWorkflowRecord = {
  id: 'dsp-epss-sample-02',
  dspRefNumber: 'EPSS/MD-DSP/2026/048',
  stage: 'head-office-dsp',
  subStage: '1.2',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'EPSS Head Office',
  subject: 'DSP Received from MOH: Special Stock Diagnostic Imaging & ICU Ventilator Allocation Approval',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-25',
  approvedDate: '2026-10-26',
  actionTakenDate: '2026-10-26',
  actionTakenBy: 'Dr. Bethlehem (MOH PMD Directorate)',
  actionType: 'Endorsed & Approved',
  actionLetterRef: 'MOH/PMD/ACT/2026/048',
  actionNotes: 'Priority ICU and Imaging equipment approved for tertiary and regional referral centers.',
  turnaroundDays: 1,
  totalDevices: 3,
  totalQuantity: 75,
  totalValuationETB: 51300000,
  targetedRegions: ['Tigray', 'Somali', 'Afar'],
  targetedFacilitiesCount: 12,
  officialLetterRef: 'EPSS/LET/2026/804',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: 'MAT-100234', description: 'Ultrasound Machine, Doppler Color 4D with Convex & Linear Probes', quantity: 35, plant: 'AA01 Central' },
    { material: 'MAT-100235', description: 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive', quantity: 25, plant: 'HO01 Central' },
    { material: 'MAT-100236', description: 'Digital X-Ray System, Ceiling-Suspended High Frequency 50kW', quantity: 15, plant: 'HW01 Hawassa' }
  ],
  notes: 'High-priority life support and diagnostic imaging equipment allocation request.'
};

export const DEFAULT_STAGE_1_DOSSIER_3: DspWorkflowRecord = {
  id: 'dsp-epss-sample-03',
  dspRefNumber: 'EPSS/MD-DSP/2026/055',
  stage: 'head-office-dsp',
  subStage: '1.3.1',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'EPSS Distribution Hubs',
  subject: 'Map HF to Hubs: Laboratory Clinical Chemistry & Vital Signs Monitor Fleet Allocation',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-27',
  totalDevices: 2,
  totalQuantity: 80,
  totalValuationETB: 16800000,
  targetedRegions: ['South Ethiopia', 'Central Ethiopia', 'Benishangul-Gumuz'],
  targetedFacilitiesCount: 10,
  officialLetterRef: 'EPSS/LET/2026/831',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: 'MAT-100237', description: 'Automated Clinical Chemistry Analyzer, 400 Tests/Hour', quantity: 30, plant: 'BD01 Bahir Dar' },
    { material: 'MAT-100238', description: 'Multiparameter Patient Monitor 12.1 Inch (ECG, SpO2, NIBP, Temp, Resp)', quantity: 50, plant: 'MK01 Mekelle' }
  ],
  notes: 'Clinical chemistry analyzers and monitors mapped to regional health facilities and nearest hubs.'
};

export const DEFAULT_STAGE_1_DOSSIER_4: DspWorkflowRecord = {
  id: 'dsp-epss-sample-04',
  dspRefNumber: 'EPSS/MD-DSP/2026/061',
  stage: 'head-office-dsp',
  subStage: '1.3.2',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'EPSS Head Office',
  recipientOrg: 'EPSS Branch Hubs',
  subject: 'Send DSP to Hubs / Submit: Central Cold Chain & Surgical Fleet Dispatch Authorization',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-28',
  totalDevices: 4,
  totalQuantity: 95,
  totalValuationETB: 24500000,
  targetedRegions: ['Amhara', 'Oromia', 'Harari'],
  targetedFacilitiesCount: 14,
  officialLetterRef: 'EPSS/LET/2026/889',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: 'MAT-100240', description: 'Solar Direct Drive Vaccine Refrigerator 150L', quantity: 40, plant: 'AA01 Central' },
    { material: 'MAT-100241', description: 'Major Operating Table Hydraulic Multi-Position', quantity: 20, plant: 'AD01 Adama' },
    { material: 'MAT-100242', description: 'Surgical LED Shadowless Operating Light Twin Arm', quantity: 20, plant: 'BD01 Bahir Dar' },
    { material: 'MAT-100243', description: 'Steam Sterilizer Autoclave 200L Horizontal', quantity: 15, plant: 'HW01 Hawassa' }
  ],
  notes: 'Dispatched to branch hubs for release order confirmation.'
};

export const DEFAULT_STAGE_1_DOSSIER_5: DspWorkflowRecord = {
  id: 'dsp-epss-sample-05',
  dspRefNumber: 'EPSS/MD-DSP/2026/068',
  stage: 'head-office-dsp',
  subStage: '1.3.3',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'EPSS Head Office',
  recipientOrg: 'MOH PMD Directorate',
  subject: 'Item Aggregation: Consolidated Regional Equipment Requisition Summary',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-29',
  totalDevices: 5,
  totalQuantity: 150,
  totalValuationETB: 38000000,
  targetedRegions: ['National Coverage'],
  targetedFacilitiesCount: 25,
  officialLetterRef: 'EPSS/LET/2026/912',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: 'MAT-100250', description: 'Infant Incubator Intensive Care Unit with Humidity Control', quantity: 30, plant: 'AA01 Central' },
    { material: 'MAT-100251', description: 'Phototherapy Unit LED Overhead Stand', quantity: 50, plant: 'AD01 Adama' },
    { material: 'MAT-100252', description: 'Neonatal Resuscitation Warmer Table', quantity: 40, plant: 'HW01 Hawassa' },
    { material: 'MAT-100253', description: 'Suction Machine Electric Dual Bottle 40L/Min', quantity: 30, plant: 'BD01 Bahir Dar' }
  ],
  notes: 'Item-level aggregation completed across all regional demand forecasts.'
};

export const DEFAULT_STAGE_1_DOSSIER_6: DspWorkflowRecord = {
  id: 'dsp-epss-sample-06',
  dspRefNumber: 'EPSS/MD-DSP/2026/072',
  stage: 'head-office-dsp',
  subStage: '1.3.4',
  stageTitle: 'Head Office DSP Management',
  senderOrg: 'EPSS Head Office',
  recipientOrg: 'Procurement & Logistics Directorate',
  subject: 'Order Process: Final Approved Equipment Allocation Purchase Order Processing',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-30',
  totalDevices: 3,
  totalQuantity: 110,
  totalValuationETB: 29000000,
  targetedRegions: ['National Coverage'],
  targetedFacilitiesCount: 20,
  officialLetterRef: 'EPSS/LET/2026/945',
  signatory: 'Mosisa (Authorized User)',
  signatoryRole: 'Directorate Technical Lead',
  itemsIncluded: [
    { material: 'MAT-100260', description: 'Haemodialysis Machine Triple Pump System', quantity: 20, plant: 'AA01 Central' },
    { material: 'MAT-100261', description: 'Water Treatment Reverse Osmosis System for Dialysis', quantity: 10, plant: 'AA01 Central' },
    { material: 'MAT-100262', description: 'Dialysate Re-use System Automated', quantity: 80, plant: 'AD01 Adama' }
  ],
  notes: 'Order processing initiated with supplier contract fulfillment logs.'
};

// 2. MOH OSP MANAGEMENT RECORDS
export const DEFAULT_STAGE_2_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-brk-sample-01',
  dspRefNumber: 'MOH/PMD-BRK/2026/101',
  stage: 'moh-osp-management',
  subStage: '2.1',
  stageTitle: 'MOH OSP Management',
  senderOrg: 'EPSS Head Office',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'DSP Received from EPSS: Official Equipment Quota Transmission - Batch 01',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-26',
  totalDevices: 6,
  totalQuantity: 60,
  totalValuationETB: 15000000,
  targetedRegions: ['Oromia', 'Amhara', 'Sidama'],
  targetedFacilitiesCount: 18,
  officialLetterRef: 'MOH/LET/2026/894',
  signatory: 'Dr. Dereje (MOH State Minister)',
  signatoryRole: 'State Minister of Health',
  itemsIncluded: [
    { material: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon', quantity: 10, plant: 'AA01 Central' },
    { material: '403-XRRD-0101', description: 'Bed - Patient, Fowler, Adult', quantity: 15, plant: 'AA01 Central' },
    { material: '403-XRRB-0101N', description: 'Bowel - With Stand, Stainless Steel.', quantity: 15, plant: 'HW01 Hawassa' },
    { material: '403-XRRD-0101-001', description: 'Cold box', quantity: 10, plant: 'BD01 Bahir Dar' },
    { material: '401-WICU-0101N', description: 'Couch - Delivery', quantity: 5, plant: 'MK01 Mekelle' },
    { material: '401-WICU-0101N', description: 'Couch - Examination', quantity: 5, plant: 'AA01 Central' }
  ],
  notes: 'Regional breakdown allocation quota received from EPSS.',
  facilityMatrixData: {
    date: '2026-10-26',
    region: 'Oromia',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS
  }
};

export const DEFAULT_STAGE_2_DOSSIER_2: DspWorkflowRecord = {
  id: 'dsp-brk-sample-02',
  dspRefNumber: 'MOH/PMD-BRK/2026/102',
  stage: 'moh-osp-management',
  subStage: '2.2',
  stageTitle: 'MOH OSP Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Tigray, Somali, Afar Regional Health Bureaus',
  subject: 'DSP Breakdown Request to RHB: Diagnostic Imaging & ICU Ventilators Allocation Quota',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-27',
  totalDevices: 3,
  totalQuantity: 45,
  totalValuationETB: 32500000,
  targetedRegions: ['Tigray', 'Somali', 'Afar'],
  targetedFacilitiesCount: 12,
  officialLetterRef: 'MOH/LET/2026/899',
  signatory: 'Dr. Bethlehem (MOH PMD Director)',
  signatoryRole: 'Director, Pharmaceuticals & Medical Devices',
  itemsIncluded: [
    { material: 'MAT-100234', description: 'Ultrasound Machine, Doppler Color 4D with Convex & Linear Probes', quantity: 20, plant: 'AA01 Central' },
    { material: 'MAT-100235', description: 'ICU Mechanical Ventilator, Adult/Pediatric Invasive & Non-Invasive', quantity: 15, plant: 'HO01 Central' },
    { material: 'MAT-100236', description: 'Digital X-Ray System, Ceiling-Suspended High Frequency 50kW', quantity: 10, plant: 'HW01 Hawassa' }
  ],
  notes: 'Regional breakdown allocation quota transmitted via Email & WhatsApp.',
  facilityMatrixData: {
    date: '2026-10-27',
    region: 'Tigray',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS.slice(0, 3)
  }
};

export const DEFAULT_STAGE_2_DOSSIER_3: DspWorkflowRecord = {
  id: 'dsp-brk-sample-03',
  dspRefNumber: 'MOH/PMD-BRK/2026/103',
  stage: 'moh-osp-management',
  subStage: '2.3',
  stageTitle: 'MOH OSP Management',
  senderOrg: 'South Ethiopia, Central Ethiopia Regional Health Bureaus',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Breakdown Received from RHB: Primary Hospital MCH & Laboratory Breakdown Matrix',
  status: 'Under Review',
  dateSubmitted: '2026-10-27',
  totalDevices: 2,
  totalQuantity: 40,
  totalValuationETB: 12000000,
  targetedRegions: ['South Ethiopia', 'Central Ethiopia', 'Benishangul-Gumuz'],
  targetedFacilitiesCount: 10,
  officialLetterRef: 'MOH/LET/2026/905',
  signatory: 'Dr. Dereje (MOH State Minister)',
  signatoryRole: 'State Minister of Health',
  itemsIncluded: [
    { material: 'MAT-100237', description: 'Automated Clinical Chemistry Analyzer, 400 Tests/Hour', quantity: 15, plant: 'BD01 Bahir Dar' },
    { material: 'MAT-100238', description: 'Multiparameter Patient Monitor 12.1 Inch', quantity: 25, plant: 'MK01 Mekelle' }
  ],
  notes: 'Regional breakdown matrix received from RHB.',
  facilityMatrixData: {
    date: '2026-10-27',
    region: 'South Ethiopia',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS.slice(0, 2)
  }
};

export const DEFAULT_STAGE_2_DOSSIER_4: DspWorkflowRecord = {
  id: 'dsp-brk-sample-04',
  dspRefNumber: 'MOH/PMD-BRK/2026/108',
  stage: 'moh-osp-management',
  subStage: '2.4',
  stageTitle: 'MOH OSP Management',
  senderOrg: 'Regional Health Bureaus',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Breakdown Aggregation by RHB: Multi-Regional Consolidated Breakdown Summary',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-28',
  totalDevices: 4,
  totalQuantity: 85,
  totalValuationETB: 21000000,
  targetedRegions: ['Oromia', 'Amhara', 'Sidama', 'Tigray'],
  targetedFacilitiesCount: 22,
  officialLetterRef: 'MOH/LET/2026/928',
  signatory: 'Dr. Bethlehem (MOH PMD Director)',
  signatoryRole: 'Director, Pharmaceuticals & Medical Devices',
  itemsIncluded: [
    { material: 'MAT-100270', description: 'Electrocardiograph 12-Channel Color Screen Printer', quantity: 35, plant: 'AA01 Central' },
    { material: 'MAT-100271', description: 'Defibrillator Monitor Bi-phasic with External Pacemaker', quantity: 25, plant: 'AD01 Adama' },
    { material: 'MAT-100272', description: 'Pulse Oximeter Fingertip / Handheld Clinical', quantity: 25, plant: 'HW01 Hawassa' }
  ],
  notes: 'Breakdown aggregation validated across 4 major regions.'
};

export const DEFAULT_STAGE_2_DOSSIER_5: DspWorkflowRecord = {
  id: 'dsp-brk-sample-05',
  dspRefNumber: 'MOH/PMD-BRK/2026/115',
  stage: 'moh-osp-management',
  subStage: '2.5',
  stageTitle: 'MOH OSP Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'EPSS Head Office',
  subject: 'DSP Agr. DSP Submitted to EPSS: Final Approved National Distribution Matrix',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-29',
  approvedDate: '2026-10-29',
  totalDevices: DEFAULT_STAGE_4_COLUMNS.length,
  totalQuantity: 110,
  totalValuationETB: 28500000,
  targetedRegions: ['National Coverage'],
  targetedFacilitiesCount: 30,
  officialLetterRef: 'MOH/PMD/LET/2026/1150',
  signatory: 'Dr. Dereje (MOH State Minister)',
  signatoryRole: 'State Minister of Health',
  itemsIncluded: DEFAULT_STAGE_4_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: 18,
    plant: 'Central Hub'
  })),
  notes: 'Final aggregated national distribution matrix submitted from MOH to EPSS Head Office.'
};

// 3. RHB BREAKDOWN MANAGEMENT RECORDS
export const DEFAULT_STAGE_3_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-reg-sample-01',
  dspRefNumber: 'RHB/OR-DSP/2026/088',
  stage: 'rhb-breakdown-management',
  subStage: '3.1',
  stageTitle: 'RHB Breakdown Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Oromia Regional Health Bureau',
  subject: 'Breakdown Received from MOH: Oromia Health Facility Quota Allocation Request',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-27',
  totalDevices: 6,
  totalQuantity: 60,
  totalValuationETB: 15000000,
  targetedRegions: ['Oromia'],
  targetedFacilitiesCount: 5,
  officialLetterRef: 'ORHB/LET/9102',
  signatory: 'Dr. Mengistu (Regional Health Bureau Head)',
  signatoryRole: 'Head of Regional Health Bureau',
  itemsIncluded: DEFAULT_STAGE_3_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: DEFAULT_STAGE_3_ROWS.reduce((sum, r) => sum + (r.quantities[c.id] || 0), 0),
    plant: 'Oromia Hub'
  })),
  notes: 'Breakdown request received from MOH for Oromia health facilities.',
  facilityMatrixData: {
    date: '2026-10-27',
    region: 'Oromia',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS
  }
};

export const DEFAULT_STAGE_3_DOSSIER_2: DspWorkflowRecord = {
  id: 'dsp-reg-sample-02',
  dspRefNumber: 'RHB/AM-DSP/2026/092',
  stage: 'rhb-breakdown-management',
  subStage: '3.2',
  stageTitle: 'RHB Breakdown Management',
  senderOrg: 'Amhara Regional Health Bureau',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Submit Breakdown to MOH: Amhara Regional Health Facility Allocation Matrix',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-27',
  totalDevices: 6,
  totalQuantity: 55,
  totalValuationETB: 14200000,
  targetedRegions: ['Amhara'],
  targetedFacilitiesCount: 6,
  officialLetterRef: 'AMHB/LET/8821',
  signatory: 'Dr. Abdulkerim (Amhara RHB Head)',
  signatoryRole: 'Head of Regional Health Bureau',
  itemsIncluded: DEFAULT_STAGE_3_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: 9,
    plant: 'Bahir Dar Hub'
  })),
  notes: 'Amhara Regional Health Bureau facility breakdown submitted per MOH quota.'
};

export const DEFAULT_STAGE_3_DOSSIER_3: DspWorkflowRecord = {
  id: 'dsp-reg-sample-03',
  dspRefNumber: 'RHB/SD-DSP/2026/045',
  stage: 'rhb-breakdown-management',
  subStage: '3.1',
  stageTitle: 'RHB Breakdown Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Sidama Regional Health Bureau',
  subject: 'Breakdown Received from MOH: Sidama Regional Hospital Equipment Quota',
  status: 'Under Review',
  dateSubmitted: '2026-10-27',
  totalDevices: 6,
  totalQuantity: 42,
  totalValuationETB: 11000000,
  targetedRegions: ['Sidama'],
  targetedFacilitiesCount: 4,
  officialLetterRef: 'SRHB/LET/4412',
  signatory: 'Dr. Mateos (Sidama RHB Head)',
  signatoryRole: 'Head of Regional Health Bureau',
  itemsIncluded: DEFAULT_STAGE_3_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: 7,
    plant: 'Hawassa Hub'
  })),
  notes: 'Sidama Regional Health Bureau facility breakdown received from MOH.'
};

// 4. BRANCHES DSP MANAGEMENT RECORDS
export const DEFAULT_STAGE_4_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-moh-epss-sample-01',
  dspRefNumber: 'MOH/PMD-DSP/2026/099',
  stage: 'branches-dsp-management',
  subStage: '4.1',
  stageTitle: 'Branches DSP Management',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Ethiopian Pharmaceuticals Supply Service (EPSS Branch Hubs)',
  subject: 'Received DSP: Official Approved National Health Facility Allocation Breakdown',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-28',
  approvedDate: '2026-10-28',
  totalDevices: DEFAULT_STAGE_4_COLUMNS.length,
  totalQuantity: DEFAULT_STAGE_4_ROWS.reduce((sum, r) => {
    return sum + DEFAULT_STAGE_4_COLUMNS.reduce((csum, c) => csum + (r.quantities[c.id] || 0), 0);
  }, 0),
  totalValuationETB: 18500000,
  targetedRegions: ['Oromia'],
  targetedFacilitiesCount: DEFAULT_STAGE_4_ROWS.length,
  officialLetterRef: 'MOH/PMD/LET/2026/1102',
  signatory: 'Dr. Dereje (MOH State Minister)',
  signatoryRole: 'State Minister of Health',
  itemsIncluded: DEFAULT_STAGE_4_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: DEFAULT_STAGE_4_ROWS.reduce((sum, r) => sum + (r.quantities[c.id] || 0), 0),
    plant: 'Central Hub'
  })),
  notes: 'Official MOH approved health facility equipment breakdown matrix received by EPSS Branch Hubs.',
  stage4MatrixData: {
    date: '2026-10-28',
    region: 'Oromia',
    columns: DEFAULT_STAGE_4_COLUMNS,
    rows: DEFAULT_STAGE_4_ROWS
  }
};

export const DEFAULT_STAGE_4_DOSSIER_2: DspWorkflowRecord = {
  id: 'dsp-epss-ho-sample-01',
  dspRefNumber: 'EPSS/HO-AGG/2026/012',
  stage: 'branches-dsp-management',
  subStage: '4.2',
  stageTitle: 'Branches DSP Management',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'EPSS Branch Hubs (Adama, Hawassa, Bahir Dar, Addis Ababa)',
  subject: 'Analysis and Comparing with DSP: Consolidated EPSS Branch Dispatch & Stock Verification',
  status: 'Endorsed & Approved',
  dateSubmitted: '2026-10-29',
  approvedDate: '2026-10-29',
  actionTakenDate: '2026-10-29',
  actionTakenBy: 'Dr. Solomon Abebe (EPSS Director General)',
  actionType: 'Endorsed & Approved',
  actionLetterRef: 'EPSS/HO/LET/2026/1455',
  actionNotes: 'Approved for final branch dispatch packing and transport route assignment.',
  turnaroundDays: 1,
  totalDevices: 6,
  totalQuantity: 60,
  totalValuationETB: 18500000,
  targetedRegions: ['Oromia', 'Addis Ababa', 'Sidama', 'Amhara'],
  targetedFacilitiesCount: 10,
  officialLetterRef: 'EPSS/HO/LET/2026/1455',
  signatory: 'Dr. Solomon Abebe (Director General)',
  signatoryRole: 'Director General, EPSS',
  itemsIncluded: DEFAULT_STAGE_4_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: 10,
    plant: 'Central EPSS'
  })),
  notes: 'Aggregated and analyzed versus EPSS SOH stock ledgers.',
  stage4MatrixData: {
    date: '2026-10-29',
    region: 'Oromia & National',
    columns: DEFAULT_STAGE_4_COLUMNS,
    rows: DEFAULT_STAGE_4_ROWS
  },
  hubAggregationData: {
    dossierId: 'dsp-epss-ho-sample-01',
    dspRefNumber: 'EPSS/HO-AGG/2026/012',
    generatedDate: '2026-10-29',
    status: 'Mapped & Ready',
    columns: DEFAULT_STAGE_4_COLUMNS,
    allocations: [
      {
        id: 's5-alloc-1',
        healthFacility: 'Abeshige Health Center',
        region: 'Oromia',
        zone: 'Addis ketema',
        woreda: '01',
        packages: 'MCH',
        hubCode: 'AD01',
        hubName: 'Adama Hub',
        masterCustomerCode: '1000845',
        masterFacilityName: 'Adama Health Center Catchment',
        matchMethod: 'zone-region-fallback',
        matchConfidence: 85,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-2',
        healthFacility: 'Addis Hiwot Health Center',
        region: 'Oromia',
        zone: 'Addis ketema',
        woreda: '01',
        packages: 'MCH',
        hubCode: 'AD01',
        hubName: 'Adama Hub',
        masterCustomerCode: '1000846',
        masterFacilityName: 'Addis Hiwot Health Center',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      }
    ]
  }
};

export const DEFAULT_STAGE_4_DOSSIER_3: DspWorkflowRecord = {
  id: 'dsp-epss-ho-sample-02',
  dspRefNumber: 'EPSS/HO-AGG/2026/015',
  stage: 'branches-dsp-management',
  subStage: '4.1',
  stageTitle: 'Branches DSP Management',
  senderOrg: 'EPSS Head Office',
  recipientOrg: 'EPSS Branch Hubs (Hawassa, Bahir Dar, Mekelle)',
  subject: 'Received DSP: Multi-Regional Secondary Referral Hospital Fleet Hub Mapping',
  status: 'Submitted & Pending',
  dateSubmitted: '2026-10-30',
  totalDevices: 6,
  totalQuantity: 48,
  totalValuationETB: 14200000,
  targetedRegions: ['Sidama', 'Amhara', 'Tigray'],
  targetedFacilitiesCount: 4,
  officialLetterRef: 'EPSS/HO/LET/2026/1490',
  signatory: 'Dr. Solomon Abebe (Director General)',
  signatoryRole: 'Director General, EPSS',
  itemsIncluded: DEFAULT_STAGE_4_COLUMNS.map(c => ({
    material: c.code,
    description: c.name,
    quantity: 8,
    plant: 'Central EPSS'
  })),
  notes: 'Regional hospital allocations mapped to Hawassa, Bahir Dar, and Mekelle EPSS distribution branches.'
};

export const DEFAULT_STAGE_1_DOSSIERS = [
  DEFAULT_STAGE_1_DOSSIER_1,
  DEFAULT_STAGE_1_DOSSIER_2,
  DEFAULT_STAGE_1_DOSSIER_3,
  DEFAULT_STAGE_1_DOSSIER_4,
  DEFAULT_STAGE_1_DOSSIER_5,
  DEFAULT_STAGE_1_DOSSIER_6
];

export const DEFAULT_STAGE_2_DOSSIERS = [
  DEFAULT_STAGE_2_DOSSIER_1,
  DEFAULT_STAGE_2_DOSSIER_2,
  DEFAULT_STAGE_2_DOSSIER_3,
  DEFAULT_STAGE_2_DOSSIER_4,
  DEFAULT_STAGE_2_DOSSIER_5
];

export const DEFAULT_STAGE_3_DOSSIERS = [
  DEFAULT_STAGE_3_DOSSIER_1,
  DEFAULT_STAGE_3_DOSSIER_2,
  DEFAULT_STAGE_3_DOSSIER_3
];

export const DEFAULT_STAGE_4_DOSSIERS = [
  DEFAULT_STAGE_4_DOSSIER_1,
  DEFAULT_STAGE_4_DOSSIER_2,
  DEFAULT_STAGE_4_DOSSIER_3
];

export const INITIAL_DSP_RECORDS: DspWorkflowRecord[] = [
  ...DEFAULT_STAGE_1_DOSSIERS,
  ...DEFAULT_STAGE_2_DOSSIERS,
  ...DEFAULT_STAGE_3_DOSSIERS,
  ...DEFAULT_STAGE_4_DOSSIERS
].map(normalizeDspRecord);
