import { roundCents } from "@/lib/utils/msi";
import type { IncomeSource, IncomeEntry } from "@/lib/types";
import type { BlendedIncomeResult, MonthlyNominaResult, IncomeConfirmationStatus } from "./types";

export function expectedPaymentCount(source: IncomeSource): number {
  switch (source.frequency) {
    case "weekly":   return 4;
    case "biweekly": return 2;
    case "monthly":  return 1;
    case "custom":   return Math.round(30 / (source.custom_interval_days ?? 30));
    default:         return 1;
  }
}

export function projectMonthlyIncome(source: IncomeSource): number {
  return roundCents(source.base_amount * expectedPaymentCount(source));
}

export function computeBlendedIncome(source: IncomeSource, entries: IncomeEntry[]): BlendedIncomeResult {
  const expectedCount     = expectedPaymentCount(source);
  const confirmedCount    = entries.length;
  const confirmedTotal    = roundCents(entries.reduce((s, e) => s + e.amount, 0));
  const remainingCount    = Math.max(0, expectedCount - confirmedCount);
  const remainingProjected = roundCents(remainingCount * source.base_amount);
  const blendedTotal      = roundCents(confirmedTotal + remainingProjected);
  return { confirmedTotal, remainingProjected, blendedTotal, confirmedCount, expectedCount };
}

type NominaMode = "full" | "blended" | "remaining-only" | "display";

export function computeMonthlyNomina(
  sources: IncomeSource[],
  entriesBySource: Map<string, IncomeEntry[]>,
  _mode: NominaMode
): MonthlyNominaResult {
  let display = 0, remaining = 0, blended = 0;
  let totalConfirmedCount = 0, totalExpectedCount = 0;

  for (const source of sources) {
    const entries = entriesBySource.get(source.id) ?? [];
    const result  = computeBlendedIncome(source, entries);
    totalConfirmedCount += result.confirmedCount;
    totalExpectedCount  += result.expectedCount;
    display   += projectMonthlyIncome(source);
    remaining += result.remainingProjected;
    blended   += result.blendedTotal;
  }

  return {
    display:        roundCents(display),
    remaining:      roundCents(remaining),
    blended:        roundCents(blended),
    confirmedCount: totalConfirmedCount,
    expectedCount:  totalExpectedCount,
  };
}

export function computeIncomeConfirmationStatus(
  source: IncomeSource,
  entries: IncomeEntry[]
): IncomeConfirmationStatus {
  const result = computeBlendedIncome(source, entries);
  const { confirmedCount, expectedCount, confirmedTotal, remainingProjected } = result;
  let status: "confirmed" | "partial" | "pending";
  if (confirmedCount >= expectedCount && expectedCount > 0) status = "confirmed";
  else if (confirmedCount > 0) status = "partial";
  else status = "pending";
  return { status, confirmedCount, expectedCount, confirmedTotal, remainingAmount: remainingProjected };
}
