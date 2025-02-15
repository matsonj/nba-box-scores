'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { TeamStats, Schedule, BoxScore } from '@/types/schema';

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

function getTeamName(abbreviation: string): string {
  return teamNames[abbreviation] || abbreviation;
}

export function useBoxScoreByGameId() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchBoxScore = useCallback(async (gameId: string) => {
  try {
    console.log(`Fetching box scores for game ${gameId}...`);

    // Get all data in parallel
    console.log('Starting parallel queries...');
    const [gameInfo, boxScoresData, teamStats] = await Promise.all([
      // Game info query
      evaluateQuery(
        `SELECT * FROM nba_box_scores.main.schedule WHERE game_id = '${gameId}'`
      ).then(result => result.data.toRows() as Schedule[]),
      // Box scores query with optimized starter detection
      evaluateQuery(
        `SELECT * FROM nba_box_scores.main.box_scores WHERE game_id = '${gameId}' AND period = 'FullGame'`
      ).then(result => result.data.toRows() as BoxScore[]),
      // Team stats query
      evaluateQuery(
        `SELECT * FROM nba_box_scores.main.team_stats WHERE game_id = '${gameId}'`
      ).then(result => result.data.toRows() as TeamStats[])
    ]);

    // Check if game exists
    if (!gameInfo || gameInfo.length === 0) {
      throw new Error('Game not found');
    }

    // Create team lookup for home and away teams
    const homeTeam = {
      teamId: Number(gameInfo[0].home_team_id),
      teamName: getTeamName(gameInfo[0].home_team_abbreviation),
      teamAbbreviation: gameInfo[0].home_team_abbreviation,
      score: teamStats.find(
        stat => stat.team_id === gameInfo[0].home_team_id && stat.period === 'FullGame'
      )?.points || 0,
      players: boxScoresData
        .filter(player => player.team_id === gameInfo[0].home_team_id)
        .map(player => ({
          playerId: player.player_id,
          playerName: player.player_name,
          minutes: player.minutes,
          points: player.points,
          rebounds: player.rebounds,
          assists: player.assists,
          steals: player.steals,
          blocks: player.blocks,
          turnovers: player.turnovers,
          fieldGoalsMade: player.fg_made,
          fieldGoalsAttempted: player.fg_attempted,
          threePointersMade: player.fg3_made,
          threePointersAttempted: player.fg3_attempted,
          freeThrowsMade: player.ft_made,
          freeThrowsAttempted: player.ft_attempted,
          plusMinus: player.plus_minus,
          starter: player.starter
        }))
    };

    const awayTeam = {
      teamId: Number(gameInfo[0].away_team_id),
      teamName: getTeamName(gameInfo[0].away_team_abbreviation),
      teamAbbreviation: gameInfo[0].away_team_abbreviation,
      score: teamStats.find(
        stat => stat.team_id === gameInfo[0].away_team_id && stat.period === 'FullGame'
      )?.points || 0,
      players: boxScoresData
        .filter(player => player.team_id === gameInfo[0].away_team_id)
        .map(player => ({
          playerId: player.player_id,
          playerName: player.player_name,
          minutes: player.minutes,
          points: player.points,
          rebounds: player.rebounds,
          assists: player.assists,
          steals: player.steals,
          blocks: player.blocks,
          turnovers: player.turnovers,
          fieldGoalsMade: player.fg_made,
          fieldGoalsAttempted: player.fg_attempted,
          threePointersMade: player.fg3_made,
          threePointersAttempted: player.fg3_attempted,
          freeThrowsMade: player.ft_made,
          freeThrowsAttempted: player.ft_attempted,
          plusMinus: player.plus_minus,
          starter: player.starter
        }))
    };

    // Get period scores
    console.log('Raw team stats:', teamStats);
    const periodScores = teamStats
      .filter(stat => stat.period !== 'FullGame')
      .map(stat => {
        const score = {
          period: stat.period,
          teamId: stat.team_id,
          points: stat.points
        };
        console.log('Created period score:', score);
        return score;
      });

    return {
      gameInfo: gameInfo[0],
      teams: [homeTeam, awayTeam],
      periodScores
    };
  } catch (error) {
    console.error('Failed to fetch box score:', error);
    throw error;
  }
}, [evaluateQuery]);

  return { fetchBoxScore };
}
