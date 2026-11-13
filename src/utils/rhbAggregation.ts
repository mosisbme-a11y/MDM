import { DspWorkflowRecord, RegionBreakdownColumn, RegionBreakdownRow } from '../types';
import { canonicalizeSubStage } from '../data/defaultDspWorkflows';

/**
 * Strictly identifies records that were individually submitted by a Regional Health Bureau (RHB)
 * to the Ministry of Health (MOH). Excludes MOH->RHB drafts or EPSS-targeted records.
 */
export function isRhbSubmittedToMohRecord(r: DspWorkflowRecord): boolean {
  if (!r) return false;
  const sub = canonicalizeSubStage(r.subStage, r.stage);
  const recipientUpper = (r.recipientOrg || '').toUpperCase();
  const senderUpper = (r.senderOrg || '').toUpperCase();

  const hasPayload =
    (r.facilityMatrixData?.rows && r.facilityMatrixData.rows.length > 0) ||
    (r.itemsIncluded && r.itemsIncluded.length > 0);
  if (!hasPayload) return false;

  if (r.stage === 'rhb-to-moh') return true;
  if (r.stage === 'moh-osp-management' && sub === '2.3') return true;

  if (r.stage === 'rhb-breakdown-management' && sub === '3.2') {
    const sentToMoh =
      recipientUpper.includes('MOH') ||
      recipientUpper.includes('MINISTRY OF HEALTH') ||
      (senderUpper.includes('RHB') && !recipientUpper.includes('EPSS')) ||
      (senderUpper.includes('REGIONAL HEALTH BUREAU') && !recipientUpper.includes('EPSS'));
    return sentToMoh;
  }

  return false;
}

export interface AggregatedRhbFacilityRow extends RegionBreakdownRow {
  sourceRecordId: string;
  dspRefNumber: string;
  dspName: string;
  officialLetterRef: string;
  submissionDate: string;
  senderOrg: string;
  signatory: string;
  signatoryRole: string;
  status: string;
  rowTotal: number;
}

export interface AggregatedRegionSummaryRow {
  sn: number;
  region: string;
  dossierCount: number;
  dspRefs: string[];
  dspNames: string[];
  officialLetterRefs: string[];
  latestDate: string;
  senderOrgs: string[];
  signatories: string[];
  zones: string[];
  woredas: string[];
  facilityCount: number;
  packages: string[];
  hubs: string[];
  columnTotals: Record<string, number>;
  totalUnits: number;
  statuses: string[];
  sourceRecordIds: string[];
}

export interface RhbAggregationResult {
  submissions: DspWorkflowRecord[];
  unifiedColumns: RegionBreakdownColumn[];
  facilityRows: AggregatedRhbFacilityRow[];
  regionSummaries: AggregatedRegionSummaryRow[];
  columnTotals: Record<string, number>;
  grandTotalUnits: number;
  hasAnyHub: boolean;
  latestDate: string;
}

function normalizeEquipmentKey(name: string, code: string): string {
  const cleanCode = (code || '').trim().toUpperCase();
  const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (cleanCode && cleanName) return `${cleanCode}:::${cleanName}`;
  if (cleanCode) return `CODE:::${cleanCode}`;
  return `NAME:::${cleanName}`;
}

