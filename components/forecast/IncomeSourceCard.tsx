"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMXN } from "@/lib/utils/formatters";
import { projectMonthlyIncome } from "@/lib/domain/income";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormDialog } from "@/components/ui/form-dialog";
import { IncomeSourceForm } from "@/components/forecast/IncomeSourceForm";
import { CheckCircle2, ChevronRight, Pencil } from "lucide-react";
import { IncomeSourceDetailDrawer } from "@/components/income/IncomeSourceDetailDrawer";
import type { IncomeSource, IncomeEntry } from "@/lib/types";
import type { IncomeConfirmationStatus } from "@/lib/domain/types";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

interface DebitAccountOption {
  id: string;
  name: string;
  bank: string;
}

interface Props {
  source: IncomeSource;
  entries: IncomeEntry[];
  status: IncomeConfirmationStatus;
  monthStr: string;
  today: string;
  debitAccounts?: DebitAccountOption[];
}

export function IncomeSourceCard({ source, entries, status, monthStr, today, debitAccounts = [] }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="w-full rounded-xl border border-[var(--color-border)] card-elevated card-lift overflow-hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="w-full text-left cursor-pointer"
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
        </button>

        <div className="h-px bg-[var(--color-border)] mx-5" />

        <div className="px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex-1 text-left cursor-pointer"
          >
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
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            className="p-1.5 rounded-md text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <IncomeSourceDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        source={source}
        entries={entries}
        monthStr={monthStr}
        today={today}
      />

      <FormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar fuente de ingreso"
        description={source.name}
        icon={<Pencil className="w-4 h-4" />}
      >
        <IncomeSourceForm
          mode="edit"
          initial={{
            id: source.id,
            name: source.name,
            frequency: source.frequency,
            base_amount: source.base_amount,
            is_variable: source.is_variable,
            start_date: source.start_date,
            custom_interval_days: source.custom_interval_days,
            account_id: source.account_id,
          }}
          debitAccounts={debitAccounts}
          onSuccess={() => { setEditOpen(false); router.refresh(); }}
        />
      </FormDialog>
    </>
  );
}
