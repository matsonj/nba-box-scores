// Shared TypeScript interfaces for the v2 ingestion pipeline

// --- PBPStats API response types ---

/** Individual player stat entry from PBPStats API */
export interface PBPStatsPlayerEntry {
  EntityId: string;
  Name: string;
  ShortName: string;
  Minutes: string;
  Points?: number;
  Rebounds?: number;
  OffRebounds?: number;
  DefRebounds?: number;
  Assists?: number;
  Steals?: number;
  Blocks?: number;
  Turnovers?: number;
  FG2M?: number;
  FG2A?: number;
  FG3M?: number;
  FG3A?: number;
  FTA?: number;
  FoulsDrawn?: number;
  Fouls?: number;
  OffPoss?: number;
  DefPoss?: number;
  [key: string]: unknown;
}

/** PBPStats API response for box scores (get-game-stats endpoint) */
export interface PBPStatsBoxScoreResponse {
  stats: {
    Home: Record<string, PBPStatsPlayerEntry[]>;
    Away: Record<string, PBPStatsPlayerEntry[]>;
  };
  lineups?: unknown;
  totals?: unknown;
}

/** PBPStats API response for game listings */
export interface PBPStatsGamesResponse {
  results: Array<{
    GameId: string;
    Date: string;
    HomeTeamId: string;
    AwayTeamId: string;
    HomeTeamAbbreviation: string;
    AwayTeamAbbreviation: string;
    HomePoints: number;
    AwayPoints: number;
    [key: string]: unknown;
  }>;
}

// --- Database row types (match v2 schema in scripts/ingest/db/schema.ts) ---

/** Flat row matching the v2 box_scores table schema */
export interface BoxScoreRow {
  game_id: string;
  team_abbreviation: string;
  entity_id: string;
  player_name: string;
  period: string;
  minutes: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
  starter: number | null;
}

/** Row matching the v2 schedule table schema */
export interface ScheduleRow {
  game_id: string;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  game_status: string;
  season_year: number;
  season_type: string;
}

/** Row matching the v2 ingestion_log table */
export interface IngestionLogEntry {
  game_id: string;
  season_year: number;
  season_type: string;
  ingestion_status: 'success' | 'error';
  error_message?: string;
}

// --- Pipeline types ---

/** Progress tracking for a season ingestion run */
export interface SeasonProgress {
  seasonYear: number;
  seasonType: string;
  totalGames: number;
  completed: number;
  skipped: number;
  failed: number;
}

/** Pipeline configuration (output of buildConfig) */
export interface PipelineConfig {
  seasons: Array<{ year: number; type: string }>;
  delay: number;
  minDelay: number;
  maxDelay: number;
  seasonConcurrency: number;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
  motherDuckToken: string;
  database: string;
}
