import { GAME_ID_PREFIXES } from '@/constants/game';

export type SeasonType = 'all' | 'regular' | 'playoffs';

/**
 * Determines the NBA season year from a game date.
 * NBA seasons span two calendar years (e.g., the 2024-25 season).
 * Games from October onward belong to the season starting that year.
 * Games before October belong to the season that started the previous year.
 */
export function getSeasonYearFromDate(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  // NBA season starts in October (month 9). Games Oct+ are the new season.
  return month >= 9 ? year : year - 1;
}

/**
 * Generates the list of available season years for the dropdown.
 * Returns years from current season down to the earliest season.
 */
export function getAvailableSeasons(startYear: number = 2000): number[] {
  const now = new Date();
  const currentSeason = getSeasonYearFromDate(now);
  const seasons: number[] = [];
  for (let year = currentSeason; year >= startYear; year--) {
    seasons.push(year);
  }
  return seasons;
}

/**
 * Formats a season year for display, e.g. 2024 -> "2024-25"
 */
export function formatSeasonLabel(year: number): string {
  const nextYear = (year + 1) % 100;
  return `${year}-${nextYear.toString().padStart(2, '0')}`;
}

/**
 * Returns true if the game is a playoff game based on its game_id.
 */
export function isPlayoffGame(gameId: string): boolean {
  return gameId.startsWith(GAME_ID_PREFIXES.PLAYOFFS) || gameId.startsWith(GAME_ID_PREFIXES.PLAY_IN);
}
