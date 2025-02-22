'use client';

import { useMotherDuckClientState } from './MotherDuckContext';
import { SOURCE_TABLES, TEMP_TABLES } from '@/constants/tables';


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

  private async createTempTables() {
    const queries = [
      // Create schedule temp table
      `CREATE TEMP TABLE IF NOT EXISTS ${TEMP_TABLES.SCHEDULE} AS 
       SELECT * FROM ${SOURCE_TABLES.SCHEDULE} 
       WHERE game_id NOT LIKE '006%'`,

      // Create box scores temp table
      `CREATE TEMP TABLE IF NOT EXISTS ${TEMP_TABLES.BOX_SCORES} AS 
       SELECT * FROM ${SOURCE_TABLES.BOX_SCORES} 
       WHERE period = 'FullGame'`,

      // Create team stats temp table
      `CREATE TEMP TABLE IF NOT EXISTS ${TEMP_TABLES.TEAM_STATS} AS 
       SELECT * FROM ${SOURCE_TABLES.TEAM_STATS}`
    ];

    // Execute all queries in parallel
    await Promise.all(queries.map(query => this.evaluateQuery(query)));
  }

  async loadData(): Promise<void> {
    if (this.isLoading) {
      return this.loadPromise!;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        await this.createTempTables();
      } catch (error) {
        console.error('Error loading data:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }
}

export function useDataLoader() {
  const { evaluateQuery } = useMotherDuckClientState();
  return new DataLoader(evaluateQuery);
}
