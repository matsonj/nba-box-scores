#!/usr/bin/env tsx
// Re-derive box_scores from raw JSON stored in raw_game_data_pbpstats.
//
// Uses DELETE + INSERT (not INSERT OR REPLACE) because row counts can
// change if parser logic evolves — clean slate per game avoids stale rows.
//
// Usage:
//   npm run hydrate -- --season 2024
//   npm run hydrate -- --game 0022400001
//   npm run hydrate -- --all

import { MotherDuckConnection } from './db/connection';
import { Loader } from './db/loader';
import { parseBoxScore } from './parse/box-score-parser';
import { logger } from './util/logger';

const BATCH_SIZE = 50;

/** Escape a SQL string value (single quotes) */
function esc(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
}

interface RawRow {
  game_id: string;
  game_json: string;
  box_score_json: string;
}

function parseArgs(): { mode: 'season'; season: number } | { mode: 'game'; gameId: string } | { mode: 'all' } {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--season' && args[i + 1]) {
      return { mode: 'season', season: parseInt(args[i + 1], 10) };
    }
    if (args[i] === '--game' && args[i + 1]) {
      return { mode: 'game', gameId: args[i + 1] };
    }
    if (args[i] === '--all') {
      return { mode: 'all' };
    }
  }

  console.error('Usage: hydrate --season <year> | --game <gameId> | --all');
  process.exit(1);
}

/** Split an array into chunks of the given size */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main(): Promise<void> {
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    logger.error('MOTHERDUCK_TOKEN environment variable is required');
    process.exit(1);
  }

  const config = parseArgs();

  const db = new MotherDuckConnection(token);
  await db.connect();
  const loader = new Loader(db);

  try {
    await loader.ensureSchema();

    // 1. Get the list of game IDs to hydrate
    let gameIds: string[];

    if (config.mode === 'season') {
      const rows = await db.query<{ game_id: string }>(
        `SELECT game_id FROM main.raw_game_data_pbpstats
         WHERE season_year = ${config.season}
         ORDER BY game_id`,
      );
      gameIds = rows.map((r) => r.game_id);
      logger.info('Hydrating season', { season: config.season, games: gameIds.length });
    } else if (config.mode === 'game') {
      gameIds = [config.gameId];
      logger.info('Hydrating single game', { gameId: config.gameId });
    } else {
      const rows = await db.query<{ game_id: string }>(
        `SELECT game_id FROM main.raw_game_data_pbpstats ORDER BY game_id`,
      );
      gameIds = rows.map((r) => r.game_id);
      logger.info('Hydrating all games', { games: gameIds.length });
    }

    if (gameIds.length === 0) {
      logger.info('No games found to hydrate');
      return;
    }

    // 2. Process in batches
    let processed = 0;
    let errors = 0;
    const batches = chunk(gameIds, BATCH_SIZE);

    for (const batch of batches) {
      const inClause = batch.map((id) => esc(id)).join(',');

      // Fetch raw JSON for this batch
      const rawRows = await db.query<RawRow>(
        `SELECT game_id, game_json, box_score_json
         FROM main.raw_game_data_pbpstats
         WHERE game_id IN (${inClause})`,
      );

      // DELETE existing box_scores for these games (clean slate)
      await db.execute(
        `DELETE FROM main.box_scores WHERE game_id IN (${inClause})`,
      );

      // Re-parse all games in this batch, then INSERT in one call
      const allRows: Awaited<ReturnType<typeof parseBoxScore>> = [];
      for (const raw of rawRows) {
        try {
          // DuckDB returns JSON columns as strings — parse them
          const gameJson = typeof raw.game_json === 'string'
            ? JSON.parse(raw.game_json)
            : raw.game_json;
          const boxScoreJson = typeof raw.box_score_json === 'string'
            ? JSON.parse(raw.box_score_json)
            : raw.box_score_json;

          const gameData = {
            game: gameJson,
            boxScore: { stats: boxScoreJson },
          };

          allRows.push(...parseBoxScore(gameData));
          processed++;
        } catch (err) {
          errors++;
          logger.error('Failed to hydrate game', {
            gameId: raw.game_id,
            error: (err as Error).message,
          });
        }
      }

      // Batch insert all rows for this chunk (loadBoxScoreRows handles internal batching at 500)
      if (allRows.length > 0) {
        await loader.loadBoxScoreRows(allRows);
      }

      logger.progress(`Hydrated ${processed}/${gameIds.length} games (${errors} errors)`);
    }

    // Clear the progress line
    if (process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    // 3. Reset audited_at so data quality checks re-run on hydrated games
    if (gameIds.length > 0) {
      // Process in batches to avoid SQL length limits
      for (const batch of batches) {
        const inClause = batch.map((id) => esc(id)).join(',');
        await db.execute(
          `UPDATE main.ingestion_log SET audited_at = NULL
           WHERE game_id IN (${inClause})`,
        );
      }
      logger.info('Reset audited_at for hydrated games');
    }

    logger.info('Hydration complete', { processed, errors, total: gameIds.length });
  } finally {
    db.close();
  }
}

main().catch((err) => {
  logger.error('Hydration failed', { error: (err as Error).message });
  process.exit(1);
});
