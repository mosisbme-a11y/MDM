import React, { useState, useMemo } from 'react';
import {
  FileText,
  Send,
  Building2,
  Hospital,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Share2,
  RefreshCw,
  Mail,
  UserCheck,
  Sparkles,
  ClipboardList,
  Layers,
  ChevronRight,
  Database
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface EpssMohWorkflowSectionProps {
  items: MedicalDeviceItem[];
  language?: 'en' | 'am';
}

interface WorkflowStep {
  id: number;
  title: string;
  sender: string;
  receiver: string;
  status: 'pending' | 'active' | 'completed';
  description: string;
  details: string;
  badge: string;
  icon: any;
}

export const EpssMohWorkflowSection: React.FC<EpssMohWorkflowSectionProps> = ({ items = [], language = 'en' }) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showLog, setShowLog] = useState<boolean>(true);
  const [simulationLog, setSimulationLog] = useState<Array<{ time: string; msg: string; type: string }>>([
    { time: '10:39:03 AM', msg: 'System initialized. Central EPSS stockpile waiting for data breakdown request...', type: 'info' }
  ]);

  // Dynamic calculations based on current dataset items
  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0), [items]);
  const totalValuation = useMemo(() => items.reduce((sum, item) => sum + (Number(item.qty || 0) * (Number(item.unitPrice) || 0)), 0), [items]);
  const uniqueManufacturers = useMemo(() => new Set(items.map(i => i.manufacturer).filter(Boolean)).size, [items]);

  // Steps configuration according to user requested official sequence
  const initialSteps: WorkflowStep[] = [
    {
      id: 1,
      title: 'DSP Request to MOH',
      sender: 'EPSS Head Office',
      receiver: 'Ministry of Health (MOH)',
      status: activeStep > 1 ? 'completed' : activeStep === 1 ? 'active' : 'pending',
      description: 'EPSS triggers official DSP Request summarizing current stockpile and priority program equipment for MOH authorization.',
      details: `Official DSP Dossier for ${formatNumber(totalUnits)} units valued at ${formatCurrency(totalValuation)}.`,
      badge: 'Step 1: DSP Request',
      icon: Database
    },
    {
      id: 2,
      title: 'DSP Request to RHB',
      sender: 'Ministry of Health (MOH)',
      receiver: 'Regional Health Bureaus (RHB)',
      status: activeStep > 2 ? 'completed' : activeStep === 2 ? 'active' : 'pending',
      description: 'MOH reviews the DSP and broadcasts a regional breakdown request to all 11 RHBs for facility-level mapping.',
      details: `Ref: MOH/PMD-DSP/2026/102. Regions requested to submit breakdown within 3 working days.`,
      badge: 'Step 2: Regional Breakdown',
      icon: FileCheck
    },
    {
      id: 3,
      title: 'Submit Breakdown to MOH',
      sender: 'Regional Health Bureaus (RHB)',
      receiver: 'Ministry of Health (MOH)',
      status: activeStep > 3 ? 'completed' : activeStep === 3 ? 'active' : 'pending',
      description: 'RHBs submit their facility-specific allocation matrices back to MOH for technical validation and aggregation.',
      details: `Facility-level mapping complete. Site readiness certified for designated hospitals.`,
      badge: 'Step 3: Regional Submission',
      icon: Building2
    },
    {
      id: 4,
      title: 'DSP Aggr. Submitted to EPSS',
      sender: 'Ministry of Health (MOH)',
      receiver: 'EPSS Head Office',
      status: activeStep > 4 ? 'completed' : activeStep === 4 ? 'active' : 'pending',
      description: 'MOH aggregates all regional breakdowns into a national master plan and submits it to EPSS for final processing.',
      details: 'National Consolidated Breakdown Matrix (NCBM) transmitted with Ministerial Seal.',
      badge: 'Step 4: National Aggregation',
      icon: Share2
    },
    {
      id: 5,
      title: 'Send DSP to Hub',
      sender: 'EPSS Head Office',
      receiver: 'EPSS Regional Branches',
      status: activeStep > 5 ? 'completed' : activeStep === 5 ? 'active' : 'pending',
      description: 'EPSS HO dispatches the approved DSP to regional branches/plants for physical material release and distribution.',
      details: 'Stock reservation locks active. Individual Branch Release Orders (BRO) generated.',
      badge: 'Step 5: Hub Dispatch',
      icon: Send
    },
    {
      id: 6,
      title: 'Analysis & compare with DSP',
      sender: 'EPSS Regional Branches',
      receiver: 'Final Health Facilities',
      status: activeStep === 6 ? 'active' : 'pending',
      description: 'Regional branches verify physical stock against the DSP instructions before final delivery to health facilities.',
      details: `Gate pass and waybill audit successful. Equipment ready for last-mile delivery.`,
      badge: 'Step 6: Final Verification',
      icon: Sparkles
    }
  ];

  const handleNextStep = () => {
    if (activeStep < 6) {
      const next = activeStep + 1;
      let logMsg = '';
      const timeStr = new Date().toLocaleTimeString();

      switch (next) {
        case 2:
          logMsg = `MOH processed SOH request. Official Authorization Letter (MOH/MDD/2026/089) dispatched to both EPSS and RHBs.`;
          break;
        case 3:
          logMsg = `RHBs parsed instructions. Multi-batch splits dispatched to primary regional hospitals.`;
          break;
        case 4:
          logMsg = `Hospitals submitted site readiness reports back to RHB: Ward clean, power grids calibrated, bio-meds prepared.`;
          break;
        case 5:
          logMsg = `RHB compiled technical audit logs and dispatched response reports to both EPSS and MOH simultaneously!`;
          break;
        case 6:
          logMsg = `MOH dashboard locked national metrics. Live SOH tracking active across all 19 EPSS branches.`;
          break;
      }

      setSimulationLog(prev => [{ time: timeStr, msg: logMsg, type: 'success' }, ...prev]);
      setActiveStep(next);
    }
  };

  const handleResetWorkflow = () => {
    setActiveStep(1);
    setSimulationLog([
      { time: new Date().toLocaleTimeString(), msg: 'Workflow reset. EPSS base waiting to generate SOH breakdown requests...', type: 'info' }
    ]);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-wider border border-cyan-200">
            <Layers className="w-3.5 h-3.5" />
            <span>Official Multi-Agency Communication Pipeline</span>
          </div>
          <h3 className="text-base font-black text-slate-900">
            EPSS | MOH | RHB | Health Facility Interactive Distribution Loop
          </h3>
          <p className="text-xs text-slate-500">
            Real-time tracking of interlocked letters, regional facility splits, and simultaneous technical readiness reports
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetWorkflow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Workflow</span>
          </button>
          {activeStep < 6 && (
            <button
              onClick={handleNextStep}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-black rounded-xl text-white bg-cyan-600 hover:bg-cyan-700 border-b-4 border-cyan-800 shadow-[0_4px_0_rgb(21,94,117)] cursor-pointer transition active:border-b-0 active:translate-y-[4px]"
            >
              <span className="uppercase">Advance Step</span>
              <ArrowRight className="w-4 h-4 text-cyan-100" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Diagram and Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step Cards Timeline List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialSteps.map((step) => {
              const StepIcon = step.icon;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isPending = step.status === 'pending';

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-2xl transition duration-200 border-b-4 active:border-b-0 active:translate-y-[4px] ${
                    isActive
                      ? 'bg-cyan-50/50 border-cyan-500 shadow-[0_4px_0_rgb(6,182,212)] ring-2 ring-cyan-500/10'
                      : isCompleted
                      ? 'bg-slate-50 border-slate-200 shadow-[0_4px_0_rgb(226,232,240)] hover:border-slate-300'
                      : 'bg-white border-slate-100 shadow-[0_4px_0_rgb(241,245,249)] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono ${
                      isActive ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                      isCompleted ? 'bg-slate-100 text-slate-700 border-slate-200' :
                      'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {step.badge.split(':')[0]}
                    </span>
                    <div className="flex items-center gap-1">
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Checked
                        </span>
                      ) : isActive ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-700 animate-pulse">
                          ● Transmitting
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">Locked</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3">
                    <div className={`p-2 rounded-xl shrink-0 border ${
                      isActive ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                      isCompleted ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-slate-50 text-slate-300 border-slate-100'
                    }`}>
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-800 leading-tight">
                        {step.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <span>{step.sender}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span>{step.receiver}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    {step.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/20 p-2.5 rounded-xl border border-dashed border-slate-200 text-[10px] font-mono text-slate-600">
                    <span className="font-bold text-slate-800">Telemetry Payload:</span> {step.details}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Simulation Audit Logs Side-Panel */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg h-full min-h-[460px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Communication Logs</h4>
                <p className="text-[10px] text-slate-400">Live system-to-system socket feed</p>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            {/* Audit Feed List */}
            <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1 scrollbar-thin scrollbar-thumb-slate-850">
              {simulationLog.map((log, index) => (
                <div key={index} className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1.5 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-slate-500 font-mono">
                      {log.time}
                    </span>
                    <span className={`text-[8px] font-bold font-mono uppercase px-1 py-0.2 rounded ${
                      log.type === 'success' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {log.type}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-200 leading-relaxed font-mono">
                    {log.msg}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
              <span>National Program Audit:</span>
              <span className="text-white font-mono">{uniqueManufacturers} OEM Programs Active</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Authorized Target Quantity</span>
              <strong className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                {formatNumber(totalUnits)} Pcs
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
