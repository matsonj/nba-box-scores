'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { NHL_SOURCE_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import { sanitizeNumericId } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { nhlConfig } from '@/lib/sports/nhl';

interface NHLPlayerGameLogPanelProps {
  entityId: string;
  playerName: string;
  playerType: 'skater' | 'goalie';
  onClose: () => void;
}

interface SkaterGameLogEntry {
  game_date: Date;
  game_id: string;
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

interface GoalieGameLogEntry {
  game_date: Date;
  game_id: string;
  result: string;
  margin: number;
  toi: string;
  shots_against: number;
  goals_against: number;
  saves: number;
  save_pct: number;
  decision: string;
}

const RESULT_CASE = `
  CASE
    WHEN b.team_abbreviation = s.home_team_abbreviation THEN
      CASE WHEN s.home_team_score > s.away_team_score THEN 'W'
           WHEN s.home_team_score < s.away_team_score THEN 'L' ELSE 'T' END
    ELSE
      CASE WHEN s.away_team_score > s.home_team_score THEN 'W'
           WHEN s.away_team_score < s.home_team_score THEN 'L' ELSE 'T' END
  END AS result`;

const MARGIN_CASE = `
  CASE
    WHEN b.team_abbreviation = s.home_team_abbreviation THEN s.home_team_score - s.away_team_score
    ELSE s.away_team_score - s.home_team_score
  END AS margin`;

function formatResult(result: string, margin: number): string {
  return `${result} [${margin > 0 ? '+' : margin < 0 ? '-' : ''}${Math.abs(margin)}]`;
}

function formatSavePct(pct: number): string {
  if (pct === 0) return '-';
  return pct.toFixed(3).replace(/^0/, '');
}

const cellClass = "md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200";
const cellClassRight = `${cellClass} text-right`;
const headerClass = `${cellClass} bg-transparent`;
const headerClassRight = `${cellClassRight} bg-transparent`;

export default function NHLPlayerGameLogPanel({ entityId, playerName, playerType, onClose }: NHLPlayerGameLogPanelProps) {
  const searchParams = useSearchParams();
  const seasonYear = searchParams?.get('season') ? Number(searchParams.get('season')) : nhlConfig.getSeasonYear(new Date());
  const seasonType = searchParams?.get('type') || 'all';

  const [skaterGames, setSkaterGames] = useState<SkaterGameLogEntry[]>([]);
  const [goalieGames, setGoalieGames] = useState<GoalieGameLogEntry[]>([]);
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

        const seasonFilter = [
          seasonYear ? `AND s.season_year = ${Number(seasonYear)}` : '',
          seasonType === 'regular' ? `AND s.season_type = 'Regular Season'` : '',
          seasonType === 'playoffs' ? `AND s.season_type = 'Playoffs'` : '',
        ].join('\n');

        if (playerType === 'goalie') {
          const result = await evaluateQuery(`
            SELECT
              b.game_id, b.team_abbreviation, b.toi,
              b.shots_against, b.goals_against, b.saves, b.save_pct, b.decision,
              s.game_date, s.home_team_abbreviation, s.away_team_abbreviation,
              s.home_team_score, s.away_team_score,
              ${RESULT_CASE},
              ${MARGIN_CASE}
            FROM ${NHL_SOURCE_TABLES.GOALIE_STATS} b
            JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON b.game_id = s.game_id
            WHERE b.entity_id = '${safeEntityId}' AND b.period = 'FullGame'
            ${seasonFilter}
            ORDER BY s.game_date DESC
          `);

          if (cancelled) return;

          setGoalieGames([...result.data.toRows()].map(row => ({
            game_date: utcToLocalDate(String(row.game_date)),
            game_id: String(row.game_id),
            result: String(row.result),
            margin: Number(row.margin),
            toi: String(row.toi),
            shots_against: Number(row.shots_against),
            goals_against: Number(row.goals_against),
            saves: Number(row.saves),
            save_pct: Number(row.save_pct),
            decision: String(row.decision ?? ''),
          })));
        } else {
          const result = await evaluateQuery(`
            SELECT
              b.game_id, b.team_abbreviation, b.toi, b.goals, b.assists, b.points,
              b.plus_minus, b.pim, b.shots, b.hits, b.blocked_shots, b.takeaways, b.giveaways,
              s.game_date, s.home_team_abbreviation, s.away_team_abbreviation,
              s.home_team_score, s.away_team_score,
              ${RESULT_CASE},
              ${MARGIN_CASE}
            FROM ${NHL_SOURCE_TABLES.SKATER_STATS} b
            JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON b.game_id = s.game_id
            WHERE b.entity_id = '${safeEntityId}' AND b.period = 'FullGame'
            ${seasonFilter}
            ORDER BY s.game_date DESC
          `);

          if (cancelled) return;

          setSkaterGames([...result.data.toRows()].map(row => ({
            game_date: utcToLocalDate(String(row.game_date)),
            game_id: String(row.game_id),
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
          })));
        }
      } catch (error) {
        console.error('Error loading NHL player game log:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [entityId, playerType, seasonYear, seasonType, evaluateQuery]);

  const renderSkaterTable = () => (
    <table className="min-w-full table-auto">
      <thead>
        <tr className="bg-gray-100 dark:bg-gray-700">
          <th className={`${headerClass} text-left`}>Date</th>
          <th className={`${headerClass} text-left`}>Result</th>
          <th className={headerClassRight}>TOI</th>
          <th className={headerClassRight}>G</th>
          <th className={headerClassRight}>A</th>
          <th className={headerClassRight}>PTS</th>
          <th className={headerClassRight}>+/-</th>
          <th className={headerClassRight}>PIM</th>
          <th className={headerClassRight}>SOG</th>
          <th className={headerClassRight}>HIT</th>
          <th className={headerClassRight}>BLK</th>
          <th className={headerClassRight}>TK</th>
          <th className={headerClassRight}>GV</th>
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
          skaterGames.map((game, index) => (
            <tr key={game.game_id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
              <td className={cellClass}>{format(game.game_date, 'MM-dd-yy')}</td>
              <td className={cellClass}>{formatResult(game.result, game.margin)}</td>
              <td className={cellClassRight}>{game.toi}</td>
              <td className={cellClassRight}>{game.goals}</td>
              <td className={cellClassRight}>{game.assists}</td>
              <td className={cellClassRight}>{game.points}</td>
              <td className={cellClassRight}>{game.plus_minus > 0 ? `+${game.plus_minus}` : game.plus_minus}</td>
              <td className={cellClassRight}>{game.pim}</td>
              <td className={cellClassRight}>{game.shots}</td>
              <td className={cellClassRight}>{game.hits}</td>
              <td className={cellClassRight}>{game.blocked_shots}</td>
              <td className={cellClassRight}>{game.takeaways}</td>
              <td className={cellClassRight}>{game.giveaways}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  const renderGoalieTable = () => (
    <table className="min-w-full table-auto">
      <thead>
        <tr className="bg-gray-100 dark:bg-gray-700">
          <th className={`${headerClass} text-left`}>Date</th>
          <th className={`${headerClass} text-left`}>Result</th>
          <th className={headerClassRight}>TOI</th>
          <th className={headerClassRight}>SA</th>
          <th className={headerClassRight}>GA</th>
          <th className={headerClassRight}>SV</th>
          <th className={headerClassRight}>SV%</th>
          <th className={`${headerClass} text-center`}>DEC</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={8} className="text-center py-8">
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            </td>
          </tr>
        ) : (
          goalieGames.map((game, index) => (
            <tr key={game.game_id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
              <td className={cellClass}>{format(game.game_date, 'MM-dd-yy')}</td>
              <td className={cellClass}>{formatResult(game.result, game.margin)}</td>
              <td className={cellClassRight}>{game.toi}</td>
              <td className={cellClassRight}>{game.shots_against}</td>
              <td className={cellClassRight}>{game.goals_against}</td>
              <td className={cellClassRight}>{game.saves}</td>
              <td className={cellClassRight}>{formatSavePct(game.save_pct)}</td>
              <td className={`${cellClass} text-center`}>{game.decision || '-'}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

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

        <div className="w-full">
          {playerType === 'goalie' ? renderGoalieTable() : renderSkaterTable()}
        </div>
      </div>
    </div>
  );
}
