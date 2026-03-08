'use client';

import { useMotherDuckClientState } from './MotherDuckContext';
import { SOURCE_TABLES, TEMP_TABLES } from '@/constants/tables';
import { createDynamicTableStatement } from './queries/dynamicTableQuery';


export class DataLoader {
  private evaluateQuery: ReturnType<typeof useMotherDuckClientState>['evaluateQuery'];
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;

  constructor(evaluateQuery: ReturnType<typeof useMotherDuckClientState>['evaluateQuery']) {
    this.evaluateQuery = evaluateQuery;
  }

  async waitForWasm(): Promise<void> {
    // Try a simple query to ensure Wasm is ready
    try {
      await this.evaluateQuery('SELECT 1');
    } catch (error) {
      console.error('Error waiting for Wasm:', error);
      throw error;
    }
  }

  private async createTempTables(seasonYear?: number) {
    const seasonFilter = seasonYear ? ` AND s.season_year = ${seasonYear}` : '';
    const scheduleSeasonFilter = seasonYear ? ` AND season_year = ${seasonYear}` : '';

    const queries = [
      `CREATE OR REPLACE TEMP TABLE ${TEMP_TABLES.SCHEDULE} AS
       SELECT * FROM ${SOURCE_TABLES.SCHEDULE}
       WHERE game_id NOT LIKE '006%'${scheduleSeasonFilter}`,

      `CREATE OR REPLACE TEMP TABLE ${TEMP_TABLES.BOX_SCORES} AS
       SELECT b.* FROM ${SOURCE_TABLES.BOX_SCORES} b
       JOIN ${SOURCE_TABLES.SCHEDULE} s ON b.game_id = s.game_id
       WHERE b.period = 'FullGame'${seasonFilter}`,

      `CREATE OR REPLACE TEMP TABLE ${TEMP_TABLES.TEAM_STATS} AS
       SELECT t.* FROM ${SOURCE_TABLES.TEAM_STATS} t
       JOIN ${SOURCE_TABLES.SCHEDULE} s ON t.game_id = s.game_id
       WHERE 1=1${seasonFilter}`
    ];

    await Promise.all(queries.map(query => this.evaluateQuery(query)));
  }

  /**
   * Loads only the essential tables needed for the dynamic table computation.
   * Accepts an optional season filter to limit data pulled into WASM.
   */
  async loadEssentialTables(seasonYear?: number): Promise<void> {
    if (this.isLoading) {
      return this.loadPromise!;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        await this.createTempTables(seasonYear);
      } catch (error) {
        console.error('Error loading essential tables:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Creates or updates the dynamic table
   * This is an expensive operation that should only be called
   * after the main application has fully loaded
   */
  async createDynamicTable(seasonYear?: number): Promise<void> {
    try {
      // Always recreate temp tables with the current season filter
      await this.loadEssentialTables(seasonYear);
      
      // Now create the dynamic table
      const dynamicTableName = 'temp_dynamic_stats';
      const query = createDynamicTableStatement(dynamicTableName);
      await this.evaluateQuery(query);
    } catch (error) {
      console.error('Error creating dynamic table:', error);
      throw error;
    }
  }
}

export function useDataLoader() {
  const { evaluateQuery } = useMotherDuckClientState();
  return new DataLoader(evaluateQuery);
}
