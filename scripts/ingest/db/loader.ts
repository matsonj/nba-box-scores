// Batch data loader for the v2 ingestion pipeline

import { MotherDuckConnection } from './connection';
import { ALL_DDL, CREATE_TEAM_STATS_VIEW } from './schema';
import { logger } from '../util/logger';
import type { BoxScoreRow, ScheduleRow, IngestionLogEntry } from '../types';

const DEFAULT_BATCH_SIZE = 500;

/** Escape a SQL string value (single quotes) */
function esc(val: string | null | undefined): string {
  if (val == null) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function num(val: number | null | undefined): string {
  if (val == null) return 'NULL';
  return String(val);
}

export class Loader {
  private db: MotherDuckConnection;
  private batchSize: number;

  constructor(db: MotherDuckConnection, batchSize: number = DEFAULT_BATCH_SIZE) {
    this.db = db;
    this.batchSize = batchSize;
  }

  /** Run all DDL from schema.ts to ensure tables and views exist */
  async ensureSchema(): Promise<void> {
    logger.info('Ensuring database schema exists');
    for (const ddl of ALL_DDL) {
      await this.db.execute(ddl);
    }
    logger.info('Schema verified');
  }

  /** Insert or replace box score rows in batches */
  async loadBoxScoreRows(rows: BoxScoreRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const values = batch
        .map(
          (r) =>
            `(${esc(r.game_id)}, ${esc(r.team_abbreviation)}, ${esc(r.entity_id)}, ${esc(r.player_name)}, ` +
            `${esc(r.period)}, ${esc(r.minutes)}, ` +
            `${num(r.points)}, ${num(r.rebounds)}, ${num(r.assists)}, ` +
            `${num(r.steals)}, ${num(r.blocks)}, ${num(r.turnovers)}, ` +
            `${num(r.fg_made)}, ${num(r.fg_attempted)}, ` +
            `${num(r.fg3_made)}, ${num(r.fg3_attempted)}, ` +
            `${num(r.ft_made)}, ${num(r.ft_attempted)}, ` +
            `${num(r.starter)})`,
        )
        .join(',\n');

      await this.db.execute(
        `INSERT OR REPLACE INTO main.box_scores (
          game_id, team_abbreviation, entity_id, player_name, period, minutes,
          points, rebounds, assists, steals, blocks, turnovers,
          fg_made, fg_attempted, fg3_made, fg3_attempted,
          ft_made, ft_attempted, starter
        ) VALUES\n${values}`,
      );

      logger.debug('Loaded box_scores batch', {
        offset: i,
        batchSize: batch.length,
        total: rows.length,
      });
    }
  }

  /** Insert or replace schedule rows in batches */
  async loadScheduleRows(rows: ScheduleRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const values = batch
        .map(
          (r) =>
            `(${esc(r.game_id)}, ${esc(r.game_date)}, ` +
            `${num(r.home_team_id)}, ${num(r.away_team_id)}, ` +
            `${esc(r.home_team_abbreviation)}, ${esc(r.away_team_abbreviation)}, ` +
            `${num(r.home_team_score)}, ${num(r.away_team_score)}, ` +
            `${esc(r.game_status)}, ${num(r.season_year)}, ${esc(r.season_type)})`,
        )
        .join(',\n');

      await this.db.execute(
        `INSERT OR REPLACE INTO main.schedule (
          game_id, game_date,
          home_team_id, away_team_id,
          home_team_abbreviation, away_team_abbreviation,
          home_team_score, away_team_score,
          game_status, season_year, season_type
        ) VALUES\n${values}`,
      );

      logger.debug('Loaded schedule batch', {
        offset: i,
        batchSize: batch.length,
        total: rows.length,
      });
    }
  }

  /** Mark a game as ingested in the ingestion_log */
  async markIngested(entry: IngestionLogEntry): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO main.ingestion_log (
        game_id, season_year, season_type, ingestion_status, error_message
      ) VALUES (
        ${esc(entry.game_id)},
        ${num(entry.season_year)},
        ${esc(entry.season_type)},
        ${esc(entry.ingestion_status)},
        ${esc(entry.error_message ?? null)}
      )`,
    );
  }

  /** Check if a single game has already been ingested successfully */
  async isGameIngested(gameId: string): Promise<boolean> {
    const rows = await this.db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.ingestion_log
       WHERE game_id = ${esc(gameId)} AND ingestion_status = 'success'`,
    );
    return (rows[0]?.cnt ?? 0) > 0;
  }

  /** Get all successfully ingested game IDs for a season, as a Set for fast lookup */
  async getIngestedGameIds(seasonYear: number, seasonType: string): Promise<Set<string>> {
    const rows = await this.db.query<{ game_id: string }>(
      `SELECT game_id FROM main.ingestion_log
       WHERE season_year = ${num(seasonYear)}
         AND season_type = ${esc(seasonType)}
         AND ingestion_status = 'success'`,
    );
    return new Set(rows.map((r) => r.game_id));
  }

  /** Get all game IDs that already have raw JSON for a season */
  async getRawGameIds(seasonYear: number, seasonType: string): Promise<Set<string>> {
    const rows = await this.db.query<{ game_id: string }>(
      `SELECT game_id FROM main.raw_game_data_pbpstats
       WHERE season_year = ${num(seasonYear)}
         AND season_type = ${esc(seasonType)}`,
    );
    return new Set(rows.map((r) => r.game_id));
  }

  /** Insert or replace a raw PBPStats game into the raw data lake */
  async storeRawPbpstats(
    gameId: string,
    seasonYear: number,
    seasonType: string,
    gameJson: unknown,
    boxScoreJson: unknown,
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO main.raw_game_data_pbpstats
       (game_id, season_year, season_type, game_json, box_score_json)
       VALUES (${esc(gameId)}, ${num(seasonYear)}, ${esc(seasonType)},
               ${esc(JSON.stringify(gameJson))}, ${esc(JSON.stringify(boxScoreJson))})`,
    );
  }

  /** Recreate the team_stats view from the schema DDL */
  async deriveTeamStats(): Promise<void> {
    await this.db.execute(CREATE_TEAM_STATS_VIEW);
    logger.info('team_stats view refreshed');
  }
}
