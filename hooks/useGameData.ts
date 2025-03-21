'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { getTeamName } from '@/lib/teams';
import { TEMP_TABLES, SOURCE_TABLES } from '@/constants/tables';
import { useDataLoader } from '@/lib/dataLoader';
import { utcToLocalDate } from '@/lib/dateUtils';

const fetcher = (url: string): Promise<any> => fetch(url).then(res => res.json());

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();

  const fetchSchedule = useCallback(async () => {
    try {
      // Ensure essential data is loaded into temp tables
      await dataLoader.loadEssentialTables();

      const result = await evaluateQuery(`
        SELECT * FROM nba_box_scores.main.schedule
      `);
      
      const rows = result.data.toRows() as unknown as Schedule[];
      
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
      // Ensure essential data is loaded into temp tables
      await dataLoader.loadEssentialTables();

      const result = await evaluateQuery(`
        SELECT game_id, team_id, period, points 
        FROM nba_box_scores.main.team_stats 
        WHERE period != 'FullGame'
        ORDER BY game_id, team_id, CAST(period AS INTEGER)
      `);
      
      const periodScores = result.data.toRows() as unknown as TeamStats[];
      
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
          teamId: score.team_id, // Already an abbreviation
          period: score.period,
          points: Number(score.points) // Ensure points is converted to a number
        });

      }

      // Convert Map back to object for compatibility
      const gameScoresObj = Object.fromEntries(gameScores);


      return gameScoresObj;
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}

const fetchSchedule = async (query: string): Promise<any> => {
  // TODO: Implement schedule fetching using MotherDuck Wasm Client
  return {};
};
