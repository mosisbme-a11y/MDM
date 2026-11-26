import React, { useState, useMemo, useEffect } from 'react';
import {
  Warehouse,
  Search,
  Download,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Building2,
  BarChart3,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, MultipleStockRecord, DistributionDataRecord, ReceivingDataRecord } from '../types';
import { formatNumber } from '../utils/formatters';
import { canonicalizeSubStage, isDossierInTier } from '../data/defaultDspWorkflows';
import { getHubByCode } from '../data/epssHubs';
import { resolveCanonicalEpssDspName } from '../utils/dspDisplayUtils';

interface BranchReceivedDspViewProps {
  records: DspWorkflowRecord[];
  setRecords?: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  multipleStockItems?: MultipleStockRecord[];
  distributionRecords?: DistributionDataRecord[];
  receivingRecords?: ReceivingDataRecord[];
  mode: '4.1' | '4.2';
  onSelectSubTab?: (tab: EpssSubTab) => void;
  onTriggerCloudSync?: (
    successMsg: string,
    mutation: {
      type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELIVERY_UPDATE' | 'DELETE' | 'MAINTENANCE_LOG';
      title: string;
      payload?: any;
    }
  ) => void;
}

interface BranchColumn {
  id: string;
  name: string;
  code: string;
}

interface BranchAllocationRow {
  id: string;
  date: string;
  region: string;
  zone: string;
  woreda: string;
  healthFacility: string;
  packages: string;
  hubCode: string;
  hubName: string;
  quantities: Record<string, number>;
  totalQty: number;
}

