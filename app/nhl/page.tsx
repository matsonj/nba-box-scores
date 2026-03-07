'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import NHLBoxScorePanel from '@/components/NHLBoxScorePanel';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { ScheduleWithBoxScore } from '../types/extended';
import GameCard from '@/components/GameCard';
import SeasonFilter from '@/components/SeasonFilter';
import { getNHLTeamName, NHL_TEAM_ABBREVIATIONS } from '@/lib/nhl/teams';
import { parseGameDate } from '@/lib/dateUtils';
import { nhlConfig } from '@/lib/sports/nhl';

const nhlSeasons = nhlConfig.getAvailableSeasons();
import { useNHLSchedule, useNHLBoxScores, useNHLPlayerIndex } from '@/hooks/useNHLGameData';
import { useDataLoader } from '@/lib/dataLoader';
import type { GameDataFilters, PlayerIndexEntry } from '@/hooks/useGameData';
import { useLiveData } from '@/lib/LiveDataContext';
import type { LiveScoreGame, NHLLiveBoxScoreResponse } from '@/app/types/live';
import { liveGameToSchedule } from '@/lib/sportUtils';

function groupByDate(games: ScheduleWithBoxScore[]) {
  const gamesByDate: Record<string, ScheduleWithBoxScore[]> = {};
  games.forEach((game: ScheduleWithBoxScore) => {
    if (!game.game_date) {
      return;
    }
    const dateObj = parseGameDate(game.game_date);
    const gameDate = format(dateObj, 'yyyy-MM-dd');
    if (!gamesByDate[gameDate]) {
      gamesByDate[gameDate] = [];
    }
    gamesByDate[gameDate].push({
      ...game,
      game_date: dateObj
    });
  });
  return gamesByDate;
}

const DATES_PER_PAGE = 7;

interface ScheduleGame {
  game_id: string;
  home_team_id: number;
  away_team_id: number;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  game_status: string;
  created_at: Date;
  game_date: Date;
}

function buildGamesWithBoxScores(
  scheduleData: ScheduleGame[],
  boxScoresData: Record<string, Array<{ teamId: string; period: string; points: number }>>,
) {
  return scheduleData.map((game) => {
    const hasBoxScore = !!boxScoresData[game.game_id];
    const scores = boxScoresData[game.game_id] || [];

    const homeTeam = {
      teamId: game.home_team_id.toString(),
      teamName: getNHLTeamName(game.home_team_abbreviation),
      teamAbbreviation: game.home_team_abbreviation,
      score: game.home_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.home_team_id.toString()),
    };

    const awayTeam = {
      teamId: game.away_team_id.toString(),
      teamName: getNHLTeamName(game.away_team_abbreviation),
      teamAbbreviation: game.away_team_abbreviation,
      score: game.away_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.away_team_id.toString()),
    };

    return {
      ...game,
      boxScoreLoaded: hasBoxScore,
      isPlayoff: nhlConfig.isPlayoffGame(game.game_id),
      homeTeam,
      awayTeam,
      periodScores: scores,
      created_at: new Date(),
    };
  });
}

