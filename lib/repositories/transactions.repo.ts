import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { Transaction, TransactionType } from "@/lib/types";
import { expandMsi } from "@/lib/utils/msi";

export interface CreateTransactionInput {
  account_id: string;
  date: string;
  merchant?: string;
  description?: string;
  amount: number;
  category?: string;
  type: TransactionType;
  is_msi?: boolean;
  msi_months?: number;
  notes?: string;
}

export class TransactionsRepository {
  constructor(private db: IDatabase) {}

  findAll(limit = 100, offset = 0): Transaction[] {
    return this.db
      .query<Transaction>(
        "SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
      )
      .map(this.deserialize);
  }

  findByAccount(accountId: string, limit = 100, offset = 0): Transaction[] {
    return this.db
      .query<Transaction>(
        "SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT ? OFFSET ?",
        [accountId, limit, offset]
      )
      .map(this.deserialize);
  }

  findByMonth(yearMonth: string): Transaction[] {
    return this.db
      .query<Transaction>(
        "SELECT * FROM transactions WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC",
        [yearMonth]
      )
      .map(this.deserialize);
  }

  findById(id: string): Transaction | null {
    const rows = this.db.query<Transaction>("SELECT * FROM transactions WHERE id = ?", [id]);
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  create(input: CreateTransactionInput): Transaction {
    const id = randomUUID();
    const now = new Date().toISOString();
    const isMsi = Boolean(input.is_msi && input.msi_months && input.msi_months > 1);

    let monthlyAmount: number | null = null;
    let residual: number | null = null;

    if (isMsi && input.msi_months) {
      const { monthlyAmount: ma, residual: r } = expandMsi(input.amount, input.msi_months);
      monthlyAmount = ma;
      residual = r;
    }

    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO transactions (
          id, account_id, date, merchant, description, amount, category, type,
          is_msi, msi_months, msi_monthly_amount, msi_residual, msi_start_date,
          notes, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, input.account_id, input.date,
          input.merchant ?? null, input.description ?? null,
          input.amount, input.category ?? null, input.type,
          isMsi ? 1 : 0,
          isMsi ? input.msi_months! : null,
          monthlyAmount, residual,
          isMsi ? input.date : null,
          input.notes ?? null, now,
        ]
      );

      if (isMsi && input.msi_months) {
        const installments = expandMsi(input.amount, input.msi_months).installments;
        for (const inst of installments) {
          this.db.execute(
            `INSERT INTO msi_installments (id, transaction_id, account_id, month, amount, is_last)
             VALUES (?,?,?,?,?,?)`,
            [randomUUID(), id, input.account_id, inst.month, inst.amount, inst.isLast ? 1 : 0]
          );
        }
      }
    });

    return this.findById(id)!;
  }

  update(id: string, input: Partial<CreateTransactionInput>): Transaction | null {
    const allowed = ["date", "merchant", "description", "amount", "category", "type", "notes"];
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
    this.db.execute(`UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.execute("DELETE FROM transactions WHERE id = ?", [id]);
  }

  sumByAccountAndMonth(accountId: string, yearMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE account_id = ? AND strftime('%Y-%m', date) = ?
         AND type IN ('purchase','transfer_out')`,
      [accountId, yearMonth]
    );
    return rows[0]?.total ?? 0;
  }

  private deserialize(row: Transaction): Transaction {
    return { ...row, is_msi: Boolean(row.is_msi) };
  }
}
