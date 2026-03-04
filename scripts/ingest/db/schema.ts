// DDL constants for nba_box_scores_v2 schema
// These are the source of truth for the v2 database schema.

export const CREATE_SCHEDULE = `
CREATE TABLE IF NOT EXISTS main.schedule (
  game_id TEXT PRIMARY KEY,
  game_date TIMESTAMP NOT NULL,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  home_team_abbreviation TEXT NOT NULL,
  away_team_abbreviation TEXT NOT NULL,
  home_team_score INTEGER NOT NULL,
  away_team_score INTEGER NOT NULL,
  game_status TEXT NOT NULL,
  season_year INTEGER,
  season_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

export const CREATE_BOX_SCORES = `
CREATE TABLE IF NOT EXISTS main.box_scores (
  game_id VARCHAR,
  team_abbreviation VARCHAR,
  entity_id VARCHAR,
  player_name VARCHAR,
  period VARCHAR NOT NULL DEFAULT 'FullGame',
  minutes VARCHAR,
  points INTEGER NOT NULL DEFAULT 0,
  rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fg_made INTEGER NOT NULL DEFAULT 0,
  fg_attempted INTEGER NOT NULL DEFAULT 0,
  fg3_made INTEGER NOT NULL DEFAULT 0,
  fg3_attempted INTEGER NOT NULL DEFAULT 0,
  ft_made INTEGER NOT NULL DEFAULT 0,
  ft_attempted INTEGER NOT NULL DEFAULT 0,
  starter INTEGER,
  PRIMARY KEY (game_id, entity_id, period)
);`;

export const CREATE_INGESTION_LOG = `
CREATE TABLE IF NOT EXISTS main.ingestion_log (
  game_id TEXT PRIMARY KEY,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ingestion_status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT
);`;

export const CREATE_DATA_QUALITY_QUARANTINE = `
CREATE TABLE IF NOT EXISTS main.data_quality_quarantine (
  game_id VARCHAR NOT NULL,
  entity_id VARCHAR NOT NULL,
  player_name VARCHAR NOT NULL,
  expected_team VARCHAR,
  actual_team VARCHAR NOT NULL,
  detection_type VARCHAR NOT NULL DEFAULT 'team_switch',
  resolution_status VARCHAR NOT NULL DEFAULT 'pending',
  details TEXT,
  github_issue_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR,
  PRIMARY KEY (game_id, entity_id, detection_type)
);`;

export const CREATE_TEAM_STATS_VIEW = `
CREATE OR REPLACE VIEW main.team_stats AS
WITH period_scores AS (
  SELECT
    game_id,
    team_abbreviation,
    period,
    '12:00' as minutes,
    CAST(SUM(points) AS INTEGER) as points,
    CAST(SUM(rebounds) AS INTEGER) as rebounds,
    CAST(SUM(assists) AS INTEGER) as assists,
    CAST(SUM(steals) AS INTEGER) as steals,
    CAST(SUM(blocks) AS INTEGER) as blocks,
    CAST(SUM(turnovers) AS INTEGER) as turnovers,
    CAST(SUM(fg_made) AS INTEGER) as fg_made,
    CAST(SUM(fg_attempted) AS INTEGER) as fg_attempted,
    CAST(SUM(fg3_made) AS INTEGER) as fg3_made,
    CAST(SUM(fg3_attempted) AS INTEGER) as fg3_attempted,
    CAST(SUM(ft_made) AS INTEGER) as ft_made,
    CAST(SUM(ft_attempted) AS INTEGER) as ft_attempted
  FROM nba_box_scores_v2.main.box_scores
  WHERE period != 'FullGame'
  GROUP BY game_id, team_abbreviation, period
)
SELECT * FROM period_scores
UNION ALL
SELECT
  game_id,
  team_abbreviation,
  'FullGame' as period,
  NULL as minutes,
  CAST(SUM(points) AS INTEGER) as points,
  CAST(SUM(rebounds) AS INTEGER) as rebounds,
  CAST(SUM(assists) AS INTEGER) as assists,
  CAST(SUM(steals) AS INTEGER) as steals,
  CAST(SUM(blocks) AS INTEGER) as blocks,
  CAST(SUM(turnovers) AS INTEGER) as turnovers,
  CAST(SUM(fg_made) AS INTEGER) as fg_made,
  CAST(SUM(fg_attempted) AS INTEGER) as fg_attempted,
  CAST(SUM(fg3_made) AS INTEGER) as fg3_made,
  CAST(SUM(fg3_attempted) AS INTEGER) as fg3_attempted,
  CAST(SUM(ft_made) AS INTEGER) as ft_made,
  CAST(SUM(ft_attempted) AS INTEGER) as ft_attempted
FROM period_scores
WHERE period <> 'FullGame'
GROUP BY game_id, team_abbreviation;`;

export const CREATE_PLAYERS_VIEW = `
CREATE OR REPLACE VIEW main.players AS
SELECT DISTINCT entity_id, player_name
FROM nba_box_scores_v2.main.box_scores
WHERE period = 'FullGame';`;

// Schema comments are now generated dynamically by metadata-generator
// after ingest. See scripts/ingest/db/metadata.ts and `npm run metadata:refresh`.

export const ALL_DDL = [
  CREATE_SCHEDULE,
  CREATE_BOX_SCORES,
  CREATE_INGESTION_LOG,
  CREATE_DATA_QUALITY_QUARANTINE,
  CREATE_TEAM_STATS_VIEW,
  CREATE_PLAYERS_VIEW,
] as const;
