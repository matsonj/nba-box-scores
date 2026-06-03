/**
 * Reads the static Kaggle dataset through DuckDB and returns normalized rows.
 * This is the static-import equivalent of the live pipeline's HTTP client +
 * game-finder + box-score-fetcher.
 *
 * Supported sources (--source):
 *  - a .sqlite/.db file  → ATTACH … (TYPE sqlite), tables PlayerStatistics & Games
 *  - a directory          → read_csv / read_parquet of PlayerStatistics.* & Games.*
 *
 * The column/table names below follow the eoinamoore "Historical NBA Data and
 * Player Box Scores" dataset. They are PROVISIONAL — Kaggle datasets evolve, so
 * introspectSchema() logs the real columns every run; confirm the mapping before
 * a production import and adjust the constants here if needed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MotherDuckConnection } from '../db/connection';
import { logger } from '../util/logger';
import type {
  LegacyConfig,
  NormalizedGameRow,
  NormalizedPlayerRow,
  PlayerSeasonAgg,
} from './types';

// ── Source schema ─────────────────────────────────────────────────────────────
// Verified against the eoinamoore dataset (June 2026): every column below exists.
// Notes confirmed by inspection:
//  - numMinutes is DECIMAL stored as text (e.g. '36.2166') — TRY_CAST AS DOUBLE.
//  - Untracked-era steals/blocks/turnovers are stored as 0, NOT blank; the parser
//    ignores them and imputes by season-year cutoff, so the 0s are harmless.
//  - startingPosition is set for starters, empty for bench.
// introspectSchema() still logs the live columns + warns on drift each run.

const PLAYER_TABLE = 'PlayerStatistics';
const GAMES_TABLE = 'Games';
const PLAYERS_TABLE = 'Players'; // bio table: height + birthDate, joined for imputation features

/** Bio columns joined from the Players table for the imputation model. */
const PLAYERS_COLS = {
  personId: 'personId',
  height: 'heightInches',
  birthDate: 'birthDate',
  guard: 'guard', // 0/1 position flags (a player may be more than one)
  forward: 'forward',
  center: 'center',
} as const;

/** Fallbacks when a player's bio is missing (small number of old/obscure players). */
const DEFAULT_HEIGHT_INCHES = 78;
const DEFAULT_AGE_YEARS = 27;

/** Source columns we read from the player box score table. */
const PLAYER_COLS = {
  gameId: 'gameId',
  gameDate: 'gameDate',
  personId: 'personId',
  firstName: 'firstName',
  lastName: 'lastName',
  team: 'playerteamName',
  home: 'home',
  minutes: 'numMinutes',
  points: 'points',
  rebounds: 'reboundsTotal',
  assists: 'assists',
  steals: 'steals',
  blocks: 'blocks',
  turnovers: 'turnovers',
  fgMade: 'fieldGoalsMade',
  fgAtt: 'fieldGoalsAttempted',
  fg3Made: 'threePointersMade',
  fg3Att: 'threePointersAttempted',
  ftMade: 'freeThrowsMade',
  ftAtt: 'freeThrowsAttempted',
  fouls: 'foulsPersonal',
  gameType: 'gameType',
  startingPosition: 'startingPosition',
} as const;

/** Source columns we read from the games table. */
const GAMES_COLS = {
  gameId: 'gameId',
  gameDate: 'gameDate',
  homeTeam: 'hometeamName',
  awayTeam: 'awayteamName',
  homeTeamId: 'hometeamId',
  awayTeamId: 'awayteamId',
  homeScore: 'homeScore',
  awayScore: 'awayScore',
  gameType: 'gameType',
} as const;

const ATTACH_ALIAS = 'legacy_src';

/** SQL expression mapping a game date to the NBA season start year. */
function seasonYearExpr(dateCol: string): string {
  return `(year(CAST(${dateCol} AS DATE)) - CASE WHEN month(CAST(${dateCol} AS DATE)) <= 6 THEN 1 ELSE 0 END)`;
}

/** SQL expression mapping the source game type to our season_type label. */
function seasonTypeExpr(typeCol: string): string {
  return `CASE WHEN lower(CAST(${typeCol} AS VARCHAR)) LIKE '%playoff%' THEN 'Playoffs' ELSE 'Regular Season' END`;
}

/** Only ingest games we can classify as Regular Season or Playoffs. */
function gameTypeFilter(typeCol: string): string {
  return `lower(CAST(${typeCol} AS VARCHAR)) NOT LIKE '%pre%' AND lower(CAST(${typeCol} AS VARCHAR)) NOT LIKE '%all%star%'`;
}

