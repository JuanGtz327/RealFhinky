import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getCreditUtilizationAlert, getCutDateAlert, getPaymentDateAlert, getAnnualFeeAlert } from "@/lib/utils/alerts";
import { getMsiProgress } from "@/lib/utils/msi";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountMonthlyTable } from "@/components/accounts/AccountMonthlyTable";
import { MsiActiveList } from "@/components/accounts/MsiActiveList";
import { AccountTransactions } from "@/components/accounts/AccountTransactions";
import { AccountMetaCredit } from "@/components/accounts/AccountMetaCredit";
import { AccountMetaDebit } from "@/components/accounts/AccountMetaDebit";

import Link from "next/link";
import { Pencil } from "lucide-react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");
const CURRENT_YEAR  = new Date().getFullYear().toString();
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  const db      = getDb();
  const accRepo = new AccountsRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const msiRepo = new MsiRepository(db);

  const account = accRepo.findById(params.id);
  if (!account) notFound();

  const isCredit = account.type === "credit" || account.type === "loan";
  const isDebit  = account.type === "debit"  || account.type === "investment";

  // ── Tabla mes a mes (año actual) ──────────────────────────
  const monthlyRows = MONTHS.map((m) => {
    const month = `${CURRENT_YEAR}-${m}`;
    const isFuture  = month > CURRENT_MONTH;
    const isCurrent = month === CURRENT_MONTH;

    const real = txRepo.sumByAccountAndMonth(account.id, month);
    const msi  = msiRepo.sumByAccountAndMonth(account.id, month);
    const total = isCredit ? (isFuture ? msi : real + msi) : real;

    return { month, real, msi, total, isFuture, isCurrent };
  });

  // ── MSI activos (transacciones MSI con cuotas futuras) ───
  const allTx = txRepo.findByAccount(account.id, 500);
  const msiTxs = allTx.filter((t) => t.is_msi && t.msi_months && t.msi_start_date);
  const activeMsi = msiTxs
    .map((tx) => {
      const installments = msiRepo.findByTransaction(tx.id);
      const remaining    = installments.filter((i) => i.month >= CURRENT_MONTH);
      if (remaining.length === 0) return null;
      const progress = getMsiProgress(tx.msi_start_date!.substring(0, 7), tx.msi_months!, CURRENT_MONTH);
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
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // ── Últimas transacciones ────────────────────────────────
  const recentTx = txRepo.findByAccount(account.id, 20);

  // ── KPIs según tipo ──────────────────────────────────────
  const utilization  = account.credit_limit && account.credit_limit > 0
    ? (account.current_balance / account.credit_limit) * 100 : null;
  const alertLevel   = utilization !== null ? getCreditUtilizationAlert(utilization) : "ok";
  const cutAlert     = account.cut_date         ? getCutDateAlert(account.cut_date)              : null;
  const payAlert     = account.payment_due_date ? getPaymentDateAlert(account.payment_due_date)  : null;
  const feeAlert     = account.annual_fee_date  ? getAnnualFeeAlert(account.annual_fee_date)     : null;

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
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border)] card-lift
                     text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]
                     hover:border-[var(--color-accent)]/50">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </Link>
      </div>

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
        />
      )}
      {isDebit && (
        <AccountMetaDebit
          balance={account.current_balance}
          yieldRate={account.yield_rate ?? 0}
        />
      )}

      {/* Tabla mes a mes */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-navbar)]">Movimientos por mes — {CURRENT_YEAR}</h2>
        <AccountMonthlyTable rows={monthlyRows} isCredit={isCredit} />
      </section>

      {/* MSI activos (solo crédito) */}
      {isCredit && activeMsi.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)]">
            Meses sin interés activos
            <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">({activeMsi.length})</span>
          </h2>
          <MsiActiveList items={activeMsi} />
        </section>
      )}

      {/* Transacciones recientes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-navbar)]">Transacciones recientes</h2>
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
