import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { IncomeEntry, IncomeFrequency, IncomeSource } from "@/lib/types";

export interface CreateIncomeSourceInput {
  name: string;
  frequency: IncomeFrequency;
  base_amount: number;
  is_variable?: boolean;
  start_date?: string;
  custom_interval_days?: number;
  account_id?: string | null;
}

export interface CreateIncomeEntryInput {
  income_source_id: string;
  date: string;
  amount: number;
  notes?: string;
}

export class IncomeRepository {
  constructor(private db: IDatabase) {}

  findAllSources(activeOnly = true): IncomeSource[] {
    const sql = activeOnly
      ? "SELECT * FROM income_sources WHERE is_active = 1 ORDER BY name"
      : "SELECT * FROM income_sources ORDER BY name";
    return this.db.query<IncomeSource>(sql).map(this.deserializeSource);
  }

  findSourceById(id: string): IncomeSource | null {
    const rows = this.db.query<IncomeSource>("SELECT * FROM income_sources WHERE id = ?", [id]);
    return rows[0] ? this.deserializeSource(rows[0]) : null;
  }

  createSource(input: CreateIncomeSourceInput): IncomeSource {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO income_sources (id, name, frequency, base_amount, is_variable, is_active, start_date, custom_interval_days, account_id, created_at)
       VALUES (?,?,?,?,?,1,?,?,?,?)`,
      [id, input.name, input.frequency, input.base_amount, input.is_variable ? 1 : 0, input.start_date ?? null, input.custom_interval_days ?? null, input.account_id ?? null, now]
    );
    return this.findSourceById(id)!;
  }

  updateSource(id: string, input: Partial<CreateIncomeSourceInput> & { is_active?: boolean }): IncomeSource | null {
    const allowed = ["name", "frequency", "base_amount", "is_variable", "is_active", "start_date", "custom_interval_days", "account_id"];
    const fields: string[] = [];
    const values: unknown[] = [];
    const boolKeys = new Set(["is_variable", "is_active"]);
    for (const key of allowed) {
      if (key in input) {
        fields.push(`${key} = ?`);
        const raw = (input as Record<string, unknown>)[key] ?? null;
        values.push(boolKeys.has(key) && typeof raw === "boolean" ? (raw ? 1 : 0) : raw);
      }
    }
    if (fields.length === 0) return this.findSourceById(id);
    values.push(id);
    this.db.execute(`UPDATE income_sources SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findSourceById(id);
  }

  findEntriesByMonth(yearMonth: string): IncomeEntry[] {
    return this.db.query<IncomeEntry>(
      "SELECT * FROM income_entries WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [yearMonth]
    );
  }

  findEntriesBySource(sourceId: string): IncomeEntry[] {
    return this.db.query<IncomeEntry>(
      "SELECT * FROM income_entries WHERE income_source_id = ? ORDER BY date DESC",
      [sourceId]
    );
  }

  createEntry(input: CreateIncomeEntryInput): IncomeEntry {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO income_entries (id, income_source_id, date, amount, notes, created_at)
       VALUES (?,?,?,?,?,?)`,
      [id, input.income_source_id, input.date, input.amount, input.notes ?? null, now]
    );
    const rows = this.db.query<IncomeEntry>("SELECT * FROM income_entries WHERE id = ?", [id]);
    return rows[0];
  }

  sumByMonth(yearMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM income_entries WHERE strftime('%Y-%m', date) = ?",
      [yearMonth]
    );
    return rows[0]?.total ?? 0;
  }

  findEntriesBySourceAndMonth(sourceId: string, yearMonth: string): IncomeEntry[] {
    return this.db.query<IncomeEntry>(
      "SELECT * FROM income_entries WHERE income_source_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [sourceId, yearMonth]
    );
  }

  deleteEntry(id: string): void {
    this.db.execute("DELETE FROM income_entries WHERE id = ?", [id]);
  }

  findEntriesByMonthGrouped(yearMonth: string): Map<string, IncomeEntry[]> {
    const entries = this.findEntriesByMonth(yearMonth);
    const grouped = new Map<string, IncomeEntry[]>();
    for (const e of entries) {
      const existing = grouped.get(e.income_source_id) ?? [];
      existing.push(e);
      grouped.set(e.income_source_id, existing);
    }
    return grouped;
  }

  private deserializeSource(row: IncomeSource): IncomeSource {
    return { ...row, is_variable: Boolean(row.is_variable), is_active: Boolean(row.is_active) };
  }
}
