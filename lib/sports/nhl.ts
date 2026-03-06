import type { SportConfig } from './types';
import { NHL_TEAM_ABBREVIATIONS, nhlTeamNames } from '@/lib/nhl/teams';

const NHL_REGULAR_PERIODS = 3;
const NHL_MAX_PERIODS = 5; // 3 regular + OT + SO

/**
 * Determines the NHL season year from a date.
 * NHL seasons span two calendar years (e.g., the 2024-25 season).
 * Games from October onward belong to the season starting that year.
 * Games before October belong to the season that started the previous year.
 */
function getNhlSeasonYear(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  return month >= 9 ? year : year - 1;
}

function formatNhlSeasonLabel(year: number): string {
  const nextYear = (year + 1) % 100;
  return `${year}-${nextYear.toString().padStart(2, '0')}`;
}

function getNhlAvailableSeasons(): number[] {
  const now = new Date();
  const currentSeason = getNhlSeasonYear(now);
  const startYear = 2015;
  const seasons: number[] = [];
  for (let year = currentSeason; year >= startYear; year--) {
    seasons.push(year);
  }
  return seasons;
}

function isNhlPlayoffGame(gameId: string): boolean {
  return gameId.substring(4, 6) === '03';
}

function getNhlPeriodLabel(period: number | string): string {
  const p = Number(period);
  if (p <= NHL_REGULAR_PERIODS) return p.toString();
  if (p === NHL_REGULAR_PERIODS + 1) return 'OT';
  if (p === NHL_REGULAR_PERIODS + 2) return 'SO';
  return `OT${p - NHL_REGULAR_PERIODS}`;
}

export const nhlConfig: SportConfig = {
  id: 'nhl',
  displayName: 'NHL',
  subtitle: 'mega fast sports data',
  liveScoresEndpoint: '/api/nhl-live-scores',
  liveBoxScoreEndpoint: '/api/nhl-live-boxscore',
  database: 'nhl_box_scores',
  teams: nhlTeamNames,
  teamAbbreviations: NHL_TEAM_ABBREVIATIONS,
  getSeasonYear: getNhlSeasonYear,
  formatSeasonLabel: formatNhlSeasonLabel,
  getAvailableSeasons: getNhlAvailableSeasons,
  isPlayoffGame: isNhlPlayoffGame,
  periodLabels: getNhlPeriodLabel,
  regularPeriods: NHL_REGULAR_PERIODS,
  maxPeriods: NHL_MAX_PERIODS,
};
