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
    // Additive migrations for existing DBs
    const cols = instance.pragma("table_info(income_sources)") as { name: string }[];
    if (!cols.some((c) => c.name === "account_id")) {
      instance.exec("ALTER TABLE income_sources ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL");
    }
    const accCols = instance.pragma("table_info(accounts)") as { name: string }[];
    if (!accCols.some((c) => c.name === "flow_adjustment")) {
      instance.exec("ALTER TABLE accounts ADD COLUMN flow_adjustment REAL");
    }
    const tables = instance.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    if (!tables.some((t) => t.name === "flow_adjustments")) {
      instance.exec(`
        CREATE TABLE flow_adjustments (
          id          TEXT PRIMARY KEY,
          month       TEXT NOT NULL,
          type        TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('expense','income')),
          description TEXT NOT NULL,
          amount      REAL NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_flow_adjustments_month ON flow_adjustments(month);
      `);
    } else {
      const faCols = instance.pragma("table_info(flow_adjustments)") as { name: string }[];
      if (!faCols.some((c) => c.name === "type")) {
        instance.exec("ALTER TABLE flow_adjustments ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
      }
    }
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
