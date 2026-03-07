'use client';

import { useEffect, useState, useRef } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { getNHLTeamName } from '@/lib/nhl/teams';
import { sanitizeNumericId } from '@/lib/queryUtils';
import { NHL_TEMP_TABLES } from '@/constants/tables';
import NHLPlayerGameLogPanel from './NHLPlayerGameLogPanel';

interface NHLLiveBoxScoreData {
  skaters: SkaterRow[];
  goalies: GoalieRow[];
  schedule: ScheduleRow;
  gameStatus: string;
  lastPlay?: string;
}

type CellState = 'active' | 'fading';

interface NHLBoxScorePanelProps {
  gameId: string | null;
  onClose: () => void;
  liveData?: NHLLiveBoxScoreData | null;
  highlightedCells?: Map<string, CellState>;
  boldedCells?: Map<string, CellState>;
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
  entity_id: string;
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

export default function NHLBoxScorePanel({ gameId, onClose, liveData, highlightedCells, boldedCells }: NHLBoxScorePanelProps) {
  const [skaters, setSkaters] = useState<SkaterRow[]>([]);
  const [goalies, setGoalies] = useState<GoalieRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ entityId: string; name: string; type: 'skater' | 'goalie' } | null>(null);
  const { evaluateQuery } = useMotherDuckClientState();
  const panelRef = useRef<HTMLDivElement>(null);

  const isLiveView = !!liveData;
  const displaySkaters = isLiveView ? liveData.skaters : skaters;
  const displayGoalies = (isLiveView ? liveData.goalies : goalies)
    .filter((g) => g.toi !== '0:00' && g.toi !== '00:00' && g.toi !== '');
  const displaySchedule = isLiveView ? liveData.schedule : schedule;

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
    if (!gameId || isLiveView) return;

    let cancelled = false;
    setLoading(true);
    setSkaters([]);
    setGoalies([]);
    setSchedule(null);

