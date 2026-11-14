import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { expandMsi } from "@/lib/utils/msi";

export interface SeedResult {
  accounts: number;
  transactions: number;
  msiTransactions: number;
  incomeSources: number;
  incomeEntries: number;
}

function insert(db: IDatabase, table: string, data: Record<string, unknown>) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => "?").join(", ");
  db.execute(
    `INSERT OR IGNORE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
    Object.values(data)
  );
}

export function seedDatabase(db: IDatabase): SeedResult {
  const now = new Date().toISOString();

  const accounts = {
    bbva_credito: randomUUID(),
    amex_gold: randomUUID(),
    nu_card: randomUUID(),
    hsbc_nomina: randomUUID(),
    bbva_ahorro: randomUUID(),
    prestamo_auto: randomUUID(),
  };

  insert(db, "accounts", {
    id: accounts.bbva_credito, name: "BBVA Azul", type: "credit", bank: "BBVA",
    last4: "4321", credit_limit: 50000, current_balance: 18500,
    cut_date: 12, payment_due_date: 7, annual_fee: 1200,
    annual_fee_date: "2026-03-12", is_active: 1, created_at: now, updated_at: now,
  });

  insert(db, "accounts", {
    id: accounts.amex_gold, name: "Amex Gold", type: "credit", bank: "American Express",
    last4: "9876", credit_limit: 80000, current_balance: 22000,
    cut_date: 18, payment_due_date: 13, annual_fee: 2500,
    annual_fee_date: "2026-06-18", is_active: 1, created_at: now, updated_at: now,
  });

  insert(db, "accounts", {
    id: accounts.nu_card, name: "Nu Card", type: "credit", bank: "Nu",
    last4: "1111", credit_limit: 15000, current_balance: 3200,
    cut_date: 25, payment_due_date: 20, annual_fee: 0,
    annual_fee_date: null, is_active: 1, created_at: now, updated_at: now,
  });

  insert(db, "accounts", {
    id: accounts.hsbc_nomina, name: "HSBC Nómina", type: "debit", bank: "HSBC",
    last4: "5544", current_balance: 32000, yield_rate: 4.5,
    is_active: 1, created_at: now, updated_at: now,
  });

  insert(db, "accounts", {
    id: accounts.bbva_ahorro, name: "BBVA Ahorro", type: "debit", bank: "BBVA",
    last4: "7788", current_balance: 85000, yield_rate: 10.5,
    is_active: 1, created_at: now, updated_at: now,
  });

  insert(db, "accounts", {
    id: accounts.prestamo_auto, name: "Préstamo Auto", type: "loan", bank: "BBVA",
    credit_limit: 180000, current_balance: 142000,
    payment_due_date: 5, is_active: 1, created_at: now, updated_at: now,
  });

  const srcNomina = randomUUID();
  const srcFreelance = randomUUID();

  insert(db, "income_sources", {
    id: srcNomina, name: "Nómina principal", frequency: "biweekly",
    base_amount: 18000, is_variable: 0, is_active: 1,
    start_date: "2024-01-01", created_at: now,
  });

  insert(db, "income_sources", {
    id: srcFreelance, name: "Proyectos freelance", frequency: "custom",
    base_amount: 5000, is_variable: 1, is_active: 1,
    start_date: "2024-06-01", created_at: now,
  });

  const months = ["2026-09", "2026-10", "2026-11"];
  let incomeEntryCount = 0;
  for (const month of months) {
    insert(db, "income_entries", {
      id: randomUUID(), income_source_id: srcNomina,
      date: `${month}-01`, amount: 18000, notes: "Quincena 1", created_at: now,
    });
    insert(db, "income_entries", {
      id: randomUUID(), income_source_id: srcNomina,
      date: `${month}-15`, amount: 18000, notes: "Quincena 2", created_at: now,
    });
    incomeEntryCount += 2;
  }
  insert(db, "income_entries", {
    id: randomUUID(), income_source_id: srcFreelance,
    date: "2026-10-20", amount: 8500, notes: "Proyecto web", created_at: now,
  });
  incomeEntryCount += 1;

  const normalTxs = [
    { account_id: accounts.bbva_credito, date: "2026-11-01", merchant: "Walmart", amount: 1850, category: "Supermercado", type: "purchase" },
    { account_id: accounts.bbva_credito, date: "2026-11-03", merchant: "Netflix", amount: 299, category: "Entretenimiento", type: "purchase" },
    { account_id: accounts.bbva_credito, date: "2026-11-05", merchant: "Gasolinera Shell", amount: 950, category: "Transporte", type: "purchase" },
    { account_id: accounts.amex_gold, date: "2026-11-02", merchant: "Restaurante Pujol", amount: 2400, category: "Restaurantes", type: "purchase" },
    { account_id: accounts.amex_gold, date: "2026-11-06", merchant: "Amazon", amount: 780, category: "Compras", type: "purchase" },
    { account_id: accounts.nu_card, date: "2026-11-04", merchant: "Rappi", amount: 350, category: "Delivery", type: "purchase" },
    { account_id: accounts.hsbc_nomina, date: "2026-11-05", merchant: "Pago tarjeta BBVA", amount: 5000, category: "Pagos", type: "transfer_out" },
    { account_id: accounts.hsbc_nomina, date: "2026-11-07", merchant: "Retiro ATM", amount: 3000, category: "Efectivo", type: "transfer_out" },
    { account_id: accounts.hsbc_nomina, date: "2026-10-31", merchant: "Reembolso seguro", amount: 1200, category: "Otros", type: "transfer_in" },
    { account_id: accounts.prestamo_auto, date: "2026-11-05", merchant: "BBVA Préstamo", amount: 4800, category: "Préstamo", type: "purchase" },
  ];

  for (const tx of normalTxs) {
    insert(db, "transactions", {
      id: randomUUID(), ...tx, is_msi: 0, created_at: now,
    });
  }

  const msiTxs = [
    { account_id: accounts.bbva_credito, date: "2026-09-15", merchant: "Samsung Galaxy S24", amount: 18000, msi_months: 12 },
    { account_id: accounts.amex_gold, date: "2026-08-01", merchant: "MacBook Pro", amount: 42000, msi_months: 18 },
    { account_id: accounts.nu_card, date: "2026-10-10", merchant: "Curso Platzi", amount: 3600, msi_months: 6 },
  ];

  for (const msiTx of msiTxs) {
    const txId = randomUUID();
    const { monthlyAmount, residual, installments } = expandMsi(msiTx.amount, msiTx.msi_months, msiTx.date);
    insert(db, "transactions", {
      id: txId, account_id: msiTx.account_id, date: msiTx.date,
      merchant: msiTx.merchant, amount: msiTx.amount, type: "purchase",
      is_msi: 1, msi_months: msiTx.msi_months, msi_monthly_amount: monthlyAmount,
      msi_residual: residual, msi_start_date: msiTx.date, created_at: now,
    });
    for (const inst of installments) {
      insert(db, "msi_installments", {
        id: randomUUID(), transaction_id: txId, account_id: msiTx.account_id,
        month: inst.month, amount: inst.amount, is_last: inst.isLast ? 1 : 0,
      });
    }
  }

  return {
    accounts: Object.keys(accounts).length,
    transactions: normalTxs.length,
    msiTransactions: msiTxs.length,
    incomeSources: 2,
    incomeEntries: incomeEntryCount,
  };
}
