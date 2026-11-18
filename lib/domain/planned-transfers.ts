import { addDays, format, parseISO, endOfMonth } from "date-fns";
import { roundCents } from "@/lib/utils/msi";
import type { PlannedTransfer, PlannedTransferEntry } from "@/lib/types";
import type { BlendedTransferResult, MonthlyPlannedTransferResult, TransferConfirmationStatus, TransferOverdueAlert } from "./types";

export function expectedTransferCount(transfer: PlannedTransfer): number {
  switch (transfer.frequency) {
    case "weekly":   return 4;
    case "biweekly": return 2;
    case "monthly":  return 1;
    case "one_time": return 1;
    case "custom":   return Math.round(30 / (transfer.custom_interval_days ?? 30));
    default:         return 1;
  }
}

export function projectMonthlyTransfer(transfer: PlannedTransfer): number {
  return roundCents(transfer.base_amount * expectedTransferCount(transfer));
}

export function computeBlendedTransfer(
  transfer: PlannedTransfer,
  entries: PlannedTransferEntry[]
): BlendedTransferResult {
  const expectedCount     = expectedTransferCount(transfer);
  const confirmedCount    = entries.length;
  const confirmedTotal    = roundCents(entries.reduce((s, e) => s + e.amount, 0));
  const remainingCount    = Math.max(0, expectedCount - confirmedCount);
  const remainingProjected = roundCents(remainingCount * transfer.base_amount);
  const blendedTotal      = roundCents(confirmedTotal + remainingProjected);
  return { confirmedTotal, remainingProjected, blendedTotal, confirmedCount, expectedCount };
}

type TransferMode = "full" | "blended" | "remaining-only" | "confirmed-only";

export function computeMonthlyPlannedTransfers(
  transfers: PlannedTransfer[],
  entriesByTransfer: Map<string, PlannedTransferEntry[]>,
  mode: TransferMode
): MonthlyPlannedTransferResult {
  let abonos = 0, transferencias = 0, abonosConfirmed = 0, transferenciaConfirmed = 0;

  for (const transfer of transfers) {
    if (!transfer.is_active) continue;
    const entries = entriesByTransfer.get(transfer.id) ?? [];
    const result  = computeBlendedTransfer(transfer, entries);

    let amount = 0;
    switch (mode) {
      case "remaining-only": amount = result.remainingProjected; break;
      case "blended":        amount = result.blendedTotal; break;
      case "confirmed-only": amount = result.confirmedTotal; break;
      case "full":           amount = projectMonthlyTransfer(transfer); break;
    }

    if (transfer.direction === "in") {
      abonos += amount;
      abonosConfirmed += result.confirmedTotal;
    } else {
      transferencias += amount;
      transferenciaConfirmed += result.confirmedTotal;
    }
  }

  return {
    abonos: roundCents(abonos),
    transferencias: roundCents(transferencias),
    abonosConfirmed: roundCents(abonosConfirmed),
    transferenciaConfirmed: roundCents(transferenciaConfirmed),
  };
}

function getTransferIntervalDays(transfer: PlannedTransfer): number {
  switch (transfer.frequency) {
    case "weekly":   return 7;
    case "biweekly": return 14;
    case "monthly":  return 30;
    case "one_time": return 0;
    case "custom":   return transfer.custom_interval_days ?? 30;
    default:         return 0;
  }
}

export interface ExpectedTransferSlot {
  date: string;
  isPast: boolean;
  entry: PlannedTransferEntry | null;
}

export function computeExpectedTransferDates(
  transfer: PlannedTransfer,
  monthStr: string,
  today: string,
  entries: PlannedTransferEntry[]
): ExpectedTransferSlot[] {
  if (!transfer.start_date) return [];

  if (transfer.frequency === "one_time") {
    const dateMonth = transfer.start_date.substring(0, 7);
    if (dateMonth !== monthStr) return [];
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return [{ date: transfer.start_date, isPast: transfer.start_date <= today, entry: sortedEntries[0] ?? null }];
  }

  const intervalDays = getTransferIntervalDays(transfer);
  if (intervalDays <= 0) return [];

  let cursor = parseISO(transfer.start_date + "T12:00:00");
  const monthStart = parseISO(monthStr + "-01T12:00:00");
  const monthEnd = endOfMonth(monthStart);

  while (cursor < monthStart) cursor = addDays(cursor, intervalDays);

  const expectedDates: string[] = [];
  while (cursor <= monthEnd) {
    expectedDates.push(format(cursor, "yyyy-MM-dd"));
    cursor = addDays(cursor, intervalDays);
  }

  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return expectedDates.map((date, i) => ({
    date,
    isPast: date <= today,
    entry: sortedEntries[i] ?? null,
  }));
}

export function computeTransferConfirmationStatus(
  transfer: PlannedTransfer,
  entries: PlannedTransferEntry[]
): TransferConfirmationStatus {
  const result = computeBlendedTransfer(transfer, entries);
  const { confirmedCount, expectedCount, confirmedTotal, remainingProjected } = result;
  let status: "confirmed" | "partial" | "pending";
  if (confirmedCount >= expectedCount && expectedCount > 0) status = "confirmed";
  else if (confirmedCount > 0) status = "partial";
  else status = "pending";
  return { status, confirmedCount, expectedCount, confirmedTotal, remainingAmount: remainingProjected };
}

export function computeTransferOverdueAlerts(
  transfers: PlannedTransfer[],
  entriesGrouped: Map<string, PlannedTransferEntry[]>,
  monthStr: string,
  today: string
): TransferOverdueAlert[] {
  const alerts: TransferOverdueAlert[] = [];
  for (const transfer of transfers) {
    if (!transfer.is_active || !transfer.start_date) continue;
    const entries = entriesGrouped.get(transfer.id) ?? [];
    const intervalDays = getTransferIntervalDays(transfer);
    if (intervalDays <= 0 && transfer.frequency !== "one_time") continue;
    const slots = computeExpectedTransferDates(transfer, monthStr, today, entries);
    const overdueCount = slots.filter((s) => s.isPast && s.entry === null).length;
    if (overdueCount > 0) {
      alerts.push({ transferId: transfer.id, transferName: transfer.name, direction: transfer.direction, overdueCount, confirmedCount: entries.length });
    }
  }
  return alerts;
}
