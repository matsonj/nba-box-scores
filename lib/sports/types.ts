export type Sport = 'nba' | 'nhl';

export interface SportConfig {
  id: Sport;
  displayName: string;
  subtitle: string;
  liveScoresEndpoint: string;
  liveBoxScoreEndpoint: string;
  database: string;
  teams: Record<string, string>;
  teamAbbreviations: readonly string[];
  getSeasonYear: (date: Date) => number;
  formatSeasonLabel: (year: number) => string;
  getAvailableSeasons: () => number[];
  isPlayoffGame: (gameId: string) => boolean;
  periodLabels: (period: number | string) => string;
  regularPeriods: number;
  maxPeriods: number;
}
