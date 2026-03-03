// HTTP client for PBPStats API with retry and backoff

import axios, { type AxiosError } from 'axios';
import { acquire, recordSuccess, recordThrottle } from './rate-limiter';
import { logger } from '../util/logger';
import type { PBPStatsBoxScoreResponse, PBPStatsGamesResponse } from '../types';

const PBPSTATS_BASE = 'https://api.pbpstats.com';

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://pbpstats.com',
  Referer: 'https://pbpstats.com/',
};

const MAX_RETRIES = 5;
const RATE_LIMIT_PAUSE_MS = 15_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function jitter(baseMs: number): number {
  // Add +/- 25% random jitter
  return baseMs * (0.75 + Math.random() * 0.5);
}

async function fetchWithRetry<T>(
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquire();

    try {
      const response = await axios.get<T>(url, {
        params,
        headers: DEFAULT_HEADERS,
        signal,
      });
      recordSuccess();
      return response.data;
    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status;

      // Don't retry if aborted
      if (signal?.aborted) throw err;

      // Don't retry 4xx errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      // Signal throttle for adaptive rate limiting
      if (status === 429 || status === 503) {
        recordThrottle();
      }

      if (attempt === MAX_RETRIES) throw err;

      let delayMs: number;
      if (status === 429) {
        // Rate limited: fixed 15s pause
        delayMs = RATE_LIMIT_PAUSE_MS;
        logger.warn('Rate limited (429), pausing', {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs,
        });
      } else {
        // 5xx or network error: exponential backoff with jitter
        delayMs = jitter(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        logger.warn('Request failed, retrying', {
          url,
          status: status ?? 'network_error',
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs: Math.round(delayMs),
        });
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('Exhausted retries');
}

/** Fetch list of games for a season from PBPStats */
export async function getGames(
  season: string,
  seasonType: string,
  signal?: AbortSignal,
): Promise<PBPStatsGamesResponse> {
  logger.debug('Fetching games list', { season, seasonType });
  return fetchWithRetry<PBPStatsGamesResponse>(
    `${PBPSTATS_BASE}/get-games/nba`,
    { Season: season, SeasonType: seasonType },
    signal,
  );
}

/** Fetch box score for a single game from PBPStats */
export async function getBoxScore(
  gameId: string,
  signal?: AbortSignal,
): Promise<PBPStatsBoxScoreResponse> {
  logger.debug('Fetching box score', { gameId });
  return fetchWithRetry<PBPStatsBoxScoreResponse>(
    `${PBPSTATS_BASE}/get-game-stats`,
    { GameId: gameId, Type: 'Player' },
    signal,
  );
}
