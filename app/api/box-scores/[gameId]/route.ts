import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { Team, PlayerStats } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params;

    // Get player stats
    const playerStats = await queryDb(`
      SELECT 
        player_name,
        team_abbreviation,
        minutes,
        field_goals_made,
        field_goals_attempted,
        three_pointers_made,
        three_pointers_attempted,
        free_throws_made,
        free_throws_attempted,
        offensive_rebounds,
        defensive_rebounds,
        rebounds,
        assists,
        steals,
        blocks,
        turnovers,
        personal_fouls,
        points
      FROM main.box_scores
      WHERE game_id = $1
      AND period = 'FullGame'
      ORDER BY team_abbreviation, points DESC
    `, [gameId]);

    // Get team stats
    const teamStats = await queryDb(`
      SELECT 
        team_abbreviation,
        points,
        field_goals_made,
        field_goals_attempted,
        three_pointers_made,
        three_pointers_attempted,
        free_throws_made,
        free_throws_attempted,
        offensive_rebounds,
        defensive_rebounds,
        rebounds,
        assists,
        steals,
        blocks,
        turnovers,
        personal_fouls,
        offensive_possessions,
        defensive_possessions
      FROM main.team_stats
      WHERE game_id = $1
      AND period = 'FullGame'
    `, [gameId]);

    // Get game info from schedule
    const gameInfo = await queryDb(`
      SELECT 
        game_id,
        game_date,
        home_team_abbreviation,
        away_team_abbreviation,
        home_team_score,
        away_team_score,
        status
      FROM main.schedule
      WHERE game_id = $1
    `, [gameId]);

    if (gameInfo.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameInfo[0];
    
    // Group players by team
    const homeTeamPlayers = playerStats.filter((p: PlayerStats) => p.team_abbreviation === game.home_team_abbreviation);
    const awayTeamPlayers = playerStats.filter((p: PlayerStats) => p.team_abbreviation === game.away_team_abbreviation);
    
    // Find team stats
    const homeTeamStats = teamStats.find((t: any) => t.team_abbreviation === game.home_team_abbreviation) || {};
    const awayTeamStats = teamStats.find((t: any) => t.team_abbreviation === game.away_team_abbreviation) || {};
    
    // Create team objects
    const homeTeam: Team = {
      teamId: game.home_team_abbreviation,
      teamName: game.home_team_abbreviation,
      teamAbbreviation: game.home_team_abbreviation,
      score: game.home_team_score || 0,
      players: homeTeamPlayers,
      ...homeTeamStats
    };
    
    const awayTeam: Team = {
      teamId: game.away_team_abbreviation,
      teamName: game.away_team_abbreviation,
      teamAbbreviation: game.away_team_abbreviation,
      score: game.away_team_score || 0,
      players: awayTeamPlayers,
      ...awayTeamStats
    };

    return NextResponse.json({
      gameInfo: {
        ...game,
        gameDate: game.game_date,
        game_date: undefined
      },
      homeTeam,
      awayTeam,
    });
  } catch (error) {
    console.error('Error fetching box score:', error);
    return NextResponse.json(
      { error: 'Error fetching box score' },
      { status: 500 }
    );
  }
}
