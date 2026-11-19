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
    if (!tables.some((t) => t.name === "recurring_charges")) {
      instance.exec(`
        CREATE TABLE recurring_charges (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          frequency TEXT NOT NULL CHECK(frequency IN ('monthly','bimonthly','quarterly','semiannual','annual','custom')),
          base_amount REAL NOT NULL DEFAULT 0, is_variable INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1, start_date TEXT, end_date TEXT,
          custom_interval_months INTEGER, category TEXT, notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_recurring_charges_account ON recurring_charges(account_id);
        CREATE TABLE recurring_charge_entries (
          id TEXT PRIMARY KEY,
          recurring_charge_id TEXT NOT NULL REFERENCES recurring_charges(id) ON DELETE CASCADE,
          date TEXT NOT NULL, amount REAL NOT NULL, notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_recurring_charge_entries_charge ON recurring_charge_entries(recurring_charge_id);
        CREATE INDEX idx_recurring_charge_entries_date ON recurring_charge_entries(date);
      `);
    }
    if (!tables.some((t) => t.name === "planned_transfers")) {
      instance.exec(`
        CREATE TABLE planned_transfers (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          direction TEXT NOT NULL CHECK(direction IN ('in','out')),
          frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','custom','one_time')),
          base_amount REAL NOT NULL DEFAULT 0, is_variable INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1, start_date TEXT, end_date TEXT,
          custom_interval_days INTEGER, notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_planned_transfers_account ON planned_transfers(account_id);
        CREATE TABLE planned_transfer_entries (
          id TEXT PRIMARY KEY,
          planned_transfer_id TEXT NOT NULL REFERENCES planned_transfers(id) ON DELETE CASCADE,
          date TEXT NOT NULL, amount REAL NOT NULL, notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_planned_transfer_entries_transfer ON planned_transfer_entries(planned_transfer_id);
        CREATE INDEX idx_planned_transfer_entries_date ON planned_transfer_entries(date);
      `);
    }
    // Add transaction_id to recurring_charge_entries if missing
    const rceColumns = instance.prepare("PRAGMA table_info(recurring_charge_entries)").all() as { name: string }[];
    if (!rceColumns.some((c) => c.name === "transaction_id")) {
      instance.exec("ALTER TABLE recurring_charge_entries ADD COLUMN transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL");
    }
    // Add income_entry_id and cycle_payment_id to transactions if missing
    const txCols = instance.pragma("table_info(transactions)") as { name: string }[];
    if (!txCols.some((c) => c.name === "income_entry_id")) {
      instance.exec("ALTER TABLE transactions ADD COLUMN income_entry_id TEXT REFERENCES income_entries(id) ON DELETE SET NULL");
    }
    if (!txCols.some((c) => c.name === "cycle_payment_id")) {
      instance.exec("ALTER TABLE transactions ADD COLUMN cycle_payment_id TEXT REFERENCES cycle_payments(id) ON DELETE SET NULL");
    }
    // Add paid_from_account_id to cycle_payments if missing
    const cpCols = instance.pragma("table_info(cycle_payments)") as { name: string }[];
    if (!cpCols.some((c) => c.name === "paid_from_account_id")) {
      instance.exec("ALTER TABLE cycle_payments ADD COLUMN paid_from_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL");
    }
    if (!cpCols.some((c) => c.name === "confirmed_cycle_total")) {
      instance.exec("ALTER TABLE cycle_payments ADD COLUMN confirmed_cycle_total REAL");
    }
    // Add loan columns to accounts if missing
    const accLoanCols = instance.pragma("table_info(accounts)") as { name: string }[];
    const loanColDefs: [string, string][] = [
      ["loan_original_amount", "REAL"],
      ["loan_interest_rate", "REAL"],
      ["loan_term_months", "INTEGER"],
      ["loan_monthly_payment", "REAL"],
      ["loan_start_date", "TEXT"],
      ["loan_payments_made", "INTEGER"],
    ];
    for (const [col, type] of loanColDefs) {
      if (!accLoanCols.some((c) => c.name === col)) {
        instance.exec(`ALTER TABLE accounts ADD COLUMN ${col} ${type}`);
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
