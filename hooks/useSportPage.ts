'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { ScheduleWithBoxScore } from '@/app/types/extended';
import { parseGameDate } from '@/lib/dateUtils';
import { useDataLoader } from '@/lib/dataLoader';
import type { GameDataFilters, PlayerIndexEntry } from '@/hooks/useGameData';
import type { SeasonType } from '@/lib/seasonUtils';
import { useLiveData } from '@/lib/LiveDataContext';

export function groupByDate(games: ScheduleWithBoxScore[]) {
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

export interface UseSportPageConfig {
  fetchSchedule: (filters: GameDataFilters) => Promise<any[]>;
  fetchBoxScores: (filters: GameDataFilters) => Promise<Record<string, any[]>>;
  fetchPlayerIndex: (filters: GameDataFilters) => Promise<PlayerIndexEntry[]>;
  buildGames: (schedule: any[], boxScores: Record<string, any[]>) => ScheduleWithBoxScore[];
  getDefaultSeason: () => number;
  loadingLabel?: string;
}

export function useSportPage(config: UseSportPageConfig) {
  const {
    fetchSchedule,
    fetchBoxScores,
    fetchPlayerIndex,
    buildGames,
    getDefaultSeason,
    loadingLabel = 'Fetching game data...',
  } = config;

  const searchParams = useSearchParams();
  const [allGames, setAllGames] = useState<ScheduleWithBoxScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMessages, setLoadingMessages] = useState<Array<{ message: string; completed: boolean }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLiveGameId, setSelectedLiveGameId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [playerIndex, setPlayerIndex] = useState<PlayerIndexEntry[]>([]);
  const dataLoader = useDataLoader();

  const {
    isLive,
    liveGames,
    liveBoxScore,
    setSubscribedGameId,
    highlightedCells,
    boldedCells,
  } = useLiveData();

  // Filter to active games (in progress)
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

  // Derive filters from URL params
  const currentSeason = getDefaultSeason();
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;
  const seasonType = (searchParams?.get('type') as SeasonType) || undefined;
  const team = searchParams?.get('team') || '';
  const player = searchParams?.get('player') || '';

  const filters: GameDataFilters = useMemo(() => ({
    seasonYear: season,
    seasonType: seasonType,
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
    if (allGames.length === 0) return [];

    return Object.entries(
      groupByDate(
        allGames.filter(game => {
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
  }, [allGames, team, playerGameIds]);

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

        addLoadingMessage(loadingLabel);
        const [scheduleData, boxScoresData, playerIndexData] = await Promise.all([
          fetchSchedule(currentFilters),
          fetchBoxScores(currentFilters),
          fetchPlayerIndex(currentFilters),
        ]);
        setPlayerIndex(playerIndexData);
        updateLoadingMessage(1);

        setAllGames(buildGames(scheduleData, boxScoresData));
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

        setAllGames(buildGames(scheduleData, boxScoresData));
        setError('');
      }
    } catch (err) {
      console.error('Error in loadAllData:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [dataLoader, fetchSchedule, fetchBoxScores, fetchPlayerIndex, buildGames, loadingLabel]);

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

  return {
    // State
    loading,
    error,
    loadingMessages,
    selectedGameId,
    selectedLiveGameId,
    currentPage,
    setCurrentPage,
    setSelectedGameId,

    // Live data
    isLive,
    liveGames,
    liveBoxScore,
    activeLiveGames,
    handleLiveGameSelect,
    handlePanelClose,
    highlightedCells,
    boldedCells,

    // Filtered/paginated data
    playerSuggestions,
    filteredGamesByDate,
    paginatedDates,
    totalPages,

    // Refs
    initialLoadComplete,
  };
}
