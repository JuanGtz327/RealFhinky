import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { formatMXN } from "@/lib/utils/formatters";
import { computeFlowRows, computeDebitSummary, computeDebtSummary, computeIncomeOverdueAlerts } from "@/lib/domain";
import { format } from "date-fns";

import { DebitTable } from "@/components/dashboard/DebitTable";
import { CreditTable } from "@/components/dashboard/CreditTable";
import { LoanDebtTable } from "@/components/dashboard/LoanDebtTable";
import { KPICard } from "@/components/ui/kpi-card";
import { StaggerGrid } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import {
  Wallet, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  BarChart3, CreditCard, Landmark, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { IncomeAlertsWidget } from "@/components/dashboard/IncomeAlertsWidget";

const CURRENT_YEAR  = new Date().getFullYear().toString();
const CURRENT_MONTH = format(new Date(), "yyyy-MM");
const MONTH_NAME    = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date()).replace(/^\w/, (c) => c.toUpperCase());
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

export default function DashboardPage() {
  const db = getDb();
  const accRepo = new AccountsRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const incRepo = new IncomeRepository(db);
  const msiRepo = new MsiRepository(db);

  // ── Tabla 1: Flujo mensual ───────────────────────────────────
  const { rows: flowRows } = computeFlowRows(CURRENT_YEAR, { accRepo, txRepo, incRepo, msiRepo });

  // ── Tabla 2: Desglose por tarjeta ────────────────────────────
  const creditAccounts = accRepo.findByType("credit");
  const years = [CURRENT_YEAR, String(Number(CURRENT_YEAR) - 1)];
  const matrixByYear: Record<string, Record<string, Record<string, number>>> = {};

  for (const year of years) {
    matrixByYear[year] = {};
    for (const m of MONTHS) {
      const monthStr = `${year}-${m}`;
      matrixByYear[year][monthStr] = {};
      for (const acc of creditAccounts) {
        const isFuture = monthStr > CURRENT_MONTH;
        matrixByYear[year][monthStr][acc.id] = isFuture
          ? msiRepo.sumByAccountAndMonth(acc.id, monthStr)
          : txRepo.sumByAccountAndMonth(acc.id, monthStr);
      }
    }
  }

  // ── Widget: débito ───────────────────────────────────────────
  const debitAccounts  = accRepo.findByType("debit");
  const investAccounts = accRepo.findByType("investment");
  const loanAccounts   = accRepo.findByType("loan");
  const { accounts: allDebit, totals: debitTotals } = computeDebitSummary([...debitAccounts, ...investAccounts]);

  // ── Widget: deuda ────────────────────────────────────────────
  const allCredit = computeDebtSummary(creditAccounts);

  // ── Alertas de nómina ────────────────────────────────────────
  const incomeSources   = incRepo.findAllSources();
  const incomeGrouped   = incRepo.findEntriesByMonthGrouped(CURRENT_MONTH);
  const incomeOverdue   = computeIncomeOverdueAlerts(incomeSources, incomeGrouped, CURRENT_MONTH, format(new Date(), "yyyy-MM-dd"));

  // ── KPIs rápidos ─────────────────────────────────────────────
  const currentFlowRow  = flowRows.find((r) => r.month === CURRENT_MONTH);
  const totalDeudaTarjetas  = allCredit.reduce((s, a) => s + a.current_balance, 0);
  const totalCreditLimit    = allCredit.reduce((s, a) => s + a.credit_limit, 0);
  const totalCreditFree     = allCredit.reduce((s, a) => s + a.available, 0);
  const totalDeudaPrestamos = loanAccounts.reduce((s, a) => s + a.current_balance, 0);
  const totalDeuda = totalDeudaTarjetas + totalDeudaPrestamos;
  const totalCapital    = debitTotals.capital;
  const totalGastoAnual = flowRows.reduce((s, r) => s + r.gastos_totales, 0);
  const totalMsiAnual   = flowRows.reduce((s, r) => s + r.tarjetas, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Finanzas"
        title="Panel"
        subtitle={`Resumen financiero — ${CURRENT_YEAR}`}
      />

      {/* KPIs */}
      <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4" staggerDelay={0.07}>
        {[
          <KPICard key="1" label="Capital total"           value={formatMXN(totalCapital)} icon={<Wallet className="w-4 h-4" />}       variant="capital" />,
          <KPICard key="2" label="Deuda total"             value={formatMXN(totalDeuda)}   icon={<TrendingDown className="w-4 h-4" />} variant="debt" />,
          <KPICard key="3" label={`Ingresos ${MONTH_NAME}`} value={formatMXN(currentFlowRow?.ingresos_totales ?? 0)} icon={<ArrowUpCircle className="w-4 h-4" />}   variant="income" />,
          <KPICard key="4" label={`Gastos ${MONTH_NAME}`}   value={formatMXN(currentFlowRow?.gastos_totales ?? 0)}   icon={<ArrowDownCircle className="w-4 h-4" />} variant="expense" />,
        ]}
      </StaggerGrid>

      {/* Acceso rápido a tablas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/dashboard/flow"
          className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] card-elevated card-sweep px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-navbar)]/10 group-hover:bg-white/20 transition-colors">
              <BarChart3 className="w-5 h-5 text-[var(--color-navbar)] group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-foreground)] group-hover:text-white transition-colors">Flujo Mensual</p>
              <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">{CURRENT_YEAR} · {formatMXN(totalGastoAnual)} gastos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors" />
        </Link>

        <Link href="/dashboard/breakdown"
          className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] card-elevated card-sweep px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-navbar)]/10 group-hover:bg-white/20 transition-colors">
              <CreditCard className="w-5 h-5 text-[var(--color-navbar)] group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-foreground)] group-hover:text-white transition-colors">Desglose Tarjetas</p>
              <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">{CURRENT_YEAR} · {formatMXN(totalMsiAnual)} cargado</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors" />
        </Link>

        <Link href="/dashboard/debt"
          className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] card-elevated card-sweep px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-danger)]/8 group-hover:bg-white/20 transition-colors">
              <TrendingDown className="w-5 h-5 text-[var(--color-danger)] group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-foreground)] group-hover:text-white transition-colors">Deuda</p>
              <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">{formatMXN(totalDeuda)} total</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors" />
        </Link>
      </div>

      {/* Débito + Crédito en 2 columnas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between bg-[var(--color-navbar)] px-5 py-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-semibold text-white">Cuentas Débito</h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-white/40 uppercase tracking-wide">Capital</p>
                <p className="text-sm font-semibold text-white tabular-nums">{formatMXN(debitTotals.capital)}</p>
              </div>
              {debitTotals.annual_projection > 0 && (
                <div className="text-right">
                  <p className="text-xs text-white/40 uppercase tracking-wide">Rendimiento anual</p>
                  <p className="text-sm font-semibold text-white/70 tabular-nums">{formatMXN(debitTotals.annual_projection)}</p>
                </div>
              )}
            </div>
          </div>
          <DebitTable accounts={allDebit} totals={debitTotals} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between bg-[var(--color-navbar)] px-5 py-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-semibold text-white">Tarjetas de Crédito</h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-white/40 uppercase tracking-wide">Deuda</p>
                <p className="text-sm font-semibold text-white tabular-nums">{formatMXN(totalDeudaTarjetas)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 uppercase tracking-wide">Línea</p>
                <p className="text-sm font-semibold text-white/70 tabular-nums">{formatMXN(totalCreditLimit)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 uppercase tracking-wide">Disponible</p>
                <p className="text-sm font-semibold text-white/70 tabular-nums">{formatMXN(totalCreditFree)}</p>
              </div>
            </div>
          </div>
          <CreditTable accounts={allCredit} />
        </section>
      </div>

      {/* Préstamos + Ingresos en 2 columnas */}
      <div className={loanAccounts.length > 0 ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : ""}>

        {loanAccounts.length > 0 && (() => {
          const totalLoan = loanAccounts.reduce((s, l) => s + l.current_balance, 0);
          const totalMensualidad = loanAccounts.reduce((s, l) => s + (l.loan_monthly_payment ?? 0), 0);
          return (
            <section className="space-y-3">
              <div className="flex items-center justify-between bg-[var(--color-navbar)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-semibold text-white">Préstamos</h2>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-white/40 uppercase tracking-wide">Saldo total</p>
                    <p className="text-sm font-semibold text-white tabular-nums">{formatMXN(totalLoan)}</p>
                  </div>
                  {totalMensualidad > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-white/40 uppercase tracking-wide">Mensualidad</p>
                      <p className="text-sm font-semibold text-white/70 tabular-nums">{formatMXN(totalMensualidad)}</p>
                    </div>
                  )}
                </div>
              </div>
              <LoanDebtTable loans={loanAccounts} />
            </section>
          );
        })()}

        {/* Ingresos */}
        {(() => {
          const activeSources = incomeSources.filter((s) => s.is_active);
          const totalMonthly = activeSources.reduce((s, src) => {
            switch (src.frequency) {
              case "weekly":   return s + src.base_amount * 4;
              case "biweekly": return s + src.base_amount * 2;
              case "monthly":  return s + src.base_amount;
              case "custom": {
                const days = src.custom_interval_days;
                return s + (days && days > 0 ? src.base_amount * Math.round(30 / days) : src.base_amount);
              }
              default: return s;
            }
          }, 0);
          return (
            <section className="space-y-3">
              <div className="flex items-center justify-between bg-[var(--color-navbar)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[var(--color-accent)]" />
                  <h2 className="text-sm font-semibold text-white">Ingresos</h2>
                </div>
                {totalMonthly > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-white/40 uppercase tracking-wide">Proyección mensual</p>
                    <p className="text-sm font-semibold text-white tabular-nums">{formatMXN(totalMonthly)}</p>
                  </div>
                )}
              </div>
              <IncomeAlertsWidget alerts={incomeOverdue} incomeSources={incomeSources} />
            </section>
          );
        })()}

      </div>

    </div>
  );
}
