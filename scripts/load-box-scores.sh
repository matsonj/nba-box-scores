#!/bin/bash

# First run the Python parser to create the local DuckDB database
echo "Processing box scores with Python parser..."
uv run python -m nba_box_scores.process_box_scores data/box_scores nba_stats.duckdb

# First load data into MotherDuck
PLAYER_SQL="
DROP TABLE IF EXISTS box_scores;

CREATE TABLE box_scores (
  game_id VARCHAR,
  team_id VARCHAR,
  entity_id VARCHAR,
  player_name VARCHAR,
  period VARCHAR,
  minutes VARCHAR,
  points INTEGER,
  rebounds INTEGER,
  assists INTEGER,
  steals INTEGER,
  blocks INTEGER,
  turnovers INTEGER,
  fg_made INTEGER,
  fg_attempted INTEGER,
  fg3_made INTEGER,
  fg3_attempted INTEGER,
  ft_made INTEGER,
  ft_attempted INTEGER,
  plus_minus INTEGER,
  starter INTEGER
);"

# SQL for team stats
TEAM_SQL="
DROP TABLE IF EXISTS team_stats;

CREATE TABLE team_stats AS
SELECT
  game_id,
  team_id,
  period,
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
FROM box_scores
WHERE period <> 'FullGame' and entity_id != '0'
GROUP BY game_id, team_id, period;"

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

# Clean up temporary file
rm temp_box_scores.csv

# Create team stats in MotherDuck
echo "Creating team stats in MotherDuck..."
duckdb "md:" -c "USE nba_box_scores; $TEAM_SQL"

echo "Box scores loaded successfully!"
