import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Mail,
  MessageCircle,
  CheckCircle2,
  Search,
  Send,
  Warehouse,
  Table,
  ArrowRight,
  UserCheck,
  Briefcase,
  Building2,
  ShieldCheck,
  X,
  AlertCircle,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DspWorkflowRecord, EpssSubTab, HealthFacilityRecord } from '../types';
import { EPSS_HUBS_REGISTRY, getHubByCode } from '../data/epssHubs';
import { canonicalizeSubStage, isDossierInTier } from '../data/defaultDspWorkflows';

interface Stage6EpssBranchDispatchViewProps {
  records: DspWorkflowRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DspWorkflowRecord[]>>;
  hfListItems: HealthFacilityRecord[];
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

export const Stage6EpssBranchDispatchView: React.FC<Stage6EpssBranchDispatchViewProps> = ({
  records,
  setRecords,
  onSelectSubTab,
  onTriggerCloudSync
}) => {
  // Strictly isolated to Head Office DSP Management (1.3.1-1.3.4 mapped dossiers)
  const stage5Records = useMemo(() => {
    return records.filter(r => {
      if (!isDossierInTier(r, 'head-office-dsp')) return false;
      const sub = canonicalizeSubStage(r.subStage, r.stage);
      const hasHubData =
        Boolean(r.hubAggregationData?.allocations?.length) ||
        Boolean(r.stage4MatrixData?.rows?.length) ||
        Boolean(r.facilityMatrixData?.rows?.length);
      return hasHubData && (sub === '1.3.1' || sub === '1.3.3' || sub === '1.3.4');
    });
  }, [records]);

  const [selectedDossierId, setSelectedDossierId] = useState<string>('');

  useEffect(() => {
    if (stage5Records.length > 0 && !stage5Records.some(r => r.id === selectedDossierId)) {
      setSelectedDossierId(stage5Records[0].id);
    }
  }, [stage5Records, selectedDossierId]);

  const currentDossier = useMemo(() => {
    return stage5Records.find(r => r.id === selectedDossierId) || stage5Records[0] || null;
  }, [stage5Records, selectedDossierId]);

  // Send to Branch authorization & transmittal fields
  const [isSendToBranchModalOpen, setIsSendToBranchModalOpen] = useState(false);
  const [authorizedPerson, setAuthorizedPerson] = useState('');
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [customDspName, setCustomDspName] = useState('');
  const [officialLetterRef, setOfficialLetterRef] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (currentDossier) {
      setCustomDspName(currentDossier.dspName || currentDossier.dspRefNumber || '');
      if (currentDossier.officialLetterRef && !officialLetterRef) {
        setOfficialLetterRef(currentDossier.officialLetterRef);
      }
    }
  }, [currentDossier?.id]);

  // Equipment columns
  const equipmentColumns = useMemo(() => {
    if (currentDossier?.hubAggregationData?.columns && currentDossier.hubAggregationData.columns.length > 0) {
      return currentDossier.hubAggregationData.columns;
    }
    if (currentDossier?.stage4MatrixData?.columns && currentDossier.stage4MatrixData.columns.length > 0) {
      return currentDossier.stage4MatrixData.columns;
    }
    if (currentDossier?.facilityMatrixData?.columns && currentDossier.facilityMatrixData.columns.length > 0) {
      return currentDossier.facilityMatrixData.columns;
    }
    return [];
  }, [currentDossier]);

  // Exact allocations list (zero hardcoded qty fallbacks)
  const allocations = useMemo(() => {
    if (currentDossier?.hubAggregationData?.allocations && currentDossier.hubAggregationData.allocations.length > 0) {
      return currentDossier.hubAggregationData.allocations;
    }
    const sourceRows =
      currentDossier?.facilityMatrixData?.rows ||
      currentDossier?.stage4MatrixData?.rows ||
      [];
    return sourceRows.map((r: any, idx: number) => {
      const code = r.hub || r.hubCode || r.plant || 'AA01';
      const match = getHubByCode(code) || EPSS_HUBS_REGISTRY[0];
      const quantities = r.quantities || {};
      const totalQty = Object.values(quantities).reduce(
        (acc: number, val: any) => acc + (Number(val) || 0),
        0
      ) as number;
      return {
        id: r.id || `alloc-s6-${idx}`,
        date: r.date || currentDossier?.dateSubmitted || new Date().toISOString().split('T')[0],
        healthFacility: r.healthFacility || r.customerDescription || 'Health Facility',
        region: r.region || 'Unspecified',
        zone: r.zone || '-',
        woreda: r.woreda || '-',
        packages: r.packages || 'MCH',
        hubCode: match.code,
        hubName: match.name,
        matchMethod: 'exact-master' as const,
        matchConfidence: 100,
        quantities,
        totalQty
      };
    });
  }, [currentDossier]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const filteredAllocations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allocations.filter((item: any) => {
      const matchesSearch =
        !q ||
        (item.healthFacility || '').toLowerCase().includes(q) ||
        (item.zone || '').toLowerCase().includes(q) ||
        (item.woreda || '').toLowerCase().includes(q) ||
        (item.hubName || '').toLowerCase().includes(q) ||
        (item.hubCode || '').toLowerCase().includes(q) ||
        (item.region || '').toLowerCase().includes(q);
      const matchesHub = selectedHubFilter === 'all' || item.hubCode === selectedHubFilter;
      return matchesSearch && matchesHub;
    });
  }, [allocations, searchQuery, selectedHubFilter]);

  const hubsSet = useMemo(
    () => Array.from(new Set<string>(filteredAllocations.map((a: any) => String(a.hubCode || '')).filter(Boolean))),
    [filteredAllocations]
  );
  const regionsSet = useMemo(
    () => Array.from(new Set<string>(filteredAllocations.map((a: any) => String(a.region || '')).filter(Boolean))),
    [filteredAllocations]
  );
  const totalFilteredUnits = useMemo(
    () => filteredAllocations.reduce((sum: number, a: any) => sum + (Number(a.totalQty) || 0), 0),
    [filteredAllocations]
  );

  // Open Send to Branch modal
  const handleOpenSendToBranchModal = () => {
    if (!currentDossier || filteredAllocations.length === 0) {
      setNotification({ type: 'warning', message: 'No mapped facility allocations to send to branch.' });
      setTimeout(() => setNotification(null), 3500);
      return;
    }
    setFormError(null);
    setIsSendToBranchModalOpen(true);
  };

  // Dispatch exact mapped allocations to Branches (Sub-step 4.1 Received DSP)
  const handleConfirmSendToBranch = () => {
    if (!currentDossier || filteredAllocations.length === 0) {
      setFormError('No mapped facility allocations available to send to branch.');
      return;
    }

    const cleanAuthorizedPerson = authorizedPerson.trim();
    const cleanRole = role.trim();
    const cleanOrganization = organization.trim();

    if (!cleanAuthorizedPerson || !cleanRole || !cleanOrganization) {
      setFormError('Please fill in Authorized person, Role, and Organization before sending to Branch.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const totalUnits = totalFilteredUnits;
    const refNum = `EPSS/BR-DSP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;
    const baseDspName = customDspName.trim() || currentDossier.dspName || currentDossier.dspRefNumber;
    const cleanLetterRef = officialLetterRef.trim() || `EPSS/HO-BR/${Date.now().toString().slice(-4)}`;
    const cleanNotes = dispatchNotes.trim();

    const branchRecord: DspWorkflowRecord = {
      id: `dsp-branch-4-1-${Date.now()}`,
      dspRefNumber: refNum,
      dspName: `${baseDspName}${selectedHubFilter === 'all' ? '' : ` (${selectedHubFilter})`}`,
      stage: 'branches-dsp-management',
      subStage: '4.1',
      stageTitle: 'Branches DSP Management',
      senderOrg: cleanOrganization,
      organization: cleanOrganization,
      recipientOrg: selectedHubFilter === 'all'
        ? `EPSS Branches (${hubsSet.join(', ')})`
        : `EPSS Branch ${selectedHubFilter}`,
      subject: `Sent DSP to Branch (${filteredAllocations.length} Facilities, ${totalUnits} Units)`,
      status: 'Dispatched to Plants',
      dateSubmitted: today,
      totalDevices: equipmentColumns.length,
      totalQuantity: totalUnits,
      totalValuationETB: currentDossier.totalValuationETB || 0,
      targetedRegions: regionsSet,
      targetedFacilitiesCount: filteredAllocations.length,
      officialLetterRef: cleanLetterRef,
      signatory: cleanAuthorizedPerson,
      authorizedPerson: cleanAuthorizedPerson,
      signatoryRole: cleanRole,
      role: cleanRole,
      itemsIncluded: equipmentColumns.map((col: any) => ({
        material: col.code,
        description: col.name,
        quantity: filteredAllocations.reduce(
          (sum: number, a: any) => sum + (Number(a.quantities?.[col.id]) || 0),
          0
        ),
        plant: selectedHubFilter === 'all' ? hubsSet.join(', ') : selectedHubFilter
      })),
      facilityMatrixData: {
        date: today,
        region: regionsSet.length === 1 ? regionsSet[0] : 'All Regions',
        columns: equipmentColumns.map((c: any) => ({ id: c.id, name: c.name, code: c.code })),
        rows: filteredAllocations.map((a: any, idx: number) => ({
          id: a.id || `br-row-${idx}`,
          date: a.date || today,
          region: a.region,
          zone: a.zone,
          woreda: a.woreda,
          healthFacility: a.healthFacility,
          packages: a.packages,
          hub: a.hubCode,
          quantities: { ...(a.quantities || {}) }
        }))
      },
      hubAggregationData: {
        dossierId: currentDossier.id,
        dspRefNumber: refNum,
        generatedDate: today,
        status: 'Dispatched to Plants',
        mappedFromMapHfToHub: true,
        columns: equipmentColumns.map((c: any) => ({ id: c.id, name: c.name, code: c.code })),
        allocations: filteredAllocations.map((a: any) => ({
          id: a.id,
          healthFacility: a.healthFacility,
          region: a.region,
          zone: a.zone,
          woreda: a.woreda,
          packages: a.packages,
          hubCode: a.hubCode,
          hubName: a.hubName,
          matchMethod: a.matchMethod || 'exact-master',
          matchConfidence: a.matchConfidence || 100,
          quantities: { ...(a.quantities || {}) },
          totalQty: Number(a.totalQty) || 0
        }))
      },
      notes: `${cleanNotes ? `${cleanNotes} — ` : ''}Sent to Branch by ${cleanAuthorizedPerson} (${cleanRole}, ${cleanOrganization}) from 1.3.2 Send DSP to Hub to Branches (4.1). Source: ${currentDossier.dspRefNumber}.`
    };

    setRecords(prev => [branchRecord, ...prev]);

    onTriggerCloudSync?.(
      `Sent DSP ${refNum} (${filteredAllocations.length} facilities, ${totalUnits} units) to Branch (4.1) by ${cleanAuthorizedPerson}`,
      {
        type: 'CREATE',
        title: `Send to Branch: ${baseDspName} (${refNum})`,
        payload: branchRecord
      }
    );

    setIsSendToBranchModalOpen(false);
    setFormError(null);
    setNotification({
      type: 'success',
      message: `✓ Sent "${baseDspName}" (${filteredAllocations.length} facilities, ${totalUnits} units) to Branch (4.1 Received DSP) — Authorized by ${cleanAuthorizedPerson} (${cleanRole}, ${cleanOrganization})!`
    });
    setTimeout(() => {
      setNotification(null);
      onSelectSubTab?.('dsp-branches-4-1');
    }, 900);
  };

  // Export Excel
  const handleExportExcel = () => {
    const row1 = [
      'Region',
      'Zone',
      'Woreda',
      'Name of health facility',
      'Hub',
      'List of Packages',
      ...equipmentColumns.map((c: any) => c.name),
      'Total'
    ];
    const row2 = [
      '',
      '',
      '',
      '',
      '',
      'List of Packages',
      ...equipmentColumns.map((c: any) => c.code),
      ''
    ];
    const dataRows = filteredAllocations.map((item: any) => [
      item.region,
      item.zone,
      item.woreda,
      item.healthFacility,
      `${item.hubName} (${item.hubCode})`,
      item.packages,
      ...equipmentColumns.map((c: any) => item.quantities[c.id] || 0),
      item.totalQty
    ]);

    const ws = XLSX.utils.aoa_to_sheet([row1, row2, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'EPSS_Branch_Dispatch');
    XLSX.writeFile(wb, `EPSS_Branch_Dispatched_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`);

    setNotification({
      type: 'success',
      message: 'Exported EPSS Branch Dispatched Matrix (.xlsx) successfully!'
    });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDispatchEmail = () => {
    const dspTitle = customDspName.trim() || currentDossier?.dspName || currentDossier?.dspRefNumber || 'DSP Breakdown';
    const subject = `Send to Branch: ${dspTitle} (${filteredAllocations.length} Health Facilities)`;
    const authLine = authorizedPerson.trim() ? `\nAuthorized Person: ${authorizedPerson.trim()}` : '';
    const roleLine = role.trim() ? `\nRole: ${role.trim()}` : '';
    const orgLine = organization.trim() ? `\nOrganization: ${organization.trim()}` : '';
    const letterLine = officialLetterRef.trim() ? `\nOfficial Letter Ref: ${officialLetterRef.trim()}` : '';
    const body = `Dear EPSS Regional Branch Management,\n\nPlease find the official Hub-Mapped Equipment Breakdown Matrix dispatched to Branch.\n\nDSP Name: ${dspTitle}${letterLine}\nTotal Facilities: ${filteredAllocations.length}\nTotal Units: ${totalFilteredUnits.toLocaleString()}${authLine}${roleLine}${orgLine}\n\n${organization.trim() || 'EPSS Head Office Logistics'}`;
    const link = document.createElement('a');
    link.href = `mailto:branches@epss.gov.et?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    link.click();
    setNotification({ type: 'success', message: 'Opened email client for branch dispatch!' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDispatchWhatsApp = () => {
    const dspTitle = customDspName.trim() || currentDossier?.dspName || currentDossier?.dspRefNumber || 'DSP Breakdown';
    const authParts = [
      authorizedPerson.trim() ? `• *Authorized Person:* ${authorizedPerson.trim()}` : '',
      role.trim() ? `• *Role:* ${role.trim()}` : '',
      organization.trim() ? `• *Organization:* ${organization.trim()}` : ''
    ].filter(Boolean).join('\n');
    const text = `*Send to Branch — ${dspTitle}*\n• *Facilities:* ${filteredAllocations.length}\n• *Total Units:* ${totalFilteredUnits.toLocaleString()}${authParts ? `\n${authParts}` : ''}`;
    const link = document.createElement('a');
    link.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    setNotification({ type: 'success', message: 'Opened WhatsApp for branch dispatch!' });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-4">
      {notification && (
        <div className={`p-3 rounded-xl flex items-center justify-between shadow-sm border ${
          notification.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className={`w-4 h-4 ${notification.type === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} className="font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-rose-800/40 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-lg">1.3.2 Send DSP to Hub (EPSS HO ➔ Branches)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                  1-to-1 Hub Mapped Matrix
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Fill Authorized person, Role &amp; Organization and send exact hub-mapped facility allocations directly to EPSS Branches (4.1).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSendToBranchModal}
              disabled={filteredAllocations.length === 0}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to Branch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredAllocations.length === 0}
              className="px-3.5 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handleDispatchEmail}
              disabled={filteredAllocations.length === 0}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={handleDispatchWhatsApp}
              disabled={filteredAllocations.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Send to Branch Authorization & Metadata Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Send to Branch — Authorized Person, Role &amp; Organization
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Quick Org:</span>
            {['EPSS Head Office', 'EPSS', 'MOH'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setOrganization(preset)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                  organization === preset
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-300'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>DSP Name</span>
            </label>
            <input
              type="text"
              placeholder="Enter DSP Name..."
              value={customDspName}
              onChange={(e) => setCustomDspName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-rose-500" />
              <span>Authorized person *</span>
            </label>
            <input
              type="text"
              placeholder="Enter Authorized person..."
              value={authorizedPerson}
              onChange={(e) => setAuthorizedPerson(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-rose-500" />
              <span>Role *</span>
            </label>
            <input
              type="text"
              placeholder="Enter Role / Title..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3 text-rose-500" />
              <span>Organization *</span>
            </label>
            <input
              type="text"
              placeholder="Enter Organization..."
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Official Letter Ref
            </label>
            <input
              type="text"
              placeholder="e.g. EPSS/HO-BR/2026..."
              value={officialLetterRef}
              onChange={(e) => setOfficialLetterRef(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {stage5Records.length > 0 && (
            <select
              value={currentDossier?.id || ''}
              onChange={(e) => setSelectedDossierId(e.target.value)}
              className="bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              {stage5Records.map(d => (
                <option key={d.id} value={d.id}>
                  {d.dspName || d.dspRefNumber} ({d.dateSubmitted})
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facility, zone, woreda, hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all"
            />
          </div>

          <select
            value={selectedHubFilter}
            onChange={(e) => setSelectedHubFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs text-slate-700 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer shadow-sm"
          >
            <option value="all">All Mapped Hubs ({EPSS_HUBS_REGISTRY.length})</option>
            {EPSS_HUBS_REGISTRY.map(hub => (
              <option key={hub.code} value={hub.code}>{hub.name} ({hub.code})</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing <strong>{filteredAllocations.length}</strong> of {allocations.length} Facilities
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border-2 border-slate-400 rounded-xl shadow-md overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-900">
            Hub-Mapped Equipment Breakdown Matrix (Ready for Branch Dispatch)
          </span>
        </div>

        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left border-collapse select-text">
            <thead>
              <tr className="text-xs font-semibold">
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[110px]">Region</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px]">Zone</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[110px]">Woreda</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[220px]">Name of health facility</th>
                <th className="bg-[#fed7aa] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[190px] font-bold">Hub</th>
                <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-2 px-3 min-w-[120px]">List of Packages</th>

                {equipmentColumns.map((col: any) => (
                  <th key={col.id} className="bg-[#fed7aa] text-slate-900 font-normal border border-slate-400 py-2 px-2 text-center min-w-[130px] leading-tight">
                    {col.name}
                  </th>
                ))}

                <th className="bg-[#fde047]/60 text-slate-900 font-bold border border-slate-400 py-2 px-2 text-center min-w-[70px]">Total</th>
              </tr>

              <tr className="text-xs font-normal">
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#fed7aa] border border-slate-400 py-1 px-3"></th>
                <th className="bg-[#dbeafe] text-slate-900 italic border border-slate-400 py-1 px-3 text-left font-normal text-[11px]">List of Packages</th>

                {equipmentColumns.map((col: any) => (
                  <th key={`code-${col.id}`} className="bg-white text-slate-800 font-mono text-[10px] border border-slate-400 py-1 px-2 text-center font-normal">
                    {col.code}
                  </th>
                ))}

                <th className="bg-[#fde047]/60 border border-slate-400 py-1 px-2"></th>
              </tr>
            </thead>

            <tbody className="text-xs text-slate-900">
              {filteredAllocations.length > 0 ? (
                filteredAllocations.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className={`transition-colors hover:bg-amber-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                    <td className="py-2 px-3 border border-slate-300 font-medium text-slate-800">{item.region}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700">{item.zone}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-700 font-mono text-[11px]">{item.woreda}</td>
                    <td className="py-2 px-3 border border-slate-300 font-semibold text-slate-900">{item.healthFacility}</td>
                    <td className="py-2 px-3 border border-slate-300 bg-amber-50/30 font-bold text-slate-800">
                      {item.hubName} ({item.hubCode})
                    </td>
                    <td className="py-2 px-3 border border-slate-300 bg-[#eff6ff] text-slate-800 font-semibold text-center">{item.packages}</td>

                    {equipmentColumns.map((col: any) => {
                      const qty = item.quantities[col.id] ?? 0;
                      return (
                        <td key={col.id} className="py-1 px-1 border border-slate-300 text-center font-mono font-bold text-slate-800">
                          {qty}
                        </td>
                      );
                    })}

                    <td className="py-2 px-2 border border-slate-300 text-center font-mono font-black text-amber-900 bg-amber-100/50">
                      {item.totalQty}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={equipmentColumns.length + 7} className="py-12 text-center text-slate-400">
                    <Table className="w-8 h-8 mx-auto mb-2 opacity-40 text-rose-500" />
                    <p className="font-semibold text-slate-600 text-sm">
                      {stage5Records.length === 0
                        ? 'No Hub-Mapped DSP Dossiers Found. Complete Sub-step 1.3.1 (Map HF to Hub) first.'
                        : 'No health facilities found matching filters.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>

            {filteredAllocations.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-500 text-xs">
                  <td className="py-3 px-3 uppercase tracking-wider font-mono text-[11px]" colSpan={4}>
                    TOTAL ({filteredAllocations.length} Facilities)
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-amber-300">EPSS Hub Mapped</td>
                  <td className="py-3 px-3 text-center text-slate-300 font-semibold bg-slate-800">All Packages</td>

                  {equipmentColumns.map((col: any) => {
                    const colTotal = filteredAllocations.reduce((sum: number, a: any) => sum + (Number(a.quantities[col.id]) || 0), 0);
                    return (
                      <td key={`sum-${col.id}`} className="py-3 px-2 text-center font-mono font-black text-amber-300 border-r border-slate-700">
                        {colTotal}
                      </td>
                    );
                  })}

                  <td className="py-3 px-2 text-center font-mono font-black text-emerald-400 bg-slate-950 text-sm">
                    {filteredAllocations.reduce((sum: number, a: any) => sum + (Number(a.totalQty) || 0), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Send to Branch Confirmation & Authorization Modal */}
      {isSendToBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-rose-900 via-pink-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center">
                  <Send className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Send to Branch</h3>
                  <p className="text-[11px] text-rose-200">
                    Transmit Hub-Mapped DSP Breakdown to Branches (4.1 Received DSP)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSendToBranchModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Dispatch Payload Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Target Hubs</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    {selectedHubFilter === 'all' ? `${hubsSet.length} Hubs` : selectedHubFilter}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Facilities</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{filteredAllocations.length}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Equipment Items</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{equipmentColumns.length}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Units</div>
                  <div className="text-sm font-black text-emerald-900 mt-0.5">{totalFilteredUnits.toLocaleString()}</div>
                </div>
              </div>

              {/* DSP Name & Official Letter Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">DSP Name</label>
                  <input
                    type="text"
                    placeholder="Enter DSP Name..."
                    value={customDspName}
                    onChange={(e) => setCustomDspName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Official Letter Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. EPSS/HO-BR/2026..."
                    value={officialLetterRef}
                    onChange={(e) => setOfficialLetterRef(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Authorized Person, Role & Organization */}
              <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">
                      Authorized person, Role &amp; Organization
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {['EPSS Head Office', 'EPSS', 'MOH'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOrganization(preset)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                          organization === preset
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Authorized person *
                    </label>
                    <input
                      type="text"
                      placeholder="Full name..."
                      value={authorizedPerson}
                      onChange={(e) => {
                        setAuthorizedPerson(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Role *
                    </label>
                    <input
                      type="text"
                      placeholder="Official role / title..."
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Organization *
                    </label>
                    <input
                      type="text"
                      placeholder="Organization name..."
                      value={organization}
                      onChange={(e) => {
                        setOrganization(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Dispatch Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional instructions for EPSS Regional Branches..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-rose-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSendToBranchModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendToBranch}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-amber-400 text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>Send to Branch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
