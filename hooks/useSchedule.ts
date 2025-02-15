'use client';

import { useQueryDb } from '@/lib/db';
import { Schedule } from '@/types/schema';

export function useSchedule() {
  const queryDb = useQueryDb();

  const fetchSchedule = async () => {
    try {
      console.log('Fetching schedule from DuckDB...');
      const result = await queryDb<Schedule>(`
        SELECT * FROM nba_box_scores.main.schedule 
        WHERE game_id NOT LIKE '006%'
      `);
      
      console.log('Total games:', result.length);
      return result;
    } catch (error) {
      console.error('Error fetching schedule:', error);
      throw error;
    }
  };

  return { fetchSchedule };
}

export function useBoxScores() {
  const queryDb = useQueryDb();

  const fetchBoxScores = async () => {
    try {
      console.log('Fetching box scores from DuckDB...');
      const result = await queryDb(`
        SELECT 
          game_id,
          period,
          team_id,
          pts
        FROM nba_box_scores.main.team_stats
      WHERE period != 'Final'
      ORDER BY game_id, period, team_id
    `);
    
    console.log('Total box scores:', result.length);
    return result;
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  };

  return { fetchBoxScores };
}
