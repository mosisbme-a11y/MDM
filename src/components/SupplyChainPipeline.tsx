import React from 'react';
import { PipelineMetrics } from '../types';
import { CreditCard, Ship, ShieldCheck, Train, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface SupplyChainPipelineProps {
  metrics: PipelineMetrics;
}

export const SupplyChainPipeline: React.FC<SupplyChainPipelineProps> = ({ metrics }) => {
  if (!metrics) return null;

  const renderStage = (title: string, icon: React.ReactNode, data: Record<string, any>, colorClass: string) => {
    const keys = Object.keys(data).filter(k => k !== 'Unknown' && data[k].units > 0);
    if (keys.length === 0) return null;

    let totalUnits = 0;
    let totalValue = 0;
    keys.forEach(k => {
      totalUnits += data[k].units;
      totalValue += data[k].valuation;
    });

    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              {icon}
            </div>
            <h3 className="font-bold text-slate-900">{title}</h3>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-700">{formatNumber(totalUnits)} Units</div>
            <div className="text-xs text-slate-500">{formatCurrency(totalValue)}</div>
          </div>
        </div>
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k} className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium truncate pr-4" title={k}>{k}</span>
              <span className="font-bold text-slate-900">{formatNumber(data[k].units)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">Procurement & Logistics Pipeline</h2>
        <p className="text-sm text-slate-500">Live tracker for Letter of Credit, Shipment, Customs Clearance, and Inland Transport (Assign Train).</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderStage('Letter of Credit', <CreditCard className="w-5 h-5" />, metrics.letterOfCredit, 'bg-blue-100 text-blue-600')}
        {renderStage('Shipment', <Ship className="w-5 h-5" />, metrics.shipment, 'bg-indigo-100 text-indigo-600')}
        {renderStage('Customs Clearance', <ShieldCheck className="w-5 h-5" />, metrics.clearance, 'bg-emerald-100 text-emerald-600')}
        {renderStage('Assign Train', <Train className="w-5 h-5" />, metrics.assignTrain, 'bg-orange-100 text-orange-600')}
      </div>
    </div>
  );
};
