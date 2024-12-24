import { DuckDBInstance } from '@duckdb/node-api';

process.env.HOME = '/tmp';

// Create a singleton database connection
let db: DuckDBInstance | null = null;
let conn: any | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let connectionPromise: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any

// Connection timeout (5 seconds)
const CONNECTION_TIMEOUT = 5000;

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
        
        // Create a new DuckDB instance with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database connection timeout')), CONNECTION_TIMEOUT);
        });

        try {
          // Try using @duckdb/node-api first
          console.log('Attempting to connect using @duckdb/node-api...');
          const { DuckDBInstance } = await import('@duckdb/node-api');
          db = await Promise.race([DuckDBInstance.create(connectionString), timeoutPromise]) as DuckDBInstance;
          console.log('Successfully connected using @duckdb/node-api');
        } catch {
          // Expected in Vercel environment
          console.log('Using duckdb-lambda-x86 (this is normal in Vercel environment)');
          const duckdb = await import('duckdb-lambda-x86');
          const database = new duckdb.Database(connectionString, { allow_unsigned_extensions: true });
          db = database as unknown as DuckDBInstance;
        }

        conn = await db.connect();
        
        // Test the connection
        await conn.query('SELECT 1');
        console.log('Database connection test successful');
        return conn;
      } catch (error) {
        connectionPromise = null;
        console.error('Failed to connect to database:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
        throw error;
      }
    })();

    return connectionPromise;
  } catch (error) {
    connectionPromise = null;
    console.error('Database connection error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    throw error;
  }
}

export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
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
      console.error(`Error executing query (${retries} retries left):`, error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
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
    console.error('Error closing database connection:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
  }
}

// Handle serverless function cleanup
if (process.env.VERCEL) {
  process.on('beforeExit', async () => {
    await closeConnection();
  });
}
