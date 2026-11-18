CREATE TABLE IF NOT EXISTS accounts (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN ('credit','debit','loan','investment')),
  bank             TEXT NOT NULL,
  last4            TEXT,
  credit_limit     REAL,
  current_balance  REAL NOT NULL DEFAULT 0,
  yield_rate       REAL,
  cut_date         INTEGER,
  payment_due_date INTEGER,
  annual_fee       REAL,
  annual_fee_date  TEXT,
  is_active                  INTEGER NOT NULL DEFAULT 1,
  opening_balance_carryover  REAL,
  flow_adjustment            REAL,
  loan_original_amount       REAL,
  loan_interest_rate         REAL,
  loan_term_months           INTEGER,
  loan_monthly_payment       REAL,
  loan_start_date            TEXT,
  loan_payments_made         INTEGER,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id                 TEXT PRIMARY KEY,
  account_id         TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date               TEXT NOT NULL,
  merchant           TEXT,
  description        TEXT,
  amount             REAL NOT NULL,
  category           TEXT,
  type               TEXT NOT NULL CHECK(type IN ('purchase','income','transfer_in','transfer_out')),
  is_msi             INTEGER NOT NULL DEFAULT 0,
  msi_months         INTEGER,
  msi_monthly_amount REAL,
  msi_residual       REAL,
  msi_start_date     TEXT,
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS msi_installments (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month          TEXT NOT NULL,
  amount         REAL NOT NULL,
  is_last        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS income_sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  frequency   TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','custom')),
  base_amount REAL NOT NULL DEFAULT 0,
  is_variable           INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  start_date            TEXT,
  custom_interval_days  INTEGER,
  account_id            TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS income_entries (
  id               TEXT PRIMARY KEY,
  income_source_id TEXT NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  amount           REAL NOT NULL,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_msi_installments_month ON msi_installments(month);
CREATE INDEX IF NOT EXISTS idx_msi_installments_account ON msi_installments(account_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_date ON income_entries(date);

CREATE TABLE IF NOT EXISTS user_preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flow_adjustments (
  id          TEXT PRIMARY KEY,
  month       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('expense','income')),
  description TEXT NOT NULL,
  amount      REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flow_adjustments_month ON flow_adjustments(month);

CREATE TABLE IF NOT EXISTS cycle_payments (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  cycle_month  TEXT NOT NULL,
  amount_due   REAL NOT NULL,
  amount_paid  REAL NOT NULL,
  paid_date    TEXT NOT NULL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, cycle_month)
);
CREATE INDEX IF NOT EXISTS idx_cycle_payments_account ON cycle_payments(account_id);

CREATE TABLE IF NOT EXISTS recurring_charges (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  account_id             TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  frequency              TEXT NOT NULL CHECK(frequency IN ('monthly','bimonthly','quarterly','semiannual','annual','custom')),
  base_amount            REAL NOT NULL DEFAULT 0,
  is_variable            INTEGER NOT NULL DEFAULT 0,
  is_active              INTEGER NOT NULL DEFAULT 1,
  start_date             TEXT,
  end_date               TEXT,
  custom_interval_months INTEGER,
  category               TEXT,
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_account ON recurring_charges(account_id);

CREATE TABLE IF NOT EXISTS recurring_charge_entries (
  id                  TEXT PRIMARY KEY,
  recurring_charge_id TEXT NOT NULL REFERENCES recurring_charges(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,
  amount              REAL NOT NULL,
  notes               TEXT,
  transaction_id      TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_charge_entries_charge ON recurring_charge_entries(recurring_charge_id);
CREATE INDEX IF NOT EXISTS idx_recurring_charge_entries_date ON recurring_charge_entries(date);

CREATE TABLE IF NOT EXISTS planned_transfers (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  account_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  direction             TEXT NOT NULL CHECK(direction IN ('in','out')),
  frequency             TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','custom','one_time')),
  base_amount           REAL NOT NULL DEFAULT 0,
  is_variable           INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  start_date            TEXT,
  end_date              TEXT,
  custom_interval_days  INTEGER,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planned_transfers_account ON planned_transfers(account_id);

CREATE TABLE IF NOT EXISTS planned_transfer_entries (
  id                   TEXT PRIMARY KEY,
  planned_transfer_id  TEXT NOT NULL REFERENCES planned_transfers(id) ON DELETE CASCADE,
  date                 TEXT NOT NULL,
  amount               REAL NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planned_transfer_entries_transfer ON planned_transfer_entries(planned_transfer_id);
CREATE INDEX IF NOT EXISTS idx_planned_transfer_entries_date ON planned_transfer_entries(date);
