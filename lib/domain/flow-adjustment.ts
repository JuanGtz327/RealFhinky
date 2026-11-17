import type { Account, Transaction } from "@/lib/types";

/**
 * Derives the untracked debt for a credit account: the gap between what the bank
 * reports (current_balance) and what Finkhy can account for (direct purchases +
 * pending MSI). This equals opening_balance_carryover + any reconciliation diff.
 * Returns 0 if Finkhy's view already meets or exceeds the bank balance.
 */
export function computeUntrackedDebt(
  account: Account,
  allTransactions: Transaction[],
  pendingMsiTotal: number
): number {
  const directDebt = allTransactions.reduce((s, tx) => {
    if (tx.type === "purchase" && !tx.is_msi) return s + tx.amount;
    if (tx.type === "transfer_in") return s - tx.amount;
    return s;
  }, 0);
  const untracked = account.current_balance - (directDebt + pendingMsiTotal);
  return Math.max(0, untracked);
}
