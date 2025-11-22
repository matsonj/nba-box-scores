#!/bin/bash

DATA_DIR="/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data"
SCHEDULE_DIR="$DATA_DIR/schedule"
COMPLETED_GAMES_FILE="$SCHEDULE_DIR/completed-games.json"

# Print first game for debugging
echo "First game data:"
jq '.[0]' "$SCHEDULE_DIR/completed-games.json"

# Create and populate the schedule table using DuckDB
echo "Creating and populating schedule table (appending new games without dropping existing ones)..."
duckdb "md:" -c "
USE nba_box_scores;

-- Ensure the schedule table exists but do NOT drop existing data
CREATE TABLE IF NOT EXISTS main.schedule (
  game_id TEXT PRIMARY KEY,
  game_date TIMESTAMP NOT NULL,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  home_team_abbreviation TEXT NOT NULL,
  away_team_abbreviation TEXT NOT NULL,
  home_team_score INTEGER NOT NULL,
  away_team_score INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upsert new games for the current season based on primary key (game_id)
INSERT OR REPLACE INTO main.schedule (
  game_id,
  game_date,
  home_team_id,
  away_team_id,
  home_team_abbreviation,
  away_team_abbreviation,
  home_team_score,
  away_team_score,
  status
)
SELECT
  gameId,
  gameDateTimeUTC,
  homeTeam.teamId,
  awayTeam.teamId,
  homeTeam.teamTricode,
  awayTeam.teamTricode,
  homeTeam.score,
  awayTeam.score,
  gameStatusText
FROM read_json('$SCHEDULE_DIR/completed-games.json')
WHERE gameId LIKE '002%' or gameId LIKE '004%' or gameId LIKE '005%';
"

echo "Schedule data loaded successfully!"
