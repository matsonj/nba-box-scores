'use client';

import initMotherDuckConnection from './initMotherDuckConnection';
import { fetchMotherDuckToken } from './fetchMotherDuckToken';

// Direct query execution for scripts
export async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
  const mdToken = await fetchMotherDuckToken();
  const connection = await initMotherDuckConnection(mdToken);

  if (!connection) {
    throw new Error('No MotherDuck connection available');
  }

  // For parameterized queries, we'll need to interpolate the params manually
  const interpolatedQuery = params.reduce<string>((acc, param, idx) => {
    return acc.replace(
      `$${idx + 1}`,
      param === null ? 'NULL' : typeof param === 'string' ? `'${param}'` : param.toString()
    );
  }, query);

  try {
    const result = await connection.evaluateQuery(interpolatedQuery);
    const rows = result.data.toRows() as T[];
    return rows;
  } catch (error) {
    console.error('Failed to execute query:', error);
    throw error;
  }
}
