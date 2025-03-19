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

  /**
   * Loads only the essential tables needed for the main page
   * Returns a promise that resolves when the essential tables are loaded
   */
  async loadEssentialTables(): Promise<void> {
    if (this.isLoading) {
      return this.loadPromise!;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        await this.createTempTables();
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
   * Loads all data including the dynamic table
   * This method first ensures essential tables are loaded, then creates the dynamic table
   */
  async loadData(): Promise<void> {
    // First ensure essential tables are loaded
    await this.loadEssentialTables();
    
    // Then create the dynamic table in the background
    this.createDynamicTable().catch(error => {
      console.error('Error creating dynamic table in background:', error);
    });
    
    return Promise.resolve();
  }
  
  /**
   * Creates or updates the dynamic table
   */
  async createDynamicTable(): Promise<void> {
    try {
      const dynamicTableName = 'temp_dynamic_stats';
      const query = createDynamicTableStatement(dynamicTableName);
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
