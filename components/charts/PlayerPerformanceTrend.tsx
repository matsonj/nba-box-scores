'use client';

import { useState } from 'react';
import {
  LineChart,
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
  { key: 'plus_minus', label: '+/-', color: '#ec4899' },
] as const;

type StatKey = typeof STAT_OPTIONS[number]['key'];

export default function PlayerPerformanceTrend({ games, playerName }: PlayerPerformanceTrendProps) {
  const [selectedStats, setSelectedStats] = useState<Set<StatKey>>(new Set(['points']));

  const toggleStat = (key: StatKey) => {
    setSelectedStats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Reverse to show chronological order (oldest first)
  const chartData = [...games].reverse().map(game => ({
    ...game,
    date: format(game.game_date, 'MM/dd'),
  }));

  if (chartData.length === 0) {
    return <div className="p-4 text-gray-500">No game data available for chart.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {STAT_OPTIONS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleStat(key)}
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
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              color: '#e5e7eb',
              fontSize: '12px',
            }}
          />
          <Legend />
          {STAT_OPTIONS.filter(({ key }) => selectedStats.has(key)).map(({ key, label, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
