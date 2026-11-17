import { getCreditUtilizationAlert } from "@/lib/utils/alerts";
import type { Account } from "@/lib/types";
import type { CreditAccountSummary } from "./types";

export function computeCreditUtilization(balance: number, limit: number): number {
  return limit > 0 ? (balance / limit) * 100 : 0;
}

export function computeDebtSummary(accounts: Account[]): CreditAccountSummary[] {
  return accounts.map((acc) => {
    const limit = acc.credit_limit ?? 0;
    const util  = computeCreditUtilization(acc.current_balance, limit);
    return {
      id: acc.id,
      name: acc.name,
      bank: acc.bank,
      credit_limit: limit,
      current_balance: acc.current_balance,
      available: limit - acc.current_balance,
      utilization_pct: util,
      utilization_level: getCreditUtilizationAlert(util),
    };
  });
}
