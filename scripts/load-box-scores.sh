#!/bin/bash

DATA_DIR="/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data"
BOX_SCORES_DIR="$DATA_DIR/box_scores"

# SQL for table creation - only execute if tables don't exist
TABLE_SQL="
USE nba_box_scores;

CREATE TABLE IF NOT EXISTS box_scores (
  game_id VARCHAR,
  team_id VARCHAR,
  entity_id VARCHAR,
  player_name VARCHAR,
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
  starter INTEGER,
  period VARCHAR
);

CREATE TABLE IF NOT EXISTS team_stats (
  game_id VARCHAR,
  team_id VARCHAR,
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
  offensive_possessions INTEGER,
  defensive_possessions INTEGER
);"

# Data Preprocessing - Only load new games
PREP_SQL="
USE nba_box_scores;

-- Create a temporary table of existing game IDs from box_scores
CREATE OR REPLACE TABLE existing_game_ids AS
SELECT DISTINCT game_id FROM box_scores;

-- Log existing game IDs count
SELECT COUNT(*) AS existing_games_count FROM existing_game_ids;

-- Create a temporary table of available JSON files
CREATE OR REPLACE TABLE available_json_files AS
SELECT 
  REGEXP_EXTRACT(file, '([0-9]+)\.json$', 1) AS game_id, 
  file AS filename 
FROM glob('$BOX_SCORES_DIR/*.json');

-- Log available JSON files for debugging
SELECT COUNT(*) AS total_available_files FROM available_json_files;

-- Identify new game IDs to be loaded
CREATE OR REPLACE TABLE new_game_ids AS
SELECT a.game_id, a.filename
FROM available_json_files a
LEFT JOIN existing_game_ids e ON a.game_id = e.game_id
WHERE e.game_id IS NULL OR e.game_id = '';

-- Log new games to be loaded for debugging
SELECT COUNT(*) AS new_games_count FROM new_game_ids;

-- Check if we have new games to process
SELECT 
  (SELECT COUNT(*) FROM new_game_ids) AS new_games_count,
  CASE WHEN (SELECT COUNT(*) FROM new_game_ids) = 0 
       THEN 'No new games to load, skipping processing'
       ELSE 'Processing new games' END AS status;

-- Only load data for new games if there are any
CREATE OR REPLACE TABLE bs_json AS
SELECT * FROM read_json_auto(
  (SELECT filename FROM new_game_ids),
  union_by_name=true
)
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

-- Only continue with the rest of the processing if we have new games
-- interim tables for regular periods
CREATE OR REPLACE TABLE bs_home_1 AS 
SELECT game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"1\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_home_2 AS 
SELECT game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"2\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_home_3 AS 
SELECT game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"3\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_home_4 AS 
SELECT game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"4\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_away_1 AS 
SELECT game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"1\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_away_2 AS 
SELECT game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"2\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_away_3 AS 
SELECT game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"3\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_away_4 AS 
SELECT game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"4\") AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

-- Create a list of all games with overtime periods
CREATE OR REPLACE TABLE games_with_ot AS
SELECT 
  DISTINCT game.gameId, 
  game.homeTeam.teamId AS home_team_id,
  game.awayTeam.teamId AS away_team_id,
  CASE WHEN json_extract_path(boxScore.stats.home, ['5']) IS NOT NULL THEN 1 ELSE 0 END AS has_period_5,
  CASE WHEN json_extract_path(boxScore.stats.home, ['6']) IS NOT NULL THEN 1 ELSE 0 END AS has_period_6,
  CASE WHEN json_extract_path(boxScore.stats.home, ['7']) IS NOT NULL THEN 1 ELSE 0 END AS has_period_7,
  CASE WHEN json_extract_path(boxScore.stats.home, ['8']) IS NOT NULL THEN 1 ELSE 0 END AS has_period_8
FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

