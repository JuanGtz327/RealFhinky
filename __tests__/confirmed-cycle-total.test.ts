import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";

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

describe("confirmed_cycle_total", () => {
  let db: IDatabase;
  let accRepo: AccountsRepository;
  let cpRepo: CyclePaymentsRepository;
  let creditAccountId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    accRepo = new AccountsRepository(db);
    cpRepo = new CyclePaymentsRepository(db);

    const credit = accRepo.create({
      name: "Amex Gold",
      type: "credit",
      bank: "Amex",
      current_balance: 15000,
      credit_limit: 80000,
      cut_date: 10,
    });
    creditAccountId = credit.id;
  });

  afterEach(() => db.close());

  it("default es null cuando no se proporciona", () => {
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
    });

    expect(payment.confirmed_cycle_total).toBeNull();
  });

  it("se almacena y recupera correctamente", () => {
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
      confirmed_cycle_total: 6200.50,
    });

    expect(payment.confirmed_cycle_total).toBe(6200.50);

    const fetched = cpRepo.findByAccountAndMonth(creditAccountId, "2026-11");
    expect(fetched).not.toBeNull();
    expect(fetched!.confirmed_cycle_total).toBe(6200.50);
  });

  it("se puede guardar como null explícito (sin override)", () => {
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
      confirmed_cycle_total: null,
    });

    expect(payment.confirmed_cycle_total).toBeNull();
  });

  it("update via PUT cambia el valor", () => {
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
    });
    expect(payment.confirmed_cycle_total).toBeNull();

    const updated = cpRepo.update(payment.id, {
      confirmed_cycle_total: 7500,
    });
    expect(updated.confirmed_cycle_total).toBe(7500);

    const fetched = cpRepo.findByAccountAndMonth(creditAccountId, "2026-11");
    expect(fetched!.confirmed_cycle_total).toBe(7500);
  });

  it("update puede resetear a null", () => {
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
      confirmed_cycle_total: 7500,
    });
    expect(payment.confirmed_cycle_total).toBe(7500);

    const updated = cpRepo.update(payment.id, {
      confirmed_cycle_total: null,
    });
    expect(updated.confirmed_cycle_total).toBeNull();
  });

  it("effectiveTotal usa confirmed cuando existe, computed cuando no", () => {
    const computedTotal = 4800;
    const confirmedTotal: number | null = 6200;

    const effectiveWithConfirmed = confirmedTotal ?? computedTotal;
    expect(effectiveWithConfirmed).toBe(6200);

    const noConfirmed: number | null = null;
    const effectiveWithoutConfirmed = noConfirmed ?? computedTotal;
    expect(effectiveWithoutConfirmed).toBe(4800);
  });

  it("findByAccounts incluye confirmed_cycle_total", () => {
    const credit2 = accRepo.create({
      name: "BBVA Platinum",
      type: "credit",
      bank: "BBVA",
      current_balance: 8000,
      credit_limit: 50000,
      cut_date: 15,
    });

    cpRepo.create({
      account_id: creditAccountId,
      cycle_month: "2026-11",
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-11-15",
      confirmed_cycle_total: 6200,
    });

    cpRepo.create({
      account_id: credit2.id,
      cycle_month: "2026-11",
      amount_due: 3000,
      amount_paid: 3000,
      paid_date: "2026-11-20",
    });

    const payments = cpRepo.findByAccounts([creditAccountId, credit2.id]);
    expect(payments).toHaveLength(2);

    const amexPayment = payments.find((p) => p.account_id === creditAccountId);
    const bbvaPayment = payments.find((p) => p.account_id === credit2.id);

    expect(amexPayment!.confirmed_cycle_total).toBe(6200);
    expect(bbvaPayment!.confirmed_cycle_total).toBeNull();
  });
});
