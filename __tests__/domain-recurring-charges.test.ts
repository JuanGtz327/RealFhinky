import { describe, it, expect } from "vitest";
import {
  chargeIntervalMonths,
  isChargeExpectedInMonth,
  isChargeInBillingPeriod,
  computeBlendedCharge,
  computeMonthlyChargesForAccount,
  computeChargeConfirmationStatus,
  computeChargeOverdueAlerts,
} from "@/lib/domain/recurring-charges";
import type { RecurringCharge, RecurringChargeEntry } from "@/lib/types";

const makeCharge = (overrides: Partial<RecurringCharge> = {}): RecurringCharge => ({
  id: "ch-1",
  name: "Netflix",
  account_id: "acc-1",
  frequency: "monthly",
  base_amount: 299,
  is_variable: false,
  is_active: true,
  start_date: "2026-01-15",
  created_at: "2026-01-01T12:00:00Z",
  ...overrides,
});

const makeEntry = (overrides: Partial<RecurringChargeEntry> = {}): RecurringChargeEntry => ({
  id: "e-1",
  recurring_charge_id: "ch-1",
  date: "2026-11-15",
  amount: 299,
  created_at: "2026-11-15T12:00:00Z",
  ...overrides,
});

describe("chargeIntervalMonths", () => {
  it("monthly → 1", () => expect(chargeIntervalMonths(makeCharge({ frequency: "monthly" }))).toBe(1));
  it("bimonthly → 2", () => expect(chargeIntervalMonths(makeCharge({ frequency: "bimonthly" }))).toBe(2));
  it("quarterly → 3", () => expect(chargeIntervalMonths(makeCharge({ frequency: "quarterly" }))).toBe(3));
  it("semiannual → 6", () => expect(chargeIntervalMonths(makeCharge({ frequency: "semiannual" }))).toBe(6));
  it("annual → 12", () => expect(chargeIntervalMonths(makeCharge({ frequency: "annual" }))).toBe(12));
  it("custom → custom_interval_months", () => {
    expect(chargeIntervalMonths(makeCharge({ frequency: "custom", custom_interval_months: 4 }))).toBe(4);
  });
});

describe("isChargeExpectedInMonth", () => {
  it("monthly charge is expected in every month", () => {
    const charge = makeCharge({ start_date: "2026-01-15" });
    expect(isChargeExpectedInMonth(charge, "2026-01")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-06")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-11")).toBe(true);
  });

  it("quarterly charge is expected every 3 months from start", () => {
    const charge = makeCharge({ frequency: "quarterly", start_date: "2026-01-01" });
    expect(isChargeExpectedInMonth(charge, "2026-01")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-04")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-07")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-02")).toBe(false);
    expect(isChargeExpectedInMonth(charge, "2026-05")).toBe(false);
  });

  it("annual charge is expected only once per year", () => {
    const charge = makeCharge({ frequency: "annual", start_date: "2026-03-01" });
    expect(isChargeExpectedInMonth(charge, "2026-03")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2027-03")).toBe(true);
    expect(isChargeExpectedInMonth(charge, "2026-06")).toBe(false);
  });

  it("inactive charge is never expected", () => {
    const charge = makeCharge({ is_active: false });
    expect(isChargeExpectedInMonth(charge, "2026-11")).toBe(false);
  });

  it("charge before start_date is not expected", () => {
    const charge = makeCharge({ start_date: "2026-06-01" });
    expect(isChargeExpectedInMonth(charge, "2026-05")).toBe(false);
  });

  it("charge after end_date is not expected", () => {
    const charge = makeCharge({ start_date: "2026-01-01", end_date: "2026-10-31" });
    expect(isChargeExpectedInMonth(charge, "2026-11")).toBe(false);
    expect(isChargeExpectedInMonth(charge, "2026-10")).toBe(true);
  });
});

describe("isChargeInBillingPeriod", () => {
  it("monthly charge is in any billing period spanning its start month onwards", () => {
    const charge = makeCharge({ start_date: "2026-01-15" });
    // Billing period: 2026-11-16 to 2026-12-15 (cut day 15)
    expect(isChargeInBillingPeriod(charge, "2026-11-16", "2026-12-15")).toBe(true);
  });

  it("quarterly charge is in period only when due month falls in period", () => {
    // start 2026-01, quarterly → due: 01, 04, 07, 10
    const charge = makeCharge({ frequency: "quarterly", start_date: "2026-01-01" });
    // Oct period (cut day 15, prev cycle: 2026-09-16 to 2026-10-15) → October is a due month
    expect(isChargeInBillingPeriod(charge, "2026-09-16", "2026-10-15")).toBe(true);
    // Period 2026-11-16 to 2026-12-15 → neither Nov nor Dec is a due month (10, 01)
    expect(isChargeInBillingPeriod(charge, "2026-11-16", "2026-12-15")).toBe(false);
  });

  it("inactive charge is never in billing period", () => {
    const charge = makeCharge({ is_active: false });
    expect(isChargeInBillingPeriod(charge, "2026-11-01", "2026-11-30")).toBe(false);
  });
});

