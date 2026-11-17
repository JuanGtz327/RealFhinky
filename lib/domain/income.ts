import { addDays, parseISO, endOfMonth } from "date-fns";
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

function getIntervalDays(source: IncomeSource): number {
  switch (source.frequency) {
    case "weekly":   return 7;
    case "biweekly": return 14;
    case "monthly":  return 30;
    case "custom":   return source.custom_interval_days ?? 30;
    default:         return 0;
  }
}

export function computePastPaymentCount(
  source: IncomeSource,
  monthStr: string,
  today: string
): number {
  if (!source.start_date) return 0;
  const intervalDays = getIntervalDays(source);
  if (intervalDays <= 0) return 0;

  let cursor      = parseISO(source.start_date + "T12:00:00");
  const monthStart = parseISO(monthStr + "-01T12:00:00");
  const monthEnd   = endOfMonth(monthStart);
  const todayDate  = parseISO(today + "T12:00:00");
  const cutoff     = todayDate < monthEnd ? todayDate : monthEnd;

  while (cursor < monthStart) cursor = addDays(cursor, intervalDays);

  let count = 0;
  while (cursor <= cutoff) { count++; cursor = addDays(cursor, intervalDays); }
  return count;
}

export interface IncomeOverdueAlert {
  sourceId: string;
  sourceName: string;
  overdueCount: number;
  confirmedCount: number;
  pastPaymentCount: number;
}

export function computeIncomeOverdueAlerts(
  sources: IncomeSource[],
  entriesGrouped: Map<string, IncomeEntry[]>,
  monthStr: string,
  today: string
): IncomeOverdueAlert[] {
  const alerts: IncomeOverdueAlert[] = [];
  for (const source of sources) {
    if (!source.is_active || !source.start_date) continue;
    const entries        = entriesGrouped.get(source.id) ?? [];
    const pastCount      = computePastPaymentCount(source, monthStr, today);
    const confirmedCount = entries.length;
    const overdueCount   = Math.max(0, pastCount - confirmedCount);
    if (overdueCount > 0) {
      alerts.push({ sourceId: source.id, sourceName: source.name, overdueCount, confirmedCount, pastPaymentCount: pastCount });
    }
  }
  return alerts;
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
