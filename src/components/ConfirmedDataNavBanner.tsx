import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
  ExternalLink,
  Tag,
  Database
} from 'lucide-react';
import { ConfirmedUploadBatch } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface ConfirmedDataNavBannerProps {
  confirmedBatches: ConfirmedUploadBatch[];
  currentNav: 'overview' | 'epss' | 'moh' | 'rhb' | 'hubs' | 'defective' | 'workspace';
  onClearBatch?: (batchId: string) => void;
  language?: 'en' | 'am';
}

export const ConfirmedDataNavBanner: React.FC<ConfirmedDataNavBannerProps> = ({
  confirmedBatches = [],
  currentNav,
  onClearBatch,
  language = 'en'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!confirmedBatches || confirmedBatches.length === 0) return null;

  const latestBatch = confirmedBatches[0];
  const totalAcceptedItems = confirmedBatches.reduce((acc, b) => acc + b.totalRecords, 0);
  const totalAcceptedValuation = confirmedBatches.reduce((acc, b) => acc + b.totalValuation, 0);

  // Get specific badge details for current navigation bar
  const getNavContextDetails = () => {
    switch (currentNav) {
      case 'overview':
        return {
          title: 'Multi-Upload Ingestion Confirmed',
          desc: `${totalAcceptedItems.toLocaleString()} items ingested across all operations`,
          color: 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
        };
      case 'epss':
        return {
          title: language === 'am' ? 'የተረጋገጠ የክምችት ዝርዝር (EPSS)' : 'Confirmed Master Inventory SOH',
          desc: language === 'am' ? 'በቅርብ የተጫኑ እና የተረጋገጡ የመሣሪያዎች ክምችት' : `${latestBatch.distribution.epssCount.toLocaleString()} units routed to EPSS Master Stock`,
          color: 'border-cyan-200 bg-cyan-50/90 text-cyan-900'
        };
      case 'moh':
        return {
          title: language === 'am' ? 'የተረጋገጠ የጤና ጥበቃ ሚኒስቴር ሪፖርት' : 'Confirmed MoH Delivery Pipeline',
          desc: language === 'am' ? 'የተረጋገጡ የውል እና የማጓጓዣ መረጃዎች' : `${latestBatch.distribution.mohCount.toLocaleString()} delivery items with linked authorization letters`,
          color: 'border-rose-200 bg-rose-50/90 text-rose-900'
        };
      case 'defective':
        return {
          title: language === 'am' ? 'የተረጋገጠ የጤና ተቋማት ጥገና' : 'Confirmed Health Facilities Maintenance',
          desc: language === 'am' ? 'ብልሽት ያለባቸው እና የመለዋወጫ እቃዎች' : `${latestBatch.distribution.healthFacilitiesCount.toLocaleString()} items tracked for facility maintenance and spare parts`,
          color: 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
        };
      case 'workspace':
        return {
          title: language === 'am' ? 'የተረጋገጠ የስራ ቦታ ማህደር (Archive)' : 'Confirmed Work Station Document Sync',
          desc: language === 'am' ? 'የተቀመጡ ሰነዶች እና የቀን መቁጠሪያ ማስታወሻዎች' : `${latestBatch.distribution.workStationDocsCount} official letters archived and scheduled`,
          color: 'border-amber-200 bg-amber-50/90 text-amber-900'
        };
      default:
        return {
          title: 'Multi-Upload Ingestion Confirmed',
          desc: `${totalAcceptedItems.toLocaleString()} items ingested across all 6 navigation systems`,
          color: 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
        };
    }
  };

  const navContext = getNavContextDetails();

  return (
    <div className={`border rounded-2xl p-3.5 transition-all shadow-xs ${navContext.color} mb-4 relative overflow-hidden`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                {navContext.title}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Accepted & Displayed
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(latestBatch.confirmedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5">
              {navContext.desc} <span className="text-slate-500 font-medium">({latestBatch.batchName})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('epss:open_upload_all_sql'))}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Upload all visible records to cloud and export Supabase SQL"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Upload All Visible (SQL)</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Distribution'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Multi-Nav Ingestion Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold text-cyan-700 uppercase">EPSS Master</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{latestBatch.distribution.epssCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500">{formatCurrency(latestBatch.distribution.epssValuation)}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold text-rose-700 uppercase">MOH Delivery</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{latestBatch.distribution.mohCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500">Tracking Pipeline</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Health Facilities</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{latestBatch.distribution.healthFacilitiesCount.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500">Defects & Spares</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold text-amber-700 uppercase">Work Station</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{latestBatch.distribution.workStationDocsCount} Docs</div>
            <div className="text-[10px] text-slate-500">Archived</div>
          </div>
        </div>
      )}
    </div>
  );
};
