import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { z } from "zod";

const UpdateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["credit", "debit", "loan", "investment"]).optional(),
  bank: z.string().min(1).optional(),
  last4: z.string().length(4).optional(),
  credit_limit: z.number().positive().optional(),
  current_balance: z.number().optional(),
  yield_rate: z.number().min(0).optional(),
  cut_date: z.number().int().min(1).max(31).optional(),
  payment_due_date: z.number().int().min(1).max(31).optional(),
  annual_fee: z.number().min(0).optional(),
  annual_fee_date: z.string().optional(),
  is_active: z.boolean().optional(),
  loan_original_amount: z.number().positive().optional(),
  loan_interest_rate: z.number().min(0).optional(),
  loan_term_months: z.number().int().positive().optional(),
  loan_monthly_payment: z.number().positive().optional(),
  loan_start_date: z.string().optional(),
  loan_payments_made: z.number().int().min(0).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new AccountsRepository(getDb());
    const account = repo.findById(params.id);
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Error al obtener cuenta" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = UpdateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new AccountsRepository(getDb());
    const account = repo.update(params.id, parsed.data);
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Error al actualizar cuenta" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new AccountsRepository(getDb());
    const account = repo.findById(params.id);
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    repo.delete(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar cuenta" }, { status: 500 });
  }
}