export function aggregateRhbSubmissionsToMoh(records: DspWorkflowRecord[]): RhbAggregationResult {
  const submissions = (records || []).filter(isRhbSubmittedToMohRecord);

  const unifiedColumns: RegionBreakdownColumn[] = [];
  const keyToUnifiedColId = new Map<string, string>();
  const recordColMap = new Map<string, string>(); // `${recordId}:::${origColId}` -> unifiedColId

  const ensureColumn = (name: string, code: string, preferredId?: string): string => {
    const cleanName = (name || '').trim() || 'Medical Equipment';
    const cleanCode = (code || '').trim() || 'N/A';
    const key = normalizeEquipmentKey(cleanName, cleanCode);

    const existingId = keyToUnifiedColId.get(key);
    if (existingId) return existingId;

    // Also match if exact same SAP code (non-generic) AND name wasn't provided
    const newId =
      preferredId && !unifiedColumns.some((c) => c.id === preferredId)
        ? preferredId
        : `agg-col-${unifiedColumns.length + 1}-${cleanCode.replace(/[^a-zA-Z0-9]/g, '')}`;

    unifiedColumns.push({
      id: newId,
      name: cleanName,
      code: cleanCode,
    });
    keyToUnifiedColId.set(key, newId);
    return newId;
  };

  // Pass 1: Collect every single equipment column across all RHB submissions without missing any
  submissions.forEach((rec) => {
    const matrixCols = rec.facilityMatrixData?.columns || [];
    matrixCols.forEach((col) => {
      const unifiedId = ensureColumn(col.name, col.code, col.id);
      recordColMap.set(`${rec.id}:::${col.id}`, unifiedId);
    });

    // Ensure itemsIncluded entries are also represented if they weren't in facilityMatrixData.columns
    if ((!matrixCols || matrixCols.length === 0) && rec.itemsIncluded && rec.itemsIncluded.length > 0) {
      rec.itemsIncluded.forEach((item, idx) => {
        const unifiedId = ensureColumn(item.description, item.material, `item-${idx}`);
        recordColMap.set(`${rec.id}:::item-${idx}`, unifiedId);
      });
    }
  });

  // Pass 2: Build unified facility rows preserving every metadata & column from each RHB submission
  const facilityRows: AggregatedRhbFacilityRow[] = [];
  let hasAnyHub = false;
  let latestDate = '';

  submissions.forEach((rec) => {
    const submissionDate = rec.facilityMatrixData?.date || rec.dateSubmitted || '';
    if (submissionDate && (!latestDate || submissionDate > latestDate)) {
      latestDate = submissionDate;
    }
    const dspName = rec.dspName || rec.subject || rec.dspRefNumber;
    const matrixRows = rec.facilityMatrixData?.rows || [];
    const matrixCols = rec.facilityMatrixData?.columns || [];

    if (matrixRows.length > 0) {
      matrixRows.forEach((row, rIdx) => {
        const mappedQuantities: Record<string, number> = {};
        let rowTotal = 0;

        matrixCols.forEach((origCol) => {
          const unifiedId = recordColMap.get(`${rec.id}:::${origCol.id}`);
          if (!unifiedId) return;
          const val = Number(row.quantities?.[origCol.id]) || 0;
          if (val !== 0) {
            mappedQuantities[unifiedId] = (mappedQuantities[unifiedId] || 0) + val;
            rowTotal += val;
          } else if (mappedQuantities[unifiedId] === undefined) {
            mappedQuantities[unifiedId] = 0;
          }
        });

        // Also preserve any quantities keyed directly by unifiedId
        Object.entries(row.quantities || {}).forEach(([k, v]) => {
          if (unifiedColumns.some((uc) => uc.id === k) && mappedQuantities[k] === undefined) {
            const val = Number(v) || 0;
            mappedQuantities[k] = val;
            rowTotal += val;
          }
        });

        const hubVal = (row.hub || '').trim();
        if (hubVal) hasAnyHub = true;

        facilityRows.push({
          id: `${rec.id}::${row.id || rIdx}`,
          region: (row.region || rec.facilityMatrixData?.region || rec.targetedRegions?.[0] || 'Unspecified').trim(),
          zone: (row.zone || '').trim() || '-',
          woreda: (row.woreda || '').trim() || '-',
          hub: hubVal,
          healthFacility: (row.healthFacility || row.customerDescription || 'Health Facility').trim(),
          customerDescription: (row.customerDescription || row.healthFacility || 'Health Facility').trim(),
          customerId: row.customerId,
          packages: (row.packages || 'MCH').trim(),
          quantities: mappedQuantities,
          sourceRecordId: rec.id,
          dspRefNumber: rec.dspRefNumber,
          dspName,
          officialLetterRef: rec.officialLetterRef || '-',
          submissionDate: submissionDate || '-',
          senderOrg: rec.senderOrg || '-',
          signatory: rec.signatory || '-',
          signatoryRole: rec.signatoryRole || '-',
          status: rec.status || 'Submitted & Pending',
          rowTotal,
        });
      });
    } else if (rec.itemsIncluded && rec.itemsIncluded.length > 0) {
      // Fallback row if an RHB submitted itemsIncluded without facility rows
      const mappedQuantities: Record<string, number> = {};
      let rowTotal = 0;
      rec.itemsIncluded.forEach((item, idx) => {
        const unifiedId = recordColMap.get(`${rec.id}:::item-${idx}`);
        if (unifiedId) {
          const val = Number(item.quantity) || 0;
          mappedQuantities[unifiedId] = (mappedQuantities[unifiedId] || 0) + val;
          rowTotal += val;
        }
      });

      const regionName = rec.targetedRegions?.[0] || rec.senderOrg.replace(/regional health bureau/i, '').trim() || 'Unspecified';
      facilityRows.push({
        id: `${rec.id}::summary-row`,
        region: regionName,
        zone: 'Regional Level',
        woreda: '-',
        hub: rec.itemsIncluded[0]?.plant || '',
        healthFacility: `${regionName} Regional Consolidated Allocation`,
        customerDescription: `${regionName} Regional Consolidated Allocation`,
        packages: 'All Packages',
        quantities: mappedQuantities,
        sourceRecordId: rec.id,
        dspRefNumber: rec.dspRefNumber,
        dspName,
        officialLetterRef: rec.officialLetterRef || '-',
        submissionDate: submissionDate || '-',
        senderOrg: rec.senderOrg || '-',
        signatory: rec.signatory || '-',
        signatoryRole: rec.signatoryRole || '-',
        status: rec.status || 'Submitted & Pending',
        rowTotal,
      });
    }
  });

  // Pass 3: Aggregate per Region for the All-Region Summary Table
  const regionMap = new Map<
    string,
    {
      region: string;
      sourceRecordIds: Set<string>;
      dspRefs: Set<string>;
      dspNames: Set<string>;
      officialLetterRefs: Set<string>;
      latestDate: string;
      senderOrgs: Set<string>;
      signatories: Set<string>;
      zones: Set<string>;
      woredas: Set<string>;
      facilityCount: number;
      packages: Set<string>;
      hubs: Set<string>;
      columnTotals: Record<string, number>;
      totalUnits: number;
      statuses: Set<string>;
    }
  >();

  facilityRows.forEach((row) => {
    const regionKey = row.region || 'Unspecified';
    let entry = regionMap.get(regionKey);
    if (!entry) {
      entry = {
        region: regionKey,
        sourceRecordIds: new Set(),
        dspRefs: new Set(),
        dspNames: new Set(),
        officialLetterRefs: new Set(),
        latestDate: '',
        senderOrgs: new Set(),
        signatories: new Set(),
        zones: new Set(),
        woredas: new Set(),
        facilityCount: 0,
        packages: new Set(),
        hubs: new Set(),
        columnTotals: {},
        totalUnits: 0,
        statuses: new Set(),
      };
      regionMap.set(regionKey, entry);
    }

    entry.sourceRecordIds.add(row.sourceRecordId);
    if (row.dspRefNumber && row.dspRefNumber !== '-') entry.dspRefs.add(row.dspRefNumber);
    if (row.dspName && row.dspName !== '-') entry.dspNames.add(row.dspName);
    if (row.officialLetterRef && row.officialLetterRef !== '-') entry.officialLetterRefs.add(row.officialLetterRef);
    if (row.submissionDate && row.submissionDate !== '-' && (!entry.latestDate || row.submissionDate > entry.latestDate)) {
      entry.latestDate = row.submissionDate;
    }
    if (row.senderOrg && row.senderOrg !== '-') entry.senderOrgs.add(row.senderOrg);
    if (row.signatory && row.signatory !== '-') {
      entry.signatories.add(
        row.signatoryRole && row.signatoryRole !== '-' ? `${row.signatory} (${row.signatoryRole})` : row.signatory
      );
    }
    if (row.zone && row.zone !== '-') entry.zones.add(row.zone);
    if (row.woreda && row.woreda !== '-') entry.woredas.add(row.woreda);
    entry.facilityCount += 1;
    if (row.packages && row.packages !== '-') entry.packages.add(row.packages);
    if (row.hub && row.hub !== '-') entry.hubs.add(row.hub);
    if (row.status) entry.statuses.add(row.status);

    unifiedColumns.forEach((col) => {
      const qty = Number(row.quantities[col.id]) || 0;
      entry!.columnTotals[col.id] = (entry!.columnTotals[col.id] || 0) + qty;
    });
    entry.totalUnits += row.rowTotal;
  });

  const regionSummaries: AggregatedRegionSummaryRow[] = Array.from(regionMap.values())
    .sort((a, b) => a.region.localeCompare(b.region))
    .map((entry, idx) => ({
      sn: idx + 1,
      region: entry.region,
      dossierCount: entry.sourceRecordIds.size,
      dspRefs: Array.from(entry.dspRefs),
      dspNames: Array.from(entry.dspNames),
      officialLetterRefs: Array.from(entry.officialLetterRefs),
      latestDate: entry.latestDate || latestDate || new Date().toISOString().split('T')[0],
      senderOrgs: Array.from(entry.senderOrgs),
      signatories: Array.from(entry.signatories),
      zones: Array.from(entry.zones),
      woredas: Array.from(entry.woredas),
      facilityCount: entry.facilityCount,
      packages: Array.from(entry.packages),
      hubs: Array.from(entry.hubs),
      columnTotals: entry.columnTotals,
      totalUnits: entry.totalUnits,
      statuses: Array.from(entry.statuses),
      sourceRecordIds: Array.from(entry.sourceRecordIds),
    }));

  const columnTotals: Record<string, number> = {};
  let grandTotalUnits = 0;
  unifiedColumns.forEach((col) => {
    const sum = facilityRows.reduce((acc, r) => acc + (Number(r.quantities[col.id]) || 0), 0);
    columnTotals[col.id] = sum;
    grandTotalUnits += sum;
  });

  return {
    submissions,
    unifiedColumns,
    facilityRows,
    regionSummaries,
    columnTotals,
    grandTotalUnits,
    hasAnyHub,
    latestDate: latestDate || new Date().toISOString().split('T')[0],
  };
}
