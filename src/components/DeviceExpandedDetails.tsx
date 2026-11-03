import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  User,
  Activity,
  Package,
  Building2,
  ExternalLink,
  Mail,
  ChevronUp,
  PlusCircle,
  Hash,
  Layers,
  Sparkles,
  Zap,
  Check,
  MapPin,
  Cpu,
  Truck
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  generateDeviceMaintenanceProfile,
  addCustomMaintenanceLog,
  DeviceMaintenanceProfile,
  MaintenanceLogEntry
} from '../utils/maintenanceHelper';

interface DeviceExpandedDetailsProps {
  item: MedicalDeviceItem;
  onOpenFullModal: (item: MedicalDeviceItem) => void;
  onScheduleCalendar: (item: MedicalDeviceItem) => void;
  onSendAlert: (item: MedicalDeviceItem) => void;
  onCollapse: () => void;
  isAdmin?: boolean;
}

export const DeviceExpandedDetails: React.FC<DeviceExpandedDetailsProps> = ({
  item,
  onOpenFullModal,
  onScheduleCalendar,
  onSendAlert,
  onCollapse,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'maintenance' | 'engineering' | 'procurement'>('maintenance');
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [logType, setLogType] = useState<MaintenanceLogEntry['type']>('Preventive PPM');
  const [logNotes, setLogNotes] = useState('');
  const [logTechnician, setLogTechnician] = useState('Eng. Abebe Tadesse');
  const [logStatus, setLogStatus] = useState<MaintenanceLogEntry['status']>('Passed');
  const [logFeedback, setLogFeedback] = useState<string | null>(null);

  // Force re-render when a new log is submitted
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const profile = useMemo(() => {
    return generateDeviceMaintenanceProfile(item);
  }, [item, refreshTrigger]);

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNotes.trim()) return;

    addCustomMaintenanceLog(item.id, {
      date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      type: logType,
      technician: logTechnician.trim() || 'EPSS Clinical Engineer',
      department: 'EPSS Field Engineering Team',
      status: logStatus,
      details: logNotes.trim(),
      protocolRef: `EPSS-LOG-${Date.now().toString().slice(-4)}`,
      testValues: [
        { label: 'Ground Resistance', value: '0.05 Ω', status: 'pass' },
        { label: 'Safety Self-Test', value: logStatus === 'Passed' ? 'Passed 100%' : 'Needs Attention', status: logStatus === 'Passed' ? 'pass' : 'warning' }
      ]
    });

    setLogNotes('');
    setIsAddingLog(false);
    setRefreshTrigger((prev) => prev + 1);
    setLogFeedback('Maintenance record successfully logged to asset history!');
    setTimeout(() => setLogFeedback(null), 3000);
  };

  const isDefective = item.isNotFunctional;
  const isNeedsSpare = item.needsSparePart;

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100/80 border-t-2 border-b-2 border-cyan-500/40 p-4 sm:p-6 shadow-inner space-y-5 animate-in fade-in duration-200">
      {/* Top Header Strip inside Expanded Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-cyan-300 shadow-xs">
              {item.material}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {item.materialDescription}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              • Plant: <strong className="text-slate-800">{item.plant}</strong> ({item.wh || 'WH-1'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Operational Condition Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isDefective
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : isNeedsSpare
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {isDefective ? (
                <AlertTriangle className="w-3 h-3" />
              ) : isNeedsSpare ? (
                <Wrench className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {isDefective ? 'Defective / Breakdown' : isNeedsSpare ? 'Awaiting Spare Parts' : 'Operational (Healthy)'}
            </span>

            {/* Maintenance Schedule Status Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                profile.scheduleStatus === 'Immediate Action Needed'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : profile.scheduleStatus === 'Overdue'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : profile.scheduleStatus === 'Upcoming Soon'
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>PPM Status: {profile.scheduleStatus}</span>
            </span>

            {/* Installation Status */}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
              {item.installationStatus || 'Installed'}
            </span>

            {/* Stock SOH */}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-100/70 text-cyan-800">
              {item.sohStatus || 'Stock on Hand'}
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onScheduleCalendar(item)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Book PPM in Google Calendar"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule PPM</span>
          </button>

          <button
            onClick={() => onSendAlert(item)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Send Requisition Notice"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Alert</span>
          </button>

          <button
            onClick={() => onOpenFullModal(item)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Open comprehensive facility modal"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Full Modal</span>
          </button>

          <button
            onClick={onCollapse}
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition cursor-pointer ml-1"
            title="Collapse secondary row details"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
            activeTab === 'maintenance'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Maintenance History & Servicing Dates</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
            {profile.history.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('engineering')}
          className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
            activeTab === 'engineering'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Biomedical Directives & Audit Action</span>
        </button>

        <button
          onClick={() => setActiveTab('procurement')}
          className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
            activeTab === 'procurement'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Procurement & Logistics Specifications</span>
        </button>
      </div>

      {/* TAB 1: Maintenance History & Last-Serviced Telemetry */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* 4 Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Last Serviced Date */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                Last Serviced Date
              </span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {profile.lastServicedDate}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="font-medium text-cyan-700 font-mono">
                  {profile.lastServicedDaysAgo} days ago
                </span>
                <span>• {profile.leadTechnician}</span>
              </div>
            </div>

            {/* Card 2: Next Calibration / PPM Due */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Next Due Date
              </span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {profile.nextScheduledDate}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span className={`font-semibold font-mono ${
                  profile.nextScheduledDaysRemaining < 0 ? 'text-rose-600' : profile.nextScheduledDaysRemaining <= 30 ? 'text-amber-600' : 'text-emerald-700'
                }`}>
                  {profile.nextScheduledDaysRemaining < 0
                    ? `${Math.abs(profile.nextScheduledDaysRemaining)}d Overdue`
                    : `In ${profile.nextScheduledDaysRemaining} days`}
                </span>
                <span>• {profile.serviceIntervalLabel}</span>
              </div>
            </div>

            {/* Card 3: Calibration Cert & Safety Standard */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Calibration Protocol
              </span>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1 truncate" title={profile.calibrationCertNo}>
                {profile.calibrationCertNo}
              </div>
              <div className="text-[10px] text-indigo-700 font-medium mt-0.5 truncate">
                {profile.electricalSafetyStandard}
              </div>
            </div>

            {/* Card 4: Clinical Uptime & Operating Hours */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                Uptime & Operating Hours
              </span>
              <div className="text-base font-bold text-slate-900 mt-1 flex items-baseline gap-2">
                <span>{profile.uptimeRate}%</span>
                <span className="text-xs font-mono font-normal text-slate-500">
                  {profile.totalOperatingHours.toLocaleString()} hrs logged
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    profile.uptimeRate >= 90 ? 'bg-emerald-500' : profile.uptimeRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${profile.uptimeRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Maintenance Feedback Alert */}
          {logFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{logFeedback}</span>
            </div>
          )}

          {/* Maintenance Logs Header & Add Log Action */}
          <div className="flex items-center justify-between pt-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-700" />
              <span>Inspection & Maintenance Service History Log</span>
            </h4>

            <button
              onClick={() => setIsAddingLog((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isAddingLog ? 'Cancel Logging' : 'Log New Inspection'}</span>
            </button>
          </div>

          {/* Inline Form for Technicians to Log a Service Event */}
          {isAddingLog && (
            <form onSubmit={handleSaveLog} className="bg-white p-4 rounded-xl border border-cyan-200 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                <span>Record Biomedical Calibration / Maintenance Event</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Service Event Type</label>
                  <select
                    value={logType}
                    onChange={(e) => setLogType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Preventive PPM">Preventive PPM</option>
                    <option value="Electrical Safety & Calibration">Electrical Safety & Calibration</option>
                    <option value="Corrective Repair">Corrective Repair</option>
                    <option value="Pre-Commissioning Inspection">Pre-Commissioning Inspection</option>
                    <option value="Parts & Sensor Replacement">Parts & Sensor Replacement</option>
                    <option value="Performance Verification">Performance Verification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Technician / Engineer</label>
                  <input
                    type="text"
                    value={logTechnician}
                    onChange={(e) => setLogTechnician(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g. Eng. Abebe Tadesse"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Inspection Outcome</label>
                  <select
                    value={logStatus}
                    onChange={(e) => setLogStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Passed">Passed & Certified</option>
                    <option value="Calibrated">Calibrated & Aligned</option>
                    <option value="Completed">Completed</option>
                    <option value="Action Required">Action Required</option>
                    <option value="Pending Parts">Pending Parts Requisition</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Technical Notes & Measured Parameters</label>
                <textarea
                  rows={2}
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. Safety grounding test passed 0.04Ω. Optical sensors cleaned and re-zeroed. Unit ready for clinical deployment."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingLog(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save to Maintenance Log
                </button>
              </div>
            </form>
          )}

          {/* Chronological Service History Entries */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {profile.history.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-slate-50/70 transition space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        entry.status === 'Passed' || entry.status === 'Completed' || entry.status === 'Calibrated'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.status === 'Pending Parts'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {entry.status}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {entry.type}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Ref: {entry.protocolRef}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {entry.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {entry.technician}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed pl-1 border-l-2 border-slate-200">
                  {entry.details}
                </p>

                {entry.testValues && entry.testValues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-400 font-semibold text-[10px] uppercase">Telemetry Verifications:</span>
                    {entry.testValues.map((t, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          t.status === 'pass'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" />
                        <span>{t.label}: <strong>{t.value}</strong></span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Biomedical Directives & Audit Action */}
      {activeTab === 'engineering' && (
        <div className="space-y-4 animate-in fade-in duration-150 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Post-Inventory Audit Directives */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>EPSS Post-Audit Directive & Engineering Strategy</span>
              </div>

              <div className="space-y-2 text-slate-700">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Recommended Next Action</span>
                  <div className="font-bold text-slate-900 mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {item.nextAction || 'Routine clinical distribution & periodic maintenance schedule.'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">Way of Intervention</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {item.wayOfIntervention || 'Onsite inspection & calibration'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">Responsible Body</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {item.responsibleBody || 'EPSS Bio-medical Engineering Directorate'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Target Timeframe</span>
                  <span className="font-semibold text-indigo-700 font-mono block mt-0.5">
                    {item.timeFrame || 'Q3 2026 Fiscal Cycle'}
                  </span>
                </div>
              </div>
            </div>

            {/* Allocation Status & Asset Condition Breakdown */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>National Allocation & Breakdown Audit</span>
              </div>

              <div className="space-y-3 text-slate-700">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">EPSS Allocation Status</span>
                  <div className="text-sm font-semibold text-emerald-950 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 mt-0.5">
                    {item.fyaEpSSNoBkdStatus?.replace(/FYA /gi, '') || 'Approved for Distribution & Utilization - Active SOH'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Stock Condition</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {isDefective ? 'Defective' : isNeedsSpare ? 'Needs Spare' : 'Functional'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Movement Velocity</span>
                    <span className={`font-bold mt-0.5 block ${item.isNonMoving ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {item.isNonMoving ? 'Non-Moving Asset' : 'Active Clinical Turnover'}
                    </span>
                  </div>
                </div>

                {item.contractIssue && (
                  <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-900">
                    <span className="text-[11px] font-bold block uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> Contract / LC Stoppage Note
                    </span>
                    <p className="mt-1 font-semibold">{item.contractIssue}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Procurement & Logistics Specifications */}
      {activeTab === 'procurement' && (
        <div className="space-y-4 animate-in fade-in duration-150 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-700" />
                <span>Procurement, Staging & Accounting Master Fields</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                WBS: {item.wbsElement || 'Federal Treasury Pool'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 divide-x divide-y divide-slate-100 text-slate-700">
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Regional Hub & Warehouse</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{item.plantName || item.plant}</span>
                <span className="text-[10px] text-slate-500">Warehouse Storage: {item.wh || 'Bay 01'}</span>
              </div>

              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Unit Price & Valuation</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">{formatCurrency(item.unitPrice)}</span>
                <span className="text-[10px] text-slate-500">Total Lot: {formatCurrency(item.totalAmount, true)} ({formatNumber(item.qty)} units)</span>
              </div>

              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Manufacturer & Brand</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{item.manufacturer || 'Unspecified Vendor'}</span>
                <span className="text-[10px] text-slate-500">Material Type: {item.materialType || 'ZMED'}</span>
              </div>

              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Batch & Expiry</span>
                <span className="font-bold font-mono text-slate-900 mt-0.5 block">{item.batch || 'Standard Batch'}</span>
                <span className="text-[10px] text-slate-500">Expiry: {item.expiryDate || 'Permanent Asset'}</span>
              </div>

              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">PO / Procurement Package</span>
                <span className="font-bold font-mono text-slate-900 mt-0.5 block">{item.poNumber || item.procurementPackage || 'EPSS/MED/2026'}</span>
                <span className="text-[10px] text-slate-500">RDF Ref: {item.rdfNumber || 'N/A'}</span>
              </div>

              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Program Name</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{item.programName || 'National Healthcare Expansion'}</span>
                <span className="text-[10px] text-slate-500">Sheet Tab Source: {item.sheetTabSource || 'Master SOH'}</span>
              </div>
            </div>
          </div>

          {/* Supply Chain Inbound Pipeline Status Strip */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-indigo-600" />
              Inbound Supply Chain Pipeline Telemetry
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Letter of Credit (LC)</span>
                <span className="font-bold text-slate-800">{item.lcStatus || 'Dispatched & Settled'}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">International Shipment</span>
                <span className="font-bold text-slate-800">{item.shipmentStatus || 'Port Arrival'}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Customs Clearance</span>
                <span className="font-bold text-slate-800">{item.clearanceStatus || 'Cleared (Green Channel)'}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Inland Dispatch (Train/Truck)</span>
                <span className="font-bold text-slate-800">{item.assignTrainStatus || 'Dispatched to Hub'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
