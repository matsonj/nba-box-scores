export interface LiveScoreGame {
  game_id: string;
  game_date: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_id: number;
  away_team_id: number;
  home_team_score: number;
  away_team_score: number;
  status: string;
  period: string;
  clock: string;
  periodScores: {
    teamId: string;
    period: string;
    points: number;
  }[];
  lastPlay?: string;
}

export interface LiveScoresResponse {
  games: LiveScoreGame[];
  timestamp: string;
}

export interface LivePlayerStats {
  personId: string;
  playerName: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
  starter: boolean;
  oncourt: boolean;
  played: boolean;
}

export interface LiveBoxScoreTeam {
  teamId: string;
  teamTricode: string;
  score: number;
  players: LivePlayerStats[];
}

export interface LiveBoxScoreResponse {
  gameId: string;
  gameStatus: string;
  lastPlay: string | null;
  homeTeam: LiveBoxScoreTeam;
  awayTeam: LiveBoxScoreTeam;
}

// NHL live box score types (from /api/nhl-live-boxscore)

export interface NHLLiveSkaterStats {
  personId: string;
  playerName: string;
  position: 'F' | 'D';
  toi: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  shots: number;
  hits: number;
  blockedShots: number;
  faceoffWins: number;
  faceoffLosses: number;
}

export interface NHLLiveGoalieStats {
  personId: string;
  playerName: string;
  position: 'G';
  toi: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePctg: number;
  decision: string;
  starter: boolean;
}

export interface NHLLiveBoxScoreTeam {
  teamId: string;
  teamAbbrev: string;
  score: number;
  skaters: NHLLiveSkaterStats[];
  goalies: NHLLiveGoalieStats[];
}

export interface NHLLiveBoxScoreResponse {
  gameId: string;
  gameStatus: string;
  lastPlay: string;
  homeTeam: NHLLiveBoxScoreTeam;
  awayTeam: NHLLiveBoxScoreTeam;
}

/** Union of all sport-specific live box score shapes */
export type AnyLiveBoxScoreResponse = LiveBoxScoreResponse | NHLLiveBoxScoreResponse;

export type CellState = 'active' | 'fading';
