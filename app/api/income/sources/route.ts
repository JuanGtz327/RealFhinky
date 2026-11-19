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
  custom_interval_days: z.number().int().min(1).optional(),
  account_id: z.string().optional().nullable(),
}).refine(
  (d) => d.frequency !== "custom" || (d.custom_interval_days != null && d.custom_interval_days >= 1),
  { message: "Frecuencia personalizada requiere especificar el intervalo en días", path: ["custom_interval_days"] }
);

export async function GET() {
  try {
    const repo = new IncomeRepository(getDb());
    const sources = repo.findAllSources();
    return NextResponse.json({ sources });
  } catch {
    return NextResponse.json({ error: "Error al obtener fuentes de ingreso" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = z.string().min(1).safeParse(body?.id);
    if (!id.success) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const parsed = CreateSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const repo = new IncomeRepository(getDb());
    const source = repo.updateSource(id.data, data);
    if (!source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ error: "Error al actualizar fuente de ingreso" }, { status: 500 });
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
