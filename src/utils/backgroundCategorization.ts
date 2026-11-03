import { MedicalDeviceItem } from '../types';

export function autoCategorizeItem(item: MedicalDeviceItem): string[] {
  const tags: string[] = [];
  const desc = (item.materialDescription || '').toLowerCase();
  const wbs = (item.wbsElement || '').toUpperCase();
  const pkg = (item.procurementPackage || '').toLowerCase();
  const timeFrame = (item.timeFrame || '').toLowerCase();

  // 1. Quantity Category Tags
  if (item.qty >= 50) {
    tags.push('Quantity: Bulk Batch (50+ units)');
  } else if (item.qty >= 10) {
    tags.push('Quantity: Medium Batch (10-49 units)');
  } else {
    tags.push('Quantity: Single / Low Unit (1-9 units)');
  }

  // 2. Value Category Tags
  const valuation = item.totalAmount || (item.qty * item.unitPrice);
  if (valuation >= 10000000) {
    tags.push('Value: High-Value Capital Asset (>10M ETB)');
  } else if (valuation >= 1000000) {
    tags.push('Value: Mid-Range Asset (1M-10M ETB)');
  } else {
    tags.push('Value: Standard Asset (<1M ETB)');
  }

  // 3. WBS Element Tag
  if (wbs) {
    tags.push(`WBS: ${wbs}`);
  } else {
    tags.push('WBS: Standard SOH WBS');
  }

  // 4. Year Tag
  if (desc.includes('2026') || timeFrame.includes('2026') || wbs.includes('2026')) {
    tags.push('Year: 2026 Fiscal');
  } else if (desc.includes('2025') || timeFrame.includes('2025') || wbs.includes('2025')) {
    tags.push('Year: 2025 Fiscal');
  } else {
    tags.push('Year: 2026 Fiscal (Current)');
  }

  // 5. Package / Domain Keyword Tags from Material Description
  if (desc.includes('imaging') || desc.includes('x-ray') || desc.includes('c-arm') || desc.includes('ultrasound') || desc.includes('mri') || desc.includes('ct') || pkg.includes('imaging')) {
    tags.push('Package: Imaging & Radiology');
  } else if (desc.includes('icu') || desc.includes('ventilator') || desc.includes('patient monitor') || desc.includes('defibrillator') || desc.includes('infusion') || pkg.includes('icu')) {
    tags.push('Package: ICU & Critical Care');
  } else if (desc.includes('laboratory') || desc.includes('analyzer') || desc.includes('centrifuge') || desc.includes('incubator') || pkg.includes('laboratory')) {
    tags.push('Package: Laboratory & Diagnostics');
  } else if (desc.includes('cold chain') || desc.includes('refrigerator') || desc.includes('solar') || pkg.includes('cold chain')) {
    tags.push('Package: Cold Chain & Solar');
  } else if (desc.includes('surgical') || desc.includes('sterilizer') || desc.includes('autoclave') || pkg.includes('surgical')) {
    tags.push('Package: Surgical & CSSD');
  } else {
    tags.push('Package: General Medical Equipment');
  }

  return tags;
}
