import html2canvas from 'html2canvas';

export interface ChartExportMetadata {
  label: string;
  value: string;
}

export interface ChartExportMetric {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}

export interface ExportChartOptions {
  element: HTMLElement;
  filename?: string;
  reportTitle?: string;
  reportSubtitle?: string;
  metadata?: ChartExportMetadata[];
  summaryMetrics?: ChartExportMetric[];
  scale?: number;
  includeHeader?: boolean;
  backgroundColor?: string;
}

/**
 * Downloads a canvas or data URL as a PNG file.
 */
export function downloadDataUrlAsPNG(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Captures an HTML element (containing Recharts SVGs/charts) and exports it as a high-resolution PNG image.
 * Features:
 * - High-DPI crisp rendering (2x retina scale by default)
 * - Optional executive report header banner with branding, active filters, and summary metrics
 * - Clean solid white background
 * - Automatic file download
 */
export async function exportElementAsPNG(options: ExportChartOptions): Promise<string> {
  const {
    element,
    filename = `EPSS_Chart_Export_${new Date().toISOString().split('T')[0]}.png`,
    reportTitle = 'EPSS Receiving Data Visualizations Report',
    reportSubtitle = 'Inbound Goods Receipt Bar Graph & Pie Chart Breakdown (RDF vs Health Program)',
    metadata = [],
    summaryMetrics = [],
    scale = 2,
    includeHeader = true,
    backgroundColor = '#ffffff'
  } = options;

  if (!element) {
    throw new Error('Export element not found in DOM.');
  }

  // Ensure fonts are ready before canvas capture
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // Ignore font readiness errors
    }
  }

  // Render the element onto an HTML5 canvas using html2canvas
  const capturedCanvas = await html2canvas(element, {
    scale: Math.max(1, Math.min(scale, 3)),
    useCORS: true,
    allowTaint: true,
    backgroundColor: backgroundColor,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (_clonedDoc, clonedEl) => {
      // Ensure SVG animations are completed and visible
      clonedEl.style.boxShadow = 'none';
    }
  });

  let finalCanvas = capturedCanvas;

  // If header banner is requested, composite the report onto an executive document canvas
  if (includeHeader) {
    const compositeCanvas = document.createElement('canvas');
    const headerHeight = Math.round(150 * (scale / 2));
    const footerHeight = Math.round(44 * (scale / 2));
    const paddingX = Math.round(20 * (scale / 2));

    compositeCanvas.width = capturedCanvas.width;
    compositeCanvas.height = capturedCanvas.height + headerHeight + footerHeight;

    const ctx = compositeCanvas.getContext('2d');
    if (ctx) {
      // 1. Draw overall canvas background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

      // 2. Draw Top Executive Header Banner (Dark Emerald/Teal to Slate gradient)
      const gradient = ctx.createLinearGradient(0, 0, compositeCanvas.width, 0);
      gradient.addColorStop(0, '#042f2e');   // Deep teal
      gradient.addColorStop(0.5, '#0f172a'); // Dark slate
      gradient.addColorStop(1, '#1e1b4b');   // Deep indigo
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, compositeCanvas.width, headerHeight);

      // Top accent stripe (Teal glow)
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(0, 0, compositeCanvas.width, Math.round(4 * (scale / 2)));

      // 3. Render Header Text
      ctx.textBaseline = 'top';

      // Badge: EPSS Supply Chain Intelligence
      const badgeY = Math.round(14 * (scale / 2));
      ctx.fillStyle = 'rgba(20, 184, 166, 0.25)';
      const badgeText = 'EPSS PHARMACEUTICAL SUPPLY SERVICE • SUPPLY CHAIN VISUAL REPORTING';
      ctx.font = `bold ${Math.round(10 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const badgeWidth = ctx.measureText(badgeText).width + Math.round(16 * (scale / 2));
      const badgeHeight = Math.round(18 * (scale / 2));
      
      // Draw rounded pill background for badge
      ctx.beginPath();
      ctx.roundRect(paddingX, badgeY, badgeWidth, badgeHeight, Math.round(6 * (scale / 2)));
      ctx.fill();

      ctx.fillStyle = '#5eead4';
      ctx.fillText(badgeText, paddingX + Math.round(8 * (scale / 2)), badgeY + Math.round(4 * (scale / 2)));

      // Main Report Title
      const titleY = badgeY + badgeHeight + Math.round(6 * (scale / 2));
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(20 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(reportTitle, paddingX, titleY);

      // Subtitle
      const subtitleY = titleY + Math.round(26 * (scale / 2));
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 ${Math.round(12 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(reportSubtitle, paddingX, subtitleY);

      // Metadata Pills (Timestamp & Filters)
      const metaY = subtitleY + Math.round(22 * (scale / 2));
      let currentMetaX = paddingX;

      // Always include generation timestamp
      const allMeta: ChartExportMetadata[] = [
        { label: 'Generated', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
        ...metadata
      ];

      allMeta.forEach((meta) => {
        const text = `${meta.label}: ${meta.value}`;
        ctx.font = `600 ${Math.round(10.5 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const pillWidth = textWidth + Math.round(16 * (scale / 2));
        const pillHeight = Math.round(20 * (scale / 2));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(currentMetaX, metaY, pillWidth, pillHeight, Math.round(5 * (scale / 2)));
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(text, currentMetaX + Math.round(8 * (scale / 2)), metaY + Math.round(4 * (scale / 2)));

        currentMetaX += pillWidth + Math.round(8 * (scale / 2));
      });

      // 4. Render Summary Metric Cards on Header Right (if provided and enough width)
      if (summaryMetrics.length > 0 && compositeCanvas.width > Math.round(850 * (scale / 2))) {
        let metricRightX = compositeCanvas.width - paddingX;
        const metricBoxWidth = Math.round(140 * (scale / 2));
        const metricBoxHeight = Math.round(56 * (scale / 2));
        const metricBoxY = Math.round(30 * (scale / 2));

        [...summaryMetrics].reverse().forEach((metric) => {
          metricRightX -= metricBoxWidth;

          // Box background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.roundRect(metricRightX, metricBoxY, metricBoxWidth - Math.round(10 * (scale / 2)), metricBoxHeight, Math.round(8 * (scale / 2)));
          ctx.fill();

          // Border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = Math.round(1 * (scale / 2));
          ctx.stroke();

          // Metric Label
          ctx.fillStyle = '#94a3b8';
          ctx.font = `700 ${Math.round(9 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText(metric.label.toUpperCase(), metricRightX + Math.round(10 * (scale / 2)), metricBoxY + Math.round(8 * (scale / 2)));

          // Metric Value
          ctx.fillStyle = metric.color || '#38bdf8';
          ctx.font = `900 ${Math.round(14 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText(metric.value, metricRightX + Math.round(10 * (scale / 2)), metricBoxY + Math.round(24 * (scale / 2)));

          // Subtext
          if (metric.subtext) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = `500 ${Math.round(8.5 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillText(metric.subtext, metricRightX + Math.round(10 * (scale / 2)), metricBoxY + Math.round(42 * (scale / 2)));
          }

          metricRightX -= Math.round(6 * (scale / 2));
        });
      }

      // 5. Draw the Captured Charts Canvas in the Center
      ctx.drawImage(capturedCanvas, 0, headerHeight);

      // 6. Draw Footer Bar
      const footerY = compositeCanvas.height - footerHeight;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, footerY, compositeCanvas.width, footerHeight);

      // Separator line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.round(1 * (scale / 2));
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(compositeCanvas.width, footerY);
      ctx.stroke();

      // Footer Text Left
      ctx.fillStyle = '#64748b';
      ctx.font = `600 ${Math.round(10 * (scale / 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(
        'Ethiopian Pharmaceuticals Supply Service (EPSS) • ERP MM Goods Receipt System',
        paddingX,
        footerY + Math.round(16 * (scale / 2))
      );

      // Footer Text Right
      const rightFooterText = 'Confidential Supply Chain Analytics • Prepared for Executive Reporting';
      const rightWidth = ctx.measureText(rightFooterText).width;
      ctx.fillText(
        rightFooterText,
        compositeCanvas.width - paddingX - rightWidth,
        footerY + Math.round(16 * (scale / 2))
      );

      finalCanvas = compositeCanvas;
    }
  }

  // Convert final canvas to PNG data URL
  const dataUrl = finalCanvas.toDataURL('image/png');

  // Trigger download
  downloadDataUrlAsPNG(dataUrl, filename);

  return dataUrl;
}
