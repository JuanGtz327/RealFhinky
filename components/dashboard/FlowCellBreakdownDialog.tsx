"use client";

import { FormDialog } from "@/components/ui/form-dialog";
import { formatMXN, formatMonthLabel, formatDate } from "@/lib/utils/formatters";
import { CheckCircle2, Circle } from "lucide-react";
import type { FlowRow } from "@/lib/domain/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "ingresos" | "gastos";
  month: string;
  row: FlowRow;
  isCurrent: boolean;
  isFuture: boolean;
}

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-center justify-between pt-4 pb-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatMXN(total)}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--color-border)]" />;
}

function InfoRow({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
      <div>
        <span className="text-sm text-[var(--color-foreground)]">{label}</span>
        {sub && <span className="ml-2 text-xs text-[var(--color-muted)]">{sub}</span>}
      </div>
      <span className={`text-sm font-mono ${valueClass ?? "text-[var(--color-foreground)]"}`}>{value}</span>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-[var(--color-muted)] py-2">{text}</p>;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

export function FlowCellBreakdownDialog({ open, onOpenChange, type, month, row, isCurrent, isFuture }: Props) {
  const title = type === "ingresos"
    ? `Ingresos Totales — ${formatMonthLabel(month)}`
    : `Gastos Totales — ${formatMonthLabel(month)}`;

  const total = type === "ingresos" ? row.ingresos_totales : row.gastos_totales;

  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={`Total: ${formatMXN(total)}`}
      className="sm:max-w-md"
    >
      {type === "gastos" ? (
        <GastosContent row={row} />
      ) : (
        <IngresosContent row={row} isCurrent={isCurrent} isFuture={isFuture} />
      )}
    </FormDialog>
  );
}

function GastosContent({ row }: { row: FlowRow }) {
  const breakdown = row.tarjetasBreakdown ?? [];
  const activeCards = breakdown.filter((c) => c.purchases + c.msi > 0);
  const tarjetasTotal = breakdown.reduce((s, c) => s + c.purchases + c.msi, 0);
  const loansTotal = row.loans.reduce((s, l) => s + l.amount, 0);
  const activeLoans = row.loans.filter((l) => l.amount > 0);

  return (
    <div className="space-y-1 pb-2">
      <SectionHeader label="Tarjetas de Crédito" total={tarjetasTotal} />
      <Divider />
      {activeCards.length === 0 ? (
        <EmptyNote text="Sin gastos en tarjetas este mes" />
      ) : (
        activeCards.map((card) => (
          <div key={card.id} className="pt-2 pb-1">
            <p className="text-sm font-medium text-[var(--color-foreground)] mb-1">
              {card.name}
              <span className="text-xs text-[var(--color-muted)] ml-1.5">· {card.bank}</span>
            </p>
            {card.purchases > 0 && (
              <InfoRow label="Compras directas" value={formatMXN(card.purchases)} />
            )}
            {card.msi > 0 && (
              <InfoRow label="Cuotas MSI" value={formatMXN(card.msi)} />
            )}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-[var(--color-muted)]">Subtotal</span>
              <span className="text-sm font-semibold font-mono text-[var(--color-foreground)]">
                {formatMXN(card.purchases + card.msi)}
              </span>
            </div>
          </div>
        ))
      )}

      <SectionHeader label="Préstamos" total={loansTotal} />
      <Divider />
      {activeLoans.length === 0 ? (
        <EmptyNote text="Sin cuotas de préstamo este mes" />
      ) : (
        activeLoans.map((loan) => (
          <InfoRow key={loan.account_id} label={loan.name} value={formatMXN(loan.amount)} />
        ))
      )}
    </div>
  );
}

function IngresosContent({ row, isCurrent, isFuture }: { row: FlowRow; isCurrent: boolean; isFuture: boolean }) {
  const nominaSlots = row.nominaSlots ?? [];
  const nominaTotal = row.ingresos_totales;
  const abonos = row.abonosDetail ?? [];
  const transferencias = row.transferenciasDetail ?? [];

  return (
    <div className="space-y-1 pb-2">
      <SectionHeader label={isCurrent ? "Nómina pendiente" : "Nómina"} total={nominaTotal} />
      <Divider />

      {nominaSlots.length === 0 ? (
        <EmptyNote text="Sin fuentes de ingreso configuradas" />
      ) : (
        nominaSlots.map((src) => (
          <div key={src.sourceId} className="pt-2 pb-1">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-sm font-medium text-[var(--color-foreground)]">{src.sourceName}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">
                {FREQ_LABELS[src.frequency] ?? src.frequency}
              </span>
            </div>

            {src.slots.length === 0 ? (
              <EmptyNote text="Sin pagos esperados este mes" />
            ) : (
              src.slots.map((slot, i) => {
                if (isCurrent) {
                  if (slot.confirmed) {
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                          <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                          <span className="text-[10px] text-[var(--color-success)]">confirmado</span>
                        </div>
                        <span className="text-sm font-mono text-[var(--color-success)]">{formatMXN(slot.amount)}</span>
                      </div>
                    );
                  }
                  if (slot.isPast) {
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                          <span className="text-sm text-[var(--color-foreground)]">{formatDate(slot.date)}</span>
                          <span className="text-[10px] text-[var(--color-warning)]">pendiente ← suma aquí</span>
                        </div>
                        <span className="text-sm font-mono text-[var(--color-warning)]">{formatMXN(slot.amount)}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50 opacity-50">
                      <div className="flex items-center gap-2">
                        <Circle className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                        <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                        <span className="text-[10px] text-[var(--color-muted)]">programado</span>
                      </div>
                      <span className="text-sm font-mono text-[var(--color-muted)]">{formatMXN(slot.amount)}</span>
                    </div>
                  );
                }

                if (isFuture) {
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                      <div className="flex items-center gap-2">
                        <Circle className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                        <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">
                          Proyectado
                        </span>
                      </div>
                      <span className="text-sm font-mono text-[var(--color-muted)]">{formatMXN(slot.amount)}</span>
                    </div>
                  );
                }

                // Past month: only confirmed entries appear as slots
                return slot.confirmed ? (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                      <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                    </div>
                    <span className="text-sm font-mono text-[var(--color-success)]">{formatMXN(slot.amount)}</span>
                  </div>
                ) : null;
              })
            )}
          </div>
        ))
      )}

      {isCurrent && (
        <p className="text-[10px] text-[var(--color-muted)] pt-1">
          * Solo los pagos pendientes suman a Ingresos Totales
        </p>
      )}

      {/* Abonos — informativo */}
      <div className="pt-2">
        <SectionHeader label="Abonos · informativo" total={row.abonos} />
        <p className="text-[10px] text-[var(--color-muted)] mb-1">No suman al total (ya incluidos en patrimonio)</p>
        <Divider />
        {abonos.length === 0 ? (
          <EmptyNote text="Sin abonos este mes" />
        ) : (
          abonos.map((a, i) => (
            <InfoRow
              key={i}
              label={a.merchant || a.accountName}
              value={formatMXN(a.amount)}
              sub={`${a.accountName} · ${formatDate(a.date)}`}
              valueClass="text-[var(--color-success)]"
            />
          ))
        )}
      </div>

      {/* Transferencias — informativo, only if any */}
      {(transferencias.length > 0 || row.transferencias > 0) && (
        <div className="pt-2">
          <SectionHeader label="Transferencias salientes · informativo" total={row.transferencias} />
          <Divider />
          {transferencias.length === 0 ? (
            <EmptyNote text="Sin transferencias este mes" />
          ) : (
            transferencias.map((t, i) => (
              <InfoRow
                key={i}
                label={t.merchant || t.accountName}
                value={formatMXN(t.amount)}
                sub={`${t.accountName} · ${formatDate(t.date)}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
