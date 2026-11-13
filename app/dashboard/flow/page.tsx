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

function FlowContent({ year }: { year: string }) {
  const db      = getDb();
  const accRepo = new AccountsRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const incRepo = new IncomeRepository(db);
  const msiRepo = new MsiRepository(db);

  const loanAccounts   = accRepo.findByType("loan");
  const creditAccounts = accRepo.findByType("credit");
  const debitAccounts  = accRepo.findByType("debit");

  const flowRows = [];
  let prevCapitalFin = 0;

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, "0")}`;
    const allIncome = incRepo.findEntriesByMonth(monthStr);
    const nomina = allIncome.reduce((s, e) => s + e.amount, 0);

    let abonos = 0, transferencias = 0;
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      abonos         += txs.filter((t) => t.type === "transfer_in").reduce((s, t) => s + t.amount, 0);
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
    const loansTotal       = loans.reduce((s, l) => s + l.amount, 0);
    const ingresos_totales = nomina + abonos;
    const gastos_totales   = transferencias + tarjetas + loansTotal;
    const capital_inicio: number   = prevCapitalFin;
    const capital_fin: number      = capital_inicio + ingresos_totales - gastos_totales;

    flowRows.push({
      month: monthStr, capital_inicio, nomina, abonos, ingresos_totales,
      transferencias, tarjetas, loans, gastos_totales, capital_fin,
      variacion: calcVariation(capital_inicio, capital_fin),
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
