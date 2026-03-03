'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Team } from '@/app/types/schema';

interface TeamComparisonChartProps {
  homeTeam: Team;
  awayTeam: Team;
}

const COMPARISON_STATS = [
  { key: 'points', label: 'PTS' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'fg3Pct', label: '3P%' },
  { key: 'ftPct', label: 'FT%' },
] as const;

function getTeamTotals(team: Team) {
  const totals = team.players.reduce(
    (acc, p) => ({
      points: acc.points + (p.points || 0),
      rebounds: acc.rebounds + (p.rebounds || 0),
      assists: acc.assists + (p.assists || 0),
      steals: acc.steals + (p.steals || 0),
      blocks: acc.blocks + (p.blocks || 0),
      turnovers: acc.turnovers + (p.turnovers || 0),
      fgMade: acc.fgMade + (p.fieldGoalsMade || 0),
      fgAttempted: acc.fgAttempted + (p.fieldGoalsAttempted || 0),
      fg3Made: acc.fg3Made + (p.threePointersMade || 0),
      fg3Attempted: acc.fg3Attempted + (p.threePointersAttempted || 0),
      ftMade: acc.ftMade + (p.freeThrowsMade || 0),
      ftAttempted: acc.ftAttempted + (p.freeThrowsAttempted || 0),
    }),
    {
      points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
      fgMade: 0, fgAttempted: 0, fg3Made: 0, fg3Attempted: 0, ftMade: 0, ftAttempted: 0,
    }
  );

  return {
    points: totals.points,
    rebounds: totals.rebounds,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fgPct: totals.fgAttempted > 0 ? Math.round((totals.fgMade / totals.fgAttempted) * 100) : 0,
    fg3Pct: totals.fg3Attempted > 0 ? Math.round((totals.fg3Made / totals.fg3Attempted) * 100) : 0,
    ftPct: totals.ftAttempted > 0 ? Math.round((totals.ftMade / totals.ftAttempted) * 100) : 0,
  };
}

const AWAY_COLOR = '#3b82f6';
const HOME_COLOR = '#ef4444';

export default function TeamComparisonChart({ homeTeam, awayTeam }: TeamComparisonChartProps) {
  const homeTotals = getTeamTotals(homeTeam);
  const awayTotals = getTeamTotals(awayTeam);

  const chartData = COMPARISON_STATS.map(({ key, label }) => ({
    stat: label,
    [awayTeam.teamAbbreviation]: awayTotals[key],
    [homeTeam.teamAbbreviation]: homeTotals[key],
  }));

  if (homeTeam.players.length === 0 && awayTeam.players.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold mb-2 dark:text-white">Team Comparison</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="stat" tick={{ fontSize: 11 }} stroke="#9ca3af" />
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
          <Bar dataKey={awayTeam.teamAbbreviation} fill={AWAY_COLOR} radius={[2, 2, 0, 0]} />
          <Bar dataKey={homeTeam.teamAbbreviation} fill={HOME_COLOR} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
