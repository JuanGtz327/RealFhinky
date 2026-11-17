export type AccountType = "credit" | "debit" | "loan" | "investment";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank: string;
  last4?: string;
  credit_limit?: number;
  current_balance: number;
  yield_rate?: number;
  cut_date?: number;
  payment_due_date?: number;
  annual_fee?: number;
  annual_fee_date?: string;
  is_active: boolean;
  opening_balance_carryover?: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "purchase" | "income" | "transfer_in" | "transfer_out";

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  merchant?: string;
  description?: string;
  amount: number;
  category?: string;
  type: TransactionType;
  is_msi: boolean;
  msi_months?: number;
  msi_monthly_amount?: number;
  msi_residual?: number;
  msi_start_date?: string;
  notes?: string;
  created_at: string;
}

export interface MsiInstallment {
  id: string;
  transaction_id: string;
  account_id: string;
  month: string;
  amount: number;
  is_last: boolean;
}

export type IncomeFrequency = "weekly" | "biweekly" | "monthly" | "custom";

export interface IncomeSource {
  id: string;
  name: string;
  frequency: IncomeFrequency;
  base_amount: number;
  is_variable: boolean;
  is_active: boolean;
  start_date?: string;
  custom_interval_days?: number;
  created_at: string;
}

export interface IncomeEntry {
  id: string;
  income_source_id: string;
  date: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface CyclePayment {
  id: string;
  account_id: string;
  cycle_month: string;
  amount_due: number;
  amount_paid: number;
  paid_date: string;
  notes?: string;
  created_at: string;
}
