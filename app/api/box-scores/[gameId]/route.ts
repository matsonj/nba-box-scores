import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { BoxScores, TeamStats, Schedule } from '@/types/schema';
import { generateSelectQuery, box_scoresColumns, team_statsColumns } from '@/lib/generated/sql-utils';

export const runtime = 'nodejs';

interface BoxScoreTeam {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  score: number;
  players: {
    playerId: string;
    playerName: string;
    minutes: string;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fgMade: number;
    fgAttempted: number;
    fg3Made: number;
    fg3Attempted: number;
    ftMade: number;
    ftAttempted: number;
    plusMinus: number;
    starter: boolean;
  }[];
}

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;

    // Get game info from schedule
    const gameInfo = await queryDb<Schedule>(
      'SELECT * FROM main.schedule WHERE game_id = $1',
      [gameId]
    );

    if (gameInfo.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get player stats using schema-based query
    const playerStats = await queryDb<BoxScores>(
      generateSelectQuery(
        'box_scores',
        box_scoresColumns,
        'WHERE game_id = $1 AND period = \'FullGame\' ORDER BY team_id, points DESC'
      ),
      [gameId]
    );

    // Get team stats using schema-based query
    const teamStats = await queryDb<TeamStats>(
      generateSelectQuery(
        'team_stats',
        team_statsColumns,
        'WHERE game_id = $1 AND period = \'FullGame\''
      ),
      [gameId]
    );

    // Create team lookup for home and away teams
    const homeTeam: BoxScoreTeam = {
      teamId: gameInfo[0].home_team_abbreviation,
      teamName: gameInfo[0].home_team_abbreviation,
      teamAbbreviation: gameInfo[0].home_team_abbreviation,
      score: 0,
      players: []
    };

    const awayTeam: BoxScoreTeam = {
      teamId: gameInfo[0].away_team_abbreviation,
      teamName: gameInfo[0].away_team_abbreviation,
      teamAbbreviation: gameInfo[0].away_team_abbreviation,
      score: 0,
      players: []
    };

    // Map team_id to home/away team
    const teamMap = new Map<string, BoxScoreTeam>();
    const homeTeamStat = teamStats.find(t => t.team_id === gameInfo[0].home_team_abbreviation);
    const awayTeamStat = teamStats.find(t => t.team_id === gameInfo[0].away_team_abbreviation);
    
    if (homeTeamStat) {
      homeTeam.score = homeTeamStat.points;
      teamMap.set(homeTeamStat.team_id, homeTeam);
    }
    
    if (awayTeamStat) {
      awayTeam.score = awayTeamStat.points;
      teamMap.set(awayTeamStat.team_id, awayTeam);
    }

    // Add players to their respective teams
    playerStats.forEach((player) => {
      const team = teamMap.get(player.team_id);
      if (team) {
        team.players.push({
          playerId: player.entity_id,
          playerName: player.player_name,
          minutes: player.minutes,
          points: player.points,
          rebounds: player.rebounds,
          assists: player.assists,
          steals: player.steals,
          blocks: player.blocks,
          turnovers: player.turnovers,
          fgMade: player.fg_made,
          fgAttempted: player.fg_attempted,
          fg3Made: player.fg3_made,
          fg3Attempted: player.fg3_attempted,
          ftMade: player.ft_made,
          ftAttempted: player.ft_attempted,
          plusMinus: player.plus_minus,
          starter: Boolean(player.starter)
        });
      }
    });

    // Convert teams map to array and return response
    const teams = [homeTeam, awayTeam];
    console.log('Final teams:', teams);
    return NextResponse.json({
      gameInfo: {
        game_id: gameInfo[0].game_id,
        game_date: new Date(gameInfo[0].game_date).toISOString(),
        home_team_abbreviation: gameInfo[0].home_team_abbreviation,
        away_team_abbreviation: gameInfo[0].away_team_abbreviation,
        home_team_score: Number(gameInfo[0].home_team_score),
        away_team_score: Number(gameInfo[0].away_team_score),
        status: gameInfo[0].status
      },
      teams: teams.map(team => ({
        ...team,
        score: Number(team.score),
        players: team.players.map(player => ({
          ...player,
          points: Number(player.points),
          rebounds: Number(player.rebounds),
          assists: Number(player.assists),
          steals: Number(player.steals),
          blocks: Number(player.blocks),
          turnovers: Number(player.turnovers),
          fgMade: Number(player.fgMade),
          fgAttempted: Number(player.fgAttempted),
          fg3Made: Number(player.fg3Made),
          fg3Attempted: Number(player.fg3Attempted),
          ftMade: Number(player.ftMade),
          ftAttempted: Number(player.ftAttempted),
          plusMinus: Number(player.plusMinus)
        }))
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
