import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { z } from "zod";

const UpdateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchant: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  type: z.enum(["purchase", "income", "transfer_in", "transfer_out"]).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new TransactionsRepository(getDb());
    const transaction = repo.findById(params.id);
    if (!transaction) return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json({ error: "Error al obtener transacción" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = UpdateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new TransactionsRepository(getDb());
    const transaction = repo.update(params.id, parsed.data);
    if (!transaction) return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json({ error: "Error al actualizar transacción" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new TransactionsRepository(getDb());
    const tx = repo.findById(params.id);
    if (!tx) return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
    repo.delete(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar transacción" }, { status: 500 });
  }
}
