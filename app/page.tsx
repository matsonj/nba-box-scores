'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { ScheduleWithBoxScore } from './types/extended';
import BoxScorePanel from '@/components/BoxScorePanel';
import GameCard from '@/components/GameCard';
import SeasonFilter from '@/components/SeasonFilter';
import { getTeamName } from '@/lib/teams';
import { parseGameDate } from '@/lib/dateUtils';
import { useSchedule, useBoxScores, usePlayerSearch } from '@/hooks/useGameData';
import { useDataLoader } from '@/lib/dataLoader';
import { isPlayoffGame } from '@/lib/seasonUtils';
import type { SeasonType } from '@/lib/seasonUtils';
import type { GameDataFilters } from '@/hooks/useGameData';
import dynamic from 'next/dynamic';

const DynamicTableLoader = dynamic(
  () => import('@/components/DynamicTableLoader'),
  { ssr: false }
);

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

function HomeContent() {
  const searchParams = useSearchParams();
  const [gamesByDate, setGamesByDate] = useState<Record<string, ScheduleWithBoxScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMessages, setLoadingMessages] = useState<Array<{ message: string; completed: boolean }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [playerGameIds, setPlayerGameIds] = useState<Set<string> | null>(null);
  const dataLoader = useDataLoader();
  const { fetchSchedule } = useSchedule();
  const { fetchBoxScores } = useBoxScores();
  const { searchPlayerGameIds } = usePlayerSearch();

  // Derive filters from URL params
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : undefined;
  const seasonType = (searchParams?.get('type') as SeasonType) || undefined;
  const team = searchParams?.get('team') || '';
  const player = searchParams?.get('player') || '';

  const filters: GameDataFilters = useMemo(() => ({
    seasonYear: season,
    seasonType: seasonType,
  }), [season, seasonType]);

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
            if (playerGameIds && !playerGameIds.has(game.game_id)) {
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

  // Debounced player search
  useEffect(() => {
    if (!player) {
      setPlayerGameIds(null);
      return;
    }
    const timer = setTimeout(() => {
      searchPlayerGameIds(player).then(setPlayerGameIds).catch(() => setPlayerGameIds(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [player, searchPlayerGameIds]);

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

        addLoadingMessage('Initializing essential tables...');
        await dataLoader.loadEssentialTables();
        updateLoadingMessage(1);

        setError('');

        addLoadingMessage('Fetching game data...');
        const [scheduleData, boxScoresData] = await Promise.all([
          fetchSchedule(currentFilters),
          fetchBoxScores(currentFilters)
        ]);
        updateLoadingMessage(2);

        await new Promise(resolve => setTimeout(resolve, 100));

        const gamesWithBoxScores = scheduleData.map((game) => {
          const hasBoxScore = !!boxScoresData[game.game_id];
          const scores = boxScoresData[game.game_id] || [];

          const homeTeam = {
            teamId: game.home_team_id.toString(),
            teamName: getTeamName(game.home_team_id.toString()),
            teamAbbreviation: game.home_team_abbreviation,
            score: game.home_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.home_team_id.toString())
          };

          const awayTeam = {
            teamId: game.away_team_id.toString(),
            teamName: getTeamName(game.away_team_id.toString()),
            teamAbbreviation: game.away_team_abbreviation,
            score: game.away_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.away_team_id.toString())
          };

          return {
            ...game,
            boxScoreLoaded: hasBoxScore,
            isPlayoff: isPlayoffGame(game.game_id),
            homeTeam,
            awayTeam,
            periodScores: scores,
            created_at: new Date()
          };
        });

        const games = groupByDate(gamesWithBoxScores);
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
        const [scheduleData, boxScoresData] = await Promise.all([
          fetchSchedule(currentFilters),
          fetchBoxScores(currentFilters)
        ]);

        const gamesWithBoxScores = scheduleData.map((game) => {
          const hasBoxScore = !!boxScoresData[game.game_id];
          const scores = boxScoresData[game.game_id] || [];

          const homeTeam = {
            teamId: game.home_team_id.toString(),
            teamName: getTeamName(game.home_team_id.toString()),
            teamAbbreviation: game.home_team_abbreviation,
            score: game.home_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.home_team_id.toString())
          };

          const awayTeam = {
            teamId: game.away_team_id.toString(),
            teamName: getTeamName(game.away_team_id.toString()),
            teamAbbreviation: game.away_team_abbreviation,
            score: game.away_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.away_team_id.toString())
          };

          return {
            ...game,
            boxScoreLoaded: hasBoxScore,
            isPlayoff: isPlayoffGame(game.game_id),
            homeTeam,
            awayTeam,
            periodScores: scores,
            created_at: new Date()
          };
        });

        const games = groupByDate(gamesWithBoxScores);
        setGamesByDate(games);
        setError('');
      }
    } catch (err) {
      console.error('Error in fetchGames:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [dataLoader, fetchSchedule, fetchBoxScores]);

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
    <>
      <DynamicTableLoader />
      <div className="container mx-auto px-4 py-8 font-mono">
        <SeasonFilter />

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
        <BoxScorePanel
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
        />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-2 font-mono text-sm">
        <div>Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
