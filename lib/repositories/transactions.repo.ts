import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { Transaction, TransactionType } from "@/lib/types";
import { expandMsi, billingStartDate } from "@/lib/utils/msi";
import { balanceDelta as computeDelta } from "@/lib/domain/balance";

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
  income_entry_id?: string | null;
  cycle_payment_id?: string | null;
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

  findByIncomeEntryId(incomeEntryId: string): Transaction | null {
    const rows = this.db.query<Transaction>(
      "SELECT * FROM transactions WHERE income_entry_id = ?",
      [incomeEntryId]
    );
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  findByCyclePaymentId(cyclePaymentId: string): Transaction[] {
    return this.db.query<Transaction>(
      "SELECT * FROM transactions WHERE cycle_payment_id = ?",
      [cyclePaymentId]
    ).map(this.deserialize);
  }

  /** Calcula el delta que una transacción aplica al saldo de la cuenta. */
  balanceDelta(type: TransactionType, amount: number, accountType?: string): number {
    return computeDelta(type, amount, accountType);
  }

  create(input: CreateTransactionInput): Transaction {
    const id = randomUUID();
    const now = new Date().toISOString();
    const isMsi = Boolean(input.is_msi && input.msi_months && input.msi_months > 1);

    // Query account early — needed for cut_date (billing month) and balance delta
    const account = this.db.query<{ type: string; cut_date: number | null }>(
      "SELECT type, cut_date FROM accounts WHERE id = ?", [input.account_id]
    )[0];

    // For MSI: if purchase is after the cut date, first installment falls in the next month
    const msiStartDate = (isMsi && input.msi_months && account?.cut_date)
      ? billingStartDate(input.date, account.cut_date)
      : input.date;

    let monthlyAmount: number | null = null;
    let residual: number | null = null;
    let msiInstallments: ReturnType<typeof expandMsi>["installments"] | null = null;

    if (isMsi && input.msi_months) {
      const { monthlyAmount: ma, residual: r, installments } = expandMsi(input.amount, input.msi_months, msiStartDate);
      monthlyAmount = ma;
      residual = r;
      msiInstallments = installments;
    }

    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO transactions (
          id, account_id, date, merchant, description, amount, category, type,
          is_msi, msi_months, msi_monthly_amount, msi_residual, msi_start_date,
          notes, income_entry_id, cycle_payment_id, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, input.account_id, input.date,
          input.merchant ?? null, input.description ?? null,
          input.amount, input.category ?? null, input.type,
          isMsi ? 1 : 0,
          isMsi ? input.msi_months! : null,
          monthlyAmount, residual,
          isMsi ? msiStartDate : null,
          input.notes ?? null, input.income_entry_id ?? null, input.cycle_payment_id ?? null, now,
        ]
      );

      if (isMsi && msiInstallments) {
        const installments = msiInstallments;
        for (const inst of installments) {
          this.db.execute(
            `INSERT INTO msi_installments (id, transaction_id, account_id, month, amount, is_last)
             VALUES (?,?,?,?,?,?)`,
            [randomUUID(), id, input.account_id, inst.month, inst.amount, inst.isLast ? 1 : 0]
          );
        }
      }

      const delta = this.balanceDelta(input.type, input.amount, account?.type);
      this.db.execute(
        "UPDATE accounts SET current_balance = current_balance + ?, updated_at = ? WHERE id = ?",
        [delta, now, input.account_id]
      );
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
    const tx = this.findById(id);
    if (!tx) return;
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const account = this.db.query<{ type: string }>(
        "SELECT type FROM accounts WHERE id = ?", [tx.account_id]
      )[0];
      // Revertir el delta aplicado al crear
      const delta = -this.balanceDelta(tx.type, tx.amount, account?.type);
      this.db.execute(
        "UPDATE accounts SET current_balance = current_balance + ?, updated_at = ? WHERE id = ?",
        [delta, now, tx.account_id]
      );
      this.db.execute("DELETE FROM transactions WHERE id = ?", [id]);
    });
  }

  sumByAccountAndMonth(accountId: string, yearMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE account_id = ? AND strftime('%Y-%m', date) = ?
         AND type IN ('purchase','transfer_out')
         AND (is_msi = 0 OR is_msi IS NULL)`,
      [accountId, yearMonth]
    );
    return rows[0]?.total ?? 0;
  }

  sumPurchasesByPeriod(accountId: string, periodStart: string, periodEnd: string): number {
    const rows = this.db.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE account_id = ? AND date >= ? AND date <= ?
         AND type IN ('purchase','transfer_out')
         AND (is_msi = 0 OR is_msi IS NULL)`,
      [accountId, periodStart, periodEnd]
    );
    return rows[0]?.total ?? 0;
  }

  sumCreditsByPeriod(accountId: string, periodStart: string, periodEnd: string, excludeCyclePayments = false): number {
    const sql = excludeCyclePayments
      ? `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE account_id = ? AND date >= ? AND date <= ?
           AND type = 'transfer_in' AND cycle_payment_id IS NULL`
      : `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE account_id = ? AND date >= ? AND date <= ?
           AND type = 'transfer_in'`;
    const rows = this.db.query<{ total: number }>(sql, [accountId, periodStart, periodEnd]);
    return rows[0]?.total ?? 0;
  }


  private deserialize(row: Transaction): Transaction {
    return { ...row, is_msi: Boolean(row.is_msi) };
  }
}
