/**
 * Calcula los días que faltan para una fecha de día-del-mes dado el día actual.
 * Ejemplo: cut_date = 15, hoy es 10 → faltan 5 días.
 *          cut_date = 5, hoy es 20  → faltan ~15 días (próximo mes).
 */
export function daysUntilDayOfMonth(dayOfMonth: number): number {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
  const target = thisMonth >= today ? thisMonth : nextMonth;
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calcula los días que faltan para una fecha específica (YYYY-MM-DD).
 */
export function daysUntilDate(dateStr: string): number {
  const target = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export type AlertLevel = "ok" | "warning" | "danger";

export interface DateAlert {
  level: AlertLevel;
  daysRemaining: number;
}

/** Alerta para fecha de corte (warning ≤7 días) */
export function getCutDateAlert(cutDate: number): DateAlert {
  const days = daysUntilDayOfMonth(cutDate);
  return {
    daysRemaining: days,
    level: days <= 7 ? "warning" : "ok",
  };
}

/** Alerta para fecha de pago (danger ≤3 días, warning ≤7 días) */
export function getPaymentDateAlert(paymentDueDate: number): DateAlert {
  const days = daysUntilDayOfMonth(paymentDueDate);
  return {
    daysRemaining: days,
    level: days <= 3 ? "danger" : days <= 7 ? "warning" : "ok",
  };
}

/** Alerta para fecha de cobro de anualidad (warning ≤30 días) */
export function getAnnualFeeAlert(annualFeeDate: string): DateAlert {
  const days = daysUntilDate(annualFeeDate);
  return {
    daysRemaining: days,
    level: days <= 30 ? "warning" : "ok",
  };
}

/** Nivel de alerta para % de utilización de crédito */
export function getCreditUtilizationAlert(utilization: number): AlertLevel {
  if (utilization > 70) return "danger";
  if (utilization >= 30) return "warning";
  return "ok";
}
