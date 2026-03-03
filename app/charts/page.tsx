'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import SeasonFilter from '@/components/SeasonFilter';
import { useSchedule } from '@/hooks/useGameData';
import { useDataLoader } from '@/lib/dataLoader';
import { getSeasonYearFromDate } from '@/lib/seasonUtils';
import type { SeasonType } from '@/lib/seasonUtils';
import type { GameDataFilters } from '@/hooks/useGameData';
import { parseGameDate } from '@/lib/dateUtils';

interface ScheduleRow {
  game_id: string;
  game_date: Date;
  home_team: string;
  away_team: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const [games, setGames] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataLoader = useDataLoader();
  const { fetchSchedule } = useSchedule();
  const initialLoadComplete = useRef(false);

  const currentSeason = getSeasonYearFromDate(new Date());
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;
  const seasonType = (searchParams?.get('type') as SeasonType) || undefined;
  const team = searchParams?.get('team') || '';

  const filters: GameDataFilters = useMemo(() => ({
    seasonYear: season,
    seasonType: seasonType,
  }), [season, seasonType]);

  const filtersKey = `${season ?? ''}-${seasonType ?? ''}`;
  const prevFiltersKey = useRef(filtersKey);

  const loadData = useCallback(async (currentFilters: GameDataFilters, isInitial: boolean) => {
    try {
      if (isInitial) {
        await dataLoader.waitForWasm();
      }
      setLoading(true);
      setError(null);

      const scheduleData = await fetchSchedule(currentFilters);
      setGames(scheduleData as ScheduleRow[]);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dataLoader, fetchSchedule]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!initialLoadComplete.current) {
      initialLoadComplete.current = true;
      loadData(filters, true);
    } else if (prevFiltersKey.current !== filtersKey) {
      prevFiltersKey.current = filtersKey;
      loadData(filters, false);
    }
  }, [filtersKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const filteredGames = useMemo(() => {
    if (!team) return games;
    return games.filter(
      g => g.home_team_abbreviation === team || g.away_team_abbreviation === team
    );
  }, [games, team]);

  // Sort by date descending
  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      const dateA = a.game_date instanceof Date ? a.game_date : parseGameDate(a.game_date);
      const dateB = b.game_date instanceof Date ? b.game_date : parseGameDate(b.game_date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredGames]);

  return (
    <div className="container mx-auto px-4 py-8 font-mono">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Analytics</h1>

      <SeasonFilter basePath="/charts" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading games...</span>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Error: {error}</div>
      ) : sortedGames.length === 0 ? (
        <div className="p-4 text-gray-500 dark:text-gray-400">No games found for the selected filters.</div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {sortedGames.length} game{sortedGames.length !== 1 ? 's' : ''} found
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Away</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Score</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Score</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Home</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedGames.map((game) => {
                  const gameDate = game.game_date instanceof Date ? game.game_date : parseGameDate(game.game_date);
                  const awayWon = game.away_team_score > game.home_team_score;
                  const homeWon = game.home_team_score > game.away_team_score;

                  return (
                    <tr
                      key={game.game_id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-3 py-2 text-sm dark:text-gray-200 whitespace-nowrap">
                        {format(gameDate, 'MMM d, yyyy')}
                      </td>
                      <td className={`px-3 py-2 text-sm dark:text-gray-200 ${awayWon ? 'font-bold' : ''}`}>
                        {game.away_team_abbreviation}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right dark:text-gray-200 ${awayWon ? 'font-bold' : ''}`}>
                        {game.away_team_score}
                      </td>
                      <td className="px-1 py-2 text-sm text-center text-gray-400">@</td>
                      <td className={`px-3 py-2 text-sm dark:text-gray-200 ${homeWon ? 'font-bold' : ''}`}>
                        {game.home_team_score}
                      </td>
                      <td className={`px-3 py-2 text-sm dark:text-gray-200 ${homeWon ? 'font-bold' : ''}`}>
                        {game.home_team_abbreviation}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {game.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChartsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-2 font-mono text-sm">
        <div>Loading...</div>
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
