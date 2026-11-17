"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMXN } from "@/lib/utils/formatters";
import { projectMonthlyIncome } from "@/lib/domain/income";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmIncomeDialog } from "./ConfirmIncomeDialog";
import { X, CheckCircle2 } from "lucide-react";
import type { IncomeSource, IncomeEntry } from "@/lib/types";
import type { IncomeConfirmationStatus } from "@/lib/domain/types";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

interface Props {
  source: IncomeSource;
  entries: IncomeEntry[];
  status: IncomeConfirmationStatus;
}

export function IncomeSourceCard({ source, entries, status }: Props) {
  const router             = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const handleDelete = async (entryId: string) => {
    setDeleting(entryId);
    try {
      await fetch(`/api/income/entries/${entryId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  };

  const dots = Array.from({ length: status.expectedCount }, (_, i) => i < status.confirmedCount);

  return (
    <div className="rounded-xl border border-[var(--color-border)] card-elevated card-lift overflow-hidden">
      {/* Header */}
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
      </div>

      <div className="h-px bg-[var(--color-border)] mx-5" />

      {/* Progress */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {dots.map((confirmed, i) =>
            confirmed ? (
              <span
                key={i}
                className="w-3 h-3 rounded-full bg-[var(--color-success)]"
              />
            ) : (
              <span
                key={i}
                className="w-3 h-3 rounded-full border-2 border-[var(--color-border)]"
              />
            )
          )}
        </div>
        <span className="text-xs text-[var(--color-muted)]">
          {status.confirmedCount}/{status.expectedCount} pagos confirmados
        </span>
      </div>

      {/* Confirmed entries */}
      {entries.length > 0 && (
        <div className="px-5 pb-3 space-y-1.5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)] text-xs">{entry.date}</span>
                <span className="font-mono font-medium text-[var(--color-success)]">{formatMXN(entry.amount)}</span>
                {entry.notes && (
                  <span className="text-[var(--color-muted)] text-xs italic">{entry.notes}</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={deleting === entry.id}
                className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-[var(--color-border)] mx-5" />

      {/* Footer */}
      <div className="px-5 py-3">
        {status.status !== "confirmed" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="text-xs h-8"
          >
            Confirmar ingreso
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completo</span>
          </div>
        )}
      </div>

      <ConfirmIncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        source={source}
        onConfirmed={() => setDialogOpen(false)}
      />
    </div>
  );
}
