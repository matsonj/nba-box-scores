// Season-level worker for NHL: iterates through a season week by week,
// fetches box scores for each game, parses, and loads into MotherDuck.
//
// The NHL schedule API returns a week at a time, so we step through the
// season in weekly increments from October to June.

import { fetchNHLSchedule, fetchNHLBoxScore } from '../api/client';
import { getCurrentDelay } from '../../api/rate-limiter';
import { parseNHLBoxScore } from '../parse/box-score-parser';
import { NHLLoader } from '../db/loader';
import { seasonTypeLabel } from '../config';
import { logger } from '../../util/logger';
import type {
  NHLPipelineConfig,
  NHLSeasonProgress,
  NHLScheduleRow,
  NHLScheduleGame,
} from '../types';

/** Convert game type code to season type string for storage */
function gameTypeToSeasonType(gameType: number): string {
  switch (gameType) {
    case 1: return 'Preseason';
    case 2: return 'Regular Season';
    case 3: return 'Playoffs';
    default: return String(gameType);
  }
}

/** Convert a UTC ISO string to an Eastern Time date string (YYYY-MM-DD) */
function utcToEasternDate(utcStr: string): string {
  const d = new Date(utcStr);
  // Format in America/New_York to get the correct local date
  const parts = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA gives YYYY-MM-DD
  return parts;
}

/** Get the season start date (roughly early October) */
function seasonStartDate(year: number): string {
  return `${year}-10-01`;
}

/** Get the season end date (roughly late June for playoffs) */
function seasonEndDate(year: number): string {
  return `${year + 1}-07-01`;
}

/** Parse a date string and add days */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Queue-level retries for errors that survive all HTTP retries
const MAX_GAME_RETRIES = 3;
const MAX_IN_FLIGHT = 8;

interface QueueItem {
  game: NHLScheduleGame;
  seasonYear: number;
  seasonType: string;
  attempts: number;
}

