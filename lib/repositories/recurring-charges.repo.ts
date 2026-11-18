import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { RecurringCharge, RecurringChargeEntry, RecurringChargeFrequency } from "@/lib/types";

export interface CreateRecurringChargeInput {
  name: string;
  account_id: string;
  frequency: RecurringChargeFrequency;
  base_amount: number;
  is_variable?: boolean;
  start_date?: string;
  end_date?: string;
  custom_interval_months?: number;
  category?: string;
  notes?: string;
}

export interface CreateRecurringChargeEntryInput {
  recurring_charge_id: string;
  date: string;
  amount: number;
  notes?: string;
  transaction_id?: string;
}

export class RecurringChargesRepository {
  constructor(private db: IDatabase) {}

  findAll(activeOnly = true): RecurringCharge[] {
    const sql = activeOnly
      ? "SELECT * FROM recurring_charges WHERE is_active = 1 ORDER BY name"
      : "SELECT * FROM recurring_charges ORDER BY name";
    return this.db.query<RecurringCharge>(sql).map(this.deserialize);
  }

  findById(id: string): RecurringCharge | null {
    const rows = this.db.query<RecurringCharge>("SELECT * FROM recurring_charges WHERE id = ?", [id]);
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  findByAccount(accountId: string, activeOnly = true): RecurringCharge[] {
    const sql = activeOnly
      ? "SELECT * FROM recurring_charges WHERE account_id = ? AND is_active = 1 ORDER BY name"
      : "SELECT * FROM recurring_charges WHERE account_id = ? ORDER BY name";
    return this.db.query<RecurringCharge>(sql, [accountId]).map(this.deserialize);
  }

  create(input: CreateRecurringChargeInput): RecurringCharge {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO recurring_charges (id, name, account_id, frequency, base_amount, is_variable, is_active, start_date, end_date, custom_interval_months, category, notes, created_at)
       VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)`,
      [id, input.name, input.account_id, input.frequency, input.base_amount,
       input.is_variable ? 1 : 0, input.start_date ?? null, input.end_date ?? null,
       input.custom_interval_months ?? null, input.category ?? null, input.notes ?? null, now]
    );
    return this.findById(id)!;
  }

  update(id: string, input: Partial<CreateRecurringChargeInput> & { is_active?: boolean }): RecurringCharge | null {
    const allowed = ["name", "account_id", "frequency", "base_amount", "is_variable", "is_active", "start_date", "end_date", "custom_interval_months", "category", "notes"];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in input) {
        fields.push(`${key} = ?`);
        values.push((input as Record<string, unknown>)[key] ?? null);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    this.db.execute(`UPDATE recurring_charges SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.execute("DELETE FROM recurring_charges WHERE id = ?", [id]);
  }

  findEntriesByMonth(yearMonth: string): RecurringChargeEntry[] {
    return this.db.query<RecurringChargeEntry>(
      "SELECT * FROM recurring_charge_entries WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [yearMonth]
    );
  }

  findEntriesByChargeAndMonth(chargeId: string, yearMonth: string): RecurringChargeEntry[] {
    return this.db.query<RecurringChargeEntry>(
      "SELECT * FROM recurring_charge_entries WHERE recurring_charge_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [chargeId, yearMonth]
    );
  }

  findEntriesByMonthGrouped(yearMonth: string): Map<string, RecurringChargeEntry[]> {
    const entries = this.findEntriesByMonth(yearMonth);
    const grouped = new Map<string, RecurringChargeEntry[]>();
    for (const e of entries) {
      const existing = grouped.get(e.recurring_charge_id) ?? [];
      existing.push(e);
      grouped.set(e.recurring_charge_id, existing);
    }
    return grouped;
  }

  findEntriesByAccountAndPeriod(accountId: string, periodStart: string, periodEnd: string): RecurringChargeEntry[] {
    return this.db.query<RecurringChargeEntry>(
      `SELECT rce.* FROM recurring_charge_entries rce
       JOIN recurring_charges rc ON rc.id = rce.recurring_charge_id
       WHERE rc.account_id = ? AND rce.date >= ? AND rce.date <= ?
       ORDER BY rce.date DESC`,
      [accountId, periodStart, periodEnd]
    );
  }

  createEntry(input: CreateRecurringChargeEntryInput): RecurringChargeEntry {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO recurring_charge_entries (id, recurring_charge_id, date, amount, notes, transaction_id, created_at) VALUES (?,?,?,?,?,?,?)`,
      [id, input.recurring_charge_id, input.date, input.amount, input.notes ?? null, input.transaction_id ?? null, now]
    );
    const rows = this.db.query<RecurringChargeEntry>("SELECT * FROM recurring_charge_entries WHERE id = ?", [id]);
    return rows[0];
  }

  updateEntry(id: string, input: { date?: string; amount?: number; notes?: string }): RecurringChargeEntry | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.date !== undefined) { fields.push("date = ?"); values.push(input.date); }
    if (input.amount !== undefined) { fields.push("amount = ?"); values.push(input.amount); }
    if ("notes" in input) { fields.push("notes = ?"); values.push(input.notes ?? null); }
    if (fields.length === 0) {
      const rows = this.db.query<RecurringChargeEntry>("SELECT * FROM recurring_charge_entries WHERE id = ?", [id]);
      return rows[0] ?? null;
    }
    values.push(id);
    this.db.execute(`UPDATE recurring_charge_entries SET ${fields.join(", ")} WHERE id = ?`, values);
    const rows = this.db.query<RecurringChargeEntry>("SELECT * FROM recurring_charge_entries WHERE id = ?", [id]);
    return rows[0] ?? null;
  }

  deleteEntry(id: string): void {
    this.db.execute("DELETE FROM recurring_charge_entries WHERE id = ?", [id]);
  }

  private deserialize(row: RecurringCharge): RecurringCharge {
    return { ...row, is_variable: Boolean(row.is_variable), is_active: Boolean(row.is_active) };
  }
}
