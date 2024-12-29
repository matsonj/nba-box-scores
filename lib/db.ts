"use server";

import { Database } from 'duckdb-lambda-x86';

interface DuckDBConnection {
  query: <T>(sql: string) => Promise<T[]>;
  run: (sql: string) => Promise<void>;
  close: () => void;
}

// Create a singleton database connection
let conn: DuckDBConnection | null = null;
let connectionPromise: Promise<DuckDBConnection> | null = null;

export async function getConnection(): Promise<DuckDBConnection> {
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
        
        // Set HOME env for DuckDB if needed
        process.env.HOME = '/tmp';

        // Create the connection using the example pattern
        const connection: DuckDBConnection = {
          query: async <T>(sql: string): Promise<T[]> => {
            return new Promise(async (resolve, reject) => {
              try {
                const db = new Database(connectionString);
                const rawConn = await db.connect();
                const result = await rawConn.query(sql, []);
                db.close();
                resolve(result as T[]);
              } catch (error) {
                reject(error);
              }
            });
          },
          run: async (sql: string): Promise<void> => {
            return new Promise(async (resolve, reject) => {
              try {
                const db = new Database(connectionString);
                const rawConn = await db.connect();
                await rawConn.query(sql, []);
                db.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          },
          close: () => {
            // No-op since we close the connection after each query
          }
        };
        
        conn = connection;
        console.log('Successfully connected to MotherDuck database');
        return connection;
      } catch (error) {
        connectionPromise = null;
        throw error;
      }
    })();

    return connectionPromise;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
  try {
    const connection = await getConnection();
    // For parameterized queries, we'll need to interpolate the params manually
    const interpolatedQuery = params.reduce<string>((acc, param, idx) => {
      return acc.replace(
        `$${idx + 1}`,
        param === null ? 'NULL' : typeof param === 'string' ? `'${param}'` : param.toString()
      );
    }, query);
    
    return connection.query(interpolatedQuery);
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

export async function closeConnection(): Promise<void> {
  conn = null;
  connectionPromise = null;
}
