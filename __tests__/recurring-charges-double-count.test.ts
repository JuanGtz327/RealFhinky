import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";
import { roundCents } from "@/lib/utils/msi";

function createInMemoryDb(): IDatabase {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(process.cwd(), "lib/db/schema.sql"), "utf-8");
  db.exec(schema);
  return {
    query<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    execute(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params);
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close(): void {
      db.close();
    },
  };
}

describe("recurring charge entry — transaction_id persistence", () => {
  let db: IDatabase;
  let accRepo: AccountsRepository;
  let txRepo: TransactionsRepository;
  let rcRepo: RecurringChargesRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    accRepo = new AccountsRepository(db);
    txRepo = new TransactionsRepository(db);
    rcRepo = new RecurringChargesRepository(db);
  });

  afterEach(() => db.close());

  it("createEntry persists transaction_id when provided", () => {
    const acc = accRepo.create({
      name: "Amex", type: "credit", bank: "Amex",
      credit_limit: 50000, current_balance: 5000,
    });
    const tx = txRepo.create({
      account_id: acc.id, date: "2026-11-15", merchant: "Netflix",
      amount: 299, type: "purchase", category: "Suscripciones",
    });
    const charge = rcRepo.create({
      name: "Netflix", account_id: acc.id,
      frequency: "monthly", base_amount: 299, start_date: "2026-01-15",
    });

    const entry = rcRepo.createEntry({
      recurring_charge_id: charge.id,
      date: "2026-11-15",
      amount: 299,
      transaction_id: tx.id,
    });

    expect(entry.transaction_id).toBe(tx.id);
  });

  it("entry with transaction_id is excluded from confirmedWithoutTx (anti-double-count)", () => {
    const acc = accRepo.create({
      name: "BBVA", type: "credit", bank: "BBVA",
      credit_limit: 30000, current_balance: 2000,
    });
    const tx = txRepo.create({
      account_id: acc.id, date: "2026-11-10", merchant: "Spotify",
      amount: 149, type: "purchase", category: "Suscripciones",
    });
    const charge = rcRepo.create({
      name: "Spotify", account_id: acc.id,
      frequency: "monthly", base_amount: 149, start_date: "2026-01-01",
    });

    rcRepo.createEntry({
      recurring_charge_id: charge.id,
      date: "2026-11-10",
      amount: 149,
      transaction_id: tx.id,
    });

    const entries = rcRepo.findEntriesByChargeAndMonth(charge.id, "2026-11");
    expect(entries).toHaveLength(1);

    // This is the exact logic from app/dashboard/flow/page.tsx:203-204
    // Entries WITH transaction_id should NOT be summed here (they're already in purchases)
    const confirmedWithoutTx = roundCents(
      entries.filter((e) => !e.transaction_id).reduce((s, e) => s + e.amount, 0)
    );

    // If transaction_id was persisted correctly, confirmedWithoutTx should be 0
    // because the entry's amount is already counted as a purchase transaction.
    // If it's 149, that means double-counting.
    expect(confirmedWithoutTx).toBe(0);
  });
});
