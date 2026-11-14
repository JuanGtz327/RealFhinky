import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { calcVariation, formatMXN } from "@/lib/utils/formatters";
import { format } from "date-fns";
import { MonthlyFlowTable } from "@/components/dashboard/MonthlyFlowTable";
import { YearSelector } from "@/components/ui/year-selector";
import { FadeIn } from "@/components/ui/animated";
import { BarChart3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

/** Proyecta cuánto ingresa en un mes dado una fuente de ingreso activa. */
function projectMonthlyIncome(source: { frequency: string; base_amount: number; custom_interval_days?: number }): number {
  switch (source.frequency) {
    case "weekly":    return source.base_amount * 4;
    case "biweekly":  return source.base_amount * 2;
    case "monthly":   return source.base_amount;
    case "custom": {
      const days = source.custom_interval_days;
      if (!days || days <= 0) return source.base_amount;
      return source.base_amount * Math.round(30 / days);
    }
    default: return source.base_amount;
  }
}

function FlowContent({ year }: { year: string }) {
  const db      = getDb();
  const accRepo = new AccountsRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const incRepo = new IncomeRepository(db);
  const msiRepo = new MsiRepository(db);

  const loanAccounts   = accRepo.findByType("loan");
  const creditAccounts = accRepo.findByType("credit");
  const debitAccounts  = accRepo.findByType("debit");
  const incomeSources  = incRepo.findAllSources();

  // Capital base = saldo actual de todas las cuentas débito (patrimonio líquido real)
  const patrimonioActual = debitAccounts.reduce((s, a) => s + a.current_balance, 0);

  // Proyección mensual de nómina (para meses sin income_entries registradas)
  const nominaProyectada = incomeSources.reduce((s, src) => s + projectMonthlyIncome(src), 0);

  const flowRows = [];
  // Para el año en curso: anclar el capital_inicio del mes actual al patrimonio real.
  // Meses pasados del año = se calculan hacia atrás con 0 de movimiento (sin historial).
  // Para años distintos al actual: todo parte de 0.
  const currentYear = format(new Date(), "yyyy");
  let prevCapitalFin: number | null = null;

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, "0")}`;
    const isCurrent = monthStr === CURRENT_MONTH;
    const isFuture  = monthStr > CURRENT_MONTH;

    // Nómina: si hay entradas registradas para ese mes, usarlas.
    // Si es mes futuro (o actual sin entradas), proyectar desde las fuentes.
    const registeredIncome = incRepo.findEntriesByMonth(monthStr);
    const hasRegistered = registeredIncome.length > 0;
    const nomina = hasRegistered
      ? registeredIncome.reduce((s, e) => s + e.amount, 0)
      : (isFuture || isCurrent) && year === currentYear
        ? nominaProyectada
        : 0;

    let abonos = 0, transferencias = 0;
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      abonos         += txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      transferencias += txs.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0);
    }

    let tarjetas = 0;
    for (const acc of creditAccounts) {
      tarjetas += txRepo.sumByAccountAndMonth(acc.id, monthStr);
      tarjetas += msiRepo.sumByAccountAndMonth(acc.id, monthStr);
    }

    const loans = loanAccounts.map((acc) => ({
      account_id: acc.id, name: acc.name,
      amount: txRepo.sumByAccountAndMonth(acc.id, monthStr),
    }));
    const loansTotal       = loans.reduce((s, l) => s + l.amount, 0);
    const ingresos_totales = nomina + abonos;
    const gastos_totales   = transferencias + tarjetas + loansTotal;

    // Anclar el mes actual al patrimonio real; el resto se encadena.
    let capital_inicio: number;
    if (isCurrent && year === currentYear) {
      capital_inicio = patrimonioActual;
    } else {
      capital_inicio = prevCapitalFin ?? 0;
    }
    const capital_fin: number = capital_inicio + ingresos_totales - gastos_totales;

    flowRows.push({
      month: monthStr, capital_inicio, nomina, abonos, ingresos_totales,
      transferencias, tarjetas, loans, gastos_totales, capital_fin,
      variacion: calcVariation(capital_inicio, capital_fin),
      is_projected: !hasRegistered && (isFuture || isCurrent),
    });
    prevCapitalFin = capital_fin;
  }

  const totalGastos   = flowRows.reduce((s, r) => s + r.gastos_totales, 0);
  const totalIngresos = flowRows.reduce((s, r) => s + r.ingresos_totales, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-6 mb-2">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-[var(--color-muted)]">Ingresos {year}</p>
            <p className="text-lg font-semibold text-[var(--color-success)]">{formatMXN(totalIngresos)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Gastos {year}</p>
            <p className="text-lg font-semibold text-[var(--color-foreground)]">{formatMXN(totalGastos)}</p>
          </div>
        </div>
      </div>
      <MonthlyFlowTable
        rows={flowRows as Parameters<typeof MonthlyFlowTable>[0]["rows"]}
        loanColumns={loanAccounts.map((a) => ({ id: a.id, name: a.name }))}
        currentMonth={CURRENT_MONTH}
      />
    </>
  );
}

export default function FlowPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = searchParams.year ?? new Date().getFullYear().toString();

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--color-foreground)]">
              <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" /> Flujo General Mensual
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Capital, ingresos y gastos mes a mes
            </p>
          </div>
          <YearSelector year={Number(year)} />
        </div>
      </FadeIn>

      <Suspense fallback={<p className="text-[var(--color-muted)]">Cargando…</p>}>
        <FlowContent year={year} />
      </Suspense>
    </div>
  );
}
