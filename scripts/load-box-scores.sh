#!/bin/bash

DATA_DIR="/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data"
BOX_SCORES_DIR="$DATA_DIR/box_scores"

# SQL for table creation
TABLE_SQL="
USE nba_box_scores;

DROP TABLE IF EXISTS box_scores;
DROP TABLE IF EXISTS team_stats;

CREATE TABLE box_scores (
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

CREATE TABLE team_stats (
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

# Data Preprocessing
PREP_SQL="
USE nba_box_scores;

-- load data
create or replace table bs_json as
FROM read_json_auto('$BOX_SCORES_DIR/*.json',union_by_name=true);

-- interim tables
create or replace table bs_home_1 as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"1\") as box_score_detail from bs_json;

create or replace table bs_home_2 as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"2\") as box_score_detail from bs_json;

create or replace table bs_home_3 as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"3\") as box_score_detail from bs_json;

create or replace table bs_home_4 as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"4\") as box_score_detail from bs_json;

create or replace table bs_home_5 as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.\"5\") as box_score_detail from bs_json;

create or replace table bs_away_1 as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"1\") as box_score_detail from bs_json;

create or replace table bs_away_2 as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"2\") as box_score_detail from bs_json;

create or replace table bs_away_3 as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"3\") as box_score_detail from bs_json;

create or replace table bs_away_4 as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"4\") as box_score_detail from bs_json;

create or replace table bs_away_5 as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.\"5\") as box_score_detail from bs_json;

create or replace table bs_home_fullgame as 
select game.gameId, game.homeTeam.teamId, unnest(boxScore.stats.home.FullGame) as box_score_detail from bs_json;

create or replace table bs_away_fullgame as 
select game.gameId, game.awayTeam.teamId, unnest(boxScore.stats.away.FullGame) as box_score_detail from bs_json;

-- final table
create or replace table bs_detail as 
select gameId,teamId,1 as period, unnest(box_score_detail) from bs_home_1
union all by name
select gameId,teamId,2 as period, unnest(box_score_detail) from bs_home_2
union all by name
select gameId,teamId,3 as period, unnest(box_score_detail) from bs_home_3
union all by name
select gameId,teamId,4 as period, unnest(box_score_detail) from bs_home_4
union all by name
select gameId,teamId,5 as period, unnest(box_score_detail) from bs_home_5
union all by name
select gameId,teamId,1 as period, unnest(box_score_detail) from bs_away_1
union all by name
select gameId,teamId,2 as period, unnest(box_score_detail) from bs_away_2
union all by name
select gameId,teamId,3 as period, unnest(box_score_detail) from bs_away_3
union all by name
select gameId,teamId,4 as period, unnest(box_score_detail) from bs_away_4 
union all by name
select gameId,teamId,5 as period, unnest(box_score_detail) from bs_away_5
union all by name
select gameId,teamId,'FullGame' as period, unnest(box_score_detail) from bs_home_fullgame
union all by name
select gameId,teamId,'FullGame' as period, unnest(box_score_detail) from bs_away_fullgame;
"

# SQL for player box scores
PLAYER_SQL="
USE nba_box_scores;

INSERT INTO main.box_scores
SELECT
  gameid as game_id,
  teamid as team_id,
  EntityId as entity_id,
  Name as player_name,
  COALESCE(Minutes, '0:00') as minutes,
  CAST(COALESCE(Points, '0') AS INTEGER) as points,
  CAST(COALESCE(OffRebounds, '0') AS INTEGER) + CAST(COALESCE(DefRebounds, '0') AS INTEGER) as rebounds,
  CAST(COALESCE(Assists, '0') AS INTEGER) as assists,
  CAST(COALESCE(Steals, '0') AS INTEGER) as steals,
  CAST(COALESCE(Blocks, '0') AS INTEGER) as blocks,
  CAST(COALESCE(Turnovers, '0') AS INTEGER) as turnovers,
  CAST(COALESCE(FG2M, '0') AS INTEGER) + CAST(COALESCE(FG3M, '0') AS INTEGER) as fg_made,
  CAST(COALESCE(FG2A, '0') AS INTEGER) + CAST(COALESCE(FG3A, '0') AS INTEGER) as fg_attempted,
  CAST(COALESCE(FG3M, '0') AS INTEGER) as fg3_made,
  CAST(COALESCE(FG3A, '0') AS INTEGER) as fg3_attempted,
  CAST(COALESCE(FtPoints, '0') AS INTEGER) as ft_made,
  CAST(COALESCE(FTA, '0') AS INTEGER) as ft_attempted,
  null as plus_minus,
  null as starter,
  period
FROM bs_detail
WHERE EntityId != '0';"

# SQL for team stats
TEAM_SQL="
USE nba_box_scores;

INSERT INTO main.team_stats
SELECT
  gameId as game_id,
  teamId as team_id,
  period,
  null as minutes,
  SUM(CAST(COALESCE(team_stats.Points, '0') AS INTEGER)) as points,
  SUM(CAST(COALESCE(team_stats.DefRebounds, '0') AS INTEGER) + CAST(COALESCE(team_stats.OffRebounds, '0') AS INTEGER)) as rebounds,
  SUM(CAST(COALESCE(team_stats.Assists, '0') AS INTEGER)) as assists,
  SUM(CAST(COALESCE(team_stats.Steals, '0') AS INTEGER)) as steals,
  SUM(CAST(COALESCE(team_stats.Blocks, '0') AS INTEGER)) as blocks,
  SUM(CAST(COALESCE(team_stats.Turnovers, '0') AS INTEGER)) as turnovers,
  SUM(CAST(COALESCE(team_stats.FG2M, '0') AS INTEGER) + CAST(COALESCE(team_stats.FG3M, '0') AS INTEGER)) as fg_made,
  SUM(CAST(COALESCE(team_stats.FG2A, '0') AS INTEGER) + CAST(COALESCE(team_stats.FG3A, '0') AS INTEGER)) as fg_attempted,
  SUM(CAST(COALESCE(team_stats.FG3M, '0') AS INTEGER)) as fg3_made,
  SUM(CAST(COALESCE(team_stats.FG3A, '0') AS INTEGER)) as fg3_attempted,
  SUM(CAST(COALESCE(team_stats.FtPoints, '0') AS INTEGER)) as ft_made,
  SUM(CAST(COALESCE(team_stats.FTA, '0') AS INTEGER)) as ft_attempted,
  null as offensive_possessions,
  null as defensive_possessions
FROM bs_detail as team_stats
GROUP BY gameId, teamId, period;"

# Print and execute table creation SQL
echo "Executing table creation SQL:"
echo "$TABLE_SQL"
echo
duckdb "md:" -c "$TABLE_SQL"

Print and execute data preprocessing SQL
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

echo "Box scores loaded successfully!"
