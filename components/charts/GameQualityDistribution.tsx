'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface GameQualityDistributionProps {
  rows: readonly Record<string, unknown>[];
}

function buildHistogram(values: number[], bucketCount: number = 10) {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    rangeStart: min + i * bucketSize,
    rangeEnd: min + (i + 1) * bucketSize,
    label: `${((min + i * bucketSize) * 100).toFixed(0)}%`,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / bucketSize), bucketCount - 1);
    buckets[index].count++;
  }

  return buckets;
}

export default function GameQualityDistribution({ rows }: GameQualityDistributionProps) {
  const gameQualityValues = rows
    .map(row => Number(row.game_quality))
    .filter(v => !isNaN(v) && v > 0);

  if (gameQualityValues.length === 0) {
    return <div className="p-4 text-gray-500">No game quality data available.</div>;
  }

  const histogram = buildHistogram(gameQualityValues, 12);

  return (
    <div>
      <h3 className="text-sm font-bold mb-2 dark:text-white">Game Quality Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={histogram} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" label={{ value: 'Players', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              color: '#e5e7eb',
              fontSize: '12px',
            }}
            formatter={(value?: number) => [`${value ?? 0} players`, 'Count']}
            labelFormatter={(label) => `GQ: ${label}`}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
