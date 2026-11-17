import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { FlowAdjustmentsRepository } from "@/lib/repositories/flow-adjustments.repo";
import { z } from "zod";

const CreateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  type: z.enum(["expense", "income"]).default("expense"),
  description: z.string().min(1).max(100),
  amount: z.number().positive(),
});

export async function GET(req: NextRequest) {
  try {
    const month = new URL(req.url).searchParams.get("month");
    if (!month) return NextResponse.json({ error: "month requerido" }, { status: 400 });
    const repo = new FlowAdjustmentsRepository(getDb());
    return NextResponse.json({ adjustments: repo.findByMonth(month) });
  } catch {
    return NextResponse.json({ error: "Error al obtener ajustes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const repo = new FlowAdjustmentsRepository(getDb());
    const adjustment = repo.create(parsed.data);
    return NextResponse.json({ adjustment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear ajuste" }, { status: 500 });
  }
}
