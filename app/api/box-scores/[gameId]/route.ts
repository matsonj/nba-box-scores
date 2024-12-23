import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { BoxScores, TeamStats } from '@/types/schema';
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

    // Group players by team
    const teams = new Map<string, BoxScoreTeam>();
    playerStats.forEach((player) => {
      if (!teams.has(player.team_id)) {
        const teamStat = teamStats.find(t => t.team_id === player.team_id);
        teams.set(player.team_id, {
          teamId: player.team_id,
          teamName: player.team_id,
          teamAbbreviation: player.team_id,
          score: teamStat?.points || 0,
          players: []
        });
      }

      const team = teams.get(player.team_id)!;
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
        starter: player.starter === 1
      });
    });

    // Convert teams map to array and return response
    return NextResponse.json(Array.from(teams.values()));

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
