"use server";
import { Database } from 'duckdb-lambda-x86';

process.env.HOME = '/tmp';

export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
  if (query === "") {
    return [];
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
      console.log('Connecting to database...');
      const db: Database = new Database("md:");
      console.log('Database instance created');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection: any = await db.connect();
      console.log('Database connected');
      
      console.log('Executing query:', interpolatedQuery);
      connection.all(interpolatedQuery, ((err: Error | null, rows: Array<T>) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
          return;
        }
        console.log(`Query completed successfully. Returned ${rows.length} rows`);
        resolve(rows);
      }));
    } catch (error) {
      console.error('Database connection error:', error);
      reject(error);
    }
  });
}
