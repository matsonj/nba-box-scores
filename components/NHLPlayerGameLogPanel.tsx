'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { NHL_SOURCE_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import { sanitizeNumericId } from '@/lib/queryUtils';
import { format } from 'date-fns';

interface NHLPlayerGameLogPanelProps {
  entityId: string;
  playerName: string;
  onClose: () => void;
}

interface NHLGameLogEntry {
  game_date: Date;
  game_id: string;
  team_abbreviation: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  result: string;
  margin: number;
  toi: string;
  goals: number;
  assists: number;
  points: number;
  plus_minus: number;
  pim: number;
  shots: number;
  hits: number;
  blocked_shots: number;
  takeaways: number;
  giveaways: number;
}

export default function NHLPlayerGameLogPanel({ entityId, playerName, onClose }: NHLPlayerGameLogPanelProps) {
  const searchParams = useSearchParams();
  const seasonYear = searchParams?.get('season') ? Number(searchParams.get('season')) : 2024;
  const seasonType = searchParams?.get('type') || 'all';

  const [games, setGames] = useState<NHLGameLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
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

        await evaluateQuery(`ATTACH IF NOT EXISTS 'md:nhl_box_scores'`);

        const result = await evaluateQuery(`
          SELECT
            b.game_id, b.team_abbreviation, b.toi, b.goals, b.assists, b.points,
            b.plus_minus, b.pim, b.shots, b.hits, b.blocked_shots, b.takeaways, b.giveaways,
            s.game_date, s.home_team_abbreviation, s.away_team_abbreviation,
            s.home_team_score, s.away_team_score,
            CASE
              WHEN b.team_abbreviation = s.home_team_abbreviation THEN
                CASE WHEN s.home_team_score > s.away_team_score THEN 'W'
                     WHEN s.home_team_score < s.away_team_score THEN 'L' ELSE 'T' END
              ELSE
                CASE WHEN s.away_team_score > s.home_team_score THEN 'W'
                     WHEN s.away_team_score < s.home_team_score THEN 'L' ELSE 'T' END
            END AS result,
            CASE
              WHEN b.team_abbreviation = s.home_team_abbreviation THEN s.home_team_score - s.away_team_score
              ELSE s.away_team_score - s.home_team_score
            END AS margin
          FROM ${NHL_SOURCE_TABLES.SKATER_STATS} b
          JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON b.game_id = s.game_id
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
          team_abbreviation: String(row.team_abbreviation),
          home_team_abbreviation: String(row.home_team_abbreviation),
          away_team_abbreviation: String(row.away_team_abbreviation),
          home_team_score: Number(row.home_team_score),
          away_team_score: Number(row.away_team_score),
          result: String(row.result),
          margin: Number(row.margin),
          toi: String(row.toi),
          goals: Number(row.goals),
          assists: Number(row.assists),
          points: Number(row.points),
          plus_minus: Number(row.plus_minus),
          pim: Number(row.pim),
          shots: Number(row.shots),
          hits: Number(row.hits),
          blocked_shots: Number(row.blocked_shots),
          takeaways: Number(row.takeaways),
          giveaways: Number(row.giveaways),
        }));

        setGames(gameLog);
      } catch (error) {
        console.error('Error loading NHL player game log:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
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
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-full table-auto text-xs font-mono">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-1 py-0.5 text-left dark:text-gray-200">Date</th>
                <th className="px-1 py-0.5 text-left dark:text-gray-200">Result</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">TOI</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">G</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">A</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">PTS</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">+/-</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">PIM</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">SOG</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">HIT</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">BLK</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">TK</th>
                <th className="px-1 py-0.5 text-right dark:text-gray-200">GV</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="text-center py-8">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                    </div>
                  </td>
                </tr>
              ) : (
                games.map((game, index) => (
                  <tr key={game.game_id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-1 py-0.5 dark:text-gray-200">{format(game.game_date, 'MM-dd')}</td>
                    <td className="px-1 py-0.5 dark:text-gray-200">
                      {`${game.result} ${game.margin > 0 ? '+' : ''}${game.margin}`}
                    </td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.toi}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.goals}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.assists}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200 font-bold">{game.points}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.plus_minus > 0 ? `+${game.plus_minus}` : game.plus_minus}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.pim}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.shots}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.hits}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.blocked_shots}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.takeaways}</td>
                    <td className="px-1 py-0.5 text-right dark:text-gray-200">{game.giveaways}</td>
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
