import * as duckdb from '@duckdb/node-api';
import path from 'path';
import fs from 'fs';

// Create a singleton database connection
let db: duckdb.Database | null = null;
let conn: duckdb.Connection | null = null;

export async function getConnection() {
  if (!db || !conn) {
    const dbPath = path.resolve(process.cwd(), 'data', 'nba.db');
    console.log('Attempting to connect to database at:', dbPath);
    
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found at: ${dbPath}`);
    }

    const stats = fs.statSync(dbPath);
    console.log('Database file size:', stats.size, 'bytes');

    try {
      db = new duckdb.Database(dbPath);
      conn = db.connect();
      
      // Test the connection
      const testResult = await conn.run('SELECT 1');
      console.log('Test query result:', testResult);
      
      console.log('Successfully connected to database');
    } catch (error) {
      console.error('Error connecting to database:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  return conn;
}

export async function queryDb<T>(query: string, params: any[] = []): Promise<T[]> {
  const connection = await getConnection();
  try {
    console.log('Executing query:', query.trim());
    console.log('With parameters:', params);
    
    // For parameterized queries, we need to use a different approach
    // First, replace the parameters in the query (this is safe since we control the input)
    const finalQuery = params.reduce((q, param, i) => {
      return q.replace('?', typeof param === 'string' ? `'${param}'` : param);
    }, query);
    
    const result = await connection.run(finalQuery);
    console.log('Query executed successfully, result:', result);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      query: query.trim(),
      params
    });
    throw error;
  }
}

// Ensure we close the connection when the process exits
process.on('exit', () => {
  if (conn) {
    try {
      conn.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }
  if (db) {
    try {
      db.close();
      console.log('Database closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
});
