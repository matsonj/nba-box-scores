// Generated by scripts/generate-schemas.ts
// Do not edit this file directly


export const box_scoresColumns = [
  "game_id",
  "team_id",
  "entity_id",
  "player_name",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fg_made",
  "fg_attempted",
  "fg3_made",
  "fg3_attempted",
  "ft_made",
  "ft_attempted",
  "plus_minus",
  "starter",
  "period"
] as const;
export type BoxScoresColumn = typeof box_scoresColumns[number];

export const scheduleColumns = [
  "game_id",
  "game_date",
  "home_team_id",
  "away_team_id",
  "home_team_abbreviation",
  "away_team_abbreviation",
  "home_team_score",
  "away_team_score",
  "status",
  "created_at"
] as const;
export type ScheduleColumn = typeof scheduleColumns[number];

export const team_statsColumns = [
  "game_id",
  "team_id",
  "period",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fg_made",
  "fg_attempted",
  "fg3_made",
  "fg3_attempted",
  "ft_made",
  "ft_attempted",
  "offensive_possessions",
  "defensive_possessions"
] as const;
export type TeamStatsColumn = typeof team_statsColumns[number];

export function generateSelectQuery(
  tableName: string,
  columns: readonly string[],
  whereClause?: string
): string {
  const columnsStr = columns.join(',\n        ');
  const baseQuery = `
      SELECT 
        ${columnsStr}
      FROM ${tableName}`;
  
  return whereClause ? `${baseQuery}\n      ${whereClause}` : baseQuery;
}