// HTTP client for NHL API with retry and backoff

import axios, { type AxiosError } from 'axios';
import { acquire, recordSuccess, recordThrottle } from '../../api/rate-limiter';
import { logger } from '../../util/logger';
import type { NHLBoxScoreResponse, NHLScheduleResponse } from '../types';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const MAX_RETRIES = 5;
const RATE_LIMIT_PAUSE_MS = 15_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function jitter(baseMs: number): number {
  return baseMs * (0.75 + Math.random() * 0.5);
}

async function fetchWithRetry<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquire();

    try {
      const response = await axios.get<T>(url, {
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
        delayMs = RATE_LIMIT_PAUSE_MS;
        logger.warn('Rate limited (429), pausing', {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs,
        });
      } else {
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

  throw new Error('Exhausted retries');
}

/** Fetch schedule for a week starting from the given date */
export async function fetchNHLSchedule(
  startDate: string,
  signal?: AbortSignal,
): Promise<NHLScheduleResponse> {
  logger.debug('Fetching NHL schedule', { startDate });
  return fetchWithRetry<NHLScheduleResponse>(
    `${NHL_API_BASE}/schedule/${startDate}`,
    signal,
  );
}

/** Fetch box score for a single NHL game */
export async function fetchNHLBoxScore(
  gameId: string,
  signal?: AbortSignal,
): Promise<NHLBoxScoreResponse> {
  logger.debug('Fetching NHL box score', { gameId });
  return fetchWithRetry<NHLBoxScoreResponse>(
    `${NHL_API_BASE}/gamecenter/${gameId}/boxscore`,
    signal,
  );
}
