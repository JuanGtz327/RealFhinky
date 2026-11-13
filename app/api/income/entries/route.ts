import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
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
    const month = searchParams.get("month");
    const sourceId = searchParams.get("source_id");
    const repo = new IncomeRepository(getDb());

    const entries = month
      ? repo.findEntriesByMonth(month)
      : sourceId
      ? repo.findEntriesBySource(sourceId)
      : [];

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
    const repo = new IncomeRepository(getDb());
    const entry = repo.createEntry(parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al registrar ingreso" }, { status: 500 });
  }
}
