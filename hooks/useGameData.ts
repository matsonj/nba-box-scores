'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { getTeamName } from '@/lib/teams';
import { SOURCE_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import { buildSeasonWhereClause } from '@/lib/queryUtils';
import { buildPlayerIndex, buildGameScoresMap } from '@/lib/gameDataUtils';
import type { SeasonType } from '@/lib/seasonUtils';

// Re-export shared types for backwards compatibility
export type { PlayerIndexEntry } from '@/lib/gameDataUtils';

export interface GameDataFilters {
  seasonYear?: number;
  seasonType?: SeasonType;
}

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchSchedule = useCallback(async (filters?: GameDataFilters) => {
    try {
      const whereClause = buildSeasonWhereClause(filters);
      const result = await evaluateQuery(`
        SELECT * FROM ${SOURCE_TABLES.SCHEDULE}
        WHERE 1=1${whereClause}
      `);

      const rows = result.data.toRows() as unknown as Schedule[];

      return rows.map((game: Schedule) => {
        const localDate = utcToLocalDate(game.game_date.toString());

        return {
          game_id: game.game_id,
          game_date: localDate,
          home_team: getTeamName(game.home_team_abbreviation),
          away_team: getTeamName(game.away_team_abbreviation),
          home_team_id: game.home_team_id,
          away_team_id: game.away_team_id,
          home_team_abbreviation: game.home_team_abbreviation,
          away_team_abbreviation: game.away_team_abbreviation,
          home_team_score: game.home_team_score,
          away_team_score: game.away_team_score,
          game_status: game.game_status,
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

  const fetchBoxScores = useCallback(async (filters?: GameDataFilters) => {
    try {
      // When filters are active, join with schedule to limit results
      let query: string;
      if (filters?.seasonYear || (filters?.seasonType && filters.seasonType !== 'all')) {
        const whereClause = buildSeasonWhereClause(filters, 's');
        query = `
          SELECT ts.game_id, ts.team_abbreviation, ts.period, ts.points
          FROM ${SOURCE_TABLES.TEAM_STATS} ts
          JOIN ${SOURCE_TABLES.SCHEDULE} s ON ts.game_id = s.game_id
          WHERE ts.period != 'FullGame'${whereClause}
          ORDER BY ts.game_id, ts.team_abbreviation, CAST(ts.period AS INTEGER)
        `;
      } else {
        query = `
          SELECT game_id, team_abbreviation, period, points
          FROM ${SOURCE_TABLES.TEAM_STATS}
          WHERE period != 'FullGame'
          ORDER BY game_id, team_abbreviation, CAST(period AS INTEGER)
        `;
      }

      const result = await evaluateQuery(query);
      const periodScores = result.data.toRows() as unknown as TeamStats[];

      const gameScores = buildGameScoresMap(periodScores);

      return Object.fromEntries(gameScores);
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}

export function usePlayerIndex() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchPlayerIndex = useCallback(async (filters?: GameDataFilters) => {
    try {
      let query: string;
      if (filters?.seasonYear || (filters?.seasonType && filters.seasonType !== 'all')) {
        const whereClause = buildSeasonWhereClause(filters, 's');
        query = `
          SELECT DISTINCT bs.entity_id, bs.player_name, bs.team_abbreviation, bs.game_id
          FROM ${SOURCE_TABLES.BOX_SCORES} bs
          JOIN ${SOURCE_TABLES.SCHEDULE} s ON bs.game_id = s.game_id
          WHERE bs.period = 'FullGame'${whereClause}
        `;
      } else {
        query = `
          SELECT DISTINCT entity_id, player_name, team_abbreviation, game_id
          FROM ${SOURCE_TABLES.BOX_SCORES}
          WHERE period = 'FullGame'
        `;
      }

      const result = await evaluateQuery(query);
      const rows = result.data.toRows() as unknown as {
        entity_id: string;
        player_name: string;
        team_abbreviation: string;
        game_id: string;
      }[];

      return buildPlayerIndex(rows);
    } catch (error) {
      console.error('Error fetching player index:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchPlayerIndex };
}
