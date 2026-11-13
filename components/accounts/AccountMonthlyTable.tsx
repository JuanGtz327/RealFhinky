"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell } from "@/components/ui/currency-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMonthShort } from "@/lib/utils/formatters";

interface MonthRow {
  month: string;
  real: number;
  msi: number;
  total: number;
  isFuture: boolean;
  isCurrent: boolean;
}

type Row = Record<string, unknown>;

export function AccountMonthlyTable({ rows, isCredit }: { rows: MonthRow[]; isCredit: boolean }) {
  const columns: Column<Row>[] = [
    {
      key: "month",
      header: "Mes",
      render: (v, row) => (
        <span className={`font-medium capitalize ${row.isFuture ? "text-[var(--color-muted)]" : "text-[var(--color-foreground)]"}`}>
          {formatMonthShort(String(v))}
        </span>
      ),
    },
    ...(isCredit ? [
      {
        key: "real" as const,
        header: "Compras reales",
        align: "right" as const,
        render: (v: unknown, row: Row) => row.isFuture
          ? <span className="text-[var(--color-muted)] text-xs">—</span>
          : <CurrencyCell amount={Number(v)} dimIfZero />,
      },
      {
        key: "msi" as const,
        header: "Cuotas MSI",
        align: "right" as const,
        render: (v: unknown) => Number(v) > 0
          ? <span className="flex items-center justify-end gap-1.5"><CurrencyCell amount={Number(v)} /><StatusBadge variant="msi">MSI</StatusBadge></span>
          : <span className="text-[var(--color-muted)] text-xs">—</span>,
      },
    ] : []),
    {
      key: "total",
      header: isCredit ? "Total del mes" : "Movimientos",
      align: "right" as const,
      render: (v, row) => (
        <span className={row.isFuture ? "italic" : ""}>
          <CurrencyCell amount={Number(v)} dimIfZero={!row.isCurrent} />
        </span>
      ),
    },
  ];

  const yearTotal = rows.reduce((s, r) => s + r.total, 0);
  const footerRow: Record<string, React.ReactNode> = {
    month: <span className="text-[var(--color-muted)]">Total año</span>,
    total: <CurrencyCell amount={yearTotal} />,
  };
  if (isCredit) {
    footerRow.real = <CurrencyCell amount={rows.filter((r) => !r.isFuture).reduce((s, r) => s + r.real, 0)} />;
    footerRow.msi  = <CurrencyCell amount={rows.reduce((s, r) => s + r.msi, 0)} />;
  }

  return (
    <DataTable
      columns={columns}
      rows={rows as unknown as Row[]}
      footerRow={footerRow}
      highlightRow={(row) => row.isCurrent ? "current" : row.isFuture ? "projected" : null}
    />
  );
}
