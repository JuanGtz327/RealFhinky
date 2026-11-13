"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell } from "@/components/ui/currency-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMonthShort, formatMXN } from "@/lib/utils/formatters";

interface ForecastRow {
  month: string;
  expectedIncome: number;
  committedMsi: number;
  estimatedExpenses: number;
  netFlow: number;
  isNegative: boolean;
}

type Row = ForecastRow & Record<string, unknown>;

const columns: Column<Row>[] = [
  {
    key: "month",
    header: "Mes",
    render: (_, row) => (
      <span className="font-medium text-[var(--color-foreground)] capitalize">
        {formatMonthShort(row.month as string)}
      </span>
    ),
  },
  {
    key: "expectedIncome",
    header: "Ingreso esperado",
    align: "right",
    render: (_, row) => <CurrencyCell amount={row.expectedIncome as number} colorize />,
  },
  {
    key: "committedMsi",
    header: "MSI comprometido",
    align: "right",
    render: (_, row) => {
      const val = row.committedMsi as number;
      if (val > 0) {
        return (
          <span className="flex items-center justify-end gap-1.5">
            <CurrencyCell amount={val} />
            <StatusBadge variant="msi">MSI</StatusBadge>
          </span>
        );
      }
      return <span className="text-[var(--color-muted)] text-xs">—</span>;
    },
  },
  {
    key: "estimatedExpenses",
    header: "Gasto estimado",
    align: "right",
    render: (_, row) => <CurrencyCell amount={row.estimatedExpenses as number} />,
  },
  {
    key: "netFlow",
    header: "Flujo neto",
    align: "right",
    render: (_, row) => {
      const neg = row.isNegative as boolean;
      return (
        <span className={`font-mono font-semibold ${neg ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
          {neg ? "▼" : "▲"} {formatMXN(Math.abs(row.netFlow as number))}
        </span>
      );
    },
  },
  {
    key: "_status",
    header: "",
    align: "right",
    render: (_, row) =>
      (row.isNegative as boolean) ? <StatusBadge variant="danger">Déficit</StatusBadge> : null,
  },
];

export function ForecastTable({ rows }: { rows: ForecastRow[] }) {
  return (
    <DataTable<Row>
      columns={columns}
      rows={rows as Row[]}
      highlightRow={(row) => ((row.isNegative as boolean) ? "negative" : null)}
    />
  );
}
