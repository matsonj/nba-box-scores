// DDL constants for nhl_box_scores schema
// These are the source of truth for the NHL database schema.

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

export const CREATE_SKATER_STATS = `
CREATE TABLE IF NOT EXISTS main.skater_stats (
  game_id VARCHAR,
  team_abbreviation VARCHAR,
  entity_id VARCHAR,
  player_name VARCHAR,
  position VARCHAR,
  toi VARCHAR,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  pim INTEGER NOT NULL DEFAULT 0,
  shots INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  blocked_shots INTEGER NOT NULL DEFAULT 0,
  takeaways INTEGER NOT NULL DEFAULT 0,
  giveaways INTEGER NOT NULL DEFAULT 0,
  faceoff_wins INTEGER NOT NULL DEFAULT 0,
  faceoff_losses INTEGER NOT NULL DEFAULT 0,
  power_play_goals INTEGER NOT NULL DEFAULT 0,
  starter INTEGER,
  period VARCHAR NOT NULL DEFAULT 'FullGame',
  PRIMARY KEY (game_id, entity_id, period)
);`;

export const CREATE_GOALIE_STATS = `
CREATE TABLE IF NOT EXISTS main.goalie_stats (
  game_id VARCHAR,
  team_abbreviation VARCHAR,
  entity_id VARCHAR,
  player_name VARCHAR,
  toi VARCHAR,
  saves INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  save_pct DOUBLE NOT NULL DEFAULT 0,
  shots_against INTEGER NOT NULL DEFAULT 0,
  decision VARCHAR,
  starter INTEGER,
  period VARCHAR NOT NULL DEFAULT 'FullGame',
  PRIMARY KEY (game_id, entity_id, period)
);`;

export const CREATE_RAW_NHL_BOX_SCORES = `
CREATE TABLE IF NOT EXISTS main.raw_nhl_box_scores (
  game_id TEXT PRIMARY KEY,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL,
  game_json JSON NOT NULL,
  box_score_json JSON NOT NULL,
  source_version TEXT,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

export const CREATE_INGESTION_LOG = `
CREATE TABLE IF NOT EXISTS main.ingestion_log (
  game_id TEXT PRIMARY KEY,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ingestion_status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  audited_at TIMESTAMP
);`;

export const CREATE_TEAM_STATS_VIEW = `
CREATE OR REPLACE VIEW main.team_stats AS
WITH skater_totals AS (
  SELECT
    game_id,
    team_abbreviation,
    period,
    CAST(SUM(goals) AS INTEGER) AS points,
    CAST(SUM(shots) AS INTEGER) AS shots,
    CAST(SUM(hits) AS INTEGER) AS hits,
    CAST(SUM(blocked_shots) AS INTEGER) AS blocked_shots,
    CAST(SUM(pim) AS INTEGER) AS pim
  FROM nhl_box_scores.main.skater_stats
  WHERE period = 'FullGame'
  GROUP BY game_id, team_abbreviation, period
)
SELECT * FROM skater_totals;`;

export const ALL_DDL = [
  CREATE_SCHEDULE,
  CREATE_SKATER_STATS,
  CREATE_GOALIE_STATS,
  CREATE_RAW_NHL_BOX_SCORES,
  CREATE_INGESTION_LOG,
  CREATE_TEAM_STATS_VIEW,
] as const;
