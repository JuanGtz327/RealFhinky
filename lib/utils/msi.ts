import { addMonths, format } from "date-fns";

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
 * - Cuota base: floor(total / meses)
 * - Residual: total - (cuota_base * meses) → se agrega al último mes
 */
export function expandMsi(total: number, months: number, startDate?: string): MsiExpansionResult {
  if (months <= 1) {
    throw new Error("MSI requiere al menos 2 meses");
  }
  if (total <= 0) {
    throw new Error("El monto debe ser mayor a 0");
  }

  // Cuota en pesos enteros (sin centavos), el residual absorbe el resto
  const baseAmount = Math.floor(total / months);
  const residual = Math.round((total - baseAmount * months) * 100) / 100;
  const start = startDate ? new Date(startDate + "T12:00:00") : new Date();

  const installments: MsiInstallmentResult[] = [];
  for (let i = 0; i < months; i++) {
    const date = addMonths(start, i);
    const isLast = i === months - 1;
    installments.push({
      month: format(date, "yyyy-MM"),
      amount: isLast ? baseAmount + residual : baseAmount,
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
  const start = new Date(startDate + "-01");
  const current = new Date(currentMonth + "-01");

  const monthsDiff =
    (current.getFullYear() - start.getFullYear()) * 12 +
    (current.getMonth() - start.getMonth());

  const paid = Math.min(Math.max(monthsDiff, 0), msiMonths);
  const remaining = Math.max(msiMonths - paid, 0);

  return { paid, remaining, total: msiMonths };
}
