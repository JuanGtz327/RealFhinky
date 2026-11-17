import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { computeBillingPeriod } from "@/lib/utils/billing";

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
    close(): void { db.close(); },
  };
}

describe("computeBillingPeriod", () => {
  it("con corte el 13, el ciclo de dic-2026 va del 14-nov al 13-dic", () => {
    const { periodStart, periodEnd } = computeBillingPeriod("2026-12", 13);
    expect(periodStart).toBe("2026-11-14");
    expect(periodEnd).toBe("2026-12-13");
  });

  it("con corte el 20, el ciclo de dic-2026 va del 21-nov al 20-dic", () => {
    const { periodStart, periodEnd } = computeBillingPeriod("2026-12", 20);
    expect(periodStart).toBe("2026-11-21");
    expect(periodEnd).toBe("2026-12-20");
  });

  it("sin cut_date usa mes calendario completo", () => {
    const { periodStart, periodEnd } = computeBillingPeriod("2026-12", null);
    expect(periodStart).toBe("2026-12-01");
    expect(periodEnd).toBe("2027-01-01");
  });

  it("con corte el 1, el período empieza el día 2 del mes anterior", () => {
    const { periodStart, periodEnd } = computeBillingPeriod("2026-12", 1);
    expect(periodStart).toBe("2026-11-02");
    expect(periodEnd).toBe("2026-12-01");
  });
});

describe("sumPurchasesByPeriod — período de facturación vs mes calendario", () => {
  let db: IDatabase;
  let accountId: string;
  let txRepo: TransactionsRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    const accRepo = new AccountsRepository(db);
    // Tarjeta con corte el día 13: ciclo dic = 14-nov → 13-dic
    const acc = accRepo.create({ name: "Revolut R", type: "credit", bank: "Revolut", current_balance: 0 });
    accountId = acc.id;
    txRepo = new TransactionsRepository(db);
  });

  afterEach(() => db.close());

  it("compra del 14-nov cae en ciclo dic (corte 13), aunque por calendario es noviembre", () => {
    // Con corte=13: ciclo nov = Oct-14→Nov-13, ciclo dic = Nov-14→Dic-13
    // Nov-14 está en noviembre por calendario, pero en el ciclo de diciembre por facturación
    txRepo.create({ account_id: accountId, date: "2026-11-14", merchant: "Gasolinería", amount: 657.88, type: "purchase" });

    const { periodStart: novStart, periodEnd: novEnd } = computeBillingPeriod("2026-11", 13);
    const { periodStart: dicStart, periodEnd: dicEnd } = computeBillingPeriod("2026-12", 13);

    // Ciclo nov: Oct-14 → Nov-13 — la compra del Nov-14 NO entra aquí
    expect(txRepo.sumPurchasesByPeriod(accountId, novStart, novEnd)).toBe(0);
    // Ciclo dic: Nov-14 → Dic-13 — la compra del Nov-14 SÍ entra aquí
    expect(txRepo.sumPurchasesByPeriod(accountId, dicStart, dicEnd)).toBeCloseTo(657.88, 2);
  });

  it("suma correcta con múltiples compras cruzando el límite de corte", () => {
    // Ciclo nov (corte 13): Oct-14 al Nov-13
    txRepo.create({ account_id: accountId, date: "2026-10-25", merchant: "Oxxo oct", amount: 100, type: "purchase" });
    // Ciclo dic (corte 13): Nov-14 al Dic-13
    txRepo.create({ account_id: accountId, date: "2026-11-14", merchant: "Gasolinería", amount: 657.88, type: "purchase" });
    txRepo.create({ account_id: accountId, date: "2026-11-14", merchant: "Oxxo A", amount: 140.50, type: "purchase" });
    txRepo.create({ account_id: accountId, date: "2026-11-14", merchant: "Oxxo B", amount: 151.50, type: "purchase" });
    txRepo.create({ account_id: accountId, date: "2026-12-01", merchant: "Saldo inicial", amount: 762.82, type: "purchase" });

    const { periodStart: novStart, periodEnd: novEnd } = computeBillingPeriod("2026-11", 13);
    const { periodStart: dicStart, periodEnd: dicEnd } = computeBillingPeriod("2026-12", 13);

    expect(txRepo.sumPurchasesByPeriod(accountId, novStart, novEnd)).toBeCloseTo(100, 2);
    expect(txRepo.sumPurchasesByPeriod(accountId, dicStart, dicEnd)).toBeCloseTo(657.88 + 140.50 + 151.50 + 762.82, 2);
  });

  it("abonos (transfer_in) se restan del total del período", () => {
    // Ciclo dic (corte 13): Nov-14 al Dic-13
    txRepo.create({ account_id: accountId, date: "2026-11-20", merchant: "Compra", amount: 1000, type: "purchase" });
    txRepo.create({ account_id: accountId, date: "2026-11-28", merchant: "Abono", amount: 500, type: "transfer_in" });

    const { periodStart: dicStart, periodEnd: dicEnd } = computeBillingPeriod("2026-12", 13);
    const purchases = txRepo.sumPurchasesByPeriod(accountId, dicStart, dicEnd);
    const credits   = txRepo.sumCreditsByPeriod(accountId, dicStart, dicEnd);

    expect(purchases).toBeCloseTo(1000, 2);
    expect(credits).toBeCloseTo(500, 2);
    expect(purchases - credits).toBeCloseTo(500, 2);
  });
});

describe("sumByAccountAndMonth (MSI) — cuotas siguen usando mes de facturación", () => {
  let db: IDatabase;
  let accountId: string;
  let txRepo: TransactionsRepository;
  let msiRepo: MsiRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    const accRepo = new AccountsRepository(db);
    const acc = accRepo.create({ name: "Amex", type: "credit", bank: "Amex", current_balance: 0 });
    accountId = acc.id;
    txRepo = new TransactionsRepository(db);
    msiRepo = new MsiRepository(db);
  });

  afterEach(() => db.close());

  it("cuotas MSI quedan en su mes de facturación, no en el mes de la compra", () => {
    // Compra en dic-2026 a 3 MSI: cuotas en dic, ene, feb
    txRepo.create({
      account_id: accountId,
      date: "2026-12-05",
      merchant: "Airbnb",
      amount: 2628,
      type: "purchase",
      is_msi: true,
      msi_months: 3,
    });

    expect(msiRepo.sumByAccountAndMonth(accountId, "2026-12")).toBeCloseTo(876, 2);
    expect(msiRepo.sumByAccountAndMonth(accountId, "2027-01")).toBeCloseTo(876, 2);
    expect(msiRepo.sumByAccountAndMonth(accountId, "2027-02")).toBeCloseTo(876, 2);
    // No hay cuota en noviembre
    expect(msiRepo.sumByAccountAndMonth(accountId, "2026-11")).toBe(0);
  });
});
