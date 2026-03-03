/**
 * Season utility functions for NBA game ID parsing and season derivation.
 *
 * NBA game IDs encode the season type in their prefix:
 *   002 = Regular Season
 *   004 = Playoffs
 *   005 = Play-In
 *   006 = All Star
 *
 * The season year is derived from the game date: games played before July
 * belong to the season that started the prior calendar year.
 * e.g. a game on 2025-01-15 belongs to the 2024-25 season (seasonYear = 2024).
 */

const SEASON_TYPE_PREFIXES: Record<string, string> = {
  '002': 'Regular Season',
  '004': 'Playoffs',
  '005': 'Play-In',
  '006': 'All Star',
};

/**
 * Derives the season type from an NBA game ID prefix.
 * Returns the human-readable season type, or 'Unknown' for unrecognized prefixes.
 */
export function getSeasonType(gameId: string): string {
  const prefix = gameId.slice(0, 3);
  return SEASON_TYPE_PREFIXES[prefix] ?? 'Unknown';
}

/**
 * Derives the season start year from a game date.
 * NBA seasons straddle two calendar years (e.g. 2024-25).
 * Games played in months January-June belong to the season that started
 * the prior calendar year.
 */
export function getSeasonYear(gameDateStr: string): number {
  const date = new Date(gameDateStr);
  const month = date.getUTCMonth(); // 0-indexed: 0=Jan, 6=Jul
  const year = date.getUTCFullYear();
  // If the game is in Jan-June, it belongs to the previous year's season
  return month < 6 ? year - 1 : year;
}

/**
 * Converts a season start year to a season string.
 * e.g. 2024 → "2024-25"
 */
function yearToSeason(year: number): string {
  const endYear = (year + 1) % 100;
  return `${year}-${endYear.toString().padStart(2, '0')}`;
}

/**
 * Extracts the start year from a season string.
 * e.g. "2024-25" → 2024
 */
export function seasonToYear(season: string): number {
  const year = parseInt(season.split('-')[0], 10);
  if (isNaN(year)) {
    throw new Error(`Invalid season string: ${season}`);
  }
  return year;
}

/**
 * Returns the current NBA season string based on today's date.
 * If the current month is July or later, the season started this year.
 * If January-June, the season started last year.
 * e.g. in March 2026 → "2025-26", in October 2025 → "2025-26"
 */
export function currentSeason(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  const startYear = month < 6 ? year - 1 : year;
  return yearToSeason(startYear);
}

/**
 * Generates an array of season strings between start and end (inclusive).
 * e.g. seasonRange("2020-21", "2023-24") → ["2020-21", "2021-22", "2022-23", "2023-24"]
 */
export function seasonRange(start: string, end: string): string[] {
  const startYear = seasonToYear(start);
  const endYear = seasonToYear(end);
  if (endYear < startYear) {
    return [];
  }
  const seasons: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    seasons.push(yearToSeason(y));
  }
  return seasons;
}
