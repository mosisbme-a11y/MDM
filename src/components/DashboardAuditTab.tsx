import React from 'react';
import { Clock } from 'lucide-react';

export interface AuditLogItem {
  id: string;
  action: 'ADD' | 'UPDATE' | 'BULK_UPDATE' | 'DELIVERY_UPDATE' | 'BREAKDOWN_UPDATE' | 'REVERT' | string;
  details: string;
  userName: string;
  userRole: string;
  timestamp: string | number;
}

interface DashboardAuditTabProps {
  auditLogs: AuditLogItem[];
}

export const DashboardAuditTab: React.FC<DashboardAuditTabProps> = ({ auditLogs }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Local Inventory Audit Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time recording of the last manual changes applied to the medical device inventory
            </p>
          </div>
        </div>
        <div className="text-[11px] bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full border border-slate-200">
          Session Tracks: Offline Storage
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-200">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">No modifications recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              When you perform manual inventory operations (e.g., adding stock, editing item statuses, bulk modifications), they will appear here with timestamps and clinical operator accounts.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {auditLogs.slice(0, 10).map((log) => {
            let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
            if (log.action === 'ADD') {
              badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            } else if (log.action === 'UPDATE') {
              badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
            } else if (log.action === 'BULK_UPDATE') {
              badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
            } else if (log.action === 'DELIVERY_UPDATE') {
              badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
            } else if (log.action === 'BREAKDOWN_UPDATE') {
              badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
            } else if (log.action === 'REVERT') {
              badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
            }

            return (
              <div key={log.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-0.5 font-bold rounded-md border text-[10px] tracking-wider shrink-0 uppercase ${badgeColor}`}>
                    {log.action}
                  </span>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 leading-tight">
                      {log.details}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{log.userName}</span>
                      <span className="text-slate-300">•</span>
                      <span className="italic">{log.userRole}</span>
                    </div>
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="font-semibold text-slate-600">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
