import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";
import { PlannedTransfersRepository } from "@/lib/repositories/planned-transfers.repo";
import { notFound } from "next/navigation";
import { format, addMonths, subMonths } from "date-fns";
import { computeBillingPeriod } from "@/lib/utils/billing";
import { getCreditUtilizationAlert, getCutDateAlert, getPaymentDateAlert, getAnnualFeeAlert } from "@/lib/utils/alerts";
import { computeEffectiveMonth, computeBalanceDiscrepancy, computeCreditUtilization, computePaymentStatus, isChargeInBillingPeriod, computeBlendedCharge } from "@/lib/domain";
import { computeLoanKpis, computeAmortizationSchedule } from "@/lib/domain/loans";
import { getMsiProgress } from "@/lib/utils/msi";
import { formatMXN } from "@/lib/utils/formatters";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountMonthlyTable } from "@/components/accounts/AccountMonthlyTable";
import { MsiActiveList } from "@/components/accounts/MsiActiveList";
import { NextCyclePreview } from "@/components/accounts/NextCyclePreview";
import { AccountTransactions } from "@/components/accounts/AccountTransactions";
import { AccountMetaCredit } from "@/components/accounts/AccountMetaCredit";
import { AccountMetaDebit } from "@/components/accounts/AccountMetaDebit";
import { AccountMetaLoan } from "@/components/accounts/AccountMetaLoan";
import { LoanAmortizationSection } from "@/components/accounts/LoanAmortizationSection";
import { OpeningBalanceWizard } from "@/components/accounts/OpeningBalanceWizard";
import { PlannedTransferCard } from "@/components/accounts/PlannedTransferCard";
import { NewPlannedTransferButton } from "@/components/accounts/NewPlannedTransferButton";

import Link from "next/link";
import { Pencil, ChevronLeft, ChevronRight, CreditCard, CalendarRange, BarChart2, ArrowUpDown, AlertTriangle } from "lucide-react";

const REAL_YEAR   = new Date().getFullYear();
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];


