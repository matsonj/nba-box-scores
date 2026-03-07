// Configuration interface + CLI arg parser for the NHL ingestion pipeline

import type { NHLPipelineConfig } from './types';

const USAGE = `
Usage: tsx scripts/ingest/nhl/index.ts [options]

Season selection (at least one required):
  --season <year>               Single season (e.g. 2024 for 2024-25)
  --from <year> --to <year>     Range of seasons (inclusive)
  --all                         All seasons from 2015 to current

Options:
  --season-type <type>          "02" (Regular Season) | "03" (Playoffs)  [default: "02"]
  --delay <ms>                  Base delay between API requests [default: 500]
  --min-delay <ms>              Minimum delay (adaptive floor)  [default: 200]
  --max-delay <ms>              Maximum delay (adaptive cap)    [default: 10000]
  --season-concurrency <n>      Parallel season workers         [default: 1]
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
  // NHL season starts in October; if we're before October, the current season
  // started last calendar year
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Map season type codes to human-readable labels */
export function seasonTypeLabel(type: string): string {
  switch (type) {
    case '02': return 'Regular Season';
    case '03': return 'Playoffs';
    default: return type;
  }
}

export function buildNHLConfig(args: string[] = process.argv.slice(2)): NHLPipelineConfig {
  const argv = [...args];

  let season: number | undefined;
  let from: number | undefined;
  let to: number | undefined;
  let all = false;
  let seasonType = '02'; // Regular Season
  let delay = 500;
  let minDelay = 200;
  let maxDelay = 10_000;
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
        if (isNaN(season) || season < 2000 || season > 2100) {
          fail(`Invalid season year: ${val}`);
        }
        break;
      }
      case '--from': {
        const val = argv.shift();
        if (!val) fail('--from requires a value');
        from = parseInt(val, 10);
        if (isNaN(from) || from < 2000 || from > 2100) {
          fail(`Invalid from year: ${val}`);
        }
        break;
      }
      case '--to': {
        const val = argv.shift();
        if (!val) fail('--to requires a value');
        to = parseInt(val, 10);
        if (isNaN(to) || to < 2000 || to > 2100) {
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
        if (val !== '02' && val !== '03') {
          fail(`Invalid season type: "${val}". Must be "02" (Regular Season) or "03" (Playoffs).`);
        }
        seasonType = val;
        break;
      }
      case '--delay': {
        const val = argv.shift();
        if (!val) fail('--delay requires a value');
        delay = parseInt(val, 10);
        if (isNaN(delay) || delay < 0) {
          fail(`Invalid delay: ${val}`);
        }
        break;
      }
      case '--min-delay': {
        const val = argv.shift();
        if (!val) fail('--min-delay requires a value');
        minDelay = parseInt(val, 10);
        if (isNaN(minDelay) || minDelay < 0) {
          fail(`Invalid min-delay: ${val}`);
        }
        break;
      }
      case '--max-delay': {
        const val = argv.shift();
        if (!val) fail('--max-delay requires a value');
        maxDelay = parseInt(val, 10);
        if (isNaN(maxDelay) || maxDelay < 0) {
          fail(`Invalid max-delay: ${val}`);
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
    for (let y = 2015; y <= current; y++) {
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

  // Validate delay bounds
  if (minDelay > maxDelay) {
    fail(`--min-delay (${minDelay}) must be <= --max-delay (${maxDelay})`);
  }
  if (delay < minDelay || delay > maxDelay) {
    fail(`--delay (${delay}) must be between --min-delay (${minDelay}) and --max-delay (${maxDelay})`);
  }

  // Validate MOTHERDUCK_TOKEN
  const motherDuckToken = process.env.MOTHERDUCK_TOKEN;
  if (!motherDuckToken) {
    fail('MOTHERDUCK_TOKEN environment variable is required');
  }

  return {
    seasons,
    delay,
    minDelay,
    maxDelay,
    seasonConcurrency,
    force,
    dryRun,
    verbose,
    motherDuckToken,
    database: 'nhl_box_scores',
  };
}
