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
        // Create the dynamic table after the base tables are loaded
        await this.createDynamicTable();
      } catch (error) {
        console.error('Error loading data:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }
  
  /**
   * Creates or updates the dynamic table based on the current parameters
   * @param params Optional parameters to customize the dynamic table
   */
  async createDynamicTable(params?: { [key: string]: any }): Promise<void> {
    try {
      const dynamicTableName = 'temp_dynamic_stats';
      const query = createDynamicTableStatement(dynamicTableName, params);
      await this.evaluateQuery(query);
      console.log('Dynamic table created successfully');
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
