import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { TeamStats, Schedule } from '@/types/schema';
import { generateSelectQuery, box_scoresColumns, team_statsColumns } from '@/lib/generated/sql-utils';

interface BoxScores {
  game_id: string;
  team_id: string;
  player_id: string;
  player_name: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
  plus_minus: number;
  starter: boolean;
  period: string;
}

interface BoxScoreTeam {
  teamId: number;
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
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    plusMinus: number;
    starter: boolean;
  }[];
  periodScores: Record<string, number>;
}

export const runtime = 'nodejs';

// Helper function to convert abbreviations to full team names
function getTeamName(abbreviation: string): string {
  const teamNames: Record<string, string> = {
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',
    'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',
    'IND': 'Indiana Pacers',
    'LAC': 'Los Angeles Clippers',
    'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',
    'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',
    'NYK': 'New York Knicks',
    'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',
    'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',
    'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',
    'WAS': 'Washington Wizards'
  };
  return teamNames[abbreviation] || abbreviation;
}

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params;

    console.log(`Fetching box scores for game ${gameId}...`);

    // Get all data in parallel
    const [gameInfo, boxScoresData, teamStats] = await Promise.all([
      // Game info query
      queryDb<Schedule>(
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
      ),
      // Box scores query with optimized starter detection
      queryDb<BoxScores>(
        `SELECT 
          bs.*,
          COALESCE(bs_starters.starter, 0) as starter
        FROM main.box_scores bs
        LEFT JOIN (
          SELECT entity_id, 1 as starter
          FROM main.box_scores
          WHERE game_id = ? AND period = '1'
          GROUP BY entity_id
          HAVING MAX(CASE WHEN starter = 1 THEN 1 ELSE 0 END) = 1
        ) bs_starters ON bs.entity_id = bs_starters.entity_id
        WHERE bs.game_id = ? AND bs.period = 'FullGame'
        ORDER BY bs.minutes DESC`,
        [gameId, gameId]
      ),
      // Team stats query
      queryDb<TeamStats>(
        `SELECT team_id, period, points 
         FROM main.team_stats 
         WHERE game_id = ? AND period != 'FullGame'
         ORDER BY team_id, CAST(period AS INTEGER)`,
        [gameId]
      )
    ]);

    if (gameInfo.length === 0) {
      console.log('Game not found in schedule');
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    console.log('Game info:', gameInfo[0]);

    // Get box scores
    console.log('Team stats:', teamStats);

    console.log('Box scores sample:', boxScoresData[0]);
    console.log('Team IDs from box scores:', [...new Set(boxScoresData.map(p => p.team_id))]);
    console.log('Home team ID from schedule:', gameInfo[0].home_team_id);
    console.log('Away team ID from schedule:', gameInfo[0].away_team_id);
    console.log('Home team abbreviation:', gameInfo[0].home_team_abbreviation);
    console.log('Away team abbreviation:', gameInfo[0].away_team_abbreviation);

    // Create team lookup for home and away teams
    const homeTeam: BoxScoreTeam = {
      teamId: Number(gameInfo[0].home_team_id),
      teamName: getTeamName(gameInfo[0].home_team_abbreviation),
      teamAbbreviation: gameInfo[0].home_team_abbreviation,
      score: Number(gameInfo[0].home_team_score),
      players: []
    };

    const awayTeam: BoxScoreTeam = {
      teamId: Number(gameInfo[0].away_team_id),
      teamName: getTeamName(gameInfo[0].away_team_abbreviation),
      teamAbbreviation: gameInfo[0].away_team_abbreviation,
      score: Number(gameInfo[0].away_team_score),
      players: []
    };

    // Map team_id to home/away team
    const teamMap = new Map<number, BoxScoreTeam>();
    
    // Get box scores team IDs
    const boxScoreTeamIds = [...new Set(boxScoresData.map(p => p.team_id))];
    console.log('Box score team IDs:', boxScoreTeamIds);
    console.log('Home team ID:', gameInfo[0].home_team_id);
    console.log('Away team ID:', gameInfo[0].away_team_id);

    // Map teams based on team IDs
    teamMap.set(Number(gameInfo[0].home_team_id), homeTeam);
    teamMap.set(Number(gameInfo[0].away_team_id), awayTeam);

    // Add players to their respective teams
    boxScoresData.forEach((player) => {
      console.log('Processing player:', {
        name: player.player_name,
        team: player.team_id,
        minutes: player.minutes,
        points: player.points
      });
      const team = teamMap.get(Number(player.team_id));
      console.log('Found team:', team?.teamId);
      if (team) {
        team.players.push({
          playerId: player.player_id,
          playerName: player.player_name,
          minutes: player.minutes,
          points: Number(player.points),
          rebounds: Number(player.rebounds),
          assists: Number(player.assists),
          steals: Number(player.steals),
          blocks: Number(player.blocks),
          turnovers: Number(player.turnovers),
          fieldGoalsMade: Number(player.fg_made),
          fieldGoalsAttempted: Number(player.fg_attempted),
          threePointersMade: Number(player.fg3_made),
          threePointersAttempted: Number(player.fg3_attempted),
          freeThrowsMade: Number(player.ft_made),
          freeThrowsAttempted: Number(player.ft_attempted),
          plusMinus: Number(player.plus_minus),
          starter: Boolean(player.starter)
        });
        console.log('Added player to team. Team now has', team.players.length, 'players');
      } else {
        console.log('No team found for player', player.player_name, 'with team ID', player.team_id);
      }
    });

    // Map team IDs to period scores
    const periodScores = teamStats.map(periodScore => ({
      teamId: Number(periodScore.team_id),
      period: periodScore.period,
      points: Number(periodScore.points)
    }));

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
          fieldGoalsMade: Number(player.fieldGoalsMade),
          fieldGoalsAttempted: Number(player.fieldGoalsAttempted),
          threePointersMade: Number(player.threePointersMade),
          threePointersAttempted: Number(player.threePointersAttempted),
          freeThrowsMade: Number(player.freeThrowsMade),
          freeThrowsAttempted: Number(player.freeThrowsAttempted),
          plusMinus: Number(player.plusMinus),
          starter: player.starter
        }))
      })),
      periodScores: periodScores
    };

    console.log('API Response:', {
      gameInfo: response.gameInfo,
      teams: response.teams.map(t => ({
        teamId: t.teamId,
        playerCount: t.players.length
      })),
      periodScores: response.periodScores
    });
    
    console.log('Sending response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in box scores API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
