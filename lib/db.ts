import { DuckDBInstance, DuckDBTypeId } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs';

// Create a singleton database connection
let db: DuckDBInstance | null = null;
let conn: any | null = null;

export async function getConnection(): Promise<any> {
  try {
    // Return existing connection if it exists
    if (conn) {
      return conn;
    }

    // Use MotherDuck connection string with token from environment
    const connectionString = `md:nba_box_scores?MOTHERDUCK_TOKEN=${process.env.MOTHERDUCK_TOKEN}`;
    
    // Create a new DuckDB instance
    db = await DuckDBInstance.create(connectionString);
    conn = await db.connect();
    
    console.log('Successfully connected to MotherDuck database');
    return conn;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

export async function queryDb<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const connection = await getConnection();
  if (!connection) {
    throw new Error('Failed to get database connection');
  }

  try {
    console.log('Executing query:', query);
    console.log('Parameters:', params);
    
    // Prepare and bind parameters
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
      } else if (param instanceof Date) {
        // Convert Date to string in ISO format
        stmt.bindVarchar(i + 1, param.toISOString().split('T')[0]);
      } else {
        throw new Error(`Unsupported parameter type: ${typeof param}`);
      }
    }
    
    // Execute the query and get all rows
    const reader = await stmt.runAndReadAll();
    const rows = reader.getRows();
    const columnNames = reader.columnNames();
    const columnTypes = reader.columnTypes();
    
    console.log('Column types:', columnTypes);
    
    // Convert array rows to objects with column names
    return rows.map((row: any) => {
      const obj: any = {};
      columnNames.forEach((col, i) => {
        let value = row[i];
        // Convert DuckDB date values to JavaScript Date objects
        if (columnTypes[i].typeId === 13 && value !== null) {
          value = new Date(value.toString());
        }
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
  } catch (error: any) {
    console.error('Error executing query:', {
      query: query,
      params,
      name: error.name,
      message: error.message,
      stack: error.stack
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
      console.error('Error closing database connection:', error);
    }
  }
});
