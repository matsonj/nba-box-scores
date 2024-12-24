import { DuckDBInstance } from '@duckdb/node-api';

// Create a singleton database connection
let db: DuckDBInstance | null = null;
let conn: any | null = null;
let connectionPromise: Promise<any> | null = null;

// Connection timeout (5 seconds)
const CONNECTION_TIMEOUT = 5000;

export async function getConnection(): Promise<any> {
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
        const connectionString = `md:nba_box_scores?MOTHERDUCK_TOKEN=${process.env.MOTHERDUCK_TOKEN}`;
        
        // Create a new DuckDB instance with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database connection timeout')), CONNECTION_TIMEOUT);
        });

        db = await Promise.race([DuckDBInstance.create(connectionString), timeoutPromise]) as DuckDBInstance;
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

export async function queryDb<T = any>(query: string, params: any[] = []): Promise<T[]> {
  let retries = 2;
  while (retries >= 0) {
    try {
      const connection = await getConnection();
      if (!connection) {
        throw new Error('Failed to get database connection');
      }

      console.log('Executing query:', query);
      console.log('Parameters:', params);

      // Prepare and execute the query
      const stmt = await connection.prepare(query);
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        if (typeof param === 'string') {
          stmt.bindVarchar(i + 1, param);
        } else if (typeof param === 'number') {
          if (Number.isInteger(param)) {
            stmt.bindInteger(i + 1, param);
          } else {
            stmt.bindDouble(i + 1, param);
          }
        } else if (param === null) {
          stmt.bindNull(i + 1);
        } else {
          throw new Error(`Unsupported parameter type: ${typeof param}`);
        }
      }

      // Execute the query and get all rows
      const reader = await stmt.runAndReadAll();
      const rows = reader.getRows();
      const columnNames = reader.columnNames();
      const columnTypes = reader.columnTypes();
      
      // Convert array rows to objects with column names
      return rows.map((row: any) => {
        const obj: any = {};
        columnNames.forEach((col, i) => {
          let value = row[i];
          // Convert DuckDB timestamp values to ISO strings
          if (columnTypes[i].typeId === 12 && value !== null) {
            value = new Date(Number(value.micros / 1000n)).toISOString();
          }
          // Convert BigInt values to numbers for integer types
          if (columnTypes[i].typeId === 4 && value !== null) {
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
