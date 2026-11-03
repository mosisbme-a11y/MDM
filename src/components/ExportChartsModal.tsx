import React, { useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  Check,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  Sparkles,
  Loader2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import {
  exportElementAsPNG,
  ExportChartOptions,
  ChartExportMetadata,
  ChartExportMetric
} from '../utils/chartExport';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface ExportChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters?: {
    timePeriod?: string;
    programType?: string;
    plantHub?: string;
    metricMode?: string;
  };
  stats?: {
    totalVal: number;
    totalUnits: number;
    rdfVal: number;
    rdfUnits: number;
    hpVal: number;
    hpUnits: number;
    consignments?: number;
  };
  defaultTargetId?: string;
  barChartTargetId?: string;
  pieChartTargetId?: string;
}

export const ExportChartsModal: React.FC<ExportChartsModalProps> = ({
  isOpen,
  onClose,
  activeFilters = {
    timePeriod: 'All Time',
    programType: 'All Programs (RDF & HP)',
    plantHub: 'All Plants & Hubs',
    metricMode: 'Valuation (ETB)'
  },
  stats,
  defaultTargetId = 'receiving-bar-and-pie-charts-container',
  barChartTargetId = 'receiving-bar-chart-card',
  pieChartTargetId = 'receiving-pie-chart-card'
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'combined' | 'bar' | 'pie'>('combined');
  const [reportTitle, setReportTitle] = useState('EPSS Receiving Data Visualizations Report');
  const [reportSubtitle, setReportSubtitle] = useState('Bar Graph & Pie Chart Analysis: Time Period, Program Type (RDF vs HP) & Plant Hub');
  const [scale, setScale] = useState<number>(2); // 2x high-res by default
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async (formatOverride?: 'combined' | 'bar' | 'pie') => {
    const format = formatOverride || selectedFormat;
    setIsExporting(true);
    setErrorMessage(null);
    setExportSuccessMessage(null);

    try {
      let targetId = defaultTargetId;
      let filenamePrefix = 'EPSS_Receiving_Visualizations_Combined';

      if (format === 'bar') {
        targetId = barChartTargetId;
        filenamePrefix = 'EPSS_Receiving_BarGraph';
      } else if (format === 'pie') {
        targetId = pieChartTargetId;
        filenamePrefix = 'EPSS_Receiving_PieChart';
      }

      // Locate element in DOM
      let targetElement = document.getElementById(targetId);

      // Fallback: If specific ID is not found, try common chart containers on the dashboard
      if (!targetElement) {
        targetElement =
          document.getElementById('receiving-bar-and-pie-charts-container') ||
          document.getElementById('receiving-charts-section') ||
          document.querySelector('.recharts-responsive-container')?.parentElement?.parentElement as HTMLElement;
      }

      if (!targetElement) {
        throw new Error('Could not find active chart visualizations in the current view to export. Please ensure the dashboard or receiving tab is open.');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${filenamePrefix}_${dateStr}.png`;

      // Build metadata for the report
      const metadata: ChartExportMetadata[] = [
        { label: 'Time Horizon', value: activeFilters.timePeriod || 'All Time' },
        { label: 'Program Type', value: activeFilters.programType || 'RDF vs Health Program' },
        { label: 'Plant Hub', value: activeFilters.plantHub || 'All EPSS Hubs' },
        { label: 'Metric', value: activeFilters.metricMode || 'Valuation (ETB)' }
      ];

      // Build summary metrics if stats are available
      const summaryMetrics: ChartExportMetric[] = [];
      if (stats) {
        summaryMetrics.push({
          label: 'Total Received',
          value: formatCurrency(stats.totalVal, true),
          subtext: `${formatNumber(stats.totalUnits)} Units`,
          color: '#38bdf8'
        });
        summaryMetrics.push({
          label: 'RDF Share',
          value: formatCurrency(stats.rdfVal, true),
          subtext: `${formatNumber(stats.rdfUnits)} Units`,
          color: '#34d399'
        });
        summaryMetrics.push({
          label: 'Health Program',
          value: formatCurrency(stats.hpVal, true),
          subtext: `${formatNumber(stats.hpUnits)} Units`,
          color: '#c084fc'
        });
      }

      const options: ExportChartOptions = {
        element: targetElement,
        filename,
        reportTitle: format === 'bar' ? `${reportTitle} - Bar Graph` : format === 'pie' ? `${reportTitle} - Pie Chart` : reportTitle,
        reportSubtitle,
        metadata,
        summaryMetrics,
        scale,
        includeHeader,
        backgroundColor: '#ffffff'
      };

      await exportElementAsPNG(options);

      setExportSuccessMessage(`Downloaded "${filename}" as high-resolution PNG image!`);
      setTimeout(() => {
        setExportSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error exporting chart as PNG:', err);
      setErrorMessage(err?.message || 'Failed to generate PNG image. Please verify charts are rendered and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded-xl">
              <Download className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Export Charts for Reporting
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/30 text-teal-200 border border-teal-400/30">
                  PNG FORMAT
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Download current bar graph and pie chart visualizations as a publication-ready PNG image
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Notification Banners */}
          {exportSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{exportSuccessMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Select Export Target */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
              <span>Choose Visualization Scope</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat('combined')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedFormat === 'combined'
                    ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-1.5 text-teal-700">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-bold">Combined Report</span>
                  </div>
                  {selectedFormat === 'combined' && <Check className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Both Bar Graph & Pie Chart side-by-side with summary breakdown
                </p>
                <span className="mt-2 text-[10px] font-mono font-bold text-teal-700 uppercase">
                  Recommended for slides
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('bar')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedFormat === 'bar'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-1.5 text-indigo-700">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-xs font-bold">Bar Graph Only</span>
                  </div>
                  {selectedFormat === 'bar' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Intake bar chart comparison across Plants / Time Period (RDF vs HP)
                </p>
                <span className="mt-2 text-[10px] font-mono text-indigo-700">
                  Individual PNG
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('pie')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedFormat === 'pie'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-1.5 text-purple-700">
                    <PieChartIcon className="w-4 h-4" />
                    <span className="text-xs font-bold">Pie Chart Only</span>
                  </div>
                  {selectedFormat === 'pie' && <Check className="w-4 h-4 text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Donut distribution of RDF vs Health Program share & valuation
                </p>
                <span className="mt-2 text-[10px] font-mono text-purple-700">
                  Individual PNG
                </span>
              </button>
            </div>
          </div>

          {/* 2. Active Reporting Filter Context */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Included Report Metadata & Filters
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Auto-detected from active view
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Time Period</span>
                <span className="font-semibold text-slate-800 truncate block">{activeFilters.timePeriod}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Program Type</span>
                <span className="font-semibold text-slate-800 truncate block">{activeFilters.programType}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Plant Hubs</span>
                <span className="font-semibold text-slate-800 truncate block">{activeFilters.plantHub}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Metric Mode</span>
                <span className="font-semibold text-slate-800 truncate block">{activeFilters.metricMode}</span>
              </div>
            </div>
          </div>

          {/* 3. Export Customization Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Report Title on Exported PNG
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-medium">Include Executive Report Banner</span>
              </label>
            </div>

            {includeHeader && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="Report Title"
                />
                <input
                  type="text"
                  value={reportSubtitle}
                  onChange={(e) => setReportSubtitle(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-600 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  placeholder="Report Subtitle"
                />
              </div>
            )}

            {/* Resolution Selector */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700">Image Resolution & DPI:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    scale === 1 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1x Standard
                </button>
                <button
                  type="button"
                  onClick={() => setScale(2)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    scale === 2 ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-teal-700'
                  }`}
                >
                  2x Retina HD (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setScale(3)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    scale === 3 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-indigo-700'
                  }`}
                >
                  3x Ultra 4K
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ImageIcon className="w-4 h-4 text-teal-600" />
            <span>Format: <strong>PNG 24-bit</strong> • Lossless Compression</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleExport()}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 flex-1 sm:flex-initial"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
                  <span>Generating PNG Image...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PNG Image</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