/** Player height (inches) from the joined bio table, with a fallback for missing bios. */
function heightExpr(): string {
  return `COALESCE(TRY_CAST(pl.${PLAYERS_COLS.height} AS DOUBLE), ${DEFAULT_HEIGHT_INCHES})`;
}

/** Player age (years) at game time from birthDate, with a fallback for missing bios. */
function ageExpr(dateCol: string): string {
  return `CAST(COALESCE(date_diff('year', TRY_CAST(pl.${PLAYERS_COLS.birthDate} AS DATE), CAST(${dateCol} AS DATE)), ${DEFAULT_AGE_YEARS}) AS DOUBLE)`;
}

/** A 0/1 position flag from the bio table, NULL→0. */
function posExpr(col: string): string {
  return `CAST(COALESCE(TRY_CAST(pl.${col} AS DOUBLE), 0) AS DOUBLE)`;
}

export class LegacySourceReader {
  private db: MotherDuckConnection;
  private config: LegacyConfig;
  private attached = false;

  constructor(db: MotherDuckConnection, config: LegacyConfig) {
    this.db = db;
    this.config = config;
  }

  /** ATTACH the sqlite source (no-op for file-relation formats). */
  async open(): Promise<void> {
    if (this.config.sourceFormat !== 'sqlite') return;
    const abs = path.resolve(this.config.source);
    await this.db.execute('INSTALL sqlite');
    await this.db.execute('LOAD sqlite');
    await this.db.execute(`ATTACH '${abs.replace(/'/g, "''")}' AS ${ATTACH_ALIAS} (TYPE sqlite)`);
    this.attached = true;
  }

  async detach(): Promise<void> {
    if (this.attached) {
      try {
        await this.db.execute(`DETACH ${ATTACH_ALIAS}`);
      } catch {
        /* ignore */
      }
      this.attached = false;
    }
  }

