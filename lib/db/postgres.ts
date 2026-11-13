import { IDatabase } from "./adapter";

/**
 * TODO: Implementar cuando se migre a PostgreSQL.
 * Instalar: npm install postgres
 * Configurar: DATABASE_URL=postgresql://user:pass@host:5432/finkhy
 *
 * import postgres from "postgres";
 *
 * export function createPostgresAdapter(): IDatabase {
 *   const sql = postgres(process.env.DATABASE_URL!);
 *   return {
 *     async query(sqlStr, params = []) { ... },
 *     async execute(sqlStr, params = []) { ... },
 *     async transaction(fn) { ... },
 *     async close() { await sql.end(); },
 *   };
 * }
 */

export function createPostgresAdapter(): IDatabase {
  throw new Error(
    "PostgreSQL adapter not implemented yet. Set DATABASE_URL and implement lib/db/postgres.ts"
  );
}
