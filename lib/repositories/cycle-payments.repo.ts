import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { CyclePayment } from "@/lib/types";

export interface CreateCyclePaymentInput {
  account_id: string;
  cycle_month: string;
  amount_due: number;
  amount_paid: number;
  paid_date: string;
  notes?: string;
  paid_from_account_id?: string | null;
  confirmed_cycle_total?: number | null;
}

export interface UpdateCyclePaymentInput {
  amount_paid?: number;
  paid_date?: string;
  notes?: string;
  confirmed_cycle_total?: number | null;
}

export class CyclePaymentsRepository {
  constructor(private db: IDatabase) {}

  findByAccount(accountId: string): CyclePayment[] {
    return this.db.query<CyclePayment>(
      "SELECT * FROM cycle_payments WHERE account_id = ? ORDER BY cycle_month DESC",
      [accountId]
    ).map(this.deserialize);
  }

  findByAccountAndMonth(accountId: string, cycleMonth: string): CyclePayment | null {
    const rows = this.db.query<CyclePayment>(
      "SELECT * FROM cycle_payments WHERE account_id = ? AND cycle_month = ?",
      [accountId, cycleMonth]
    );
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  findByAccounts(accountIds: string[]): CyclePayment[] {
    if (accountIds.length === 0) return [];
    const placeholders = accountIds.map(() => "?").join(",");
    return this.db.query<CyclePayment>(
      `SELECT * FROM cycle_payments WHERE account_id IN (${placeholders}) ORDER BY cycle_month DESC`,
      accountIds
    ).map(this.deserialize);
  }

  create(input: CreateCyclePaymentInput): CyclePayment {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO cycle_payments (id, account_id, cycle_month, amount_due, amount_paid, paid_date, notes, paid_from_account_id, confirmed_cycle_total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.account_id, input.cycle_month, input.amount_due, input.amount_paid, input.paid_date, input.notes ?? null, input.paid_from_account_id ?? null, input.confirmed_cycle_total ?? null, now]
    );
    return this.findByAccountAndMonth(input.account_id, input.cycle_month)!;
  }

  update(id: string, input: UpdateCyclePaymentInput): CyclePayment {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.amount_paid !== undefined) { fields.push("amount_paid = ?"); values.push(input.amount_paid); }
    if (input.paid_date !== undefined) { fields.push("paid_date = ?"); values.push(input.paid_date); }
    if (input.notes !== undefined) { fields.push("notes = ?"); values.push(input.notes); }
    if (input.confirmed_cycle_total !== undefined) { fields.push("confirmed_cycle_total = ?"); values.push(input.confirmed_cycle_total); }
    if (fields.length === 0) {
      const rows = this.db.query<CyclePayment>("SELECT * FROM cycle_payments WHERE id = ?", [id]);
      return this.deserialize(rows[0]);
    }
    values.push(id);
    this.db.execute(`UPDATE cycle_payments SET ${fields.join(", ")} WHERE id = ?`, values as never[]);
    const rows = this.db.query<CyclePayment>("SELECT * FROM cycle_payments WHERE id = ?", [id]);
    return this.deserialize(rows[0]);
  }

  delete(id: string): void {
    this.db.execute("DELETE FROM cycle_payments WHERE id = ?", [id]);
  }

  private deserialize(row: CyclePayment): CyclePayment {
    return { ...row };
  }
}