function NHLContent() {
  const searchParams = useSearchParams();
  const [gamesByDate, setGamesByDate] = useState<Record<string, ScheduleWithBoxScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMessages, setLoadingMessages] = useState<Array<{ message: string; completed: boolean }>>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [playerIndex, setPlayerIndex] = useState<PlayerIndexEntry[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLiveGameId, setSelectedLiveGameId] = useState<string | null>(null);
  const dataLoader = useDataLoader();
  const { fetchSchedule } = useNHLSchedule();
  const { fetchBoxScores } = useNHLBoxScores();
  const { fetchPlayerIndex } = useNHLPlayerIndex();

  const {
    isLive,
    liveGames,
    liveBoxScore,
    setSubscribedGameId,
    highlightedCells,
    boldedCells,
  } = useLiveData();

  const activeLiveGames = useMemo(() => {
    if (!isLive) return [];
    return liveGames.filter((game) => {
      const status = game.status.trim().toLowerCase();
      return !status.includes('final') && status !== '' && Number(game.period) > 0;
    });
  }, [isLive, liveGames]);

  const handleLiveGameSelect = useCallback((gameId: string) => {
    setSelectedGameId(gameId);
    setSelectedLiveGameId(gameId);
    setSubscribedGameId(gameId);
  }, [setSubscribedGameId]);

  const handlePanelClose = useCallback(() => {
    setSelectedGameId(null);
    if (selectedLiveGameId) {
      setSubscribedGameId(null);
      setSelectedLiveGameId(null);
    }
  }, [selectedLiveGameId, setSubscribedGameId]);

  // Get the live game's status from the scoreboard (more reliable than boxscore API)
  const selectedLiveGame = useMemo(() => {
    if (!selectedLiveGameId) return null;
    return liveGames.find(g => g.game_id === selectedLiveGameId) ?? null;
  }, [selectedLiveGameId, liveGames]);

  // Transform NHL live box score data for NHLBoxScorePanel
  const nhlLiveBoxScoreData = useMemo(() => {
    if (!selectedLiveGameId || !liveBoxScore) return null;

    // NHL page always receives NHL-shaped box scores
    const raw = liveBoxScore as NHLLiveBoxScoreResponse;

    const mapSkaters = (team: typeof raw.homeTeam) => {
      return team.skaters.map((s) => ({
        entity_id: s.personId,
        player_name: s.playerName,
        team_abbreviation: team.teamAbbrev,
        position: s.position as string,
        toi: s.toi || '0:00',
        goals: s.goals,
        assists: s.assists,
        points: s.points,
        plus_minus: s.plusMinus,
        pim: s.pim,
        sog: s.shots,
        hits: s.hits,
        blocked_shots: s.blockedShots,
        giveaways: 0,
        takeaways: 0,
        faceoff_wins: s.faceoffWins,
        faceoff_losses: s.faceoffLosses,
      }));
    };

    const mapGoalies = (team: typeof raw.homeTeam) => {
      return team.goalies.map((g) => ({
        entity_id: g.personId,
        player_name: g.playerName,
        team_abbreviation: team.teamAbbrev,
        toi: g.toi || '0:00',
        shots_against: g.shotsAgainst,
        goals_against: g.goalsAgainst,
        saves: g.saves,
        save_pct: g.savePctg,
        starter: g.starter ? 1 : 0,
        decision: g.decision || '',
      }));
    };

    const { homeTeam, awayTeam } = raw;

    const parseToi = (toi: string): number => {
      const [m, s] = toi.split(':').map(Number);
      return (m || 0) * 60 + (s || 0);
    };

    const sortedSkaters = [...mapSkaters(awayTeam), ...mapSkaters(homeTeam)]
      .sort((a, b) => {
        if (a.team_abbreviation !== b.team_abbreviation) {
          return a.team_abbreviation.localeCompare(b.team_abbreviation);
        }
        return parseToi(b.toi) - parseToi(a.toi);
      });

    const sortedGoalies = [...mapGoalies(awayTeam), ...mapGoalies(homeTeam)]
      .filter((g) => parseToi(g.toi) > 0)
      .sort((a, b) => {
        if (a.team_abbreviation !== b.team_abbreviation) {
          return a.team_abbreviation.localeCompare(b.team_abbreviation);
        }
        return b.starter - a.starter;
      });

    return {
      skaters: sortedSkaters,
      goalies: sortedGoalies,
      schedule: {
        game_id: raw.gameId || selectedLiveGameId,
        game_date: new Date().toISOString(),
        home_team_abbreviation: homeTeam.teamAbbrev,
        away_team_abbreviation: awayTeam.teamAbbrev,
        home_team_score: homeTeam.score,
        away_team_score: awayTeam.score,
      },
      gameStatus: selectedLiveGame?.status || raw.gameStatus || '',
      lastPlay: selectedLiveGame?.lastPlay || raw.lastPlay || undefined,
    };
  }, [selectedLiveGameId, liveBoxScore, selectedLiveGame]);

  // Derive filters from URL params — default to current NHL season
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : nhlConfig.getSeasonYear(new Date());
  const seasonType = searchParams?.get('type') || undefined;
  const team = searchParams?.get('team') || '';
  const player = searchParams?.get('player') || '';

  const filters: GameDataFilters = useMemo(() => ({
    seasonYear: season,
    seasonType: seasonType as GameDataFilters['seasonType'],
  }), [season, seasonType]);

  // Client-side player search: filter the in-memory index
  const playerGameIds = useMemo(() => {
    if (!player) return null;
    const term = player.toLowerCase();
    const matchingGameIds = new Set<string>();
    for (const entry of playerIndex) {
      if (entry.player_name.toLowerCase().includes(term)) {
        for (const gid of entry.game_ids) {
          matchingGameIds.add(gid);
        }
      }
    }
    return matchingGameIds;
  }, [player, playerIndex]);

  // Autocomplete suggestions for the search dropdown
  const playerSuggestions = useMemo(() => {
    if (!player || player.length < 2) return [];
    const term = player.toLowerCase();
    const seen = new Set<string>();
    const results: Array<{ entity_id: string; player_name: string; team_abbreviation: string }> = [];
    for (const entry of playerIndex) {
      if (seen.has(entry.entity_id)) continue;
      if (entry.player_name.toLowerCase().includes(term)) {
        seen.add(entry.entity_id);
        results.push({
          entity_id: entry.entity_id,
          player_name: entry.player_name,
          team_abbreviation: entry.team_abbreviation,
        });
      }
      if (results.length >= 8) break;
    }
    return results;
  }, [player, playerIndex]);

  const filteredGamesByDate = useMemo(() => {
    if (!gamesByDate || Object.keys(gamesByDate).length === 0) return [];

    return Object.entries(
      groupByDate(
        Object.values(gamesByDate)
          .flat()
          .filter(game => {
            if (team && game.home_team_abbreviation !== team && game.away_team_abbreviation !== team) {
              return false;
            }
            if (playerGameIds && !playerGameIds.has(String(game.game_id))) {
              return false;
            }
            return true;
          })
      )
    )
      .map(([date, games]) => ({ date, games }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [gamesByDate, team, playerGameIds]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [team, season, seasonType, player]);

  const totalPages = Math.max(1, Math.ceil(filteredGamesByDate.length / DATES_PER_PAGE));
  const paginatedDates = filteredGamesByDate.slice(
    currentPage * DATES_PER_PAGE,
    (currentPage + 1) * DATES_PER_PAGE,
  );

  // Track filter changes to reload data
  const filtersKey = `${season ?? ''}-${seasonType ?? ''}`;
  const prevFiltersKey = useRef(filtersKey);
  const initialLoadComplete = useRef(false);

  const loadAllData = useCallback(async (currentFilters: GameDataFilters, isInitial: boolean) => {
    try {
      if (isInitial) {
        const updateLoadingMessage = (index: number) => {
          setLoadingMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[index]) {
              newMessages[index] = { ...newMessages[index], completed: true };
            }
            return newMessages;
          });
        };

        const addLoadingMessage = (message: string) => {
          setLoadingMessages(prev => [...prev, { message, completed: false }]);
        };

        addLoadingMessage('Loading MotherDuck Wasm...');
        await dataLoader.waitForWasm();
        updateLoadingMessage(0);

        setError('');

        addLoadingMessage('Fetching NHL game data...');
        const [scheduleData, boxScoresData, playerIndexData] = await Promise.all([
          fetchSchedule(currentFilters),
          fetchBoxScores(currentFilters),
          fetchPlayerIndex(currentFilters),
        ]);
        setPlayerIndex(playerIndexData);
        updateLoadingMessage(1);

        await new Promise(resolve => setTimeout(resolve, 100));

        const games = groupByDate(buildGamesWithBoxScores(scheduleData, boxScoresData));
        setGamesByDate(games);
        setError('');
        setLoadingMessages(prev => [
          ...prev,
          { message: 'Processing and organizing data...', completed: true },
          { message: 'Ready!', completed: true }
        ]);
      } else {
        // Subsequent filter changes: simpler reload without loading messages
        setLoading(true);
        const [scheduleData, boxScoresData, playerIndexData] = await Promise.all([
          fetchSchedule(currentFilters),
          fetchBoxScores(currentFilters),
          fetchPlayerIndex(currentFilters),
        ]);
        setPlayerIndex(playerIndexData);

        const games = groupByDate(buildGamesWithBoxScores(scheduleData, boxScoresData));
        setGamesByDate(games);
        setError('');
      }
    } catch (err) {
      console.error('Error fetching NHL games:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [dataLoader, fetchSchedule, fetchBoxScores, fetchPlayerIndex]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!initialLoadComplete.current) {
      initialLoadComplete.current = true;
      loadAllData(filters, true);
    } else if (prevFiltersKey.current !== filtersKey) {
      prevFiltersKey.current = filtersKey;
      loadAllData(filters, false);
    }
  }, [filtersKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (loading && !initialLoadComplete.current) {
    return (
      <div className="p-8 space-y-2 font-mono text-sm">
        {loadingMessages.map((msg, index) => (
          <div key={index}>
            {msg.message} {msg.completed ? '' : ''}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 font-mono">
      <SeasonFilter
        basePath="/nhl"
        playerSuggestions={playerSuggestions}
        teamAbbreviations={NHL_TEAM_ABBREVIATIONS}
        seasons={nhlSeasons}
        formatSeason={nhlConfig.formatSeasonLabel}
        defaultSeason={nhlConfig.getSeasonYear(new Date())}
      />
      <NHLBoxScorePanel
        gameId={selectedGameId}
        onClose={handlePanelClose}
        liveData={nhlLiveBoxScoreData}
        highlightedCells={selectedLiveGameId ? highlightedCells : undefined}
        boldedCells={selectedLiveGameId ? boldedCells : undefined}
      />

      {/* Live Games Section */}
      {isLive && activeLiveGames.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            Live Games
          </h2>
          <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {activeLiveGames.map((game) => (
              <div key={game.game_id}>
                <GameCard
                  game={liveGameToSchedule(game)}
                  onGameSelect={handleLiveGameSelect}
                  regularPeriods={nhlConfig.regularPeriods}
                  maxPeriods={nhlConfig.maxPeriods}
                  liveStatus={{ period: game.period, clock: game.clock, status: game.status }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading games...</span>
        </div>
      ) : (
        <>
          {paginatedDates.map(({ date, games }) => {
            if (games.length === 0) return null;

            return (
              <div key={date} className="mb-8">
                <h2 className="text-xl font-bold mb-4">
                  {format(parseISO(date), 'EEEE, MMMM do')}
                </h2>
                <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                  {games.map((game) => (
                    <div key={game.game_id}>
                      <GameCard
                        game={game}
                        onGameSelect={setSelectedGameId}
                        regularPeriods={nhlConfig.regularPeriods}
                        maxPeriods={nhlConfig.maxPeriods}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function NhlPage() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-2 font-mono text-sm">
        <div>Loading...</div>
      </div>
    }>
      <NHLContent />
    </Suspense>
  );
}
