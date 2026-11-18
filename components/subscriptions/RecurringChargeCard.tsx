"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmChargeDialog } from "@/components/subscriptions/ConfirmChargeDialog";
import { formatMXN } from "@/lib/utils/formatters";
import { isChargeExpectedInMonth, computeChargeConfirmationStatus } from "@/lib/domain";
import { Repeat, CheckCircle2, Clock, Minus } from "lucide-react";
import type { RecurringCharge, RecurringChargeEntry } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Personalizado",
};

interface RecurringChargeCardProps {
  charge: RecurringCharge;
  currentMonth: string;
  entries: RecurringChargeEntry[];
  accountName: string;
}

export function RecurringChargeCard({ charge, currentMonth, entries, accountName }: RecurringChargeCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const isExpected = isChargeExpectedInMonth(charge, currentMonth);
  const status = computeChargeConfirmationStatus(charge, entries, currentMonth);
  const existingEntry = entries[0] ?? null;

  const handleCardClick = () => {
    if (isExpected) setDialogOpen(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`card-lift flex flex-col gap-3 p-4 ${isExpected ? "cursor-pointer" : ""}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
              <Repeat className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{charge.name}</p>
              <p className="text-xs text-[var(--color-muted)] truncate">{accountName}</p>
            </div>
          </div>
          <StatusBadge variant="muted">{FREQ_LABELS[charge.frequency] ?? charge.frequency}</StatusBadge>
        </div>

        {/* Amount */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-xl font-bold text-[var(--color-foreground)]">{formatMXN(charge.base_amount)}</p>
            {charge.category && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">{charge.category}</p>
            )}
            {charge.is_variable && (
              <p className="text-xs text-[var(--color-muted)]">Monto variable</p>
            )}
          </div>

          {/* Status for current month */}
          {!isExpected ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <Minus className="w-3.5 h-3.5" />
              <span>No aplica</span>
            </div>
          ) : status.status === "confirmed" ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmado</span>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
              className="flex items-center gap-1 text-xs text-[var(--color-accent)] font-medium hover:underline transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Confirmar</span>
            </button>
          )}
        </div>
      </div>

      {dialogOpen && (
        <ConfirmChargeDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          charge={charge}
          monthStr={currentMonth}
          existingEntry={existingEntry}
        />
      )}
    </>
  );
}
