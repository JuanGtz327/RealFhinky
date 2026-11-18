import { formatMXN } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Lightbulb } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface AccountBase {
  id: string;
  name: string;
  bank: string;
}

interface AccountCardGridProps<T extends AccountBase> {
  accounts: T[];
  columns?: 1 | 2;
  summaryCard?: ReactNode;
  viewAllHref?: string;
  addNewHref?: string;
  getIcon: (account: T) => ReactNode;
  getBadge?: (account: T) => ReactNode;
  getBalance: (account: T) => number;
  renderStats?: (account: T) => ReactNode;
}

const MAX_VISIBLE = 4;

export function AccountCardGrid<T extends AccountBase>({
  accounts,
  columns = 2,
  summaryCard,
  viewAllHref,
  addNewHref = "/accounts/new",
  getIcon,
  getBadge,
  getBalance,
  renderStats,
}: AccountCardGridProps<T>) {
  const hasOverflow = columns === 2 && accounts.length >= MAX_VISIBLE && !!viewAllHref;
  const visibleAccounts = hasOverflow ? accounts.slice(0, MAX_VISIBLE - 1) : accounts;
  const hiddenCount = accounts.length - visibleAccounts.length;
  const emptySlots = !hasOverflow && columns === 2
    ? Math.max(0, MAX_VISIBLE - visibleAccounts.length)
    : 0;

  return (
    <div className="space-y-3">
      {summaryCard}

      <div className={cn(
        "grid gap-3",
        columns === 2 ? "grid-cols-2" : "grid-cols-1"
      )}>
        {visibleAccounts.map((acc) => (
          <Link
            key={acc.id}
            href={`/accounts/${acc.id}`}
            className="border border-[var(--color-border)] bg-[var(--color-surface)] card-lift flex flex-col px-4 py-4 hover:border-[var(--color-accent)]/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center bg-[var(--color-navbar)]/8 shrink-0">
                  {getIcon(acc)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-foreground)] text-sm truncate">{acc.name}</p>
                  <p className="text-xs text-[var(--color-muted)] truncate">{acc.bank}</p>
                </div>
              </div>
              {getBadge?.(acc)}
            </div>

            <p className="text-xl font-bold text-[var(--color-foreground)] mb-2 tabular-nums">
              {formatMXN(getBalance(acc))}
            </p>

            {renderStats?.(acc)}
          </Link>
        ))}

        {/* ── Ver todas (overflow ≥4) ── */}
        {hasOverflow && viewAllHref && (
          <Link href={viewAllHref}
            className="group bg-[var(--color-surface)] border border-[var(--color-border)] card-sweep flex flex-col items-center justify-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center bg-[var(--color-accent)]/10 group-hover:bg-white/20 transition-colors">
              <ArrowRight className="w-4 h-4 text-[var(--color-accent)] group-hover:text-white transition-colors" />
            </div>
            <p className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-white transition-colors">
              Ver todas
            </p>
            {hiddenCount > 0 && (
              <p className="text-xs text-[var(--color-muted)] group-hover:text-white/70 transition-colors">
                +{hiddenCount} más
              </p>
            )}
          </Link>
        )}

        {/* ── Filler: 2 huecos → col-span-2 con tip + add ── */}
        {emptySlots >= 2 && (
          <div className="col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] min-h-40 overflow-hidden flex">
            <div className="w-1 shrink-0 bg-[var(--color-accent)]" />
            <div className="flex flex-1 items-center gap-5 px-5 py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--color-accent)]/10">
                <Lightbulb className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">¿Tienes más cuentas?</p>
                <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed max-w-sm">
                  Registra débito, crédito e inversiones para ver tu patrimonio completo en un solo lugar.
                </p>
              </div>
              <Link href={addNewHref}
                className={cn(buttonVariants(), "shrink-0 gap-2")}>
                <Plus className="w-3.5 h-3.5" />
                Nueva cuenta
              </Link>
            </div>
          </div>
        )}

        {/* ── Filler: 1 hueco → add card ── */}
        {emptySlots === 1 && (
          <Link href={addNewHref}
            className="group bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-2 px-4 py-4 hover:border-[var(--color-accent)] transition-colors">
            <div className="flex h-8 w-8 items-center justify-center bg-[var(--color-navbar)]/5 group-hover:bg-[var(--color-accent)]/10 transition-colors">
              <Plus className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
            </div>
            <p className="text-xs text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
              Nueva cuenta
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}

export function SummaryCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="border border-[var(--color-border)] card-elevated overflow-hidden">
      <div className="bg-[var(--color-navbar)] px-5 py-2">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">{label}</p>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

export function UtilizationBar({ pct, barColor }: { pct: number; barColor: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg)] overflow-hidden">
      <div className={cn("h-1.5 rounded-full", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