export default function AccountDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { year?: string };
}) {
  const db       = getDb();
  const accRepo  = new AccountsRepository(db);
  const txRepo   = new TransactionsRepository(db);
  const msiRepo  = new MsiRepository(db);
  const cpRepo   = new CyclePaymentsRepository(db);
  const chargeRepo = new RecurringChargesRepository(db);
  const ptRepo = new PlannedTransfersRepository(db);

  const account = accRepo.findById(params.id);
  if (!account) notFound();

  const isCredit = account.type === "credit";
  const isLoan   = account.type === "loan";
  const isDebit  = account.type === "debit"  || account.type === "investment";

  const selectedYear = parseInt(searchParams.year ?? REAL_YEAR.toString(), 10);

  // If today is past the cut date, that billing cycle has already closed.
  // Use the NEXT month as the effective reference so paid/remaining counts correctly.
  const effectiveMonth = computeEffectiveMonth(account.cut_date);

  // ── Cargos recurrentes (solo crédito) ───────────────────
  const accountCharges = isCredit ? chargeRepo.findByAccount(params.id, true) : [];

  // ── Transferencias planificadas (solo débito) ────────────
  const currentMonth = new Date().toISOString().slice(0, 7);
  const accountTransfers = isDebit ? ptRepo.findByAccount(params.id, true) : [];
  const ptEntriesMap = isDebit
    ? ptRepo.findEntriesByMonthGrouped(currentMonth)
    : new Map();

  // ── Pagos confirmados por ciclo ──────────────────────────
  const cyclePayments = (isCredit || isLoan) ? cpRepo.findByAccount(params.id) : [];
  const paymentByMonth = new Map(cyclePayments.map((p) => [p.cycle_month, p]));

  // ── Préstamo: KPIs y tabla de amortización ───────────────
  const loanKpis = isLoan ? computeLoanKpis(account, cyclePayments) : null;
  const amortizationRows = isLoan
    ? computeAmortizationSchedule(account, cyclePayments, currentMonth)
    : [];

  // ── Tabla mes a mes ───────────────────────────────────────
  const monthlyRows = MONTHS.map((m) => {
    const month = `${selectedYear}-${m}`;
    const isFuture  = month > effectiveMonth;
    const isCurrent = month === effectiveMonth;

    let real: number;
    let abonos = 0;
    if (isCredit) {
      const { periodStart, periodEnd } = computeBillingPeriod(month, account.cut_date ?? null);
      abonos = txRepo.sumCreditsByPeriod(account.id, periodStart, periodEnd);
      real = txRepo.sumPurchasesByPeriod(account.id, periodStart, periodEnd) - abonos;
    } else {
      real = txRepo.sumByAccountAndMonth(account.id, month);
    }
    const msi  = msiRepo.sumByAccountAndMonth(account.id, month);

    let recurringCharges = 0;
    if (isCredit && accountCharges.length > 0) {
      const { periodStart, periodEnd } = computeBillingPeriod(month, account.cut_date ?? null);
      for (const charge of accountCharges) {
        if (!isChargeInBillingPeriod(charge, periodStart, periodEnd)) continue;
        const entries = chargeRepo.findEntriesByChargeAndMonth(charge.id, month);
        const result = computeBlendedCharge(charge, entries, month);
        if (isFuture) {
          recurringCharges += result.blendedTotal;
        } else {
          // Confirmed entries with transaction_id → already in purchases (real column)
          const confirmedWithoutTx = entries
            .filter((e) => !e.transaction_id)
            .reduce((s, e) => s + e.amount, 0);
          recurringCharges += result.remainingProjected + confirmedWithoutTx;
        }
      }
    }

    const total = isCredit ? (real + msi + recurringCharges) : real;

    const payment = paymentByMonth.get(month) ?? null;
    const paymentStatus = isCredit ? computePaymentStatus(payment, total).status : undefined;
    return { month, real, msi, recurringCharges, abonos, total, isFuture, isCurrent, paymentStatus };
  });

  // ── MSI activos (transacciones MSI con cuotas futuras) ───
  const allTx = txRepo.findByAccount(account.id, 500);
  const msiTxs = allTx.filter((t) => t.is_msi && t.msi_months && t.msi_start_date);
  const activeMsi = msiTxs
    .map((tx) => {
      const installments = msiRepo.findByTransaction(tx.id);
      // Use effectiveMonth so already-billed installments show as paid
      const remaining    = installments.filter((i) => i.month >= effectiveMonth);
      if (remaining.length === 0) return null;
      const progress = getMsiProgress(tx.msi_start_date!.substring(0, 7), tx.msi_months!, effectiveMonth);
      return {
        id:            tx.id,
        merchant:      tx.merchant ?? "Sin nombre",
        total:         tx.amount,
        monthly:       tx.msi_monthly_amount ?? 0,
        months:        tx.msi_months!,
        paid:          progress.paid,
        remaining:     progress.remaining,
        nextAmount:    remaining[0]?.amount ?? 0,
        pendingTotal:  remaining.reduce((s, i) => s + i.amount, 0),
        startDate:     tx.msi_start_date!,
        date:          tx.date,
        allInstallments: installments.map((inst, idx) => ({
          month:  inst.month,
          amount: inst.amount,
          num:    idx + 1,
          paid:   inst.month < effectiveMonth,
        })),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // ── Ciclos de corte: ±6 meses desde effectiveMonth ──────────
  const allInstallments = msiRepo.findByAccount(account.id);
  const txMerchantById = new Map(allTx.map((tx) => [tx.id, tx.merchant ?? tx.description ?? "Sin nombre"]));

  // Agrupar por transacción para calcular número de cuota
  const instsByTxId: Record<string, typeof allInstallments> = {};
  for (const inst of allInstallments) {
    (instsByTxId[inst.transaction_id] ??= []).push(inst);
  }
  for (const arr of Object.values(instsByTxId)) arr.sort((a, b) => a.month.localeCompare(b.month));

  // Índice de cuotas MSI por mes de facturación
  const msiByMonth: Record<string, { merchant: string; amount: number; installmentNum: number; totalMonths: number }[]> = {};
  for (const inst of allInstallments) {
    const arr = instsByTxId[inst.transaction_id] ?? [];
    const num = arr.findIndex((i) => i.id === inst.id) + 1;
    (msiByMonth[inst.month] ??= []).push({
      merchant: txMerchantById.get(inst.transaction_id) ?? "Sin nombre",
      amount: inst.amount,
      installmentNum: num,
      totalMonths: arr.length,
    });
  }

  const effDate = new Date(effectiveMonth + "-01T12:00:00");
  const billingCycles = Array.from({ length: 13 }, (_, i) => {
    const cycleMonth = format(addMonths(effDate, i - 6), "yyyy-MM");
    const { periodStart, periodEnd } = computeBillingPeriod(cycleMonth, account.cut_date ?? null);

    // Inyectar anualidad si su fecha cae dentro del periodo (y no está ya registrada como tx)
    const annualFeeInPeriod =
      account.annual_fee && account.annual_fee_date &&
      account.annual_fee_date >= periodStart && account.annual_fee_date <= periodEnd;
    const annualFeeAlreadyRecorded = annualFeeInPeriod && allTx.some(
      (tx) => tx.type === "purchase" && tx.category === "Anualidad" &&
               tx.date >= periodStart && tx.date <= periodEnd
    );

    // Recurring charges in this billing period
    const recurringItems = accountCharges
      .filter((ch) => isChargeInBillingPeriod(ch, periodStart, periodEnd))
      .map((ch) => {
        const entries = chargeRepo.findEntriesByChargeAndMonth(ch.id, cycleMonth);
        const result = computeBlendedCharge(ch, entries, cycleMonth);
        return {
          chargeId: ch.id,
          name: ch.name,
          amount: result.blendedTotal > 0 ? result.blendedTotal : ch.base_amount,
          category: ch.category ?? undefined,
          isConfirmed: result.confirmedCount > 0,
        };
      });

    return {
      cycleMonth,
      msiItems: msiByMonth[cycleMonth] ?? [],
      directItems: [
        ...allTx
          .filter((tx) => tx.type === "purchase" && !tx.is_msi && tx.date >= periodStart && tx.date <= periodEnd)
          .map((tx) => ({ merchant: tx.merchant ?? tx.description ?? "Sin nombre", amount: tx.amount, date: tx.date, category: tx.category ?? undefined })),
        ...(annualFeeInPeriod && !annualFeeAlreadyRecorded
          ? [{ merchant: "Anualidad", amount: account.annual_fee!, date: account.annual_fee_date!, category: "Anualidad", isProjected: true }]
          : []),
      ],
      creditItems: allTx
        .filter((tx) => tx.type === "transfer_in" && tx.date >= periodStart && tx.date <= periodEnd)
        .map((tx) => ({ merchant: tx.merchant ?? tx.description ?? "Abono / Devolución", amount: tx.amount, date: tx.date })),
      recurringItems,
      isCurrent: cycleMonth === effectiveMonth,
      payment: paymentByMonth.get(cycleMonth) ?? null,
    };
  });

  const totalPendingMsi = activeMsi.reduce((s, item) => s + item.pendingTotal, 0);

  // ── Últimas transacciones ────────────────────────────────
  const recentTx = txRepo.findByAccount(account.id, 20);

  // ── Discrepancia saldo real vs Finkhy (solo crédito) ────
  const discrepancy = isCredit
    ? computeBalanceDiscrepancy(account, totalPendingMsi, allTx)
    : null;
  const balanceDiff = discrepancy?.diff ?? null;

  // ── KPIs según tipo ──────────────────────────────────────
  const utilization  = account.credit_limit && account.credit_limit > 0
    ? computeCreditUtilization(account.current_balance, account.credit_limit)
    : null;
  const alertLevel   = utilization !== null ? getCreditUtilizationAlert(utilization) : "ok";
  const cutAlert     = account.cut_date         ? getCutDateAlert(account.cut_date)              : null;
  const payAlert     = account.payment_due_date ? getPaymentDateAlert(account.payment_due_date)  : null;
  const feeAlert     = account.annual_fee_date  ? getAnnualFeeAlert(account.annual_fee_date)     : null;

  // payment_status para AccountMetaCredit = ÚLTIMO CICLO CERRADO (effectiveMonth - 1)
  // El effectiveMonth es el ciclo abierto; solo los ciclos pasados pueden confirmarse
  const lastClosedCycleMonth = format(
    subMonths(new Date(effectiveMonth + "-01T12:00:00"), 1),
    "yyyy-MM"
  );
  const lastClosedPayment = paymentByMonth.get(lastClosedCycleMonth) ?? null;
  const lastClosedRow = monthlyRows.find((r) => r.month === lastClosedCycleMonth);
  const lastClosedAmountDue = lastClosedRow ? lastClosedRow.total : 0;
  const effectiveMonthPaymentStatus = isCredit
    ? computePaymentStatus(lastClosedPayment, lastClosedAmountDue).status
    : undefined;

  // Conteo de ciclos pasados sin confirmar (para banner de alerta)
  const unpaidPastCount = isCredit
    ? monthlyRows.filter((r) => !r.isFuture && !r.isCurrent && r.paymentStatus === "pending").length
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{account.name}</h1>
            <StatusBadge variant="muted">{account.bank}</StatusBadge>
            {account.last4 && (
              <span className="text-sm text-[var(--color-muted)] font-mono">···{account.last4}</span>
            )}
          </div>
          <p className="text-sm text-[var(--color-muted)] mt-0.5 capitalize">{account.type}</p>
        </div>
        <Link href={`/accounts/${account.id}/edit`}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-95 transition-all">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </Link>
      </div>

      {/* Banner: pagos pendientes de confirmar */}
      {isCredit && unpaidPastCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3 animate-in slide-in-from-top-3 duration-500"
          style={{ background: "var(--color-navbar)", borderLeft: "4px solid var(--color-accent)" }}
        >
          {/* Badge de acción */}
          <div className="flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5" style={{ background: "rgba(232,100,60,0.20)" }}>
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
              Acción
            </span>
          </div>
          <p className="text-sm text-white/80">
            Tienes{" "}
            <span className="font-bold text-white">
              {unpaidPastCount} {unpaidPastCount === 1 ? "ciclo sin confirmar" : "ciclos sin confirmar"}
            </span>{" "}
            en el año. Navega a los meses pasados en Próximo corte para registrar los pagos.
          </p>
        </div>
      )}

      {/* Wizard saldo inicial — solo crédito con saldo y sin transacciones */}
      {isCredit && account.current_balance > 0 && recentTx.length === 0 && (
        <OpeningBalanceWizard
          accountId={account.id}
          accountName={account.name}
          currentBalance={account.current_balance}
          cutDay={account.cut_date ?? undefined}
        />
      )}

      {/* Metadatos según tipo */}
      {isCredit && (
        <AccountMetaCredit
          creditLimit={account.credit_limit ?? 0}
          currentBalance={account.current_balance}
          cutDate={account.cut_date}
          paymentDueDate={account.payment_due_date}
          annualFee={account.annual_fee}
          annualFeeDate={account.annual_fee_date ?? undefined}
          utilization={utilization}
          alertLevel={alertLevel}
          cutAlert={cutAlert}
          payAlert={payAlert}
          feeAlert={feeAlert}
          balanceDiff={balanceDiff ?? undefined}
          effectiveMonthPaymentStatus={effectiveMonthPaymentStatus}
        />
      )}
      {isLoan && loanKpis && (
        <AccountMetaLoan kpis={loanKpis} paymentDueDate={account.payment_due_date} />
      )}
      {isDebit && (
        <AccountMetaDebit
          balance={account.current_balance}
          yieldRate={account.yield_rate ?? 0}
        />
      )}

      {/* Tabla de amortización (solo préstamo) */}
      {isLoan && loanKpis && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
            Tabla de amortización
          </h2>
          <LoanAmortizationSection
            rows={amortizationRows}
            accountId={account.id}
            currentBalance={account.current_balance}
            monthlyPayment={loanKpis.monthlyPayment}
            annualRate={loanKpis.interestRate}
            paymentDueDate={account.payment_due_date}
          />
        </section>
      )}

      {/* MSI activos + Próximo corte (solo crédito) */}
      {isCredit && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--color-accent)]" />
            Compromisos de crédito
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Columna 1: MSI activos */}
            <div className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
                <h3 className="text-sm font-semibold text-[var(--color-navbar)] flex items-center gap-1.5">
                  <CalendarRange className="w-4 h-4 text-[var(--color-accent)]" />
                  Meses sin interés activos
                  <span className="text-sm font-normal text-[var(--color-muted)]">({activeMsi.length})</span>
                </h3>
              </div>
              {activeMsi.length > 0 ? (
                <div className="overflow-y-auto max-h-[480px]">
                  <MsiActiveList items={activeMsi} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-[var(--color-muted)]">Sin MSI activos</p>
                </div>
              )}
              <div className="mt-auto shrink-0 px-4 py-4 bg-[var(--color-navbar)] rounded-b-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">Total pendiente MSI</span>
                  <span className="font-mono font-semibold text-[var(--color-accent)]">
                    {formatMXN(totalPendingMsi)}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {activeMsi.length} planes activos
                </p>
              </div>
            </div>

            {/* Columna 2: Próximo corte */}
            <NextCyclePreview
              cycles={billingCycles}
              effectiveMonth={effectiveMonth}
              cutDate={account.cut_date ?? undefined}
              accountId={account.id}
            />
          </div>
        </section>
      )}

      {/* Transferencias planificadas (solo débito) */}
      {isDebit && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[var(--color-accent)]" />
            Transferencias planificadas
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Abonos planificados (direction=in) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-success)]">Abonos planificados</p>
                <NewPlannedTransferButton accountId={account.id} direction="in" label="Nuevo abono" />
              </div>
              {accountTransfers.filter((t) => t.direction === "in").length === 0 ? (
                <div className="flex items-center justify-center py-6 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
                  <p className="text-xs text-[var(--color-muted)]">Sin abonos planificados</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {accountTransfers.filter((t) => t.direction === "in").map((transfer) => (
                    <PlannedTransferCard
                      key={transfer.id}
                      transfer={transfer}
                      currentMonth={currentMonth}
                      entries={ptEntriesMap.get(transfer.id) ?? []}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Salidas planificadas (direction=out) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Salidas planificadas</p>
                <NewPlannedTransferButton accountId={account.id} direction="out" label="Nueva salida" />
              </div>
              {accountTransfers.filter((t) => t.direction === "out").length === 0 ? (
                <div className="flex items-center justify-center py-6 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
                  <p className="text-xs text-[var(--color-muted)]">Sin salidas planificadas</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {accountTransfers.filter((t) => t.direction === "out").map((transfer) => (
                    <PlannedTransferCard
                      key={transfer.id}
                      transfer={transfer}
                      currentMonth={currentMonth}
                      entries={ptEntriesMap.get(transfer.id) ?? []}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tabla mes a mes */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
            Movimientos por mes — {selectedYear}
          </h2>
          <div className="flex items-center gap-1 ml-auto">
            <Link href={`?year=${selectedYear - 1}`}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-white hover:brightness-95 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
            {selectedYear !== REAL_YEAR && (
              <Link href={`?year=${REAL_YEAR}`}
                className="px-2 py-0.5 text-xs rounded hover:bg-[var(--color-border)] text-[var(--color-accent)] transition-colors">
                hoy
              </Link>
            )}
            <Link href={`?year=${selectedYear + 1}`}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-white hover:brightness-95 transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        <AccountMonthlyTable rows={monthlyRows} isCredit={isCredit} />
      </section>

      {/* Transacciones recientes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[var(--color-accent)]" />
            Transacciones recientes
          </h2>
          <Link href={`/transactions?account_id=${account.id}`}
            className="text-sm text-[var(--color-accent)] hover:underline">
            Ver todas
          </Link>
        </div>
        <AccountTransactions transactions={recentTx} />
      </section>

    </div>
  );
}