-- Create tables only for games with overtime periods
CREATE OR REPLACE TABLE bs_home_5 AS
SELECT g.gameId, g.home_team_id AS teamId, unnest(j.boxScore.stats.home.\"5\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_5 = 1;

CREATE OR REPLACE TABLE bs_home_6 AS
SELECT g.gameId, g.home_team_id AS teamId, unnest(j.boxScore.stats.home.\"6\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_6 = 1;

CREATE OR REPLACE TABLE bs_home_7 AS
SELECT g.gameId, g.home_team_id AS teamId, unnest(j.boxScore.stats.home.\"7\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_7 = 1;

CREATE OR REPLACE TABLE bs_home_8 AS
SELECT g.gameId, g.home_team_id AS teamId, unnest(j.boxScore.stats.home.\"8\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_8 = 1;

CREATE OR REPLACE TABLE bs_away_5 AS
SELECT g.gameId, g.away_team_id AS teamId, unnest(j.boxScore.stats.away.\"5\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_5 = 1;

CREATE OR REPLACE TABLE bs_away_6 AS
SELECT g.gameId, g.away_team_id AS teamId, unnest(j.boxScore.stats.away.\"6\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_6 = 1;

CREATE OR REPLACE TABLE bs_away_7 AS
SELECT g.gameId, g.away_team_id AS teamId, unnest(j.boxScore.stats.away.\"7\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_7 = 1;

CREATE OR REPLACE TABLE bs_away_8 AS
SELECT g.gameId, g.away_team_id AS teamId, unnest(j.boxScore.stats.away.\"8\") AS box_score_detail
FROM games_with_ot g
JOIN bs_json j ON g.gameId = j.game.gameId
WHERE g.has_period_8 = 1;

CREATE OR REPLACE TABLE bs_home_fullgame AS 
SELECT game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.FullGame) AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

CREATE OR REPLACE TABLE bs_away_fullgame AS 
SELECT game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.FullGame) AS box_score_detail FROM bs_json
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0;

-- final table with all periods
CREATE OR REPLACE TABLE bs_detail AS 
SELECT gameId, teamId, 1 AS period, unnest(box_score_detail) FROM bs_home_1
UNION ALL BY NAME
SELECT gameId, teamId, 2 AS period, unnest(box_score_detail) FROM bs_home_2
UNION ALL BY NAME
SELECT gameId, teamId, 3 AS period, unnest(box_score_detail) FROM bs_home_3
UNION ALL BY NAME
SELECT gameId, teamId, 4 AS period, unnest(box_score_detail) FROM bs_home_4
UNION ALL BY NAME
SELECT gameId, teamId, 5 AS period, unnest(box_score_detail) FROM bs_home_5
UNION ALL BY NAME
SELECT gameId, teamId, 6 AS period, unnest(box_score_detail) FROM bs_home_6
UNION ALL BY NAME
SELECT gameId, teamId, 7 AS period, unnest(box_score_detail) FROM bs_home_7
UNION ALL BY NAME
SELECT gameId, teamId, 8 AS period, unnest(box_score_detail) FROM bs_home_8
UNION ALL BY NAME
SELECT gameId, teamId, 1 AS period, unnest(box_score_detail) FROM bs_away_1
UNION ALL BY NAME
SELECT gameId, teamId, 2 AS period, unnest(box_score_detail) FROM bs_away_2
UNION ALL BY NAME
SELECT gameId, teamId, 3 AS period, unnest(box_score_detail) FROM bs_away_3
UNION ALL BY NAME
SELECT gameId, teamId, 4 AS period, unnest(box_score_detail) FROM bs_away_4
UNION ALL BY NAME
SELECT gameId, teamId, 5 AS period, unnest(box_score_detail) FROM bs_away_5
UNION ALL BY NAME
SELECT gameId, teamId, 6 AS period, unnest(box_score_detail) FROM bs_away_6
UNION ALL BY NAME
SELECT gameId, teamId, 7 AS period, unnest(box_score_detail) FROM bs_away_7
UNION ALL BY NAME
SELECT gameId, teamId, 8 AS period, unnest(box_score_detail) FROM bs_away_8
UNION ALL BY NAME
SELECT gameId, teamId, 'FullGame' AS period, unnest(box_score_detail) FROM bs_home_fullgame
UNION ALL BY NAME
SELECT gameId, teamId, 'FullGame' AS period, unnest(box_score_detail) FROM bs_away_fullgame;"

# SQL for player box scores
PLAYER_SQL="
USE nba_box_scores;

-- Check status of new games
SELECT 
  (SELECT COUNT(*) FROM new_game_ids) AS new_games_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM new_game_ids) = 0 
    THEN 'No new games to insert into box_scores'
    ELSE 'Inserting new games into box_scores' 
  END AS status;

-- Only insert if we have new games
INSERT INTO box_scores
SELECT
  gameid AS game_id,
  teamid AS team_id,
  EntityId AS entity_id,
  Name AS player_name,
  COALESCE(Minutes, '0:00') AS minutes,
  CAST(COALESCE(Points, '0') AS INTEGER) AS points,
  CAST(COALESCE(OffRebounds, '0') AS INTEGER) + CAST(COALESCE(DefRebounds, '0') AS INTEGER) AS rebounds,
  CAST(COALESCE(Assists, '0') AS INTEGER) AS assists,
  CAST(COALESCE(Steals, '0') AS INTEGER) AS steals,
  CAST(COALESCE(Blocks, '0') AS INTEGER) AS blocks,
  CAST(COALESCE(Turnovers, '0') AS INTEGER) AS turnovers,
  CAST(COALESCE(FG2M, '0') AS INTEGER) + CAST(COALESCE(FG3M, '0') AS INTEGER) AS fg_made,
  CAST(COALESCE(FG2A, '0') AS INTEGER) + CAST(COALESCE(FG3A, '0') AS INTEGER) AS fg_attempted,
  CAST(COALESCE(FG3M, '0') AS INTEGER) AS fg3_made,
  CAST(COALESCE(FG3A, '0') AS INTEGER) AS fg3_attempted,
  CAST(COALESCE(FtPoints, '0') AS INTEGER) AS ft_made,
  CAST(COALESCE(FTA, '0') AS INTEGER) AS ft_attempted,
  null AS plus_minus,
  null AS starter,
  period
FROM bs_detail
WHERE EntityId != '0'
AND (SELECT COUNT(*) FROM new_game_ids) > 0;"

# SQL for team stats
TEAM_SQL="
USE nba_box_scores;

-- Check status of new games
SELECT 
  (SELECT COUNT(*) FROM new_game_ids) AS new_games_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM new_game_ids) = 0 
    THEN 'No new games to insert into team_stats'
    ELSE 'Inserting new games into team_stats' 
  END AS status;

-- Only insert if we have new games
INSERT INTO team_stats
SELECT
  gameId AS game_id,
  teamId AS team_id,
  period,
  null AS minutes,
  SUM(CAST(COALESCE(team_stats.Points, '0') AS INTEGER)) AS points,
  SUM(CAST(COALESCE(team_stats.DefRebounds, '0') AS INTEGER) + CAST(COALESCE(team_stats.OffRebounds, '0') AS INTEGER)) AS rebounds,
  SUM(CAST(COALESCE(team_stats.Assists, '0') AS INTEGER)) AS assists,
  SUM(CAST(COALESCE(team_stats.Steals, '0') AS INTEGER)) AS steals,
  SUM(CAST(COALESCE(team_stats.Blocks, '0') AS INTEGER)) AS blocks,
  SUM(CAST(COALESCE(team_stats.Turnovers, '0') AS INTEGER)) AS turnovers,
  SUM(CAST(COALESCE(team_stats.FG2M, '0') AS INTEGER) + CAST(COALESCE(team_stats.FG3M, '0') AS INTEGER)) AS fg_made,
  SUM(CAST(COALESCE(team_stats.FG2A, '0') AS INTEGER) + CAST(COALESCE(team_stats.FG3A, '0') AS INTEGER)) AS fg_attempted,
  SUM(CAST(COALESCE(team_stats.FG3M, '0') AS INTEGER)) AS fg3_made,
  SUM(CAST(COALESCE(team_stats.FG3A, '0') AS INTEGER)) AS fg3_attempted,
  SUM(CAST(COALESCE(team_stats.FtPoints, '0') AS INTEGER)) AS ft_made,
  SUM(CAST(COALESCE(team_stats.FTA, '0') AS INTEGER)) AS ft_attempted,
  null AS offensive_possessions,
  null AS defensive_possessions
FROM bs_detail AS team_stats
WHERE (SELECT COUNT(*) FROM new_game_ids) > 0
GROUP BY gameId, teamId, period;"

# Print and execute table creation SQL
echo "Executing table creation SQL:"
echo "$TABLE_SQL"
echo
duckdb "md:" -c "$TABLE_SQL"

# Print and execute data preprocessing SQL
echo "Executing data preprocessing SQL:"
echo "$PREP_SQL"
echo
duckdb "md:" -c "$PREP_SQL"

# Print and execute player box scores SQL
echo "Executing player box scores SQL:"
echo "$PLAYER_SQL"
echo
duckdb "md:" -c "$PLAYER_SQL"

# Print and execute team stats SQL
echo "Executing team stats SQL:"
echo "$TEAM_SQL"
echo
duckdb "md:" -c "$TEAM_SQL"

echo "Box scores processing complete!"