/** Process all games for a single (season, seasonType) pair */
export async function processNHLSeason(
  seasonYear: number,
  seasonType: string,
  loader: NHLLoader,
  config: NHLPipelineConfig,
  signal: AbortSignal,
): Promise<NHLSeasonProgress> {
  const progress: NHLSeasonProgress = {
    seasonYear,
    seasonType,
    totalGames: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
  };

  const seasonLabel = `${seasonYear}-${((seasonYear + 1) % 100).toString().padStart(2, '0')}`;
  const typeLabel = seasonTypeLabel(seasonType);
  logger.info('Processing NHL season', { season: seasonLabel, seasonType: typeLabel });

  // Target game type number for filtering
  const targetGameType = parseInt(seasonType, 10);

  // 1. Collect all games for this season by iterating week by week
  const allGames: NHLScheduleGame[] = [];
  let currentDate = seasonStartDate(seasonYear);
  const endDate = seasonEndDate(seasonYear);
  const seenGameIds = new Set<string>();

  logger.info('Scanning NHL schedule', { from: currentDate, to: endDate });

  while (currentDate < endDate) {
    if (signal.aborted) break;

    try {
      const scheduleResponse = await fetchNHLSchedule(currentDate, signal);

      for (const day of scheduleResponse.gameWeek) {
        for (const game of day.games) {
          // Filter by game type (02=regular, 03=playoffs)
          if (game.gameType !== targetGameType) continue;

          // Only include completed games
          if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') continue;

          const gameIdStr = String(game.id);
          if (!seenGameIds.has(gameIdStr)) {
            seenGameIds.add(gameIdStr);
            allGames.push(game);
          }
        }
      }

      // Use nextStartDate from the API if available, otherwise advance 7 days
      if (scheduleResponse.nextStartDate) {
        currentDate = scheduleResponse.nextStartDate;
      } else {
        currentDate = addDays(currentDate, 7);
      }
    } catch (err) {
      if (signal.aborted) break;
      // If schedule fetch fails, skip this week and continue
      logger.warn('Schedule fetch failed, skipping week', {
        date: currentDate,
        error: (err as Error).message,
      });
      currentDate = addDays(currentDate, 7);
    }
  }

  progress.totalGames = allGames.length;

  if (allGames.length === 0) {
    logger.info('No games found for season', { season: seasonLabel, seasonType: typeLabel });
    return progress;
  }

  // 2. Check which games are already ingested
  let skipIds: Set<string>;
  if (config.force) {
    skipIds = new Set<string>();
  } else {
    skipIds = await loader.getIngestedGameIds(seasonYear, seasonType);
  }

  // 3. Filter to games that need processing
  const gamesToProcess = allGames.filter((g) => {
    if (skipIds.has(String(g.id))) {
      progress.skipped++;
      return false;
    }
    return true;
  });

  if (gamesToProcess.length === 0) {
    logger.info('All games already ingested', {
      season: seasonLabel,
      seasonType: typeLabel,
      total: allGames.length,
      skipped: progress.skipped,
    });
    return progress;
  }

  logger.info('Games to process', {
    season: seasonLabel,
    seasonType: typeLabel,
    total: allGames.length,
    toProcess: gamesToProcess.length,
    skipped: progress.skipped,
  });

  if (config.dryRun) {
    return progress;
  }

  // 4. Load schedule rows for games we're about to process
  const scheduleRows: NHLScheduleRow[] = gamesToProcess.map((g) => ({
    game_id: String(g.id),
    game_date: g.startTimeUTC ? utcToEasternDate(g.startTimeUTC) : g.gameDate,
    home_team_id: g.homeTeam.id,
    away_team_id: g.awayTeam.id,
    home_team_abbreviation: g.homeTeam.abbrev,
    away_team_abbreviation: g.awayTeam.abbrev,
    home_team_score: g.homeTeam.score ?? 0,
    away_team_score: g.awayTeam.score ?? 0,
    game_status: g.gameState,
    season_year: seasonYear,
    season_type: gameTypeToSeasonType(g.gameType),
  }));
  await loader.loadSchedule(scheduleRows);

  // 5. Adaptive dispatch loop for box score fetching
  const queue: QueueItem[] = gamesToProcess.map((game) => ({
    game,
    seasonYear,
    seasonType: gameTypeToSeasonType(game.gameType),
    attempts: 0,
  }));
  const totalToProcess = queue.length;
  const startTime = Date.now();

  const inFlight = new Set<Promise<void>>();

  function logProgress(): void {
    const elapsed = (Date.now() - startTime) / 1000;
    const done = progress.completed + progress.failed;
    const gamesPerMin = elapsed > 0 ? (done / elapsed) * 60 : 0;
    const remaining = totalToProcess - done;
    const eta = gamesPerMin > 0 ? Math.round(remaining / gamesPerMin) : '?';

    logger.progress(
      `[${seasonLabel}] ${done}/${totalToProcess} ` +
      `(${progress.completed} ok, ${progress.failed} err) ` +
      `${gamesPerMin.toFixed(1)}/min, delay=${getCurrentDelay()}ms, ` +
      `inflight=${inFlight.size}, ETA ${eta}min`,
    );
  }

  function dispatch(item: QueueItem): void {
    const gameId = String(item.game.id);

    const promise = (async () => {
      const boxScoreResponse = await fetchNHLBoxScore(gameId, signal);

      // Store raw JSON
      const gameJson = {
        id: item.game.id,
        gameDate: item.game.gameDate,
        gameType: item.game.gameType,
        homeTeam: item.game.homeTeam,
        awayTeam: item.game.awayTeam,
        gameState: item.game.gameState,
      };

      await loader.loadRawBoxScore(
        gameId, item.seasonYear, item.seasonType,
        gameJson, boxScoreResponse,
      );

      // Parse box score into skater and goalie rows
      const { skaters, goalies } = parseNHLBoxScore(boxScoreResponse);

      await loader.loadSkaters(skaters);
      await loader.loadGoalies(goalies);

      await loader.markIngested({
        game_id: gameId,
        season_year: item.seasonYear,
        season_type: item.seasonType,
        ingestion_status: 'success',
      });

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
            season_year: item.seasonYear,
            season_type: item.seasonType,
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
      await new Promise(resolve => setTimeout(resolve, getCurrentDelay()));
      if (signal.aborted) break;

      dispatch(queue.shift()!);
      continue;
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
    season: seasonLabel,
    seasonType: typeLabel,
    completed: progress.completed,
    skipped: progress.skipped,
    failed: progress.failed,
    total: progress.totalGames,
    elapsedSec: elapsed,
  });

  return progress;
}
