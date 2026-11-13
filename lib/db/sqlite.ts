import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "./adapter";

const DB_PATH = path.join(process.cwd(), "finkhy.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib/db/schema.sql");

let instance: Database.Database | null = null;

function getConnection(): Database.Database {
  if (!instance) {
    instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    instance.exec(schema);
  }
  return instance;
}

export function createSQLiteAdapter(): IDatabase {
  const db = getConnection();

  return {
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },

    execute(sql: string, params: unknown[] = []): void {
      const stmt = db.prepare(sql);
      stmt.run(...params);
    },

    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },

    close(): void {
      if (instance) {
        instance.close();
        instance = null;
      }
    },
  };
}
