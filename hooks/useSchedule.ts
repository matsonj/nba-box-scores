'use client';

import { queryDb } from '@/lib/db';
import { Schedule } from '@/types/schema';

export async function useSchedule() {
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
}

export async function useBoxScores() {
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
}
