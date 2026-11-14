"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell, VariationCell } from "@/components/ui/currency-cell";
import { formatMonthShort } from "@/lib/utils/formatters";

export interface LoanColumn { id: string; name: string }

export interface FlowRow {
  month: string;
  capital_inicio: number;
  nomina: number;
  abonos: number;
  ingresos_totales: number;
  transferencias: number;
  tarjetas: number;
  loans: { account_id: string; name: string; amount: number }[];
  gastos_totales: number;
  capital_fin: number;
  variacion: number | null;
  [key: string]: unknown;
}

interface MonthlyFlowTableProps {
  rows: FlowRow[];
  loanColumns: LoanColumn[];
  currentMonth: string;
}

export function MonthlyFlowTable({ rows, loanColumns, currentMonth }: MonthlyFlowTableProps) {
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
        <span className="font-medium text-[var(--color-foreground)] capitalize">
          {formatMonthShort(String(v))}
        </span>
      ),
    },
    { key: "capital_inicio",    header: "Capital Inicio",   align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    { key: "nomina",            header: "Nómina",            align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero colorize /> },
    { key: "abonos",            header: "Abonos",            align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero colorize /> },
    { key: "ingresos_totales",  header: "Ingresos Totales",  align: "right", render: (v) => <CurrencyCell amount={Number(v)} colorize /> },
    { key: "transferencias",    header: "Transferencias",    align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    { key: "tarjetas",          header: "Tarjetas",          align: "right", render: (v) => <CurrencyCell amount={Number(v)} dimIfZero /> },
    ...loanCols,
    { key: "gastos_totales",    header: "Gastos Totales",    align: "right", render: (v) => <CurrencyCell amount={Number(v)} /> },
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
  );
}
