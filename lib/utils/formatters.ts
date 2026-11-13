/**
 * Formato moneda MXN: $1,234.56
 */
export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formato porcentaje: 12.5%
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formato fecha legible: 15 ene 2025
 */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr + "T12:00:00"));
}

/**
 * Formato mes legible: Enero 2025
 */
export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

/**
 * Mes corto: ene 25
 */
export function formatMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    year: "2-digit",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

/**
 * Variación porcentual entre dos valores.
 * Retorna null si el valor base es 0.
 */
export function calcVariation(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}
