import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { calcVariation, formatMXN } from "@/lib/utils/formatters";
import { computeMonthlyNomina, computeIncomeOverdueAlerts } from "@/lib/domain/income";
import { IncomeOverdueBanner } from "@/components/forecast/IncomeOverdueBanner";
import { format } from "date-fns";
import { MonthlyFlowTable } from "@/components/dashboard/MonthlyFlowTable";
import { YearSelector } from "@/components/ui/year-selector";
import { FadeIn } from "@/components/ui/animated";
import { BarChart3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

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

  const patrimonioActual = debitAccounts.reduce((s, a) => s + a.current_balance, 0);

  const currentMonthEntries = incRepo.findEntriesByMonthGrouped(CURRENT_MONTH);
  const overdueAlerts = computeIncomeOverdueAlerts(incomeSources, currentMonthEntries, CURRENT_MONTH, format(new Date(), "yyyy-MM-dd"));

  const currentYear = format(new Date(), "yyyy");
  let prevCapitalFin: number | null = null;

  const flowRows = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr  = `${year}-${String(m).padStart(2, "0")}`;
    const isCurrent = monthStr === CURRENT_MONTH;
    const isFuture  = monthStr > CURRENT_MONTH;

    // Build entries map for this month grouped by source id
    const monthEntries   = incRepo.findEntriesByMonth(monthStr);
    const entriesBySource = new Map<string, typeof monthEntries>();
    for (const e of monthEntries) {
      const existing = entriesBySource.get(e.income_source_id) ?? [];
      existing.push(e);
      entriesBySource.set(e.income_source_id, existing);
    }

    let nomina: number;
    let nomina_display: number | undefined;
    let nomina_confirmed: number | undefined;
    let nomina_remaining: number | undefined;
    let is_partial: boolean | undefined;

    if (isCurrent && year === currentYear) {
      const displayResult    = computeMonthlyNomina(incomeSources, entriesBySource, "display");
      const remainingResult  = computeMonthlyNomina(incomeSources, entriesBySource, "remaining-only");
      nomina            = remainingResult.remaining;
      nomina_display    = displayResult.display;
      nomina_confirmed  = displayResult.confirmedCount;
      nomina_remaining  = remainingResult.remaining;
      is_partial        = displayResult.confirmedCount > 0 && displayResult.confirmedCount < displayResult.expectedCount;
    } else if (isFuture && year === currentYear) {
      const blendedResult = computeMonthlyNomina(incomeSources, entriesBySource, "blended");
      nomina     = blendedResult.blended;
      is_partial = blendedResult.confirmedCount > 0 && blendedResult.confirmedCount < blendedResult.expectedCount;
    } else {
      nomina = monthEntries.reduce((s, e) => s + e.amount, 0);
    }

    let abonos = 0, transferencias = 0;
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      abonos         += txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      transferencias += txs.filter((t) => t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
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
    const loansTotal = loans.reduce((s, l) => s + l.amount, 0);

    let ingresos_totales: number;
    let gastos_totales: number;

    if (isCurrent && year === currentYear) {
      // Only pending obligations: nomina remaining + no abonos/transfers (Fase 14)
      ingresos_totales = nomina;
      gastos_totales   = tarjetas + loansTotal;
    } else {
      ingresos_totales = nomina + abonos;
      gastos_totales   = transferencias + tarjetas + loansTotal;
    }

    let capital_inicio: number;
    if (isCurrent && year === currentYear) {
      capital_inicio = patrimonioActual;
    } else {
      capital_inicio = prevCapitalFin ?? 0;
    }
    const capital_fin = capital_inicio + ingresos_totales - gastos_totales;

    const hasRegistered   = monthEntries.length > 0;
    const is_projected    = !hasRegistered && (isFuture || isCurrent) && year === currentYear;

    flowRows.push({
      month: monthStr, capital_inicio, nomina: nomina_display ?? nomina, abonos, ingresos_totales,
      transferencias, tarjetas, loans, gastos_totales, capital_fin,
      variacion: calcVariation(capital_inicio, capital_fin),
      nomina_display, nomina_confirmed, nomina_remaining, is_projected, is_partial,
    });
    prevCapitalFin = capital_fin;
  }

  const totalGastos   = flowRows.reduce((s, r) => s + r.gastos_totales, 0);
  const totalIngresos = flowRows.reduce((s, r) => s + r.ingresos_totales, 0);

  return (
    <>
      {overdueAlerts.length > 0 && (
        <div className="mb-4">
          <IncomeOverdueBanner alerts={overdueAlerts} />
        </div>
      )}
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
