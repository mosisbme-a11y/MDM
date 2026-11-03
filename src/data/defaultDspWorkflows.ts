import { DspWorkflowRecord } from '../types';
import { DEFAULT_STAGE_3_COLUMNS, DEFAULT_STAGE_3_ROWS } from '../components/RegionBreakdownMatrixTable';
import { DEFAULT_STAGE_4_COLUMNS, DEFAULT_STAGE_4_ROWS } from '../components/Stage4MohSubmittedMatrixTable';

export const DEFAULT_STAGE_1_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-epss-sample-01',
  dspRefNumber: 'EPSS/MD-DSP/2026/042',
  stage: 'moh-to-epss',
  stageTitle: '1. DSP Request EPSS to MOH',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'National Priority Medical Equipment Allocation Request - Batch 01 (MCH & Critical Care Fleet)',
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
    { material: '403-XRRD-0101', description: 'Anesthesia machine - with Patient mon', quantity: 20, plant: 'AA01 Central' },
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
  stage: 'moh-to-epss',
  stageTitle: '1. DSP Request EPSS to MOH',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Special Stock Type Q Diagnostic Imaging & ICU Ventilator Allocation Request',
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
  stage: 'moh-to-epss',
  stageTitle: '1. DSP Request EPSS to MOH',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Laboratory Clinical Chemistry & Vital Signs Monitor Fleet Allocation',
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
  notes: 'Clinical chemistry analyzers and monitors for secondary regional laboratories.'
};

export const DEFAULT_STAGE_2_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-brk-sample-01',
  dspRefNumber: 'MOH/PMD-BRK/2026/101',
  stage: 'moh-to-rhb',
  stageTitle: '2. Breakdown Request MOH to Region',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Oromia, Amhara, Sidama Regional Health Bureaus',
  subject: 'Official Regional Medical Equipment Breakdown Request - Batch 01 (Based on EPSS/MD-DSP/2026/042)',
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
  notes: 'Regional breakdown allocation quota transmitted via Email & WhatsApp based on EPSS Medical Device Request EPSS/MD-DSP/2026/042.',
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
  stage: 'moh-to-rhb',
  stageTitle: '2. Breakdown Request MOH to Region',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Tigray, Somali, Afar Regional Health Bureaus',
  subject: 'Regional Breakdown Allocation Request: Diagnostic Imaging & ICU Ventilators (Based on EPSS/MD-DSP/2026/048)',
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
  notes: 'Regional breakdown allocation quota transmitted via Email & WhatsApp based on EPSS Medical Device Request EPSS/MD-DSP/2026/048.',
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
  stage: 'moh-to-rhb',
  stageTitle: '2. Breakdown Request MOH to Region',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'South Ethiopia, Central Ethiopia, Benishangul-Gumuz',
  subject: 'Primary Hospital MCH & Laboratory Fleet Breakdown Quota Request (Based on EPSS/MD-DSP/2026/055)',
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
  notes: 'Regional breakdown allocation quota transmitted via Email & WhatsApp based on EPSS Medical Device Request EPSS/MD-DSP/2026/055.',
  facilityMatrixData: {
    date: '2026-10-27',
    region: 'South Ethiopia',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS.slice(0, 2)
  }
};

export const DEFAULT_STAGE_3_DOSSIER: DspWorkflowRecord = {
  id: 'dsp-reg-sample-01',
  dspRefNumber: 'RHB/OR-DSP/2026/088',
  stage: 'rhb-to-moh',
  stageTitle: '3. DSP Submitted Region to MOH',
  senderOrg: 'Oromia Regional Health Bureau',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Official Regional Health Facility Equipment Allocation Breakdown - Oromia Region',
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
  notes: 'Regional facility breakdown matrix submitted as per MOH distribution quota.',
  facilityMatrixData: {
    date: '2026-10-27',
    region: 'Oromia',
    columns: DEFAULT_STAGE_3_COLUMNS,
    rows: DEFAULT_STAGE_3_ROWS
  }
};

