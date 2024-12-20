export interface Game {
  game_id: string;
  gameDate: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
  boxScoreLoaded?: boolean;
  homeTeam: Team;
  awayTeam: Team;
}

export interface GameInfo extends Game {
  period: number;
  clock: string;
}

export interface PlayerStats {
  player_name: string;
  team_abbreviation: string;
  team_id: string;
  period: string;
  minutes: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  points: number;
}

export interface Team {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  score: number;
  players?: PlayerStats[];
}

export interface TeamStats {
  team_abbreviation: string;
  period: string;
  points: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  offensive_possessions: number;
  defensive_possessions: number;
}
