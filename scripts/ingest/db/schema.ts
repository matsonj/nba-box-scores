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

export const SCHEMA_COMMENTS = `
COMMENT ON TABLE main.schedule IS 'Game schedule with one row per NBA game. Grain: game_id.';
COMMENT ON COLUMN main.schedule.game_id IS 'Unique NBA game identifier (e.g., 0022400061).';
COMMENT ON COLUMN main.schedule.game_status IS 'Game completion status (e.g., Final). Renamed from status to avoid ambiguity.';
COMMENT ON COLUMN main.schedule.home_team_abbreviation IS 'Three-letter team code (e.g., BOS). Joins to box_scores.team_abbreviation.';
COMMENT ON COLUMN main.schedule.away_team_abbreviation IS 'Three-letter team code (e.g., NYK). Joins to box_scores.team_abbreviation.';

COMMENT ON TABLE main.box_scores IS 'Per-player per-period box score stats. Grain: (game_id, entity_id, period).';
COMMENT ON COLUMN main.box_scores.game_id IS 'Foreign key to schedule.game_id.';
COMMENT ON COLUMN main.box_scores.entity_id IS 'Unique player identifier from NBA API.';
COMMENT ON COLUMN main.box_scores.team_abbreviation IS 'Three-letter team code. Joins to schedule.home_team_abbreviation or schedule.away_team_abbreviation.';
COMMENT ON COLUMN main.box_scores.period IS 'Game period: 1-4 for quarters, 5+ for OT, FullGame for aggregated totals.';
COMMENT ON COLUMN main.box_scores.minutes IS 'Playing time in MM:SS format.';
COMMENT ON COLUMN main.box_scores.starter IS 'Starter flag: 1=starter, 0=bench. Only set on FullGame rows; NULL for per-period rows.';

COMMENT ON TABLE main.ingestion_log IS 'Tracks which games have been ingested and their outcome. Grain: game_id.';
COMMENT ON COLUMN main.ingestion_log.ingestion_status IS 'Outcome of the ingestion attempt: success or error. Renamed from status to avoid ambiguity.';

COMMENT ON TABLE main.data_quality_quarantine IS 'Detected data anomalies pending review. Grain: (game_id, entity_id, detection_type).';
COMMENT ON COLUMN main.data_quality_quarantine.resolution_status IS 'Review status: pending, approved, or rejected. Renamed from status to avoid ambiguity.';

COMMENT ON VIEW main.team_stats IS 'Aggregated team stats per game per period. Derived from box_scores via SUM.';
COMMENT ON COLUMN main.team_stats.team_abbreviation IS 'Three-letter team code. Joins to schedule.home_team_abbreviation or schedule.away_team_abbreviation.';

COMMENT ON VIEW main.players IS 'Distinct player dimension derived from FullGame box_scores rows.';
`;

export const ALL_DDL = [
  CREATE_SCHEDULE,
  CREATE_BOX_SCORES,
  CREATE_INGESTION_LOG,
  CREATE_DATA_QUALITY_QUARANTINE,
  CREATE_TEAM_STATS_VIEW,
  CREATE_PLAYERS_VIEW,
  SCHEMA_COMMENTS,
] as const;
