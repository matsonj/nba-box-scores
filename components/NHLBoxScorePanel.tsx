'use client';

import { useEffect, useState, useRef } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { getNHLTeamName } from '@/lib/nhl/teams';
import { sanitizeNumericId } from '@/lib/queryUtils';
import NHLPlayerGameLogPanel from './NHLPlayerGameLogPanel';

interface NHLBoxScorePanelProps {
  gameId: string | null;
  onClose: () => void;
}

interface SkaterRow {
  entity_id: string;
  player_name: string;
  team_abbreviation: string;
  position: string;
  toi: string;
  goals: number;
  assists: number;
  points: number;
  plus_minus: number;
  pim: number;
  sog: number;
  hits: number;
  blocked_shots: number;
  giveaways: number;
  takeaways: number;
  faceoff_wins: number;
  faceoff_losses: number;
}

interface GoalieRow {
  player_name: string;
  team_abbreviation: string;
  toi: string;
  shots_against: number;
  goals_against: number;
  saves: number;
  save_pct: number;
  starter: number;
  decision: string;
}

interface ScheduleRow {
  game_id: string;
  game_date: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
}

export default function NHLBoxScorePanel({ gameId, onClose }: NHLBoxScorePanelProps) {
  const [skaters, setSkaters] = useState<SkaterRow[]>([]);
  const [goalies, setGoalies] = useState<GoalieRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ entityId: string; name: string } | null>(null);
  const { evaluateQuery } = useMotherDuckClientState();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (gameId) {
      document.body.style.overflow = 'hidden';
      panelRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;
    setLoading(true);
    setSkaters([]);
    setGoalies([]);
    setSchedule(null);

    const loadData = async () => {
      try {
        const safeGameId = sanitizeNumericId(gameId);

        await evaluateQuery(`ATTACH IF NOT EXISTS 'md:nhl_box_scores'`);

        const [skaterResult, goalieResult, scheduleResult] = await Promise.all([
          evaluateQuery(
            `SELECT * FROM nhl_box_scores.main.skater_stats WHERE game_id = '${safeGameId}' AND period = 'FullGame' ORDER BY team_abbreviation, CASE WHEN position = 'F' THEN 0 ELSE 1 END, toi DESC`
          ),
          evaluateQuery(
            `SELECT * FROM nhl_box_scores.main.goalie_stats WHERE game_id = '${safeGameId}' AND period = 'FullGame' ORDER BY team_abbreviation, starter DESC`
          ),
          evaluateQuery(
            `SELECT * FROM nhl_box_scores.main.schedule WHERE game_id = '${safeGameId}'`
          ),
        ]);

        if (cancelled) return;

        const skaterRows = [...skaterResult.data.toRows()].map((row) => ({
          entity_id: String(row.entity_id),
          player_name: String(row.player_name),
          team_abbreviation: String(row.team_abbreviation),
          position: String(row.position),
          toi: String(row.toi),
          goals: Number(row.goals),
          assists: Number(row.assists),
          points: Number(row.points),
          plus_minus: Number(row.plus_minus),
          pim: Number(row.pim),
          sog: Number(row.shots),
          hits: Number(row.hits),
          blocked_shots: Number(row.blocked_shots),
          giveaways: Number(row.giveaways),
          takeaways: Number(row.takeaways),
          faceoff_wins: Number(row.faceoff_wins),
          faceoff_losses: Number(row.faceoff_losses),
        })) as SkaterRow[];

        const goalieRows = [...goalieResult.data.toRows()].map((row) => ({
          player_name: String(row.player_name),
          team_abbreviation: String(row.team_abbreviation),
          toi: String(row.toi),
          shots_against: Number(row.shots_against),
          goals_against: Number(row.goals_against),
          saves: Number(row.saves),
          save_pct: Number(row.save_pct),
          starter: Number(row.starter),
          decision: String(row.decision ?? ''),
        })) as GoalieRow[];

        const scheduleRows = [...scheduleResult.data.toRows()];
        const sched = scheduleRows[0];

        if (!cancelled) {
          setSkaters(skaterRows);
          setGoalies(goalieRows);
          if (sched) {
            setSchedule({
              game_id: String(sched.game_id),
              game_date: String(sched.game_date),
              home_team_abbreviation: String(sched.home_team_abbreviation),
              away_team_abbreviation: String(sched.away_team_abbreviation),
              home_team_score: Number(sched.home_team_score),
              away_team_score: Number(sched.away_team_score),
            });
          }
        }
      } catch (error) {
        console.error('Error loading NHL box score:', error);
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
  }, [gameId, evaluateQuery]);

  const handleClose = () => {
    setSkaters([]);
    setGoalies([]);
    setSchedule(null);
    onClose();
  };

  if (!gameId) return null;

  const formatFaceoffPct = (wins: number, losses: number): string => {
    const total = wins + losses;
    if (total === 0) return '-';
    return ((wins / total) * 100).toFixed(1);
  };

  const formatSavePct = (pct: number): string => {
    if (pct === 0) return '-';
    return pct.toFixed(3).replace(/^0/, '');
  };

  const renderTeamSkaters = (teamAbbr: string, players: SkaterRow[]) => (
    <div className="mb-4">
      <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">
        {getNHLTeamName(teamAbbr)} - Skaters
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="text-left py-1 px-1 sticky left-0 bg-white dark:bg-gray-900 min-w-[120px]">Player</th>
              <th className="text-center py-1 px-1 min-w-[32px]">POS</th>
              <th className="text-right py-1 px-1 min-w-[40px]">TOI</th>
              <th className="text-right py-1 px-1 min-w-[24px]">G</th>
              <th className="text-right py-1 px-1 min-w-[24px]">A</th>
              <th className="text-right py-1 px-1 min-w-[28px]">PTS</th>
              <th className="text-right py-1 px-1 min-w-[28px]">+/-</th>
              <th className="text-right py-1 px-1 min-w-[28px]">PIM</th>
              <th className="text-right py-1 px-1 min-w-[28px]">SOG</th>
              <th className="text-right py-1 px-1 min-w-[28px]">HIT</th>
              <th className="text-right py-1 px-1 min-w-[28px]">BLK</th>
              <th className="text-right py-1 px-1 min-w-[24px]">GV</th>
              <th className="text-right py-1 px-1 min-w-[24px]">TK</th>
              <th className="text-right py-1 px-1 min-w-[36px]">FO%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={`${p.player_name}-${i}`}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="text-left py-1 px-1 sticky left-0 bg-white dark:bg-gray-900 truncate max-w-[140px]">
                  <button
                    className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                    onClick={() => setSelectedPlayer({ entityId: p.entity_id, name: p.player_name })}
                  >
                    {p.player_name}
                  </button>
                </td>
                <td className="text-center py-1 px-1">{p.position}</td>
                <td className="text-right py-1 px-1">{p.toi}</td>
                <td className="text-right py-1 px-1">{p.goals}</td>
                <td className="text-right py-1 px-1">{p.assists}</td>
                <td className="text-right py-1 px-1">{p.points}</td>
                <td className="text-right py-1 px-1">{p.plus_minus > 0 ? `+${p.plus_minus}` : p.plus_minus}</td>
                <td className="text-right py-1 px-1">{p.pim}</td>
                <td className="text-right py-1 px-1">{p.sog}</td>
                <td className="text-right py-1 px-1">{p.hits}</td>
                <td className="text-right py-1 px-1">{p.blocked_shots}</td>
                <td className="text-right py-1 px-1">{p.giveaways}</td>
                <td className="text-right py-1 px-1">{p.takeaways}</td>
                <td className="text-right py-1 px-1">{formatFaceoffPct(p.faceoff_wins, p.faceoff_losses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTeamGoalies = (teamAbbr: string, players: GoalieRow[]) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">
        {getNHLTeamName(teamAbbr)} - Goalies
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="text-left py-1 px-1 sticky left-0 bg-white dark:bg-gray-900 min-w-[120px]">Player</th>
              <th className="text-right py-1 px-1 min-w-[40px]">TOI</th>
              <th className="text-right py-1 px-1 min-w-[28px]">SA</th>
              <th className="text-right py-1 px-1 min-w-[28px]">GA</th>
              <th className="text-right py-1 px-1 min-w-[28px]">SV</th>
              <th className="text-right py-1 px-1 min-w-[40px]">SV%</th>
              <th className="text-center py-1 px-1 min-w-[32px]">DEC</th>
            </tr>
          </thead>
          <tbody>
            {players.map((g, i) => (
              <tr
                key={`${g.player_name}-${i}`}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="text-left py-1 px-1 sticky left-0 bg-white dark:bg-gray-900 truncate max-w-[140px]">{g.player_name}</td>
                <td className="text-right py-1 px-1">{g.toi}</td>
                <td className="text-right py-1 px-1">{g.shots_against}</td>
                <td className="text-right py-1 px-1">{g.goals_against}</td>
                <td className="text-right py-1 px-1">{g.saves}</td>
                <td className="text-right py-1 px-1">{formatSavePct(g.save_pct)}</td>
                <td className="text-center py-1 px-1">{g.decision || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Group players by team
  const teams = schedule
    ? [schedule.away_team_abbreviation, schedule.home_team_abbreviation]
    : [...new Set(skaters.map((s) => s.team_abbreviation))];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg p-3 ml-auto w-[80vw] h-full shadow-lg transition-transform duration-300 translate-x-0"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="relative h-full">
          <div className="absolute top-2 right-2 z-50">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Close panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-3 md:text-base text-xs">
            {loading ? (
              <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400" />
              </div>
            ) : schedule && skaters.length === 0 && goalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-gray-500 dark:text-gray-400">
                <p className="text-lg">No box score data available for this game yet.</p>
                <p className="text-sm mt-2">Try an earlier game — data is being backfilled.</p>
              </div>
            ) : schedule ? (
              <>
                <div className="mb-3">
                  <h2 className="md:text-2xl text-lg text-center dark:text-white">
                    {schedule.away_team_score > schedule.home_team_score ? (
                      <>
                        <span className="font-bold">* {schedule.away_team_abbreviation} {schedule.away_team_score}</span>
                        {' - '}
                        <span>{schedule.home_team_abbreviation} {schedule.home_team_score}</span>
                      </>
                    ) : (
                      <>
                        <span>{schedule.away_team_abbreviation} {schedule.away_team_score}</span>
                        {' - '}
                        <span className="font-bold">{schedule.home_team_abbreviation} {schedule.home_team_score} *</span>
                      </>
                    )}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-center mt-1 md:text-base text-sm">
                    {new Date(schedule.game_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)', padding: 0, paddingRight: '2px' }}>
                  {teams.map((teamAbbr) => {
                    const teamSkaters = skaters.filter((s) => s.team_abbreviation === teamAbbr);
                    const teamGoalies = goalies.filter((g) => g.team_abbreviation === teamAbbr);
                    return (
                      <div key={teamAbbr}>
                        {renderTeamSkaters(teamAbbr, teamSkaters)}
                        {renderTeamGoalies(teamAbbr, teamGoalies)}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          {selectedPlayer && (
            <NHLPlayerGameLogPanel
              entityId={selectedPlayer.entityId}
              playerName={selectedPlayer.name}
              onClose={() => setSelectedPlayer(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
