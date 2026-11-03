import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Bell, Mail, Check, Play, SlidersHorizontal } from 'lucide-react';
import { MedicalDeviceItem, CategoryThreshold } from '../types';

interface LowStockConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  thresholds: Record<string, CategoryThreshold>;
  onSaveThresholds: (newThresholds: Record<string, CategoryThreshold>) => void;
}

export const LowStockConfigModal: React.FC<LowStockConfigModalProps> = ({
  isOpen,
  onClose,
  items,
  thresholds,
  onSaveThresholds,
}) => {
  // Extract all categories dynamically from items
  const dynamicCategories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.materialType || 'General Equipment')));
    // Guarantee some default common categories are always listed if not present
    ['ZMED', 'ZSPR', 'ZACC', 'Medical Equipment', 'General Equipment'].forEach((c) => {
      if (!cats.includes(c)) {
        cats.push(c);
      }
    });
    return cats.sort();
  }, [items]);

  // Local state for editing thresholds
  const [localThresholds, setLocalThresholds] = useState<Record<string, CategoryThreshold>>({});
  const [activeTab, setActiveTab] = useState<'config' | 'activeAlerts'>('config');
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [showSimSuccess, setShowSimSuccess] = useState(false);

  // Sync props to local state when opening
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, CategoryThreshold> = {};
      dynamicCategories.forEach((cat) => {
        if (thresholds[cat]) {
          initial[cat] = { ...thresholds[cat] };
        } else {
          // Robust defaults
          initial[cat] = {
            category: cat,
            threshold: cat === 'ZSPR' ? 10 : cat === 'ZACC' ? 8 : 5,
            notifyEmail: true,
            notifyToast: true,
            emailAddress: 'inventory-alerts@epss.gov.et',
          };
        }
      });
      setLocalThresholds(initial);
      setSimulationLogs([]);
      setShowSimSuccess(false);
    }
  }, [isOpen, thresholds, dynamicCategories]);

  if (!isOpen) return null;

  const handleThresholdChange = (cat: string, value: number) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        threshold: Math.max(0, value),
      },
    }));
  };

  const handleToggleToast = (cat: string) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        notifyToast: !prev[cat].notifyToast,
      },
    }));
  };

  const handleToggleEmail = (cat: string) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        notifyEmail: !prev[cat].notifyEmail,
      },
    }));
  };

  const handleEmailChange = (cat: string, value: string) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        emailAddress: value,
      },
    }));
  };

  const handleSaveAll = () => {
    onSaveThresholds(localThresholds);
    onClose();
  };

  // Find devices below set threshold right now
  const activeAlertDevices = useMemo(() => {
    return items.filter((item) => {
      const cat = item.materialType || 'General Equipment';
      const config = localThresholds[cat] || thresholds[cat];
      if (!config) return false;
      return item.qty <= config.threshold;
    });
  }, [items, localThresholds, thresholds]);

  // Run alert test simulation
  const handleSimulateAlerts = (cat: string) => {
    const config = localThresholds[cat];
    if (!config) return;

    const matchedDevices = items.filter(
      (item) => (item.materialType || 'General Equipment') === cat && item.qty <= config.threshold
    );

    const timestamp = new Date().toLocaleTimeString();
    const logs: string[] = [
      `[${timestamp}] 🚀 Initiated test sequence for Category: "${cat}"`,
      `[${timestamp}] 📊 Matching criteria: Stock Quantity <= ${config.threshold} Units`,
      `[${timestamp}] 🔍 Found ${matchedDevices.length} line items matching criteria.`
    ];

    if (matchedDevices.length > 0) {
      matchedDevices.forEach((d) => {
        logs.push(`[${timestamp}] ⚠️ FLAG: "${d.materialDescription}" has remaining qty of ${d.qty}`);
      });

      if (config.notifyToast) {
        logs.push(`[${timestamp}] 🔔 System Toast alert triggered.`);
      }
      if (config.notifyEmail) {
        logs.push(`[${timestamp}] 📧 Generating alert payload...`);
        logs.push(`[${timestamp}] ✉️ Simulated SMTP connection to: "${config.emailAddress}"`);
        logs.push(`[${timestamp}] ✅ Email broadcast dispatched successfully!`);
      }
    } else {
      logs.push(`[${timestamp}] ✅ All items in category "${cat}" are within normal threshold. No flags raised.`);
    }

    setSimulationLogs(logs);
    setShowSimSuccess(true);
    setTimeout(() => setShowSimSuccess(false), 5000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        id="low-stock-config-container"
        className="bg-white dark:bg-[#0c1220] w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Low-Stock Category Thresholds
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure custom alert levels and notification channels for medical equipment and spare categories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-5">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Threshold Rules
          </button>
          <button
            onClick={() => setActiveTab('activeAlerts')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'activeAlerts'
                ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>Live Alerts Queue</span>
            {activeAlertDevices.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                {activeAlertDevices.length}
              </span>
            )}
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'config' ? (
            <div className="space-y-4">
              {dynamicCategories.map((cat) => {
                const config = localThresholds[cat];
                if (!config) return null;

                // Derive current count below this threshold
                const currentBelowCount = items.filter(
                  (item) => (item.materialType || 'General Equipment') === cat && item.qty <= config.threshold
                ).length;

                return (
                  <div
                    key={cat}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111a2e] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-wide uppercase">
                          {cat}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${currentBelowCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {currentBelowCount > 0 
                              ? `${currentBelowCount} items currently below configured threshold` 
                              : 'All stocks healthy'}
                          </span>
                        </div>
                      </div>

                      {/* Threshold Numeric Setting */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          Alert Threshold:
                        </label>
                        <input
                          type="number"
                          value={config.threshold}
                          onChange={(e) => handleThresholdChange(cat, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">Units</span>
                      </div>
                    </div>

                    {/* Alert Vectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/50 dark:border-slate-800">
                      {/* Checkboxes */}
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleToast(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                            config.notifyToast
                              ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900'
                              : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <Bell className={`w-3.5 h-3.5 ${config.notifyToast ? 'animate-bounce' : ''}`} />
                          <span>Screen Toast Alert</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleEmail(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                            config.notifyEmail
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                              : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Dispatch Email Alert</span>
                        </button>
                      </div>

                      {/* Email Destination */}
                      {config.notifyEmail && (
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={config.emailAddress}
                            onChange={(e) => handleEmailChange(cat, e.target.value)}
                            placeholder="recipient@epss.gov.et"
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Simulation Test */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => handleSimulateAlerts(cat)}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 transition cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-emerald-500" />
                        <span>Simulate Alert Verification</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {simulationLogs.length > 0 && (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-[10px] text-emerald-400 font-mono space-y-1">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Simulation Output Engine</span>
                    <button
                      onClick={() => setSimulationLogs([])}
                      className="text-slate-500 hover:text-slate-300 transition"
                    >
                      Clear
                    </button>
                  </div>
                  {simulationLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                  {showSimSuccess && (
                    <div className="text-white bg-emerald-600/50 p-2 rounded border border-emerald-500 mt-2 font-sans font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Test finished successfully! Simulation alert verified correctly.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-400 text-xs">
                    EPSS Low Stock Warning Pipeline
                  </h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                    The items listed below are currently below your custom category-specific stock limits. Appropriate procurement alerts will trigger in realtime when these thresholds are breached.
                  </p>
                </div>
              </div>

              {activeAlertDevices.length === 0 ? (
                <div className="py-12 text-center max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center border border-emerald-200 dark:border-emerald-900 mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm">All Levels Healthy</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      No medical equipment lines fall below the customized low-stock category boundaries right now.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {activeAlertDevices.map((dev) => {
                    const cat = dev.materialType || 'General Equipment';
                    const config = localThresholds[cat] || thresholds[cat] || { threshold: 5 };
                    return (
                      <div
                        key={dev.id}
                        className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 transition flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {dev.materialDescription}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">HUB: {dev.plantName || dev.plant}</span>
                            <span>•</span>
                            <span className="font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]">
                              {cat}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-black text-rose-600 dark:text-rose-400 text-sm">
                            {dev.qty} Units Left
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Limit: {config.threshold} Units
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition"
          >
            Apply Configurations
          </button>
        </div>
      </div>
    </div>
  );
};
