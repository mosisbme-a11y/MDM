import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { AgreementStatus, MedicalDeviceAgreement } from '../types';

export interface AgreementStatusBadgeProps {
  status?: AgreementStatus;
  agreement?: MedicalDeviceAgreement;
  committedDeliveryDate?: string;
  deliveredUnits?: number;
  totalAgreedUnits?: number;
  slaComplianceScore?: number;
  variant?: 'pill' | 'badge' | 'detailed' | 'minimal';
  showScheduleDelay?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export interface SchedulePerformanceAnalysis {
  isCompleted: boolean;
  isOverdue: boolean;
  isApproaching: boolean;
  isOnTrack: boolean;
  isLcIssue: boolean;
  diffDays: number;
  scheduleLabel: string;
  statusColorKey: 'on_track' | 'approaching' | 'delayed' | 'completed' | 'lc_issue';
  badgeLabel: string;
}

export function analyzeAgreementSchedule(
  statusProp?: AgreementStatus,
  deadlineProp?: string,
  delivered?: number,
  agreed?: number
): SchedulePerformanceAnalysis {
  const status = statusProp || 'On Track';
  const isCompleted = status === 'Fully Delivered' || (agreed !== undefined && agreed > 0 && (delivered || 0) >= agreed);
  const isLcIssue = status === 'Contract / LC Issue';

  let diffDays = 0;
  let isOverdue = false;
  let isApproaching = false;

  if (deadlineProp) {
    const now = new Date();
    // Normalize to midnight
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadline = new Date(deadlineProp);
    const deadlineNormalized = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const diffTime = deadlineNormalized.getTime() - today.getTime();
    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (!isCompleted && !isLcIssue) {
      if (diffDays < 0) {
        isOverdue = true;
      } else if (diffDays <= 30) {
        isApproaching = true;
      }
    }
  }

  // Determine overall status key
  let statusColorKey: SchedulePerformanceAnalysis['statusColorKey'] = 'on_track';
  let scheduleLabel = '';
  let badgeLabel: string = status;

  if (isCompleted) {
    statusColorKey = 'completed';
    scheduleLabel = '100% Fulfilled';
    badgeLabel = 'Fully Delivered';
  } else if (isLcIssue) {
    statusColorKey = 'lc_issue';
    scheduleLabel = 'LC Clearance Pending';
    badgeLabel = 'Contract / LC Issue';
  } else if (isOverdue || status === 'Delayed / Critical') {
    statusColorKey = 'delayed';
    scheduleLabel = diffDays < 0 ? `Delayed (+${Math.abs(diffDays)}d overdue)` : 'Delayed / Critical';
    badgeLabel = diffDays < 0 ? `Delayed (${Math.abs(diffDays)}d)` : 'Delayed';
  } else if (isApproaching || status === 'Approaching Deadline') {
    statusColorKey = 'approaching';
    scheduleLabel = diffDays >= 0 ? `Approaching (${diffDays}d left)` : 'Approaching Deadline';
    badgeLabel = diffDays >= 0 ? `Due in ${diffDays}d` : 'Approaching';
  } else {
    statusColorKey = 'on_track';
    scheduleLabel = diffDays > 0 ? `On Track (${diffDays}d remaining)` : 'On Track';
    badgeLabel = 'On Track';
  }

  return {
    isCompleted,
    isOverdue,
    isApproaching,
    isOnTrack: statusColorKey === 'on_track',
    isLcIssue,
    diffDays,
    scheduleLabel,
    statusColorKey,
    badgeLabel
  };
}

export const AgreementStatusBadge: React.FC<AgreementStatusBadgeProps> = ({
  status: propStatus,
  agreement,
  committedDeliveryDate: propDate,
  deliveredUnits: propDelivered,
  totalAgreedUnits: propAgreed,
  slaComplianceScore: propSla,
  variant = 'badge',
  showScheduleDelay = true,
  size = 'sm',
  className = '',
  id
}) => {
  const activeStatus = agreement?.status || propStatus || 'On Track';
  const activeDate = agreement?.committedDeliveryDate || propDate;
  const activeDelivered = agreement?.deliveredUnits ?? propDelivered ?? 0;
  const activeAgreed = agreement?.totalAgreedUnits ?? propAgreed ?? 0;
  const activeSla = agreement?.slaComplianceScore ?? propSla ?? 100;

  const analysis = analyzeAgreementSchedule(
    activeStatus,
    activeDate,
    activeDelivered,
    activeAgreed
  );

  // Size styling
  const sizeStyles = {
    xs: {
      container: 'text-[10px] px-1.5 py-0.5 gap-1 font-semibold',
      icon: 'w-2.5 h-2.5',
      dot: 'w-1.5 h-1.5',
      tag: 'text-[9px] px-1 py-0.2'
    },
    sm: {
      container: 'text-[11px] px-2.5 py-0.5 gap-1.5 font-bold',
      icon: 'w-3 h-3',
      dot: 'w-2 h-2',
      tag: 'text-[10px] px-1.5 py-0.5'
    },
    md: {
      container: 'text-xs px-3 py-1 gap-2 font-bold',
      icon: 'w-3.5 h-3.5',
      dot: 'w-2 h-2',
      tag: 'text-[11px] px-2 py-0.5'
    },
    lg: {
      container: 'text-sm px-3.5 py-1.5 gap-2.5 font-bold',
      icon: 'w-4 h-4',
      dot: 'w-2.5 h-2.5',
      tag: 'text-xs px-2.5 py-1'
    }
  }[size];

  // Visual themes mapped strictly to performance states
  const theme = {
    completed: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80',
      tagBg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300',
      dot: 'bg-emerald-500',
      ping: false,
      icon: CheckCircle2,
      label: 'Fully Delivered',
      indicatorText: 'Completed',
      borderAccent: 'border-emerald-300'
    },
    on_track: {
      bg: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100/80',
      tagBg: 'bg-sky-100/90 text-sky-900 border-sky-300',
      dot: 'bg-sky-500',
      ping: false,
      icon: CheckCircle2,
      label: 'On Track',
      indicatorText: 'Schedule On Track',
      borderAccent: 'border-sky-300'
    },
    approaching: {
      bg: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/80',
      tagBg: 'bg-amber-100/90 text-amber-950 border-amber-300',
      dot: 'bg-amber-500',
      ping: true,
      icon: Clock,
      label: 'Approaching Deadline',
      indicatorText: 'Approaching Deadline',
      borderAccent: 'border-amber-400'
    },
    delayed: {
      bg: 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100/80',
      tagBg: 'bg-rose-100/90 text-rose-950 border-rose-300',
      dot: 'bg-rose-600',
      ping: true,
      icon: AlertOctagon,
      label: 'Delayed / Overdue',
      indicatorText: 'Delivery Delayed',
      borderAccent: 'border-rose-400'
    },
    lc_issue: {
      bg: 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100/80',
      tagBg: 'bg-purple-100/90 text-purple-950 border-purple-300',
      dot: 'bg-purple-500',
      ping: false,
      icon: ShieldAlert,
      label: 'Contract / LC Issue',
      indicatorText: 'LC Issue Pending',
      borderAccent: 'border-purple-300'
    }
  }[analysis.statusColorKey];

