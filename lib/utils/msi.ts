import { addMonths, format } from "date-fns";

export const roundCents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Dado la fecha de compra y el día de corte de la tarjeta, retorna la fecha
 * del primer mes de facturación (YYYY-MM-01).
 * Si la compra fue DESPUÉS del corte, el primer cargo aparece el mes siguiente.
 */
export function billingStartDate(purchaseDate: string, cutDay: number): string {
  const year  = parseInt(purchaseDate.substring(0, 4), 10);
  const month = parseInt(purchaseDate.substring(5, 7), 10); // 1-indexed
  const day   = parseInt(purchaseDate.substring(8, 10), 10);

  if (day > cutDay) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export interface MsiInstallmentResult {
  month: string;
  amount: number;
  isLast: boolean;
}

export interface MsiExpansionResult {
  monthlyAmount: number;
  residual: number;
  total: number;
  installments: MsiInstallmentResult[];
}

/**
 * Calcula la distribución de una compra a MSI.
 * - Cuota base: round(total / meses, 2) — preserva centavos
 * - Último mes absorbe el ajuste de redondeo (máximo 1 centavo de diferencia)
 */
export function expandMsi(total: number, months: number, startDate?: string): MsiExpansionResult {
  if (months <= 1) {
    throw new Error("MSI requiere al menos 2 meses");
  }
  if (total <= 0) {
    throw new Error("El monto debe ser mayor a 0");
  }

  // Cuota redondeada a 2 decimales
  const baseAmount = roundCents(total / months);
  // El último mes absorbe la diferencia exacta para que el total cuadre al centavo
  const lastAmount = roundCents(total - baseAmount * (months - 1));
  const residual   = roundCents(lastAmount - baseAmount);

  const start = startDate ? new Date(startDate + "T12:00:00") : new Date();

  const installments: MsiInstallmentResult[] = [];
  for (let i = 0; i < months; i++) {
    const date = addMonths(start, i);
    const isLast = i === months - 1;
    installments.push({
      month:  format(date, "yyyy-MM"),
      amount: isLast ? lastAmount : baseAmount,
      isLast,
    });
  }

  return {
    monthlyAmount: baseAmount,
    residual,
    total,
    installments,
  };
}

/**
 * Dado un mes YYYY-MM, retorna cuántas cuotas han pasado y cuántas faltan
 * respecto al total de meses del plan MSI.
 */
export function getMsiProgress(
  startDate: string,
  msiMonths: number,
  currentMonth: string
): { paid: number; remaining: number; total: number } {
  // Parse directly from strings to avoid UTC→local timezone shift
  const startYear  = parseInt(startDate.substring(0, 4), 10);
  const startMon   = parseInt(startDate.substring(5, 7), 10) - 1; // 0-indexed
  const currentYear = parseInt(currentMonth.substring(0, 4), 10);
  const currentMon  = parseInt(currentMonth.substring(5, 7), 10) - 1; // 0-indexed

  const monthsDiff = (currentYear - startYear) * 12 + (currentMon - startMon);

  const paid = Math.min(Math.max(monthsDiff, 0), msiMonths);
  const remaining = Math.max(msiMonths - paid, 0);

  return { paid, remaining, total: msiMonths };
}

/**
 * Cuántos ciclos de facturación han cerrado desde el inicio del MSI.
 */
export function msiElapsed(startDate: string, cutDay?: number): number {
  const purchaseYear  = parseInt(startDate.substring(0, 4), 10);
  const purchaseMonth = parseInt(startDate.substring(5, 7), 10);
  const purchaseDay   = parseInt(startDate.substring(8, 10), 10);

  let billingYear: number;
  let billingMonth: number;
  if (cutDay && purchaseDay > cutDay) {
    billingMonth = purchaseMonth === 12 ? 0 : purchaseMonth;
    billingYear  = purchaseMonth === 12 ? purchaseYear + 1 : purchaseYear;
  } else {
    billingYear  = purchaseYear;
    billingMonth = purchaseMonth - 1;
  }

  const now = new Date();
  const cycleClosedThisMonth = cutDay && now.getDate() > cutDay ? 1 : 0;

  return Math.max(0,
    (now.getFullYear() - billingYear) * 12 + (now.getMonth() - billingMonth) + cycleClosedThisMonth
  );
}

/**
 * Monto pendiente de un plan MSI (suma de cuotas no vencidas).
 */
export function msiRemainingAmount(amount: number, msiMonths: number, startDate: string, cutDay?: number): number {
  if (!amount || !msiMonths || !startDate) return 0;
  const elapsed = msiElapsed(startDate, cutDay);
  const remaining = Math.max(0, msiMonths - elapsed);
  if (remaining === 0) return 0;
  const base = roundCents(amount / msiMonths);
  const last = roundCents(amount - base * (msiMonths - 1));
  let total = 0;
  for (let i = elapsed; i < msiMonths; i++) {
    total += i === msiMonths - 1 ? last : base;
  }
  return roundCents(total);
}
