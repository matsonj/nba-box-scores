'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { getTeamName } from '@/lib/teams';
import { TEMP_TABLES, SOURCE_TABLES } from '@/constants/tables';
import { useDataLoader } from '@/lib/dataLoader';
import { utcToLocalDate } from '@/lib/dateUtils';
import { GAME_ID_PREFIXES } from '@/constants/game';
import { escapeSqlString } from '@/lib/queryUtils';
import type { SeasonType } from '@/lib/seasonUtils';

export interface GameDataFilters {
  seasonYear?: number;
  seasonType?: SeasonType;
}

function buildSeasonWhereClause(filters?: GameDataFilters, alias?: string): string {
  const clauses: string[] = [];
  const prefix = alias ? `${alias}.` : '';

  if (filters?.seasonYear) {
    // NBA season: Oct of seasonYear through Jun of seasonYear+1
    const startDate = `${filters.seasonYear}-10-01`;
    const endDate = `${filters.seasonYear + 1}-09-30`;
    clauses.push(`${prefix}game_date >= '${startDate}' AND ${prefix}game_date <= '${endDate}'`);
  }

  if (filters?.seasonType && filters.seasonType !== 'all') {
    if (filters.seasonType === 'regular') {
      clauses.push(`${prefix}game_id LIKE '${GAME_ID_PREFIXES.REGULAR_SEASON}%'`);
    } else if (filters.seasonType === 'playoffs') {
      clauses.push(`(${prefix}game_id LIKE '${GAME_ID_PREFIXES.PLAYOFFS}%' OR ${prefix}game_id LIKE '${GAME_ID_PREFIXES.PLAY_IN}%')`);
    }
  }

  return clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '';
}

export function useSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();

  const fetchSchedule = useCallback(async (filters?: GameDataFilters) => {
    try {
      await dataLoader.loadEssentialTables();

      const whereClause = buildSeasonWhereClause(filters);
      const result = await evaluateQuery(`
        SELECT * FROM nba_box_scores.main.schedule
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

  const fetchBoxScores = useCallback(async (filters?: GameDataFilters) => {
    try {
      await dataLoader.loadEssentialTables();

      // When filters are active, join with schedule to limit results
      let query: string;
      if (filters?.seasonYear || (filters?.seasonType && filters.seasonType !== 'all')) {
        const whereClause = buildSeasonWhereClause(filters, 's');
        query = `
          SELECT ts.game_id, ts.team_id, ts.period, ts.points
          FROM nba_box_scores.main.team_stats ts
          JOIN nba_box_scores.main.schedule s ON ts.game_id = s.game_id
          WHERE ts.period != 'FullGame'${whereClause}
          ORDER BY ts.game_id, ts.team_id, CAST(ts.period AS INTEGER)
        `;
      } else {
        query = `
          SELECT game_id, team_id, period, points
          FROM nba_box_scores.main.team_stats
          WHERE period != 'FullGame'
          ORDER BY game_id, team_id, CAST(period AS INTEGER)
        `;
      }

      const result = await evaluateQuery(query);
      const periodScores = result.data.toRows() as unknown as TeamStats[];

      const gameScores = new Map<string, Array<{ teamId: string; period: string; points: number }>>();

      const uniqueGameIds = new Set(periodScores.map(score => score.game_id));
      uniqueGameIds.forEach(gameId => {
        gameScores.set(gameId, []);
      });

      for (const score of periodScores) {
        const scores = gameScores.get(score.game_id)!;
        scores.push({
          teamId: score.team_id,
          period: score.period,
          points: Number(score.points)
        });
      }

      return Object.fromEntries(gameScores);
    } catch (error) {
      console.error('Error fetching box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}

export function usePlayerSearch() {
  const { evaluateQuery } = useMotherDuckClientState();

  const searchPlayerGameIds = useCallback(async (playerName: string): Promise<Set<string>> => {
    if (!playerName.trim()) return new Set();

    const escaped = escapeSqlString(playerName.trim());
    const result = await evaluateQuery(`
      SELECT DISTINCT game_id
      FROM ${SOURCE_TABLES.BOX_SCORES}
      WHERE LOWER(player_name) LIKE LOWER('%${escaped}%')
        AND period = 'FullGame'
    `);

    const rows = result.data.toRows() as unknown as { game_id: string }[];
    return new Set(rows.map(r => r.game_id));
  }, [evaluateQuery]);

  return { searchPlayerGameIds };
}
