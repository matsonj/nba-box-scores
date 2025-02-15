'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchSchedule = useCallback(async () => {
    try {
      console.log('Fetching schedule from DuckDB...');
      const result = await evaluateQuery(`
        SELECT * FROM nba_box_scores.main.schedule 
        WHERE game_id NOT LIKE '006%'
      `);
      
      console.log('Schedule query result:', result);
      
      // Get the rows from the result
      const rows = result.data.toRows() as Schedule[];
      console.log('Schedule rows:', rows);
      
      // Transform the data to match the expected format
      return rows.map((game: Schedule) => ({
        game_id: game.game_id,
        game_date: game.game_date,
        home_team: game.home_team,
        away_team: game.away_team,
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        season: game.season,
        status: game.status
      }));
    } catch (error) {
      console.error('Error fetching schedule:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchSchedule };
}

export function useBoxScores() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchBoxScores = useCallback(async () => {
    try {
      console.log('Fetching box scores from DuckDB...');
      const result = await evaluateQuery(`
        SELECT game_id, team_id, period, points 
        FROM nba_box_scores.main.team_stats 
        WHERE period != 'FullGame'
        ORDER BY game_id, team_id, CAST(period AS INTEGER)
      `);
      
      console.log('Team stats query result:', result);
      
      // Get the rows from the result
      const periodScores = result.data.toRows() as TeamStats[];
      console.log('Period scores:', periodScores);
      
      // Group by game_id
      return (periodScores || []).reduce((acc, score) => {
        if (!acc[score.game_id]) {
          acc[score.game_id] = [];
        }
        acc[score.game_id].push({
          team_id: score.team_id,
          period: score.period,
          points: score.points
        });
        return acc;
      }, {} as Record<string, Array<{ team_id: string; period: string; points: number }>>);
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}
