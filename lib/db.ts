'use client';

import { useMotherDuckClientState } from './MotherDuckContext';

// Helper function to interpolate query parameters
function interpolateParams(query: string, params: (string | number | null)[] = []): string {
  return params.reduce<string>((acc, param, idx) => {
    return acc.replace(
      `$${idx + 1}`,
      param === null ? 'NULL' : typeof param === 'string' ? `'${param}'` : param.toString()
    );
  }, query);
}

// React hooks for components
export function useQueryDb() {
  const { evaluateQuery } = useMotherDuckClientState();

  return async function queryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
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

    try {
      console.log('Executing query:', interpolatedQuery);
      const result = await evaluateQuery(interpolatedQuery);
      console.log(`Query completed successfully. Returned ${result.length} rows`);
      return result.data.toRows() as T[];
    } catch (error) {
      console.error('Failed to execute query:', error);
      throw error;
    }
  };
}

export function useSafeQueryDb() {
  const { safeEvaluateQuery } = useMotherDuckClientState();

  return async function safeQueryDb<T>(query: string, params: (string | number | null)[] = []): Promise<T[]> {
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

    try {
      console.log('Executing safe query:', interpolatedQuery);
      const result = await safeEvaluateQuery(interpolatedQuery);
      if (result.error) {
        throw new Error(result.error);
      }
      console.log(`Query completed successfully. Returned ${result.result.length} rows`);
      return result.result.data.toRows() as T[];
    } catch (error) {
      console.error('Failed to execute safe query:', error);
      throw error;
    }
  };
}
