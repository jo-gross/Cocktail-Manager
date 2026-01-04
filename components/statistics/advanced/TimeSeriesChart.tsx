import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

interface TimeSeriesDataPoint {
  date: string;
  count: number;
}

interface TimeSeriesDataset {
  label: string;
  data: TimeSeriesDataPoint[];
  color?: string;
}

interface TimeSeriesChartProps {
  data?: TimeSeriesDataPoint[];
  label?: string;
  comparisonData?: TimeSeriesDataPoint[];
  comparisonLabel?: string;
  datasets?: TimeSeriesDataset[]; // New: Support multiple datasets
  height?: number;
  color?: string;
  showLegend?: boolean;
  loading?: boolean;
}

export function TimeSeriesChart({
  data,
  label = 'Anzahl',
  comparisonData,
  comparisonLabel,
  datasets,
  height = 200,
  color,
  showLegend = false,
  loading = false,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [themeColor, setThemeColor] = useState(color || '#6366f1');

  // Read the secondary color from CSS variables at runtime
  useEffect(() => {
    if (color) {
      setThemeColor(color);
      return;
    }

    const getComputedColor = () => {
      if (typeof window !== 'undefined' && containerRef.current) {
        const computedStyle = getComputedStyle(containerRef.current);
        // Try to get the secondary color from oklch or hsl
        const secondaryColor = computedStyle.getPropertyValue('--s').trim();
        if (secondaryColor) {
          // Create a temporary element to compute the actual color
          const tempEl = document.createElement('div');
          tempEl.style.color = `oklch(${secondaryColor})`;
          document.body.appendChild(tempEl);
          const computed = getComputedStyle(tempEl).color;
          document.body.removeChild(tempEl);
          if (computed && computed !== 'rgba(0, 0, 0, 0)') {
            setThemeColor(computed);
            return;
          }
        }
        // Fallback: try to read --secondary or use a default
        const fallbackColor = computedStyle.getPropertyValue('--secondary').trim();
        if (fallbackColor) {
          setThemeColor(fallbackColor);
        } else {
          // Use a nice default secondary color
          setThemeColor('#6366f1');
        }
      }
    };

    getComputedColor();
    // Re-compute on theme change
    const observer = new MutationObserver(getComputedColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    return () => observer.disconnect();
  }, [color]);

  // Helper to create rgba with alpha
  const withAlpha = (colorStr: string, alpha: number): string => {
    if (colorStr.startsWith('rgb(')) {
      return colorStr.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (colorStr.startsWith('rgba(')) {
      return colorStr.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    // For hex colors
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return colorStr;
  };

  // If datasets are provided, use them; otherwise use the old format
  let chartDatasets: any[];
  let chartLabels: string[];

  if (datasets && datasets.length > 0) {
    // Collect all unique dates from all datasets
    const allDates = new Set<string>();
    datasets.forEach((ds) => {
      ds.data.forEach((d) => allDates.add(d.date));
    });
    chartLabels = Array.from(allDates).sort();

    // Create datasets with colors - use theme color as default for single dataset
    const defaultColors = [
      themeColor,
      'rgb(16, 185, 129)',
      'rgb(245, 101, 101)',
      'rgb(251, 191, 36)',
      'rgb(139, 92, 246)',
      'rgb(236, 72, 153)',
      'rgb(14, 165, 233)',
      'rgb(34, 197, 94)',
    ];

    chartDatasets = datasets.map((ds, index) => {
      const dsColor = ds.color || defaultColors[index % defaultColors.length];
      // Map data to labels, filling missing dates with 0
      const mappedData = chartLabels.map((date) => {
        const point = ds.data.find((d) => d.date === date);
        return point ? point.count : 0;
      });

      return {
        label: ds.label,
        data: mappedData,
        borderColor: dsColor,
        backgroundColor: withAlpha(dsColor, 0.1),
        fill: true,
        tension: 0.4,
      };
    });
  } else {
    // Legacy format - use theme color
    chartLabels = data ? data.map((d) => d.date) : [];
    chartDatasets = [
      {
        label,
        data: data ? data.map((d) => d.count) : [],
        borderColor: themeColor,
        backgroundColor: withAlpha(themeColor, 0.1),
        fill: true,
        tension: 0.4,
      },
      ...(comparisonData
        ? [
            {
              label: comparisonLabel || 'Vergleich',
              data: comparisonData.map((d) => d.count),
              borderColor: 'rgb(156, 163, 175)',
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
              fill: true,
              tension: 0.4,
              borderDash: [5, 5],
            },
          ]
        : []),
    ];
  }

  const [tooltipData, setTooltipData] = useState<{
    show: boolean;
    x: number;
    y: number;
    label: string;
    items: Array<{ label: string; value: number; color: string; percentage: string }>;
    total: number;
  } | null>(null);

  const chartData = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
      },
      tooltip: {
        enabled: false, // Disable default tooltip, we use custom
        external: (context: any) => {
          const { chart, tooltip } = context;

          if (tooltip.opacity === 0) {
            setTooltipData(null);
            return;
          }

          const dataPoints = tooltip.dataPoints || [];
          if (dataPoints.length === 0) {
            setTooltipData(null);
            return;
          }

          // Filter and sort items
          const items = dataPoints
            .filter((dp: any) => dp.parsed.y > 0)
            .sort((a: any, b: any) => (b.parsed.y || 0) - (a.parsed.y || 0))
            .map((dp: any) => ({
              label: dp.dataset.label,
              value: dp.parsed.y,
              color: dp.dataset.borderColor,
              percentage: '0',
            }));

          if (items.length === 0) {
            setTooltipData(null);
            return;
          }

          const total = items.reduce((sum: number, item: any) => sum + item.value, 0);
          items.forEach((item: any) => {
            item.percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
          });

          setTooltipData({
            show: true,
            x: tooltip.caretX,
            y: tooltip.caretY,
            label: tooltip.title?.[0] || '',
            items,
            total,
          });
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Datum',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Anzahl',
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div ref={containerRef} style={{ height: `${height}px`, position: 'relative' }}>
      {loading ? (
        <div className="skeleton h-full w-full"></div>
      ) : (
        <>
          <Line data={chartData} options={options} />
          {tooltipData && tooltipData.show && (
            <div
              className="pointer-events-none absolute z-50 rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg"
              style={{
                left: tooltipData.x,
                top: tooltipData.y,
                transform: 'translate(-50%, -100%)',
                marginTop: '-10px',
              }}
            >
              <p className="mb-2 text-sm font-semibold text-base-content">{tooltipData.label}</p>
              <div className="space-y-1">
                {tooltipData.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-base-content">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-base-content">{item.value}</span>
                      <span className="text-xs text-base-content/60">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              {tooltipData.items.length > 1 && (
                <div className="mt-2 flex items-center justify-between border-t border-base-300 pt-2">
                  <span className="text-sm font-medium text-base-content">Gesamt</span>
                  <span className="text-sm font-bold text-base-content">{tooltipData.total}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