export const DEFAULT_STAGE_3_DOSSIER_AMHARA: DspWorkflowRecord = {
  id: 'dsp-reg-sample-02',
  dspRefNumber: 'RHB/AM-DSP/2026/092',
  stage: 'rhb-to-moh',
  stageTitle: '3. DSP Submitted Region to MOH',
  senderOrg: 'Amhara Regional Health Bureau',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Official Regional Health Facility Equipment Allocation Breakdown - Amhara Region',
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

export const DEFAULT_STAGE_3_DOSSIER_SIDAMA: DspWorkflowRecord = {
  id: 'dsp-reg-sample-03',
  dspRefNumber: 'RHB/SD-DSP/2026/045',
  stage: 'rhb-to-moh',
  stageTitle: '3. DSP Submitted Region to MOH',
  senderOrg: 'Sidama Regional Health Bureau',
  recipientOrg: 'Ministry of Health (PMD Directorate)',
  subject: 'Official Regional Health Facility Equipment Allocation Breakdown - Sidama Region',
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
  notes: 'Sidama Regional Health Bureau facility breakdown submitted per MOH quota.'
};

export const DEFAULT_STAGE_1_DOSSIERS = [
  DEFAULT_STAGE_1_DOSSIER_1,
  DEFAULT_STAGE_1_DOSSIER_2,
  DEFAULT_STAGE_1_DOSSIER_3
];

export const DEFAULT_STAGE_2_DOSSIERS = [
  DEFAULT_STAGE_2_DOSSIER_1,
  DEFAULT_STAGE_2_DOSSIER_2,
  DEFAULT_STAGE_2_DOSSIER_3
];

export const DEFAULT_STAGE_3_DOSSIERS = [
  DEFAULT_STAGE_3_DOSSIER,
  DEFAULT_STAGE_3_DOSSIER_AMHARA,
  DEFAULT_STAGE_3_DOSSIER_SIDAMA
];

export const DEFAULT_STAGE_4_DOSSIER: DspWorkflowRecord = {
  id: 'dsp-moh-epss-sample-01',
  dspRefNumber: 'MOH/PMD-DSP/2026/099',
  stage: 'moh-to-epss-ho',
  stageTitle: '4. DSP Submitted MOH to EPSS',
  senderOrg: 'Ministry of Health (PMD Directorate)',
  recipientOrg: 'Ethiopian Pharmaceuticals Supply Service (EPSS)',
  subject: 'Official Approved National Health Facility Equipment Allocation Breakdown (MOH to EPSS)',
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
  notes: 'Official MOH approved health facility equipment breakdown matrix submitted to EPSS.',
  stage4MatrixData: {
    date: '2026-10-28',
    region: 'Oromia',
    columns: DEFAULT_STAGE_4_COLUMNS,
    rows: DEFAULT_STAGE_4_ROWS
  }
};

export const DEFAULT_STAGE_4_DOSSIERS = [
  DEFAULT_STAGE_4_DOSSIER
];

export const DEFAULT_STAGE_5_DOSSIER_1: DspWorkflowRecord = {
  id: 'dsp-epss-ho-sample-01',
  dspRefNumber: 'EPSS/HO-AGG/2026/012',
  stage: 'epss-ho-aggregation',
  stageTitle: '5. DSP Aggregation (EPSS HO)',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'EPSS Branch Hubs (Adama, Hawassa, Bahir Dar, Addis Ababa)',
  subject: 'Consolidated National Health Facility Equipment Allocation & EPSS Hub Dispatch Mapping',
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
  notes: 'Aggregated from MOH Approved Dossier MOH/PMD-DSP/2026/099. Facilities matched to EPSS distribution hubs based on HF Master data.',
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
      },
      {
        id: 's5-alloc-3',
        healthFacility: 'Adama Health Center',
        region: 'Oromia',
        zone: 'Addis ketema',
        woreda: '02',
        packages: 'MCH',
        hubCode: 'AD01',
        hubName: 'Adama Hub',
        masterCustomerCode: '1000845',
        masterFacilityName: 'Adama General Hospital & Medical College',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-4',
        healthFacility: 'Bole 17 Health Center',
        region: 'Addis Ababa',
        zone: 'kirkose',
        woreda: '03',
        packages: 'MCH',
        hubCode: 'AA01',
        hubName: 'Addis Ababa (Hub 1)',
        masterCustomerCode: '1000214',
        masterFacilityName: 'Bole 17 Health Center',
        matchMethod: 'zone-region-fallback',
        matchConfidence: 90,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-5',
        healthFacility: 'Abala Primary Hospital',
        region: 'Oromia',
        zone: 'kirkose',
        woreda: '03',
        packages: 'MCH',
        hubCode: 'AD01',
        hubName: 'Adama Hub',
        masterCustomerCode: '1000912',
        masterFacilityName: 'Bishoftu / Adama Axis Clinic',
        matchMethod: 'fuzzy-master',
        matchConfidence: 82,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-6',
        healthFacility: 'Felege Hiwot Comprehensive Specialized Hospital',
        region: 'Amhara',
        zone: 'West Gojjam',
        woreda: 'Bahir Dar City',
        packages: 'MCH',
        hubCode: 'BD01',
        hubName: 'Bahir Dar Hub',
        masterCustomerCode: '1001120',
        masterFacilityName: 'Felege Hiwot Comprehensive Specialized Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-7',
        healthFacility: 'University of Gondar Comprehensive Hospital',
        region: 'Amhara',
        zone: 'Central Gondar',
        woreda: 'Gondar City',
        packages: 'MCH',
        hubCode: 'GD01',
        hubName: 'Gondar Hub',
        masterCustomerCode: '1001340',
        masterFacilityName: 'University of Gondar Comprehensive Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-8',
        healthFacility: 'Hawassa University Comprehensive Hospital',
        region: 'Sidama',
        zone: 'Hawassa City',
        woreda: 'Meneharia',
        packages: 'MCH',
        hubCode: 'HW01',
        hubName: 'Hawassa Hub',
        masterCustomerCode: '1001780',
        masterFacilityName: 'Hawassa University Comprehensive Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-9',
        healthFacility: 'Ayder Comprehensive Specialized Hospital',
        region: 'Tigray',
        zone: 'South Eastern',
        woreda: 'Mekelle City',
        packages: 'MCH',
        hubCode: 'MK01',
        hubName: 'Mekelle Hub',
        masterCustomerCode: '1001560',
        masterFacilityName: 'Ayder Comprehensive Specialized Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-10',
        healthFacility: 'Tikur Anbessa Specialized Hospital',
        region: 'Addis Ababa',
        zone: 'Lideta',
        woreda: 'W-08',
        packages: 'MCH',
        hubCode: 'AA01',
        hubName: 'Addis Ababa (Hub 1)',
        masterCustomerCode: '1000214',
        masterFacilityName: 'Tikur Anbessa Specialized Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-11',
        healthFacility: 'Karamara General Hospital',
        region: 'Somali',
        zone: 'Fafan',
        woreda: 'Jijiga Woreda',
        packages: 'MCH',
        hubCode: 'JJ01',
        hubName: 'Jijiga Hub',
        masterCustomerCode: '1001920',
        masterFacilityName: 'Karamara General Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 2, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      }
    ]
  }
};

