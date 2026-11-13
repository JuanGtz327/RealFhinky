export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface IDatabase {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  execute(sql: string, params?: unknown[]): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
