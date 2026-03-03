// Configuration interface + CLI arg parser for the ingestion pipeline

import type { PipelineConfig } from './types';

const USAGE = `
Usage: tsx scripts/ingest/main.ts [options]

Season selection (at least one required):
  --season <year>               Single season (e.g. 2025 for 2025-26)
  --from <year> --to <year>     Range of seasons (inclusive)
  --all                         All seasons from 2000 to current

Options:
  --season-type <type>          "Regular Season" | "Playoffs"  [default: "Regular Season"]
  --concurrency <n>             Parallel game workers          [default: 10]
  --season-concurrency <n>      Parallel season workers        [default: 3]
  --force                       Re-ingest even if already logged
  --dry-run                     Log actions without writing to DB
  --verbose                     Enable debug-level logging
  --help                        Show this help message

Environment:
  MOTHERDUCK_TOKEN              MotherDuck API token (required)
`.trim();

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function currentSeasonYear(): number {
  const now = new Date();
  // NBA season starts in October; if we're before October, the current season
  // started last calendar year
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

export function buildConfig(args: string[] = process.argv.slice(2)): PipelineConfig {
  const argv = [...args];

  let season: number | undefined;
  let from: number | undefined;
  let to: number | undefined;
  let all = false;
  let seasonType = 'Regular Season';
  let concurrency = 5;
  let seasonConcurrency = 1;
  let force = false;
  let dryRun = false;
  let verbose = false;

  while (argv.length > 0) {
    const arg = argv.shift()!;

    switch (arg) {
      case '--season': {
        const val = argv.shift();
        if (!val) fail('--season requires a value');
        season = parseInt(val, 10);
        if (isNaN(season) || season < 1946 || season > 2100) {
          fail(`Invalid season year: ${val}`);
        }
        break;
      }
      case '--from': {
        const val = argv.shift();
        if (!val) fail('--from requires a value');
        from = parseInt(val, 10);
        if (isNaN(from) || from < 1946 || from > 2100) {
          fail(`Invalid from year: ${val}`);
        }
        break;
      }
      case '--to': {
        const val = argv.shift();
        if (!val) fail('--to requires a value');
        to = parseInt(val, 10);
        if (isNaN(to) || to < 1946 || to > 2100) {
          fail(`Invalid to year: ${val}`);
        }
        break;
      }
      case '--all':
        all = true;
        break;
      case '--season-type': {
        const val = argv.shift();
        if (!val) fail('--season-type requires a value');
        if (val !== 'Regular Season' && val !== 'Playoffs') {
          fail(`Invalid season type: "${val}". Must be "Regular Season" or "Playoffs".`);
        }
        seasonType = val;
        break;
      }
      case '--concurrency': {
        const val = argv.shift();
        if (!val) fail('--concurrency requires a value');
        concurrency = parseInt(val, 10);
        if (isNaN(concurrency) || concurrency < 1) {
          fail(`Invalid concurrency: ${val}`);
        }
        break;
      }
      case '--season-concurrency': {
        const val = argv.shift();
        if (!val) fail('--season-concurrency requires a value');
        seasonConcurrency = parseInt(val, 10);
        if (isNaN(seasonConcurrency) || seasonConcurrency < 1) {
          fail(`Invalid season-concurrency: ${val}`);
        }
        break;
      }
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

  // Build seasons list
  const seasons: Array<{ year: number; type: string }> = [];

  if (all) {
    const current = currentSeasonYear();
    for (let y = 2000; y <= current; y++) {
      seasons.push({ year: y, type: seasonType });
    }
  } else if (from !== undefined && to !== undefined) {
    if (from > to) fail(`--from (${from}) must be <= --to (${to})`);
    for (let y = from; y <= to; y++) {
      seasons.push({ year: y, type: seasonType });
    }
  } else if (from !== undefined || to !== undefined) {
    fail('--from and --to must be used together');
  } else if (season !== undefined) {
    seasons.push({ year: season, type: seasonType });
  } else {
    fail('At least one of --season, --from/--to, or --all is required');
  }

  // Validate MOTHERDUCK_TOKEN
  const motherDuckToken = process.env.MOTHERDUCK_TOKEN;
  if (!motherDuckToken) {
    fail('MOTHERDUCK_TOKEN environment variable is required');
  }

  return {
    seasons,
    concurrency,
    seasonConcurrency,
    force,
    dryRun,
    verbose,
    motherDuckToken,
    database: 'nba_box_scores_v2',
  };
}
