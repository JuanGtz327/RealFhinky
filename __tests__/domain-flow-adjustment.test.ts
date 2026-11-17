import { computeUntrackedDebt } from "@/lib/domain/flow-adjustment";
import type { Account, Transaction } from "@/lib/types";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc1",
    name: "Test Card",
    type: "credit",
    bank: "BBVA",
    current_balance: 0,
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: "tx1",
    account_id: "acc1",
    date: "2026-11-01",
    amount: 0,
    type: "purchase",
    is_msi: false,
    created_at: "2026-11-01",
    ...overrides,
  };
}

describe("computeUntrackedDebt", () => {
  it("returns 0 when Finkhy fully accounts for the balance", () => {
    const acc = makeAccount({ current_balance: 3000 });
    const txs = [makeTx({ amount: 3000 })];
    expect(computeUntrackedDebt(acc, txs, 0)).toBe(0);
  });

  it("returns carryover when balance matches directDebt + pendingMsi + carryover", () => {
    // current_balance = 5000, directDebt = 2000, pendingMsi = 1000
    // untracked = 5000 - (2000 + 1000) = 2000
    const acc = makeAccount({ current_balance: 5000, opening_balance_carryover: 2000 });
    const txs = [makeTx({ amount: 2000 })];
    expect(computeUntrackedDebt(acc, txs, 1000)).toBe(2000);
  });

  it("transfer_in reduces directDebt (payments/refunds)", () => {
    // current_balance = 1000, directDebt = 3000 - 2000 = 1000
    const acc = makeAccount({ current_balance: 1000 });
    const txs = [
      makeTx({ amount: 3000, type: "purchase", is_msi: false }),
      makeTx({ id: "tx2", amount: 2000, type: "transfer_in" }),
    ];
    expect(computeUntrackedDebt(acc, txs, 0)).toBe(0);
  });

  it("MSI purchases are excluded from directDebt (they go via pendingMsi)", () => {
    // current_balance = 2000, directDebt = 0 (msi purchase excluded), pendingMsi = 1500
    // untracked = 2000 - (0 + 1500) = 500
    const acc = makeAccount({ current_balance: 2000 });
    const txs = [makeTx({ amount: 6000, type: "purchase", is_msi: true })];
    expect(computeUntrackedDebt(acc, txs, 1500)).toBe(500);
  });

  it("returns 0 when Finkhy overstates (never negative)", () => {
    // current_balance = 100, directDebt = 500, pendingMsi = 0
    const acc = makeAccount({ current_balance: 100 });
    const txs = [makeTx({ amount: 500 })];
    expect(computeUntrackedDebt(acc, txs, 0)).toBe(0);
  });

  it("returns untracked gap even without opening_balance_carryover field", () => {
    // current_balance = 4000, directDebt = 1000, pendingMsi = 1000 → untracked = 2000
    const acc = makeAccount({ current_balance: 4000 });
    const txs = [makeTx({ amount: 1000 })];
    expect(computeUntrackedDebt(acc, txs, 1000)).toBe(2000);
  });

  it("zero balance account returns 0", () => {
    const acc = makeAccount({ current_balance: 0 });
    expect(computeUntrackedDebt(acc, [], 0)).toBe(0);
  });
});
