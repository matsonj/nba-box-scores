export const TEMP_TABLES = {
  SCHEDULE: 'temp_schedule',
  BOX_SCORES: 'temp_box_scores',
  TEAM_STATS: 'temp_team_stats',
} as const;

export const SOURCE_TABLES = {
  SCHEDULE: 'nba_box_scores.main.schedule',
  BOX_SCORES: 'nba_box_scores.main.box_scores',
  TEAM_STATS: 'nba_box_scores.main.team_stats',
} as const;
