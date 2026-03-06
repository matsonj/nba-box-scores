export const NHL_GAME_ID_PREFIXES = {
  PRESEASON: '01',
  REGULAR_SEASON: '02',
  PLAYOFFS: '03',
} as const;

/**
 * Determines the NHL season year from a game date.
 * NHL seasons span two calendar years (e.g., the 2024-25 season).
 * Games from September onward belong to the season starting that year.
 * Games before September belong to the season that started the previous year.
 */
export function getNHLSeasonYearFromDate(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  // NHL season starts in October (month 9). Games Sep+ are the new season.
  return month >= 9 ? year : year - 1;
}

/**
 * Generates the list of available NHL season years.
 * Returns years from current season down to 2015.
 */
export function getNHLAvailableSeasons(): number[] {
  const now = new Date();
  const currentSeason = getNHLSeasonYearFromDate(now);
  const seasons: number[] = [];
  for (let year = currentSeason; year >= 2015; year--) {
    seasons.push(year);
  }
  return seasons;
}

/**
 * Formats a season year for display, e.g. 2024 -> "2024-25"
 */
export function formatNHLSeasonLabel(year: number): string {
  const nextYear = (year + 1) % 100;
  return `${year}-${nextYear.toString().padStart(2, '0')}`;
}

/**
 * Returns true if the game is a playoff game based on its game_id.
 * NHL game IDs have the season type at positions 4-5 (0-indexed).
 * '03' indicates a playoff game.
 */
export function isNHLPlayoffGame(gameId: string): boolean {
  return gameId.substring(4, 6) === NHL_GAME_ID_PREFIXES.PLAYOFFS;
}

/**
 * Returns the season type string from a game_id.
 * Characters at positions 4-5 encode the season type.
 */
export function getNHLSeasonTypeFromGameId(gameId: string): string {
  const prefix = gameId.substring(4, 6);
  switch (prefix) {
    case NHL_GAME_ID_PREFIXES.PRESEASON:
      return 'Preseason';
    case NHL_GAME_ID_PREFIXES.REGULAR_SEASON:
      return 'Regular Season';
    case NHL_GAME_ID_PREFIXES.PLAYOFFS:
      return 'Playoffs';
    default:
      return 'Unknown';
  }
}
