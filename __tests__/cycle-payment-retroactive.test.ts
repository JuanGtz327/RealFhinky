import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { format, addMonths } from "date-fns";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
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

function computeOnboardingEffective(createdAt: string, cutDate: number | null | undefined): string {
  const d = new Date(createdAt.slice(0, 10) + "T12:00:00");
  if (cutDate && d.getDate() > cutDate) {
    return format(addMonths(d, 1), "yyyy-MM");
  }
  return format(d, "yyyy-MM");
}

describe("Cycle payment retroactive check", () => {
  let db: IDatabase;
  let accRepo: AccountsRepository;
  let txRepo: TransactionsRepository;
  let cpRepo: CyclePaymentsRepository;
  let creditAccountId: string;
  let debitAccountId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    accRepo = new AccountsRepository(db);
    txRepo = new TransactionsRepository(db);
    cpRepo = new CyclePaymentsRepository(db);

    const credit = accRepo.create({
      name: "Amex Gold",
      type: "credit",
      bank: "Amex",
      current_balance: 15000,
      credit_limit: 80000,
      cut_date: 10,
      payment_due_date: 1,
    });
    creditAccountId = credit.id;

    const debit = accRepo.create({
      name: "BBVA Débito",
      type: "debit",
      bank: "BBVA",
      current_balance: 200000,
    });
    debitAccountId = debit.id;
  });

  afterEach(() => db.close());

  it("ciclo pasado (antes de effectiveMonth al onboardear) es retroactivo → no crea transacciones", () => {
    const credit = accRepo.findById(creditAccountId)!;
    // Account was created today (2026-11-18). Cut date = 10.
    // Since 18 > 10, effective month at onboarding = 2026-12.
    const effective = computeOnboardingEffective(credit.created_at, credit.cut_date);
    expect(effective).toBe("2026-12");

    // Confirming October cycle (2026-10) → retroactive
    const cycleMonth = "2026-10";
    expect(cycleMonth < effective).toBe(true);

    // Create the cycle payment (always created for tracking)
    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: cycleMonth,
      amount_due: 5000,
      amount_paid: 5000,
      paid_date: "2026-10-25",
      paid_from_account_id: debitAccountId,
    });
    expect(payment.id).toBeTruthy();

    // No auto-transactions should be created
    const linkedTx = txRepo.findByCyclePaymentId(payment.id);
    expect(linkedTx).toHaveLength(0);

    // Debit balance unchanged
    expect(accRepo.findById(debitAccountId)!.current_balance).toBe(200000);
  });

  it("ciclo noviembre (< effective 2026-12) es retroactivo → no crea transacciones", () => {
    const credit = accRepo.findById(creditAccountId)!;
    const effective = computeOnboardingEffective(credit.created_at, credit.cut_date);

    // November cycle has already cut (cut_date=10, today=18), so it's < effective
    const cycleMonth = "2026-11";
    expect(cycleMonth < effective).toBe(true);

    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: cycleMonth,
      amount_due: 8000,
      amount_paid: 8000,
      paid_date: "2026-11-18",
      paid_from_account_id: debitAccountId,
    });

    const linkedTx = txRepo.findByCyclePaymentId(payment.id);
    expect(linkedTx).toHaveLength(0);
    expect(accRepo.findById(debitAccountId)!.current_balance).toBe(200000);
  });

  it("ciclo diciembre (>= effective) NO es retroactivo → crea transacciones", () => {
    const credit = accRepo.findById(creditAccountId)!;
    const effective = computeOnboardingEffective(credit.created_at, credit.cut_date);
    expect(effective).toBe("2026-12");

    const cycleMonth = "2026-12";
    expect(cycleMonth >= effective).toBe(true);

    const payment = cpRepo.create({
      account_id: creditAccountId,
      cycle_month: cycleMonth,
      amount_due: 12000,
      amount_paid: 12000,
      paid_date: "2026-12-20",
      paid_from_account_id: debitAccountId,
    });

    // Simulate the API logic for non-retroactive: create transactions
    txRepo.create({
      account_id: creditAccountId,
      date: "2026-12-20",
      merchant: `Pago ${credit.name}`,
      amount: 12000,
      category: "Pago tarjeta",
      type: "transfer_in",
      cycle_payment_id: payment.id,
    });
    txRepo.create({
      account_id: debitAccountId,
      date: "2026-12-20",
      merchant: `Pago ${credit.name}`,
      amount: 12000,
      category: "Pago tarjeta",
      type: "transfer_out",
      cycle_payment_id: payment.id,
    });

    const linkedTx = txRepo.findByCyclePaymentId(payment.id);
    expect(linkedTx).toHaveLength(2);

    // Debit balance reduced, credit balance reduced
    expect(accRepo.findById(debitAccountId)!.current_balance).toBe(200000 - 12000);
    expect(accRepo.findById(creditAccountId)!.current_balance).toBe(15000 - 12000);
  });

  it("tarjeta sin cut_date: effective = mes de created_at → ciclo mismo mes NO es retroactivo", () => {
    // Create a credit card without cut_date
    const noCut = accRepo.create({
      name: "Visa Simple",
      type: "credit",
      bank: "Banorte",
      current_balance: 5000,
      credit_limit: 30000,
    });

    const effective = computeOnboardingEffective(noCut.created_at, noCut.cut_date);
    // No cut date → effective = created month (2026-11)
    expect(effective).toBe("2026-11");

    // Same month → NOT retroactive
    expect("2026-11" >= effective).toBe(true);
    // Previous month → retroactive
    expect("2026-10" < effective).toBe(true);
  });

  it("tarjeta creada ANTES del cut_date: effective = mismo mes", () => {
    // Create card on day 5, cut_date = 10 → 5 <= 10 → effective = same month
    const early = accRepo.create({
      name: "MC Early",
      type: "credit",
      bank: "HSBC",
      current_balance: 3000,
      credit_limit: 50000,
      cut_date: 25,
    });
    // Override created_at to simulate creation on the 5th
    db.execute("UPDATE accounts SET created_at = ? WHERE id = ?", ["2026-11-05T10:00:00.000Z", early.id]);
    const updated = accRepo.findById(early.id)!;

    const effective = computeOnboardingEffective(updated.created_at, updated.cut_date);
    // 5 <= 25, so effective = 2026-11
    expect(effective).toBe("2026-11");

    // November cycle is NOT retroactive (>= effective)
    expect("2026-11" >= effective).toBe(true);
    // October is retroactive
    expect("2026-10" < effective).toBe(true);
  });
});
