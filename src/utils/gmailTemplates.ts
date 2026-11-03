// EPSS Master Medical Device Management System - Gmail Email Template Utilities

export const GMAIL_SUBJECT_TEMPLATE_KEY = 'epss_gmail_custom_subject_template';
export const GMAIL_BODY_TEMPLATE_KEY = 'epss_gmail_custom_body_template';
export const GMAIL_OFFICIAL_EMAIL_KEY = 'epss_dsp_official_email';
export const GMAIL_CC_EMAIL_KEY = 'epss_dsp_cc_email';

export const DEFAULT_GMAIL_SUBJECT_TEMPLATE = 
  'Official DSP Allocation Request: MOH to EPSS - {date} ({count} Items)';

export const DEFAULT_GMAIL_BODY_TEMPLATE = 
`Dear MOH Team,

Please find attached the official DSP allocation request for {count} medical device items generated on {date}.{letter_note}

Total Quantity: {qty}
Total Valuation: {valuation}

Protocol: Immutable Binary Stream Transmission
Binary Verified: YES

Best Regards,
EPSS Inventory Administration`;

export interface GmailTemplateVars {
  date: string;
  count: number;
  qty: string;
  valuation: string;
  hasLetter?: boolean;
}

export const loadGmailTemplates = () => {
  const customSubject = localStorage.getItem(GMAIL_SUBJECT_TEMPLATE_KEY) || DEFAULT_GMAIL_SUBJECT_TEMPLATE;
  const customBody = localStorage.getItem(GMAIL_BODY_TEMPLATE_KEY) || DEFAULT_GMAIL_BODY_TEMPLATE;
  const officialEmail = localStorage.getItem(GMAIL_OFFICIAL_EMAIL_KEY) || 'mosisbme@gmail.com';
  const ccEmail = localStorage.getItem(GMAIL_CC_EMAIL_KEY) || '';

  return {
    customSubject,
    customBody,
    officialEmail,
    ccEmail
  };
};

export const saveGmailTemplates = (
  subject: string,
  body: string,
  officialEmail?: string,
  ccEmail?: string
) => {
  localStorage.setItem(GMAIL_SUBJECT_TEMPLATE_KEY, subject);
  localStorage.setItem(GMAIL_BODY_TEMPLATE_KEY, body);
  if (officialEmail !== undefined) {
    localStorage.setItem(GMAIL_OFFICIAL_EMAIL_KEY, officialEmail);
  }
  if (ccEmail !== undefined) {
    localStorage.setItem(GMAIL_CC_EMAIL_KEY, ccEmail);
  }
  window.dispatchEvent(new CustomEvent('epss_gmail_templates_updated', {
    detail: { subject, body, officialEmail, ccEmail }
  }));
};

export const resetGmailTemplatesToDefaults = () => {
  localStorage.removeItem(GMAIL_SUBJECT_TEMPLATE_KEY);
  localStorage.removeItem(GMAIL_BODY_TEMPLATE_KEY);
  window.dispatchEvent(new CustomEvent('epss_gmail_templates_updated', {
    detail: {
      subject: DEFAULT_GMAIL_SUBJECT_TEMPLATE,
      body: DEFAULT_GMAIL_BODY_TEMPLATE
    }
  }));
  return {
    subject: DEFAULT_GMAIL_SUBJECT_TEMPLATE,
    body: DEFAULT_GMAIL_BODY_TEMPLATE
  };
};

export function formatGmailSubject(template: string, vars: GmailTemplateVars): string {
  let result = template || DEFAULT_GMAIL_SUBJECT_TEMPLATE;
  result = result.replace(/\{date\}/g, vars.date);
  result = result.replace(/\{count\}/g, vars.count.toString());
  result = result.replace(/\{qty\}/g, vars.qty);
  result = result.replace(/\{valuation\}/g, vars.valuation);
  return result;
}

export function formatGmailBody(template: string, vars: GmailTemplateVars): string {
  let result = template || DEFAULT_GMAIL_BODY_TEMPLATE;
  const letterNote = vars.hasLetter ? '' : '\nNote: No covering letter attached.';
  result = result.replace(/\{date\}/g, vars.date);
  result = result.replace(/\{count\}/g, vars.count.toString());
  result = result.replace(/\{qty\}/g, vars.qty);
  result = result.replace(/\{valuation\}/g, vars.valuation);
  result = result.replace(/\{letter_note\}/g, letterNote);
  return result;
}
