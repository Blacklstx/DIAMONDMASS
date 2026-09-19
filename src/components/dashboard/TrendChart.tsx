'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendChartProps {
  title: string;
  labels: string[];
  data: (number | null)[];
  borderColor?: string;
  backgroundColor?: string;
  unit?: string;
}

export function TrendChart({
  title,
  labels,
  data,
  borderColor = '#6B5138',
  backgroundColor = 'rgba(107, 81, 56, 0.08)',
  unit = '',
}: TrendChartProps) {
  const hasData = data.some((v) => v !== null && v !== undefined);

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        borderColor,
        backgroundColor,
        fill: true,
        tension: 0.25,
        spanGaps: true,
        pointBackgroundColor: borderColor,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            return val !== null ? `${val} ${unit}` : 'No data';
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#DDD2BD44',
        },
        ticks: {
          color: '#756A5D',
          font: {
            size: 10,
          },
        },
      },
      y: {
        grid: {
          color: '#DDD2BD44',
        },
        ticks: {
          color: '#756A5D',
          font: {
            size: 10,
          },
        },
      },
    },
  };

  return (
    <div className="card h-64 flex flex-col">
      <h3 className="mb-2 text-xs font-extrabold tracking-wider text-[var(--brown-dark)] uppercase">
        {title}
      </h3>
      <div className="relative flex-1 w-full">
        {hasData ? (
          <Line data={chartData} options={options as any} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-[var(--muted)]">
            No data logged yet
          </div>
        )}
      </div>
    </div>
  );
}

