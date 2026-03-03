'use client';

import { useEffect, useState, useRef } from 'react';
import { BoxScores as BoxScoreType } from '@/app/types/schema';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { TEMP_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import { sanitizeNumericId } from '@/lib/queryUtils';
import { getAvailableSeasons, formatSeasonLabel } from '@/lib/seasonUtils';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';

const PlayerPerformanceTrend = dynamic(
  () => import('./charts/PlayerPerformanceTrend'),
  { ssr: false, loading: () => <div className="h-[300px]" /> }
);

interface PlayerGameLogPanelProps {
  entityId: string;
  playerName: string;
  onClose: () => void;
}

export default function PlayerGameLogPanel({ entityId, playerName, onClose }: PlayerGameLogPanelProps) {
  interface GameLogEntry extends BoxScoreType {
    game_date: Date;
    home_team_id: string;
    away_team_id: string;
    home_team_abbreviation: string;
    away_team_abbreviation: string;
    home_team_score: number;
    away_team_score: number;
    result: string;
    margin: number;
  }

  const [games, setGames] = useState<GameLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [seasonYear, setSeasonYear] = useState<number | undefined>(undefined);
  const [seasonType, setSeasonType] = useState<string>('all');
  const { evaluateQuery } = useMotherDuckClientState();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        const safeEntityId = sanitizeNumericId(entityId);
        const result = await evaluateQuery(`
          SELECT
            b.*,
            s.game_date,
            s.home_team_id,
            s.away_team_id,
            s.home_team_abbreviation,
            s.away_team_abbreviation,
            s.home_team_score,
            s.away_team_score,
            CASE
              WHEN b.team_id = s.home_team_abbreviation THEN
                CASE
                  WHEN s.home_team_score > s.away_team_score THEN 'W'
                  WHEN s.home_team_score < s.away_team_score THEN 'L'
                  ELSE 'T'
                END
              ELSE
                CASE
                  WHEN s.away_team_score > s.home_team_score THEN 'W'
                  WHEN s.away_team_score < s.home_team_score THEN 'L'
                  ELSE 'T'
                END
            END AS result,
            CASE
              WHEN b.team_id = s.home_team_abbreviation THEN s.home_team_score - s.away_team_score
              ELSE s.away_team_score - s.home_team_score
            END AS margin
          FROM ${TEMP_TABLES.BOX_SCORES} b
          JOIN ${TEMP_TABLES.SCHEDULE} s ON b.game_id = s.game_id
          WHERE b.entity_id = '${safeEntityId}' AND b.period = 'FullGame'
          ${seasonYear ? `AND s.season_year = ${Number(seasonYear)}` : ''}
          ${seasonType === 'regular' ? `AND s.season_type = 'Regular Season'` : ''}
          ${seasonType === 'playoffs' ? `AND s.season_type = 'Playoffs'` : ''}
          ORDER BY s.game_date DESC
        `);

        if (cancelled) return;

        const gameLog = [...result.data.toRows()].map(row => ({
          game_date: utcToLocalDate(String(row.game_date)),
          game_id: String(row.game_id),
          team_id: String(row.team_id),
          entity_id: String(row.entity_id),
          player_name: String(row.player_name),
          minutes: String(row.minutes),
          points: Number(row.points),
          rebounds: Number(row.rebounds),
          assists: Number(row.assists),
          steals: Number(row.steals),
          blocks: Number(row.blocks),
          turnovers: Number(row.turnovers),
          fg_made: Number(row.fg_made),
          fg_attempted: Number(row.fg_attempted),
          fg3_made: Number(row.fg3_made),
          fg3_attempted: Number(row.fg3_attempted),
          ft_made: Number(row.ft_made),
          ft_attempted: Number(row.ft_attempted),
          plus_minus: Number(row.plus_minus),
          starter: Number(row.starter),
          period: String(row.period),
          home_team_id: String(row.home_team_id),
          away_team_id: String(row.away_team_id),
          home_team_abbreviation: String(row.home_team_abbreviation),
          away_team_abbreviation: String(row.away_team_abbreviation),
          home_team_score: Number(row.home_team_score),
          away_team_score: Number(row.away_team_score),
          result: String(row.result),
          margin: Number(row.margin)
        })) as GameLogEntry[];

        setGames(gameLog);
      } catch (error) {
        console.error('Error loading player game log:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [entityId, seasonYear, seasonType, evaluateQuery]);

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[70] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">{playerName} - Game Log</h2>
          <div className="flex items-center gap-2">
            <select
              value={seasonYear ?? ''}
              onChange={(e) => setSeasonYear(e.target.value ? Number(e.target.value) : undefined)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="">All Seasons</option>
              {getAvailableSeasons().map((year) => (
                <option key={year} value={year}>{formatSeasonLabel(year)}</option>
              ))}
            </select>
            <select
              value={seasonType}
              onChange={(e) => setSeasonType(e.target.value)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular Season</option>
              <option value="playoffs">Playoffs</option>
            </select>
            <div className="flex rounded border border-gray-300 dark:border-gray-600 text-sm">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 ${viewMode === 'table' ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1 ${viewMode === 'chart' ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
              >
                Chart
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {viewMode === 'chart' && !loading && games.length > 0 && (
          <div className="mb-4">
            <PlayerPerformanceTrend games={games} playerName={playerName} />
          </div>
        )}

        <div className={`w-full ${viewMode === 'chart' ? 'hidden' : ''}`}>
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="md:px-1 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Date</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Result</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">MIN</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PTS</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">REB</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">AST</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">STL</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">BLK</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TO</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FG</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">3P</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-8">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                    </div>
                  </td>
                </tr>
              ) : (
                games.map((game, index) => (
                  <tr key={game.game_id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200">{format(game.game_date, 'MM-dd-yy')}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200">
                      {`${game.result} [${game.margin > 0 ? '+' : game.margin < 0 ? '-' : ''}${Math.abs(game.margin)}]`}
                    </td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.minutes || '0:00'}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.points}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.rebounds}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.assists}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.steals}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.blocks}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.turnovers}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.fg_made}-{game.fg_attempted}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.fg3_made}-{game.fg3_attempted}</td>
                    <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{game.ft_made}-{game.ft_attempted}</td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
