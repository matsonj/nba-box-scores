'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { debugLog } from '@/lib/debug';
import { getTeamName } from '@/lib/teams';
import { TEMP_TABLES } from '@/constants/tables';
import { useDataLoader } from '@/lib/dataLoader';
import { utcToLocalDate } from '@/lib/dateUtils';

const fetcher = (url: string): Promise<any> => fetch(url).then(res => res.json());

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();

  const fetchSchedule = useCallback(async () => {
    try {
      // Ensure data is loaded into temp tables
      await dataLoader.loadData();

      console.log('Fetching schedule from temp tables...');
      const result = await evaluateQuery(`
        SELECT * FROM ${TEMP_TABLES.SCHEDULE}
      `);
      
      const rows = result.data.toRows() as unknown as Schedule[];
      debugLog('schedule_rows', rows);
      
      // Convert UTC dates to local time and transform the data
      return rows.map((game: Schedule) => {
        const localDate = utcToLocalDate(game.game_date.toString());
        
        return {
          game_id: game.game_id,
          game_date: localDate, // Return the Date object directly
          home_team: getTeamName(game.home_team_abbreviation),
          away_team: getTeamName(game.away_team_abbreviation),
          home_team_id: game.home_team_id,
          away_team_id: game.away_team_id,
          home_team_abbreviation: game.home_team_abbreviation,
          away_team_abbreviation: game.away_team_abbreviation,
          home_team_score: game.home_team_score,
          away_team_score: game.away_team_score,
          status: game.status,
          created_at: game.created_at
        };
      });
    } catch (error) {
      console.error('Error fetching schedule:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchSchedule };
}

export function useBoxScores() {
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();

  const fetchBoxScores = useCallback(async () => {
    try {
      // Ensure data is loaded into temp tables
      await dataLoader.loadData();

      console.log('Fetching box scores from temp tables...');
      const result = await evaluateQuery(`
        SELECT game_id, team_id, period, points 
        FROM ${TEMP_TABLES.TEAM_STATS} 
        WHERE period != 'FullGame'
        ORDER BY game_id, team_id, CAST(period AS INTEGER)
      `);
      
      const periodScores = result.data.toRows() as unknown as TeamStats[];
      debugLog('period_scores_raw', periodScores);
      
      // Use Map for better performance with object keys
      const gameScores = new Map<string, Array<{ teamId: string; period: string; points: number }>>();
      
      // Pre-allocate arrays for known games to avoid resizing
      const uniqueGameIds = new Set(periodScores.map(score => score.game_id));
      uniqueGameIds.forEach(gameId => {
        gameScores.set(gameId, []);
      });

      // Populate scores
      for (const score of periodScores) {
        const scores = gameScores.get(score.game_id)!;
        scores.push({
          teamId: score.team_id,
          period: score.period,
          points: score.points
        });
      }

      // Convert Map back to object for compatibility
      const gameScoresObj = Object.fromEntries(gameScores);

      debugLog('period_scores_grouped', gameScoresObj);
      return gameScoresObj;
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}

const fetchSchedule = async (query: string): Promise<any> => {
  // TODO: Implement schedule fetching using MotherDuck WASM Client
  return {};
};
