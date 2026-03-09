'use client';

import { useCallback } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { Schedule, TeamStats } from '@/types/schema';
import { getNHLTeamName } from '@/lib/nhl/teams';
import { NHL_SOURCE_TABLES, NHL_TEMP_TABLES } from '@/constants/tables';
import { utcToLocalDate } from '@/lib/dateUtils';
import { buildSeasonWhereClause } from '@/lib/queryUtils';
import { buildPlayerIndex, buildGameScoresMap } from '@/lib/gameDataUtils';
import { GameDataFilters } from './useGameData';
import type { PlayerIndexEntry } from '@/lib/gameDataUtils';

const NHL_PLAYOFF_TYPES = ['Playoffs'];

// Track cache state per evaluateQuery instance — automatically invalidates
// when the MotherDuck connection drops and a new evaluateQuery is created.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EvalFn = (sql: string) => Promise<any>;
const cacheState = new WeakMap<EvalFn, { attached: boolean; seasonKey: string | null }>();

function getCache(evaluateQuery: EvalFn) {
  let state = cacheState.get(evaluateQuery);
  if (!state) {
    state = { attached: false, seasonKey: null };
    cacheState.set(evaluateQuery, state);
  }
  return state;
}

async function ensureNHLDatabase(evaluateQuery: EvalFn): Promise<void> {
  const cache = getCache(evaluateQuery);
  if (cache.attached) return;
  await evaluateQuery(`ATTACH IF NOT EXISTS 'md:nhl_box_scores'`);
  cache.attached = true;
}

async function ensureNHLTempTables(evaluateQuery: EvalFn, filters?: GameDataFilters): Promise<void> {
  await ensureNHLDatabase(evaluateQuery);

  const cache = getCache(evaluateQuery);
  const seasonKey = `${filters?.seasonYear ?? 'all'}-${filters?.seasonType ?? 'all'}`;
  if (cache.seasonKey === seasonKey) return;

  const whereClause = buildSeasonWhereClause(filters, undefined, NHL_PLAYOFF_TYPES);
  const joinWhereClause = buildSeasonWhereClause(filters, 's', NHL_PLAYOFF_TYPES);

  const queries = [
    `CREATE OR REPLACE TEMP TABLE ${NHL_TEMP_TABLES.SCHEDULE} AS
     SELECT * FROM ${NHL_SOURCE_TABLES.SCHEDULE}
     WHERE 1=1${whereClause}`,

    `CREATE OR REPLACE TEMP TABLE ${NHL_TEMP_TABLES.TEAM_STATS} AS
     SELECT t.* FROM ${NHL_SOURCE_TABLES.TEAM_STATS} t
     JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON t.game_id = s.game_id
     WHERE 1=1${joinWhereClause}`,

    `CREATE OR REPLACE TEMP TABLE ${NHL_TEMP_TABLES.SKATER_STATS} AS
     SELECT ss.* FROM ${NHL_SOURCE_TABLES.SKATER_STATS} ss
     JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON ss.game_id = s.game_id
     WHERE 1=1${joinWhereClause}`,

    `CREATE OR REPLACE TEMP TABLE ${NHL_TEMP_TABLES.GOALIE_STATS} AS
     SELECT g.* FROM ${NHL_SOURCE_TABLES.GOALIE_STATS} g
     JOIN ${NHL_SOURCE_TABLES.SCHEDULE} s ON g.game_id = s.game_id
     WHERE 1=1${joinWhereClause}`,
  ];

  await Promise.all(queries.map(query => evaluateQuery(query)));
  cache.seasonKey = seasonKey;
}

export function useNHLSchedule() {
  const { evaluateQuery } = useMotherDuckClientState();

  const fetchSchedule = useCallback(async (filters?: GameDataFilters) => {
    try {
      await ensureNHLTempTables(evaluateQuery, filters);
      const result = await evaluateQuery(`
        SELECT * FROM ${NHL_TEMP_TABLES.SCHEDULE}
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
      await ensureNHLTempTables(evaluateQuery, filters);

      const result = await evaluateQuery(`
        SELECT game_id, team_abbreviation, period, points
        FROM ${NHL_TEMP_TABLES.TEAM_STATS}
        WHERE period != 'FullGame'
        ORDER BY game_id, team_abbreviation, CAST(period AS INTEGER)
      `);
      const periodScores = result.data.toRows() as unknown as TeamStats[];

      const gameScores = buildGameScoresMap(periodScores);

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
      await ensureNHLTempTables(evaluateQuery, filters);

      const result = await evaluateQuery(`
        SELECT DISTINCT entity_id, player_name, team_abbreviation, game_id
        FROM ${NHL_TEMP_TABLES.SKATER_STATS}
        WHERE period = 'FullGame'
      `);
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
