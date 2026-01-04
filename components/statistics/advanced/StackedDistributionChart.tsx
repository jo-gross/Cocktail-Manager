import React, { useRef, useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StackedDataset {
  label: string;
  data: number[];
  color: string;
}

interface StackedDistributionChartProps {
  labels: string[];
  datasets: StackedDataset[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  loading?: boolean;
}

export function StackedDistributionChart({
  labels,
  datasets,
  height = 200,
  xLabel,
  yLabel,
  showLegend = false,
  loading = false,
}: StackedDistributionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<{
    show: boolean;
    x: number;
    y: number;
    label: string;
    items: Array<{ label: string; value: number; color: string; percentage: string }>;
    total: number;
  } | null>(null);

  const chartData = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color,
      borderColor: ds.color,
      borderWidth: 1,
    })),
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
              color: dp.dataset.backgroundColor,
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

          const position = chart.canvas.getBoundingClientRect();
          const containerRect = containerRef.current?.getBoundingClientRect();

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
        stacked: true,
        display: true,
        title: {
          display: !!xLabel,
          text: xLabel || '',
        },
      },
      y: {
        stacked: true,
        display: true,
        title: {
          display: !!yLabel,
          text: yLabel || '',
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
          <Bar data={chartData} options={options} />
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