    const loadData = async () => {
      try {
        const safeGameId = sanitizeNumericId(gameId);

        const [skaterResult, goalieResult, scheduleResult] = await Promise.all([
          evaluateQuery(
            `SELECT * FROM ${NHL_TEMP_TABLES.SKATER_STATS} WHERE game_id = '${safeGameId}' AND period = 'FullGame' ORDER BY team_abbreviation, toi DESC`
          ),
          evaluateQuery(
            `SELECT * FROM ${NHL_TEMP_TABLES.GOALIE_STATS} WHERE game_id = '${safeGameId}' AND period = 'FullGame' ORDER BY team_abbreviation, starter DESC`
          ),
          evaluateQuery(
            `SELECT * FROM ${NHL_TEMP_TABLES.SCHEDULE} WHERE game_id = '${safeGameId}'`
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
          entity_id: String(row.entity_id),
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
  }, [gameId, evaluateQuery, isLiveView]);

  const handleClose = () => {
    setSkaters([]);
    setGoalies([]);
    setSchedule(null);
    onClose();
  };

  if (!gameId) return null;

  // Highlight helper: looks up personId:apiField in the highlight/bold maps
  const getCellClasses = (personId: string, apiField: string): string => {
    if (!highlightedCells && !boldedCells) return '';
    const key = `${personId}:${apiField}`;
    const classes: string[] = [];

    const hState = highlightedCells?.get(key);
    if (hState === 'active') classes.push('live-highlight-active');
    else if (hState === 'fading') classes.push('live-highlight-fading');

    const bState = boldedCells?.get(key);
    if (bState === 'active') classes.push('live-bold-active');
    else if (bState === 'fading') classes.push('live-bold-fading');

    return classes.join(' ');
  };

  const formatSavePct = (pct: number): string => {
    if (pct === 0) return '-';
    return pct.toFixed(3).replace(/^0/, '');
  };

  const renderTeamSkaters = (teamAbbr: string, players: SkaterRow[]) => (
    <div className="mb-4">
      <h3 className="font-bold text-lg mb-1 dark:text-white">
        {getNHLTeamName(teamAbbr)} - Skaters
      </h3>
      <div className="w-full">
        <table className="min-w-full table-fixed tabular-nums">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[5%]" />
            <col className="w-[8%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="md:px-2 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Player</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-center md:text-base text-xs dark:text-gray-200 bg-transparent">POS</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TOI</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">G</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">A</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PTS</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">+/-</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PIM</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">SOG</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">HIT</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">BLK</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">GV</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TK</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={`${p.player_name}-${i}`}
                className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}
              >
                <td
                  className="md:px-2 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => setSelectedPlayer({ entityId: p.entity_id, name: p.player_name, type: 'skater' })}
                >{p.player_name}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-center md:text-base text-xs dark:text-gray-200">{p.position}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'toi')}>{p.toi}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'goals')}>{p.goals}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'assists')}>{p.assists}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'points')}>{p.points}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'plusMinus')}>{p.plus_minus > 0 ? `+${p.plus_minus}` : p.plus_minus}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'pim')}>{p.pim}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'shots')}>{p.sog}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'hits')}>{p.hits}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(p.entity_id, 'blockedShots')}>{p.blocked_shots}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{p.giveaways}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{p.takeaways}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTeamGoalies = (teamAbbr: string, players: GoalieRow[]) => (
    <div className="mb-6">
      <h3 className="font-bold text-lg mb-1 dark:text-white">
        {getNHLTeamName(teamAbbr)} - Goalies
      </h3>
      <div className="w-full">
        <table className="min-w-full table-fixed tabular-nums">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="md:px-2 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Player</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TOI</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">SA</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">GA</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">SV</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">SV%</th>
              <th className="md:px-2 md:py-0.5 p-0.5 text-center md:text-base text-xs dark:text-gray-200 bg-transparent">DEC</th>
            </tr>
          </thead>
          <tbody>
            {players.map((g, i) => (
              <tr
                key={`${g.player_name}-${i}`}
                className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}
              >
                <td
                  className="md:px-2 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => setSelectedPlayer({ entityId: g.entity_id, name: g.player_name, type: 'goalie' })}
                >{g.player_name}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(g.entity_id, 'toi')}>{g.toi}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(g.entity_id, 'shotsAgainst')}>{g.shots_against}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(g.entity_id, 'goalsAgainst')}>{g.goals_against}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(g.entity_id, 'saves')}>{g.saves}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200"><span className={getCellClasses(g.entity_id, 'savePctg')}>{formatSavePct(g.save_pct)}</span></td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-center md:text-base text-xs dark:text-gray-200">{g.decision || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Group players by team
  const teams = displaySchedule
    ? [displaySchedule.away_team_abbreviation, displaySchedule.home_team_abbreviation]
    : [...new Set(displaySkaters.map((s) => s.team_abbreviation))];

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
          <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5">
            {isLiveView && (
              <div className="flex items-center gap-1.5 mr-1">
                <span className="relative inline-flex items-center justify-center w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span className="absolute inline-block w-3.5 h-3.5 rounded-full bg-green-500 opacity-30 animate-ping" />
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">LIVE</span>
              </div>
            )}
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
            {loading && !isLiveView ? (
              <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400" />
              </div>
            ) : displaySchedule && displaySkaters.length === 0 && displayGoalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-gray-500 dark:text-gray-400">
                <p className="text-lg">No box score data available for this game yet.</p>
                <p className="text-sm mt-2">Try an earlier game — data is being backfilled.</p>
              </div>
            ) : displaySchedule ? (
              <>
                <div className="mb-3">
                  <h2 className="md:text-2xl text-lg text-center dark:text-white">
                    {displaySchedule.away_team_score > displaySchedule.home_team_score ? (
                      <>
                        <span className="font-bold">* {displaySchedule.away_team_abbreviation} {displaySchedule.away_team_score}</span>
                        {' - '}
                        <span>{displaySchedule.home_team_abbreviation} {displaySchedule.home_team_score}</span>
                      </>
                    ) : (
                      <>
                        <span>{displaySchedule.away_team_abbreviation} {displaySchedule.away_team_score}</span>
                        {' - '}
                        <span className="font-bold">{displaySchedule.home_team_abbreviation} {displaySchedule.home_team_score} *</span>
                      </>
                    )}
                  </h2>
                  {isLiveView && liveData ? (
                    <>
                      <p className="text-gray-500 dark:text-gray-400 text-center mt-1 text-base">
                        {liveData.gameStatus}
                      </p>
                      {liveData.lastPlay && (
                        <p className="text-gray-500 dark:text-gray-400 text-center mt-1 text-sm italic truncate max-w-md mx-auto">
                          {liveData.lastPlay}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-center mt-1 md:text-base text-sm">
                      {new Date(displaySchedule.game_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)', padding: 0, paddingRight: '2px' }}>
                  {teams.map((teamAbbr) => {
                    const teamSkaters = displaySkaters.filter((s) => s.team_abbreviation === teamAbbr);
                    const teamGoalies = displayGoalies.filter((g) => g.team_abbreviation === teamAbbr);
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
            <div className="fixed inset-0 z-[60] bg-black bg-opacity-50">
              <NHLPlayerGameLogPanel
                entityId={selectedPlayer.entityId}
                playerName={selectedPlayer.name}
                playerType={selectedPlayer.type}
                onClose={() => setSelectedPlayer(null)}
                isLive={isLiveView}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
