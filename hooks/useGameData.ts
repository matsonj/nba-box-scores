'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { debugLog } from '@/lib/debug';

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchSchedule = useCallback(async () => {
    try {
      console.log('Fetching schedule from DuckDB...');
      const result = await evaluateQuery(`
        SELECT * FROM nba_box_scores.main.schedule 
        WHERE game_id NOT LIKE '006%'
      `);
      
      // Get the rows from the result
      const rows = result.data.toRows() as Schedule[];
      debugLog('schedule_rows', rows);
      
      // Transform the data to match the expected format
      return rows.map((game: Schedule) => ({
        game_id: game.game_id,
        game_date: game.game_date,
        home_team: game.home_team,
        away_team: game.away_team,
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        home_team_abbreviation: game.home_team_abbreviation,
        away_team_abbreviation: game.away_team_abbreviation,
        home_team_score: game.home_team_score,
        away_team_score: game.away_team_score,
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
      
      // Get the rows from the result
      const periodScores = result.data.toRows() as TeamStats[];
      debugLog('period_scores_raw', periodScores);
      
      // First, group scores by game_id
      const gameScores = (periodScores || []).reduce((acc, score) => {
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
