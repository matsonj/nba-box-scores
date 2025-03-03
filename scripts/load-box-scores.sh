#!/bin/bash

# Enable error handling
set -e

# First run the Python parser to create the local DuckDB database
echo "Processing box scores with Python parser..."
uv run python -m nba_box_scores.process_box_scores data/box_scores nba_stats.duckdb

# Log local DuckDB schema for comparison
echo "\nLocal DuckDB Schema:"
duckdb nba_stats.duckdb -c ".schema player_game_stats"

# Log sample data from local DuckDB
echo "\nSample data from local DuckDB:"
duckdb nba_stats.duckdb -c "SELECT * FROM player_game_stats LIMIT 1;"

# First load data into MotherDuck
PLAYER_SQL="
DROP TABLE IF EXISTS box_scores;

CREATE TABLE box_scores (
  game_id VARCHAR,
  team_id VARCHAR,
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
  plus_minus INTEGER,
  starter INTEGER
);"

# SQL for team stats
TEAM_SQL="
DROP TABLE IF EXISTS team_stats;

CREATE TABLE team_stats AS
WITH period_scores AS (
  SELECT
    game_id,
    team_id,
    period,
    '12:00' as minutes,
    SUM(points) as points,
    SUM(rebounds) as rebounds,
    SUM(assists) as assists,
    SUM(steals) as steals,
    SUM(blocks) as blocks,
    SUM(turnovers) as turnovers,
    SUM(fg_made) as fg_made,
    SUM(fg_attempted) as fg_attempted,
    SUM(fg3_made) as fg3_made,
    SUM(fg3_attempted) as fg3_attempted,
    SUM(ft_made) as ft_made,
    SUM(ft_attempted) as ft_attempted,
    null as offensive_possessions,
    null as defensive_possessions
  FROM box_scores
  WHERE period != 'FullGame'
  GROUP BY game_id, team_id, period
)
SELECT * FROM period_scores
UNION ALL
SELECT
  game_id,
  team_id,
  'FullGame' as period,
  null as minutes,
  SUM(points) as points,
  SUM(rebounds) as rebounds,
  SUM(assists) as assists,
  SUM(steals) as steals,
  SUM(blocks) as blocks,
  SUM(turnovers) as turnovers,
  SUM(fg_made) as fg_made,
  SUM(fg_attempted) as fg_attempted,
  SUM(fg3_made) as fg3_made,
  SUM(fg3_attempted) as fg3_attempted,
  SUM(ft_made) as ft_made,
  SUM(ft_attempted) as ft_attempted,
  null as offensive_possessions,
  null as defensive_possessions
FROM period_scores
WHERE period <> 'FullGame'
GROUP BY game_id, team_id;"

# # Print and execute table creation SQL
# echo "Executing table creation SQL:"
# echo "$TABLE_SQL"
# echo
# duckdb "md:" -c "$TABLE_SQL"

# # Print and execute data preprocessing SQL
# echo "Executing data preprocessing SQL:"
# echo "$PREP_SQL"
# echo
# duckdb "md:" -c "$PREP_SQL"

# Create schema and tables in MotherDuck
echo "Creating schema and tables in MotherDuck..."
# First create tables in MotherDuck
echo "Creating tables in MotherDuck..."
duckdb "md:" -c "USE nba_box_scores; $PLAYER_SQL"

# Then export the data from local DuckDB to a temporary CSV
echo "Exporting data from local DuckDB..."
duckdb nba_stats.duckdb -c "COPY player_game_stats TO 'temp_box_scores.csv' (HEADER, DELIMITER ',');"

# Finally, import the data into MotherDuck
echo "Importing data into MotherDuck..."
duckdb "md:" -c "USE nba_box_scores; COPY box_scores FROM 'temp_box_scores.csv' (HEADER, DELIMITER ',');"

# Log MotherDuck schema and sample data for comparison
echo "\nSample data from MotherDuck:"
duckdb "md:" -c "USE nba_box_scores; SELECT * FROM box_scores LIMIT 1;"

# Clean up temporary file
rm temp_box_scores.csv

# Create team stats in MotherDuck
echo "Creating team stats in MotherDuck..."
duckdb "md:" -c "USE nba_box_scores; $TEAM_SQL"

echo "Box scores loaded successfully!"
