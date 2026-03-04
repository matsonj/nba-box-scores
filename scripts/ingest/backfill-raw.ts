#!/usr/bin/env tsx
// One-time backfill: load raw JSON from local data/box_scores/ cache
// into the raw_game_data_pbpstats table.
//
// Usage: npm run raw:backfill

import * as fs from 'fs';
import * as path from 'path';
import { MotherDuckConnection } from './db/connection';
import { Loader } from './db/loader';
import { getSeasonType, getSeasonYear } from './parse/season-utils';
import { logger } from './util/logger';

const DATA_DIR = path.resolve(__dirname, '../../data/box_scores');
const BATCH_SIZE = 50;

async function main(): Promise<void> {
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    logger.error('MOTHERDUCK_TOKEN environment variable is required');
    process.exit(1);
  }

  const db = new MotherDuckConnection(token);
  await db.connect();
  const loader = new Loader(db);

  try {
    await loader.ensureSchema();

    // Glob JSON files
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    logger.info('Found local JSON files', { count: files.length, dir: DATA_DIR });

    if (files.length === 0) {
      logger.info('No files to backfill');
      return;
    }

    let loaded = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);

      for (const file of batch) {
        try {
          const filePath = path.join(DATA_DIR, file);
          const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          const gameId = raw.game.gameId as string;
          const gameDateEst = raw.game.gameDateEst as string;
          const seasonYear = getSeasonYear(gameDateEst);
          const seasonType = getSeasonType(gameId);

          await loader.storeRawPbpstats(
            gameId,
            seasonYear,
            seasonType,
            raw.game,
            raw.boxScore.stats,
          );

          loaded++;
        } catch (err) {
          errors++;
          logger.error('Failed to backfill file', {
            file,
            error: (err as Error).message,
          });
        }
      }

      logger.progress(`Backfilled ${loaded}/${files.length} files (${errors} errors)`);
    }

    // Clear the progress line
    if (process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    logger.info('Backfill complete', { loaded, errors, total: files.length });
  } finally {
    db.close();
  }
}

main().catch((err) => {
  logger.error('Backfill failed', { error: (err as Error).message });
  process.exit(1);
});
