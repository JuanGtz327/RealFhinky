import type { Account } from "@/lib/types";
import type { DebitAccountSummary, DebitTotals } from "./types";

export function computeDebitSummary(accounts: Account[]): { accounts: DebitAccountSummary[]; totals: DebitTotals } {
  const mapped: DebitAccountSummary[] = accounts.map((acc) => {
    const annual = acc.current_balance * ((acc.yield_rate ?? 0) / 100);
    return {
      id: acc.id,
      name: acc.name,
      bank: acc.bank,
      capital: acc.current_balance,
      yield_rate: acc.yield_rate ?? 0,
      annual_projection: annual,
      daily_projection: annual / 365,
    };
  });
  return {
    accounts: mapped,
    totals: {
      capital: mapped.reduce((s, a) => s + a.capital, 0),
      annual_projection: mapped.reduce((s, a) => s + a.annual_projection, 0),
      daily_projection: mapped.reduce((s, a) => s + a.daily_projection, 0),
    },
  };
}
