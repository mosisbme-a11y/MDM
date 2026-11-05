import React, { useState, useEffect } from 'react';
import { X, Server, Database, RefreshCw, Copy, Check, ShieldCheck, Activity, Layers, FileText } from 'lucide-react';

interface ActiveServerDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveServerDataModal: React.FC<ActiveServerDataModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'dsp' | 'inventory' | 'facilities' | 'raw'>('summary');

  const fetchActiveData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/active-app-data');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Failed to fetch active server data:', err);
      setError(err.message || 'Failed to fetch server data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActiveData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <Server className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Active Server Data & State Monitor
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ACTIVATED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Real-time activated datasets from server storage & Firebase Firestore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchActiveData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Server & DB Connection Badge */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Firestore DB:</span>
              <strong className="text-cyan-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                ai-studio-medicaldeviceman-ec848d15-6ca6-48e1-ae91-fb5eeddae66b
              </strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Project ID:</span>
              <strong className="text-emerald-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                imposing-carver-487611-h9
              </strong>
            </span>
          </div>

          {data && (
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span>Version: <strong className="text-amber-400">v{data.version || 1}</strong></span>
              <span>Updated: <strong>{data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'N/A'}</strong></span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'summary', label: 'Activated Summary', icon: Activity },
            { id: 'dsp', label: 'DSP Workflows', icon: Layers },
            { id: 'inventory', label: 'Medical Stock', icon: Database },
            { id: 'facilities', label: 'Health Facilities', icon: FileText },
            { id: 'raw', label: 'Raw JSON Payload', icon: CodeIcon }
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 font-sans">
          {loading && !data && (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-sm font-mono text-slate-300">Fetching activated server data...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-900/30 border border-rose-700/60 rounded-xl text-rose-300 text-xs font-mono mb-4">
              <strong>Error connecting to server:</strong> {error}
            </div>
          )}

          {data && (
            <>
              {/* Tab 1: Summary */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        DSP Workflows
                      </div>
                      <div className="text-2xl font-black text-cyan-400 font-mono">
                        {data.activatedDatasets?.dspWorkflows?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Active dossier entries</div>
                    </div>

                    <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Medical Devices
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {data.activatedDatasets?.medicalInventoryItems?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Items in active stock</div>
                    </div>

                    <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Health Facilities
                      </div>
                      <div className="text-2xl font-black text-amber-400 font-mono">
                        {data.activatedDatasets?.healthFacilityList?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Registered health centers</div>
                    </div>

                    <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Program MDs
                      </div>
                      <div className="text-2xl font-black text-purple-400 font-mono">
                        {data.activatedDatasets?.programMdRecords?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Agreements & Requisitions</div>
                    </div>
                  </div>

                  {/* Active Datasets Breakdown */}
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Activated Module Records Summary
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <span className="text-slate-400">Multiple Stock Items:</span>
                        <span className="font-bold text-white">{data.activatedDatasets?.multipleStockItems?.length || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <span className="text-slate-400">Material Master Items:</span>
                        <span className="font-bold text-white">{data.activatedDatasets?.materialMasterItems?.length || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <span className="text-slate-400">Receiving Records:</span>
                        <span className="font-bold text-white">{data.activatedDatasets?.receivingDataRecords?.length || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <span className="text-slate-400">Distribution Records:</span>
                        <span className="font-bold text-white">{data.activatedDatasets?.distributionDataRecords?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: DSP Workflows */}
              {activeTab === 'dsp' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Activated DSP Workflow Records ({data.activatedDatasets?.dspWorkflows?.length || 0})
                  </h4>

                  <div className="space-y-2">
                    {(data.activatedDatasets?.dspWorkflows || []).map((dsp: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs font-mono flex flex-col sm:flex-row justify-between gap-2">
                        <div>
                          <div className="font-bold text-cyan-300">{dsp.subject || dsp.id || `DSP Record ${idx + 1}`}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Stage: <span className="text-amber-300">{dsp.stage}</span> | Status: <span className="text-emerald-300">{dsp.status}</span>
                          </div>
                        </div>
                        <div className="text-right text-slate-300 text-[11px]">
                          <div>Total Qty: <strong>{dsp.totalQuantity || 0}</strong></div>
                          <div>Value: <strong>ETB {dsp.totalValue || '0.00'}</strong></div>
                        </div>
                      </div>
                    ))}
                    {(!data.activatedDatasets?.dspWorkflows || data.activatedDatasets.dspWorkflows.length === 0) && (
                      <div className="py-8 text-center text-slate-400 text-xs font-mono">
                        No DSP workflow dossiers currently registered on server.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Inventory */}
              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Activated Medical Devices & Stock ({data.activatedDatasets?.medicalInventoryItems?.length || 0})
                  </h4>

                  <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-800 text-slate-300 sticky top-0 border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">S/N</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Model / Code</th>
                          <th className="p-2.5">Qty</th>
                          <th className="p-2.5">Plant / Hub</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {(data.activatedDatasets?.medicalInventoryItems || []).slice(0, 50).map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 text-white font-medium">{item.materialDescription || item.deviceName || 'N/A'}</td>
                            <td className="p-2.5 text-cyan-300">{item.material || item.model || 'N/A'}</td>
                            <td className="p-2.5 font-bold text-emerald-400">{item.qty || item.quantity || 0}</td>
                            <td className="p-2.5 text-slate-400">{item.plant || item.location || 'EPSS HO'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: Health Facilities */}
              {activeTab === 'facilities' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Activated Ethiopian Health Facilities ({data.activatedDatasets?.healthFacilityList?.length || 0})
                  </h4>

                  <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-800 text-slate-300 sticky top-0 border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">Customer Code</th>
                          <th className="p-2.5">Facility Name</th>
                          <th className="p-2.5">Region</th>
                          <th className="p-2.5">Zone / Woreda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {(data.activatedDatasets?.healthFacilityList || []).slice(0, 50).map((hf: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-cyan-300 font-bold">{hf.customer || 'N/A'}</td>
                            <td className="p-2.5 text-white">{hf.customerDescription || 'N/A'}</td>
                            <td className="p-2.5 text-emerald-300">{hf.region || 'N/A'}</td>
                            <td className="p-2.5 text-slate-400">{hf.zoneDescription || ''} {hf.woredaDescription ? `/ ${hf.woredaDescription}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 5: Raw JSON */}
              {activeTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-slate-400">Complete Live JSON Payload:</span>
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Raw JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto max-h-[50vh] leading-relaxed">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
          <span>Target Endpoint: <code className="text-cyan-400">/api/active-app-data</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};

const CodeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);
