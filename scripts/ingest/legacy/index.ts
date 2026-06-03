#!/usr/bin/env tsx
// CLI entry point for the pre-2000 legacy backfill (static Kaggle import).
//
// stats.nba.com is IP-blocked from our infra and from CI, so instead of scraping
// a live API this imports a downloaded Kaggle dataset directly via DuckDB. Steals/
// blocks (pre-1973-74) and turnovers (pre-1977-78) are regression-imputed; pre-1980
// three-pointers are a structural zero. See the imputer/parser for details.

import { buildLegacyConfig } from './config';
import { MotherDuckConnection } from '../db/connection';
import { Loader } from '../db/loader';
import { LEGACY_MIGRATIONS } from '../db/schema';
import {
  LegacySourceReader,
  storeRawLegacy,
  storeImputationModels,
  type RawLegacyRow,
} from './source-reader';
import { fitModels, modelsToRows } from './imputer';
import { parseGames, parsePlayerRows, legacyGameId } from './parser';
import { logger } from '../util/logger';
import { shutdownSignal } from '../util/shutdown';
import type { IngestionLogEntry } from '../types';
import type { NormalizedPlayerRow } from './types';

const SOURCE_DATASET = 'kaggle_eoinamoore';

/** Run idempotent in-place schema migrations, ignoring "already applied" errors. */
async function runMigrations(db: MotherDuckConnection): Promise<void> {
  for (const sql of LEGACY_MIGRATIONS) {
    try {
      await db.execute(sql);
    } catch (err) {
      logger.debug('Migration skipped (likely already applied)', {
        sql,
        error: (err as Error).message,
      });
    }
  }
}

async function main(): Promise<void> {
  const config = buildLegacyConfig();
  if (config.verbose) logger.setVerbose(true);

  logger.info('Legacy Backfill Pipeline (static Kaggle import)', {
    source: config.source,
    format: config.sourceFormat,
    range: `${config.fromYear}-${config.toYear}`,
    force: config.force,
    dryRun: config.dryRun,
    database: config.database,
  });

  const db = new MotherDuckConnection(config.motherDuckToken, config.database);
  await db.connect();

  const loader = new Loader(db);
  const reader = new LegacySourceReader(db, config);

  try {
    await loader.ensureSchema();
    await runMigrations(db);
    await reader.open();
    await reader.introspectSchema();

    if (shutdownSignal.aborted) return;

    // 1. Fit imputation models on the recorded era (>= 1973) of the same dataset.
    logger.info('Fitting imputation models on recorded-era player-seasons...');
    const seasonAggs = await reader.readRecordedEraSeasonAggregates();
    const models = fitModels(seasonAggs);
    for (const target of ['steals', 'blocks', 'turnovers'] as const) {
      const m = models[target];
      if (m) {
        logger.info(`  model[${target}]`, { r2: m.r2.toFixed(3), nTrain: m.nTrain });
      } else {
        logger.warn(`  model[${target}] not fit (insufficient training data) — will leave NULL`);
      }
    }

    // 2. Read + parse the requested range.
    const gameRows = await reader.readGames();
    const playerRows = await reader.readPlayerBox();
    logger.info('Read source rows', { games: gameRows.length, playerLines: playerRows.length });

    const scheduleRows = parseGames(gameRows);
    const boxScoreRows = parsePlayerRows(playerRows, models);

    // 3. Idempotency: skip games already logged (unless --force).
    const { keptSchedule, keptGameIds } = await filterAlreadyIngested(loader, scheduleRows, config.force);
    const keptBoxScores = boxScoreRows.filter((r) => keptGameIds.has(r.game_id));

    const imputedCount = keptBoxScores.filter((r) => r.estimated_stats).length;
    logger.info('Parsed', {
      schedule: keptSchedule.length,
      skipped: scheduleRows.length - keptSchedule.length,
      boxScoreRows: keptBoxScores.length,
      estimatedRows: imputedCount,
    });

    // 4. Dry-run: show samples, write nothing.
    if (config.dryRun) {
      logger.info('DRY RUN — no data will be written');
      const sampleReal = keptBoxScores.find((r) => !r.estimated_stats);
      const sampleImputed = keptBoxScores.find((r) => r.estimated_stats);
      if (sampleReal) logger.info('sample real row', { row: JSON.stringify(sampleReal) });
      if (sampleImputed) logger.info('sample imputed row', { row: JSON.stringify(sampleImputed) });
      return;
    }

    if (shutdownSignal.aborted) return;

    // 5. Write: models provenance, schedule, box scores, raw lake, ingestion log.
    await storeImputationModels(db, modelsToRows(models, `legacy-${Date.now()}`));
    await loader.loadScheduleRows(keptSchedule);
    await loader.loadBoxScoreRows(keptBoxScores);
    await storeRawLegacy(db, SOURCE_DATASET, null, buildRawRows(keptSchedule, gameRows, playerRows, keptGameIds));

    const logEntries: IngestionLogEntry[] = keptSchedule.map((s) => ({
      game_id: s.game_id,
      season_year: s.season_year,
      season_type: s.season_type,
      ingestion_status: 'success',
    }));
    await loader.markIngestedBatch(logEntries);

    logger.info('Refreshing team_stats view...');
    await loader.deriveTeamStats();

    logger.info('Legacy backfill complete', {
      games: keptSchedule.length,
      boxScoreRows: keptBoxScores.length,
      estimatedRows: imputedCount,
    });
  } finally {
    await reader.detach();
    db.close();
  }
}

