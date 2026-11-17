"use client";

import { useState } from "react";
import { formatMXN } from "@/lib/utils/formatters";
import { projectMonthlyIncome } from "@/lib/domain/income";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { IncomeSourceDetailDrawer } from "@/components/income/IncomeSourceDetailDrawer";
import type { IncomeSource, IncomeEntry } from "@/lib/types";
import type { IncomeConfirmationStatus } from "@/lib/domain/types";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

interface Props {
  source: IncomeSource;
  entries: IncomeEntry[];
  status: IncomeConfirmationStatus;
  monthStr: string;
  today: string;
}

export function IncomeSourceCard({ source, entries, status, monthStr, today }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="w-full text-left rounded-xl border border-[var(--color-border)] card-elevated card-lift overflow-hidden cursor-pointer"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[var(--color-foreground)]">{source.name}</p>
              <StatusBadge variant="muted">{FREQ_LABELS[source.frequency]}</StatusBadge>
              {source.is_variable && <StatusBadge variant="muted">Variable</StatusBadge>}
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {formatMXN(source.base_amount)}/pago · {formatMXN(projectMonthlyIncome(source))} estimado/mes
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
        </div>

        <div className="h-px bg-[var(--color-border)] mx-5" />

        <div className="px-5 py-3 flex items-center justify-between">
          {status.expectedCount === 0 ? (
            <span className="text-xs text-[var(--color-muted)]">Sin fechas esperadas — configura fecha de inicio</span>
          ) : status.status === "confirmed" ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completo · {status.confirmedCount}/{status.expectedCount} confirmados</span>
            </div>
          ) : (
            <span className="text-xs text-[var(--color-muted)]">
              {status.confirmedCount}/{status.expectedCount} pagos confirmados
              {status.confirmedCount < status.expectedCount && (
                <span className="ml-1.5 text-[var(--color-warning)]">· Ver pagos →</span>
              )}
            </span>
          )}
        </div>
      </button>

      <IncomeSourceDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        source={source}
        entries={entries}
        monthStr={monthStr}
        today={today}
      />
    </>
  );
}
