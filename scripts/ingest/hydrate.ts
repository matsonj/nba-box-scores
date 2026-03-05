#!/usr/bin/env tsx
// Re-derive box_scores from raw JSON stored in raw_game_data_pbpstats.
//
// Uses server-side SQL (DELETE + INSERT ... SELECT) instead of pulling JSON
// to the client, parsing in TypeScript, and pushing rows back. This is
// dramatically faster because all JSON extraction, aggregation, and starter
// assignment happen inside MotherDuck/DuckDB.
//
// Usage:
//   npm run hydrate -- --season 2024
//   npm run hydrate -- --game 0022400001
//   npm run hydrate -- --all

import { MotherDuckConnection } from './db/connection';
import { Loader } from './db/loader';
import { buildDeleteSQL, buildInsertSQL, buildResetAuditSQL } from './db/hydration-sql';
import { logger } from './util/logger';

/** Escape a SQL string value (single quotes) */
function esc(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
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

    // Build the game filter clause based on CLI args
    let gameFilter: string;
    let description: string;

    if (config.mode === 'season') {
      gameFilter = `r.season_year = ${config.season}`;
      description = `season ${config.season}`;
    } else if (config.mode === 'game') {
      gameFilter = `r.game_id = ${esc(config.gameId)}`;
      description = `game ${config.gameId}`;
    } else {
      gameFilter = 'TRUE';
      description = 'all games';
    }

    // Count games to hydrate
    const countRows = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.raw_game_data_pbpstats r WHERE ${gameFilter}`,
    );
    const gameCount = countRows[0]?.cnt ?? 0;

    if (gameCount === 0) {
      logger.info('No games found to hydrate');
      return;
    }

    logger.info(`Hydrating ${description}`, { games: gameCount });

    // 1. DELETE existing box_scores for targeted games (clean slate)
    const deleteSQL = buildDeleteSQL(gameFilter);
    logger.info('Deleting existing box_scores for targeted games');
    await db.execute(deleteSQL);

    // 2. INSERT ... SELECT: derive box_scores from raw JSON entirely in SQL
    const insertSQL = buildInsertSQL(gameFilter);
    logger.info('Running SQL hydration (INSERT ... SELECT from raw JSON)');
    const startTime = Date.now();
    await db.execute(insertSQL);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 3. Count how many rows were inserted
    const rowCountResult = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.box_scores
       WHERE game_id IN (SELECT game_id FROM main.raw_game_data_pbpstats r WHERE ${gameFilter})`,
    );
    const rowCount = rowCountResult[0]?.cnt ?? 0;

    logger.info('SQL hydration complete', {
      games: gameCount,
      rows_inserted: rowCount,
      elapsed_seconds: elapsed,
    });

    // 4. Reset audited_at so data quality checks re-run on hydrated games
    const resetSQL = buildResetAuditSQL(gameFilter);
    await db.execute(resetSQL);
    logger.info('Reset audited_at for hydrated games');

    logger.info('Hydration complete', { games: gameCount, rows: rowCount });
  } finally {
    db.close();
  }
}

main().catch((err) => {
  logger.error('Hydration failed', { error: (err as Error).message });
  process.exit(1);
});
