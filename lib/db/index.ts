import { IDatabase } from "./adapter";
import { createSQLiteAdapter } from "./sqlite";
import { createPostgresAdapter } from "./postgres";

let _db: IDatabase | null = null;

export function getDb(): IDatabase {
  if (!_db) {
    _db = process.env.DATABASE_URL
      ? createPostgresAdapter()
      : createSQLiteAdapter();
  }
  return _db;
}

export type { IDatabase };
