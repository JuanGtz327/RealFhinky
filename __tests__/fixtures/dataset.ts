import type { Account, Transaction } from "@/lib/types";

const NOW = "2026-11-16";

export const ACCOUNTS: Account[] = [
  {
    id: "debit-1", name: "BBVA Nómina", type: "debit", bank: "BBVA",
    current_balance: 50000, yield_rate: 0,
    is_active: true, created_at: NOW, updated_at: NOW,
  },
  {
    id: "invest-1", name: "GBM+", type: "investment", bank: "GBM",
    current_balance: 100000, yield_rate: 10,
    is_active: true, created_at: NOW, updated_at: NOW,
  },
  {
    id: "credit-1", name: "Amex Platinum", type: "credit", bank: "Amex",
    current_balance: 15000, credit_limit: 50000,
    cut_date: 20, payment_due_date: 15,
    annual_fee: 3000, annual_fee_date: "2026-06-01",
    is_active: true, created_at: NOW, updated_at: NOW,
  },
  {
    id: "credit-2", name: "BBVA Azul", type: "credit", bank: "BBVA",
    current_balance: 38000, credit_limit: 50000,
    cut_date: 5, payment_due_date: 25,
    is_active: true, created_at: NOW, updated_at: NOW,
  },
  {
    id: "loan-1", name: "Crédito Auto", type: "loan", bank: "Banorte",
    current_balance: 80000, credit_limit: 150000,
    is_active: true, created_at: NOW, updated_at: NOW,
  },
];

export const TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1", account_id: "credit-1", date: "2026-11-05",
    merchant: "Amazon", amount: 2500, type: "purchase",
    is_msi: false, created_at: NOW,
  },
  {
    id: "tx-2", account_id: "credit-1", date: "2026-11-10",
    merchant: "Pago", amount: 5000, type: "transfer_in",
    is_msi: false, created_at: NOW,
  },
  {
    id: "tx-3", account_id: "debit-1", date: "2026-11-01",
    merchant: "Nómina extra", amount: 3000, type: "income",
    is_msi: false, created_at: NOW,
  },
  {
    id: "tx-4", account_id: "debit-1", date: "2026-11-05",
    merchant: "Ahorro", amount: 10000, type: "transfer_out",
    is_msi: false, created_at: NOW,
  },
  {
    id: "tx-msi-1", account_id: "credit-2", date: "2026-10-15",
    merchant: "MacBook", amount: 36000, type: "purchase",
    is_msi: true, msi_months: 12, msi_monthly_amount: 3000, msi_residual: 0,
    msi_start_date: "2026-10-01", created_at: NOW,
  },
];
