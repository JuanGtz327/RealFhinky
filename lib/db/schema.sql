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
