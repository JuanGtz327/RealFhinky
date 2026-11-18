import { describe, it, expect } from "vitest";
import {
  computeMonthlyPayment,
  computeAmortizationSchedule,
  computeLoanProgress,
  computeLoanProjectionForMonth,
  computeRemainingTerm,
} from "@/lib/domain/loans";
import type { Account, CyclePayment } from "@/lib/types";

// computeMonthlyPayment(150000, 12, 48) ≈ 3950.08
const MONTHLY_PAYMENT = computeMonthlyPayment(150000, 12, 48);

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: "loan-1",
  name: "Test Loan",
  type: "loan",
  bank: "BBVA",
  current_balance: 150000,
  is_active: true,
  loan_original_amount: 150000,
  loan_interest_rate: 12,
  loan_term_months: 48,
  loan_monthly_payment: MONTHLY_PAYMENT,
  loan_start_date: "2024-01-01",
  loan_payments_made: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

describe("computeMonthlyPayment", () => {
  it("computes correct payment for $150k @ 12% × 48m", () => {
    const payment = computeMonthlyPayment(150000, 12, 48);
    expect(payment).toBeGreaterThan(3940);
    expect(payment).toBeLessThan(3960);
  });

  it("handles 0% rate as principal / term", () => {
    const payment = computeMonthlyPayment(60000, 0, 12);
    expect(payment).toBe(5000);
  });

  it("handles single-month term", () => {
    const payment = computeMonthlyPayment(10000, 0, 1);
    expect(payment).toBe(10000);
  });
});

describe("computeAmortizationSchedule", () => {
  it("first row: interest = balance × monthly_rate", () => {
    const acc = makeAccount();
    const rows = computeAmortizationSchedule(acc, [], "2024-01");
    const r = 12 / 100 / 12;
    expect(rows[0].interest).toBeCloseTo(150000 * r, 1);
  });

  it("last row: remaining balance is 0", () => {
    const acc = makeAccount();
    const rows = computeAmortizationSchedule(acc, [], "2024-01");
    expect(rows[rows.length - 1].remainingBalance).toBe(0);
  });

  it("generates rows equal to term_months", () => {
    const acc = makeAccount();
    const rows = computeAmortizationSchedule(acc, [], "2024-01");
    expect(rows.length).toBe(48);
  });

  it("variable payment in month 3 recalculates balance", () => {
    const acc = makeAccount({ loan_payments_made: 2 });
    const cp: CyclePayment = {
      id: "cp-1",
      account_id: "loan-1",
      cycle_month: "2024-03",
      amount_due: MONTHLY_PAYMENT,
      amount_paid: 10000,
      paid_date: "2024-03-15",
      created_at: "2024-03-15T00:00:00.000Z",
    };
    const rows = computeAmortizationSchedule(acc, [cp], "2024-04");
    const row3 = rows.find((r) => r.month === "2024-03");
    expect(row3?.actualPayment).toBe(10000);
    const standardRows = computeAmortizationSchedule(
      makeAccount({ loan_payments_made: 2 }),
      [],
      "2024-04"
    );
    const standardRow3Balance =
      standardRows.find((r) => r.month === "2024-03")?.remainingBalance ?? 0;
    expect(row3?.remainingBalance).toBeLessThan(standardRow3Balance);
  });
});

describe("computeLoanProgress", () => {
  it("returns 0 payments made when no cycle_payments and payments_made=0", () => {
    const acc = makeAccount();
    const progress = computeLoanProgress(acc, []);
    expect(progress.paymentsMade).toBe(0);
    expect(progress.totalPayments).toBe(48);
  });

  it("counts onboarding payments_made + cycle_payments", () => {
    const acc = makeAccount({ loan_payments_made: 24 });
    const cp: CyclePayment = {
      id: "cp-1",
      account_id: "loan-1",
      cycle_month: "2026-01",
      amount_due: MONTHLY_PAYMENT,
      amount_paid: MONTHLY_PAYMENT,
      paid_date: "2026-01-15",
      created_at: "2026-01-15T00:00:00.000Z",
    };
    const progress = computeLoanProgress(acc, [cp]);
    expect(progress.paymentsMade).toBe(25);
    expect(progress.percentComplete).toBeCloseTo(52.08, 0);
  });
});

describe("computeLoanProjectionForMonth", () => {
  it("past confirmed: returns amount_paid", () => {
    const acc = makeAccount();
    const cp: CyclePayment = {
      id: "cp-1",
      account_id: "loan-1",
      cycle_month: "2024-06",
      amount_due: MONTHLY_PAYMENT,
      amount_paid: MONTHLY_PAYMENT,
      paid_date: "2024-06-15",
      created_at: "2024-06-15T00:00:00.000Z",
    };
    expect(computeLoanProjectionForMonth(acc, "2024-06", "2024-12", cp)).toBe(MONTHLY_PAYMENT);
  });

  it("past unconfirmed: returns 0", () => {
    const acc = makeAccount();
    expect(computeLoanProjectionForMonth(acc, "2024-06", "2024-12", null)).toBe(0);
  });

  it("current unconfirmed: returns monthly payment", () => {
    const acc = makeAccount();
    expect(computeLoanProjectionForMonth(acc, "2026-11", "2026-11", null)).toBe(MONTHLY_PAYMENT);
  });

  it("current confirmed: returns 0", () => {
    const acc = makeAccount();
    const cp: CyclePayment = {
      id: "cp-1",
      account_id: "loan-1",
      cycle_month: "2026-11",
      amount_due: MONTHLY_PAYMENT,
      amount_paid: MONTHLY_PAYMENT,
      paid_date: "2026-11-15",
      created_at: "2026-11-15T00:00:00.000Z",
    };
    expect(computeLoanProjectionForMonth(acc, "2026-11", "2026-11", cp)).toBe(0);
  });

  it("future within term: returns monthly payment", () => {
    const acc = makeAccount();
    expect(computeLoanProjectionForMonth(acc, "2027-01", "2026-11", null)).toBe(MONTHLY_PAYMENT);
  });

  it("future beyond term: returns 0", () => {
    const acc = makeAccount();
    expect(computeLoanProjectionForMonth(acc, "2030-01", "2026-11", null)).toBe(0);
  });
});

describe("computeRemainingTerm", () => {
  it("returns 0 for zero balance", () => {
    expect(computeRemainingTerm(0, 3950.76, 12)).toBe(0);
  });

  it("computes remaining months accurately", () => {
    const months = computeRemainingTerm(100000, 3950.76, 12);
    expect(months).toBeGreaterThan(20);
    expect(months).toBeLessThan(50);
  });
});
