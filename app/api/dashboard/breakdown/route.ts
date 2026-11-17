import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { computeBreakdownMatrix } from "@/lib/domain";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ?? new Date().getFullYear().toString();
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo  = new TransactionsRepository(db);
    const msiRepo = new MsiRepository(db);

    const currentMonth = format(new Date(), "yyyy-MM");
    const { matrix, accounts } = computeBreakdownMatrix(year, { accRepo, txRepo, msiRepo });

    return NextResponse.json({ year, currentMonth, accounts, matrix });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
