"use server";

import { Database } from 'duckdb-lambda-x86';

export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  
  try {
    if (!process.env.MOTHERDUCK_TOKEN) {
      throw new Error('MOTHERDUCK_TOKEN environment variable is not set');
    }

    // For parameterized queries, we'll need to interpolate the params manually
    const interpolatedQuery = params.reduce<string>((acc, param, idx) => {
      return acc.replace(
        `$${idx + 1}`,
        param === null ? 'NULL' : typeof param === 'string' ? `'${param}'` : param.toString()
      );
    }, query);

    return new Promise(async (resolve, reject) => {
      try {
        db = new Database("md:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connection: any = await db.connect();
        
        connection.all(interpolatedQuery, ((err: Error | null, rows: Array<T>) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
          // Close the connection after the query is done
          if (db) {
            db.close();
            db = null;
          }
        }));
      } catch (error) {
        // Make sure to close the connection on error
        if (db) {
          db.close();
          db = null;
        }
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error executing query:', error);
    // Make sure to close the connection on error
    if (db) {
      db.close();
      db = null;
    }
    throw error;
  }
}
