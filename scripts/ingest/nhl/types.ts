// NHL API response types and database row types

// --- NHL API response types ---

/** Localized string from the NHL API (access via .default) */
export interface LocalizedString {
  default: string;
  cs?: string;
  de?: string;
  es?: string;
  fi?: string;
  fr?: string;
  sk?: string;
  sv?: string;
}

/** A single skater's stats from the NHL box score API */
export interface NHLSkaterStats {
  playerId: number;
  name: LocalizedString;
  position: string;
  sweaterNumber: number;
  toi: string; // "MM:SS" format
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  shots: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  faceoffWinningPctg?: number;
  faceoffs?: string; // "W/L" format
  shorthanded?: number;
  shorthandedGoals?: number;
  takeaways?: number;
  giveaways?: number;
  faceoffPctg?: number;
}

/** A single goalie's stats from the NHL box score API */
export interface NHLGoalieStats {
  playerId: number;
  name: LocalizedString;
  sweaterNumber: number;
  toi: string; // "MM:SS" format
  saveShotsAgainst?: string; // "saves-shotsAgainst" format
  savePctg?: number;
  goalsAgainst?: number;
  evenStrengthGoalsAgainst?: number;
  powerPlayGoalsAgainst?: number;
  shorthandedGoalsAgainst?: number;
  decision?: string; // "W", "L", "O" (OT loss)
  starter?: boolean;
}

/** Team stats grouping in the NHL box score response */
export interface NHLTeamPlayerStats {
  forwards: NHLSkaterStats[];
  defense: NHLSkaterStats[];
  goalies: NHLGoalieStats[];
}

/** NHL box score API response shape */
export interface NHLBoxScoreResponse {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: LocalizedString;
  startTimeUTC: string;
  gameState: string; // "FUT", "LIVE", "FINAL", "OFF"
  gameScheduleState: string;
  awayTeam: {
    id: number;
    abbrev: string;
    name: LocalizedString;
    score?: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    name: LocalizedString;
    score?: number;
  };
  playerByGameStats: {
    awayTeam: NHLTeamPlayerStats;
    homeTeam: NHLTeamPlayerStats;
  };
  boxscore?: {
    playerByGameStats: {
      awayTeam: NHLTeamPlayerStats;
      homeTeam: NHLTeamPlayerStats;
    };
  };
}

/** A single game day entry from the NHL schedule API */
export interface NHLScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: LocalizedString;
  startTimeUTC: string;
  gameState: string;
  gameScheduleState: string;
  awayTeam: {
    id: number;
    abbrev: string;
    name: LocalizedString;
    score?: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    name: LocalizedString;
    score?: number;
  };
}

/** NHL schedule API response shape */
export interface NHLScheduleResponse {
  nextStartDate?: string;
  previousStartDate?: string;
  gameWeek: Array<{
    date: string;
    dayAbbrev: string;
    numberOfGames: number;
    games: NHLScheduleGame[];
  }>;
}

// --- Database row types ---

/** Row matching the nhl_box_scores.skater_stats table */
export interface SkaterRow {
  game_id: string;
  team_abbreviation: string;
  entity_id: string;
  player_name: string;
  position: string;
  toi: string | null;
  goals: number;
  assists: number;
  points: number;
  plus_minus: number;
  pim: number;
  shots: number;
  hits: number;
  blocked_shots: number;
  takeaways: number;
  giveaways: number;
  faceoff_wins: number;
  faceoff_losses: number;
  power_play_goals: number;
  starter: number | null;
  period: string;
}

/** Row matching the nhl_box_scores.goalie_stats table */
export interface GoalieRow {
  game_id: string;
  team_abbreviation: string;
  entity_id: string;
  player_name: string;
  toi: string | null;
  saves: number;
  goals_against: number;
  save_pct: number;
  shots_against: number;
  decision: string | null;
  starter: number | null;
  period: string;
}

/** Row matching the nhl_box_scores.schedule table */
export interface NHLScheduleRow {
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

/** Row matching the nhl_box_scores.ingestion_log table */
export interface NHLIngestionLogEntry {
  game_id: string;
  season_year: number;
  season_type: string;
  ingestion_status: 'success' | 'error';
  error_message?: string;
}

// --- Pipeline types ---

/** Progress tracking for a season ingestion run */
export interface NHLSeasonProgress {
  seasonYear: number;
  seasonType: string;
  totalGames: number;
  completed: number;
  skipped: number;
  failed: number;
}

/** Pipeline configuration (output of buildNHLConfig) */
export interface NHLPipelineConfig {
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