  const IconComponent = theme.icon;
  const elementId = id || (agreement ? `agr-status-badge-${agreement.id}` : undefined);

  // 1. MINIMAL VARIANT (Just dot + status text)
  if (variant === 'minimal') {
    return (
      <span
        id={elementId}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${theme.bg.split(' ')[1]} ${className}`}
        title={`${theme.label} • ${analysis.scheduleLabel}`}
      >
        <span className="relative flex h-2 w-2">
          {theme.ping && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.dot}`}></span>
        </span>
        <span>{analysis.badgeLabel}</span>
      </span>
    );
  }

  // 2. PILL VARIANT (Compact badge ideal for high-density tables)
  if (variant === 'pill') {
    return (
      <span
        id={elementId}
        className={`inline-flex items-center rounded-full border shadow-2xs transition-all ${sizeStyles.container} ${theme.bg} ${className}`}
        title={`Delivery Status: ${theme.label} | Schedule: ${analysis.scheduleLabel} | SLA: ${activeSla}%`}
      >
        <span className="relative flex shrink-0">
          {theme.ping && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full ${sizeStyles.dot} ${theme.dot}`}></span>
        </span>
        <span className="truncate">{activeStatus}</span>
        {showScheduleDelay && analysis.isOverdue && (
          <span className={`rounded-md font-mono font-black shrink-0 border ${sizeStyles.tag} ${theme.tagBg}`}>
            +{Math.abs(analysis.diffDays)}d
          </span>
        )}
      </span>
    );
  }

  // 3. DETAILED VARIANT (Includes SLA score indicator and extended schedule timeline note)
  if (variant === 'detailed') {
    return (
      <div
        id={elementId}
        className={`inline-flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-xl border transition-all ${theme.bg} ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200/60 flex items-center justify-center shrink-0 shadow-2xs">
            <IconComponent className={`${sizeStyles.icon} shrink-0`} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs">{activeStatus}</span>
              {theme.ping && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                </span>
              )}
            </div>
            <span className="text-[10px] opacity-85 font-medium">
              {analysis.scheduleLabel}
            </span>
          </div>
        </div>

        {/* Schedule Performance Indicator Sub-Badge */}
        <div className="flex items-center gap-1.5 pt-1 sm:pt-0 sm:border-l sm:border-slate-300/60 sm:pl-2.5">
          {activeSla !== undefined && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/70 border border-slate-200 text-slate-700">
              SLA {activeSla}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // 4. DEFAULT 'badge' VARIANT
  return (
    <div
      id={elementId}
      className={`inline-flex items-center rounded-full border shadow-2xs transition-colors group/badge select-none ${sizeStyles.container} ${theme.bg} ${className}`}
      title={`Delivery Schedule Indicator: ${theme.indicatorText} (${analysis.scheduleLabel})`}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <IconComponent className={`${sizeStyles.icon} shrink-0`} />
        {theme.ping && (
          <span className="animate-ping absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 opacity-75"></span>
        )}
      </div>

      <span className="font-bold tracking-tight whitespace-nowrap">
        {activeStatus}
      </span>

      {showScheduleDelay && (
        <span
          className={`ml-0.5 rounded-full font-mono font-extrabold border shrink-0 uppercase transition ${sizeStyles.tag} ${theme.tagBg}`}
        >
          {analysis.isOverdue
            ? `+${Math.abs(analysis.diffDays)}d Overdue`
            : analysis.isCompleted
            ? 'On Schedule'
            : analysis.isApproaching
            ? `${analysis.diffDays}d Due`
            : 'On Track'}
        </span>
      )}
    </div>
  );
};
