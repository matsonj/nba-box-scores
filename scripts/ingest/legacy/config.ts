// Configuration interface + CLI arg parser for the pre-2000 legacy backfill.

import * as fs from 'fs';
import * as path from 'path';
import type { LegacyConfig, LegacySourceFormat } from './types';

const USAGE = `
Usage: tsx scripts/ingest/legacy/index.ts --source <path> [options]

Imports pre-2000 NBA box scores from a static Kaggle dataset (one-time backfill).
stats.nba.com is IP-blocked from our infra and from CI, so this reads a downloaded
file directly via DuckDB instead of scraping a live API.

Required:
  --source <path>     Path to the Kaggle file: .sqlite/.db (ATTACH), .csv (read_csv),
                      or .parquet (read_parquet).

Season selection:
  --from <year>       Start season year, inclusive  [default: 1947]
  --to <year>         End season year, inclusive     [default: 1999]
                      (years are season START years; clamped to 1946..1999)

Options:
  --force             Re-import games already in the ingestion_log
  --dry-run           Read + parse + log counts, but write nothing
  --database <name>   Target MotherDuck database     [default: nba_box_scores_v2]
  --verbose           Enable debug-level logging
  --help              Show this help message

Environment:
  MOTHERDUCK_TOKEN    MotherDuck API token (required)
`.trim();

const MIN_YEAR = 1946;
const MAX_YEAR = 1999;

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

/** Infer how DuckDB should read the source from its extension, or directory contents. */
export function detectSourceFormat(source: string): LegacySourceFormat {
  const lower = source.toLowerCase();
  if (lower.endsWith('.sqlite') || lower.endsWith('.sqlite3') || lower.endsWith('.db')) {
    return 'sqlite';
  }
  if (lower.endsWith('.parquet')) return 'parquet';
  if (lower.endsWith('.csv')) return 'csv';

  // A directory holding PlayerStatistics.* / Games.*: pick parquet if present, else csv.
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    if (fs.existsSync(path.join(source, 'PlayerStatistics.parquet'))) return 'parquet';
    return 'csv';
  }
  fail(`Cannot infer source format from "${source}". Use a .sqlite/.db, .csv, or .parquet path, or a directory of CSVs.`);
}

function parseYear(label: string, val: string | undefined): number {
  if (!val) fail(`${label} requires a value`);
  const n = parseInt(val, 10);
  if (isNaN(n)) fail(`Invalid ${label} year: ${val}`);
  return n;
}

export function buildLegacyConfig(args: string[] = process.argv.slice(2)): LegacyConfig {
  const argv = [...args];

  let source: string | undefined;
  let fromYear = 1947;
  let toYear = 1999;
  let force = false;
  let dryRun = false;
  let verbose = false;
  let database = 'nba_box_scores_v2';

  while (argv.length > 0) {
    const arg = argv.shift()!;
    switch (arg) {
      case '--source':
        source = argv.shift();
        if (!source) fail('--source requires a value');
        break;
      case '--from':
        fromYear = parseYear('--from', argv.shift());
        break;
      case '--to':
        toYear = parseYear('--to', argv.shift());
        break;
      case '--database':
        database = argv.shift() ?? fail('--database requires a value');
        break;
      case '--force':
        force = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--help':
        console.log(USAGE);
        process.exit(0);
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!source) fail('--source is required');

  // Clamp to the era this pipeline owns (pre-2000); the live pipeline covers 2000+.
  if (fromYear < MIN_YEAR) fromYear = MIN_YEAR;
  if (toYear > MAX_YEAR) toYear = MAX_YEAR;
  if (fromYear > toYear) fail(`--from (${fromYear}) must be <= --to (${toYear})`);

  const motherDuckToken = process.env.MOTHERDUCK_TOKEN;
  if (!motherDuckToken) {
    fail('MOTHERDUCK_TOKEN environment variable is required');
  }

  return {
    source,
    sourceFormat: detectSourceFormat(source),
    fromYear,
    toYear,
    force,
    dryRun,
    verbose,
    motherDuckToken,
    database,
  };
}
