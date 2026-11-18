import { getDb } from "@/lib/db";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { computeChargeOverdueAlerts } from "@/lib/domain";
import { ChargeOverdueBanner } from "@/components/subscriptions/ChargeOverdueBanner";
import { RecurringChargeCard } from "@/components/subscriptions/RecurringChargeCard";
import { NewChargeButton } from "@/components/subscriptions/NewChargeButton";
import { StatusBadge } from "@/components/ui/status-badge";
import EmptyState from "@/components/kokonutui/empty-state";
import { Repeat } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionsPage() {
  const db = getDb();
  const chargeRepo = new RecurringChargesRepository(db);
  const accRepo = new AccountsRepository(db);

  const today = format(new Date(), "yyyy-MM-dd"); // local timezone, not UTC
  const currentMonth = today.slice(0, 7);

  const allAccounts = accRepo.findAll();
  const allCharges = chargeRepo.findAll(false);
  const entriesMap = chargeRepo.findEntriesByMonthGrouped(currentMonth);

  const accountMap = new Map(allAccounts.map((a) => [a.id, `${a.name} · ${a.bank}`]));

  const activeCharges = allCharges.filter((c) => c.is_active);
  const inactiveCharges = allCharges.filter((c) => !c.is_active);

  const overdueAlerts = computeChargeOverdueAlerts(activeCharges, entriesMap, currentMonth, today);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Repeat className="w-6 h-6 text-[var(--color-accent)]" />
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Suscripciones</h1>
        </div>
        <NewChargeButton accounts={allAccounts} />
      </div>

      {/* Overdue banner */}
      <ChargeOverdueBanner overdueCount={overdueAlerts.length} />

      {/* Active charges */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--color-navbar)]">Activos</h2>
          <StatusBadge variant="accent">{activeCharges.length}</StatusBadge>
        </div>

        {activeCharges.length === 0 ? (
          <EmptyState
            title="Sin cargos recurrentes"
            description="Agrega suscripciones y servicios para rastrearlos automáticamente."
            icon={<Repeat className="w-8 h-8 text-[var(--color-accent)]" />}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCharges.map((charge) => (
              <RecurringChargeCard
                key={charge.id}
                charge={charge}
                currentMonth={currentMonth}
                entries={entriesMap.get(charge.id) ?? []}
                accountName={accountMap.get(charge.account_id) ?? "Cuenta desconocida"}
                accounts={allAccounts}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inactive charges */}
      {inactiveCharges.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--color-navbar)]">Inactivos</h2>
            <StatusBadge variant="muted">{inactiveCharges.length}</StatusBadge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactiveCharges.map((charge) => (
              <RecurringChargeCard
                key={charge.id}
                charge={charge}
                currentMonth={currentMonth}
                entries={entriesMap.get(charge.id) ?? []}
                accountName={accountMap.get(charge.account_id) ?? "Cuenta desconocida"}
                accounts={allAccounts}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
