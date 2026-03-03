#!/usr/bin/env tsx
// Main entry point for the data quality quarantine system.
// Runs all detectors against the v2 database, then applies auto-resolution.
//
// Usage:
//   tsx scripts/data-quality/check.ts
//   npm run data-quality:check

import { MotherDuckConnection } from '../ingest/db/connection';
import { CREATE_DATA_QUALITY_QUARANTINE } from '../ingest/db/schema';
import type { Detector, DetectorResult } from './types';
import { teamSwitchDetector } from './detectors/team-switch';
import { impossibleStatsDetector } from './detectors/impossible-stats';
import { scoreMismatchDetector } from './detectors/score-mismatch';
import { duplicatesDetector } from './detectors/duplicates';
import { autoResolve } from './auto-resolve';
import { createIssuesForPending } from './github-issues';

const ALL_DETECTORS: Detector[] = [
  teamSwitchDetector,
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

  const db = new MotherDuckConnection(token, 'nba_box_scores_v2');
  try {
    await db.connect();

    // Ensure quarantine table exists
    await db.execute(CREATE_DATA_QUALITY_QUARANTINE);

    console.log('\n=== Data Quality Check ===\n');

    // Run all detectors
    const results: DetectorResult[] = [];
    for (const detector of ALL_DETECTORS) {
      process.stdout.write(`Running ${detector.name}...`);
      const result = await detector.run(db);
      results.push(result);
      console.log(` done (${result.inserted} new, ${result.found} total)`);
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
    console.log(`Auto-resolved ${resolved.resolved} team_switch record(s) via 3-game rule.`);

    // Create GitHub Issues for remaining pending records
    console.log('\n--- GitHub Issues ---\n');
    try {
      await createIssuesForPending(db);
    } catch (err) {
      console.warn(`GitHub issue creation skipped: ${err instanceof Error ? err.message : err}`);
    }

    // Final quarantine status
    const pending = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE resolution_status = 'pending'`,
    );
    const approved = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE resolution_status = 'approved'`,
    );
    console.log(`\nQuarantine status: ${pending[0]?.cnt ?? 0} pending, ${approved[0]?.cnt ?? 0} approved\n`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
