'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LiveScoreGame {
  game_id: string;
  game_date: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
  period: string;
  clock: string;
}

interface LiveScoresResponse {
  games: LiveScoreGame[];
  timestamp: string;
}

interface UseLivePollingResult {
  isLive: boolean;
  setIsLive: (value: boolean) => void;
  lastUpdated: Date | null;
  activeGameCount: number;
}

export function useLivePolling(intervalMs: number = 5000): UseLivePollingResult {
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeGameCount, setActiveGameCount] = useState(0);
  const lastFetchTime = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveScores = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime.current < intervalMs) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      lastFetchTime.current = now;
      const response = await fetch('/api/live-scores', {
        signal: controller.signal,
      });

      if (!response.ok) {
        return;
      }

      const data: LiveScoresResponse = await response.json();

      // Count games that are currently in progress (not final, not pre-game)
      const activeGames = data.games.filter((game) => {
        const status = game.status.trim().toLowerCase();
        return (
          !status.includes('final') &&
          status !== '' &&
          Number(game.period) > 0
        );
      });

      setActiveGameCount(activeGames.length);
      setLastUpdated(new Date(data.timestamp));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Live polling error:', error);
    }
  }, [intervalMs]);

  useEffect(() => {
    if (!isLive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately when going live
    fetchLiveScores();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLive) {
        fetchLiveScores();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchLiveScores, intervalMs);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    intervalRef.current = setInterval(fetchLiveScores, intervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, intervalMs, fetchLiveScores]);

  return { isLive, setIsLive, lastUpdated, activeGameCount };
}
