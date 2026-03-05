// SQL-based hydration: derives box_scores rows from raw_game_data_pbpstats JSON
// using DuckDB's JSON_EXTRACT, UNNEST, and aggregate functions.
//
// This replaces the TypeScript parse loop (box-score-parser.ts) with a single
// INSERT ... SELECT that runs entirely server-side in MotherDuck.

/**
 * Build the SQL to hydrate box_scores from raw JSON.
 *
 * @param gameFilter - A SQL WHERE clause fragment to scope which games to
 *   hydrate, e.g. `r.game_id = '0022400001'` or `r.season_year = 2024`
 *   or `TRUE` for all games.
 */
export function buildHydrationSQL(gameFilter: string): string {
  return `
-- ── Per-period rows (quarters + OT) ─────────────────────────────
WITH sides AS (
  SELECT
    r.game_id,
    json_extract_string(r.game_json, '$.homeTeam.teamTricode') AS home_abbr,
    json_extract_string(r.game_json, '$.awayTeam.teamTricode') AS away_abbr,
    unnest(['Away', 'Home']) AS side,
    r.box_score_json
  FROM main.raw_game_data_pbpstats r
  WHERE ${gameFilter}
),
with_team AS (
  SELECT
    s.game_id,
    s.side,
    CASE WHEN s.side = 'Home' THEN s.home_abbr ELSE s.away_abbr END AS team_abbreviation,
    s.box_score_json
  FROM sides s
),
with_periods AS (
  SELECT
    wt.game_id,
    wt.team_abbreviation,
    unnest(json_keys(json_extract(wt.box_score_json, '$.' || wt.side))) AS period_key,
    wt.side,
    wt.box_score_json
  FROM with_team wt
),
period_players AS (
  SELECT
    wp.game_id,
    wp.team_abbreviation,
    wp.period_key AS period,
    unnest(
      from_json(
        json_extract(wp.box_score_json, '$.' || wp.side || '."' || wp.period_key || '"'),
        '["json"]'
      )
    ) AS player_json
  FROM with_periods wp
  WHERE wp.period_key != 'FullGame'
),
-- Extract per-period stats from JSON (skip entity_id = '0' team aggregates)
per_period AS (
  SELECT
    game_id,
    team_abbreviation,
    json_extract_string(player_json, '$.EntityId') AS entity_id,
    json_extract_string(player_json, '$.Name') AS player_name,
    period,
    json_extract_string(player_json, '$.Minutes') AS minutes,
    COALESCE(CAST(json_extract(player_json, '$.Points') AS INTEGER), 0) AS points,
    CASE
      WHEN json_extract(player_json, '$.Rebounds') IS NOT NULL
        THEN COALESCE(CAST(json_extract(player_json, '$.Rebounds') AS INTEGER), 0)
      ELSE COALESCE(CAST(json_extract(player_json, '$.OffRebounds') AS INTEGER), 0)
           + COALESCE(CAST(json_extract(player_json, '$.DefRebounds') AS INTEGER), 0)
    END AS rebounds,
    COALESCE(CAST(json_extract(player_json, '$.Assists') AS INTEGER), 0) AS assists,
    COALESCE(CAST(json_extract(player_json, '$.Steals') AS INTEGER), 0) AS steals,
    COALESCE(CAST(json_extract(player_json, '$.Blocks') AS INTEGER), 0) AS blocks,
    COALESCE(CAST(json_extract(player_json, '$.Turnovers') AS INTEGER), 0) AS turnovers,
    COALESCE(CAST(json_extract(player_json, '$.FG2M') AS INTEGER), 0)
      + COALESCE(CAST(json_extract(player_json, '$.FG3M') AS INTEGER), 0) AS fg_made,
    COALESCE(CAST(json_extract(player_json, '$.FG2A') AS INTEGER), 0)
      + COALESCE(CAST(json_extract(player_json, '$.FG3A') AS INTEGER), 0) AS fg_attempted,
    COALESCE(CAST(json_extract(player_json, '$.FG3M') AS INTEGER), 0) AS fg3_made,
    COALESCE(CAST(json_extract(player_json, '$.FG3A') AS INTEGER), 0) AS fg3_attempted,
    COALESCE(CAST(json_extract(player_json, '$.FtPoints') AS INTEGER), 0) AS ft_made,
    COALESCE(CAST(json_extract(player_json, '$.FTA') AS INTEGER), 0) AS ft_attempted,
    NULL::INTEGER AS starter
  FROM period_players
  WHERE json_extract_string(player_json, '$.EntityId') != '0'
),

-- ── FullGame rows: aggregate per-period data per player ──────────
full_game_base AS (
  SELECT
    game_id,
    team_abbreviation,
    entity_id,
    FIRST(player_name) AS player_name,
    'FullGame' AS period,
    -- Sum MM:SS minutes using integer division (//) to avoid rounding
    CAST(SUM(
      CAST(split_part(minutes, ':', 1) AS INTEGER) * 60
      + CAST(split_part(minutes, ':', 2) AS INTEGER)
    ) // 60 AS VARCHAR)
    || ':'
    || LPAD(CAST(SUM(
      CAST(split_part(minutes, ':', 1) AS INTEGER) * 60
      + CAST(split_part(minutes, ':', 2) AS INTEGER)
    ) % 60 AS VARCHAR), 2, '0') AS minutes,
    CAST(SUM(points) AS INTEGER) AS points,
    CAST(SUM(rebounds) AS INTEGER) AS rebounds,
    CAST(SUM(assists) AS INTEGER) AS assists,
    CAST(SUM(steals) AS INTEGER) AS steals,
    CAST(SUM(blocks) AS INTEGER) AS blocks,
    CAST(SUM(turnovers) AS INTEGER) AS turnovers,
    CAST(SUM(fg_made) AS INTEGER) AS fg_made,
    CAST(SUM(fg_attempted) AS INTEGER) AS fg_attempted,
    CAST(SUM(fg3_made) AS INTEGER) AS fg3_made,
    CAST(SUM(fg3_attempted) AS INTEGER) AS fg3_attempted,
    CAST(SUM(ft_made) AS INTEGER) AS ft_made,
    CAST(SUM(ft_attempted) AS INTEGER) AS ft_attempted
  FROM per_period
  GROUP BY game_id, team_abbreviation, entity_id
),

-- ── Starter assignment: top 5 scorers per team per game ──────────
full_game AS (
  SELECT
    game_id, team_abbreviation, entity_id, player_name, period, minutes,
    points, rebounds, assists, steals, blocks, turnovers,
    fg_made, fg_attempted, fg3_made, fg3_attempted, ft_made, ft_attempted,
    CASE WHEN ROW_NUMBER() OVER (
      PARTITION BY game_id, team_abbreviation
      ORDER BY points DESC
    ) <= 5 THEN 1 ELSE 0 END AS starter
  FROM full_game_base
)

-- ── Combine per-period + FullGame rows ───────────────────────────
SELECT * FROM per_period
UNION ALL
SELECT * FROM full_game`;
}

/**
 * Build the DELETE statement for games about to be re-hydrated.
 */
export function buildDeleteSQL(gameFilter: string): string {
  return `DELETE FROM main.box_scores WHERE game_id IN (
    SELECT game_id FROM main.raw_game_data_pbpstats r WHERE ${gameFilter}
  )`;
}

/**
 * Build the INSERT ... SELECT statement that hydrates box_scores in one shot.
 */
export function buildInsertSQL(gameFilter: string): string {
  return `INSERT INTO main.box_scores (
  game_id, team_abbreviation, entity_id, player_name, period, minutes,
  points, rebounds, assists, steals, blocks, turnovers,
  fg_made, fg_attempted, fg3_made, fg3_attempted,
  ft_made, ft_attempted, starter
)
${buildHydrationSQL(gameFilter)}`;
}

/**
 * Build the UPDATE to reset audited_at for re-hydrated games.
 */
export function buildResetAuditSQL(gameFilter: string): string {
  return `UPDATE main.ingestion_log SET audited_at = NULL
    WHERE game_id IN (
      SELECT game_id FROM main.raw_game_data_pbpstats r WHERE ${gameFilter}
    )`;
}
