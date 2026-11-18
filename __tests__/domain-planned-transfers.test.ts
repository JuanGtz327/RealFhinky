import { describe, it, expect } from "vitest";
import {
  expectedTransferCount,
  projectMonthlyTransfer,
  computeBlendedTransfer,
  computeMonthlyPlannedTransfers,
} from "@/lib/domain/planned-transfers";
import type { PlannedTransfer, PlannedTransferEntry } from "@/lib/types";

const makeTransfer = (overrides: Partial<PlannedTransfer> = {}): PlannedTransfer => ({
  id: "pt-1",
  name: "Renta",
  account_id: "acc-1",
  direction: "out",
  frequency: "monthly",
  base_amount: 5000,
  is_variable: false,
  is_active: true,
  start_date: "2026-01-01",
  created_at: "2026-01-01T12:00:00Z",
  ...overrides,
});

const makeEntry = (overrides: Partial<PlannedTransferEntry> = {}): PlannedTransferEntry => ({
  id: "e-1",
  planned_transfer_id: "pt-1",
  date: "2026-11-01",
  amount: 5000,
  created_at: "2026-11-01T12:00:00Z",
  ...overrides,
});

describe("expectedTransferCount", () => {
  it("weekly → 4", () => expect(expectedTransferCount(makeTransfer({ frequency: "weekly" }))).toBe(4));
  it("biweekly → 2", () => expect(expectedTransferCount(makeTransfer({ frequency: "biweekly" }))).toBe(2));
  it("monthly → 1", () => expect(expectedTransferCount(makeTransfer({ frequency: "monthly" }))).toBe(1));
  it("one_time → 1", () => expect(expectedTransferCount(makeTransfer({ frequency: "one_time" }))).toBe(1));
  it("custom 15 days → round(30/15) = 2", () => {
    expect(expectedTransferCount(makeTransfer({ frequency: "custom", custom_interval_days: 15 }))).toBe(2);
  });
  it("custom 10 days → round(30/10) = 3", () => {
    expect(expectedTransferCount(makeTransfer({ frequency: "custom", custom_interval_days: 10 }))).toBe(3);
  });
});

describe("projectMonthlyTransfer", () => {
  it("monthly $5000 → $5000", () => {
    expect(projectMonthlyTransfer(makeTransfer())).toBe(5000);
  });

  it("biweekly $3000 → $6000", () => {
    expect(projectMonthlyTransfer(makeTransfer({ frequency: "biweekly", base_amount: 3000 }))).toBe(6000);
  });

  it("weekly $1000 → $4000", () => {
    expect(projectMonthlyTransfer(makeTransfer({ frequency: "weekly", base_amount: 1000 }))).toBe(4000);
  });
});

describe("computeBlendedTransfer", () => {
  it("no entries → full projected amount", () => {
    const transfer = makeTransfer();
    const result = computeBlendedTransfer(transfer, []);
    expect(result.confirmedCount).toBe(0);
    expect(result.expectedCount).toBe(1);
    expect(result.remainingProjected).toBe(5000);
    expect(result.blendedTotal).toBe(5000);
    expect(result.confirmedTotal).toBe(0);
  });

  it("fully confirmed → confirmed total, no remaining", () => {
    const transfer = makeTransfer();
    const entry = makeEntry();
    const result = computeBlendedTransfer(transfer, [entry]);
    expect(result.confirmedCount).toBe(1);
    expect(result.confirmedTotal).toBe(5000);
    expect(result.remainingProjected).toBe(0);
    expect(result.blendedTotal).toBe(5000);
  });

  it("biweekly with 1 of 2 confirmed → half remaining", () => {
    const transfer = makeTransfer({ frequency: "biweekly", base_amount: 3000 });
    const entry = makeEntry({ amount: 3000 });
    const result = computeBlendedTransfer(transfer, [entry]);
    expect(result.expectedCount).toBe(2);
    expect(result.confirmedCount).toBe(1);
    expect(result.confirmedTotal).toBe(3000);
    expect(result.remainingProjected).toBe(3000);
    expect(result.blendedTotal).toBe(6000);
  });
});

describe("computeMonthlyPlannedTransfers", () => {
  it("separates in and out transfers correctly", () => {
    const inTransfer = makeTransfer({ id: "pt-in", direction: "in", base_amount: 2000 });
    const outTransfer = makeTransfer({ id: "pt-out", direction: "out", base_amount: 1500 });
    const entriesMap = new Map<string, PlannedTransferEntry[]>();

    const result = computeMonthlyPlannedTransfers([inTransfer, outTransfer], entriesMap, "blended");
    expect(result.abonos).toBe(2000);
    expect(result.transferencias).toBe(1500);
    expect(result.abonosConfirmed).toBe(0);
    expect(result.transferenciaConfirmed).toBe(0);
  });

  it("remaining-only mode excludes confirmed transfers", () => {
    const transfer = makeTransfer({ id: "pt-1", direction: "out", base_amount: 5000 });
    const entry = makeEntry({ planned_transfer_id: "pt-1" });
    const entriesMap = new Map([["pt-1", [entry]]]);

    const result = computeMonthlyPlannedTransfers([transfer], entriesMap, "remaining-only");
    expect(result.transferencias).toBe(0);
  });

  it("confirmed-only mode counts confirmed entries only", () => {
    const transfer = makeTransfer({ id: "pt-1", direction: "in", base_amount: 10000 });
    const entry = makeEntry({ planned_transfer_id: "pt-1", amount: 10000 });
    const entriesMap = new Map([["pt-1", [entry]]]);

    const result = computeMonthlyPlannedTransfers([transfer], entriesMap, "confirmed-only");
    expect(result.abonos).toBe(10000);
    expect(result.abonosConfirmed).toBe(10000);
  });

  it("inactive transfer is excluded", () => {
    const transfer = makeTransfer({ is_active: false });
    const entriesMap = new Map<string, PlannedTransferEntry[]>();
    const result = computeMonthlyPlannedTransfers([transfer], entriesMap, "blended");
    expect(result.abonos).toBe(0);
    expect(result.transferencias).toBe(0);
  });
});
