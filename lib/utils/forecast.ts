import { addMonths, format } from "date-fns";
import { IncomeSource } from "@/lib/types";

export interface MonthlyForecast {
  month: string;
  expectedIncome: number;
  committedMsi: number;
  estimatedExpenses: number;
  netFlow: number;
  isNegative: boolean;
}

/**
 * Proyecta el ingreso esperado para un mes dado según la frecuencia de la fuente.
 */
export function projectIncomeForMonth(source: IncomeSource, yearMonth: string): number {
  if (!source.is_active) return 0;

  const [year, month] = yearMonth.split("-").map(Number);
  const targetDate = new Date(year, month - 1, 1);

  if (source.start_date) {
    const start = new Date(source.start_date + "T12:00:00");
    if (targetDate < new Date(start.getFullYear(), start.getMonth(), 1)) return 0;
  }

  switch (source.frequency) {
    case "monthly":
      return source.base_amount;
    case "biweekly":
      return source.base_amount * 2;
    case "weekly":
      return source.base_amount * 4;
    case "custom":
      return source.base_amount;
    default:
      return 0;
  }
}

/**
 * Genera pronóstico de flujo de caja para N meses hacia adelante.
 */
export function generateForecast(params: {
  incomeSources: IncomeSource[];
  monthlyMsiCommitments: Record<string, number>;
  avgMonthlyExpenses: number;
  startMonth?: string;
  monthsAhead?: number;
}): MonthlyForecast[] {
  const {
    incomeSources,
    monthlyMsiCommitments,
    avgMonthlyExpenses,
    startMonth,
    monthsAhead = 12,
  } = params;

  const start = startMonth
    ? new Date(startMonth + "-01")
    : new Date();

  const forecasts: MonthlyForecast[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const date = addMonths(start, i);
    const yearMonth = format(date, "yyyy-MM");

    const expectedIncome = incomeSources.reduce(
      (sum, src) => sum + projectIncomeForMonth(src, yearMonth),
      0
    );
    const committedMsi = monthlyMsiCommitments[yearMonth] ?? 0;
    const estimatedExpenses = avgMonthlyExpenses + committedMsi;
    const netFlow = expectedIncome - estimatedExpenses;

    forecasts.push({
      month: yearMonth,
      expectedIncome,
      committedMsi,
      estimatedExpenses,
      netFlow,
      isNegative: netFlow < 0,
    });
  }

  return forecasts;
}

/**
 * Calcula el promedio de gastos de los últimos N meses a partir de un historial.
 */
export function calcAvgMonthlyExpenses(
  monthlyTotals: number[],
  lastN = 3
): number {
  if (monthlyTotals.length === 0) return 0;
  const slice = monthlyTotals.slice(-lastN);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