/** Filter out games already in the ingestion_log (per season-year/type), unless force. */
async function filterAlreadyIngested(
  loader: Loader,
  scheduleRows: ReturnType<typeof parseGames>,
  force: boolean,
): Promise<{ keptSchedule: typeof scheduleRows; keptGameIds: Set<string> }> {
  if (force) {
    return { keptSchedule: scheduleRows, keptGameIds: new Set(scheduleRows.map((r) => r.game_id)) };
  }

  const pairs = new Map<string, { year: number; type: string }>();
  for (const r of scheduleRows) {
    pairs.set(`${r.season_year}:${r.season_type}`, { year: r.season_year, type: r.season_type });
  }
  const ingested = new Set<string>();
  for (const { year, type } of pairs.values()) {
    const ids = await loader.getIngestedGameIds(year, type);
    ids.forEach((id) => ingested.add(id));
  }

  const keptSchedule = scheduleRows.filter((r) => !ingested.has(r.game_id));
  return { keptSchedule, keptGameIds: new Set(keptSchedule.map((r) => r.game_id)) };
}

/** Build per-game raw provenance rows from the normalized source rows. */
function buildRawRows(
  keptSchedule: ReturnType<typeof parseGames>,
  gameRows: Awaited<ReturnType<LegacySourceReader['readGames']>>,
  playerRows: NormalizedPlayerRow[],
  keptGameIds: Set<string>,
): RawLegacyRow[] {
  const gameById = new Map(gameRows.map((g) => [legacyGameId(g.source_game_id), g]));
  const playersById = new Map<string, NormalizedPlayerRow[]>();
  for (const p of playerRows) {
    const id = legacyGameId(p.source_game_id);
    if (!keptGameIds.has(id)) continue;
    const list = playersById.get(id);
    if (list) list.push(p);
    else playersById.set(id, [p]);
  }

  return keptSchedule.map((s) => ({
    game_id: s.game_id,
    season_year: s.season_year,
    season_type: s.season_type,
    game_json: gameById.get(s.game_id) ?? null,
    box_score_json: playersById.get(s.game_id) ?? [],
  }));
}

main().catch((err) => {
  logger.error('Legacy backfill failed', { error: (err as Error).message });
  process.exit(1);
});
