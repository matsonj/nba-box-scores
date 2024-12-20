import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { Team, PlayerStats } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;

    // Get player stats
    const playerStats = await queryDb(`
      SELECT 
        game_id,
        team_id,
        entity_id,
        player_name,
        minutes,
        points,
        rebounds,
        assists,
        steals,
        blocks,
        turnovers,
        fg_made,
        fg_attempted,
        fg3_made,
        fg3_attempted,
        ft_made,
        ft_attempted,
        plus_minus,
        starter,
        period
      FROM box_scores
      WHERE game_id = $1
      AND period = 'FullGame'
      ORDER BY team_id, points DESC
    `, [gameId]);

    // Get team stats
    const teamStats = await queryDb(`
      SELECT 
        game_id,
        team_id,
        period,
        minutes,
        points,
        rebounds,
        assists,
        steals,
        blocks,
        turnovers,
        fg_made,
        fg_attempted,
        fg3_made,
        fg3_attempted,
        ft_made,
        ft_attempted,
        offensive_possessions,
        defensive_possessions
      FROM team_stats
      WHERE game_id = $1
      AND period = 'FullGame'
    `, [gameId]);

    // Get game info from schedule
    const gameInfo = await queryDb(`
      SELECT 
        game_id,
        game_date,
        home_team_id,
        away_team_id,
        home_team_score,
        away_team_score,
        status
      FROM schedule
      WHERE game_id = $1
    `, [gameId]);

    if (gameInfo.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameInfo[0];
    
    // Group players by team
    const homeTeamPlayers = playerStats.filter((p: PlayerStats) => p.team_id === game.home_team_id);
    const awayTeamPlayers = playerStats.filter((p: PlayerStats) => p.team_id === game.away_team_id);
    
    // Find team stats
    const homeTeamStats = teamStats.find((t: any) => t.team_id === game.home_team_id) || {};
    const awayTeamStats = teamStats.find((t: any) => t.team_id === game.away_team_id) || {};

    const boxScore = {
      gameInfo: game,
      homeTeam: {
        ...homeTeamStats,
        teamId: game.home_team_id,
        players: homeTeamPlayers,
      },
      awayTeam: {
        ...awayTeamStats,
        teamId: game.away_team_id,
        players: awayTeamPlayers,
      },
    };

    return NextResponse.json(boxScore);

  } catch (error) {
    console.error('Error fetching box score:', error);
    return NextResponse.json(
      { error: 'Error fetching box score' },
      { status: 500 }
    );
  }
}
