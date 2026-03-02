// Season-level worker: fetches game list, fans out to per-game processing

import { getGames, getBoxScore } from '../api/client';
import { parseBoxScore } from '../parse/box-score-parser';
import { Loader } from '../db/loader';
import { runPool } from './pool';
import { logger } from '../util/logger';
import type { PipelineConfig, SeasonProgress, ScheduleRow } from '../types';

/** Convert a season start year to the API season string, e.g. 2024 -> "2024-25" */
function yearToSeason(year: number): string {
  const endYear = (year + 1) % 100;
  return `${year}-${endYear.toString().padStart(2, '0')}`;
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
  const ingestedIds = config.force
    ? new Set<string>()
    : await loader.getIngestedGameIds(seasonYear, seasonType);

  // 3. Filter to games that need processing
  const gamesToProcess = games.filter((g) => {
    if (ingestedIds.has(g.GameId)) {
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
    // In dry-run mode, count all remaining as "would process"
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
    home_team_score: 0, // not available from game list
    away_team_score: 0,
    status: g.Status,
    season_year: seasonYear,
    season_type: seasonType,
  }));
  await loader.loadScheduleRows(scheduleRows);

  // 5. Fan out to per-game processing via runPool
  await runPool(
    gamesToProcess,
    async (game, sig) => {
      const gameId = game.GameId;

      // Fetch box score from API
      const boxScoreResponse = await getBoxScore(gameId, sig);

      // Build the shape parseBoxScore expects
      const rawGameData = {
        game: {
          gameId,
          gameDateEst: game.Date,
          homeTeam: {
            teamId: parseInt(game.HomeTeamId, 10),
            teamTricode: game.HomeTeamAbbreviation,
          },
          awayTeam: {
            teamId: parseInt(game.AwayTeamId, 10),
            teamTricode: game.AwayTeamAbbreviation,
          },
        },
        boxScore: {
          stats: boxScoreResponse.stats,
        },
      };

      // Parse into BoxScoreRow[]
      const rows = parseBoxScore(rawGameData);

      // Load into database
      await loader.loadBoxScoreRows(rows);

      // Mark as ingested
      await loader.markIngested({
        game_id: gameId,
        season_year: seasonYear,
        season_type: seasonType,
        status: 'success',
      });

      progress.completed++;
      logger.progress(
        `[${season}] ${progress.completed + progress.failed}/${gamesToProcess.length} games (${progress.completed} ok, ${progress.failed} err)`,
      );

      return rows.length;
    },
    config.concurrency,
    signal,
    {
      onError: (game, error) => {
        progress.failed++;
        logger.error('Game ingestion failed', {
          gameId: game.GameId,
          season,
          error: error.message,
        });

        // Log error to ingestion_log (fire-and-forget)
        loader
          .markIngested({
            game_id: game.GameId,
            season_year: seasonYear,
            season_type: seasonType,
            status: 'error',
            error_message: error.message,
          })
          .catch((logErr) => {
            logger.error('Failed to log ingestion error', {
              gameId: game.GameId,
              error: (logErr as Error).message,
            });
          });
      },
    },
  );

  // Clear the progress line
  if (process.stdout.isTTY) {
    process.stdout.write('\n');
  }

  logger.info('Season complete', {
    season,
    seasonType,
    completed: progress.completed,
    skipped: progress.skipped,
    failed: progress.failed,
    total: progress.totalGames,
  });

  return progress;
}
