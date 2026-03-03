'use client';

import { useState } from 'react';
import { useMemo } from 'react';
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, eachDayOfInterval } from 'date-fns';

interface GameLogEntry {
  game_date: Date;
  game_id: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
  plus_minus: number;
}

interface PlayerPerformanceTrendProps {
  games: GameLogEntry[];
  playerName: string;
}

const STAT_OPTIONS = [
  { key: 'points', label: 'PTS', color: '#3b82f6' },
  { key: 'rebounds', label: 'REB', color: '#10b981' },
  { key: 'assists', label: 'AST', color: '#f59e0b' },
  { key: 'steals', label: 'STL', color: '#8b5cf6' },
  { key: 'blocks', label: 'BLK', color: '#ef4444' },
  { key: 'turnovers', label: 'TO', color: '#6b7280' },
  { key: 'fg3_made', label: '3PM', color: '#06b6d4' },
  { key: 'decimal_minutes', label: 'MIN', color: '#f97316' },
  { key: 'plus_minus', label: '+/-', color: '#ec4899' },
] as const;

type StatKey = typeof STAT_OPTIONS[number]['key'];

const VOLUME_STATS: Set<StatKey> = new Set([
  'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'fg3_made',
]);

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function parseMinutes(minutes: string): number {
  if (!minutes) return 0;
  const parts = minutes.split(':');
  const mm = parseInt(parts[0], 10) || 0;
  const ss = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  return mm + ss / 60;
}

export default function PlayerPerformanceTrend({ games, playerName }: PlayerPerformanceTrendProps) {
  const [selectedStats, setSelectedStats] = useState<Set<StatKey>>(new Set(['points']));
  const [per36, setPer36] = useState(false);

  const toggleStat = (key: StatKey, multiSelect: boolean) => {
    setSelectedStats(prev => {
      if (multiSelect) {
        const next = new Set(prev);
        if (next.has(key)) {
          if (next.size > 1) next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      }
      return new Set([key]);
    });
  };

  // Build date spine and scatter data
  const sorted = [...games].sort((a, b) => a.game_date.getTime() - b.game_date.getTime());

  const allDates = sorted.length >= 2
    ? eachDayOfInterval({ start: sorted[0].game_date, end: sorted[sorted.length - 1].game_date })
    : sorted.map(g => g.game_date);

  // Map each date to its index for the x-axis
  const dateToIndex = new Map(allDates.map((d, i) => [format(d, 'yyyy-MM-dd'), i]));
  const indexToLabel = new Map(allDates.map((d, i) => [i, format(d, 'MM/dd')]));

  const chartData = sorted.map(game => {
    const decimalMinutes = parseMinutes(game.minutes);
    const base: Record<string, unknown> = {
      ...game,
      x: dateToIndex.get(format(game.game_date, 'yyyy-MM-dd')) ?? 0,
      decimal_minutes: Math.round(decimalMinutes * 10) / 10,
    };

    if (per36 && decimalMinutes > 0) {
      for (const key of VOLUME_STATS) {
        const raw = game[key as keyof GameLogEntry] as number;
        base[key] = Math.round((raw * 36 / decimalMinutes) * 10) / 10;
      }
    }

    return base;
  });

  // Compute trendline data for each selected stat
  const trendlineData = useMemo(() => {
    if (chartData.length < 2) return [];
    const xMin = 0;
    const xMax = allDates.length - 1;
    const lines: Record<string, unknown>[] = [{ x: xMin }, { x: xMax }];

    for (const { key } of STAT_OPTIONS) {
      if (!selectedStats.has(key)) continue;
      const points = chartData.map(d => ({
        x: d.x as number,
        y: d[key] as number,
      })).filter(p => p.y !== undefined && p.y !== null);
      if (points.length < 2) continue;
      const { slope, intercept } = linearRegression(points);
      const trendKey = `${key}_trend`;
      lines[0][trendKey] = Math.round((slope * xMin + intercept) * 10) / 10;
      lines[1][trendKey] = Math.round((slope * xMax + intercept) * 10) / 10;
    }

    return lines;
  }, [chartData, selectedStats, allDates.length]);

  const xTickCount = Math.min(12, allDates.length);
  const xTicks: number[] = [];
  if (allDates.length > 0) {
    const step = Math.max(1, Math.floor((allDates.length - 1) / (xTickCount - 1)));
    for (let i = 0; i < allDates.length; i += step) xTicks.push(i);
    if (xTicks[xTicks.length - 1] !== allDates.length - 1) xTicks.push(allDates.length - 1);
  }

  if (chartData.length === 0) {
    return <div className="p-4 text-gray-500">No game data available for chart.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setPer36(p => !p)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            per36
              ? 'bg-gray-700 text-white border-transparent'
              : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-transparent'
          }`}
        >
          Per 36
        </button>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
        {STAT_OPTIONS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={(e) => toggleStat(key, e.metaKey || e.ctrlKey)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedStats.has(key)
                ? 'text-white border-transparent'
                : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-transparent'
            }`}
            style={selectedStats.has(key) ? { backgroundColor: color } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, allDates.length - 1]}
            ticks={xTicks}
            tickFormatter={(val: number) => indexToLabel.get(val) ?? ''}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              color: '#111827',
              fontSize: '12px',
            }}
            labelFormatter={(val) => indexToLabel.get(Number(val)) ?? ''}
            isAnimationActive={false}
            filterNull={true}
            content={({ label, payload }) => {
              const items = payload?.filter(p => p.dataKey !== 'x');
              if (!items?.length) return null;
              return (
                <div style={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '8px 12px', fontSize: '12px', color: '#111827' }}>
                  <div style={{ marginBottom: 4 }}>{indexToLabel.get(Number(label)) ?? ''}</div>
                  {items.map(item => (
                    <div key={String(item.dataKey)} style={{ color: String(item.color) }}>
                      {item.name}: {item.value}
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          {STAT_OPTIONS.filter(({ key }) => selectedStats.has(key)).map(({ key, label, color }) => (
            <Scatter
              key={key}
              dataKey={key}
              name={label}
              fill={color}
              animationDuration={750}
            />
          ))}
          {trendlineData.length >= 2 && STAT_OPTIONS.filter(({ key }) => selectedStats.has(key)).map(({ key, color }) => (
            <Line
              key={`${key}_trend`}
              data={trendlineData}
              dataKey={`${key}_trend`}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              legendType="none"
              isAnimationActive={false}
              tooltipType="none"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
