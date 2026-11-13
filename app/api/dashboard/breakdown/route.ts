import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ?? new Date().getFullYear().toString();
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo = new TransactionsRepository(db);
    const msiRepo = new MsiRepository(db);

    const creditAccounts = accRepo.findByType("credit");
    const currentMonth = format(new Date(), "yyyy-MM");

    // Construir matriz año × mes × tarjeta
    const matrix: Record<string, Record<string, number>> = {};

    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, "0")}`;
      matrix[monthStr] = {};

      for (const acc of creditAccounts) {
        const isPast = monthStr < currentMonth;
        const isCurrent = monthStr === currentMonth;

        if (isPast || isCurrent) {
          // Real: compras registradas
          matrix[monthStr][acc.id] = txRepo.sumByAccountAndMonth(acc.id, monthStr);
        } else {
          // Futuro: solo cuotas MSI comprometidas
          matrix[monthStr][acc.id] = msiRepo.sumByAccountAndMonth(acc.id, monthStr);
        }
      }
    }

    return NextResponse.json({
      year,
      currentMonth,
      accounts: creditAccounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank })),
      matrix,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
