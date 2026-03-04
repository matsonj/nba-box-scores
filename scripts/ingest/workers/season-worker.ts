// Season-level worker: fetches game list, dispatches games via adaptive queue
//
// The dispatch loop sends requests at the adaptive delay interval.
// Multiple requests can be in-flight simultaneously — the rate limiter
// only gates how fast we dispatch, not how many are running.
// Failed games go to the back of the queue for retry.
//
// Retry semantics: fetchWithRetry handles transient HTTP errors (5 retries
// with backoff). The queue-level retry (MAX_GAME_RETRIES) handles errors
// that survive all HTTP retries (e.g., parse failures, DB errors).

import { getGames, getBoxScore } from '../api/client';
import { getCurrentDelay } from '../api/rate-limiter';
import { parseBoxScore } from '../parse/box-score-parser';
import { Loader } from '../db/loader';
import { logger } from '../util/logger';
import type { PipelineConfig, SeasonProgress, ScheduleRow, PBPStatsGamesResponse } from '../types';

/** Convert a season start year to the API season string, e.g. 2024 -> "2024-25" */
function yearToSeason(year: number): string {
  const endYear = (year + 1) % 100;
  return `${year}-${endYear.toString().padStart(2, '0')}`;
}

// Queue-level retries for errors that survive all HTTP retries in fetchWithRetry
// (e.g., parse failures, DB errors). Total worst-case attempts per game:
// MAX_GAME_RETRIES * (MAX_RETRIES + 1) = 3 * 6 = 18 API requests.
const MAX_GAME_RETRIES = 3;
const MAX_IN_FLIGHT = 8;

interface QueueItem {
  game: PBPStatsGamesResponse['results'][number];
  attempts: number;
}