  /** Resolve the SQL relation expression for a given source table/file. */
  private relation(table: string): string {
    const fmt = this.config.sourceFormat;
    if (fmt === 'sqlite') return `${ATTACH_ALIAS}.${table}`;

    // csv / parquet: --source is a directory (or a sibling file) holding
    // PlayerStatistics.<ext> and Games.<ext>.
    const ext = fmt; // 'csv' | 'parquet'
    const stat = fs.existsSync(this.config.source) && fs.statSync(this.config.source).isDirectory();
    const dir = stat ? this.config.source : path.dirname(this.config.source);
    const file = path.resolve(dir, `${table}.${ext}`);
    const escaped = file.replace(/'/g, "''");
    return fmt === 'parquet'
      ? `read_parquet('${escaped}')`
      : `read_csv('${escaped}', header=true, sample_size=-1)`;
  }

  /** Log the real column list of each source relation so the mapping can be verified. */
  async introspectSchema(): Promise<void> {
    for (const [label, table] of [
      ['players', PLAYER_TABLE],
      ['games', GAMES_TABLE],
    ] as const) {
      try {
        const cols = await this.db.query<{ column_name: string; column_type: string }>(
          `DESCRIBE SELECT * FROM ${this.relation(table)} LIMIT 0`,
        );
        logger.info(`Source schema: ${label} (${table})`, {
          columns: cols.map((c) => c.column_name).join(', '),
        });
        this.warnMissing(label, table, cols.map((c) => c.column_name));
      } catch (err) {
        logger.error(`Failed to introspect ${label} relation (${table})`, {
          error: (err as Error).message,
          relation: this.relation(table),
        });
        throw err;
      }
    }
  }

  private warnMissing(label: string, table: string, actual: string[]): void {
    const expected = table === PLAYER_TABLE ? Object.values(PLAYER_COLS) : Object.values(GAMES_COLS);
    const have = new Set(actual);
    const missing = expected.filter((c) => !have.has(c));
    if (missing.length > 0) {
      logger.warn(`Expected columns not found in ${label} (${table}) — mapping may need adjustment`, {
        missing: missing.join(', '),
      });
    }
  }

  /** Read schedule rows for the configured season range. */
  async readGames(): Promise<NormalizedGameRow[]> {
    const c = GAMES_COLS;
    const sy = seasonYearExpr(c.gameDate);
    const sql = `
      SELECT
        CAST(${c.gameId} AS VARCHAR) AS source_game_id,
        CAST(${c.gameDate} AS VARCHAR) AS game_date,
        CAST(${sy} AS INTEGER) AS season_year,
        ${seasonTypeExpr(c.gameType)} AS season_type,
        CAST(${c.homeTeam} AS VARCHAR) AS home_team,
        CAST(${c.awayTeam} AS VARCHAR) AS away_team,
        TRY_CAST(${c.homeTeamId} AS INTEGER) AS home_team_id,
        TRY_CAST(${c.awayTeamId} AS INTEGER) AS away_team_id,
        TRY_CAST(${c.homeScore} AS INTEGER) AS home_score,
        TRY_CAST(${c.awayScore} AS INTEGER) AS away_score
      FROM ${this.relation(GAMES_TABLE)}
      WHERE ${sy} BETWEEN ${this.config.fromYear} AND ${this.config.toYear}
        AND ${gameTypeFilter(c.gameType)}`;
    return this.db.query<NormalizedGameRow>(sql);
  }

  /** Read player box score rows (joined to bio for height/age) for the season range. */
  async readPlayerBox(): Promise<NormalizedPlayerRow[]> {
    const c = PLAYER_COLS;
    const sy = seasonYearExpr(`ps.${c.gameDate}`);
    const sql = `
      SELECT
        CAST(ps.${c.gameId} AS VARCHAR) AS source_game_id,
        CAST(ps.${c.gameDate} AS VARCHAR) AS game_date,
        CAST(${sy} AS INTEGER) AS season_year,
        CAST(ps.${c.personId} AS VARCHAR) AS person_id,
        trim(concat(CAST(ps.${c.firstName} AS VARCHAR), ' ', CAST(ps.${c.lastName} AS VARCHAR))) AS player_name,
        CAST(ps.${c.team} AS VARCHAR) AS team,
        TRY_CAST(ps.${c.home} AS BOOLEAN) AS is_home,
        -- startingPosition is set (e.g. 'G'/'F'/'C') for starters, empty for bench.
        -- Present → starter; empty → NULL so the parser can fall back to the
        -- top-5-scorers heuristic for old games that lack the field entirely.
        CASE WHEN ps.${c.startingPosition} IS NOT NULL
              AND trim(CAST(ps.${c.startingPosition} AS VARCHAR)) != ''
             THEN true ELSE NULL END AS is_starter,
        TRY_CAST(ps.${c.minutes} AS DOUBLE) AS minutes,
        TRY_CAST(ps.${c.points} AS DOUBLE) AS points,
        TRY_CAST(ps.${c.rebounds} AS DOUBLE) AS rebounds,
        TRY_CAST(ps.${c.assists} AS DOUBLE) AS assists,
        TRY_CAST(ps.${c.steals} AS DOUBLE) AS steals,
        TRY_CAST(ps.${c.blocks} AS DOUBLE) AS blocks,
        TRY_CAST(ps.${c.turnovers} AS DOUBLE) AS turnovers,
        TRY_CAST(ps.${c.fgMade} AS DOUBLE) AS fg_made,
        TRY_CAST(ps.${c.fgAtt} AS DOUBLE) AS fg_attempted,
        TRY_CAST(ps.${c.fg3Made} AS DOUBLE) AS fg3_made,
        TRY_CAST(ps.${c.fg3Att} AS DOUBLE) AS fg3_attempted,
        TRY_CAST(ps.${c.ftMade} AS DOUBLE) AS ft_made,
        TRY_CAST(ps.${c.ftAtt} AS DOUBLE) AS ft_attempted,
        TRY_CAST(ps.${c.fouls} AS DOUBLE) AS fouls,
        ${heightExpr()} AS height,
        ${ageExpr(`ps.${c.gameDate}`)} AS age,
        ${posExpr(PLAYERS_COLS.guard)} AS pos_guard,
        ${posExpr(PLAYERS_COLS.forward)} AS pos_forward,
        ${posExpr(PLAYERS_COLS.center)} AS pos_center
      FROM ${this.relation(PLAYER_TABLE)} ps
      LEFT JOIN ${this.relation(PLAYERS_TABLE)} pl
        ON CAST(ps.${c.personId} AS VARCHAR) = CAST(pl.${PLAYERS_COLS.personId} AS VARCHAR)
      WHERE ${sy} BETWEEN ${this.config.fromYear} AND ${this.config.toYear}
        AND ${gameTypeFilter(`ps.${c.gameType}`)}`;
    return this.db.query<NormalizedPlayerRow>(sql);
  }

  /**
   * Read per-(player, season) aggregates over the RECORDED era (>= 1973) to train
   * the imputation models. Pulled from the same dataset so the model is fit on the
   * exact statistical universe it's projected back onto.
   */
  async readRecordedEraSeasonAggregates(): Promise<PlayerSeasonAgg[]> {
    const c = PLAYER_COLS;
    const sy = seasonYearExpr(`ps.${c.gameDate}`);
    const sql = `
      SELECT
        CAST(ps.${c.personId} AS VARCHAR) AS person_id,
        CAST(${sy} AS INTEGER) AS season_year,
        CAST(COUNT(*) AS INTEGER) AS games,
        CAST(SUM(TRY_CAST(ps.${c.minutes} AS DOUBLE)) AS DOUBLE) AS minutes,
        CAST(SUM(TRY_CAST(ps.${c.points} AS DOUBLE)) AS DOUBLE) AS points,
        CAST(SUM(TRY_CAST(ps.${c.rebounds} AS DOUBLE)) AS DOUBLE) AS rebounds,
        CAST(SUM(TRY_CAST(ps.${c.assists} AS DOUBLE)) AS DOUBLE) AS assists,
        CAST(SUM(TRY_CAST(ps.${c.steals} AS DOUBLE)) AS DOUBLE) AS steals,
        CAST(SUM(TRY_CAST(ps.${c.blocks} AS DOUBLE)) AS DOUBLE) AS blocks,
        CAST(SUM(TRY_CAST(ps.${c.turnovers} AS DOUBLE)) AS DOUBLE) AS turnovers,
        CAST(SUM(TRY_CAST(ps.${c.fgAtt} AS DOUBLE)) AS DOUBLE) AS fg_attempted,
        CAST(SUM(TRY_CAST(ps.${c.ftAtt} AS DOUBLE)) AS DOUBLE) AS ft_attempted,
        CAST(SUM(TRY_CAST(ps.${c.fouls} AS DOUBLE)) AS DOUBLE) AS fouls,
        CAST(AVG(${heightExpr()}) AS DOUBLE) AS height,
        CAST(AVG(${ageExpr(`ps.${c.gameDate}`)}) AS DOUBLE) AS age,
        CAST(MAX(${posExpr(PLAYERS_COLS.guard)}) AS DOUBLE) AS pos_guard,
        CAST(MAX(${posExpr(PLAYERS_COLS.forward)}) AS DOUBLE) AS pos_forward,
        CAST(MAX(${posExpr(PLAYERS_COLS.center)}) AS DOUBLE) AS pos_center
      FROM ${this.relation(PLAYER_TABLE)} ps
      LEFT JOIN ${this.relation(PLAYERS_TABLE)} pl
        ON CAST(ps.${c.personId} AS VARCHAR) = CAST(pl.${PLAYERS_COLS.personId} AS VARCHAR)
      WHERE ${sy} >= 1973
        AND ${gameTypeFilter(`ps.${c.gameType}`)}
      GROUP BY person_id, season_year`;
    return this.db.query<PlayerSeasonAgg>(sql);
  }
}

// ── Raw provenance lake ─────────────────────────────────────────────────────

export interface RawLegacyRow {
  game_id: string;
  season_year: number;
  season_type: string;
  game_json: unknown;
  box_score_json: unknown;
}

function esc(val: string | null | undefined): string {
  if (val == null) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

/**
 * Store raw source rows per game in raw_game_data_legacy for provenance.
 * Standalone helper (not on Loader) so the shared loader stays untouched.
 */
export async function storeRawLegacy(
  db: MotherDuckConnection,
  sourceDataset: string,
  sourceVersion: string | null,
  rows: RawLegacyRow[],
  batchSize = 200,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map(
        (r) =>
          `(${esc(r.game_id)}, ${r.season_year}, ${esc(r.season_type)}, ` +
          `${esc(sourceDataset)}, ${esc(sourceVersion)}, ` +
          `${esc(JSON.stringify(r.game_json))}, ${esc(JSON.stringify(r.box_score_json))})`,
      )
      .join(',\n');
    await db.execute(
      `INSERT OR REPLACE INTO main.raw_game_data_legacy
       (game_id, season_year, season_type, source_dataset, source_version, game_json, box_score_json)
       VALUES\n${values}`,
    );
  }
}

/** Persist fitted imputation-model coefficients for reproducibility. */
export async function storeImputationModels(
  db: MotherDuckConnection,
  rows: Array<{ fit_id: string; target: string; feature: string; coefficient: number; r2: number; n_train: number }>,
): Promise<void> {
  if (rows.length === 0) return;
  const values = rows
    .map(
      (r) =>
        `(${esc(r.fit_id)}, ${esc(r.target)}, ${esc(r.feature)}, ${r.coefficient}, ${r.r2}, ${r.n_train})`,
    )
    .join(',\n');
  await db.execute(
    `INSERT OR REPLACE INTO main.legacy_imputation_models
     (fit_id, target, feature, coefficient, r2, n_train)
     VALUES\n${values}`,
  );
}
