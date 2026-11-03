import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Layers } from 'lucide-react';
import { MaterialMasterRecord, MultipleStockRecord } from '../types';

interface DataQualityWidgetProps {
  materialMasterItems: MaterialMasterRecord[];
  multipleStockItems: MultipleStockRecord[];
}

export const DataQualityWidget: React.FC<DataQualityWidgetProps> = ({
  materialMasterItems,
  multipleStockItems,
}) => {
  const issues = useMemo(() => {
    const findings: { type: string; category: string; message: string; count: number }[] = [];

    // Material Master Checks
    const mmDuplicates = new Set();
    const mmDupEntries: string[] = [];
    materialMasterItems.forEach(item => {
      if (!item.material) findings.push({ type: 'Missing', category: 'Material Master', message: 'Item missing Material Code', count: 1 });
      if (mmDuplicates.has(item.material)) mmDupEntries.push(item.material);
      mmDuplicates.add(item.material);
    });
    if (mmDupEntries.length > 0) findings.push({ type: 'Duplicate', category: 'Material Master', message: `Found ${mmDupEntries.length} duplicate material codes`, count: mmDupEntries.length });

    // Multiple Stock Checks
    const msDuplicates = new Set();
    const msDupEntries: string[] = [];
    multipleStockItems.forEach(item => {
      if (!item.material) findings.push({ type: 'Missing', category: 'Multiple Stock', message: 'Item missing Material Code', count: 1 });
      if (msDuplicates.has(item.id)) msDupEntries.push(item.id);
      msDuplicates.add(item.id);
    });
    if (msDupEntries.length > 0) findings.push({ type: 'Duplicate', category: 'Multiple Stock', message: `Found ${msDupEntries.length} duplicate stock IDs`, count: msDupEntries.length });

    return findings;
  }, [materialMasterItems, multipleStockItems]);

  if (issues.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Data Quality Insights</h3>
          <p className="text-[11px] text-slate-500">Automated check for Material Master & Multiple Stock records.</p>
        </div>
      </div>
      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            {issue.type === 'Missing' ? <FileText className="w-4 h-4 text-rose-500" /> : <Layers className="w-4 h-4 text-amber-500" />}
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-800">{issue.category}: {issue.type}</div>
              <div className="text-[11px] text-slate-500">{issue.message}</div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900">{issue.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
