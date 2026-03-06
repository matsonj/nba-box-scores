'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { getNHLTeamName } from '@/lib/nhl/teams';
import { NHL_SOURCE_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import type { SeasonType } from '@/lib/seasonUtils';
import { GameDataFilters, PlayerIndexEntry } from './useGameData';

// Module-level flag to ensure we only ATTACH once per session
let nhlDatabaseAttached = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureNHLDatabase(evaluateQuery: (sql: string) => Promise<any>): Promise<void> {
  if (nhlDatabaseAttached) return;
  await evaluateQuery(`ATTACH IF NOT EXISTS 'md:nhl_box_scores'`);
  nhlDatabaseAttached = true;
}

function buildNHLSeasonWhereClause(filters?: GameDataFilters, alias?: string): string {
  const clauses: string[] = [];
  const prefix = alias ? `${alias}.` : '';

  if (filters?.seasonYear) {
    clauses.push(`${prefix}season_year = ${filters.seasonYear}`);
  }

  if (filters?.seasonType && filters.seasonType !== 'all') {
    if (filters.seasonType === 'regular') {
      clauses.push(`${prefix}season_type = 'Regular Season'`);
    } else if (filters.seasonType === 'playoffs') {
      clauses.push(`${prefix}season_type = 'Playoffs'`);
    }
  }

  return clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '';
}

/** Builds a player search index from flat (player, game_id) rows, grouped client-side. */
function buildPlayerIndex(rows: Array<{ entity_id: string; player_name: string; team_abbreviation: string; game_id: string }>): PlayerIndexEntry[] {
  const map = new Map<string, PlayerIndexEntry>();
  for (const r of rows) {
    const key = `${r.entity_id}|${r.team_abbreviation}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        entity_id: String(r.entity_id),
        player_name: String(r.player_name),
        team_abbreviation: String(r.team_abbreviation),
        game_ids: [],
      };
      map.set(key, entry);
    }
    entry.game_ids.push(String(r.game_id));
  }
  return Array.from(map.values());
}

export function useNHLSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchSchedule = useCallback(async (filters?: GameDataFilters) => {
    try {
      await ensureNHLDatabase(evaluateQuery);
      const whereClause = buildNHLSeasonWhereClause(filters);
      const result = await evaluateQuery(`
        SELECT * FROM ${NHL_SOURCE_TABLES.SCHEDULE}
        WHERE 1=1${whereClause}
      `);

      const rows = result.data.toRows() as unknown as Schedule[];

      return rows.map((game: Schedule) => {
        const localDate = utcToLocalDate(game.game_date.toString());

        return {
          game_id: game.game_id,
          game_date: localDate,
          home_team: getNHLTeamName(game.home_team_abbreviation),
          away_team: getNHLTeamName(game.away_team_abbreviation),
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
      console.error('Error fetching NHL schedule:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchSchedule };
}

export function useNHLBoxScores() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchBoxScores = useCallback(async (filters?: GameDataFilters) => {
    try {
      await ensureNHLDatabase(evaluateQuery);

      // When filters are active, join with schedule to limit results
      let query: string;
      if (filters?.seasonYear || (filters?.seasonType && filters.seasonType !== 'all')) {
        const whereClause = buildNHLSeasonWhereClause(filters, 's');
        query = `
          SELECT ts.game_id, ts.team_abbreviation, ts.period, ts.points
          FROM ${NHL_SOURCE_TABLES.TEAM_STATS} ts
          JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON ts.game_id = s.game_id
          WHERE ts.period != 'FullGame'${whereClause}
          ORDER BY ts.game_id, ts.team_abbreviation, CAST(ts.period AS INTEGER)
        `;
      } else {
        query = `
          SELECT game_id, team_abbreviation, period, points
          FROM ${NHL_SOURCE_TABLES.TEAM_STATS}
          WHERE period != 'FullGame'
          ORDER BY game_id, team_abbreviation, CAST(period AS INTEGER)
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
          teamId: score.team_abbreviation,
          period: score.period,
          points: Number(score.points)
        });
      }

      return Object.fromEntries(gameScores);
    } catch (error) {
      console.error('Error fetching NHL box scores:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchBoxScores };
}

export function useNHLPlayerIndex() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchPlayerIndex = useCallback(async (filters?: GameDataFilters): Promise<PlayerIndexEntry[]> => {
    try {
      await ensureNHLDatabase(evaluateQuery);

      let query: string;
      if (filters?.seasonYear || (filters?.seasonType && filters.seasonType !== 'all')) {
        const whereClause = buildNHLSeasonWhereClause(filters, 's');
        query = `
          SELECT DISTINCT ss.entity_id, ss.player_name, ss.team_abbreviation, ss.game_id
          FROM ${NHL_SOURCE_TABLES.SKATER_STATS} ss
          JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON ss.game_id = s.game_id
          WHERE ss.period = 'FullGame'${whereClause}
        `;
      } else {
        query = `
          SELECT DISTINCT entity_id, player_name, team_abbreviation, game_id
          FROM ${NHL_SOURCE_TABLES.SKATER_STATS}
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
      console.error('Error fetching NHL player index:', error);
      throw error;
    }
  }, [evaluateQuery]);

  return { fetchPlayerIndex };
}
