"use client";

import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export type ColumnAlign = "left" | "right" | "center";

export interface Column<T> {
  key: string;
  header: string;
  align?: ColumnAlign;
  className?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  footerRow?: Partial<Record<string, React.ReactNode>>;
  highlightRow?: (row: T) => "current" | "projected" | "negative" | null;
  emptyMessage?: string;
  className?: string;
}

const alignClass: Record<ColumnAlign, string> = {
  left:   "text-left",
  right:  "text-right",
  center: "text-center",
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  footerRow,
  highlightRow,
  emptyMessage = "Sin datos",
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn(
      "rounded-lg border border-[var(--color-border)] card-elevated overflow-hidden",
      className
    )}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface)]">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide",
                  alignClass[col.align ?? "left"],
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-4 py-8 text-center text-[var(--color-muted)]">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => {
              const highlight = highlightRow?.(row);
              return (
                <TableRow
                  key={i}
                  className={cn(
                    "border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)] transition-colors",
                    highlight === "current" && "bg-[var(--color-accent)]/5 border-l-4 border-l-[var(--color-accent)]",
                    highlight === "projected" && "opacity-50 italic",
                    highlight === "negative" && "bg-[var(--color-danger)]/5",
                  )}
                >
                  {columns.map((col, ci) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-4 py-3 border-r border-[var(--color-border)]/50 last:border-r-0",
                        alignClass[col.align ?? "left"],
                        col.className,
                        highlight === "current" && ci === 0
                          ? "font-bold text-[var(--color-accent)]"
                          : "text-[var(--color-foreground)]"
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>

        {footerRow && (
          <TableFooter className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <TableRow className="hover:bg-[var(--color-surface)]">
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-semibold text-[var(--color-foreground)] border-r border-[var(--color-border)] last:border-r-0",
                    alignClass[col.align ?? "left"],
                    col.className
                  )}
                >
                  {footerRow[col.key] ?? null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
