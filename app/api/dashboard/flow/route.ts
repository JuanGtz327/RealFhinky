import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { calcVariation } from "@/lib/utils/formatters";

export interface FlowRow {
  month: string;
  capital_inicio: number;
  nomina: number;
  abonos: number;
  ingresos_totales: number;
  transferencias: number;
  tarjetas: number;
  loans: { account_id: string; name: string; amount: number }[];
  gastos_totales: number;
  capital_fin: number;
  variacion: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ?? new Date().getFullYear().toString();
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo = new TransactionsRepository(db);
    const incomeRepo = new IncomeRepository(db);
    const msiRepo = new MsiRepository(db);

    const loanAccounts = accRepo.findByType("loan");
    const rows: FlowRow[] = [];
    let prevCapitalFin: number | null = null;

    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, "0")}`;

      // Ingresos: nómina (income entries marcadas como nómina) y abonos (transfer_in)
      const allIncome = incomeRepo.findEntriesByMonth(monthStr);
      const nomina = allIncome.reduce((s, e) => s + e.amount, 0);

      const debitAccounts = accRepo.findByType("debit");
      let abonos = 0;
      let transferencias = 0;
      for (const acc of debitAccounts) {
        const txs = txRepo.findByAccount(acc.id);
        const monthTxs = txs.filter((t) => t.date.startsWith(monthStr));
        abonos += monthTxs
          .filter((t) => t.type === "transfer_in")
          .reduce((s, t) => s + t.amount, 0);
        transferencias += monthTxs
          .filter((t) => t.type === "transfer_out")
          .reduce((s, t) => s + t.amount, 0);
      }

      // Tarjetas: compras reales en cuentas de crédito + MSI installments del mes
      const creditAccounts = accRepo.findByType("credit");
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

      const ingresos_totales = nomina + abonos;
      const gastos_totales = transferencias + tarjetas + loansTotal;
      const capital_inicio: number = prevCapitalFin ?? 0;
      const capital_fin: number = capital_inicio + ingresos_totales - gastos_totales;
      const variacion = calcVariation(capital_inicio, capital_fin);

      rows.push({
        month: monthStr,
        capital_inicio,
        nomina,
        abonos,
        ingresos_totales,
        transferencias,
        tarjetas,
        loans,
        gastos_totales,
        capital_fin,
        variacion,
      });

      prevCapitalFin = capital_fin;
    }

    return NextResponse.json({ year, rows, loan_columns: loanAccounts.map((a) => ({ id: a.id, name: a.name })) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
