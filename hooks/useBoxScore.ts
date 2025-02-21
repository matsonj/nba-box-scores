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
    // Ensure data is loaded into temp tables
    await dataLoader.loadData();
    
    console.log(`Fetching box scores for game ${gameId}...`);

    // Get all data in parallel from temp tables
    console.log('Starting parallel queries...');
    const [gameInfo, boxScoresData, teamStats] = await Promise.all([
      // Game info query
      evaluateQuery(
        `SELECT * FROM ${TEMP_TABLES.SCHEDULE} WHERE game_id = '${gameId}'`
      ).then(result => result.data.toRows() as unknown as Schedule[]),
      // Box scores query with optimized starter detection
      evaluateQuery(
        `SELECT * FROM ${TEMP_TABLES.BOX_SCORES} WHERE game_id = '${gameId}'`
      ).then(result => result.data.toRows() as unknown as BoxScores[]),
      // Team stats query
      evaluateQuery(
        `SELECT * FROM ${TEMP_TABLES.TEAM_STATS} WHERE game_id = '${gameId}'`
      ).then(result => result.data.toRows() as unknown as TeamStats[])
    ]);

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
