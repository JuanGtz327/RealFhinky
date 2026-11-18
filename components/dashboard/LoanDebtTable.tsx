"use client";

import { formatMXN } from "@/lib/utils/formatters";
import { Landmark, ChevronRight } from "lucide-react";
import Link from "next/link";

interface LoanRow {
  id: string;
  name: string;
  bank: string;
  current_balance: number;
  loan_monthly_payment?: number;
  loan_interest_rate?: number;
  loan_term_months?: number;
  loan_payments_made?: number;
}

interface Props {
  loans: LoanRow[];
}

export function LoanDebtTable({ loans }: Props) {
  if (loans.length === 0) return null;

  return (
    <div className="space-y-3">
      {loans.map((loan) => {
        const totalPayments = loan.loan_term_months ?? 0;
        const madePayments  = loan.loan_payments_made ?? 0;
        const pct = totalPayments > 0 ? Math.min((madePayments / totalPayments) * 100, 100) : 0;

        return (
          <Link
            key={loan.id}
            href={`/accounts/${loan.id}`}
            className="group border border-[var(--color-border)] bg-[var(--color-surface)] card-lift min-h-24 flex items-center gap-4 px-4 py-4 hover:border-[var(--color-accent)]/40 transition-colors"
          >
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--color-navbar)]/8 group-hover:bg-[var(--color-accent)]/10 transition-colors">
              <Landmark className="w-4 h-4 text-[var(--color-navbar)] group-hover:text-[var(--color-accent)] transition-colors" />
            </div>

            {/* Name + progress */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">{loan.name}</p>
              <p className="text-xs text-[var(--color-muted)] mb-1.5">{loan.bank}</p>
              {totalPayments > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[var(--color-border)]">
                    <div
                      className="h-1 bg-[var(--color-accent)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-muted)] shrink-0 tabular-nums">
                    {madePayments}/{totalPayments}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="text-xs text-[var(--color-muted)]">Saldo</p>
                <p className="text-sm font-bold font-mono text-[var(--color-danger)]">
                  {formatMXN(loan.current_balance)}
                </p>
              </div>
              {loan.loan_monthly_payment ? (
                <div className="text-right">
                  <p className="text-xs text-[var(--color-muted)]">Mensualidad</p>
                  <p className="text-sm font-semibold font-mono text-[var(--color-foreground)]">
                    {formatMXN(loan.loan_monthly_payment)}
                  </p>
                </div>
              ) : null}
              {loan.loan_interest_rate != null ? (
                <div className="text-right">
                  <p className="text-xs text-[var(--color-muted)]">Tasa</p>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">
                    {loan.loan_interest_rate}%
                  </p>
                </div>
              ) : null}
              <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
