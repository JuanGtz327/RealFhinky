"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell } from "@/components/ui/currency-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMXN } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";

type Row = Record<string, unknown>;

export function AccountTransactions({ transactions }: { transactions: Transaction[] }) {
  const columns: Column<Row>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (v) => (
        <span className="text-sm text-[var(--color-muted)] font-mono">{String(v).substring(0, 10)}</span>
      ),
    },
    {
      key: "merchant",
      header: "Comercio / Descripción",
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {String(v ?? row.description ?? "—")}
          </p>
          {row.category ? (
            <p className="text-xs text-[var(--color-muted)]">{String(row.category)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "is_msi",
      header: "Tipo",
      render: (v, row) => {
        if (v) return (
          <div className="flex items-center gap-1.5">
            <StatusBadge variant="msi">{row.msi_months as number} MSI</StatusBadge>
            {row.msi_monthly_amount ? (
              <span className="text-xs font-medium text-[var(--color-muted)]">
                {formatMXN(row.msi_monthly_amount as number)}/mes
              </span>
            ) : null}
          </div>
        );
        const type = row.type as string;
        if (type === "income" || type === "transfer_in")
          return <StatusBadge variant="ok">Ingreso</StatusBadge>;
        if (type === "transfer_out")
          return <StatusBadge variant="muted">Transferencia</StatusBadge>;
        return <StatusBadge variant="muted">Compra</StatusBadge>;
      },
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      render: (v, row) => {
        const isIncome = row.type === "income" || row.type === "transfer_in";
        return <CurrencyCell amount={Number(v)} colorize={isIncome} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={transactions as unknown as Row[]}
      emptyMessage="Sin transacciones registradas"
    />
  );
}
