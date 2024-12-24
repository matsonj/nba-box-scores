declare module 'duckdb-lambda-x86' {
  export class Database {
    constructor(path: string, options?: { allow_unsigned_extensions?: boolean });
    connect(): Promise<Connection>;
    close(): Promise<void>;
  }

  export class Connection {
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
  }
}
