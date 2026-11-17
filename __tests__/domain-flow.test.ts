import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { IDatabase } from "@/lib/db/adapter";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { computeFlowRows } from "@/lib/domain/flow";

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

describe("computeFlowRows", () => {
  let db: IDatabase;
  let accRepo: AccountsRepository;
  let txRepo: TransactionsRepository;
  let incRepo: IncomeRepository;
  let msiRepo: MsiRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    accRepo = new AccountsRepository(db);
    txRepo  = new TransactionsRepository(db);
    incRepo = new IncomeRepository(db);
    msiRepo = new MsiRepository(db);
  });

  afterEach(() => db.close());

  it("retorna 12 filas (una por mes)", () => {
    const { rows } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe("2026-01");
    expect(rows[11].month).toBe("2026-12");
  });

  it("capital_fin = capital_inicio + ingresos_totales − gastos_totales", () => {
    const debit = accRepo.create({ name: "BBVA", type: "debit", bank: "BBVA", current_balance: 50000 });
    const credit = accRepo.create({ name: "Amex", type: "credit", bank: "Amex", credit_limit: 50000, current_balance: 0 });

    // Ingreso externo en débito (type=income)
    txRepo.create({ account_id: debit.id, date: "2026-03-10", merchant: "Empresa", amount: 20000, type: "income" });
    // Gasto en crédito (purchase)
    txRepo.create({ account_id: credit.id, date: "2026-03-15", merchant: "Amazon", amount: 5000, type: "purchase" });

    const { rows } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    const marzo = rows.find((r) => r.month === "2026-03")!;

    expect(marzo.abonos).toBe(20000);
    expect(marzo.tarjetas).toBe(5000);
    expect(marzo.ingresos_totales).toBe(20000);
    expect(marzo.gastos_totales).toBe(5000);
    expect(marzo.capital_fin).toBe(marzo.capital_inicio + 20000 - 5000);
  });

  it("transfer_in y transfer_out en débito NO cuentan en flujo (neutrales)", () => {
    const debit1 = accRepo.create({ name: "BBVA", type: "debit", bank: "BBVA", current_balance: 50000 });
    const debit2 = accRepo.create({ name: "Nu",   type: "debit", bank: "Nu",   current_balance: 10000 });

    // Transferencia entre cuentas propias: sale de debit1, entra a debit2
    txRepo.create({ account_id: debit1.id, date: "2026-04-05", merchant: "Traspaso", amount: 5000, type: "transfer_out" });
    txRepo.create({ account_id: debit2.id, date: "2026-04-05", merchant: "Traspaso", amount: 5000, type: "transfer_in" });

    const { rows } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    const abril = rows.find((r) => r.month === "2026-04")!;

    // Transferencias aparecen en columna informativa pero NO en gastos
    expect(abril.transferencias).toBe(5000);
    expect(abril.gastos_totales).toBe(0);
    expect(abril.ingresos_totales).toBe(0); // transfer_in no es income
  });

  it("capital_fin acumula mes a mes", () => {
    const debit  = accRepo.create({ name: "BBVA", type: "debit", bank: "BBVA", current_balance: 0 });
    const credit = accRepo.create({ name: "Amex", type: "credit", bank: "Amex", credit_limit: 50000, current_balance: 0 });

    txRepo.create({ account_id: debit.id,  date: "2026-01-05", merchant: "Nómina", amount: 10000, type: "income" });
    txRepo.create({ account_id: credit.id, date: "2026-01-10", merchant: "Gasto",  amount: 2000,  type: "purchase" });
    txRepo.create({ account_id: debit.id,  date: "2026-02-05", merchant: "Nómina", amount: 10000, type: "income" });

    const { rows } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    const enero   = rows.find((r) => r.month === "2026-01")!;
    const febrero = rows.find((r) => r.month === "2026-02")!;

    expect(enero.capital_fin).toBe(8000);         // 0 + 10000 − 2000
    expect(febrero.capital_inicio).toBe(8000);    // arranca donde terminó enero
    expect(febrero.capital_fin).toBe(18000);       // 8000 + 10000
  });

  it("columnas de préstamos se generan correctamente", () => {
    const loan = accRepo.create({ name: "Auto", type: "loan", bank: "Banorte", current_balance: 80000 });
    txRepo.create({ account_id: loan.id, date: "2026-05-01", merchant: "Abono", amount: 3000, type: "purchase" });

    const { rows, loanColumns } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    expect(loanColumns).toHaveLength(1);
    expect(loanColumns[0].name).toBe("Auto");

    const mayo = rows.find((r) => r.month === "2026-05")!;
    expect(mayo.loans[0].amount).toBe(3000);
    expect(mayo.gastos_totales).toBe(3000);
  });

  it("ingresos de income_sources (nómina) aparecen en nomina, no en abonos", () => {
    const source = incRepo.createSource({
      name: "Nómina principal", frequency: "monthly", base_amount: 15000, is_variable: false,
    });
    incRepo.createEntry({ income_source_id: source.id, date: "2026-06-01", amount: 15000 });

    const { rows } = computeFlowRows("2026", { accRepo, txRepo, incRepo, msiRepo });
    const junio = rows.find((r) => r.month === "2026-06")!;

    expect(junio.nomina).toBe(15000);
    expect(junio.abonos).toBe(0);
    expect(junio.ingresos_totales).toBe(15000);
  });
});
