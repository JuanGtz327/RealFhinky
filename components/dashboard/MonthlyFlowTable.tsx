"use client";

import { useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell, VariationCell } from "@/components/ui/currency-cell";
import { formatMonthShort } from "@/lib/utils/formatters";
import { FlowCellBreakdownDialog } from "@/components/dashboard/FlowCellBreakdownDialog";
import { Flag, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import type { FlowRow } from "@/lib/domain/types";

function IconTooltip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      {icon}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-white bg-[var(--color-navbar)] rounded whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );
}

export interface LoanColumn { id: string; name: string }

export type { FlowRow };

interface MonthlyFlowTableProps {
  rows: FlowRow[];
  loanColumns: LoanColumn[];
  currentMonth: string;
  onboardingMonth?: string;
}

interface DialogState {
  open: boolean;
  type: "ingresos" | "gastos";
  row: FlowRow;
}

export function MonthlyFlowTable({ rows, loanColumns, currentMonth, onboardingMonth }: MonthlyFlowTableProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const flatRows = rows.map((r) => {
    const flat: Record<string, unknown> = { ...r };
    for (const lc of loanColumns) {
      flat[`loan_${lc.id}`] = r.loans.find((l) => l.account_id === lc.id)?.amount ?? 0;
    }
    return flat;
  });

  const loanCols: Column<Record<string, unknown>>[] = loanColumns.map((lc) => ({
    key: `loan_${lc.id}`,
    header: lc.name,
    align: "right" as const,
    render: (v) => <CurrencyCell amount={Number(v)} dimIfZero />,
  }));

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "month",
      header: "Mes",
      render: (v) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-foreground)] capitalize">
          {formatMonthShort(String(v))}
          {onboardingMonth && String(v) === onboardingMonth && (
            <IconTooltip
              label="Mes de inicio en Finkhy"
              icon={<Flag className="w-3.5 h-3.5 text-[var(--color-accent)]" strokeWidth={2.5} />}
            />
          )}
        </span>
      ),
    },
    { key: "capital_inicio",    header: "Capital Inicio",   align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    {
      key: "nomina",
      header: "Nómina",
      align: "right" as const,
      render: (v, row) => {
        const r = row as unknown as FlowRow;
        if (r.month === currentMonth && r.nomina_display !== undefined && (r.nomina_confirmed ?? 0) > 0) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <CurrencyCell amount={r.nomina_display} dimIfZero colorize />
              <IconTooltip
                label={`${r.nomina_confirmed} pago${(r.nomina_confirmed ?? 0) > 1 ? "s" : ""} confirmado${(r.nomina_confirmed ?? 0) > 1 ? "s" : ""}`}
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" strokeWidth={2.5} />}
              />
            </div>
          );
        }
        return <CurrencyCell amount={Number(v)} dimIfZero colorize />;
      },
    },
    { key: "abonos",            header: "Abonos",            align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero colorize /> },
    {
      key: "ingresos_totales",
      header: "Ingresos Totales",
      align: "right" as const,
      render: (v, row) => {
        const r = row as unknown as FlowRow;
        const hasAdj = (r.otrosIngresos?.length ?? 0) > 0;
        return (
          <button
            onClick={() => setDialog({ open: true, type: "ingresos", row: r })}
            className="inline-flex items-center justify-end gap-1.5 underline decoration-dotted underline-offset-2 cursor-pointer hover:text-[var(--color-accent)] transition-colors"
          >
            {hasAdj && (
              <IconTooltip
                label="Incluye ajustes manuales de ingreso"
                icon={<SlidersHorizontal className="w-3.5 h-3.5 text-[var(--color-success)]" strokeWidth={2.5} />}
              />
            )}
            <CurrencyCell amount={Number(v)} colorize />
          </button>
        );
      },
    },
    { key: "transferencias",    header: "Transferencias",    align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    { key: "tarjetas",          header: "Tarjetas",          align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    ...loanCols,
    {
      key: "gastos_totales",
      header: "Gastos Totales",
      align: "right" as const,
      render: (v, row) => {
        const r = row as unknown as FlowRow;
        const hasAdj = (r.otrosGastos?.length ?? 0) > 0
          || (r.tarjetasBreakdown ?? []).some((c) => c.flow_adjustment);
        return (
          <button
            onClick={() => setDialog({ open: true, type: "gastos", row: r })}
            className="inline-flex items-center justify-end gap-1.5 underline decoration-dotted underline-offset-2 cursor-pointer hover:text-[var(--color-accent)] transition-colors"
          >
            {hasAdj && (
              <IconTooltip
                label="Incluye ajustes manuales de gasto"
                icon={<SlidersHorizontal className="w-3.5 h-3.5 text-[var(--color-warning)]" strokeWidth={2.5} />}
              />
            )}
            <CurrencyCell amount={Number(v)} />
          </button>
        );
      },
    },
    { key: "capital_fin",       header: "Capital Fin",       align: "right", render: (v) => <CurrencyCell amount={Number(v)} colorize /> },
    { key: "variacion",         header: "% Variación",       align: "right", render: (v) => <VariationCell variation={v as number | null} /> },
  ];

  const totals = rows.reduce(
    (acc, r) => ({
      nomina:           acc.nomina + r.nomina,
      abonos:           acc.abonos + r.abonos,
      ingresos_totales: acc.ingresos_totales + r.ingresos_totales,
      transferencias:   acc.transferencias + r.transferencias,
      tarjetas:         acc.tarjetas + r.tarjetas,
      gastos_totales:   acc.gastos_totales + r.gastos_totales,
    }),
    { nomina: 0, abonos: 0, ingresos_totales: 0, transferencias: 0, tarjetas: 0, gastos_totales: 0 }
  );

  const footerRow: Record<string, React.ReactNode> = {
    month:            <span className="text-[var(--color-muted)]">Total anual</span>,
    nomina:           <CurrencyCell amount={totals.nomina} />,
    abonos:           <CurrencyCell amount={totals.abonos} />,
    ingresos_totales: <CurrencyCell amount={totals.ingresos_totales} colorize />,
    transferencias:   <CurrencyCell amount={totals.transferencias} />,
    tarjetas:         <CurrencyCell amount={totals.tarjetas} />,
    gastos_totales:   <CurrencyCell amount={totals.gastos_totales} />,
  };
  for (const lc of loanColumns) {
    footerRow[`loan_${lc.id}`] = (
      <CurrencyCell amount={rows.reduce((s, r) => s + (r.loans.find((l) => l.account_id === lc.id)?.amount ?? 0), 0)} />
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={flatRows}
        footerRow={footerRow}
        highlightRow={(row) => {
          if (row.month === currentMonth) return "current";
          if (row.is_projected) return "projected";
          return null;
        }}
        emptyMessage="Sin datos para este año"
      />
      {dialog && (
        <FlowCellBreakdownDialog
          open={dialog.open}
          onOpenChange={(v) => setDialog(v ? dialog : null)}
          type={dialog.type}
          month={dialog.row.month}
          row={dialog.row}
          isCurrent={dialog.row.month === currentMonth}
          isFuture={dialog.row.month > currentMonth}
        />
      )}
    </>
  );
}
