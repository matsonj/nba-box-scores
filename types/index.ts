export interface Game {
  gameId: string;
  homeTeam: Team;
  awayTeam: Team;
  gameStatus: string;
  period: number;
  clock: string;
  startTime: string;
}

export interface Team {
  teamId: string;
  teamName: string;
  score: number;
  players: Player[];
}

export interface Player {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  position: string;
  stats: PlayerStats;
}

export interface PlayerStats {
  minutes: string;
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
}

export interface ApiGameResponse {
  GameId: string;
  Date: string;
  HomeTeamId: string;
  AwayTeamId: string;
  HomePoints: number;
  AwayPoints: number;
  HomePossessions: number;
  AwayPossessions: number;
  HomeTeamAbbreviation: string;
  AwayTeamAbbreviation: string;
}
