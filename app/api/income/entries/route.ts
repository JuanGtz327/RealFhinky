import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { z } from "zod";

const CreateEntrySchema = z.object({
  income_source_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month    = searchParams.get("month");
    const sourceId = searchParams.get("source_id");
    const repo     = new IncomeRepository(getDb());

    if (sourceId && month) {
      const entries = repo.findEntriesBySourceAndMonth(sourceId, month);
      return NextResponse.json({ entries });
    }

    if (month && !sourceId) {
      const grouped  = repo.findEntriesByMonthGrouped(month);
      const bySource: Record<string, unknown[]> = {};
      for (const [id, arr] of grouped.entries()) {
        bySource[id] = arr;
      }
      return NextResponse.json({ bySource });
    }

    const entries = sourceId ? repo.findEntriesBySource(sourceId) : [];
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Error al obtener entradas de ingreso" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const incomeRepo = new IncomeRepository(db);
    const entry = incomeRepo.createEntry(parsed.data);

    let transactionCreated = false;

    const source = incomeRepo.findSourceById(parsed.data.income_source_id);
    if (source?.account_id) {
      const accountRepo = new AccountsRepository(db);
      const account = accountRepo.findById(source.account_id);

      if (account) {
        const paymentDate = parsed.data.date;
        const accountCreatedAt = account.created_at.slice(0, 10);
        const isRetroactive = paymentDate < accountCreatedAt;

        if (!isRetroactive) {
          const txRepo = new TransactionsRepository(db);
          txRepo.create({
            account_id: source.account_id,
            date: parsed.data.date,
            merchant: source.name,
            amount: parsed.data.amount,
            category: "Nómina",
            type: "income",
            income_entry_id: entry.id,
            notes: parsed.data.notes,
          });
          transactionCreated = true;
        }
      }
    }

    return NextResponse.json({ entry, transactionCreated }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al registrar ingreso" }, { status: 500 });
  }
}
