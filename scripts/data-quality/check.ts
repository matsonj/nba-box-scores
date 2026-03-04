#!/usr/bin/env tsx
// Main entry point for the data quality quarantine system.
// Runs all detectors against the v2 database, then applies auto-resolution.
//
// Usage:
//   tsx scripts/data-quality/check.ts
//   tsx scripts/data-quality/check.ts --re-audit
//   npm run data-quality:check
//   npm run data-quality:re-audit

import { MotherDuckConnection } from '../ingest/db/connection';
import { CREATE_DATA_QUALITY_QUARANTINE } from '../ingest/db/schema';
import type { Detector, DetectorResult } from './types';
import { wrongTeamDetector } from './detectors/wrong-team';
import { impossibleStatsDetector } from './detectors/impossible-stats';
import { scoreMismatchDetector } from './detectors/score-mismatch';
import { duplicatesDetector } from './detectors/duplicates';
import { autoResolve } from './auto-resolve';
import { createIssuesForPending } from './github-issues';

const ALL_DETECTORS: Detector[] = [
  wrongTeamDetector,
  impossibleStatsDetector,
  scoreMismatchDetector,
  duplicatesDetector,
];

function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const s = str.slice(0, width);
  return align === 'right' ? s.padStart(width) : s.padEnd(width);
}

async function main(): Promise<void> {
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
    process.exit(1);
  }

  const reAudit = process.argv.includes('--re-audit');

  const db = new MotherDuckConnection(token, 'nba_box_scores_v2');
  try {
    await db.connect();

    // Ensure quarantine table exists
    await db.execute(CREATE_DATA_QUALITY_QUARANTINE);

    // Ensure audited_at column exists (idempotent migration)
    await db.execute(`ALTER TABLE main.ingestion_log ADD COLUMN IF NOT EXISTS audited_at TIMESTAMP`);

    console.log('\n=== Data Quality Check ===\n');

    // Handle --re-audit: reset all audited_at timestamps
    if (reAudit) {
      await db.execute(`UPDATE main.ingestion_log SET audited_at = NULL WHERE audited_at IS NOT NULL`);
      console.log('Re-audit: reset all audited_at timestamps.\n');
    }

    // Query un-audited games and create temp table
    const unaudited = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.ingestion_log WHERE ingestion_status = 'success' AND audited_at IS NULL`,
    );
    const unauditedCount = Number(unaudited[0]?.cnt ?? 0);

    await db.execute(`
      CREATE OR REPLACE TEMP TABLE _unaudited_games AS
      SELECT game_id FROM main.ingestion_log
      WHERE ingestion_status = 'success' AND audited_at IS NULL
    `);

    const incremental = unauditedCount > 0;
    console.log(`Games to audit: ${unauditedCount}${incremental ? '' : ' (all audited, skipping detectors)'}\n`);

    // Run all detectors
    const results: DetectorResult[] = [];
    if (incremental) {
      for (const detector of ALL_DETECTORS) {
        process.stdout.write(`Running ${detector.name}...`);
        const result = await detector.run(db, { incremental: true });
        results.push(result);
        console.log(` done (${result.inserted} new, ${result.found} total)`);
      }
    }

    // Print summary table
    console.log('\n--- Detector Summary ---\n');
    const header = [
      pad('Detector', 20),
      pad('New', 8, 'right'),
      pad('Total', 8, 'right'),
    ].join('  ');
    console.log(header);
    console.log('-'.repeat(header.length));

    let totalNew = 0;
    let totalAll = 0;
    for (const r of results) {
      console.log(
        [
          pad(r.name, 20),
          pad(String(r.inserted), 8, 'right'),
          pad(String(r.found), 8, 'right'),
        ].join('  '),
      );
      totalNew += r.inserted;
      totalAll += r.found;
    }
    console.log('-'.repeat(header.length));
    console.log(
      [
        pad('TOTAL', 20),
        pad(String(totalNew), 8, 'right'),
        pad(String(totalAll), 8, 'right'),
      ].join('  '),
    );

    // Run auto-resolution
    console.log('\n--- Auto-Resolution ---\n');
    const resolved = await autoResolve(db);
    console.log(`Auto-resolved ${resolved.resolved} record(s).`);

    // Create GitHub Issues for remaining pending records
    console.log('\n--- GitHub Issues ---\n');
    try {
      await createIssuesForPending(db);
    } catch (err) {
      console.warn(`GitHub issue creation skipped: ${err instanceof Error ? err.message : err}`);
    }

    // Mark un-audited games as audited (only after all detectors + auto-resolve succeed)
    if (incremental) {
      await db.execute(`
        UPDATE main.ingestion_log
        SET audited_at = CURRENT_TIMESTAMP
        WHERE ingestion_status = 'success' AND audited_at IS NULL
      `);
      console.log(`\nMarked ${unauditedCount} game(s) as audited.`);
    }

    // Final quarantine status
    const pending = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE resolution_status = 'pending'`,
    );
    const approved = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE resolution_status = 'approved'`,
    );
    console.log(`\nQuarantine status: ${Number(pending[0]?.cnt ?? 0)} pending, ${Number(approved[0]?.cnt ?? 0)} approved\n`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
