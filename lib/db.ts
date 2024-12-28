"use server";

import type { DuckDBInstance } from '@duckdb/node-api';

// Create a singleton database connection
let db: DuckDBInstance | null = null;
let conn: any | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let connectionPromise: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function getConnection(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // Return existing connection if it exists and is valid
    if (conn) {
      try {
        await conn.query('SELECT 1');
        return conn;
      } catch {
        console.log('Existing connection invalid, creating new connection...');
        await closeConnection();
      }
    }

    // If a connection is in progress, wait for it
    if (connectionPromise) {
      return connectionPromise;
    }

    // Create a new connection
    connectionPromise = (async () => {
      try {
        if (!process.env.MOTHERDUCK_TOKEN) {
          throw new Error('MOTHERDUCK_TOKEN environment variable is not set');
        }

        // Use MotherDuck connection string with token from environment
        const connectionString = `md:nba_box_scores?motherduck_token=${process.env.MOTHERDUCK_TOKEN}`;
        
        // Dynamically import DuckDB
        const { DuckDBInstance } = await import('@duckdb/node-api');

        // Set HOME env for DuckDB if needed
        process.env.HOME = '/tmp';

        // Create the DB with MotherDuck connection string
        db = await DuckDBInstance.create(connectionString);
        conn = await db.connect();
        
        console.log('Successfully connected to MotherDuck database');
        return conn;
      } catch (error) {
        connectionPromise = null;
        console.error('Failed to connect to database:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    })();

    return connectionPromise;
  } catch (error) {
    console.error('Database connection error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
  if (!query) {
    return [];
  }

  let retries = 2;
  while (retries >= 0) {
    try {
      const connection = await getConnection();
      if (!connection) {
        throw new Error('Failed to get database connection');
      }

      console.log('Executing query:', query);
      console.log('Parameters:', params);

      // Prepare and execute the query with parameters
      const stmt = await connection.prepare(query);
      
      // Bind parameters if any
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        if (param === null) {
          stmt.bindNull(i + 1);
        } else if (typeof param === 'string') {
          stmt.bindVarchar(i + 1, param);
        } else if (typeof param === 'number') {
          if (Number.isInteger(param)) {
            stmt.bindInteger(i + 1, param);
          } else {
            stmt.bindDouble(i + 1, param);
          }
        }
      }

      // Execute and return results
      const reader = await stmt.runAndReadAll();
      const rows = reader.getRows();
      const columnNames = reader.columnNames();
      const columnTypes = reader.columnTypes();
      
      // Convert array rows to objects with column names
      return rows.map((row: unknown[]) => {
        const obj: { [key: string]: unknown } = {};
        columnNames.forEach((col: string, i: number) => {
          let value = row[i];
          // Convert DuckDB timestamp values to ISO strings
          if (columnTypes[i].typeId === 12 && value !== null && value !== undefined && typeof value === 'object' && 'micros' in value) {
            value = new Date(Number((value as { micros: bigint }).micros / 1000n)).toISOString();
          }
          // Convert BigInt values to numbers for integer types
          if (columnTypes[i].typeId === 4 && value !== null && value !== undefined) {
            value = Number(value);
          }
          // Convert BigInt values to numbers
          if (typeof value === 'bigint') {
            value = Number(value);
          }
          obj[col] = value;
        });
        return obj as T;
      });
    } catch (error) {
      console.error(`Error executing query (${retries} retries left):`, error);
      if (retries === 0) throw error;
      
      // Reset connection on error
      conn = null;
      db = null;
      connectionPromise = null;
      retries--;
    }
  }
  throw new Error('Query failed after all retries');
}

// Close connection when possible
export async function closeConnection() {
  try {
    if (conn) {
      conn = null;
    }
    if (db) {
      db = null;
    }
    connectionPromise = null;
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Handle serverless function cleanup
if (process.env.VERCEL) {
  process.on('beforeExit', async () => {
    await closeConnection();
  });
}
