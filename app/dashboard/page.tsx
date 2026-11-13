import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { getCreditUtilizationAlert } from "@/lib/utils/alerts";
import { calcVariation, formatMXN } from "@/lib/utils/formatters";
import { format } from "date-fns";

import { DebitTable } from "@/components/dashboard/DebitTable";
import { CreditTable } from "@/components/dashboard/CreditTable";
import { KPICard } from "@/components/ui/kpi-card";
import { FadeIn, StaggerGrid } from "@/components/ui/animated";
import {
  Wallet, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  BarChart3, CreditCard, Landmark, ChevronRight,
} from "lucide-react";import Link from "next/link";

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

  // ── Datos para Tabla 1: Flujo mensual ───────────────────────
  const loanAccounts   = accRepo.findByType("loan");
  const creditAccounts = accRepo.findByType("credit");
  const debitAccounts  = accRepo.findByType("debit");

  const flowRows: Array<{
    month: string; capital_inicio: number; nomina: number; abonos: number;
    ingresos_totales: number; transferencias: number; tarjetas: number;
    loans: { account_id: string; name: string; amount: number }[];
    gastos_totales: number; capital_fin: number; variacion: number | null;
  }> = [];  let prevCapitalFin = 0;

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${CURRENT_YEAR}-${String(m).padStart(2, "0")}`;
    const allIncome = incRepo.findEntriesByMonth(monthStr);
    const nomina = allIncome.reduce((s, e) => s + e.amount, 0);

    let abonos = 0, transferencias = 0;
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      abonos        += txs.filter((t) => t.type === "transfer_in").reduce((s, t) => s + t.amount, 0);
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
    const loansTotal      = loans.reduce((s, l) => s + l.amount, 0);
    const ingresos_totales = nomina + abonos;
    const gastos_totales   = transferencias + tarjetas + loansTotal;
    const capital_inicio   = prevCapitalFin;
    const capital_fin      = capital_inicio + ingresos_totales - gastos_totales;

    flowRows.push({
      month: monthStr, capital_inicio, nomina, abonos, ingresos_totales,
      transferencias, tarjetas, loans, gastos_totales, capital_fin,
      variacion: calcVariation(capital_inicio, capital_fin),
    });
    prevCapitalFin = capital_fin;
  }

  // ── Datos para Tabla 2: Desglose por tarjeta ────────────────
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
  const investAccounts = accRepo.findByType("investment");
  const allDebit = [...debitAccounts, ...investAccounts].map((acc) => ({
    id: acc.id, name: acc.name, bank: acc.bank,
    capital: acc.current_balance,
    yield_rate: acc.yield_rate ?? 0,
    annual_projection: acc.current_balance * ((acc.yield_rate ?? 0) / 100),
    daily_projection: (acc.current_balance * ((acc.yield_rate ?? 0) / 100)) / 365,
  }));
  const debitTotals = {
    capital: allDebit.reduce((s, a) => s + a.capital, 0),
    annual_projection: allDebit.reduce((s, a) => s + a.annual_projection, 0),
    daily_projection: allDebit.reduce((s, a) => s + a.daily_projection, 0),
  };

  // ── Widget: deuda ────────────────────────────────────────────
  const allCredit = [...creditAccounts, ...loanAccounts].map((acc) => {
    const limit       = acc.credit_limit ?? 0;
    const balance     = acc.current_balance;
    const utilization = limit > 0 ? (balance / limit) * 100 : 0;
    return {
      id: acc.id, name: acc.name, bank: acc.bank,
      credit_limit: limit, current_balance: balance,
      available: limit - balance,
      utilization_pct: utilization,
      utilization_level: getCreditUtilizationAlert(utilization),
    };
  });

  // ── KPIs rápidos ─────────────────────────────────────────────
  const currentFlowRow  = flowRows.find((r) => r.month === CURRENT_MONTH);
  const totalDeuda      = allCredit.reduce((s, a) => s + a.current_balance, 0);
  const totalCapital    = debitTotals.capital;
  const totalGastoAnual = flowRows.reduce((s, r) => s + r.gastos_totales, 0);
  const totalMsiAnual   = flowRows.reduce((s, r) => s + r.tarjetas, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Resumen financiero — {CURRENT_YEAR}</p>
      </FadeIn>

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
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-navbar)]">
            <Landmark className="w-4 h-4 text-[var(--color-navbar)]" /> Cuentas Débito
          </h2>
          <DebitTable accounts={allDebit} totals={debitTotals} />
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-navbar)]">
            <CreditCard className="w-4 h-4 text-[var(--color-navbar)]" /> Tarjetas de Crédito
          </h2>
          <CreditTable accounts={allCredit} />
        </section>
      </div>

    </div>
  );
}
