import { NextResponse, NextRequest } from 'next/server';
import { queryDb } from '@/lib/db';
import { Team } from '@/types';
import { Schedule } from '@/types/schema';
import { Game } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching schedule from DuckDB...');
    const result = await queryDb<Schedule>(
      `SELECT * FROM main.schedule`
    );
    
    console.log('Raw query result:', result[0]);
    
    // Transform the data to include team objects
    const games = result.map((game) => {
      const homeTeam: Team = {
        teamId: game.home_team_abbreviation,
        teamName: game.home_team_abbreviation,
        teamAbbreviation: game.home_team_abbreviation,
        score: Number(game.home_team_score) || 0,
        players: []
      };

      const awayTeam: Team = {
        teamId: game.away_team_abbreviation,
        teamName: game.away_team_abbreviation,
        teamAbbreviation: game.away_team_abbreviation,
        score: Number(game.away_team_score) || 0,
        players: []
      };

      return {
        game_id: game.game_id,
        gameDate: game.game_date,
        home_team_id: Number(game.home_team_id),
        away_team_id: Number(game.away_team_id),
        home_team_abbreviation: game.home_team_abbreviation,
        away_team_abbreviation: game.away_team_abbreviation,
        home_team_score: Number(game.home_team_score),
        away_team_score: Number(game.away_team_score),
        status: game.status,
        homeTeam,
        awayTeam,
        boxScoreLoaded: false,
        created_at: game.created_at
      } as Game;
    });

    console.log('Successfully fetched games:', games.length);
    return NextResponse.json(games);
  } catch (error) {
    const err = error as Error;
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
