import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { z } from "zod";

const CreateCyclePaymentSchema = z.object({
  account_id: z.string().min(1),
  cycle_month: z.string().regex(/^\d{4}-\d{2}$/),
  amount_due: z.number().nonnegative(),
  amount_paid: z.number().positive(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) {
      return NextResponse.json({ error: "account_id requerido" }, { status: 400 });
    }
    const repo = new CyclePaymentsRepository(getDb());
    const payments = repo.findByAccount(accountId);
    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateCyclePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new CyclePaymentsRepository(getDb());
    const payment = repo.create(parsed.data);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al registrar pago";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
