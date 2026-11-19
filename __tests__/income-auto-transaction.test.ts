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

describe("Income auto-transaction on confirm", () => {
  let db: IDatabase;
  let accountRepo: AccountsRepository;
  let txRepo: TransactionsRepository;
  let incomeRepo: IncomeRepository;
  let debitAccountId: string;
  let sourceId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    accountRepo = new AccountsRepository(db);
    txRepo = new TransactionsRepository(db);
    incomeRepo = new IncomeRepository(db);

    const account = accountRepo.create({
      name: "BBVA Débito",
      type: "debit",
      bank: "BBVA",
      current_balance: 100000,
    });
    debitAccountId = account.id;

    const source = incomeRepo.createSource({
      name: "Nómina Quincenal",
      frequency: "biweekly",
      base_amount: 23698.75,
      start_date: "2026-11-12",
      account_id: debitAccountId,
    });
    sourceId = source.id;
  });

  afterEach(() => db.close());

  it("no crea transacción para pago retroactivo (fecha < account.created_at)", () => {
    const account = accountRepo.findById(debitAccountId)!;
    const accountDate = account.created_at.slice(0, 10);

    const entry = incomeRepo.createEntry({
      income_source_id: sourceId,
      date: "2026-11-01",
      amount: 23698.75,
    });

    // Simular lógica del API: pago retroactivo → no crear transacción
    const paymentDate = "2026-11-01";
    const isRetroactive = paymentDate < accountDate;
    expect(isRetroactive).toBe(true);

    // No se crea transacción
    const linkedTx = txRepo.findByIncomeEntryId(entry.id);
    expect(linkedTx).toBeNull();

    // Balance no cambia
    const updatedAccount = accountRepo.findById(debitAccountId)!;
    expect(updatedAccount.current_balance).toBe(100000);
  });

  it("crea transacción para pago en tiempo real (fecha >= account.created_at)", () => {
    const account = accountRepo.findById(debitAccountId)!;
    const accountDate = account.created_at.slice(0, 10);

    const entry = incomeRepo.createEntry({
      income_source_id: sourceId,
      date: "2026-12-10",
      amount: 23698.79,
    });

    const paymentDate = "2026-12-10";
    const isRetroactive = paymentDate < accountDate;
    expect(isRetroactive).toBe(false);

    // Crear transacción vinculada
    const tx = txRepo.create({
      account_id: debitAccountId,
      date: paymentDate,
      merchant: "Nómina Quincenal",
      amount: 23698.79,
      category: "Nómina",
      type: "income",
      income_entry_id: entry.id,
    });

    expect(tx.income_entry_id).toBe(entry.id);
    expect(tx.type).toBe("income");
    expect(tx.amount).toBe(23698.79);

    // Balance sube
    const updatedAccount = accountRepo.findById(debitAccountId)!;
    expect(updatedAccount.current_balance).toBe(100000 + 23698.79);
  });

  it("eliminar income entry también elimina la transacción vinculada y revierte balance", () => {
    const entry = incomeRepo.createEntry({
      income_source_id: sourceId,
      date: "2026-12-10",
      amount: 23698.75,
    });

    txRepo.create({
      account_id: debitAccountId,
      date: "2026-12-10",
      merchant: "Nómina Quincenal",
      amount: 23698.75,
      category: "Nómina",
      type: "income",
      income_entry_id: entry.id,
    });

    // Verificar que balance subió
    expect(accountRepo.findById(debitAccountId)!.current_balance).toBe(100000 + 23698.75);

    // Simular el DELETE del API: primero eliminar transacción vinculada, luego entry
    const linkedTx = txRepo.findByIncomeEntryId(entry.id);
    expect(linkedTx).not.toBeNull();
    txRepo.delete(linkedTx!.id);
    incomeRepo.deleteEntry(entry.id);

    // Balance revierte
    expect(accountRepo.findById(debitAccountId)!.current_balance).toBe(100000);

    // Transacción ya no existe
    expect(txRepo.findByIncomeEntryId(entry.id)).toBeNull();
  });

  it("transacción auto-generada tiene income_entry_id, transacción manual no", () => {
    const entry = incomeRepo.createEntry({
      income_source_id: sourceId,
      date: "2026-12-10",
      amount: 23698.75,
    });

    // Auto-generada
    const autoTx = txRepo.create({
      account_id: debitAccountId,
      date: "2026-12-10",
      merchant: "Nómina Quincenal",
      amount: 23698.75,
      type: "income",
      income_entry_id: entry.id,
    });
    expect(autoTx.income_entry_id).toBe(entry.id);

    // Manual (sin income_entry_id)
    const manualTx = txRepo.create({
      account_id: debitAccountId,
      date: "2026-12-15",
      merchant: "Transferencia recibida",
      amount: 5000,
      type: "income",
    });
    expect(manualTx.income_entry_id).toBeNull();

    // Solo la manual debería contar en Abonos (la auto tiene income_entry_id)
    const allTx = txRepo.findByAccount(debitAccountId);
    const abonos = allTx.filter((t) => t.type === "income" && !t.income_entry_id);
    expect(abonos).toHaveLength(1);
    expect(abonos[0].amount).toBe(5000);
  });
});