export const DEFAULT_STAGE_5_DOSSIER_2: DspWorkflowRecord = {
  id: 'dsp-epss-ho-sample-02',
  dspRefNumber: 'EPSS/HO-AGG/2026/015',
  stage: 'epss-ho-aggregation',
  stageTitle: '5. DSP Aggregation (EPSS HO)',
  senderOrg: 'EPSS Head Office (Medical Equipment Directorate)',
  recipientOrg: 'EPSS Branch Hubs (Hawassa, Bahir Dar, Mekelle)',
  subject: 'Multi-Regional Secondary Referral Hospital Fleet Hub Mapping & Quota Aggregation',
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
  notes: 'Regional hospital allocations mapped to Hawassa, Bahir Dar, and Mekelle EPSS distribution branches.',
  hubAggregationData: {
    dossierId: 'dsp-epss-ho-sample-02',
    dspRefNumber: 'EPSS/HO-AGG/2026/015',
    generatedDate: '2026-10-30',
    status: 'In Progress',
    columns: DEFAULT_STAGE_4_COLUMNS,
    allocations: [
      {
        id: 's5-alloc-6',
        healthFacility: 'Hawassa University Comprehensive Hospital',
        region: 'Sidama',
        zone: 'Hawassa City',
        woreda: 'Meneharia',
        packages: 'Tertiary Fleet',
        hubCode: 'HW01',
        hubName: 'Hawassa Hub',
        masterCustomerCode: '1001780',
        masterFacilityName: 'Hawassa University Comprehensive Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 4, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 1, 'col-exam': 2 },
        totalQty: 13
      },
      {
        id: 's5-alloc-7',
        healthFacility: 'Felege Hiwot Comprehensive Specialized Hospital',
        region: 'Amhara',
        zone: 'West Gojjam',
        woreda: 'Bahir Dar City',
        packages: 'Tertiary Fleet',
        hubCode: 'BD01',
        hubName: 'Bahir Dar Hub',
        masterCustomerCode: '1001120',
        masterFacilityName: 'Felege Hiwot Comprehensive Specialized Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 3, 'col-bowel': 2, 'col-coldbox': 1, 'col-delivery': 2, 'col-exam': 2 },
        totalQty: 12
      },
      {
        id: 's5-alloc-8',
        healthFacility: 'Ayder Comprehensive Specialized Hospital',
        region: 'Tigray',
        zone: 'South Eastern',
        woreda: 'Mekelle City',
        packages: 'Tertiary Fleet',
        hubCode: 'MK01',
        hubName: 'Mekelle Hub',
        masterCustomerCode: '1001560',
        masterFacilityName: 'Ayder Comprehensive Specialized Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 2, 'col-bed': 4, 'col-bowel': 2, 'col-coldbox': 2, 'col-delivery': 1, 'col-exam': 2 },
        totalQty: 13
      },
      {
        id: 's5-alloc-9',
        healthFacility: 'University of Gondar Comprehensive Hospital',
        region: 'Amhara',
        zone: 'Central Gondar',
        woreda: 'Gondar City',
        packages: 'Tertiary Fleet',
        hubCode: 'GD01',
        hubName: 'Gondar Hub',
        masterCustomerCode: '1001340',
        masterFacilityName: 'University of Gondar Comprehensive Hospital',
        matchMethod: 'exact-master',
        matchConfidence: 100,
        quantities: { 'col-anesthesia': 1, 'col-bed': 3, 'col-bowel': 2, 'col-coldbox': 1, 'col-delivery': 1, 'col-exam': 2 },
        totalQty: 10
      }
    ]
  }
};

export const DEFAULT_STAGE_5_DOSSIERS = [
  DEFAULT_STAGE_5_DOSSIER_1,
  DEFAULT_STAGE_5_DOSSIER_2
];

export const INITIAL_DSP_RECORDS: DspWorkflowRecord[] = [
  ...DEFAULT_STAGE_1_DOSSIERS,
  ...DEFAULT_STAGE_2_DOSSIERS,
  ...DEFAULT_STAGE_3_DOSSIERS,
  ...DEFAULT_STAGE_4_DOSSIERS,
  ...DEFAULT_STAGE_5_DOSSIERS
];

