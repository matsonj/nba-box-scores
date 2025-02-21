'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { TeamStats, Schedule, BoxScores } from '@/types/schema';
import { TEMP_TABLES } from '@/constants/tables';
import { useDataLoader } from '@/lib/dataLoader';
import { getTeamName } from '@/lib/teams';

export function useBoxScoreByGameId() {
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();

  const fetchBoxScore = useCallback(async (gameId: string) => {
  try {
    console.log(`Fetching box scores for game ${gameId}...`);

    // Combine all queries into a single query using WITH clauses for better performance
    const result = await evaluateQuery(`
      WITH game_info AS (
        SELECT * FROM ${TEMP_TABLES.SCHEDULE} WHERE game_id = '${gameId}'
      ),
      box_scores AS (
        SELECT * FROM ${TEMP_TABLES.BOX_SCORES} WHERE game_id = '${gameId}'
      ),
      team_stats AS (
        SELECT * FROM ${TEMP_TABLES.TEAM_STATS} WHERE game_id = '${gameId}'
      )
      SELECT 
        'game_info' as type, CAST(NULL as INTEGER) as row_num, * 
      FROM game_info
      UNION ALL
      SELECT 
        'box_scores' as type, ROW_NUMBER() OVER () as row_num, * 
      FROM box_scores
      UNION ALL
      SELECT 
        'team_stats' as type, ROW_NUMBER() OVER () as row_num, * 
      FROM team_stats
    `);

    const rows = result.data.toRows();
    
    // Separate the results
    const gameInfo = rows.filter(row => row.type === 'game_info') as unknown as Schedule[];
    const boxScoresData = rows.filter(row => row.type === 'box_scores') as unknown as BoxScores[];
    const teamStats = rows.filter(row => row.type === 'team_stats') as unknown as TeamStats[];

    // Check if game exists
    if (!gameInfo || gameInfo.length === 0) {
      throw new Error('Game not found');
    }

    // Create team lookup for home and away teams
    const homeTeam = {
      teamId: gameInfo[0].home_team_id.toString(),
      teamName: getTeamName(gameInfo[0].home_team_abbreviation),
      teamAbbreviation: gameInfo[0].home_team_abbreviation,
      score: teamStats.find(
        stat => stat.team_id.toString() === gameInfo[0].home_team_id.toString() && stat.period === 'FullGame'
      )?.points || 0,
      players: boxScoresData
        .filter(player => player.team_id.toString() === gameInfo[0].home_team_id.toString())
        .map(player => ({
          playerId: player.entity_id,
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
      teamId: gameInfo[0].away_team_id.toString(),
      teamName: getTeamName(gameInfo[0].away_team_abbreviation),
      teamAbbreviation: gameInfo[0].away_team_abbreviation,
      score: teamStats.find(
        stat => stat.team_id.toString() === gameInfo[0].away_team_id.toString() && stat.period === 'FullGame'
      )?.points || 0,
      players: boxScoresData
        .filter(player => player.team_id.toString() === gameInfo[0].away_team_id.toString())
        .map(player => ({
          playerId: player.entity_id,
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
