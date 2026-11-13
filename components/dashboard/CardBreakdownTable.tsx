"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { CurrencyCell } from "@/components/ui/currency-cell";
import { formatMonthShort, formatMXN } from "@/lib/utils/formatters";

interface CardAccount { id: string; name: string; bank: string }

interface CardBreakdownTableProps {
  years: string[];
  currentYear: string;
  currentMonth: string;
  accounts: CardAccount[];
  matrixByYear: Record<string, Record<string, Record<string, number>>>;
}

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

export function CardBreakdownTable({
  years,
  currentMonth,
  accounts,
  matrixByYear,
}: CardBreakdownTableProps) {
  const cardCols: Column<Record<string, unknown>>[] = accounts.map((acc) => ({
    key: acc.id,
    header: acc.name,
    align: "right" as const,
    render: (v, row) => {
      const isFuture = (row.month as string) > currentMonth;
      return (
        <span className={isFuture ? "italic text-[var(--color-muted)]" : ""}>
          <CurrencyCell amount={Number(v)} dimIfZero />
        </span>
      );
    },
  }));

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "month",
      header: "Mes",
      render: (v) => (
        <span className="font-medium capitalize">{formatMonthShort(String(v))}</span>
      ),
    },
    ...cardCols,
    {
      key: "_total",
      header: "Total",
      align: "right",
      render: (v, row) => {
        const isFuture = (row.month as string) > currentMonth;
        return (
          <span className={isFuture ? "italic" : ""}>
            <CurrencyCell amount={Number(v)} />
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      {years.map((year) => {
        const matrix = matrixByYear[year] ?? {};
        const rows = MONTHS.map((m) => {
          const monthStr  = `${year}-${m}`;
          const monthData = matrix[monthStr] ?? {};
          const total     = accounts.reduce((s, acc) => s + (monthData[acc.id] ?? 0), 0);
          const row: Record<string, unknown> = { month: monthStr, _total: total };
          for (const acc of accounts) row[acc.id] = monthData[acc.id] ?? 0;
          return row;
        });

        const yearTotal = rows.reduce((s, r) => s + Number(r._total), 0);

        const footerRow: Record<string, React.ReactNode> = {
          month:  <span className="text-[var(--color-muted)]">Total {year}</span>,
          _total: <CurrencyCell amount={yearTotal} />,
        };
        for (const acc of accounts) {
          footerRow[acc.id] = (
            <CurrencyCell amount={rows.reduce((s, r) => s + Number(r[acc.id] ?? 0), 0)} />
          );
        }

        return (
          <div key={year} className="space-y-3">
            {/* Header de año — mismo estilo que FlowContent */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">{year}</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-muted)]">Total</span>
                <span className="text-sm font-semibold text-[var(--color-foreground)]">
                  {formatMXN(yearTotal)}
                </span>
              </div>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              footerRow={footerRow}
              highlightRow={(row) => {
                const m = row.month as string;
                if (m === currentMonth) return "current";
                if (m > currentMonth)   return "projected";
                return null;
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
