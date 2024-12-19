import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

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

    return NextResponse.json({
      gameInfo: gameInfo[0],
      playerStats,
      teamStats,
    });
  } catch (error) {
    console.error('Error fetching box score:', error);
    return NextResponse.json(
      { error: 'Error fetching box score' },
      { status: 500 }
    );
  }
}
