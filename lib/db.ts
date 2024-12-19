import { DuckDBInstance, DuckDBTypeId } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs';

// Create a singleton database connection
let db: DuckDBInstance | null = null;
let conn: any | null = null;

export async function getConnection(): Promise<DuckDBInstance | null> {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'nba.db');
    
    // Check if database file exists and log its size
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log('Database file size:', stats.size, 'bytes');
    }

    // Create a new DuckDB instance
    const db = await DuckDBInstance.create(dbPath);
    const conn = await db.connect();
    
    // Create schema and tables if they don't exist
    await conn.run(`
      CREATE SCHEMA IF NOT EXISTS main;
    `);
    
    await conn.run(`
      CREATE TABLE IF NOT EXISTS main.schedule (
        game_id VARCHAR PRIMARY KEY,
        game_date DATE,
        home_team VARCHAR,
        away_team VARCHAR,
        home_team_score INTEGER,
        away_team_score INTEGER,
        status VARCHAR
      );
    `);
    
    await conn.run(`
      CREATE TABLE IF NOT EXISTS main.box_scores (
        game_id VARCHAR,
        player_id VARCHAR,
        player_name VARCHAR,
        team_id VARCHAR,
        period VARCHAR,
        minutes INTEGER,
        field_goals_made INTEGER,
        field_goals_attempted INTEGER,
        three_pointers_made INTEGER,
        three_pointers_attempted INTEGER,
        free_throws_made INTEGER,
        free_throws_attempted INTEGER,
        offensive_rebounds INTEGER,
        defensive_rebounds INTEGER,
        rebounds INTEGER,
        assists INTEGER,
        steals INTEGER,
        blocks INTEGER,
        turnovers INTEGER,
        personal_fouls INTEGER,
        points INTEGER,
        PRIMARY KEY (game_id, player_id, period)
      );
    `);
    
    await conn.run(`
      CREATE TABLE IF NOT EXISTS main.team_stats (
        game_id VARCHAR,
        team_id VARCHAR,
        period VARCHAR,
        field_goals_made INTEGER,
        field_goals_attempted INTEGER,
        three_pointers_made INTEGER,
        three_pointers_attempted INTEGER,
        free_throws_made INTEGER,
        free_throws_attempted INTEGER,
        offensive_rebounds INTEGER,
        defensive_rebounds INTEGER,
        rebounds INTEGER,
        assists INTEGER,
        steals INTEGER,
        blocks INTEGER,
        turnovers INTEGER,
        personal_fouls INTEGER,
        points INTEGER,
        offensive_possessions INTEGER,
        defensive_possessions INTEGER,
        PRIMARY KEY (game_id, team_id, period)
      );
    `);
    
    // Log test query result
    const result = await conn.run('SELECT 1');
    console.log('Test query result:', result);
    
    console.log('Successfully connected to database');
    return conn;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return null;
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
  if (db) {
    try {
      db.close();
      console.log('Database closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
});
