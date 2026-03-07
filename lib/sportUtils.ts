import type { Sport } from '@/lib/sports';
import type { LiveScoreGame } from '@/app/types/live';
import type { ScheduleWithBoxScore } from '@/app/types/extended';

export function getSportFromPathname(pathname: string): Sport {
  if (pathname.startsWith('/nhl')) return 'nhl';
  return 'nba';
}

export function liveGameToSchedule(game: LiveScoreGame): ScheduleWithBoxScore {
  return {
    game_id: game.game_id,
    game_date: new Date(game.game_date),
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_team_abbreviation: game.home_team_abbreviation,
    away_team_abbreviation: game.away_team_abbreviation,
    home_team_score: game.home_team_score,
    away_team_score: game.away_team_score,
    game_status: game.status,
    created_at: new Date(),
    boxScoreLoaded: true,
    isPlayoff: false,
    periodScores: game.periodScores,
  };
}
