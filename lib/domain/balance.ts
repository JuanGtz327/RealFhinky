import type { TransactionType, Transaction, Account } from "@/lib/types";

export function balanceDelta(type: TransactionType, amount: number, accountType?: string): number {
  if (accountType === "credit" || accountType === "loan") {
    return type === "transfer_in" ? -amount : amount;
  }
  return (type === "transfer_in" || type === "income") ? amount : -amount;
}

export interface BalanceDiscrepancy {
  finkhyBalance: number;
  diff: number;
  level: "ok" | "warning";
}

export function computeBalanceDiscrepancy(
  account: Account,
  pendingMsiTotal: number,
  allTransactions: Transaction[]
): BalanceDiscrepancy {
  const directDebt = allTransactions.reduce((s, tx) => {
    if (tx.type === "purchase"    && !tx.is_msi) return s + tx.amount;
    if (tx.type === "transfer_in")               return s - tx.amount;
    return s;
  }, 0);
  const finkhyBalance = directDebt + pendingMsiTotal + (account.opening_balance_carryover ?? 0);
  const diff = account.current_balance - finkhyBalance;
  return { finkhyBalance, diff, level: Math.abs(diff) > 1 ? "warning" : "ok" };
}
