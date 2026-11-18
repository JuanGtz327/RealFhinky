import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { PlannedTransfer, PlannedTransferEntry, PlannedTransferFrequency, PlannedTransferDirection } from "@/lib/types";

export interface CreatePlannedTransferInput {
  name: string;
  account_id: string;
  direction: PlannedTransferDirection;
  frequency: PlannedTransferFrequency;
  base_amount: number;
  is_variable?: boolean;
  start_date?: string;
  end_date?: string;
  custom_interval_days?: number;
  notes?: string;
}

export interface CreatePlannedTransferEntryInput {
  planned_transfer_id: string;
  date: string;
  amount: number;
  notes?: string;
}

export class PlannedTransfersRepository {
  constructor(private db: IDatabase) {}

  findAll(activeOnly = true): PlannedTransfer[] {
    const sql = activeOnly
      ? "SELECT * FROM planned_transfers WHERE is_active = 1 ORDER BY name"
      : "SELECT * FROM planned_transfers ORDER BY name";
    return this.db.query<PlannedTransfer>(sql).map(this.deserialize);
  }

  findById(id: string): PlannedTransfer | null {
    const rows = this.db.query<PlannedTransfer>("SELECT * FROM planned_transfers WHERE id = ?", [id]);
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  findByAccount(accountId: string, activeOnly = true): PlannedTransfer[] {
    const sql = activeOnly
      ? "SELECT * FROM planned_transfers WHERE account_id = ? AND is_active = 1 ORDER BY name"
      : "SELECT * FROM planned_transfers WHERE account_id = ? ORDER BY name";
    return this.db.query<PlannedTransfer>(sql, [accountId]).map(this.deserialize);
  }

  create(input: CreatePlannedTransferInput): PlannedTransfer {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO planned_transfers (id, name, account_id, direction, frequency, base_amount, is_variable, is_active, start_date, end_date, custom_interval_days, notes, created_at)
       VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?)`,
      [id, input.name, input.account_id, input.direction, input.frequency, input.base_amount,
       input.is_variable ? 1 : 0, input.start_date ?? null, input.end_date ?? null,
       input.custom_interval_days ?? null, input.notes ?? null, now]
    );
    return this.findById(id)!;
  }

  update(id: string, input: Partial<CreatePlannedTransferInput> & { is_active?: boolean }): PlannedTransfer | null {
    const allowed = ["name", "account_id", "direction", "frequency", "base_amount", "is_variable", "is_active", "start_date", "end_date", "custom_interval_days", "notes"];
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
    this.db.execute(`UPDATE planned_transfers SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.execute("DELETE FROM planned_transfers WHERE id = ?", [id]);
  }

  findEntriesByMonth(yearMonth: string): PlannedTransferEntry[] {
    return this.db.query<PlannedTransferEntry>(
      "SELECT * FROM planned_transfer_entries WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [yearMonth]
    );
  }

  findEntriesByTransferAndMonth(transferId: string, yearMonth: string): PlannedTransferEntry[] {
    return this.db.query<PlannedTransferEntry>(
      "SELECT * FROM planned_transfer_entries WHERE planned_transfer_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date DESC",
      [transferId, yearMonth]
    );
  }

  findEntriesByMonthGrouped(yearMonth: string): Map<string, PlannedTransferEntry[]> {
    const entries = this.findEntriesByMonth(yearMonth);
    const grouped = new Map<string, PlannedTransferEntry[]>();
    for (const e of entries) {
      const existing = grouped.get(e.planned_transfer_id) ?? [];
      existing.push(e);
      grouped.set(e.planned_transfer_id, existing);
    }
    return grouped;
  }

  createEntry(input: CreatePlannedTransferEntryInput): PlannedTransferEntry {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO planned_transfer_entries (id, planned_transfer_id, date, amount, notes, created_at) VALUES (?,?,?,?,?,?)`,
      [id, input.planned_transfer_id, input.date, input.amount, input.notes ?? null, now]
    );
    const rows = this.db.query<PlannedTransferEntry>("SELECT * FROM planned_transfer_entries WHERE id = ?", [id]);
    return rows[0];
  }

  updateEntry(id: string, input: { date?: string; amount?: number; notes?: string }): PlannedTransferEntry | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.date !== undefined) { fields.push("date = ?"); values.push(input.date); }
    if (input.amount !== undefined) { fields.push("amount = ?"); values.push(input.amount); }
    if ("notes" in input) { fields.push("notes = ?"); values.push(input.notes ?? null); }
    if (fields.length === 0) {
      const rows = this.db.query<PlannedTransferEntry>("SELECT * FROM planned_transfer_entries WHERE id = ?", [id]);
      return rows[0] ?? null;
    }
    values.push(id);
    this.db.execute(`UPDATE planned_transfer_entries SET ${fields.join(", ")} WHERE id = ?`, values);
    const rows = this.db.query<PlannedTransferEntry>("SELECT * FROM planned_transfer_entries WHERE id = ?", [id]);
    return rows[0] ?? null;
  }

  deleteEntry(id: string): void {
    this.db.execute("DELETE FROM planned_transfer_entries WHERE id = ?", [id]);
  }

  private deserialize(row: PlannedTransfer): PlannedTransfer {
    return { ...row, is_variable: Boolean(row.is_variable), is_active: Boolean(row.is_active) };
  }
}
