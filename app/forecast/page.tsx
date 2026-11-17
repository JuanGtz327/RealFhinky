import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { generateForecast, calcAvgMonthlyExpenses } from "@/lib/utils/forecast";
import { formatMXN } from "@/lib/utils/formatters";
import { format, addMonths } from "date-fns";
import { KPICard } from "@/components/ui/kpi-card";
import { FadeIn, StaggerGrid } from "@/components/ui/animated";
import { ForecastTable } from "@/components/forecast/ForecastTable";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

export default function ForecastPage() {
  const db      = getDb();
  const incRepo = new IncomeRepository(db);
  const msiRepo = new MsiRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const accRepo = new AccountsRepository(db);

  const sources = incRepo.findAllSources();

  const monthlyMsiCommitments: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const month = format(addMonths(new Date(), i), "yyyy-MM");
    monthlyMsiCommitments[month] = msiRepo.sumByMonth(month);
  }

  const creditAccounts = accRepo.findByType("credit");
  const loanAccounts   = accRepo.findByType("loan");
  const monthlyTotals: number[] = [];
  for (let i = 3; i >= 1; i--) {
    const month = format(addMonths(new Date(), -i), "yyyy-MM");
    let total = 0;
    for (const acc of [...creditAccounts, ...loanAccounts]) {
      total += txRepo.sumByAccountAndMonth(acc.id, month);
    }
    monthlyTotals.push(total);
  }
  const avgExpenses = calcAvgMonthlyExpenses(monthlyTotals, 3);

  const forecast = generateForecast({
    incomeSources: sources,
    monthlyMsiCommitments,
    avgMonthlyExpenses: avgExpenses,
    startMonth: CURRENT_MONTH,
    monthsAhead: 12,
  });

  const negativMonths = forecast.filter((f) => f.isNegative).length;
  const totalIncome   = forecast.reduce((s, f) => s + f.expectedIncome, 0);
  const totalExpenses = forecast.reduce((s, f) => s + f.estimatedExpenses, 0);

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Pronóstico</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Proyección de flujo de caja — próximos 12 meses
        </p>
      </FadeIn>

      <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4" staggerDelay={0.06}>
        {[
          <KPICard key="1" label="Ingreso proyectado (12m)" value={formatMXN(totalIncome)}    variant="income"  />,
          <KPICard key="2" label="Gasto estimado (12m)"     value={formatMXN(totalExpenses)}  variant="expense" />,
          <KPICard key="3" label="Promedio gasto/mes"       value={formatMXN(avgExpenses)}    variant="neutral" sub="últimos 3 meses" />,
          <KPICard
            key="4"
            label="Meses en déficit"
            value={String(negativMonths)}
            variant={negativMonths > 0 ? "debt" : "income"}
            sub={negativMonths > 0 ? "⚠️ Revisar" : "✅ Todo bien"}
          />,
        ]}
      </StaggerGrid>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-navbar)]">Flujo proyectado</h2>
        <p className="text-xs text-[var(--color-muted)]">
          Gasto estimado = promedio histórico + cuotas MSI comprometidas
        </p>
        <ForecastTable rows={forecast} />
      </section>
    </div>
  );
}
