import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import type { IncomeEntry } from "@/lib/types";
import { z } from "zod";

const UpdateEntrySchema = z.object({
  amount: z.number().positive().optional(),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:  z.string().optional(),
});

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repo = new IncomeRepository(getDb());
    repo.deleteEntry(params.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Error al eliminar entrada" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body   = await req.json();
    const parsed = UpdateEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = getDb();

    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.amount !== undefined) { fields.push("amount = ?"); values.push(parsed.data.amount); }
    if (parsed.data.date   !== undefined) { fields.push("date = ?");   values.push(parsed.data.date); }
    if (parsed.data.notes  !== undefined) { fields.push("notes = ?");  values.push(parsed.data.notes); }

    if (fields.length > 0) {
      values.push(params.id);
      db.execute(`UPDATE income_entries SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const rows = db.query<IncomeEntry>("SELECT * FROM income_entries WHERE id = ?", [params.id]);
    if (!rows[0]) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
    return NextResponse.json({ entry: rows[0] });
  } catch {
    return NextResponse.json({ error: "Error al actualizar entrada" }, { status: 500 });
  }
}
