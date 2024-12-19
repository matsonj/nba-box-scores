import { NextResponse, Request } from 'next/server';
import { queryDb } from '@/lib/db';
import { Game, Team } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    console.log('Fetching schedule from DuckDB...');
    const result = await queryDb(
      'SELECT * FROM main.schedule'
    );
    
    // Transform the data to include team objects
    const games = result.map((game: any) => {
      const homeTeam: Team = {
        teamId: game.home_team_abbreviation, // Using abbreviation as ID for now
        teamName: game.home_team_abbreviation, // You might want to add a teams table to get full names
        teamAbbreviation: game.home_team_abbreviation,
        score: game.home_team_score || 0,
        players: []
      };

      const awayTeam: Team = {
        teamId: game.away_team_abbreviation,
        teamName: game.away_team_abbreviation,
        teamAbbreviation: game.away_team_abbreviation,
        score: game.away_team_score || 0,
        players: []
      };

      return {
        ...game,
        homeTeam,
        awayTeam,
        boxScoreLoaded: false
      } as Game;
    });

    console.log('Successfully fetched games:', games.length);
    return NextResponse.json(games);
  } catch (error) {
    const err = error as Error;
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: `Error fetching schedule: ${err.message}` },
      { status: 500 }
    );
  }
}
