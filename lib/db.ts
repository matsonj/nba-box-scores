'use client';

import { useMotherDuckClientState } from './MotherDuckContext';
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
      const result = await evaluateQuery(interpolatedQuery);
      const rows = result.data.toRows() as T[];
      return rows;
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
      const result = await safeEvaluateQuery(interpolatedQuery);
      if (result.status === 'success') {
        const rows = result.result.data.toRows() as T[];
        return rows;
      }
      throw new Error(String(result.err));
    } catch (error) {
      console.error('Failed to execute safe query:', error);
      throw error;
    }
  };
}
