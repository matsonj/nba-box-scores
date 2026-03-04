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
import type {
  LiveScoreGame,
  LiveBoxScoreResponse,
  CellState,
} from '@/app/types/live';

interface LiveDataContextValue {
  isLive: boolean;
  setIsLive: (value: boolean) => void;
  liveGames: LiveScoreGame[];
  activeGameCount: number;
  lastUpdated: Date | null;
  liveBoxScore: LiveBoxScoreResponse | null;
  subscribedGameId: string | null;
  setSubscribedGameId: (id: string | null) => void;
  highlightedCells: Map<string, CellState>;
  boldedCells: Map<string, CellState>;
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

const POLL_INTERVAL = 5000;
const HIGHLIGHT_ACTIVE_MS = 2000;
const HIGHLIGHT_FADE_MS = 10000;
const BOLD_ACTIVE_MS = 15000;
const BOLD_FADE_MS = 20000;

// Stat fields to diff for change detection
const DIFF_FIELDS = [
  'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
  'fieldGoalsMade', 'fieldGoalsAttempted', 'threePointersMade',
  'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted',
  'plusMinus', 'minutes',
] as const;

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [isLive, setIsLive] = useState(false);
  const [liveGames, setLiveGames] = useState<LiveScoreGame[]>([]);
  const [activeGameCount, setActiveGameCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveBoxScore, setLiveBoxScore] = useState<LiveBoxScoreResponse | null>(null);
  const [subscribedGameId, setSubscribedGameId] = useState<string | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Map<string, CellState>>(new Map());
  const [boldedCells, setBoldedCells] = useState<Map<string, CellState>>(new Map());

  const prevBoxScoreRef = useRef<LiveBoxScoreResponse | null>(null);
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const boldTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scoreAbortRef = useRef<AbortController | null>(null);
  const boxAbortRef = useRef<AbortController | null>(null);
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boxIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Diff engine ---
  const processBoxScoreDiff = useCallback((
    prev: LiveBoxScoreResponse | null,
    current: LiveBoxScoreResponse
  ) => {
    if (!prev) return;

    const prevPlayers = new Map<string, Record<string, unknown>>();
    [...prev.homeTeam.players, ...prev.awayTeam.players].forEach((p) => {
      prevPlayers.set(p.personId, p as unknown as Record<string, unknown>);
    });

    const changedKeys: string[] = [];
    [...current.homeTeam.players, ...current.awayTeam.players].forEach((p) => {
      const prevP = prevPlayers.get(p.personId);
      if (!prevP) return;

      for (const field of DIFF_FIELDS) {
        const prevVal = prevP[field];
        const curVal = (p as unknown as Record<string, unknown>)[field];
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
  }, []);

  // --- Scoreboard polling ---
  const fetchScoreboard = useCallback(async () => {
    if (scoreAbortRef.current) {
      scoreAbortRef.current.abort();
    }
    const controller = new AbortController();
    scoreAbortRef.current = controller;

    try {
      const response = await fetch('/api/live-scores', {
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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Live scoreboard poll error:', error);
    }
  }, []);

  // --- Box score polling ---
  const fetchBoxScore = useCallback(async (gameId: string) => {
    if (boxAbortRef.current) {
      boxAbortRef.current.abort();
    }
    const controller = new AbortController();
    boxAbortRef.current = controller;

    try {
      const response = await fetch(`/api/live-boxscore?gameId=${gameId}`, {
        signal: controller.signal,
      });
      if (!response.ok) return;

      const data: LiveBoxScoreResponse = await response.json();

      processBoxScoreDiff(prevBoxScoreRef.current, data);
      prevBoxScoreRef.current = data;
      setLiveBoxScore(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Live boxscore poll error:', error);
    }
  }, [processBoxScoreDiff]);

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
