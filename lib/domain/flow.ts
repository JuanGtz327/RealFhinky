import { calcVariation } from "@/lib/utils/formatters";
import type { AccountsRepository } from "@/lib/repositories/accounts.repo";
import type { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import type { IncomeRepository } from "@/lib/repositories/income.repo";
import type { MsiRepository } from "@/lib/repositories/msi.repo";
import type { FlowRow, LoanColumn } from "./types";

export interface FlowData {
  rows: FlowRow[];
  loanColumns: LoanColumn[];
}

export function computeFlowRows(
  year: string,
  repos: {
    accRepo: AccountsRepository;
    txRepo: TransactionsRepository;
    incRepo: IncomeRepository;
    msiRepo: MsiRepository;
  }
): FlowData {
  const { accRepo, txRepo, incRepo, msiRepo } = repos;
  const loanAccounts   = accRepo.findByType("loan");
  const creditAccounts = accRepo.findByType("credit");
  const debitAccounts  = accRepo.findByType("debit");

  const rows: FlowRow[] = [];
  let prevCapitalFin = 0;

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, "0")}`;

    // Nómina: income entries from income_sources
    const allIncome = incRepo.findEntriesByMonth(monthStr);
    const nomina = allIncome.reduce((s, e) => s + e.amount, 0);

    // Abonos: income-type transactions on debit accounts (external deposits, not transfers)
    // Transferencias: transfer_out on debit shown for reference but neutral in flow
    let abonos = 0;
    let transferencias = 0;
    for (const acc of debitAccounts) {
      const txs = txRepo.findByAccount(acc.id).filter((t) => t.date.startsWith(monthStr));
      abonos        += txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      transferencias += txs.filter((t) => t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
    }

    // Tarjetas: credit purchases (non-MSI) + MSI installments
    let tarjetas = 0;
    for (const acc of creditAccounts) {
      tarjetas += txRepo.sumByAccountAndMonth(acc.id, monthStr);
      tarjetas += msiRepo.sumByAccountAndMonth(acc.id, monthStr);
    }

    // Préstamos dinámicos
    const loans = loanAccounts.map((acc) => ({
      account_id: acc.id,
      name: acc.name,
      amount: txRepo.sumByAccountAndMonth(acc.id, monthStr),
    }));
    const loansTotal = loans.reduce((s, l) => s + l.amount, 0);

    // Only income + purchase count; transfer_* are neutral
    const ingresos_totales = nomina + abonos;
    const gastos_totales   = tarjetas + loansTotal;
    const capital_inicio   = prevCapitalFin;
    const capital_fin      = capital_inicio + ingresos_totales - gastos_totales;

    rows.push({
      month: monthStr, capital_inicio, nomina, abonos, ingresos_totales,
      transferencias, tarjetas, loans, gastos_totales, capital_fin,
      variacion: calcVariation(capital_inicio, capital_fin),
    });
    prevCapitalFin = capital_fin;
  }

  return {
    rows,
    loanColumns: loanAccounts.map((a) => ({ id: a.id, name: a.name })),
  };
}
