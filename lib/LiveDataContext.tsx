'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type {
  LiveScoreGame,
  AnyLiveBoxScoreResponse,
  CellState,
} from '@/app/types/live';
import { getSportConfig } from '@/lib/sports';
import { getSportFromPathname } from '@/lib/sportUtils';
import type { Sport } from '@/lib/sports';

interface LiveDataContextValue {
  isLive: boolean;
  setIsLive: (value: boolean) => void;
  liveGames: LiveScoreGame[];
  activeGameCount: number;
  lastUpdated: Date | null;
  liveBoxScore: AnyLiveBoxScoreResponse | null;
  subscribedGameId: string | null;
  setSubscribedGameId: (id: string | null) => void;
  highlightedCells: Map<string, CellState>;
  boldedCells: Map<string, CellState>;
  forceRefresh: () => void;
  pollInterval: number;
  pollTick: number;
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

const POLL_INTERVAL = 10000;
const HIGHLIGHT_ACTIVE_MS = 18000;
const HIGHLIGHT_FADE_MS = 20000;
const BOLD_ACTIVE_MS = 38000;
const BOLD_FADE_MS = 40000;

// Stat fields to diff for change detection (per sport)
const NBA_DIFF_FIELDS = [
  'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
  'fieldGoalsMade', 'fieldGoalsAttempted', 'threePointersMade',
  'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted',
  'plusMinus', 'minutes',
] as const;

const NHL_SKATER_DIFF_FIELDS = [
  'goals', 'assists', 'points', 'plusMinus', 'pim',
  'shots', 'hits', 'blockedShots', 'toi',
  'faceoffWins', 'faceoffLosses',
] as const;

const NHL_GOALIE_DIFF_FIELDS = [
  'saves', 'shotsAgainst', 'goalsAgainst', 'savePctg', 'toi',
] as const;

/**
 * Extracts a flat list of { personId, ...stats } entries from a raw box score response.
 * NBA uses homeTeam.players / awayTeam.players.
 * NHL uses homeTeam.skaters + homeTeam.goalies / awayTeam.skaters + awayTeam.goalies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlayers(response: any, sport: Sport): Record<string, unknown>[] {
  if (sport === 'nhl') {
    const home = response.homeTeam || {};
    const away = response.awayTeam || {};
    return [
      ...(home.skaters || []),
      ...(home.goalies || []),
      ...(away.skaters || []),
      ...(away.goalies || []),
    ];
  }
  // NBA
  return [
    ...(response.homeTeam?.players || []),
    ...(response.awayTeam?.players || []),
  ];
}

function getDiffFieldsForPlayer(sport: Sport, player: Record<string, unknown>): readonly string[] {
  if (sport === 'nhl') {
    return player.position === 'G' ? NHL_GOALIE_DIFF_FIELDS : NHL_SKATER_DIFF_FIELDS;
  }
  return NBA_DIFF_FIELDS;
}

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sport = getSportFromPathname(pathname ?? '/');
  const sportConfig = getSportConfig(sport);
  const [isLive, setIsLive] = useState(false);
  const [liveGames, setLiveGames] = useState<LiveScoreGame[]>([]);
  const [activeGameCount, setActiveGameCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveBoxScore, setLiveBoxScore] = useState<AnyLiveBoxScoreResponse | null>(null);
  const [subscribedGameId, setSubscribedGameId] = useState<string | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Map<string, CellState>>(new Map());
  const [boldedCells, setBoldedCells] = useState<Map<string, CellState>>(new Map());
  const [pollTick, setPollTick] = useState(0);

  const prevBoxScoreRef = useRef<AnyLiveBoxScoreResponse | null>(null);

  // Clear stale data when sport changes
  const prevSportRef = useRef(sport);
  if (prevSportRef.current !== sport) {
    prevSportRef.current = sport;
    // Synchronously reset to avoid showing stale cross-sport data
    setLiveGames([]);
    setLiveBoxScore(null);
    setSubscribedGameId(null);
    setHighlightedCells(new Map());
    setBoldedCells(new Map());
    setActiveGameCount(0);
    setLastUpdated(null);
    prevBoxScoreRef.current = null;
  }
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const boldTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scoreAbortRef = useRef<AbortController | null>(null);
  const boxAbortRef = useRef<AbortController | null>(null);
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boxIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Diff engine ---
  const processBoxScoreDiff = useCallback((
    prev: AnyLiveBoxScoreResponse | null,
    current: AnyLiveBoxScoreResponse
  ) => {
    if (!prev) return;

    const prevPlayers = new Map<string, Record<string, unknown>>();
    extractPlayers(prev, sport).forEach((p: Record<string, unknown>) => {
      prevPlayers.set(String(p.personId), p);
    });

    const changedKeys: string[] = [];
    extractPlayers(current, sport).forEach((p: Record<string, unknown>) => {
      const prevP = prevPlayers.get(String(p.personId));
      if (!prevP) return;

      const fields = getDiffFieldsForPlayer(sport, p);
      for (const field of fields) {
        const prevVal = prevP[field];
        const curVal = p[field];
        if (prevVal !== curVal) {
          changedKeys.push(`${p.personId}:${field}`);
        }
      }
    });

    if (changedKeys.length === 0) return;

    // Update highlight states
    setHighlightedCells((prev) => {
      const next = new Map(prev);
      for (const key of changedKeys) {
        next.set(key, 'active');
      }
      return next;
    });
    setBoldedCells((prev) => {
      const next = new Map(prev);
      for (const key of changedKeys) {
        next.set(key, 'active');
      }
      return next;
    });

    // Manage timers for each changed cell
    for (const key of changedKeys) {
      // Clear existing highlight timers
      const existingHighlight = highlightTimersRef.current.get(`h-active-${key}`);
      if (existingHighlight) clearTimeout(existingHighlight);
      const existingHighlightFade = highlightTimersRef.current.get(`h-fade-${key}`);
      if (existingHighlightFade) clearTimeout(existingHighlightFade);

      // Highlight: active -> fading after 500ms -> removed after 2s
      const hActiveTimer = setTimeout(() => {
        setHighlightedCells((prev) => {
          const next = new Map(prev);
          if (next.get(key) === 'active') {
            next.set(key, 'fading');
          }
          return next;
        });
      }, HIGHLIGHT_ACTIVE_MS);
      highlightTimersRef.current.set(`h-active-${key}`, hActiveTimer);

      const hFadeTimer = setTimeout(() => {
        setHighlightedCells((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, HIGHLIGHT_FADE_MS);
      highlightTimersRef.current.set(`h-fade-${key}`, hFadeTimer);

      // Clear existing bold timers
      const existingBold = boldTimersRef.current.get(`b-active-${key}`);
      if (existingBold) clearTimeout(existingBold);
      const existingBoldFade = boldTimersRef.current.get(`b-fade-${key}`);
      if (existingBoldFade) clearTimeout(existingBoldFade);

      // Bold: active -> fading after 8s -> removed after 10s
      const bActiveTimer = setTimeout(() => {
        setBoldedCells((prev) => {
          const next = new Map(prev);
          if (next.get(key) === 'active') {
            next.set(key, 'fading');
          }
          return next;
        });
      }, BOLD_ACTIVE_MS);
      boldTimersRef.current.set(`b-active-${key}`, bActiveTimer);

      const bFadeTimer = setTimeout(() => {
        setBoldedCells((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, BOLD_FADE_MS);
      boldTimersRef.current.set(`b-fade-${key}`, bFadeTimer);
    }
  }, [sport]);

  // --- Scoreboard polling ---
  const fetchScoreboard = useCallback(async () => {
    if (scoreAbortRef.current) {
      scoreAbortRef.current.abort();
    }
    const controller = new AbortController();
    scoreAbortRef.current = controller;

    try {
      const response = await fetch(sportConfig.liveScoresEndpoint, {
        signal: controller.signal,
      });
      if (!response.ok) return;

      const data = await response.json();
      setLiveGames(data.games || []);
      setLastUpdated(new Date(data.timestamp));

      const active = (data.games || []).filter((game: LiveScoreGame) => {
        const status = game.status.trim().toLowerCase();
        return !status.includes('final') && status !== '' && Number(game.period) > 0;
      });
      setActiveGameCount(active.length);
      setPollTick((t) => t + 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Live scoreboard poll error:', error);
    }
  }, [sportConfig.liveScoresEndpoint]);

  // --- Box score polling ---
  const fetchBoxScore = useCallback(async (gameId: string) => {
    if (boxAbortRef.current) {
      boxAbortRef.current.abort();
    }
    const controller = new AbortController();
    boxAbortRef.current = controller;

    try {
      const response = await fetch(`${sportConfig.liveBoxScoreEndpoint}?gameId=${gameId}`, {
        signal: controller.signal,
      });
      if (!response.ok) return;

      const data: AnyLiveBoxScoreResponse = await response.json();

      processBoxScoreDiff(prevBoxScoreRef.current, data);
      prevBoxScoreRef.current = data;
      setLiveBoxScore(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Live boxscore poll error:', error);
    }
  }, [sportConfig.liveBoxScoreEndpoint, processBoxScoreDiff]);

  // Scoreboard polling lifecycle
  useEffect(() => {
    if (!isLive) {
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current);
        scoreIntervalRef.current = null;
      }
      setLiveGames([]);
      setActiveGameCount(0);
      return;
    }

    fetchScoreboard();
    scoreIntervalRef.current = setInterval(fetchScoreboard, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isLive) {
        fetchScoreboard();
        if (!scoreIntervalRef.current) {
          scoreIntervalRef.current = setInterval(fetchScoreboard, POLL_INTERVAL);
        }
      } else {
        if (scoreIntervalRef.current) {
          clearInterval(scoreIntervalRef.current);
          scoreIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current);
        scoreIntervalRef.current = null;
      }
      if (scoreAbortRef.current) scoreAbortRef.current.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLive, fetchScoreboard]);

  // Box score polling lifecycle
  useEffect(() => {
    if (!subscribedGameId || !isLive) {
      if (boxIntervalRef.current) {
        clearInterval(boxIntervalRef.current);
        boxIntervalRef.current = null;
      }
      if (!subscribedGameId) {
        setLiveBoxScore(null);
        prevBoxScoreRef.current = null;
        setHighlightedCells(new Map());
        setBoldedCells(new Map());
      }
      return;
    }

    // Reset previous data on game change
    prevBoxScoreRef.current = null;
    setHighlightedCells(new Map());
    setBoldedCells(new Map());

    fetchBoxScore(subscribedGameId);
    boxIntervalRef.current = setInterval(() => fetchBoxScore(subscribedGameId), POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && subscribedGameId) {
        fetchBoxScore(subscribedGameId);
        if (!boxIntervalRef.current) {
          boxIntervalRef.current = setInterval(() => fetchBoxScore(subscribedGameId), POLL_INTERVAL);
        }
      } else {
        if (boxIntervalRef.current) {
          clearInterval(boxIntervalRef.current);
          boxIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (boxIntervalRef.current) {
        clearInterval(boxIntervalRef.current);
        boxIntervalRef.current = null;
      }
      if (boxAbortRef.current) boxAbortRef.current.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [subscribedGameId, isLive, fetchBoxScore]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach((timer) => clearTimeout(timer));
      boldTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Force refresh: fetch immediately and reset interval timers
  const forceRefresh = useCallback(() => {
    if (!isLive) return;

    fetchScoreboard();

    // Reset scoreboard interval
    if (scoreIntervalRef.current) {
      clearInterval(scoreIntervalRef.current);
    }
    scoreIntervalRef.current = setInterval(fetchScoreboard, POLL_INTERVAL);

    // Also refresh box score if subscribed
    if (subscribedGameId) {
      fetchBoxScore(subscribedGameId);
      if (boxIntervalRef.current) {
        clearInterval(boxIntervalRef.current);
      }
      boxIntervalRef.current = setInterval(() => fetchBoxScore(subscribedGameId), POLL_INTERVAL);
    }
  }, [isLive, subscribedGameId, fetchScoreboard, fetchBoxScore]);

  const value: LiveDataContextValue = {
    isLive,
    setIsLive,
    liveGames,
    activeGameCount,
    lastUpdated,
    liveBoxScore,
    subscribedGameId,
    setSubscribedGameId,
    highlightedCells,
    boldedCells,
    forceRefresh,
    pollInterval: POLL_INTERVAL,
    pollTick,
  };

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const context = useContext(LiveDataContext);
  if (!context) {
    throw new Error('useLiveData must be used within a LiveDataProvider');
  }
  return context;
}
