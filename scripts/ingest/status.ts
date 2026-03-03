#!/usr/bin/env tsx
// CLI tool to display ingestion pipeline status
//
// Usage:
//   tsx scripts/ingest/status.ts                    # show overall summary
//   tsx scripts/ingest/status.ts --season 2024-25   # show details for a season
//   tsx scripts/ingest/status.ts --errors           # show recent errors

import { MotherDuckConnection } from './db/connection';
import {
  getIngestionSummary,
  getRecentErrors,
  getOverallStats,
  type IngestionSummaryRow,
  type RecentErrorRow,
} from './db/queries';

// --- CLI arg parsing ---

interface StatusOptions {
  season?: number;
  errors: boolean;
}

function parseArgs(args: string[]): StatusOptions {
  const opts: StatusOptions = { errors: false };
  const argv = [...args];

  while (argv.length > 0) {
    const arg = argv.shift()!;
    switch (arg) {
      case '--season': {
        const val = argv.shift();
        if (!val) {
          console.error('Error: --season requires a value (e.g. 2024-25 or 2024)');
          process.exit(1);
        }
        // Accept both "2024-25" and "2024"
        const yearStr = val.includes('-') ? val.split('-')[0] : val;
        const year = parseInt(yearStr, 10);
        if (isNaN(year) || year < 1946 || year > 2100) {
          console.error(`Error: Invalid season: ${val}`);
          process.exit(1);
        }
        opts.season = year;
        break;
      }
      case '--errors':
        opts.errors = true;
        break;
      case '--help':
        console.log(USAGE);
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        console.log(USAGE);
        process.exit(1);
    }
  }
  return opts;
}

const USAGE = `
Usage: tsx scripts/ingest/status.ts [options]

Options:
  --season <YYYY-YY>   Show details for a specific season (e.g. 2024-25)
  --errors             Show recent ingestion errors
  --help               Show this help message

Environment:
  MOTHERDUCK_TOKEN     MotherDuck API token (required)
`.trim();

// --- Formatting helpers ---

function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const s = str.slice(0, width);
  return align === 'right' ? s.padStart(width) : s.padEnd(width);
}

function seasonLabel(year: number): string {
  const endYear = (year + 1) % 100;
  return `${year}-${endYear.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function printSummaryTable(rows: IngestionSummaryRow[]): void {
  const header = [
    pad('Season', 10),
    pad('Type', 16),
    pad('Total', 7, 'right'),
    pad('OK', 7, 'right'),
    pad('Errors', 7, 'right'),
    pad('Last Ingested', 20),
  ].join('  ');

  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    console.log(
      [
        pad(seasonLabel(row.season_year), 10),
        pad(row.season_type, 16),
        pad(String(row.total_games), 7, 'right'),
        pad(String(row.success_count), 7, 'right'),
        pad(String(row.error_count), 7, 'right'),
        pad(formatTimestamp(row.last_ingested_at), 20),
      ].join('  '),
    );
  }
}

function printErrorsTable(rows: RecentErrorRow[]): void {
  if (rows.length === 0) {
    console.log('No recent errors.');
    return;
  }

  const header = [
    pad('Game ID', 12),
    pad('Season', 10),
    pad('Type', 16),
    pad('Time', 20),
    pad('Error', 50),
  ].join('  ');

  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    console.log(
      [
        pad(row.game_id, 12),
        pad(seasonLabel(row.season_year), 10),
        pad(row.season_type, 16),
        pad(formatTimestamp(row.ingested_at), 20),
        pad(row.error_message ?? '', 50),
      ].join('  '),
    );
  }
}

// --- Main ---

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
    process.exit(1);
  }

  const db = new MotherDuckConnection(token, 'nba_box_scores_v2');
  try {
    await db.connect();

    if (opts.errors) {
      console.log('\n=== Recent Ingestion Errors ===\n');
      const errors = await getRecentErrors(db);
      printErrorsTable(errors);
      console.log();
      return;
    }

    // Overall stats
    const stats = await getOverallStats(db);
    console.log('\n=== Ingestion Pipeline Status ===\n');
    console.log(`  Games ingested:   ${stats.total_games_ingested.toLocaleString()}`);
    console.log(`  Box score rows:   ${stats.total_box_score_rows.toLocaleString()}`);
    console.log(`  Unique players:   ${stats.total_unique_players.toLocaleString()}`);
    console.log();

    // Per-season summary
    console.log('=== Per-Season Summary ===\n');
    const summary = await getIngestionSummary(db, opts.season);
    if (summary.length === 0) {
      console.log(
        opts.season
          ? `No ingestion data found for season ${seasonLabel(opts.season)}.`
          : 'No ingestion data found.',
      );
    } else {
      printSummaryTable(summary);
    }
    console.log();
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
