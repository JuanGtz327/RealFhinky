import type { Account } from "@/lib/types";
import type { AccountKpis } from "./types";

export function computeAccountKpis(accounts: Account[]): AccountKpis {
  const capital = accounts.filter((a) => a.type === "debit" || a.type === "investment");
  const credit  = accounts.filter((a) => a.type === "credit");
  const loans   = accounts.filter((a) => a.type === "loan");
  const debt    = [...credit, ...loans];
  return {
    totalCapital:        capital.reduce((s, a) => s + a.current_balance, 0),
    totalDeuda:          debt.reduce((s, a) => s + a.current_balance, 0),
    totalDisponible:     debt.reduce((s, a) => s + ((a.credit_limit ?? 0) - a.current_balance), 0),
    totalDeudaTarjetas:  credit.reduce((s, a) => s + a.current_balance, 0),
    totalDeudaPrestamos: loans.reduce((s, a) => s + a.current_balance, 0),
  };
}
