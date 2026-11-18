import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { FlowAdjustmentsRepository } from "@/lib/repositories/flow-adjustments.repo";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";
import { PlannedTransfersRepository } from "@/lib/repositories/planned-transfers.repo";
import { calcVariation, formatMXN } from "@/lib/utils/formatters";
import { roundCents } from "@/lib/utils/msi";
import { computeBillingPeriod } from "@/lib/utils/billing";
import { computeMonthlyNomina, computeIncomeOverdueAlerts, computeExpectedPaymentDates, computeBlendedIncome } from "@/lib/domain/income";
import { computeUntrackedDebt } from "@/lib/domain/flow-adjustment";
import { computeEffectiveMonth } from "@/lib/domain/account-detail";
import { computeBlendedCharge, isChargeInBillingPeriod } from "@/lib/domain/recurring-charges";
import { computeMonthlyPlannedTransfers, computeBlendedTransfer } from "@/lib/domain/planned-transfers";
import type { RecurringChargeEntry, PlannedTransferEntry } from "@/lib/types";
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
  const adjRepo        = new FlowAdjustmentsRepository(db);
  const chargeRepo     = new RecurringChargesRepository(db);
  const ptRepo         = new PlannedTransfersRepository(db);
  const allCharges     = chargeRepo.findAll();
  const allTransfers   = ptRepo.findAll();

  const allAccounts = accRepo.findAll(false);
  const onboardingMonth = allAccounts.length > 0
    ? allAccounts.sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at.substring(0, 7)
    : undefined;

  const patrimonioActual = debitAccounts.reduce((s, a) => s + a.current_balance, 0);

  const currentMonthEntries = incRepo.findEntriesByMonthGrouped(CURRENT_MONTH);
  const overdueAlerts = computeIncomeOverdueAlerts(incomeSources, currentMonthEntries, CURRENT_MONTH, format(new Date(), "yyyy-MM-dd"));

  const currentYear = format(new Date(), "yyyy");

  // Seed capital: for future years, project forward from current state to get
  // the capital_fin of December of (year - 1) as starting point for January.
  let prevCapitalFin: number | null = null;

  if (year > currentYear) {
    const [cyNum, cmNum] = CURRENT_MONTH.split("-").map(Number);
    const targetYearNum = parseInt(year);
    let seedCapital = patrimonioActual;

    for (let y = cyNum; y < targetYearNum; y++) {
      const startM = y === cyNum ? cmNum + 1 : 1;
      for (let m = startM; m <= 12; m++) {
        const mStr = `${y}-${String(m).padStart(2, "0")}`;
        const mEntries = incRepo.findEntriesByMonth(mStr);
        const mBySource = new Map<string, typeof mEntries>();
        for (const e of mEntries) {
          const arr = mBySource.get(e.income_source_id) ?? [];
          arr.push(e);
          mBySource.set(e.income_source_id, arr);
        }
        const nResult = computeMonthlyNomina(incomeSources, mBySource, "blended");
        let mAbonos = 0, mTransf = 0, mTarjetas = 0;
        for (const acc of debitAccounts) {
          const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(mStr));
          mAbonos += txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
          mTransf += txs.filter((t) => t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
        }
        for (const acc of creditAccounts) {
          const { periodStart, periodEnd } = computeBillingPeriod(mStr, acc.cut_date ?? null);
          mTarjetas += txRepo.sumPurchasesByPeriod(acc.id, periodStart, periodEnd);
          mTarjetas += msiRepo.sumByAccountAndMonth(acc.id, mStr);
        }
        const mLoans = loanAccounts.reduce((s, acc) => s + txRepo.sumByAccountAndMonth(acc.id, mStr), 0);
        seedCapital = seedCapital + nResult.blended + mAbonos - mTransf - mTarjetas - mLoans;
      }
    }
    prevCapitalFin = seedCapital;
  }

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
    } else if (isFuture) {
      const blendedResult = computeMonthlyNomina(incomeSources, entriesBySource, "blended");
      nomina     = blendedResult.blended;
      is_partial = blendedResult.confirmedCount > 0 && blendedResult.confirmedCount < blendedResult.expectedCount;
    } else {
      // Past months: use real confirmed entries only
      nomina = monthEntries.reduce((s, e) => s + e.amount, 0);
    }

    let abonos = 0, transferencias = 0;
    const abonosDetail: { accountName: string; date: string; merchant: string; amount: number }[] = [];
    const transferenciasDetail: { accountName: string; date: string; merchant: string; amount: number }[] = [];
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      for (const t of txs.filter((t) => t.type === "income")) {
        abonos += t.amount;
        abonosDetail.push({ accountName: acc.name, date: t.date, merchant: t.merchant ?? t.description ?? "", amount: t.amount });
      }
      for (const t of txs.filter((t) => t.type === "transfer_out")) {
        transferencias += t.amount;
        transferenciasDetail.push({ accountName: acc.name, date: t.date, merchant: t.merchant ?? t.description ?? "", amount: t.amount });
      }
    }

    let tarjetas = 0;
    const tarjetasBreakdown: { id: string; name: string; bank: string; purchases: number; msi: number; untracked?: number; flow_adjustment?: number | null; recurringCharges?: number; recurringChargesDetail?: { chargeId: string; name: string; amount: number; confirmed: boolean }[] }[] = [];
    for (const acc of creditAccounts) {
      const { periodStart, periodEnd } = computeBillingPeriod(monthStr, acc.cut_date ?? null);
      const purchases = txRepo.sumPurchasesByPeriod(acc.id, periodStart, periodEnd);
      const msi       = msiRepo.sumByAccountAndMonth(acc.id, monthStr);
      let untracked: number | undefined;
      if (isCurrent && year === currentYear) {
        const effectiveMonth = computeEffectiveMonth(acc.cut_date);
        const pendingMsi = msiRepo.sumPendingFromMonth(acc.id, effectiveMonth);
        const allTx = txRepo.findByAccount(acc.id);
        untracked = computeUntrackedDebt(acc, allTx, pendingMsi);
      }
      const flowAdj = (isCurrent && year === currentYear) ? (acc.flow_adjustment ?? null) : null;
      // Recurring charges for this credit account (use billing period)
      const chargesForAcc = allCharges.filter((c) => c.account_id === acc.id);
      const chargeEntriesMap = new Map<string, RecurringChargeEntry[]>();
      for (const ch of chargesForAcc) {
        const entries = chargeRepo.findEntriesByChargeAndMonth(ch.id, monthStr);
        chargeEntriesMap.set(ch.id, entries);
      }
      let recurringChargesAmt = 0;
      const recurringChargesDetail: { chargeId: string; name: string; amount: number; confirmed: boolean }[] = [];
      for (const ch of chargesForAcc) {
        const entries = chargeEntriesMap.get(ch.id) ?? [];
        const inPeriod = isChargeInBillingPeriod(ch, periodStart, periodEnd);
        if (!inPeriod && entries.length === 0) continue;
        const result = computeBlendedCharge(ch, entries, monthStr);
        let amt = 0;
        if (isFuture) {
          // No transactions yet — use full blended projection
          amt = result.blendedTotal;
        } else {
          // Current/past: confirmed entries auto-create a purchase transaction,
          // so only count the remaining (unconfirmed) projected portion here.
          // Entries without transaction_id are old-style confirmations (backward compat).
          const confirmedWithoutTx = roundCents(
            entries.filter((e) => !e.transaction_id).reduce((s, e) => s + e.amount, 0)
          );
          amt = result.remainingProjected + confirmedWithoutTx;
        }
        if (amt > 0) {
          recurringChargesAmt += amt;
          recurringChargesDetail.push({ chargeId: ch.id, name: ch.name, amount: amt, confirmed: result.confirmedTotal > 0 });
        }
      }
      tarjetas += purchases + msi + recurringChargesAmt + (untracked ?? 0) + (flowAdj ?? 0);
      tarjetasBreakdown.push({ id: acc.id, name: acc.name, bank: acc.bank ?? "", purchases, msi, untracked, flow_adjustment: flowAdj, recurringCharges: recurringChargesAmt, recurringChargesDetail });
    }

    // Planned transfers (debit accounts)
    const ptEntriesMap = new Map<string, PlannedTransferEntry[]>();
    for (const pt of allTransfers) {
      const entries = ptRepo.findEntriesByTransferAndMonth(pt.id, monthStr);
      ptEntriesMap.set(pt.id, entries);
    }
    const ptMode = (isCurrent && year === currentYear) ? "remaining-only" : isFuture ? "blended" : "confirmed-only";
    const ptResult = computeMonthlyPlannedTransfers(allTransfers, ptEntriesMap, ptMode);
    abonos += ptResult.abonos;
    transferencias += ptResult.transferencias;

    // Per-transfer detail for breakdown dialog
    const plannedTransfersInDetail: { transferId: string; name: string; amount: number; confirmed: boolean }[] = [];
    const plannedTransfersOutDetail: { transferId: string; name: string; amount: number; confirmed: boolean }[] = [];
    for (const pt of allTransfers) {
      if (!pt.is_active) continue;
      const entries = ptEntriesMap.get(pt.id) ?? [];
      const result = computeBlendedTransfer(pt, entries);
      let amount = 0;
      switch (ptMode) {
        case "remaining-only": amount = result.remainingProjected; break;
        case "blended":        amount = result.blendedTotal; break;
        case "confirmed-only": amount = result.confirmedTotal; break;
      }
      if (amount <= 0) continue;
      const confirmed = result.confirmedTotal > 0;
      if (pt.direction === "in") {
        plannedTransfersInDetail.push({ transferId: pt.id, name: pt.name, amount, confirmed });
      } else {
        plannedTransfersOutDetail.push({ transferId: pt.id, name: pt.name, amount, confirmed });
      }
    }

    const TODAY_STR = format(new Date(), "yyyy-MM-dd");
    const nominaSlots = incomeSources.map((src) => {
      const entries = entriesBySource.get(src.id) ?? [];
      const { blendedTotal } = computeBlendedIncome(src, entries);
      const slots = computeExpectedPaymentDates(src, monthStr, TODAY_STR, entries);
      return {
        sourceId: src.id,
        sourceName: src.name,
        frequency: src.frequency,
        blendedTotal,
        slots: slots.map((s) => ({
          date: s.date,
          isPast: s.isPast,
          confirmed: s.entry !== null,
          amount: s.entry?.amount ?? src.base_amount,
        })),
      };
    });

    const loans = loanAccounts.map((acc) => ({
      account_id: acc.id, name: acc.name,
      amount: txRepo.sumByAccountAndMonth(acc.id, monthStr),
    }));
    const loansTotal = loans.reduce((s, l) => s + l.amount, 0);

    const allAdj = adjRepo.findByMonth(monthStr);
    const otrosGastos   = allAdj.filter((a) => a.type === "expense");
    const otrosIngresos = allAdj.filter((a) => a.type === "income");
    const otrosGastosTotal   = otrosGastos.reduce((s, a) => s + a.amount, 0);
    const otrosIngresosTotal = otrosIngresos.reduce((s, a) => s + a.amount, 0);

    let ingresos_totales: number;
    let gastos_totales: number;

    if (isCurrent && year === currentYear) {
      // Only pending obligations: nomina remaining + no abonos/transfers (Fase 14)
      ingresos_totales = nomina + otrosIngresosTotal;
      gastos_totales   = tarjetas + loansTotal + otrosGastosTotal;
    } else {
      ingresos_totales = nomina + abonos + otrosIngresosTotal;
      gastos_totales   = transferencias + tarjetas + loansTotal + otrosGastosTotal;
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
      tarjetasBreakdown, abonosDetail, transferenciasDetail, nominaSlots,
      plannedTransfersInDetail, plannedTransfersOutDetail,
      otrosGastos:   otrosGastos.map((a) => ({ id: a.id, description: a.description, amount: a.amount })),
      otrosIngresos: otrosIngresos.map((a) => ({ id: a.id, description: a.description, amount: a.amount })),
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
        onboardingMonth={onboardingMonth}
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
