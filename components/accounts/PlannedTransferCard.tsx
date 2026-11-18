"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmTransferDialog } from "@/components/accounts/ConfirmTransferDialog";
import { formatMXN } from "@/lib/utils/formatters";
import { computeBlendedTransfer } from "@/lib/domain";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import type { PlannedTransfer, PlannedTransferEntry } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
  one_time: "Una vez",
  custom: "Personalizado",
};

interface PlannedTransferCardProps {
  transfer: PlannedTransfer;
  currentMonth: string;
  entries: PlannedTransferEntry[];
}

export function PlannedTransferCard({ transfer, currentMonth, entries }: PlannedTransferCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const result = computeBlendedTransfer(transfer, entries);
  const isFullyConfirmed = result.confirmedCount >= result.expectedCount;
  const existingEntry = entries[0] ?? null;

  const isIn = transfer.direction === "in";
  const dirLabel = isIn ? "Entrada" : "Salida";

  return (
    <>
      <div
        onClick={() => setDialogOpen(true)}
        className="card-lift flex flex-col gap-3 p-4 cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isIn ? "bg-[var(--color-success)]/10" : "bg-[var(--color-accent)]/10"}`}>
              {isIn
                ? <ArrowDownLeft className="w-4 h-4 text-[var(--color-success)]" />
                : <ArrowUpRight className="w-4 h-4 text-[var(--color-accent)]" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{transfer.name}</p>
              <p className="text-xs text-[var(--color-muted)]">{dirLabel}</p>
            </div>
          </div>
          <StatusBadge variant="muted">{FREQ_LABELS[transfer.frequency] ?? transfer.frequency}</StatusBadge>
        </div>

        {/* Amount + status */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-xl font-bold text-[var(--color-foreground)]">{formatMXN(transfer.base_amount)}</p>
            {result.expectedCount > 1 && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                {result.confirmedCount}/{result.expectedCount} confirmadas
              </p>
            )}
          </div>

          {isFullyConfirmed ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
              <Clock className="w-3.5 h-3.5" />
              <span>Pendiente</span>
            </div>
          )}
        </div>
      </div>

      {dialogOpen && (
        <ConfirmTransferDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          transfer={transfer}
          monthStr={currentMonth}
          existingEntry={existingEntry}
        />
      )}
    </>
  );
}
