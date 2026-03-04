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

export type CellState = 'active' | 'fading';
