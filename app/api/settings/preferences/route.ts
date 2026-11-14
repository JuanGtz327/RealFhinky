import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PreferencesRepository, DEFAULT_PREFERENCES } from "@/lib/repositories/preferences.repo";
import { z } from "zod";

const UpdateSchema = z.record(
  z.enum(Object.keys(DEFAULT_PREFERENCES) as [string, ...string[]]),
  z.string()
);

export async function GET() {
  try {
    const repo = new PreferencesRepository(getDb());
    return NextResponse.json({ preferences: repo.getWithDefaults() });
  } catch {
    return NextResponse.json({ error: "Error al obtener preferencias" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const repo = new PreferencesRepository(getDb());
    repo.setMany(parsed.data);
    return NextResponse.json({ preferences: repo.getWithDefaults() });
  } catch {
    return NextResponse.json({ error: "Error al actualizar preferencias" }, { status: 500 });
  }
}
