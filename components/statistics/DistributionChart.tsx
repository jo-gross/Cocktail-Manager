import React, {useEffect, useRef, useState} from 'react';
import {Bar} from 'react-chartjs-2';
import {BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DistributionDataPoint {
  label: string | number;
  value: number;
}

interface DistributionChartProps {
  data: DistributionDataPoint[];
  label?: string;
  horizontal?: boolean;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  loading?: boolean;
}

export function DistributionChart({
  data,
  label = 'Anzahl',
  horizontal = false,
  height = 200,
  xLabel,
  yLabel,
  color,
  loading = false,
}: DistributionChartProps) {
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

  const chartData = {
    labels: data.map((d) => String(d.label)),
    datasets: [
      {
        label,
        data: data.map((d) => d.value),
        backgroundColor: themeColor,
        borderColor: themeColor,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: !!xLabel,
          text: xLabel || '',
        },
        beginAtZero: true,
      },
      y: {
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
    <div ref={containerRef} style={{ height: `${height}px` }}>
      {loading ? <div className="skeleton h-full w-full"></div> : <Bar data={chartData} options={options} />}
    </div>
  );
}
