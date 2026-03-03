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
import { format } from 'date-fns';

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

  // Build chart data indexed by game order (not date spine) for reliable tooltips
  const sorted = [...games].sort((a, b) => a.game_date.getTime() - b.game_date.getTime());

  const indexToLabel = new Map(sorted.map((g, i) => [i, format(g.game_date, 'MM/dd')]));

  const chartData = sorted.map((game, i) => {
    const decimalMinutes = parseMinutes(game.minutes);
    const base: Record<string, unknown> = {
      ...game,
      x: i,
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

  // Compute trendline values at every data point so tooltips activate everywhere
  const chartDataWithTrends = useMemo(() => {
    if (chartData.length < 2) return chartData;

    const regressions = new Map<string, { slope: number; intercept: number }>();
    for (const { key } of STAT_OPTIONS) {
      if (!selectedStats.has(key)) continue;
      const points = chartData.map(d => ({
        x: d.x as number,
        y: d[key] as number,
      })).filter(p => p.y !== undefined && p.y !== null);
      if (points.length < 2) continue;
      regressions.set(key, linearRegression(points));
    }

    if (regressions.size === 0) return chartData;

    return chartData.map(d => {
      const x = d.x as number;
      const trendValues: Record<string, unknown> = {};
      for (const [key, { slope, intercept }] of regressions) {
        trendValues[`${key}_trend`] = Math.round((slope * x + intercept) * 10) / 10;
      }
      return { ...d, ...trendValues };
    });
  }, [chartData, selectedStats]);

  // Compute Y-axis domain from selected stats only
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 10];
    let min = Infinity;
    let max = -Infinity;
    for (const d of chartData) {
      for (const { key } of STAT_OPTIONS) {
        if (!selectedStats.has(key)) continue;
        const val = d[key] as number;
        if (val !== undefined && val !== null) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }
    if (!isFinite(min)) return [0, 10];
    const padding = Math.max(1, Math.ceil((max - min) * 0.1));
    return [0, Math.ceil(max + padding)];
  }, [chartData, selectedStats]);

  const gameCount = chartData.length;
  const xTickCount = Math.min(12, gameCount);
  const xTicks: number[] = [];
  if (gameCount > 0) {
    const step = Math.max(1, Math.floor((gameCount - 1) / (xTickCount - 1)));
    for (let i = 0; i < gameCount; i += step) xTicks.push(i);
    if (xTicks[xTicks.length - 1] !== gameCount - 1) xTicks.push(gameCount - 1);
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
        <ComposedChart data={chartDataWithTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, gameCount - 1]}
            ticks={xTicks}
            tickFormatter={(val: number) => indexToLabel.get(val) ?? ''}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={yDomain} />
          <Tooltip
            isAnimationActive={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const items = payload.filter((p: any) => {
                const dk = String(p.dataKey ?? '');
                return dk !== 'x' && !dk.endsWith('_trend');
              });
              if (!items.length) return null;
              const xVal = items[0]?.payload?.x;
              const dateLabel = xVal !== undefined ? indexToLabel.get(Number(xVal)) ?? '' : '';
              return (
                <div style={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '8px 12px', fontSize: '12px', color: '#111827' }}>
                  <div style={{ marginBottom: 4 }}>{dateLabel}</div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {items.map((item: any) => (
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
          {chartDataWithTrends.length >= 2 && STAT_OPTIONS.filter(({ key }) => selectedStats.has(key)).map(({ key, color }) => (
            <Line
              key={`${key}_trend`}
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
