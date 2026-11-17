import { balanceDelta, computeBalanceDiscrepancy } from "@/lib/domain/balance";
import { ACCOUNTS, TRANSACTIONS } from "./fixtures/dataset";
import type { Account, Transaction } from "@/lib/types";

describe("balanceDelta", () => {
  describe("cuentas de crédito/préstamo", () => {
    it("purchase sube la deuda (+)", () => {
      expect(balanceDelta("purchase", 1000, "credit")).toBe(1000);
    });

    it("transfer_in baja la deuda (−)", () => {
      expect(balanceDelta("transfer_in", 1000, "credit")).toBe(-1000);
    });

    it("lo mismo aplica para tipo loan", () => {
      expect(balanceDelta("purchase", 500, "loan")).toBe(500);
      expect(balanceDelta("transfer_in", 500, "loan")).toBe(-500);
    });
  });

  describe("cuentas débito/inversión", () => {
    it("income suma al saldo (+)", () => {
      expect(balanceDelta("income", 5000, "debit")).toBe(5000);
    });

    it("transfer_in suma al saldo (+)", () => {
      expect(balanceDelta("transfer_in", 2000, "debit")).toBe(2000);
    });

    it("purchase resta del saldo (−)", () => {
      expect(balanceDelta("purchase", 300, "debit")).toBe(-300);
    });

    it("transfer_out resta del saldo (−)", () => {
      expect(balanceDelta("transfer_out", 1000, "debit")).toBe(-1000);
    });
  });

  it("sin accountType asume comportamiento débito", () => {
    expect(balanceDelta("income", 1000)).toBe(1000);
    expect(balanceDelta("purchase", 1000)).toBe(-1000);
  });
});

describe("computeBalanceDiscrepancy", () => {
  const creditAccount = ACCOUNTS.find((a) => a.id === "credit-1")!;

  it("calcula finkhyBalance = directDebt − credits + msiPending", () => {
    // tx-1: purchase 2 500, tx-2: transfer_in 5 000
    // directDebt = 2 500 − 5 000 = −2 500 → significa que pagó más de lo que gastó
    // finkhyBalance = -2 500 + 0 (msi) + 0 (carryover)
    const txs = TRANSACTIONS.filter((t) => t.account_id === "credit-1");
    const { finkhyBalance } = computeBalanceDiscrepancy(creditAccount, 0, txs);
    expect(finkhyBalance).toBeCloseTo(-2500, 2);
  });

  it("diff = current_balance − finkhyBalance", () => {
    const txs = TRANSACTIONS.filter((t) => t.account_id === "credit-1");
    const { diff } = computeBalanceDiscrepancy(creditAccount, 0, txs);
    // current_balance = 15 000, finkhyBalance = -2 500
    expect(diff).toBeCloseTo(17500, 2);
  });

  it("nivel warning cuando |diff| > 1 MXN", () => {
    const txs = TRANSACTIONS.filter((t) => t.account_id === "credit-1");
    const { level } = computeBalanceDiscrepancy(creditAccount, 0, txs);
    expect(level).toBe("warning");
  });

  it("nivel ok cuando |diff| ≤ 1 MXN", () => {
    // Fabricar cuenta donde saldo real = finkhyBalance exactamente
    const acc: Account = {
      ...creditAccount,
      current_balance: 2500,
    };
    const txs: Transaction[] = [
      { id: "x", account_id: acc.id, date: "2026-11-01", amount: 2500,
        type: "purchase", is_msi: false, created_at: "2026-11-01" },
    ];
    const { level } = computeBalanceDiscrepancy(acc, 0, txs);
    expect(level).toBe("ok");
  });

  it("suma opening_balance_carryover al finkhyBalance", () => {
    const acc: Account = { ...creditAccount, opening_balance_carryover: 1000, current_balance: 3500 };
    const txs: Transaction[] = [
      { id: "x", account_id: acc.id, date: "2026-11-01", amount: 2500,
        type: "purchase", is_msi: false, created_at: "2026-11-01" },
    ];
    // finkhyBalance = 2500 + 0 + 1000 = 3500
    const { diff, level } = computeBalanceDiscrepancy(acc, 0, txs);
    expect(diff).toBeCloseTo(0, 2);
    expect(level).toBe("ok");
  });
});
