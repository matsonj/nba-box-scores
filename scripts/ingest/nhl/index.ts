#!/usr/bin/env tsx
// CLI entry point for the NHL box scores ingestion pipeline

import { buildNHLConfig, seasonTypeLabel } from './config';
import { configure } from '../api/rate-limiter';
import { MotherDuckConnection } from '../db/connection';
import { NHLLoader } from './db/loader';
import { processNHLSeason } from './workers/season-worker';
import { runPool } from '../workers/pool';
import { shutdownSignal } from '../util/shutdown';
import { logger } from '../util/logger';
import type { NHLSeasonProgress } from './types';

async function main(): Promise<void> {
  const config = buildNHLConfig();

  if (config.verbose) {
    logger.setVerbose(true);
  }

  // Configure adaptive throttle
  configure({
    baseDelay: config.delay,
    minDelay: config.minDelay,
    maxDelay: config.maxDelay,
  });

  logger.info('NHL Box Scores Ingestion Pipeline', {
    seasons: config.seasons.length,
    delay: `${config.delay}ms (${config.minDelay}-${config.maxDelay}ms)`,
    seasonConcurrency: config.seasonConcurrency,
    force: config.force,
    dryRun: config.dryRun,
  });

  if (config.seasonConcurrency > 1) {
    logger.warn('season-concurrency > 1: multiple seasons share one rate limiter, may overshoot API limits');
  }

  // Dry-run: just print what would be processed
  if (config.dryRun) {
    logger.info('DRY RUN — no data will be written');
    for (const s of config.seasons) {
      logger.info(`  Would process: ${s.year}-${((s.year + 1) % 100).toString().padStart(2, '0')} (${seasonTypeLabel(s.type)})`);
    }
  }

  // Connect to MotherDuck
  const db = new MotherDuckConnection(config.motherDuckToken, config.database);
  await db.connect();

  const loader = new NHLLoader(db);

  try {
    // Ensure schema exists
    await loader.ensureSchema();

    // Build season tasks
    const seasonTasks = config.seasons.map((s) => ({
      year: s.year,
      type: s.type,
    }));

    // Process seasons
    const allProgress: NHLSeasonProgress[] = [];

    if (config.seasonConcurrency <= 1) {
      // Sequential season processing
      for (const task of seasonTasks) {
        if (shutdownSignal.aborted) break;
        const progress = await processNHLSeason(
          task.year,
          task.type,
          loader,
          config,
          shutdownSignal,
        );
        allProgress.push(progress);
      }
    } else {
      // Parallel season processing via pool
      const poolResult = await runPool(
        seasonTasks,
        async (task, signal) => {
          return processNHLSeason(task.year, task.type, loader, config, signal);
        },
        config.seasonConcurrency,
        shutdownSignal,
      );
      allProgress.push(...poolResult.results);
    }

    // Derive team stats (unless dry-run)
    if (!config.dryRun && !shutdownSignal.aborted) {
      logger.info('Refreshing team_stats view...');
      await loader.deriveTeamStats();
    }

    // Print summary
    const totalCompleted = allProgress.reduce((s, p) => s + p.completed, 0);
    const totalSkipped = allProgress.reduce((s, p) => s + p.skipped, 0);
    const totalFailed = allProgress.reduce((s, p) => s + p.failed, 0);
    const totalGames = allProgress.reduce((s, p) => s + p.totalGames, 0);

    logger.info('Pipeline complete', {
      seasons: allProgress.length,
      totalGames,
      completed: totalCompleted,
      skipped: totalSkipped,
      failed: totalFailed,
    });

    if (totalFailed > 0) {
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  logger.error('Pipeline failed', { error: (err as Error).message });
  process.exit(1);
});
