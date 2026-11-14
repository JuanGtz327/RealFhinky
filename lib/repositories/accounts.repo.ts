import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { Account, AccountType } from "@/lib/types";

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  bank: string;
  last4?: string;
  credit_limit?: number;
  current_balance?: number;
  yield_rate?: number;
  cut_date?: number;
  payment_due_date?: number;
  annual_fee?: number;
  annual_fee_date?: string;
}

export interface UpdateAccountInput extends Partial<CreateAccountInput> {
  is_active?: boolean;
  opening_balance_carryover?: number;
}

export class AccountsRepository {
  constructor(private db: IDatabase) {}

  findAll(activeOnly = true): Account[] {
    const sql = activeOnly
      ? "SELECT * FROM accounts WHERE is_active = 1 ORDER BY type, bank, name"
      : "SELECT * FROM accounts ORDER BY type, bank, name";
    return this.db.query<Account>(sql).map(this.deserialize);
  }

  findById(id: string): Account | null {
    const rows = this.db.query<Account>("SELECT * FROM accounts WHERE id = ?", [id]);
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  findByType(type: AccountType, activeOnly = true): Account[] {
    const sql = activeOnly
      ? "SELECT * FROM accounts WHERE type = ? AND is_active = 1 ORDER BY bank, name"
      : "SELECT * FROM accounts WHERE type = ? ORDER BY bank, name";
    return this.db.query<Account>(sql, [type]).map(this.deserialize);
  }

  create(input: CreateAccountInput): Account {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO accounts (
        id, name, type, bank, last4, credit_limit, current_balance,
        yield_rate, cut_date, payment_due_date, annual_fee, annual_fee_date,
        is_active, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id, input.name, input.type, input.bank,
        input.last4 ?? null,
        input.credit_limit ?? null,
        input.current_balance ?? 0,
        input.yield_rate ?? null,
        input.cut_date ?? null,
        input.payment_due_date ?? null,
        input.annual_fee ?? null,
        input.annual_fee_date ?? null,
        now, now,
      ]
    );
    return this.findById(id)!;
  }

  update(id: string, input: UpdateAccountInput): Account | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    const allowed: (keyof UpdateAccountInput)[] = [
      "name", "type", "bank", "last4", "credit_limit", "current_balance",
      "yield_rate", "cut_date", "payment_due_date", "annual_fee",
      "annual_fee_date", "is_active", "opening_balance_carryover",
    ];
    for (const key of allowed) {
      if (key in input) {
        fields.push(`${key} = ?`);
        values.push(input[key] ?? null);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push("updated_at = ?");
    values.push(new Date().toISOString(), id);
    this.db.execute(`UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.execute("UPDATE accounts SET is_active = 0 WHERE id = ?", [id]);
  }

  private deserialize(row: Account): Account {
    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }
}
