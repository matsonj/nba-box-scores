'use client';

import { useMotherDuckClientState } from './MotherDuckContext';

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

  const { evaluateQuery } = useMotherDuckClientState();
  try {
    console.log('Executing query:', interpolatedQuery);
    const result = await evaluateQuery(interpolatedQuery);
    console.log(`Query completed successfully. Returned ${result.length} rows`);
    return result.toArray() as T[];
  } catch (error) {
    console.error('Failed to execute query:', error);
    throw error;
  }
}

export async function safeQueryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
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

  const { safeEvaluateQuery } = useMotherDuckClientState();
  try {
    console.log('Executing safe query:', interpolatedQuery);
    const result = await safeEvaluateQuery(interpolatedQuery);
    if (result.error) {
      throw new Error(result.error);
    }
    console.log(`Query completed successfully. Returned ${result.result.length} rows`);
    return result.result.toArray() as T[];
  } catch (error) {
    console.error('Failed to execute safe query:', error);
    throw error;
  }
}
