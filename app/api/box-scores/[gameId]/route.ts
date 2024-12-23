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
    const { gameId } = await params;

    // Get game info from schedule
    const gameInfo = await queryDb<Schedule>(
      `SELECT 
        game_id,
        game_date,
        CAST(home_team_id AS INTEGER) as home_team_id,
        CAST(away_team_id AS INTEGER) as away_team_id,
        home_team_abbreviation,
        away_team_abbreviation,
        CAST(home_team_score AS INTEGER) as home_team_score,
        CAST(away_team_score AS INTEGER) as away_team_score,
        status,
        created_at
      FROM main.schedule WHERE game_id = ?`, 
      [gameId]
    );

    if (gameInfo.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get box scores
    const boxScores = await queryDb<BoxScores>(
      `SELECT DISTINCT team_id FROM main.box_scores WHERE game_id = ?`,
      [gameId]
    );
    console.log('Distinct team IDs:', boxScores);

    const boxScoresData = await queryDb<BoxScores>(
      `SELECT * FROM main.box_scores WHERE game_id = ?`,
      [gameId]
    );

    console.log('Box scores sample:', boxScoresData[0]);
    console.log('Team IDs from box scores:', [...new Set(boxScoresData.map(p => p.team_id))]);
    console.log('Home team ID from schedule:', gameInfo[0].home_team_id);
    console.log('Away team ID from schedule:', gameInfo[0].away_team_id);
    console.log('Home team abbreviation:', gameInfo[0].home_team_abbreviation);
    console.log('Away team abbreviation:', gameInfo[0].away_team_abbreviation);

    // Get team stats using schema-based query
    const teamStats = await queryDb<TeamStats>(
      `SELECT * FROM main.team_stats WHERE game_id = ? AND period = 'FullGame'`,
      [gameId]
    );

    console.log('Team stats:', teamStats);
    console.log('Box scores team IDs:', [...new Set(boxScoresData.map(p => p.team_id))]);
    console.log('Looking for home team:', gameInfo[0].home_team_abbreviation);
    console.log('Looking for away team:', gameInfo[0].away_team_abbreviation);

    // Create team lookup for home and away teams
    const homeTeam: BoxScoreTeam = {
      teamId: String(gameInfo[0].home_team_id),
      teamName: gameInfo[0].home_team_abbreviation,
      teamAbbreviation: gameInfo[0].home_team_abbreviation,
      score: Number(gameInfo[0].home_team_score),
      players: []
    };

    const awayTeam: BoxScoreTeam = {
      teamId: String(gameInfo[0].away_team_id),
      teamName: gameInfo[0].away_team_abbreviation,
      teamAbbreviation: gameInfo[0].away_team_abbreviation,
      score: Number(gameInfo[0].away_team_score),
      players: []
    };

    // Map team_id to home/away team
    const teamMap = new Map<string, BoxScoreTeam>();
    
    // Get box scores team IDs
    const boxScoreTeamIds = [...new Set(boxScoresData.map(p => p.team_id))];
    console.log('Box score team IDs:', boxScoreTeamIds);
    console.log('Home team ID:', String(gameInfo[0].home_team_id));
    console.log('Away team ID:', String(gameInfo[0].away_team_id));

    // Map teams based on team IDs
    teamMap.set(String(gameInfo[0].home_team_id), homeTeam);
    teamMap.set(String(gameInfo[0].away_team_id), awayTeam);

    // Add players to their respective teams
    boxScoresData.forEach((player) => {
      console.log('Processing player:', {
        name: player.player_name,
        team: player.team_id,
        minutes: player.minutes,
        points: player.points
      });
      const team = teamMap.get(player.team_id);
      console.log('Found team:', team?.teamId);
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
        console.log('Added player to team. Team now has', team.players.length, 'players');
      } else {
        console.log('No team found for player', player.player_name, 'with team ID', player.team_id);
      }
    });

    // Convert teams map to array and return response
    const teams = [homeTeam, awayTeam];
    console.log('Final teams with players:', teams.map(t => ({
      teamId: t.teamId,
      playerCount: t.players.length,
      samplePlayers: t.players.slice(0, 2)
    })));

    const response = {
      gameInfo: {
        game_id: gameInfo[0].game_id,
        game_date: gameInfo[0].game_date,
        home_team_id: Number(gameInfo[0].home_team_id),
        away_team_id: Number(gameInfo[0].away_team_id),
        home_team_abbreviation: gameInfo[0].home_team_abbreviation,
        away_team_abbreviation: gameInfo[0].away_team_abbreviation,
        home_team_score: Number(gameInfo[0].home_team_score),
        away_team_score: Number(gameInfo[0].away_team_score),
        status: gameInfo[0].status,
        created_at: gameInfo[0].created_at
      },
      teams: teams.map(team => ({
        teamId: team.teamId,
        teamName: team.teamName,
        teamAbbreviation: team.teamAbbreviation,
        score: Number(team.score),
        players: team.players.map(player => ({
          playerId: player.playerId,
          playerName: player.playerName,
          minutes: player.minutes,
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
          plusMinus: Number(player.plusMinus),
          starter: Boolean(player.starter)
        }))
      }))
    };

    console.log('API Response:', {
      gameInfo: response.gameInfo,
      teams: response.teams.map(t => ({
        teamId: t.teamId,
        playerCount: t.players.length
      }))
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
