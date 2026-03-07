// Batch data loader for the NHL ingestion pipeline

import { MotherDuckConnection } from '../../db/connection';
import { ALL_DDL, CREATE_TEAM_STATS_VIEW } from './schema';
import { logger } from '../../util/logger';
import type { SkaterRow, GoalieRow, NHLScheduleRow, NHLIngestionLogEntry } from '../types';

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

export class NHLLoader {
  private db: MotherDuckConnection;
  private batchSize: number;

  constructor(db: MotherDuckConnection, batchSize: number = DEFAULT_BATCH_SIZE) {
    this.db = db;
    this.batchSize = batchSize;
  }

  /** Run all DDL from schema.ts to ensure tables and views exist */
  async ensureSchema(): Promise<void> {
    logger.info('Ensuring NHL database schema exists');
    for (const ddl of ALL_DDL) {
      await this.db.execute(ddl);
    }
    logger.info('NHL schema verified');
  }

  /** Insert or replace skater stat rows in batches */
  async loadSkaters(rows: SkaterRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const values = batch
        .map(
          (r) =>
            `(${esc(r.game_id)}, ${esc(r.team_abbreviation)}, ${esc(r.entity_id)}, ${esc(r.player_name)}, ` +
            `${esc(r.position)}, ${esc(r.toi)}, ` +
            `${num(r.goals)}, ${num(r.assists)}, ${num(r.points)}, ` +
            `${num(r.plus_minus)}, ${num(r.pim)}, ${num(r.shots)}, ` +
            `${num(r.hits)}, ${num(r.blocked_shots)}, ` +
            `${num(r.takeaways)}, ${num(r.giveaways)}, ` +
            `${num(r.faceoff_wins)}, ${num(r.faceoff_losses)}, ` +
            `${num(r.power_play_goals)}, ${num(r.starter)}, ${esc(r.period)})`,
        )
        .join(',\n');

      await this.db.execute(
        `INSERT OR REPLACE INTO main.skater_stats (
          game_id, team_abbreviation, entity_id, player_name,
          position, toi,
          goals, assists, points,
          plus_minus, pim, shots,
          hits, blocked_shots,
          takeaways, giveaways,
          faceoff_wins, faceoff_losses,
          power_play_goals, starter, period
        ) VALUES\n${values}`,
      );

      logger.debug('Loaded skater_stats batch', {
        offset: i,
        batchSize: batch.length,
        total: rows.length,
      });
    }
  }

  /** Insert or replace goalie stat rows in batches */
  async loadGoalies(rows: GoalieRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const values = batch
        .map(
          (r) =>
            `(${esc(r.game_id)}, ${esc(r.team_abbreviation)}, ${esc(r.entity_id)}, ${esc(r.player_name)}, ` +
            `${esc(r.toi)}, ` +
            `${num(r.saves)}, ${num(r.goals_against)}, ${num(r.save_pct)}, ` +
            `${num(r.shots_against)}, ${esc(r.decision)}, ` +
            `${num(r.starter)}, ${esc(r.period)})`,
        )
        .join(',\n');

      await this.db.execute(
        `INSERT OR REPLACE INTO main.goalie_stats (
          game_id, team_abbreviation, entity_id, player_name,
          toi,
          saves, goals_against, save_pct,
          shots_against, decision,
          starter, period
        ) VALUES\n${values}`,
      );

      logger.debug('Loaded goalie_stats batch', {
        offset: i,
        batchSize: batch.length,
        total: rows.length,
      });
    }
  }

  /** Insert or replace schedule rows in batches */
  async loadSchedule(rows: NHLScheduleRow[]): Promise<void> {
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

  /** Store raw NHL box score JSON for the data lake */
  async loadRawBoxScore(
    gameId: string,
    seasonYear: number,
    seasonType: string,
    gameJson: unknown,
    boxScoreJson: unknown,
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO main.raw_nhl_box_scores
       (game_id, season_year, season_type, game_json, box_score_json)
       VALUES (${esc(gameId)}, ${num(seasonYear)}, ${esc(seasonType)},
               ${esc(JSON.stringify(gameJson))}, ${esc(JSON.stringify(boxScoreJson))})`,
    );
  }

  /** Mark a game as ingested in the ingestion_log */
  async markIngested(entry: NHLIngestionLogEntry): Promise<void> {
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

  /** Recreate the team_stats view from the schema DDL */
  async deriveTeamStats(): Promise<void> {
    await this.db.execute(CREATE_TEAM_STATS_VIEW);
    logger.info('team_stats view refreshed');
  }
}
