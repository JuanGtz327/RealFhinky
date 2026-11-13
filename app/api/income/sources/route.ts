import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { IncomeRepository } from "@/lib/repositories/income.repo";
import { z } from "zod";

const CreateSourceSchema = z.object({
  name: z.string().min(1),
  frequency: z.enum(["weekly", "biweekly", "monthly", "custom"]),
  base_amount: z.number().min(0),
  is_variable: z.boolean().optional(),
  start_date: z.string().optional(),
});

export async function GET() {
  try {
    const repo = new IncomeRepository(getDb());
    const sources = repo.findAllSources();
    return NextResponse.json({ sources });
  } catch {
    return NextResponse.json({ error: "Error al obtener fuentes de ingreso" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new IncomeRepository(getDb());
    const source = repo.createSource(parsed.data);
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear fuente de ingreso" }, { status: 500 });
  }
}
