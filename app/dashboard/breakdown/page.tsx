import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { formatMXN } from "@/lib/utils/formatters";
import { computeBillingPeriod } from "@/lib/utils/billing";
import { format } from "date-fns";
import { CardBreakdownTable } from "@/components/dashboard/CardBreakdownTable";
import { YearSelector } from "@/components/ui/year-selector";
import { FadeIn } from "@/components/ui/animated";
import { CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

function BreakdownContent({ year }: { year: string }) {
  const db      = getDb();
  const accRepo = new AccountsRepository(db);
  const txRepo  = new TransactionsRepository(db);
  const msiRepo = new MsiRepository(db);

  const creditAccounts = accRepo.findByType("credit");
  const years = [year, String(Number(year) - 1)];

  const matrixByYear: Record<string, Record<string, Record<string, number>>> = {};
  for (const y of years) {
    matrixByYear[y] = {};
    for (const m of MONTHS) {
      const monthStr = `${y}-${m}`;
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
        matrixByYear[y][monthStr][acc.id] = purchases + msi + annualFee - credits;
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
      <FadeIn>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--color-foreground)]">
              <CreditCard className="w-6 h-6 text-[var(--color-accent)]" /> Desglose por Tarjeta
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Gastos mensuales por tarjeta · meses futuros en <em>cursiva</em> = MSI comprometido
            </p>
          </div>
          <YearSelector year={Number(year)} />
        </div>
      </FadeIn>

      <Suspense fallback={<p className="text-[var(--color-muted)]">Cargando…</p>}>
        <BreakdownContent year={year} />
      </Suspense>
    </div>
  );
}
