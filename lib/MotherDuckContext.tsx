"use client"

import { fetchMotherDuckToken } from "./fetchMotherDuckToken";
import initMotherDuckConnection from "./initMotherDuckConnection";
import type { MaterializedQueryResult, MDConnection, SafeQueryResult } from "@motherduck/wasm-client";
import 'core-js/actual/promise/with-resolvers';
import { createContext, useContext, useEffect, useMemo, useRef } from "react";

// Safe interface for using the connection
interface MotherDuckContextValue {
  evaluateQuery: (query: string) => Promise<MaterializedQueryResult>;
  safeEvaluateQuery: (query: string) => Promise<SafeQueryResult<MaterializedQueryResult>>;
}

export const MotherDuckContext = createContext<MotherDuckContextValue | null>(null);

export function MotherDuckClientProvider({ children, database }: { children: React.ReactNode, database?: string },) {
  const connectionRef = useRef<PromiseWithResolvers<MDConnection | undefined>>();

  if (connectionRef.current === undefined) {
    connectionRef.current = Promise.withResolvers<MDConnection | undefined>();
  }

  const evaluateQuery = async (query: string): Promise<MaterializedQueryResult> => {
    if (!connectionRef.current) {
      throw new Error('MotherDuck connection ref is falsy')
    }

    const connection = await connectionRef.current.promise;

    if (!connection) {
      throw new Error('No MotherDuck connection available');
    }

    return connection.evaluateQuery(query);
  };

  const safeEvaluateQuery = async (query: string): Promise<SafeQueryResult<MaterializedQueryResult>> => {
    if (!connectionRef.current) {
      throw new Error('MotherDuck connection ref is falsy')
    }

    const connection = await connectionRef.current.promise;

    if (!connection) {
      throw new Error('No MotherDuck connection available');
    }

    return connection.safeEvaluateQuery(query);
  };

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const mdToken = await fetchMotherDuckToken();
        const result = await initMotherDuckConnection(mdToken, database);
        if (connectionRef.current) {
          connectionRef.current.resolve(result);
        }
      } catch (error) {
        console.error('Failed to initialize MotherDuck connection:', error);
        if (connectionRef.current) {
          connectionRef.current.reject(error);
        }
      }
    };
    initializeConnection();

    return () => {
      // Clean up connection on unmount
      if (connectionRef.current) {
        connectionRef.current.resolve(undefined);
      }
    };
  }, [database]); // Add database to dependencies

  const value = useMemo(() => ({
    evaluateQuery,
    safeEvaluateQuery,
  }), []);


  return (
    <MotherDuckContext.Provider value={value}>
      {children}
    </MotherDuckContext.Provider>
  );
}

export function useMotherDuckClientState() {
  const context = useContext(MotherDuckContext);
  if (!context) {
    throw new Error('useMotherDuckClientState must be used within MotherDuckClientStateProvider');
  }
  return context;
}
