import React, { useState, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  X,
  Filter,
  Download,
  Building2,
  ArrowUpRight,
  Printer,
  Copy,
  Check,
  Package,
  Layers,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface InstallationTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  initialStatus?: string;
  onNavigateTab?: (tab: string) => void;
  onFilterStatus?: (status: string) => void;
}

export const InstallationTaskModal: React.FC<InstallationTaskModalProps> = ({
  isOpen,
  onClose,
  items,
  initialStatus = 'all',
  onNavigateTab,
  onFilterStatus
}) => {
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>(initialStatus || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Sync initialStatus when modal opens
  React.useEffect(() => {
    if (isOpen && initialStatus) {
      setActiveStatusFilter(initialStatus);
    }
  }, [isOpen, initialStatus]);

  // Derive all unique branches
  const branchList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.plantName) set.add(i.plantName);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filter items based on active tab, search, and branch
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const status = item.installationStatus || 'Installed';
      
      // Status filter
      if (activeStatusFilter !== 'all') {
        if (activeStatusFilter === 'Installed' && status !== 'Installed') return false;
        if (activeStatusFilter === 'Pending Installation' && status !== 'Pending Installation') return false;
        if (activeStatusFilter === 'Under Commissioning' && status !== 'Under Commissioning') return false;
        if (activeStatusFilter === 'Site Assessment' && status !== 'Site Assessment') return false;
        if (activeStatusFilter === 'Not Installed' && status !== 'Not Installed') return false;
      }

      // Branch filter
      if (selectedBranch !== 'all' && item.plantName !== selectedBranch) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = (item.materialDescription || '').toLowerCase().includes(q);
        const matchesCode = (item.material || '').toLowerCase().includes(q);
        const matchesPlant = (item.plantName || '').toLowerCase().includes(q);
        const matchesResp = (item.responsibleBody || '').toLowerCase().includes(q);
        const matchesPO = (item.poNumber || '').toLowerCase().includes(q);
        const matchesMfg = (item.manufacturer || '').toLowerCase().includes(q);
        if (!matchesDesc && !matchesCode && !matchesPlant && !matchesResp && !matchesPO && !matchesMfg) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeStatusFilter, selectedBranch, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const totalDevices = items.length;
    let installed = 0;
    let pending = 0;
    let commissioning = 0;
    let assessment = 0;
    let notInstalled = 0;

    let installedUnits = 0;
    let pendingUnits = 0;
    let commissioningUnits = 0;
    let assessmentUnits = 0;
    let notInstalledUnits = 0;
    let totalUnits = 0;

    let installedVal = 0;
    let totalVal = 0;

    items.forEach(item => {
      const st = item.installationStatus || 'Installed';
      const u = Number(item.qty) || 1;
      const v = Number(item.totalAmount) || (u * (item.unitPrice || 0));

      totalUnits += u;
      totalVal += v;

      if (st === 'Installed') {
        installed++;
        installedUnits += u;
        installedVal += v;
      } else if (st === 'Pending Installation') {
        pending++;
        pendingUnits += u;
      } else if (st === 'Under Commissioning') {
        commissioning++;
        commissioningUnits += u;
      } else if (st === 'Site Assessment') {
        assessment++;
        assessmentUnits += u;
      } else {
        notInstalled++;
        notInstalledUnits += u;
      }
    });

    const installPct = totalUnits > 0 ? Math.round((installedUnits / totalUnits) * 100) : 0;
    const pendingPct = totalUnits > 0 ? Math.round((pendingUnits / totalUnits) * 100) : 0;
    const commPct = totalUnits > 0 ? Math.round((commissioningUnits / totalUnits) * 100) : 0;
    const assessPct = totalUnits > 0 ? Math.round((assessmentUnits / totalUnits) * 100) : 0;
    const notInstPct = totalUnits > 0 ? Math.round((notInstalledUnits / totalUnits) * 100) : 0;

    return {
      totalDevices,
      totalUnits,
      totalVal,
      installed,
      installedUnits,
      installedVal,
      installPct,
      pending,
      pendingUnits,
      pendingPct,
      commissioning,
      commissioningUnits,
      commPct,
      assessment,
      assessmentUnits,
      assessPct,
      notInstalled,
      notInstalledUnits,
      notInstPct
    };
  }, [items]);

  // Export filtered items to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Material Code',
      'Device Description',
      'Regional Hub / Plant',
      'Quantity',
      'Unit Price (ETB)',
      'Total Valuation (ETB)',
      'Installation Status',
      'Delivery Status',
      'Responsible Body',
      'Program',
      'RDF Number',
      'PO Number'
    ];

    const rows = filteredItems.map(item => [
      `"${item.id || ''}"`,
      `"${item.material || ''}"`,
      `"${(item.materialDescription || '').replace(/"/g, '""')}"`,
      `"${item.plantName || ''}"`,
      item.qty || 1,
      item.unitPrice || 0,
      item.totalAmount || (item.qty * item.unitPrice),
      `"${item.installationStatus || 'Installed'}"`,
      `"${item.deliveryStatus || ''}"`,
      `"${(item.responsibleBody || '').replace(/"/g, '""')}"`,
      `"${item.programName || ''}"`,
      `"${item.rdfNumber || ''}"`,
      `"${item.poNumber || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Medical_Device_Installation_Tasks_${activeStatusFilter.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (item: MedicalDeviceItem) => {
    const text = `Medical Device: ${item.materialDescription}\nSAP Code: ${item.material}\nInstallation Status: ${item.installationStatus || 'Installed'}\nHub/Plant: ${item.plantName}\nQuantity: ${item.qty}\nResponsible Body: ${item.responsibleBody || 'EPSS Clinical Engineering'}`;
    navigator.clipboard.writeText(text);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2500);
  };

  const handleNavigateToInventory = (status: string) => {
    if (onFilterStatus) onFilterStatus(status === 'all' ? 'all' : status);
    if (onNavigateTab) onNavigateTab('inventory');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">
                  Medical Device Installation Tasks & Data View
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  {stats.installPct}% Overall Completion
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Comprehensive tracking of equipment installation, site readiness, commissioning, and engineering deployment.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Summary Metrics Banner */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Units</div>
              <div className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">{formatNumber(stats.totalUnits)}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatNumber(stats.totalDevices)} line items</div>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Installed</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                  {stats.installPct}%
                </span>
              </div>
              <div className="text-lg font-mono font-extrabold text-emerald-900 mt-0.5">{formatNumber(stats.installedUnits)}</div>
              <div className="text-[10px] text-emerald-700 font-mono mt-0.5">{formatNumber(stats.installed)} items</div>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Pending Inst.</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                  {stats.pendingPct}%
                </span>
              </div>
              <div className="text-lg font-mono font-extrabold text-amber-900 mt-0.5">{formatNumber(stats.pendingUnits)}</div>
              <div className="text-[10px] text-amber-700 font-mono mt-0.5">{formatNumber(stats.pending)} items</div>
            </div>

            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Commissioning</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-mono">
                  {stats.commPct}%
                </span>
              </div>
              <div className="text-lg font-mono font-extrabold text-blue-900 mt-0.5">{formatNumber(stats.commissioningUnits)}</div>
              <div className="text-[10px] text-blue-700 font-mono mt-0.5">{formatNumber(stats.commissioning)} items</div>
            </div>

            <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider">Site Assess.</span>
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-mono">
                  {stats.assessPct}%
                </span>
              </div>
              <div className="text-lg font-mono font-extrabold text-purple-900 mt-0.5">{formatNumber(stats.assessmentUnits)}</div>
              <div className="text-[10px] text-purple-700 font-mono mt-0.5">{formatNumber(stats.assessment)} items</div>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Not Installed</span>
                <span className="text-xs font-bold text-slate-600 bg-slate-200 px-1.5 py-0.2 rounded font-mono">
                  {stats.notInstPct}%
                </span>
              </div>
              <div className="text-lg font-mono font-extrabold text-slate-800 mt-0.5">{formatNumber(stats.notInstalledUnits)}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatNumber(stats.notInstalled)} items</div>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search Bar */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Tasks', count: stats.totalDevices },
              { id: 'Installed', label: 'Installed', count: stats.installed, color: 'text-emerald-700' },
              { id: 'Pending Installation', label: 'Pending', count: stats.pending, color: 'text-amber-700' },
              { id: 'Under Commissioning', label: 'Commissioning', count: stats.commissioning, color: 'text-blue-700' },
              { id: 'Site Assessment', label: 'Site Assessment', count: stats.assessment, color: 'text-purple-700' },
              { id: 'Not Installed', label: 'Not Installed', count: stats.notInstalled, color: 'text-slate-700' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeStatusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeStatusFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-white text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Branch Filter */}
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search device, SAP code, tech..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none max-w-[150px]"
            >
              <option value="all">All Hubs / Plants</option>
              {branchList.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              title="Export installation task data to CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Items Task Table & List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Wrench className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
              <h4 className="font-bold text-sm text-slate-700">No Installation Tasks Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No medical equipment records match the current status filter or search parameters.
              </p>
              {(searchQuery || selectedBranch !== 'all' || activeStatusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedBranch('all');
                    setActiveStatusFilter('all');
                  }}
                  className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Medical Device Description & Code</th>
                    <th className="px-3 py-3">Plant / Regional Hub</th>
                    <th className="px-3 py-3 text-center">Installation Status</th>
                    <th className="px-3 py-3 text-center">Delivery Status</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Valuation (ETB)</th>
                    <th className="px-3 py-3">Responsible Body</th>
                    <th className="px-3 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.map((item) => {
                    const status = item.installationStatus || 'Installed';
                    const isInstalled = status === 'Installed';
                    const isPending = status === 'Pending Installation';
                    const isComm = status === 'Under Commissioning';
                    const isAssessment = status === 'Site Assessment';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 line-clamp-1 max-w-xs" title={item.materialDescription}>
                            {item.materialDescription}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                              {item.material}
                            </span>
                            {item.manufacturer && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {item.manufacturer}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                              {item.plantName || 'Central Hub'}
                            </span>
                          </div>
                          {item.programName && (
                            <div className="text-[10px] text-indigo-600 mt-0.5 truncate max-w-[140px]">
                              {item.programName}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isInstalled
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isComm
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : isAssessment
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {isInstalled ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                             isPending ? <Clock className="w-3 h-3 text-amber-600" /> :
                             isComm ? <Wrench className="w-3 h-3 text-blue-600" /> :
                             <AlertCircle className="w-3 h-3 text-purple-600" />}
                            <span>{status}</span>
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {item.deliveryStatus || 'Delivered'}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                          {formatNumber(item.qty || 1)}
                        </td>

                        <td className="px-3 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatCurrency(item.totalAmount || (item.qty * item.unitPrice), true)}
                        </td>

                        <td className="px-3 py-3 text-slate-600">
                          <div className="truncate max-w-[150px] text-[11px]" title={item.responsibleBody}>
                            {item.responsibleBody || 'EPSS Clinical Engineering Directorate'}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleCopy(item)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                              title="Copy details"
                            >
                              {copiedItemId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleNavigateToInventory(status)}
                              className="p-1 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-800 transition"
                              title="View full record in Master Inventory"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> of{' '}
            <strong className="text-slate-800">{items.length}</strong> items across all installation stages
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigateToInventory(activeStatusFilter)}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>View in Master Inventory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
