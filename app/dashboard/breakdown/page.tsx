import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";
import { formatMXN } from "@/lib/utils/formatters";
import { computeBillingPeriod } from "@/lib/utils/billing";
import { isChargeInBillingPeriod, computeBlendedCharge } from "@/lib/domain/recurring-charges";
import { format } from "date-fns";
import { CardBreakdownTable } from "@/components/dashboard/CardBreakdownTable";
import { YearSelector } from "@/components/ui/year-selector";
import { FadeIn } from "@/components/ui/animated";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

function BreakdownContent({ year }: { year: string }) {
  const db          = getDb();
  const accRepo     = new AccountsRepository(db);
  const txRepo      = new TransactionsRepository(db);
  const msiRepo     = new MsiRepository(db);
  const chargeRepo  = new RecurringChargesRepository(db);

  const creditAccounts = accRepo.findByType("credit");
  const years = [year, String(Number(year) - 1)];

  // Pre-load recurring charges per account
  const chargesByAccount: Record<string, ReturnType<typeof chargeRepo.findByAccount>> = {};
  for (const acc of creditAccounts) {
    chargesByAccount[acc.id] = chargeRepo.findByAccount(acc.id);
  }

  const matrixByYear: Record<string, Record<string, Record<string, number>>> = {};
  for (const y of years) {
    matrixByYear[y] = {};
    for (const m of MONTHS) {
      const monthStr = `${y}-${m}`;
      const isFuture  = monthStr > CURRENT_MONTH;
      const isCurrent = monthStr === CURRENT_MONTH;
      matrixByYear[y][monthStr] = {};
      for (const acc of creditAccounts) {
        const { periodStart, periodEnd } = computeBillingPeriod(monthStr, acc.cut_date ?? null);
        const purchases = txRepo.sumPurchasesByPeriod(acc.id, periodStart, periodEnd);
        const msi       = msiRepo.sumByAccountAndMonth(acc.id, monthStr);
        const credits   = txRepo.sumCreditsByPeriod(acc.id, periodStart, periodEnd);
        // Anualidad si cae en este periodo
        const annualFee =
          acc.annual_fee && acc.annual_fee_date &&
          acc.annual_fee_date >= periodStart && acc.annual_fee_date <= periodEnd
            ? acc.annual_fee
            : 0;
        // Recurring charges — use billing period, temporal blending
        let recurringCharges = 0;
        for (const charge of chargesByAccount[acc.id] ?? []) {
          if (!isChargeInBillingPeriod(charge, periodStart, periodEnd)) continue;
          const entries = chargeRepo.findEntriesByChargeAndMonth(charge.id, monthStr);
          const result  = computeBlendedCharge(charge, entries, monthStr);
          if (isFuture) {
            recurringCharges += result.blendedTotal;
          } else {
            // Confirmed with transaction_id → already in purchases
            const confirmedWithoutTx = entries
              .filter((e) => !e.transaction_id)
              .reduce((s, e) => s + e.amount, 0);
            recurringCharges += result.remainingProjected + confirmedWithoutTx;
          }
        }
        matrixByYear[y][monthStr][acc.id] = purchases + msi + annualFee + recurringCharges - credits;
      }
    }
  }

  const yearTotal = MONTHS.reduce((s, m) => {
    const monthStr = `${year}-${m}`;
    return s + creditAccounts.reduce((acc, card) => acc + (matrixByYear[year][monthStr][card.id] ?? 0), 0);
  }, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-6 mb-2">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-[var(--color-muted)]">Total {year}</p>
            <p className="text-lg font-semibold text-[var(--color-foreground)]">{formatMXN(yearTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Tarjetas</p>
            <p className="text-lg font-semibold text-[var(--color-foreground)]">{creditAccounts.length}</p>
          </div>
        </div>
      </div>
      <CardBreakdownTable
        years={years}
        currentYear={year}
        currentMonth={CURRENT_MONTH}
        accounts={creditAccounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank }))}
        matrixByYear={matrixByYear}
      />
    </>
  );
}

export default function BreakdownPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = searchParams.year ?? new Date().getFullYear().toString();

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn className="space-y-2">
        <Link href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Panel
        </Link>
        <PageHeader
          eyebrow="Panel"
          title="Desglose por Tarjeta"
          subtitle="Gastos mensuales por tarjeta · meses futuros en cursiva = MSI comprometido"
          action={<YearSelector year={Number(year)} />}
        />
      </FadeIn>

      <Suspense fallback={<p className="text-[var(--color-muted)]">Cargando…</p>}>
        <BreakdownContent year={year} />
      </Suspense>
    </div>
  );
}
