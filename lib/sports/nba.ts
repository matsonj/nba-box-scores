import { teamNames, TEAM_ABBREVIATIONS } from '@/lib/teams';
import {
  getSeasonYearFromDate,
  formatSeasonLabel,
  getAvailableSeasons,
  isPlayoffGame,
} from '@/lib/seasonUtils';
import { getPeriodLabel } from '@/lib/periodUtils';
import { MAX_PERIODS, REGULAR_PERIODS } from '@/constants/game';
import type { SportConfig } from './types';

export const nbaConfig: SportConfig = {
  id: 'nba',
  displayName: 'NBA',
  subtitle: 'mega fast sports data',
  liveScoresEndpoint: '/api/live-scores',
  liveBoxScoreEndpoint: '/api/live-boxscore',
  database: 'nba_box_scores_v2',
  teams: teamNames,
  teamAbbreviations: TEAM_ABBREVIATIONS,
  getSeasonYear: getSeasonYearFromDate,
  formatSeasonLabel,
  getAvailableSeasons,
  isPlayoffGame,
  periodLabels: (period: number | string) => getPeriodLabel(Number(period)),
  regularPeriods: REGULAR_PERIODS,
  maxPeriods: MAX_PERIODS,
};
