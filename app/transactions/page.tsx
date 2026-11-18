import { getDb } from "@/lib/db";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { formatMXN } from "@/lib/utils/formatters";
import { KPICard } from "@/components/ui/kpi-card";
import { StaggerGrid } from "@/components/ui/animated";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { NewTransactionModal } from "@/components/transactions/NewTransactionModal";
import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";

export default function TransactionsPage() {
  const db      = getDb();
  const txRepo  = new TransactionsRepository(db);
  const accRepo = new AccountsRepository(db);

  const transactions = txRepo.findAll(500);
  const accounts     = accRepo.findAll();

  const totalSpend    = transactions.filter((t) => t.type === "purchase" || t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
  const totalIncome   = transactions.filter((t) => t.type === "income"   || t.type === "transfer_in").reduce((s, t) => s + t.amount, 0);
  const totalMsi      = transactions.filter((t) => t.is_msi).length;
  const msiPending    = transactions.filter((t) => t.is_msi).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Movimientos"
        title="Transacciones"
        subtitle={`${transactions.length} registros · todas las cuentas`}
        action={<NewTransactionModal accounts={accounts} />}
      />

      {/* KPIs */}
      <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4" staggerDelay={0.06}>
        {[
          <KPICard key="1" label="Gasto total"      value={formatMXN(totalSpend)}   variant="expense" />,
          <KPICard key="2" label="Ingreso total"    value={formatMXN(totalIncome)}  variant="income"  />,
          <KPICard key="3" label="Compras a MSI"    value={`${totalMsi}`}           variant="neutral" sub="transacciones" />,
          <KPICard key="4" label="Comprometido MSI" value={formatMXN(msiPending)}   variant="debt"    sub="valor original" />,
        ]}
      </StaggerGrid>

      {/* Tabla con filtros */}
      <Suspense fallback={<p className="text-[var(--color-muted)]">Cargando…</p>}>
        <TransactionTable transactions={transactions} accounts={accounts} />
      </Suspense>
    </div>
  );
}
