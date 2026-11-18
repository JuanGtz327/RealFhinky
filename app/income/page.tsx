import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { computeIncomeConfirmationStatus, computeIncomeOverdueAlerts } from "@/lib/domain/income";
import { formatMonthLabel } from "@/lib/utils/formatters";
import { format } from "date-fns";
import { IncomeOverdueBanner } from "@/components/forecast/IncomeOverdueBanner";
import { IncomeSourceCard } from "@/components/forecast/IncomeSourceCard";
import { NewIncomeSourceModal } from "@/components/forecast/NewIncomeSourceModal";
import EmptyState from "@/components/kokonutui/empty-state";
import { DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");
const TODAY         = format(new Date(), "yyyy-MM-dd");

export default function IncomePage() {
  const db       = getDb();
  const incRepo  = new IncomeRepository(db);
  const accRepo  = new AccountsRepository(db);

  const sources        = incRepo.findAllSources();
  const entriesGrouped = incRepo.findEntriesByMonthGrouped(CURRENT_MONTH);
  const debitAccounts  = accRepo.findByType("debit").map((a) => ({ id: a.id, name: a.name, bank: a.bank }));
  const overdueAlerts  = computeIncomeOverdueAlerts(sources, entriesGrouped, CURRENT_MONTH, format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ingresos"
        title="Ingresos"
        subtitle={`Fuentes de ingreso y confirmación de pagos — ${formatMonthLabel(CURRENT_MONTH)}`}
        action={<NewIncomeSourceModal debitAccounts={debitAccounts} />}
      />

      {overdueAlerts.length > 0 && (
        <IncomeOverdueBanner alerts={overdueAlerts} hideLink />
      )}

      <section className="space-y-4">
        <SectionTitle>
          Fuentes de ingreso
          <span className="text-sm font-normal text-[var(--color-muted)]">({sources.length})</span>
        </SectionTitle>

        {sources.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="Sin fuentes de ingreso configuradas"
            description="Agrega tu nómina para ver pronósticos precisos y recibir alertas de confirmación"
          />
        ) : (
          <div className="space-y-3">
            {sources.map((src) => {
              const entries = entriesGrouped.get(src.id) ?? [];
              const status  = computeIncomeConfirmationStatus(src, entries);
              return (
                <IncomeSourceCard
                  key={src.id}
                  source={src}
                  entries={entries}
                  status={status}
                  monthStr={CURRENT_MONTH}
                  today={TODAY}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
