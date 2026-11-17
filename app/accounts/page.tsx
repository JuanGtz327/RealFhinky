import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { getCreditUtilizationAlert } from "@/lib/utils/alerts";
import { formatMXN } from "@/lib/utils/formatters";
import { computeAccountKpis, computeCreditUtilization } from "@/lib/domain";
import Link from "next/link";
import { CreditCard, Landmark, TrendingUp, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { KPICard } from "@/components/ui/kpi-card";
import { FadeIn, StaggerGrid } from "@/components/ui/animated";
import EmptyState from "@/components/kokonutui/empty-state";
import { NewAccountModal } from "@/components/accounts/NewAccountModal";
import type { AlertLevel } from "@/lib/utils/alerts";

function AccountCard({
  id, name, bank, last4, balance, limit, type, yieldRate,
}: {
  id: string; name: string; bank: string; last4?: string;
  balance: number; limit?: number; type: string; yieldRate?: number;
}) {
  const utilization = limit && limit > 0 ? computeCreditUtilization(balance, limit) : null;
  const alertLevel: AlertLevel = utilization !== null ? getCreditUtilizationAlert(utilization) : "ok";

  return (
    <Link
      href={`/accounts/${id}`}
      className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] card-elevated card-sweep px-5 py-4"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-navbar)]/8 group-hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
          {type === "credit" || type === "loan"
            ? <CreditCard className="w-5 h-5 text-[var(--color-navbar)] group-hover:text-white transition-colors" />
            : type === "investment"
            ? <TrendingUp className="w-5 h-5 text-[var(--color-success)] group-hover:text-white transition-colors" />
            : <Landmark className="w-5 h-5 text-[var(--color-navbar)] group-hover:text-white transition-colors" />}
        </div>
        <div>
          <p className="font-medium text-[var(--color-foreground)] group-hover:text-white transition-colors">{name}</p>
          <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">
            {bank}{last4 ? ` ···${last4}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-mono font-medium text-[var(--color-foreground)] group-hover:text-white transition-colors">
            {formatMXN(balance)}
          </p>
          {limit && limit > 0 && (
            <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">
              de {formatMXN(limit)}
            </p>
          )}
          {yieldRate && yieldRate > 0 && (
            <p className="text-xs text-[var(--color-accent)] group-hover:text-white transition-colors">{yieldRate}% RAT</p>
          )}
        </div>

        {utilization !== null && (
          <StatusBadge level={alertLevel} className="group-hover:bg-white/60 group-hover:border-white/30 transition-colors">
            {utilization.toFixed(0)}%
          </StatusBadge>
        )}

        <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors" />
      </div>
    </Link>
  );
}

export default function AccountsPage() {
  const repo = new AccountsRepository(getDb());
  const all  = repo.findAll();

  const credit     = all.filter((a) => a.type === "credit");
  const loans      = all.filter((a) => a.type === "loan");
  const debit      = all.filter((a) => a.type === "debit");
  const investment = all.filter((a) => a.type === "investment");

  const { totalCapital, totalDeuda, totalDisponible } = computeAccountKpis(all);

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Cuentas</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">{all.length} cuentas activas</p>
        </div>
        <NewAccountModal />
      </FadeIn>

      {/* KPIs */}
      <StaggerGrid className="grid grid-cols-3 gap-4" staggerDelay={0.06}>
        {[
          <KPICard key="1" label="Capital total"      value={formatMXN(totalCapital)}    variant="capital" />,
          <KPICard key="2" label="Deuda total"        value={formatMXN(totalDeuda)}      variant="debt"    sub="Crédito + préstamos" />,
          <KPICard key="3" label="Crédito disponible" value={formatMXN(totalDisponible)} variant="income"  sub="Línea libre" />,
        ]}
      </StaggerGrid>

      {/* Empty state si no hay cuentas */}
      {all.length === 0 && (
        <EmptyState
          icon={<CreditCard className="w-6 h-6" />}
          title="Sin cuentas registradas"
          description="Agrega tu primera tarjeta de crédito, cuenta de débito o préstamo para empezar a trackear tus finanzas."
          action={<NewAccountModal />}
        />
      )}

      {/* Crédito */}
      {credit.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--color-navbar)]" /> Tarjetas de crédito
          </h2>
          <div className="space-y-2">
            {credit.map((a) => (
              <AccountCard key={a.id} id={a.id} name={a.name} bank={a.bank} last4={a.last4}
                balance={a.current_balance} limit={a.credit_limit} type={a.type} />
            ))}
          </div>
        </section>
      )}

      {/* Préstamos */}
      {loans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[var(--color-navbar)]" /> Préstamos
          </h2>
          <div className="space-y-2">
            {loans.map((a) => (
              <AccountCard key={a.id} id={a.id} name={a.name} bank={a.bank}
                balance={a.current_balance} limit={a.credit_limit} type={a.type} />
            ))}
          </div>
        </section>
      )}

      {/* Débito / Nómina */}
      {debit.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[var(--color-navbar)]" /> Débito / Nómina
          </h2>
          <div className="space-y-2">
            {debit.map((a) => (
              <AccountCard key={a.id} id={a.id} name={a.name} bank={a.bank} last4={a.last4}
                balance={a.current_balance} type={a.type} yieldRate={a.yield_rate ?? undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Inversiones */}
      {investment.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-navbar)] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-navbar)]" /> Inversiones
          </h2>
          <div className="space-y-2">
            {investment.map((a) => (
              <AccountCard key={a.id} id={a.id} name={a.name} bank={a.bank}
                balance={a.current_balance} type={a.type} yieldRate={a.yield_rate ?? undefined} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