export const BranchReceivedDspView: React.FC<BranchReceivedDspViewProps> = ({
  records,
  setRecords,
  multipleStockItems = [],
  distributionRecords = [],
  receivingRecords = [],
  mode,
  onSelectSubTab,
  onTriggerCloudSync
}) => {
  const branchRecords = useMemo(() => {
    return records
      .filter(r => {
        const sub = canonicalizeSubStage(r.subStage, r.stage);
        return isDossierInTier(r, 'branches-dsp-management') && (sub === '4.1' || sub === '4.2');
      })
      .sort((a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime());
  }, [records]);

  const [selectedDossierId, setSelectedDossierId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState('all');

  useEffect(() => {
    if (branchRecords.length > 0 && !branchRecords.some(r => r.id === selectedDossierId)) {
      setSelectedDossierId(branchRecords[0].id);
    } else if (branchRecords.length === 0 && selectedDossierId) {
      setSelectedDossierId('');
    }
  }, [branchRecords, selectedDossierId]);

  const activeDossier = useMemo(() => {
    return branchRecords.find(r => r.id === selectedDossierId) || branchRecords[0] || null;
  }, [branchRecords, selectedDossierId]);

  const canonicalDspName = useMemo(
    () => resolveCanonicalEpssDspName(records, activeDossier),
    [records, activeDossier]
  );

  // Branch Institutional Profile state
  const [branchAuthPerson, setBranchAuthPerson] = useState('');
  const [branchRole, setBranchRole] = useState('');
  const [branchOrganization, setBranchOrganization] = useState('EPSS Branch');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeDossier) {
      setBranchAuthPerson(activeDossier.authorizedPerson || activeDossier.signatory || '');
      setBranchRole(activeDossier.role || activeDossier.signatoryRole || '');
      const rawOrg = (activeDossier.organization || activeDossier.senderOrg || 'EPSS Branch').trim();
      const upperOrg = rawOrg.toUpperCase();
      setBranchOrganization(upperOrg === 'RHB' || upperOrg === 'MOH' ? 'EPSS Branch' : rawOrg);
    }
  }, [activeDossier?.id]);

  const handleSaveBranchProfile = () => {
    if (!activeDossier || !setRecords) return;
    const cleanOrg = branchOrganization.trim() || 'EPSS Branch';
    if (cleanOrg.toUpperCase() === 'RHB' || cleanOrg.toUpperCase() === 'MOH') {
      setProfileNotice('RHB and MOH Organizations are inactive in Branch Management.');
      setTimeout(() => setProfileNotice(null), 3000);
      return;
    }
    const cleanPerson = branchAuthPerson.trim();
    const cleanRole = branchRole.trim();
    const cleanDspName = canonicalDspName || activeDossier.dspName || activeDossier.dspRefNumber;

    const updatedRecord: DspWorkflowRecord = {
      ...activeDossier,
      dspName: cleanDspName,
      authorizedPerson: cleanPerson || activeDossier.authorizedPerson,
      signatory: cleanPerson || activeDossier.signatory,
      role: cleanRole || activeDossier.role,
      signatoryRole: cleanRole || activeDossier.signatoryRole,
      organization: cleanOrg,
      senderOrg: cleanOrg
    };

    setRecords(prev => prev.map(r => (r.id === activeDossier.id ? updatedRecord : r)));
    onTriggerCloudSync?.(`Updated Branch Institutional Profile for ${cleanDspName}`, {
      type: 'UPDATE',
      title: `Branch Profile Updated: ${cleanDspName}`,
      payload: updatedRecord
    });
    setProfileNotice(`✓ Saved Branch Institutional Profile (${cleanOrg}) for "${cleanDspName}"`);
    setTimeout(() => setProfileNotice(null), 3000);
  };

  const columns = useMemo<BranchColumn[]>(() => {
    if (activeDossier?.hubAggregationData?.columns?.length) {
      return activeDossier.hubAggregationData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    if (activeDossier?.facilityMatrixData?.columns?.length) {
      return activeDossier.facilityMatrixData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    if (activeDossier?.stage4MatrixData?.columns?.length) {
      return activeDossier.stage4MatrixData.columns.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
    }
    return [];
  }, [activeDossier]);

  const allocations = useMemo<BranchAllocationRow[]>(() => {
    if (activeDossier?.hubAggregationData?.allocations?.length) {
      return activeDossier.hubAggregationData.allocations.map((a: any, idx: number) => ({
        id: a.id || `br-alloc-${idx}`,
        date: activeDossier.dateSubmitted,
        region: a.region || 'Unspecified',
        zone: a.zone || '-',
        woreda: a.woreda || '-',
        healthFacility: a.healthFacility,
        packages: a.packages || 'MCH',
        hubCode: a.hubCode || 'AA01',
        hubName: a.hubName || getHubByCode(a.hubCode)?.name || a.hubCode || 'AA01',
        quantities: a.quantities || {},
        totalQty: Number(a.totalQty) || 0
      }));
    }

    const rows =
      activeDossier?.facilityMatrixData?.rows ||
      activeDossier?.stage4MatrixData?.rows ||
      [];

    return rows.map((r: any, idx: number) => {
      const hubCode = r.hub || r.plant || 'AA01';
      const hubInfo = getHubByCode(hubCode);
      const quantities: Record<string, number> = r.quantities || {};
      const totalQty = columns.reduce((s, c) => s + (Number(quantities[c.id]) || 0), 0);
      return {
        id: r.id || `br-row-${idx}`,
        date: r.date || activeDossier?.dateSubmitted || '',
        region: r.region || 'Unspecified',
        zone: r.zone || '-',
        woreda: r.woreda || '-',
        healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
        packages: r.packages || 'MCH',
        hubCode,
        hubName: hubInfo?.name || hubCode,
        quantities,
        totalQty
      };
    });
  }, [activeDossier, columns]);

  const uniqueHubs = useMemo(() => {
    const map = new Map<string, string>();
    allocations.forEach(a => {
      if (a.hubCode) map.set(a.hubCode, a.hubName || a.hubCode);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allocations.filter(a => {
      const matchHub = selectedHubFilter === 'all' || a.hubCode === selectedHubFilter;
      const matchSearch =
        !q ||
        a.healthFacility.toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q) ||
        a.zone.toLowerCase().includes(q) ||
        a.woreda.toLowerCase().includes(q) ||
        a.hubCode.toLowerCase().includes(q) ||
        a.hubName.toLowerCase().includes(q);
      return matchHub && matchSearch;
    });
  }, [allocations, selectedHubFilter, searchQuery]);

  // 4.2 Comparison rows: DSP data by Material Code, Material Description, Quantity, Delivery Amount, WBS Element, Package, Remaining Quantity, Status
  const comparisonRows = useMemo(() => {
    if (mode !== '4.2' || !activeDossier) return [];

    // 1. Build WBS Element lookup across active dossier, upstream dossiers, distribution, receiving, and stock
    const wbsByMaterial = new Map<string, string>();
    const setWbsIfEmpty = (matRaw: string | undefined, wbsRaw: string | undefined) => {
      const m = (matRaw || '').trim().toUpperCase();
      const w = (wbsRaw || '').trim();
      if (m && w && w !== '-' && !wbsByMaterial.has(m)) {
        wbsByMaterial.set(m, w);
      }
    };

    // Priority 1: Active dossier itemsIncluded & exactRows
    activeDossier.itemsIncluded?.forEach(it => setWbsIfEmpty(it.material, it.wbsElement));
    activeDossier.exactRows?.forEach(r => setWbsIfEmpty(String(r['Material'] || r['Material Code'] || ''), String(r['WBS Element'] || '')));

    // Priority 2: Upstream dossiers (same DSP Name first, then any dossier)
    const cleanCanon = (canonicalDspName || '').trim().toLowerCase();
    const sortedUpstream = [...records].sort((a, b) => {
      const aMatch = cleanCanon && (a.dspName || '').trim().toLowerCase() === cleanCanon ? 1 : 0;
      const bMatch = cleanCanon && (b.dspName || '').trim().toLowerCase() === cleanCanon ? 1 : 0;
      return bMatch - aMatch;
    });
    sortedUpstream.forEach(rec => {
      rec.itemsIncluded?.forEach(it => setWbsIfEmpty(it.material, it.wbsElement));
      rec.exactRows?.forEach(r => setWbsIfEmpty(String(r['Material'] || r['Material Code'] || ''), String(r['WBS Element'] || '')));
    });

    // Priority 3: Distribution, Receiving, MultipleStock
    distributionRecords.forEach(d => setWbsIfEmpty(d.materialCode, d.wbsElementDescr));
    receivingRecords.forEach(r => setWbsIfEmpty(r.material, r.wbsElement));
    multipleStockItems.forEach(s => setWbsIfEmpty(s.material, s.wbsElement));

    // 2. Group DSP allocations by material (across filtered allocations respecting hub & search filters)
    const grouped = new Map<
      string,
      {
        materialCode: string;
        materialDescription: string;
        quantity: number;
        packages: Set<string>;
        hubCodes: Set<string>;
        facilityNames: Set<string>;
      }
    >();

    filteredAllocations.forEach(a => {
      columns.forEach(col => {
        const qty = Number(a.quantities[col.id]) || 0;
        if (qty <= 0) return;
        const matKey = (col.code || col.name || col.id).trim().toUpperCase();
        const existing = grouped.get(matKey);
        if (existing) {
          existing.quantity += qty;
          if (a.packages && a.packages.trim()) existing.packages.add(a.packages.trim());
          if (a.hubCode && a.hubCode.trim()) existing.hubCodes.add(a.hubCode.trim().toUpperCase());
          if (a.healthFacility && a.healthFacility.trim()) existing.facilityNames.add(a.healthFacility.trim().toLowerCase());
        } else {
          const pkgSet = new Set<string>();
          if (a.packages && a.packages.trim()) pkgSet.add(a.packages.trim());
          const hubSet = new Set<string>();
          if (a.hubCode && a.hubCode.trim()) hubSet.add(a.hubCode.trim().toUpperCase());
          const facSet = new Set<string>();
          if (a.healthFacility && a.healthFacility.trim()) facSet.add(a.healthFacility.trim().toLowerCase());
          grouped.set(matKey, {
            materialCode: col.code || '-',
            materialDescription: col.name || '-',
            quantity: qty,
            packages: pkgSet,
            hubCodes: hubSet,
            facilityNames: facSet
          });
        }
      });
    });

    // Fallback: if no matrix columns/allocations exist, derive from activeDossier.itemsIncluded
    if (grouped.size === 0 && activeDossier.itemsIncluded?.length) {
      activeDossier.itemsIncluded.forEach((it, idx) => {
        const matCode = (it.material || `ITEM-${idx + 1}`).trim();
        const matKey = matCode.toUpperCase();
        const qty = Number(it.quantity ?? it.qty) || 0;
        if (qty <= 0 && !it.description) return;
        const hubSet = new Set<string>();
        if (it.plant) {
          it.plant.split(',').map(p => p.trim().toUpperCase()).filter(Boolean).forEach(p => hubSet.add(p));
        }
        const existing = grouped.get(matKey);
        if (existing) {
          existing.quantity += qty;
          hubSet.forEach(h => existing.hubCodes.add(h));
        } else {
          grouped.set(matKey, {
            materialCode: matCode,
            materialDescription: it.description || it.materialDescription || '-',
            quantity: qty,
            packages: new Set<string>(),
            hubCodes: hubSet,
            facilityNames: new Set<string>()
          });
        }
      });
    }

    // 3. Match Delivery Amount from DistributionDataRecord[] for each DSP material
    return Array.from(grouped.values()).map((row, idx) => {
      const matUpper = row.materialCode.trim().toUpperCase();
      const descLower = row.materialDescription.trim().toLowerCase();

      const matchingDeliveries = distributionRecords.filter(d => {
        const dMat = (d.materialCode || '').trim().toUpperCase();
        const dDesc = (d.materialDescr || '').trim().toLowerCase();
        const matMatch = (matUpper && dMat === matUpper) || (!dMat && descLower && dDesc === descLower);
        if (!matMatch) return false;

        if (selectedHubFilter !== 'all') {
          return (d.plant || '').trim().toUpperCase() === selectedHubFilter.trim().toUpperCase();
        }
        if (row.hubCodes.size > 0) {
          const dPlant = (d.plant || '').trim().toUpperCase();
          const dCust = (d.customerName || '').trim().toLowerCase();
          return row.hubCodes.has(dPlant) || (dCust !== '' && row.facilityNames.has(dCust));
        }
        return true;
      });

      const deliveryAmount = matchingDeliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
      const remainingQuantity = Math.max(0, row.quantity - deliveryAmount);
      const status: 'Delivered' | 'Partial' | 'Pending' =
        row.quantity > 0 && deliveryAmount >= row.quantity
          ? 'Delivered'
          : deliveryAmount > 0
            ? 'Partial'
            : 'Pending';

      const wbsElement = wbsByMaterial.get(matUpper) || '-';
      const packageLabel = row.packages.size > 0 ? Array.from(row.packages).join(', ') : '-';

      return {
        id: `cmp-${idx}-${row.materialCode}`,
        materialCode: row.materialCode,
        materialDescription: row.materialDescription,
        quantity: row.quantity,
        deliveryAmount,
        wbsElement,
        packageLabel,
        remainingQuantity,
        status
      };
    });
  }, [
    mode,
    activeDossier,
    filteredAllocations,
    columns,
    records,
    canonicalDspName,
    distributionRecords,
    receivingRecords,
    multipleStockItems,
    selectedHubFilter
  ]);

  const handleExportExcel = () => {
    if (!activeDossier) return;
    if (mode === '4.1') {
      const row1 = [
        'S/N',
        'Date',
        'Region',
        'Zone',
        'Woreda',
        'Name of health facility',
        'Hub',
        'List of Packages',
        ...columns.map(c => c.name),
        'Total'
      ];
      const row2 = [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'List of Packages',
        ...columns.map(c => c.code),
        ''
      ];
      const body = filteredAllocations.map((a, idx) => [
        idx + 1,
        a.date || activeDossier.dateSubmitted,
        a.region,
        a.zone,
        a.woreda,
        a.healthFacility,
        `${a.hubName} (${a.hubCode})`,
        a.packages,
        ...columns.map(c => Number(a.quantities[c.id]) || 0),
        a.totalQty
      ]);
      const ws = XLSX.utils.aoa_to_sheet([row1, row2, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Branch_Received_DSP');
      XLSX.writeFile(wb, `Branch_4_1_Received_DSP_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const exportData = comparisonRows.map((r, idx) => ({
      'S/N': idx + 1,
      'Material Code': r.materialCode,
      'Material Description': r.materialDescription,
      'Quantity': r.quantity,
      'Delivery Amount': r.deliveryAmount,
      'WBS Element': r.wbsElement,
      'Package': r.packageLabel,
      'Remaining Quantity': r.remainingQuantity,
      'Status': r.status
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis_Compare_With_DSP');
    XLSX.writeFile(wb, `Branch_4_2_Analysis_Compare_With_DSP_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (branchRecords.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-sm font-black text-slate-800 uppercase">
          {mode === '4.1' ? '4.1 Received DSP — No Dispatched Dossiers Yet' : '4.2 Analysis & Compare with DSP — No Dispatched Dossiers Yet'}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Dispatch a mapped Health Facility Allocation Matrix from EPSS Head Office (Sub-step 1.3.2 Send DSP to Hub) so regional branches receive the exact dispatched DSP.
        </p>
        <button
          type="button"
          onClick={() => onSelectSubTab?.('dsp-ho-1-3-2')}
          className="px-4 py-2.5 rounded-xl bg-[#0B1527] hover:bg-slate-800 text-amber-300 text-xs font-black uppercase cursor-pointer inline-flex items-center gap-2"
        >
          <span>Go to 1.3.2 Send DSP to Hub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm">
            {mode === '4.1' ? <Warehouse className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-50 text-purple-800 border border-purple-200">
                4. Branches DSP Management • {mode}
              </span>
              <h3 className="text-sm md:text-base font-black text-slate-900 uppercase">
                {mode === '4.1' ? '4.1 Branch Received DSP (From EPSS Head Office)' : '4.2 Branch SOH Analysis & Compare with DSP'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Exact Dispatched Data
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {canonicalDspName || activeDossier?.dspName || activeDossier?.dspRefNumber} • Dispatched: {activeDossier?.dateSubmitted}
              {(activeDossier?.authorizedPerson || activeDossier?.signatory) && (
                <> • Authorized: <strong className="text-slate-700">{activeDossier?.authorizedPerson || activeDossier?.signatory}</strong></>
              )}
              {(activeDossier?.role || activeDossier?.signatoryRole) && (
                <> ({activeDossier?.role || activeDossier?.signatoryRole})</>
              )}
              {(activeDossier?.organization || activeDossier?.senderOrg) && (
                <> • Org: <strong className="text-slate-700">{activeDossier?.organization || activeDossier?.senderOrg}</strong></>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {mode === '4.1' ? (
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-branches-4-2')}
              className="px-4 py-2 rounded-xl bg-[#0B1527] hover:bg-slate-800 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <span>Proceed to 4.2 Analysis &amp; Compare</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectSubTab?.('dsp-branches-4-1')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black cursor-pointer"
            >
              Back to 4.1 Received DSP
            </button>
          )}
        </div>
      </div>

      {/* Branch Institutional Profile & Auto-Displayed EPSS DSP Name */}
      <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Branch Institutional Profile &amp; DSP Project Name
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Organization:</span>
            {['EPSS Branch', 'EPSS', 'RHB', 'MOH'].map(preset => {
              const isInactive = preset === 'RHB' || preset === 'MOH';
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={isInactive}
                  title={isInactive ? `${preset} Organization is inactive in Branch Management` : undefined}
                  onClick={() => !isInactive && setBranchOrganization(preset)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                    isInactive
                      ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-45 cursor-not-allowed line-through'
                      : branchOrganization === preset
                      ? 'bg-purple-700 text-white border-purple-700 cursor-pointer'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300 cursor-pointer'
                  }`}
                >
                  {preset}{isInactive ? ' (Inactive)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {profileNotice && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            {profileNotice}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              DSP Project Name (From EPSS)
            </label>
            <input
              type="text"
              readOnly
              value={canonicalDspName || activeDossier?.dspName || activeDossier?.dspRefNumber || ''}
              className="w-full bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2 text-xs font-black text-slate-900 cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Authorized person
            </label>
            <input
              type="text"
              placeholder="Enter Authorized person..."
              value={branchAuthPerson}
              onChange={(e) => setBranchAuthPerson(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Role
            </label>
            <input
              type="text"
              placeholder="Enter Role..."
              value={branchRole}
              onChange={(e) => setBranchRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Organization
            </label>
            <input
              type="text"
              placeholder="EPSS Branch..."
              value={branchOrganization}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim().toUpperCase() === 'RHB' || v.trim().toUpperCase() === 'MOH') return;
                setBranchOrganization(v);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={handleSaveBranchProfile}
              disabled={!setRecords || !activeDossier}
              className="w-full px-3.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black transition cursor-pointer"
            >
              Save Branch Profile
            </button>
          </div>
        </div>
      </div>

      {/* Received from HO EPSS Dossier Table */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Received from HO EPSS Dossiers ({branchRecords.length})
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Select Dossier to Proceed Analysis
            </span>
          </div>
        </div>
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-left border-collapse text-xs border border-slate-900">
            <thead>
              <tr className="bg-white text-slate-950 font-bold italic text-xs select-none">
                <th className="py-2 px-3 border border-slate-900 w-14">S/N</th>
                <th className="py-2 px-3 border border-slate-900 min-w-[105px]">Date</th>
                <th className="py-2 px-3 border border-slate-900 min-w-[200px]">DSP Name</th>
                <th className="py-2 px-3 border border-slate-900 min-w-[150px]">Authorized person</th>
                <th className="py-2 px-3 border border-slate-900 min-w-[140px]">Role</th>
                <th className="py-2 px-3 border border-slate-900 w-24">View</th>
                <th className="py-2 px-3 border border-slate-900 min-w-[150px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {branchRecords.map((r, idx) => {
                const isSelected = activeDossier?.id === r.id;

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedDossierId(r.id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-amber-50/80' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-3 border border-slate-900 font-semibold text-slate-900">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border border-slate-900 font-mono text-slate-800 whitespace-nowrap">
                      {r.dateSubmitted || '-'}
                    </td>
                    <td className="py-2 px-3 border border-slate-900 font-bold text-slate-950">
                      {resolveCanonicalEpssDspName(records, r) || r.dspName || r.subject || r.dspRefNumber}
                    </td>
                    <td className="py-2 px-3 border border-slate-900 text-slate-900 font-medium">
                      {r.authorizedPerson || r.signatory || '-'}
                    </td>
                    <td className="py-2 px-3 border border-slate-900 text-slate-800">
                      {r.role || r.signatoryRole || '-'}
                    </td>
                    <td className="py-2 px-3 border border-slate-900">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDossierId(r.id);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 hover:bg-black text-white'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'View'}
                      </button>
                    </td>
                    <td className="py-2 px-3 border border-slate-900">
                      {mode === '4.1' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDossierId(r.id);
                            onSelectSubTab?.('dsp-branches-4-2');
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>Proceed Analysis</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDossierId(r.id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 text-[10px] font-bold uppercase cursor-pointer transition"
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters & Dossier Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

          <select
            value={selectedHubFilter}
            onChange={(e) => setSelectedHubFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer"
          >
            <option value="all">All Dispatched Hubs ({uniqueHubs.length})</option>
            {uniqueHubs.map(h => (
              <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, hub, region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="text-xs font-mono text-slate-600">
          {filteredAllocations.length} Facilities • {formatNumber(filteredAllocations.reduce((s, a) => s + a.totalQty, 0))} Units
        </div>
      </div>

      {/* Mode 4.1: Exact Dispatched Matrix */}
      {mode === '4.1' ? (
        <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="font-bold">
                  <th className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2.5 text-center w-10">S/N</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Date</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Region</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Zone</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3">Woreda</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[200px]">Name of health facility</th>
                  <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[160px]">Hub / Plant</th>
                  <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-2 px-3 text-center">List of Packages</th>
                  {columns.map(col => (
                    <th key={col.id} className="bg-[#fed7aa] text-slate-900 border border-slate-400 py-2 px-2 text-center min-w-[130px] font-semibold">
                      {col.name}
                    </th>
                  ))}
                  <th className="bg-[#fde047] text-slate-900 font-black border border-slate-400 py-2 px-3 text-center">Total</th>
                </tr>
                <tr className="text-[10px]">
                  <th className="bg-[#fed7aa] border border-slate-400 py-1 px-2" colSpan={7}></th>
                  <th className="bg-[#dbeafe] text-slate-800 italic border border-slate-400 py-1 px-2 text-center font-normal">List of Packages</th>
                  {columns.map(col => (
                    <th key={`c-${col.id}`} className="bg-white text-slate-800 font-mono border border-slate-400 py-1 px-2 text-center font-bold">
                      {col.code}
                    </th>
                  ))}
                  <th className="bg-[#fde047] border border-slate-400 py-1 px-2 text-center font-mono">Units</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    <td className="py-2 px-2.5 border border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border border-slate-300 font-mono text-slate-600">{row.date}</td>
                    <td className="py-2 px-3 border border-slate-300 font-semibold text-slate-900">{row.region}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{row.zone}</td>
                    <td className="py-2 px-3 border border-slate-300 font-mono text-[11px]">{row.woreda}</td>
                    <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">{row.healthFacility}</td>
                    <td className="py-2 px-3 border border-slate-300 font-bold text-amber-900 bg-amber-50/40">
                      {row.hubName} ({row.hubCode})
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-center font-semibold bg-[#eff6ff]">{row.packages}</td>
                    {columns.map(col => (
                      <td key={`${row.id}-${col.id}`} className="py-2 px-2 border border-slate-300 text-center font-mono font-bold">
                        {Number(row.quantities[col.id]) || 0}
                      </td>
                    ))}
                    <td className="py-2 px-3 border border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/60">
                      {formatNumber(row.totalQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td colSpan={8} className="py-3 px-4 text-right uppercase text-amber-400 font-mono">
                    TOTAL ({filteredAllocations.length} Facilities):
                  </td>
                  {columns.map(col => (
                    <td key={`tot-${col.id}`} className="py-3 px-2 text-center font-mono text-amber-300 border-r border-slate-700">
                      {formatNumber(filteredAllocations.reduce((s, r) => s + (Number(r.quantities[col.id]) || 0), 0))}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center font-mono text-emerald-400 bg-slate-950">
                    {formatNumber(filteredAllocations.reduce((s, r) => s + r.totalQty, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Mode 4.2: Analysis & Compare with DSP */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">DSP Materials</div>
                <div className="text-xl font-black text-slate-900 font-mono">{comparisonRows.length}</div>
              </div>
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Total Quantity</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {formatNumber(comparisonRows.reduce((s, r) => s + r.quantity, 0))}
                </div>
              </div>
              <Building2 className="w-5 h-5 text-cyan-600" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Delivery Amount</div>
                <div className="text-xl font-black text-emerald-600 font-mono">
                  {formatNumber(comparisonRows.reduce((s, r) => s + r.deliveryAmount, 0))}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Remaining Quantity</div>
                <div className="text-xl font-black text-amber-600 font-mono">
                  {formatNumber(comparisonRows.reduce((s, r) => s + r.remainingQuantity, 0))}
                </div>
              </div>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="bg-white border border-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white text-slate-950 font-bold italic text-xs select-none">
                    <th className="py-2 px-3 border border-slate-900 w-14">S/N</th>
                    <th className="py-2 px-3 border border-slate-900 min-w-[120px]">Material Code</th>
                    <th className="py-2 px-3 border border-slate-900 min-w-[220px]">Material Description</th>
                    <th className="py-2 px-3 border border-slate-900 text-right min-w-[100px]">Quantity</th>
                    <th className="py-2 px-3 border border-slate-900 text-right min-w-[125px]">Delivery Amount</th>
                    <th className="py-2 px-3 border border-slate-900 min-w-[140px]">WBS Element</th>
                    <th className="py-2 px-3 border border-slate-900 min-w-[110px]">Package</th>
                    <th className="py-2 px-3 border border-slate-900 text-right min-w-[135px]">Remaining Quantity</th>
                    <th className="py-2 px-3 border border-slate-900 text-center min-w-[110px]">Status</th>
                  </tr>
                </thead>
                <tbody className="text-slate-900 bg-white">
                  {comparisonRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-2 px-3 border border-slate-900 font-semibold text-slate-900">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 font-mono font-bold text-slate-900">
                        {row.materialCode}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 font-medium text-slate-900">
                        {row.materialDescription}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 text-right font-mono font-bold text-slate-950">
                        {formatNumber(row.quantity)}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 text-right font-mono font-bold text-emerald-700">
                        {formatNumber(row.deliveryAmount)}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 font-mono text-slate-800">
                        {row.wbsElement}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 text-slate-900 font-medium">
                        {row.packageLabel}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 text-right font-mono font-bold text-amber-800">
                        {formatNumber(row.remainingQuantity)}
                      </td>
                      <td className="py-2 px-3 border border-slate-900 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          row.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : row.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {comparisonRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center border border-slate-900 text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No DSP material data matches the selected dossier or filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {comparisonRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs">
                      <td colSpan={3} className="py-2.5 px-3 border border-slate-900 text-right uppercase text-amber-400 font-mono">
                        TOTAL ({comparisonRows.length} Materials):
                      </td>
                      <td className="py-2.5 px-3 border border-slate-900 text-right font-mono text-white">
                        {formatNumber(comparisonRows.reduce((s, r) => s + r.quantity, 0))}
                      </td>
                      <td className="py-2.5 px-3 border border-slate-900 text-right font-mono text-emerald-400">
                        {formatNumber(comparisonRows.reduce((s, r) => s + r.deliveryAmount, 0))}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 border border-slate-900"></td>
                      <td className="py-2.5 px-3 border border-slate-900 text-right font-mono text-amber-300">
                        {formatNumber(comparisonRows.reduce((s, r) => s + r.remainingQuantity, 0))}
                      </td>
                      <td className="py-2.5 px-3 border border-slate-900"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
