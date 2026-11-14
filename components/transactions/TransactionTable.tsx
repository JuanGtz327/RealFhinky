"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell } from "@/components/ui/currency-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMXN } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";

interface Account { id: string; name: string; bank: string; type: string }

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
}

type Row = Record<string, unknown>;

const TYPE_LABELS: Record<string, string> = {
  purchase:     "Compra",
  income:       "Ingreso",
  transfer_in:  "Entrada",
  transfer_out: "Salida",
};

export function TransactionTable({ transactions, accounts }: TransactionTableProps) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    account_id: searchParams.get("account_id") ?? "",
    month:      searchParams.get("month") ?? "",
    category:   "",
    is_msi:     "",
  });

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const filtered = transactions.filter((tx) => {
    if (filters.account_id && tx.account_id !== filters.account_id) return false;
    if (filters.month && !tx.date.startsWith(filters.month)) return false;
    if (filters.category && tx.category !== filters.category) return false;
    if (filters.is_msi === "yes" && !tx.is_msi) return false;
    if (filters.is_msi === "no"  && tx.is_msi)  return false;
    return true;
  });

  const categories = Array.from(new Set(transactions.map((t) => t.category).filter((c): c is string => Boolean(c))));

  const SELECT = "select-field h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-xs text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

  const columns: Column<Row>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (v) => <span className="font-mono text-xs text-[var(--color-muted)]">{String(v).substring(0, 10)}</span>,
    },
    {
      key: "account_id",
      header: "Cuenta",
      render: (v) => {
        const acc = accountMap[v as string];
        return acc
          ? <div><p className="text-sm font-medium">{acc.name}</p><p className="text-xs text-[var(--color-muted)]">{acc.bank}</p></div>
          : <span className="text-[var(--color-muted)]">—</span>;
      },
    },
    {
      key: "merchant",
      header: "Comercio",
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">{String(v ?? row.description ?? "—")}</p>
          {row.category ? <p className="text-xs text-[var(--color-muted)]">{String(row.category)}</p> : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (v, row) => {
        if (row.is_msi) return (
          <div className="flex items-center gap-1.5">
            <StatusBadge variant="msi">{row.msi_months as number} MSI</StatusBadge>
            {row.msi_monthly_amount ? (
              <span className="text-xs font-medium text-[var(--color-muted)]">
                {formatMXN(row.msi_monthly_amount as number)}/mes
              </span>
            ) : null}
          </div>
        );
        const type = v as string;
        const isIncome = type === "income" || type === "transfer_in";
        return <StatusBadge variant={isIncome ? "ok" : "muted"}>{TYPE_LABELS[type] ?? type}</StatusBadge>;
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
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className={SELECT} value={filters.account_id}
          onChange={(e) => setFilters((p) => ({ ...p, account_id: e.target.value }))}>
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>)}
        </select>

        <input type="month" className={SELECT} value={filters.month}
          onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />

        <select className={SELECT} value={filters.category}
          onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className={SELECT} value={filters.is_msi}
          onChange={(e) => setFilters((p) => ({ ...p, is_msi: e.target.value }))}>
          <option value="">MSI + normales</option>
          <option value="yes">Solo MSI</option>
          <option value="no">Solo normales</option>
        </select>

        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ account_id: "", month: "", category: "", is_msi: "" })}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors">
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-[var(--color-muted)]">{filtered.length} transacciones</span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered as unknown as Row[]}
        emptyMessage="No hay transacciones con estos filtros"
      />
    </div>
  );
}
