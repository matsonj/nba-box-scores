// Reusable status queries for the ingestion dashboard
// Used by both the CLI status tool and (later) the web dashboard

import { MotherDuckConnection } from './connection';

export interface IngestionSummaryRow {
  season_year: number;
  season_type: string;
  total_games: number;
  success_count: number;
  error_count: number;
  last_ingested_at: string | null;
}

export interface RecentErrorRow {
  game_id: string;
  season_year: number;
  season_type: string;
  ingested_at: string;
  error_message: string;
}

export interface OverallStats {
  total_games_ingested: number;
  total_box_score_rows: number;
  total_unique_players: number;
}

/** Per-season ingestion counts (success/error/last timestamp) */
export async function getIngestionSummary(
  db: MotherDuckConnection,
  seasonYear?: number,
): Promise<IngestionSummaryRow[]> {
  const where = seasonYear !== undefined ? `WHERE season_year = ${seasonYear}` : '';
  return db.query<IngestionSummaryRow>(`
    SELECT
      season_year,
      season_type,
      COUNT(*) AS total_games,
      COUNT(*) FILTER (WHERE ingestion_status = 'success') AS success_count,
      COUNT(*) FILTER (WHERE ingestion_status = 'error') AS error_count,
      MAX(ingested_at) AS last_ingested_at
    FROM ingestion_log
    ${where}
    GROUP BY season_year, season_type
    ORDER BY season_year DESC, season_type
  `);
}

/** Most recent ingestion errors */
export async function getRecentErrors(
  db: MotherDuckConnection,
  limit: number = 20,
): Promise<RecentErrorRow[]> {
  return db.query<RecentErrorRow>(`
    SELECT
      game_id,
      season_year,
      season_type,
      ingested_at,
      error_message
    FROM ingestion_log
    WHERE ingestion_status = 'error'
    ORDER BY ingested_at DESC
    LIMIT ${limit}
  `);
}

/** Overall stats: total games, box score rows, unique players */
export async function getOverallStats(
  db: MotherDuckConnection,
): Promise<OverallStats> {
  const rows = await db.query<OverallStats>(`
    SELECT
      (SELECT COUNT(*) FROM ingestion_log WHERE ingestion_status = 'success') AS total_games_ingested,
      (SELECT COUNT(*) FROM box_scores WHERE period = 'FullGame') AS total_box_score_rows,
      (SELECT COUNT(DISTINCT entity_id) FROM box_scores WHERE period = 'FullGame') AS total_unique_players
  `);
  return rows[0];
}
