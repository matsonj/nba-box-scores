// TypeScript interfaces for the pre-2000 legacy backfill pipeline.
//
// Unlike the live pipeline, this is a one-time STATIC IMPORT from a public Kaggle
// dataset (eoinamoore "Historical NBA Data and Player Box Scores", with Wyatt
// Walsh's "basketball" SQLite as a fallback). DuckDB reads the file directly via
// ATTACH (sqlite) / read_csv / read_parquet — there is no live HTTP client.

/** How the on-disk Kaggle source is read by DuckDB. */
export type LegacySourceFormat = 'sqlite' | 'csv' | 'parquet';

/** Output of buildLegacyConfig — drives a single import run. */
export interface LegacyConfig {
  /** Path to the Kaggle file: a .sqlite/.db file, a .csv file, or a .parquet file. */
  source: string;
  sourceFormat: LegacySourceFormat;
  /** Inclusive season-year range to import (season start year, e.g. 1968 = 1968-69). */
  fromYear: number;
  toYear: number;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
  motherDuckToken: string;
  database: string;
}

// ── Era cutoffs (by season start year) ────────────────────────────────────────
// The season in which the league began recording each stat. Before the cutoff the
// stat is either imputed (steals/blocks/turnovers) or structurally zero (3-pointers).

/** Steals & blocks became official in 1973-74. */
export const STEALS_BLOCKS_CUTOFF = 1973;
/** Player turnovers became official in 1977-78. */
export const TURNOVERS_CUTOFF = 1977;
/** The 3-point line was introduced in 1979-80 — before this, fg3 is a true 0. */
export const THREE_POINT_CUTOFF = 1979;

// ── Normalized rows returned by source-reader ─────────────────────────────────
// source-reader does the dataset-specific column aliasing in SQL and returns these
// canonical shapes, so the parser/imputer stay dataset-agnostic. Numeric stat
// fields are `number | null` because a given era/source may not carry them.

/** One row per game from the dataset's games table. */
export interface NormalizedGameRow {
  source_game_id: string;
  game_date: string;
  season_year: number;
  season_type: string;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number;
  away_score: number;
}

/** One row per player per game from the dataset's player box score table. */
export interface NormalizedPlayerRow {
  source_game_id: string;
  game_date: string;
  season_year: number;
  person_id: string | null;
  player_name: string;
  team: string;
  is_home: boolean | null;
  is_starter: boolean | null;
  minutes: number | null; // decimal minutes from source
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fg_made: number | null;
  fg_attempted: number | null;
  fg3_made: number | null;
  fg3_attempted: number | null;
  ft_made: number | null;
  ft_attempted: number | null;
  fouls: number | null;
  height: number | null; // inches; from Players.csv, COALESCEd to a default in SQL
  age: number | null; // years at game time; COALESCEd to a default in SQL
  pos_guard: number | null; // 0/1 position flags from Players.csv
  pos_forward: number | null;
  pos_center: number | null;
}

/**
 * Per-(player, season) aggregate over the recorded era, used to train the
 * imputation models. All counting stats are season totals; rates are derived
 * by the imputer.
 */
export interface PlayerSeasonAgg {
  person_id: string;
  season_year: number;
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_attempted: number;
  ft_attempted: number;
  fouls: number;
  height: number; // representative inches for the player-season (COALESCEd, never null)
  age: number; // representative age in years for the player-season
  pos_guard: number; // 0/1 position flags
  pos_forward: number;
  pos_center: number;
}
