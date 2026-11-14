/**
 * Seed de datos de ejemplo para Finkhy.
 * Ejecutar: npx ts-node --project tsconfig.json scripts/seed.ts
 * O via: npm run seed
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "../lib/db/adapter";
import { seedDatabase } from "../lib/db/seed";

const DB_PATH = path.join(process.cwd(), "finkhy.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib/db/schema.sql");

const raw = new Database(DB_PATH);
raw.pragma("journal_mode = WAL");
raw.pragma("foreign_keys = ON");
const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
raw.exec(schema);

const db: IDatabase = {
  query<T>(sql: string, params: unknown[] = []): T[] {
    return raw.prepare(sql).all(...params) as T[];
  },
  execute(sql: string, params: unknown[] = []): void {
    raw.prepare(sql).run(...params);
  },
  transaction<T>(fn: () => T): T {
    return raw.transaction(fn)();
  },
  close(): void {
    raw.close();
  },
};

const result = seedDatabase(db);

console.log("✅ Seed completado:");
console.log(`   ${result.accounts} cuentas`);
console.log(`   ${result.transactions} transacciones normales`);
console.log(`   ${result.msiTransactions} transacciones MSI`);
console.log(`   ${result.incomeSources} fuentes de ingreso`);
console.log(`   ${result.incomeEntries} entradas de ingreso`);

db.close();
