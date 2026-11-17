import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { computeFlowRows } from "@/lib/domain";

export type { FlowRow } from "@/lib/domain";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ?? new Date().getFullYear().toString();
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo  = new TransactionsRepository(db);
    const incRepo = new IncomeRepository(db);
    const msiRepo = new MsiRepository(db);

    const { rows, loanColumns } = computeFlowRows(year, { accRepo, txRepo, incRepo, msiRepo });

    return NextResponse.json({ year, rows, loan_columns: loanColumns });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
