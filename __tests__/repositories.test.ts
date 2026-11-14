import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";

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

describe("AccountsRepository", () => {
  let db: IDatabase;
  let repo: AccountsRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    repo = new AccountsRepository(db);
  });

  afterEach(() => db.close());

  it("crea y recupera una cuenta", () => {
    const account = repo.create({ name: "BBVA Azul", type: "credit", bank: "BBVA", last4: "1234", credit_limit: 50000, current_balance: 10000 });
    expect(account.id).toBeDefined();
    expect(account.name).toBe("BBVA Azul");
    expect(account.type).toBe("credit");
  });

  it("lista solo cuentas activas", () => {
    repo.create({ name: "Cuenta 1", type: "debit", bank: "HSBC", current_balance: 1000 });
    repo.create({ name: "Cuenta 2", type: "debit", bank: "Banorte", current_balance: 2000 });
    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("actualiza una cuenta", () => {
    const account = repo.create({ name: "Nómina", type: "debit", bank: "HSBC", current_balance: 5000 });
    const updated = repo.update(account.id, { current_balance: 7500 });
    expect(updated?.current_balance).toBe(7500);
  });

  it("soft-delete desactiva la cuenta", () => {
    const account = repo.create({ name: "Vieja", type: "credit", bank: "BX+", current_balance: 0 });
    repo.delete(account.id);
    const found = repo.findById(account.id);
    expect(found?.is_active).toBe(false);
    expect(repo.findAll()).toHaveLength(0);
  });

  it("filtra cuentas por tipo", () => {
    repo.create({ name: "Crédito", type: "credit", bank: "BBVA", current_balance: 0 });
    repo.create({ name: "Débito", type: "debit", bank: "HSBC", current_balance: 1000 });
    expect(repo.findByType("credit")).toHaveLength(1);
    expect(repo.findByType("debit")).toHaveLength(1);
  });
});

describe("TransactionsRepository", () => {
  let db: IDatabase;
  let accountId: string;
  let txRepo: TransactionsRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    const accRepo = new AccountsRepository(db);
    const acc = accRepo.create({ name: "Amex", type: "credit", bank: "Amex", current_balance: 0 });
    accountId = acc.id;
    txRepo = new TransactionsRepository(db);
  });

  afterEach(() => db.close());

  it("crea una transacción normal", () => {
    const tx = txRepo.create({ account_id: accountId, date: "2025-06-10", merchant: "Oxxo", amount: 150, type: "purchase" });
    expect(tx.id).toBeDefined();
    expect(tx.merchant).toBe("Oxxo");
    expect(tx.is_msi).toBe(false);
  });

  it("crea una transacción MSI y expande installments", () => {
    const tx = txRepo.create({ account_id: accountId, date: "2025-01-15", merchant: "Samsung", amount: 12000, type: "purchase", is_msi: true, msi_months: 12 });
    expect(tx.is_msi).toBe(true);
    expect(tx.msi_months).toBe(12);
    expect(tx.msi_monthly_amount).toBe(1000);
    expect(tx.msi_residual).toBe(0);

    const installments = db.query("SELECT * FROM msi_installments WHERE transaction_id = ?", [tx.id]);
    expect(installments).toHaveLength(12);
  });

  it("calcula residual MSI correcto en installments", () => {
    const tx = txRepo.create({ account_id: accountId, date: "2025-01-01", merchant: "Apple", amount: 1250, type: "purchase", is_msi: true, msi_months: 12 });
    const installments = db.query<{ amount: number; is_last: number }>("SELECT * FROM msi_installments WHERE transaction_id = ? ORDER BY month", [tx.id]);
    const last = installments[installments.length - 1];
    expect(last.is_last).toBe(1);
    // El último mes absorbe el ajuste de redondeo — diferencia máxima de céntimos
    expect(Math.abs(last.amount - installments[0].amount)).toBeLessThanOrEqual(12 * 0.005);
    const total = installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBeCloseTo(1250, 2);
  });
});

describe("IncomeRepository", () => {
  let db: IDatabase;
  let repo: IncomeRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    repo = new IncomeRepository(db);
  });

  afterEach(() => db.close());

  it("crea y lista fuentes de ingreso", () => {
    repo.createSource({ name: "Nómina principal", frequency: "biweekly", base_amount: 15000 });
    const sources = repo.findAllSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe("Nómina principal");
  });

  it("registra una entrada de ingreso", () => {
    const source = repo.createSource({ name: "Freelance", frequency: "custom", base_amount: 5000, is_variable: true });
    const entry = repo.createEntry({ income_source_id: source.id, date: "2025-06-15", amount: 7500 });
    expect(entry.amount).toBe(7500);
  });

  it("suma ingresos por mes", () => {
    const source = repo.createSource({ name: "Nómina", frequency: "biweekly", base_amount: 15000 });
    repo.createEntry({ income_source_id: source.id, date: "2025-06-01", amount: 15000 });
    repo.createEntry({ income_source_id: source.id, date: "2025-06-15", amount: 15000 });
    repo.createEntry({ income_source_id: source.id, date: "2025-07-01", amount: 15000 });
    expect(repo.sumByMonth("2025-06")).toBe(30000);
    expect(repo.sumByMonth("2025-07")).toBe(15000);
  });
});
