// MotherDuck connection manager using @duckdb/node-api

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { logger } from '../util/logger';

export class MotherDuckConnection {
  private instance: DuckDBInstance | null = null;
  private conn: DuckDBConnection | null = null;
  private readonly motherDuckToken: string;
  private readonly database: string;

  constructor(motherDuckToken: string, database: string = 'nba_box_scores_v2') {
    this.motherDuckToken = motherDuckToken;
    this.database = database;
  }

  /** Connect to MotherDuck */
  async connect(): Promise<void> {
    logger.info('Connecting to MotherDuck', { database: this.database });

    // Connect to MotherDuck without specifying a database first,
    // then CREATE DATABASE IF NOT EXISTS and USE it.
    this.instance = await DuckDBInstance.create(
      `md:?motherduck_token=${this.motherDuckToken}`,
    );
    this.conn = await this.instance.connect();

    await this.conn.run(`CREATE DATABASE IF NOT EXISTS ${this.database}`);
    await this.conn.run(`USE ${this.database}`);

    logger.info('Connected to MotherDuck');
  }

  /** Execute a SQL statement (no result expected) */
  async execute(sql: string): Promise<void> {
    if (!this.conn) throw new Error('Not connected');
    await this.conn.run(sql);
  }

  /** Execute a query and return rows as JS objects */
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.conn) throw new Error('Not connected');
    const reader = await this.conn.runAndReadAll(sql);
    return reader.getRowObjectsJS() as T[];
  }

  /** Close the connection and instance */
  close(): void {
    try {
      this.conn?.closeSync();
      this.instance?.closeSync();
    } catch {
      // Ignore close errors during shutdown
    }
    this.conn = null;
    this.instance = null;
    logger.info('MotherDuck connection closed');
  }
}
