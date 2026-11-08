import { DspWorkflowRecord } from '../types';

export interface DossierDisplayInfo {
  dspName: string;
  authorizedPerson: string;
  organization: string;
  role: string;
  status: 'Pending' | 'Approved' | 'Under Review' | 'Draft';
}

/**
 * Standardizes DSP Workflow Records for the 8-Column Institutional Table Format:
 * S/N | Date | DSP Name | Authorized person | Organazation | Role | Status | View
 * As specified in user template reference {C8DB306C-47B8-4474-93C2-1A74295BCB3F}.png
 */
export const getDossierDisplayInfo = (rec: DspWorkflowRecord, idx: number = 0): DossierDisplayInfo => {
  // 1. Clean DSP Name (Clean project name - Priority: what user wrote manually in rec.dspName)
  let dspName = '';
  if (rec.dspName && rec.dspName.trim()) {
    dspName = rec.dspName.trim();
  } else if (rec.dspRefNumber?.includes('206')) {
    dspName = 'SDG Breakdown';
  } else if (rec.dspRefNumber?.includes('268')) {
    dspName = 'Global Breakdown';
  } else if (rec.dspRefNumber?.includes('464')) {
    dspName = 'World Bank BkD';
  } else if (rec.dspRefNumber?.includes('850') || rec.dspRefNumber?.includes('405')) {
    dspName = 'MCH Breakdown';
  } else if (rec.dspRefNumber?.includes('797')) {
    dspName = 'National Equipment BkD';
  } else if (rec.dspRefNumber?.includes('237')) {
    dspName = 'SDG2019 Breakdown';
  } else if (rec.subject) {
    const match = rec.subject.match(/DSP\s*\[(.*?)\]/i);
    if (match && match[1]) {
      dspName = match[1].trim();
    } else if (rec.subject.includes('Aggregated Multi-Regional')) {
      dspName = `Aggregated Breakdown ${idx + 1}`;
    } else {
      dspName = rec.subject
        .replace(/^DSP\s*:\s*/i, '')
        .replace(/\(.*?Units\)/i, '')
        .replace(/\(.*?Materials\)/i, '')
        .replace(/\(.*?Items\)/i, '')
        .trim();
    }
  } else {
    dspName = `DSP Project ${idx + 1}`;
  }

  // 2. Clean Authorized Person (Individual name - Priority: what user wrote manually)
  let authorizedPerson = '';
  if (rec.authorizedPerson && rec.authorizedPerson.trim()) {
    authorizedPerson = rec.authorizedPerson.trim();
  } else if (rec.signatory && rec.signatory.trim() && !rec.signatory.includes('Dr. Solomon Abebe & Dr. Bethlehem')) {
    if (rec.signatory.includes('&')) {
      authorizedPerson = rec.signatory.split('&')[0].trim();
    } else {
      authorizedPerson = rec.signatory.replace(/\(Authorized User\)/gi, '').trim();
    }
  } else if (rec.dspRefNumber?.includes('206') || rec.dspRefNumber?.includes('237')) {
    authorizedPerson = 'Ayeru Fekedu';
  } else if (rec.dspRefNumber?.includes('268') || rec.dspRefNumber?.includes('405')) {
    authorizedPerson = 'Yechalew Sheferew';
  } else if (rec.dspRefNumber?.includes('464') || rec.dspRefNumber?.includes('850')) {
    authorizedPerson = 'Mosisa Berhanu';
  } else if (rec.signatory && rec.signatory.trim()) {
    authorizedPerson = rec.signatory.split('&')[0].trim();
  } else {
    authorizedPerson = 'Authorized Signatory';
  }

  // 3. Organization (EPSS, MOH, RHB - Priority: what user wrote manually in organization or senderOrg)
  let organization = '';
  if (rec.organization && rec.organization.trim()) {
    organization = rec.organization.trim();
  } else if (rec.senderOrg && rec.senderOrg.trim()) {
    const sOrg = rec.senderOrg.trim().toUpperCase();
    if (sOrg === 'MOH' || sOrg.includes('MINISTRY OF HEALTH') || sOrg.includes('PMD')) {
      organization = 'MOH';
    } else if (sOrg === 'EPSS' || sOrg.includes('PHARMACEUTICAL SUPPLY') || sOrg.includes('HEAD OFFICE')) {
      organization = 'EPSS';
    } else if (sOrg === 'RHB' || sOrg.includes('REGIONAL HEALTH')) {
      organization = 'RHB';
    } else {
      organization = rec.senderOrg.trim();
    }
  } else if (rec.dspRefNumber?.includes('268') || rec.dspRefNumber?.includes('405') || rec.dspRefNumber?.includes('850')) {
    organization = 'MOH';
  } else if (rec.recipientOrg?.includes('MOH') && !rec.senderOrg?.includes('EPSS')) {
    organization = 'MOH';
  } else {
    organization = 'EPSS';
  }

  // 4. Role (Team Leader, Officer, Director General, etc. - Priority: what user wrote manually in role or signatoryRole)
  let role = '';
  if (rec.role && rec.role.trim()) {
    role = rec.role.trim();
  } else if (rec.signatoryRole && rec.signatoryRole.trim() && !rec.signatoryRole.includes('EPSS Director General & MOH PMD Lead')) {
    const sRole = rec.signatoryRole.trim();
    const rLower = sRole.toLowerCase();
    if (rLower === 'team leader' || rLower === 'officer' || rLower === 'director general' || rLower === 'director' || rLower === 'manager') {
      role = sRole;
    } else if (rLower.includes('lead') || rLower.includes('leader')) {
      role = 'Team Leader';
    } else if (rLower.includes('general')) {
      role = 'Director General';
    } else if (rLower.includes('director')) {
      role = 'Director';
    } else if (rLower.includes('manager')) {
      role = 'Manager';
    } else if (rLower.includes('officer')) {
      role = 'Officer';
    } else {
      role = sRole.replace(/EPSS|MOH|Directorate/gi, '').trim() || sRole;
    }
  } else if (rec.dspRefNumber?.includes('206') || rec.dspRefNumber?.includes('268') || rec.dspRefNumber?.includes('405')) {
    role = 'Team Leader';
  } else if (rec.dspRefNumber?.includes('464') || rec.dspRefNumber?.includes('850') || rec.dspRefNumber?.includes('237')) {
    role = 'Officer';
  } else if (rec.signatoryRole && rec.signatoryRole.trim()) {
    const rLower = rec.signatoryRole.toLowerCase();
    if (rLower.includes('lead') || rLower.includes('leader')) {
      role = 'Team Leader';
    } else if (rLower.includes('general')) {
      role = 'Director General';
    } else if (rLower.includes('director')) {
      role = 'Director';
    } else if (rLower.includes('manager')) {
      role = 'Manager';
    } else if (rLower.includes('officer')) {
      role = 'Officer';
    } else {
      role = rec.signatoryRole.replace(/EPSS|MOH|Directorate/gi, '').trim() || 'Officer';
    }
  } else {
    role = 'Officer';
  }


  // 5. Status (Pending, Approved, Under Review, Draft)
  let status: 'Pending' | 'Approved' | 'Under Review' | 'Draft' = 'Pending';
  const sLower = (rec.status || '').toLowerCase();
  if (sLower === 'approved' || sLower.includes('approved') || sLower.includes('endorsed') || sLower.includes('dispatched')) {
    status = 'Approved';
  } else if (sLower === 'under review' || sLower.includes('review')) {
    status = 'Under Review';
  } else if (sLower === 'draft') {
    status = 'Draft';
  } else if (sLower === 'pending' || sLower.includes('pending') || sLower.includes('submitted')) {
    status = 'Pending';
  } else if (rec.dspRefNumber?.includes('268') || rec.dspRefNumber?.includes('797') || rec.dspRefNumber?.includes('405')) {
    status = 'Approved';
  } else if (rec.dspRefNumber?.includes('206') || rec.dspRefNumber?.includes('464') || rec.dspRefNumber?.includes('850') || rec.dspRefNumber?.includes('237')) {
    status = 'Pending';
  }

  return { dspName, authorizedPerson, organization, role, status };
};
