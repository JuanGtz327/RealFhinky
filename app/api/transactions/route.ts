import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { z } from "zod";

const CreateTransactionSchema = z.object({
  account_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
  category: z.string().optional(),
  type: z.enum(["purchase", "income", "transfer_in", "transfer_out"]),
  is_msi: z.boolean().optional(),
  msi_months: z.number().int().min(2).max(60).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    const month = searchParams.get("month");
    const limit = Number(searchParams.get("limit") ?? 100);
    const offset = Number(searchParams.get("offset") ?? 0);

    const repo = new TransactionsRepository(getDb());

    let transactions;
    if (accountId) {
      transactions = repo.findByAccount(accountId, limit, offset);
    } else if (month) {
      transactions = repo.findByMonth(month);
    } else {
      transactions = repo.findAll(limit, offset);
    }

    return NextResponse.json({ transactions });
  } catch {
    return NextResponse.json({ error: "Error al obtener transacciones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new TransactionsRepository(getDb());
    const transaction = repo.create(parsed.data);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear transacción";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