describe("computeBlendedCharge", () => {
  it("not expected month → no projected amount, only confirmed", () => {
    const charge = makeCharge({ frequency: "quarterly", start_date: "2026-01-01" });
    const result = computeBlendedCharge(charge, [], "2026-02");
    expect(result.isExpected).toBe(false);
    expect(result.remainingProjected).toBe(0);
    expect(result.blendedTotal).toBe(0);
  });

  it("expected, no entries → full base amount projected", () => {
    const charge = makeCharge();
    const result = computeBlendedCharge(charge, [], "2026-11");
    expect(result.isExpected).toBe(true);
    expect(result.confirmedCount).toBe(0);
    expect(result.remainingProjected).toBe(299);
    expect(result.blendedTotal).toBe(299);
  });

  it("expected, confirmed → confirmed total, no remaining", () => {
    const charge = makeCharge();
    const entry = makeEntry();
    const result = computeBlendedCharge(charge, [entry], "2026-11");
    expect(result.isExpected).toBe(true);
    expect(result.confirmedCount).toBe(1);
    expect(result.confirmedTotal).toBe(299);
    expect(result.remainingProjected).toBe(0);
    expect(result.blendedTotal).toBe(299);
  });
});

describe("computeChargeConfirmationStatus", () => {
  it("not expected → not_expected", () => {
    const charge = makeCharge({ frequency: "quarterly", start_date: "2026-01-01" });
    const status = computeChargeConfirmationStatus(charge, [], "2026-02");
    expect(status.status).toBe("not_expected");
  });

  it("expected, no entries → pending", () => {
    const charge = makeCharge();
    const status = computeChargeConfirmationStatus(charge, [], "2026-11");
    expect(status.status).toBe("pending");
  });

  it("expected, confirmed → confirmed", () => {
    const charge = makeCharge();
    const entry = makeEntry();
    const status = computeChargeConfirmationStatus(charge, [entry], "2026-11");
    expect(status.status).toBe("confirmed");
  });
});

describe("computeMonthlyChargesForAccount", () => {
  it("remaining-only mode includes only remaining projected", () => {
    const charge = makeCharge();
    const entriesMap = new Map<string, RecurringChargeEntry[]>();
    const total = computeMonthlyChargesForAccount([charge], entriesMap, "2026-11", "remaining-only");
    expect(total).toBe(299);
  });

  it("confirmed-only mode includes only confirmed", () => {
    const charge = makeCharge();
    const entry = makeEntry();
    const entriesMap = new Map([["ch-1", [entry]]]);
    const total = computeMonthlyChargesForAccount([charge], entriesMap, "2026-11", "confirmed-only");
    expect(total).toBe(299);
  });

  it("not expected charge in blended mode → 0", () => {
    const charge = makeCharge({ frequency: "quarterly", start_date: "2026-01-01" });
    const entriesMap = new Map<string, RecurringChargeEntry[]>();
    const total = computeMonthlyChargesForAccount([charge], entriesMap, "2026-02", "blended");
    expect(total).toBe(0);
  });
});

describe("computeChargeOverdueAlerts", () => {
  it("expected but unconfirmed in past month → alert", () => {
    const charge = makeCharge();
    const entriesMap = new Map<string, RecurringChargeEntry[]>();
    const alerts = computeChargeOverdueAlerts([charge], entriesMap, "2026-10", "2026-11-17");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].chargeName).toBe("Netflix");
    expect(alerts[0].overdueCount).toBe(1);
  });

  it("confirmed charge has no alert", () => {
    const charge = makeCharge();
    const entry = makeEntry({ date: "2026-10-15" });
    const entriesMap = new Map([["ch-1", [entry]]]);
    const alerts = computeChargeOverdueAlerts([charge], entriesMap, "2026-10", "2026-11-17");
    expect(alerts).toHaveLength(0);
  });

  it("future month → no alerts", () => {
    const charge = makeCharge();
    const entriesMap = new Map<string, RecurringChargeEntry[]>();
    const alerts = computeChargeOverdueAlerts([charge], entriesMap, "2026-12", "2026-11-17");
    expect(alerts).toHaveLength(0);
  });
});
