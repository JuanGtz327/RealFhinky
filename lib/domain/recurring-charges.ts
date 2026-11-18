import { roundCents } from "@/lib/utils/msi";
import type { RecurringCharge, RecurringChargeEntry } from "@/lib/types";
import type { ChargeBlendedResult, ChargeConfirmationStatus, ChargeOverdueAlert } from "./types";

export function chargeIntervalMonths(charge: RecurringCharge): number {
  switch (charge.frequency) {
    case "monthly":    return 1;
    case "bimonthly":  return 2;
    case "quarterly":  return 3;
    case "semiannual": return 6;
    case "annual":     return 12;
    case "custom":     return charge.custom_interval_months ?? 1;
    default:           return 1;
  }
}

export function isChargeExpectedInMonth(charge: RecurringCharge, monthStr: string): boolean {
  if (!charge.is_active) return false;
  if (!charge.start_date) return false;
  if (charge.end_date && monthStr > charge.end_date.substring(0, 7)) return false;

  const startMonth = charge.start_date.substring(0, 7);
  if (monthStr < startMonth) return false;

  const interval = chargeIntervalMonths(charge);
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ty, tm] = monthStr.split("-").map(Number);
  const diff = (ty - sy) * 12 + (tm - sm);
  return diff % interval === 0;
}

export function isChargeInBillingPeriod(charge: RecurringCharge, periodStart: string, periodEnd: string): boolean {
  if (!charge.is_active) return false;
  if (!charge.start_date) return false;
  if (charge.start_date > periodEnd) return false;
  if (charge.end_date && charge.end_date < periodStart) return false;

  const interval = chargeIntervalMonths(charge);
  const startMonth = charge.start_date.substring(0, 7);
  const periodStartMonth = periodStart.substring(0, 7);
  const periodEndMonth = periodEnd.substring(0, 7);

  const [psy, psm] = startMonth.split("-").map(Number);
  const [py, pm] = periodStartMonth.split("-").map(Number);
  const [_pey, _pem] = periodEndMonth.split("-").map(Number);

  let m = (py - psy) * 12 + (pm - psm);
  if (m < 0) m = 0;
  const rem = m % interval;
  if (rem !== 0) m += (interval - rem);

  while (true) {
    const occY = psy + Math.floor((psm - 1 + m) / 12);
    const occM = ((psm - 1 + m) % 12) + 1;
    const occMonth = `${occY}-${String(occM).padStart(2, "0")}`;
    if (occMonth > periodEndMonth) return false;
    if (occMonth >= periodStartMonth) return true;
    m += interval;
  }
}

export function computeBlendedCharge(
  charge: RecurringCharge,
  entries: RecurringChargeEntry[],
  monthStr: string
): ChargeBlendedResult {
  const isExpected = isChargeExpectedInMonth(charge, monthStr);
  const confirmedCount = entries.length;
  const confirmedTotal = roundCents(entries.reduce((s, e) => s + e.amount, 0));

  if (!isExpected) {
    return { confirmedTotal, remainingProjected: 0, blendedTotal: confirmedTotal, confirmedCount, expectedCount: 0, isExpected: false };
  }

  const expectedCount = 1;
  const remainingCount = Math.max(0, expectedCount - confirmedCount);
  const remainingProjected = roundCents(remainingCount * charge.base_amount);
  const blendedTotal = roundCents(confirmedTotal + remainingProjected);
  return { confirmedTotal, remainingProjected, blendedTotal, confirmedCount, expectedCount, isExpected: true };
}

type ChargeMode = "full" | "blended" | "remaining-only" | "confirmed-only";

export function computeMonthlyChargesForAccount(
  charges: RecurringCharge[],
  entriesByCharge: Map<string, RecurringChargeEntry[]>,
  monthStr: string,
  mode: ChargeMode
): number {
  let total = 0;
  for (const charge of charges) {
    const entries = entriesByCharge.get(charge.id) ?? [];
    const result = computeBlendedCharge(charge, entries, monthStr);
    if (!result.isExpected && entries.length === 0) continue;

    switch (mode) {
      case "remaining-only": total += result.remainingProjected; break;
      case "blended":        total += result.blendedTotal; break;
      case "confirmed-only": total += result.confirmedTotal; break;
      case "full":           total += result.isExpected ? charge.base_amount : result.confirmedTotal; break;
    }
  }
  return roundCents(total);
}

export function computeChargeConfirmationStatus(
  charge: RecurringCharge,
  entries: RecurringChargeEntry[],
  monthStr: string
): ChargeConfirmationStatus {
  const isExpected = isChargeExpectedInMonth(charge, monthStr);
  if (!isExpected) {
    return { status: "not_expected", confirmedCount: 0, expectedCount: 0, confirmedTotal: 0, remainingAmount: 0 };
  }
  const result = computeBlendedCharge(charge, entries, monthStr);
  const { confirmedCount, expectedCount, confirmedTotal, remainingProjected } = result;
  const status: "confirmed" | "pending" = confirmedCount >= expectedCount ? "confirmed" : "pending";
  return { status, confirmedCount, expectedCount, confirmedTotal, remainingAmount: remainingProjected };
}

export function computeChargeOverdueAlerts(
  charges: RecurringCharge[],
  entriesGrouped: Map<string, RecurringChargeEntry[]>,
  monthStr: string,
  today: string
): ChargeOverdueAlert[] {
  const alerts: ChargeOverdueAlert[] = [];
  const todayMonth = today.substring(0, 7);
  if (monthStr > todayMonth) return alerts;

  for (const charge of charges) {
    if (!charge.is_active) continue;
    if (!isChargeExpectedInMonth(charge, monthStr)) continue;
    const entries = entriesGrouped.get(charge.id) ?? [];
    const confirmedCount = entries.length;
    const overdueCount = Math.max(0, 1 - confirmedCount);
    if (overdueCount > 0) {
      alerts.push({ chargeId: charge.id, chargeName: charge.name, overdueCount, confirmedCount });
    }
  }
  return alerts;
}
