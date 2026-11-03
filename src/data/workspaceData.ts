import { MaintenanceCalendarEvent, DeviceDocument, AlertNotification } from '../types';

export const initialCalendarEvents: MaintenanceCalendarEvent[] = [];

export const initialDocuments: DeviceDocument[] = [
  {
    id: 'DOC-MOH-001',
    referenceNumber: 'MoH/EPSS/2026/089',
    title: 'MoH Strategic Allocation Directive: 40 ICU Mechanical Ventilators',
    deviceModel: 'Hamilton Medical C6 High-End ICU Ventilator',
    type: 'Official MoH Allocation Letter',
    category: 'Official MoH Letters',
    fileSize: '2.4 MB',
    fileType: 'PDF',
    lastUpdated: 'July 14, 2026',
    issuedDate: '14-Jul-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'Hamilton Medical AG (Switzerland)',
    senderFacility: 'Ministry of Health - Medical Device Allocation Directorate',
    recipientFacility: 'Ethiopian Pharmaceuticals Supply Service (EPSS)',
    status: 'Approved',
    officialSeal: true,
    notes: 'Approved ministerial directive for immediate dispatch to Jimma, Hawassa, Mekelle, and Bahir Dar regional referral ICU units under Grant Program Round 4.',
    contentPreview: `FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
MINISTRY OF HEALTH (MoH)
Health Infrastructure & Medical Equipment Directorate
Ref. No: MoH/EPSS/2026/089
Date: 14 July 2026

TO: Ethiopian Pharmaceuticals Supply Service (EPSS)
    Director General, Medical Devices & Equipment Division
    Addis Ababa, Ethiopia

SUBJECT: ALLOCATION AND DISPATCH CLEARANCE FOR FORTY (40) ADVANCED ICU VENTILATORS (PACKAGE 36)

Dear Director General,

Pursuant to the National Critical Care Expansion Strategy and following technical inspection at central bonded warehouses, the Ministry hereby formally approves and directs the allocation of forty (40) units of Hamilton Medical C6 ICU Ventilators as detailed below:

1. ALLOCATION SCHEDULE BY REGIONAL HUB:
   - Central / Addis Ababa Hub: 8 Units (Tikur Anbessa & St. Paul's Millennium)
   - Jimma Regional Hub: 6 Units (Jimma University Medical Center)
   - Hawassa Regional Hub: 6 Units (Hawassa Comprehensive Referral Hospital)
   - Mekelle Regional Hub: 6 Units (Ayder Comprehensive Specialized Hospital)
   - Bahir Dar Regional Hub: 6 Units (Felege Hiwot Referral Hospital)
   - Adama Regional Hub: 4 Units (Adama General Hospital)
   - Dire Dawa Regional Hub: 4 Units (Dilchora Referral Hospital)

2. COMPLIANCE & ACCEPTANCE:
   All receiving hub biomedical engineers must execute tri-party installation acceptance protocols with certified manufacturer field engineers before clinical handover.

With kind regards,

[SEAL OF THE MINISTRY OF HEALTH, ETHIOPIA]
Dr. Dereje Duguma, MD, MPH
State Minister of Health
Federal Democratic Republic of Ethiopia`
  },
  {
    id: 'DOC-MOH-002',
    referenceNumber: 'MoH/RAD/2026/041',
    title: 'MoH Radiation Protection & Site Shielding Clearance for 64-Slice CT Scanners',
    deviceModel: 'Siemens Healthineers SOMATOM go.Top CT Scanner',
    type: 'MoH Approval Letter',
    category: 'Official MoH Letters',
    fileSize: '3.1 MB',
    fileType: 'PDF',
    lastUpdated: 'August 02, 2026',
    issuedDate: '02-Aug-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'Siemens Healthineers GmbH',
    senderFacility: 'Ethiopian Radiation Protection Authority & MoH Directorate',
    recipientFacility: 'EPSS Central Procurement & Logistics Hub',
    status: 'Approved',
    officialSeal: true,
    notes: 'Regulatory clearance following radiographic lead shielding verification at Gondar and Jimma specialized radiology suites.',
    contentPreview: `FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
MINISTRY OF HEALTH & ETHIOPIAN RADIATION PROTECTION AUTHORITY
Joint Technical Review Board
Ref. No: MoH/RAD/2026/041
Date: 02 August 2026

TO: All Regional Health Bureaus & EPSS Procurement Directorates
SUBJECT: RADIATION SAFETY CLEARANCE CERTIFICATE FOR SIEMENS 64-SLICE CT SCANNERS

The Radiation Safety Evaluation Committee has concluded radiographic scatter audits at target medical centers. All lead-lined glass partitions, wall shielding (>2.0mm Pb equivalent), and emergency shut-off mechanisms comply with Ethiopian Radiation Protection Proclamation No. 571/2008.

Clearance is hereby granted for full operational commissioning.

Approved by:
Radiation Safety Officer / Chief Medical Physicist
Ministry of Health, Ethiopia`
  },
  {
    id: 'DOC-MOH-003',
    referenceNumber: 'MoH/NEPH/2026/114',
    title: 'Official Ministerial Memo: National Hemodialysis Machines Expansion',
    deviceModel: 'Fresenius Medical Care 4008S Hemodialysis Consoles',
    type: 'Official Request Letter',
    category: 'Official MoH Letters',
    fileSize: '1.8 MB',
    fileType: 'PDF',
    lastUpdated: 'September 04, 2026',
    issuedDate: '04-Sep-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'Fresenius Medical Care AG',
    senderFacility: 'MoH Clinical Services Directorate & Tikur Anbessa Hospital',
    recipientFacility: 'EPSS Central Biomedical Engineering Hub',
    status: 'Dispatched',
    officialSeal: true,
    notes: 'Official requisition allocating twenty-five (25) dialysis consoles across Addis Ababa and Oromia referral centers to relieve renal unit backlogs.',
    contentPreview: `FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
MINISTRY OF HEALTH
Clinical Services Directorate
Ref. No: MoH/NEPH/2026/114
Date: 04 September 2026

SUBJECT: URGENT REQUISITION & DISPATCH SCHEDULE: 25 HEMODIALYSIS CONSOLES

Following rising chronic kidney disease admissions, the Ministry authorizes the release of twenty-five (25) units of Fresenius 4008S Hemodialysis machines currently held under bonded customs clearance.

Dispatches must commence immediately with water treatment plant (RO system) pre-validation at each recipient facility.

Approved by:
Director, Clinical Services Directorate
Ministry of Health`
  },
  {
    id: 'DOC-BKD-001',
    referenceNumber: 'BKD-2026-034',
    title: 'Regional Breakdown & Diagnostic Report: Jimma Specialized Hospital ICU Suite',
    deviceModel: 'Dräger Fabius Plus Anesthesia Workstation (SN: DRG-882194)',
    type: 'Regional Breakdown Report',
    category: 'Breakdown Reports',
    fileSize: '4.2 MB',
    fileType: 'PDF',
    lastUpdated: 'August 28, 2026',
    issuedDate: '28-Aug-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'Drägerwerk AG & Co. KGaA',
    senderFacility: 'Jimma University Medical Center - Clinical Engineering Unit',
    recipientFacility: 'EPSS Jimma Regional Hub & Central Technical Support',
    status: 'Action Required',
    officialSeal: true,
    notes: 'Diagnostic breakdown analysis identifying primary oxygen transducer failure and vaporizer o-ring degradation causing clinical downtime of 96 hours.',
    contentPreview: `EPSS BIOMEDICAL ENGINEERING & CLINICAL MAINTENANCE DIVISION
REGIONAL BREAKDOWN INCIDENT & TECHNICAL REPORT
Report Reference: BKD-2026-034
Incident Date: 28 August 2026
Facility: Jimma University Specialized Medical Center (OR Suite #3)

EQUIPMENT IDENTIFICATION:
- Equipment Description: Anesthesia Workstation with Integrated Ventilator
- Manufacturer: Drägerwerk AG
- Model: Fabius Plus
- Serial Number: DRG-882194
- Asset Tag: JUMC-BME-ANE-042

FAILURE SYMPTOMS & CLINICAL OBSERVATIONS:
1. Continuous audible acoustic alarm: "O2 Supply Failure / Sensor Calib Error".
2. Oxygen concentration calibration test failed at 21% ambient air threshold (measured 14.2%).
3. Minor pressure drop noticed in Isoflurane vaporizer interlock seal under continuous 15L/min flow.

DOWNTIME LOG:
- Incident Reported: 26 August 2026, 08:30 EAT
- Unit Withdrawn from Service: Immediate
- Cumulative Downtime: 96 Operational Hours

REQUIRED SPARE PARTS & REMEDIAL ACTION:
1. Part No. 6850645 - Paramagnetic / Galvanic O2 Cell Capsule (Qty: 2)
2. Part No. 8412860 - Vaporizer Interlock Interface O-Ring Kit (Qty: 1)
3. EPSS Service Action: Request immediate spare dispatch from EPSS Central Spare Parts Vault (Material Code: #30008819).

Inspecting Biomedical Engineer:
BSc. Engineer Yohannes Bekele, Lead Biomedical Specialist
Verified by: Chief Clinical Director, Jimma Medical Center`
  },
  {
    id: 'DOC-BKD-002',
    referenceNumber: 'BKD-2026-029',
    title: 'Breakdown & Transducer Failure Notice: Hawassa Hub Ultrasound System',
    deviceModel: 'GE Healthcare Logiq P9 Ultrasound System (SN: GE-LP9-4401)',
    type: 'Breakdown Notice',
    category: 'Breakdown Reports',
    fileSize: '1.9 MB',
    fileType: 'PDF',
    lastUpdated: 'July 19, 2026',
    issuedDate: '19-Jul-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'GE Healthcare Ltd',
    senderFacility: 'Hawassa Regional EPSS Hub & Sidama Health Bureau',
    recipientFacility: 'EPSS Central Quality Assurance Directorate',
    status: 'Under Review',
    officialSeal: false,
    notes: 'Acoustic crystal element degradation on convex probe 4C-RS resulting in horizontal imaging artifact in obstetrics scanning.',
    contentPreview: `EPSS CLINICAL DEVICE BREAKDOWN NOTIFICATION
Notice ID: BKD-2026-029
Facility: Hawassa Comprehensive Specialized Referral Hospital

ISSUE SUMMARY:
The primary convex abdominal probe (GE 4C-RS) on ultrasound station #2 developed severe signal dropouts, presenting black acoustic vertical lines across the central sector. Physical inspection confirmed mechanical strain relief fracture at the cable harness termination.

INTERVENTION STATUS:
Probe tagged as defective and quarantined. Replacement probe requisition submitted under EPSS warranty coverage ticket #WAR-88190.`
  },
  {
    id: 'DOC-BKD-003',
    referenceNumber: 'BKD-REP-2026-Q2',
    title: 'Consolidated Regional Breakdown Audit - Q2 Northern Sector Hubs',
    deviceModel: 'Multi-Parameter Monitors & Infant Radiant Warmers (Consolidated)',
    type: 'Regional Breakdown Report',
    category: 'Breakdown Reports',
    fileSize: '5.6 MB',
    fileType: 'PDF',
    lastUpdated: 'September 11, 2026',
    issuedDate: '11-Sep-2026',
    driveLink: 'https://drive.google.com',
    manufacturer: 'Consolidated EPSS Maintenance Operations',
    senderFacility: 'EPSS Quality Assurance & Biomedical Directorate',
    recipientFacility: 'MoH National Biomedical Taskforce & EPSS Executive Board',
    status: 'Resolved',
    officialSeal: true,
    notes: 'Comprehensive audit analyzing 68 device breakdown incidents across Mekelle, Gondar, and Dessie hub catchments with MTBF analysis and corrective maintenance actions.',
    contentPreview: `EPSS QUALITY ASSURANCE & BIOMEDICAL ENGINEERING
CONSOLIDATED REGIONAL BREAKDOWN AUDIT - Q2 REPORT
Coverage: Mekelle, Gondar, and Dessie Catchment Zones

EXECUTIVE OVERVIEW:
A total of 68 device breakdowns were registered in the second quarter. 54 incidents (79.4%) were resolved on-site via preventive spares replacement, while 14 incidents required complex depot repairs.

BREAKDOWN BY FAILURE MODE:
- Power Supply Unit (PSU) Spikes / Grid Instability: 42%
- Sensor / Probe Wear & Tear: 31%
- Pneumatic Valves & Tubing Leaks: 18%
- Software Firmware Faults: 9%

RECOMMENDATION:
1. Deploy dedicated online medical-grade UPS with isolation transformers for all neonatal warmers.
2. Maintain regional buffer stocks of ECG patient lead wires, SPO2 sensors, and NIBP cuffs.`
  }
];

export const initialAlerts: AlertNotification[] = [];

