import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { z } from "zod";

const UpdateCyclePaymentSchema = z.object({
  amount_paid: z.number().positive().optional(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = UpdateCyclePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new CyclePaymentsRepository(getDb());
    const payment = repo.update(params.id, parsed.data);
    return NextResponse.json({ payment });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al actualizar pago";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new CyclePaymentsRepository(getDb());
    repo.delete(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar pago" }, { status: 500 });
  }
}
