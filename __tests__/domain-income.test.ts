import { describe, it, expect } from "vitest";
import {
  expectedPaymentCount,
  projectMonthlyIncome,
  computeBlendedIncome,
  computeMonthlyNomina,
  computeIncomeConfirmationStatus,
} from "@/lib/domain/income";
import type { IncomeSource, IncomeEntry } from "@/lib/types";

const makeSource = (overrides: Partial<IncomeSource> = {}): IncomeSource => ({
  id: "src-1",
  name: "Nómina",
  frequency: "biweekly",
  base_amount: 10000,
  is_variable: false,
  is_active: true,
  created_at: "2026-01-01T12:00:00Z",
  ...overrides,
});

const makeEntry = (overrides: Partial<IncomeEntry> = {}): IncomeEntry => ({
  id: "e-1",
  income_source_id: "src-1",
  date: "2026-11-01",
  amount: 10000,
  created_at: "2026-11-01T12:00:00Z",
  ...overrides,
});

describe("expectedPaymentCount", () => {
  it("weekly → 4", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "weekly" }))).toBe(4);
  });

  it("biweekly → 2", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "biweekly" }))).toBe(2);
  });

  it("monthly → 1", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "monthly" }))).toBe(1);
  });

  it("custom 15 days → 2", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "custom", custom_interval_days: 15 }))).toBe(2);
  });

  it("custom 10 days → 3", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "custom", custom_interval_days: 10 }))).toBe(3);
  });

  it("custom no days → 1 (fallback)", () => {
    expect(expectedPaymentCount(makeSource({ frequency: "custom" }))).toBe(1);
  });
});

describe("projectMonthlyIncome", () => {
  it("weekly $5k → $20k", () => {
    expect(projectMonthlyIncome(makeSource({ frequency: "weekly", base_amount: 5000 }))).toBe(20000);
  });

  it("biweekly $10k → $20k", () => {
    expect(projectMonthlyIncome(makeSource({ frequency: "biweekly", base_amount: 10000 }))).toBe(20000);
  });

  it("monthly $15k → $15k", () => {
    expect(projectMonthlyIncome(makeSource({ frequency: "monthly", base_amount: 15000 }))).toBe(15000);
  });

  it("custom 15 days $10k → $20k", () => {
    expect(projectMonthlyIncome(makeSource({ frequency: "custom", base_amount: 10000, custom_interval_days: 15 }))).toBe(20000);
  });
});

describe("computeBlendedIncome", () => {
  it("no entries → all remaining", () => {
    const src    = makeSource({ base_amount: 10000, frequency: "biweekly" });
    const result = computeBlendedIncome(src, []);
    expect(result.confirmedCount).toBe(0);
    expect(result.expectedCount).toBe(2);
    expect(result.confirmedTotal).toBe(0);
    expect(result.remainingProjected).toBe(20000);
    expect(result.blendedTotal).toBe(20000);
  });

  it("1 of 2 confirmed → partial", () => {
    const src    = makeSource({ base_amount: 10000, frequency: "biweekly" });
    const e1     = makeEntry({ amount: 10000 });
    const result = computeBlendedIncome(src, [e1]);
    expect(result.confirmedCount).toBe(1);
    expect(result.confirmedTotal).toBe(10000);
    expect(result.remainingProjected).toBe(10000);
    expect(result.blendedTotal).toBe(20000);
  });

  it("2 of 2 confirmed → no remaining", () => {
    const src    = makeSource({ base_amount: 10000, frequency: "biweekly" });
    const e1     = makeEntry({ id: "e-1", amount: 10000 });
    const e2     = makeEntry({ id: "e-2", amount: 10000 });
    const result = computeBlendedIncome(src, [e1, e2]);
    expect(result.confirmedCount).toBe(2);
    expect(result.remainingProjected).toBe(0);
    expect(result.blendedTotal).toBe(20000);
  });

  it("overflow (3 entries for 2 expected) → remaining = 0, confirmedCount = 3", () => {
    const src = makeSource({ base_amount: 10000, frequency: "biweekly" });
    const entries = [
      makeEntry({ id: "e-1", amount: 10000 }),
      makeEntry({ id: "e-2", amount: 10000 }),
      makeEntry({ id: "e-3", amount: 10000 }),
    ];
    const result = computeBlendedIncome(src, entries);
    expect(result.confirmedCount).toBe(3);
    expect(result.remainingProjected).toBe(0);
    expect(result.confirmedTotal).toBe(30000);
  });

  it("variable amounts: confirmed with different amounts", () => {
    const src    = makeSource({ base_amount: 10000, frequency: "biweekly" });
    const e1     = makeEntry({ amount: 12000 });
    const result = computeBlendedIncome(src, [e1]);
    expect(result.confirmedTotal).toBe(12000);
    expect(result.remainingProjected).toBe(10000);
    expect(result.blendedTotal).toBe(22000);
  });
});

