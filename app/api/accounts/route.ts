import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { z } from "zod";

const CreateAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["credit", "debit", "loan", "investment"]),
  bank: z.string().min(1),
  last4: z.string().length(4).optional(),
  credit_limit: z.number().positive().optional(),
  current_balance: z.number().optional(),
  yield_rate: z.number().min(0).optional(),
  cut_date: z.number().int().min(1).max(31).optional(),
  payment_due_date: z.number().int().min(1).max(31).optional(),
  annual_fee: z.number().min(0).optional(),
  annual_fee_date: z.string().optional(),
});

export async function GET() {
  try {
    const repo = new AccountsRepository(getDb());
    const accounts = repo.findAll();
    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ error: "Error al obtener cuentas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new AccountsRepository(getDb());
    const account = repo.create(parsed.data);
    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear cuenta" }, { status: 500 });
  }
}
