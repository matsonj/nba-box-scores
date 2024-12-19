import * as duckdb from 'duckdb';
import path from 'path';

// Create a singleton database connection
let db: duckdb.Database | null = null;

export function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'nba.db');
    db = new duckdb.Database(dbPath);
  }
  return db;
}

export function queryDb<T>(query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(query, params, (err, result) => {
      if (err) reject(err);
      else resolve(result as T[]);
    });
  });
}

// Ensure we close the connection when the process exits
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
