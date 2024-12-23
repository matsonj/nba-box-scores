import { Team } from './types/schema';

export interface Game {
  game_id: string;
  gameDate: string;
  home_team_id: number;
  away_team_id: number;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
  boxScoreLoaded: boolean;
  created_at: string;
}

export { Team };
