import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { getCreditUtilizationAlert } from "@/lib/utils/alerts";
import { formatMXN } from "@/lib/utils/formatters";
import { DebtTable } from "@/components/dashboard/DebtTable";
import { LoanDebtTable } from "@/components/dashboard/LoanDebtTable";
import { KPICard } from "@/components/ui/kpi-card";
import { FadeIn, StaggerGrid } from "@/components/ui/animated";
import { ArrowLeft, TrendingDown, CreditCard, Landmark } from "lucide-react";
import Link from "next/link";

export default function DebtPage() {
  const db      = getDb();
  const accRepo = new AccountsRepository(db);

  const creditAccounts = accRepo.findByType("credit");
  const loanAccounts   = accRepo.findByType("loan");

  const creditSummary = creditAccounts.map((acc) => {
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

  const totalCreditBalance = creditSummary.reduce((s, a) => s + a.current_balance, 0);
  const totalLoanBalance   = loanAccounts.reduce((s, a) => s + a.current_balance, 0);
  const totalBalance = totalCreditBalance + totalLoanBalance;
  const totalLimit   = creditSummary.reduce((s, a) => s + a.credit_limit, 0);
  const totalFree    = creditSummary.reduce((s, a) => s + a.available, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <div>
          <Link href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--color-foreground)]">
            <TrendingDown className="w-6 h-6 text-[var(--color-danger)]" /> Deuda
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Tarjetas de crédito y préstamos activos
          </p>
        </div>
      </FadeIn>

      {/* KPIs */}
      <StaggerGrid className="grid grid-cols-3 gap-4" staggerDelay={0.06}>
        <KPICard label="Deuda total"       value={formatMXN(totalBalance)} variant="debt" />
        <KPICard label="Línea total"        value={formatMXN(totalLimit)}   variant="capital" />
        <KPICard label="Crédito disponible" value={formatMXN(totalFree)}    variant="income" />
      </StaggerGrid>

      {/* Crédito */}
      {creditAccounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-navbar)]">
            <CreditCard className="w-4 h-4 text-[var(--color-navbar)]" /> Tarjetas de crédito
          </h2>
          <DebtTable accounts={creditSummary} />
        </section>
      )}

      {/* Préstamos */}
      {loanAccounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-navbar)]">
            <Landmark className="w-4 h-4 text-[var(--color-navbar)]" /> Préstamos
          </h2>
          <LoanDebtTable loans={loanAccounts} />
        </section>
      )}
    </div>
  );
}
