import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { generateForecast, calcAvgMonthlyExpenses, projectIncomeForMonth } from "@/lib/utils/forecast";
import { formatMXN } from "@/lib/utils/formatters";
import { format, addMonths } from "date-fns";
import { KPICard } from "@/components/ui/kpi-card";
import { FadeIn, StaggerGrid } from "@/components/ui/animated";
import { ForecastTable } from "@/components/forecast/ForecastTable";
import { NewIncomeSourceModal } from "@/components/forecast/NewIncomeSourceModal";
import { StatusBadge } from "@/components/ui/status-badge";
import EmptyState from "@/components/kokonutui/empty-state";
import { DollarSign } from "lucide-react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

export default function ForecastPage() {
  const db       = getDb();
  const incRepo  = new IncomeRepository(db);
  const msiRepo  = new MsiRepository(db);
  const txRepo   = new TransactionsRepository(db);
  const accRepo  = new AccountsRepository(db);

  const sources = incRepo.findAllSources();

  // Compromisos MSI por mes (próximos 12 meses)
  const monthlyMsiCommitments: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const month = format(addMonths(new Date(), i), "yyyy-MM");
    monthlyMsiCommitments[month] = msiRepo.sumByMonth(month);
  }

  // Promedio de gastos últimos 3 meses
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

  // Generar pronóstico 12 meses
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

  const FREQ_LABELS: Record<string, string> = {
    weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Pronóstico</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Proyección de flujo de caja — próximos 12 meses
        </p>
      </FadeIn>

      {/* KPIs */}
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

      {/* Tabla de pronóstico */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-navbar)]">Flujo proyectado</h2>
        <p className="text-xs text-[var(--color-muted)]">
          Gasto estimado = promedio histórico + cuotas MSI comprometidas
        </p>
        <ForecastTable rows={forecast} />
      </section>

      {/* Fuentes de ingreso */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-navbar)]">
            Fuentes de ingreso
            <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">({sources.length})</span>
          </h2>
          <NewIncomeSourceModal />
        </div>

        {sources.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="Sin fuentes de ingreso configuradas"
            description="Agrega tu nómina para ver pronósticos precisos"
          />
        ) : (
          <div className="space-y-2">
            {sources.map((src) => {
              const monthlyEst = projectIncomeForMonth(src, CURRENT_MONTH);
              return (
                <div key={src.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] card-elevated card-lift px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--color-foreground)]">{src.name}</p>
                      {src.is_variable && <StatusBadge variant="muted">Variable</StatusBadge>}
                    </div>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {FREQ_LABELS[src.frequency]} · {formatMXN(src.base_amount)}/pago
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium text-[var(--color-success)]">
                      {formatMXN(monthlyEst)}<span className="text-[var(--color-muted)] text-xs">/mes</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