/** Process all games for a single (season, seasonType) pair */
export async function processSeason(
  seasonYear: number,
  seasonType: string,
  loader: Loader,
  config: PipelineConfig,
  signal: AbortSignal,
): Promise<SeasonProgress> {
  const season = yearToSeason(seasonYear);
  const progress: SeasonProgress = {
    seasonYear,
    seasonType,
    totalGames: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
  };

  logger.info('Processing season', { season, seasonType });

  // 1. Fetch game list for this season
  const gamesResponse = await getGames(season, seasonType, signal);
  const games = gamesResponse.results;
  progress.totalGames = games.length;

  if (games.length === 0) {
    logger.info('No games found for season', { season, seasonType });
    return progress;
  }

  // 2. Check which games are already ingested (for incremental skip)
  let skipIds: Set<string>;
  if (config.force) {
    skipIds = new Set<string>();
  } else if (config.fillRaw) {
    // In fill-raw mode, skip games that already have raw JSON
    skipIds = await loader.getRawGameIds(seasonYear, seasonType);
  } else {
    skipIds = await loader.getIngestedGameIds(seasonYear, seasonType);
  }

  // 3. Filter to games that need processing
  const gamesToProcess = games.filter((g) => {
    if (skipIds.has(g.GameId)) {
      progress.skipped++;
      return false;
    }
    return true;
  });

  if (gamesToProcess.length === 0) {
    logger.info('All games already ingested', {
      season,
      seasonType,
      total: games.length,
      skipped: progress.skipped,
    });
    return progress;
  }

  logger.info('Games to process', {
    season,
    seasonType,
    total: games.length,
    toProcess: gamesToProcess.length,
    skipped: progress.skipped,
  });

  if (config.dryRun) {
    return progress;
  }

  // 4. Load schedule rows for the games we're about to process
  const scheduleRows: ScheduleRow[] = gamesToProcess.map((g) => ({
    game_id: g.GameId,
    game_date: g.Date,
    home_team_id: parseInt(g.HomeTeamId, 10),
    away_team_id: parseInt(g.AwayTeamId, 10),
    home_team_abbreviation: g.HomeTeamAbbreviation,
    away_team_abbreviation: g.AwayTeamAbbreviation,
    home_team_score: g.HomePoints ?? 0,
    away_team_score: g.AwayPoints ?? 0,
    game_status: 'Final',
    season_year: seasonYear,
    season_type: seasonType,
  }));
  await loader.loadScheduleRows(scheduleRows);

  // 5. Adaptive dispatch loop: fire requests at tuned intervals, multiple in-flight
  const queue: QueueItem[] = gamesToProcess.map((game) => ({ game, attempts: 0 }));
  const totalToProcess = queue.length;
  const startTime = Date.now();

  // Track in-flight promises; each removes itself on settlement
  const inFlight = new Set<Promise<void>>();

  function logProgress(): void {
    const elapsed = (Date.now() - startTime) / 1000;
    const done = progress.completed + progress.failed;
    const gamesPerMin = elapsed > 0 ? (done / elapsed) * 60 : 0;
    const remaining = totalToProcess - done;
    const eta = gamesPerMin > 0 ? Math.round(remaining / gamesPerMin) : '?';

    logger.progress(
      `[${season}] ${done}/${totalToProcess} ` +
      `(${progress.completed} ok, ${progress.failed} err) ` +
      `${gamesPerMin.toFixed(1)}/min, delay=${getCurrentDelay()}ms, ` +
      `inflight=${inFlight.size}, ETA ${eta}min`,
    );
  }

  function dispatch(item: QueueItem): void {
    const gameId = item.game.GameId;

    const promise = (async () => {
      const boxScoreResponse = await getBoxScore(gameId, signal);

      const rawGameData = {
        game: {
          gameId,
          gameDateEst: item.game.Date,
          homeTeam: {
            teamId: parseInt(item.game.HomeTeamId, 10),
            teamTricode: item.game.HomeTeamAbbreviation,
          },
          awayTeam: {
            teamId: parseInt(item.game.AwayTeamId, 10),
            teamTricode: item.game.AwayTeamAbbreviation,
          },
        },
        boxScore: {
          stats: boxScoreResponse.stats,
        },
      };

      // Store full raw JSON for the data lake before parsing
      await loader.storeRawPbpstats(
        gameId, seasonYear, seasonType,
        rawGameData.game, rawGameData.boxScore.stats,
      );

      // In fill-raw mode, only store raw JSON — skip box_scores and ingestion_log
      if (!config.fillRaw) {
        const rows = parseBoxScore(rawGameData);
        await loader.loadBoxScoreRows(rows);
        await loader.markIngested({
          game_id: gameId,
          season_year: seasonYear,
          season_type: seasonType,
          ingestion_status: 'success',
        });
      }

      progress.completed++;
      logProgress();
    })().catch((err) => {
      if (signal.aborted) return;

      const error = err instanceof Error ? err : new Error(String(err));
      item.attempts++;

      if (item.attempts < MAX_GAME_RETRIES) {
        logger.warn('Game failed, requeueing', {
          gameId,
          attempt: item.attempts,
          maxRetries: MAX_GAME_RETRIES,
          error: error.message,
        });
        queue.push(item);
      } else {
        progress.failed++;
        logger.error('Game exhausted retries', {
          gameId,
          attempts: item.attempts,
          error: error.message,
        });

        loader
          .markIngested({
            game_id: gameId,
            season_year: seasonYear,
            season_type: seasonType,
            ingestion_status: 'error',
            error_message: error.message,
          })
          .catch((logErr) => {
            logger.error('Failed to log ingestion error', {
              gameId,
              error: (logErr as Error).message,
            });
          });
      }
    }).finally(() => {
      inFlight.delete(promise);
    });

    inFlight.add(promise);
  }

  while (queue.length > 0 || inFlight.size > 0) {
    if (signal.aborted) {
      logger.info('Queue aborted, stopping', {
        processed: progress.completed + progress.failed,
        remaining: queue.length,
        inFlight: inFlight.size,
      });
      break;
    }

    // Dispatch next item if under capacity
    if (queue.length > 0 && inFlight.size < MAX_IN_FLIGHT) {
      // Wait the adaptive delay before every dispatch
      await new Promise(resolve => setTimeout(resolve, getCurrentDelay()));
      if (signal.aborted) break;

      dispatch(queue.shift()!);
      continue; // Check if we can dispatch more
    }

    // At capacity or queue drained — wait for one to finish
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }

  // Wait for any stragglers
  if (inFlight.size > 0) {
    await Promise.all(inFlight);
  }

  // Clear the progress line
  if (process.stdout.isTTY) {
    process.stdout.write('\n');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('Season complete', {
    season,
    seasonType,
    completed: progress.completed,
    skipped: progress.skipped,
    failed: progress.failed,
    total: progress.totalGames,
    elapsedSec: elapsed,
  });

  return progress;
}
