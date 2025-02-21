'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { debugLog } from '@/lib/debug';
import { getTeamName } from '@/lib/teams';
import { TEMP_TABLES } from '@/constants/tables';
import { useDataLoader } from '@/lib/dataLoader';

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
        // Convert UTC date string to local time
        const utcDate = new Date(game.game_date + 'Z'); // Append Z to ensure UTC parsing
        const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
        
        return {
          game_id: game.game_id,
          game_date: localDate.toISOString().slice(0, 19).replace('T', ' '), // Format as YYYY-MM-DD HH:mm:ss
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
      
      // First, group scores by game_id
      const gameScores = periodScores.reduce((acc, score) => {
        if (!acc[score.game_id]) {
          acc[score.game_id] = [];
        }
        acc[score.game_id].push({
          teamId: score.team_id,
          period: score.period,
          points: score.points
        });
        return acc;
      }, {} as Record<string, Array<{ teamId: string; period: string; points: number }>>);

      debugLog('period_scores_grouped', gameScores);
      return gameScores;
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
