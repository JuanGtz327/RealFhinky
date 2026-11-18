import { formatMXN } from "@/lib/utils/formatters";
import { Landmark } from "lucide-react";
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
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-navbar)] text-white">
            <th className="px-4 py-2.5 text-left font-medium text-xs">Préstamo</th>
            <th className="px-4 py-2.5 text-left font-medium text-xs">Banco</th>
            <th className="px-4 py-2.5 text-right font-medium text-xs">Saldo</th>
            <th className="px-4 py-2.5 text-right font-medium text-xs">Mensualidad</th>
            <th className="px-4 py-2.5 text-right font-medium text-xs">Tasa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {loans.map((loan) => (
            <tr key={loan.id} className="bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-colors">
              <td className="px-4 py-3">
                <Link href={`/accounts/${loan.id}`} className="flex items-center gap-2 hover:text-[var(--color-accent)] transition-colors">
                  <Landmark className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                  <span className="font-medium text-[var(--color-foreground)]">{loan.name}</span>
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--color-muted)] text-xs">{loan.bank}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-danger)]">
                {formatMXN(loan.current_balance)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--color-foreground)]">
                {loan.loan_monthly_payment ? formatMXN(loan.loan_monthly_payment) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[var(--color-muted)] text-xs">
                {loan.loan_interest_rate != null ? `${loan.loan_interest_rate}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--color-navbar)] text-white font-semibold">
            <td colSpan={2} className="px-4 py-2.5 text-xs">Total préstamos</td>
            <td className="px-4 py-2.5 text-right font-mono text-xs">
              {formatMXN(loans.reduce((s, l) => s + l.current_balance, 0))}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
