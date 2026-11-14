import { format, addMonths } from "date-fns";

/**
 * Calcula el rango de fechas de un ciclo de facturación dado su mes de referencia y día de corte.
 * cycleMonth: "YYYY-MM" — el mes al que pertenece el estado de cuenta.
 */
export function computeBillingPeriod(
  cycleMonth: string,
  cutDay: number | null
): { periodStart: string; periodEnd: string } {
  if (cutDay) {
    const y = parseInt(cycleMonth.slice(0, 4), 10);
    const m = parseInt(cycleMonth.slice(5, 7), 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const clamp = Math.min(cutDay, daysInMonth);
    const periodEnd = `${cycleMonth}-${String(clamp).padStart(2, "0")}`;
    const prev = addMonths(new Date(y, m - 1, 1), -1);
    const py = prev.getFullYear();
    const pm = prev.getMonth() + 1;
    const daysInPrev = new Date(py, pm, 0).getDate();
    const periodStart =
      cutDay >= daysInPrev
        ? `${cycleMonth}-01`
        : `${py}-${String(pm).padStart(2, "0")}-${String(cutDay + 1).padStart(2, "0")}`;
    return { periodStart, periodEnd };
  }
  const y = parseInt(cycleMonth.slice(0, 4), 10);
  const m = parseInt(cycleMonth.slice(5, 7), 10);
  return {
    periodStart: `${cycleMonth}-01`,
    periodEnd: format(addMonths(new Date(y, m - 1, 1), 1), "yyyy-MM-dd"),
  };
}