describe("computeMonthlyNomina", () => {
  const src1 = makeSource({ id: "src-1", base_amount: 10000, frequency: "biweekly" });
  const src2 = makeSource({ id: "src-2", name: "Freelance", base_amount: 5000, frequency: "monthly" });

  it("display mode → full projection regardless of entries", () => {
    const entriesBySource = new Map([["src-1", [makeEntry({ id: "e-1", amount: 10000 })]]] as [string, IncomeEntry[]][]);
    const result = computeMonthlyNomina([src1, src2], entriesBySource, "display");
    expect(result.display).toBe(25000); // 20k + 5k
  });

  it("remaining-only mode → only unconfirmed portion", () => {
    const entriesBySource = new Map([["src-1", [makeEntry({ id: "e-1", amount: 10000 })]]] as [string, IncomeEntry[]][]);
    const result = computeMonthlyNomina([src1, src2], entriesBySource, "remaining-only");
    expect(result.remaining).toBe(15000); // 10k remaining for src1 + 5k for src2
  });

  it("blended mode → confirmed + remaining", () => {
    const entriesBySource = new Map([
      ["src-1", [makeEntry({ id: "e-1", amount: 10000 })]],
    ] as [string, IncomeEntry[]][]);
    const result = computeMonthlyNomina([src1, src2], entriesBySource, "blended");
    expect(result.blended).toBe(25000); // 10k confirmed + 10k remaining for src1 + 5k remaining for src2
  });

  it("no entries → remaining = full projection", () => {
    const result = computeMonthlyNomina([src1], new Map(), "remaining-only");
    expect(result.remaining).toBe(20000);
  });

  it("all confirmed → remaining = 0", () => {
    const entriesBySource = new Map([
      ["src-1", [
        makeEntry({ id: "e-1", amount: 10000 }),
        makeEntry({ id: "e-2", amount: 10000 }),
      ]],
    ] as [string, IncomeEntry[]][]);
    const result = computeMonthlyNomina([src1], entriesBySource, "remaining-only");
    expect(result.remaining).toBe(0);
  });
});

describe("computeIncomeConfirmationStatus", () => {
  it("pending: no entries", () => {
    const src    = makeSource({ frequency: "biweekly" });
    const result = computeIncomeConfirmationStatus(src, []);
    expect(result.status).toBe("pending");
    expect(result.confirmedCount).toBe(0);
    expect(result.expectedCount).toBe(2);
    expect(result.remainingAmount).toBe(20000);
  });

  it("partial: 1 of 2", () => {
    const src    = makeSource({ frequency: "biweekly", base_amount: 10000 });
    const result = computeIncomeConfirmationStatus(src, [makeEntry()]);
    expect(result.status).toBe("partial");
    expect(result.confirmedCount).toBe(1);
    expect(result.remainingAmount).toBe(10000);
  });

  it("confirmed: 2 of 2", () => {
    const src     = makeSource({ frequency: "biweekly", base_amount: 10000 });
    const entries = [makeEntry({ id: "e-1" }), makeEntry({ id: "e-2" })];
    const result  = computeIncomeConfirmationStatus(src, entries);
    expect(result.status).toBe("confirmed");
    expect(result.remainingAmount).toBe(0);
    expect(result.confirmedTotal).toBe(20000);
  });
});
