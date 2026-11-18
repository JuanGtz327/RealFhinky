import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const repo = new RecurringChargesRepository(db);
  const body = await req.json();
  const charge = repo.update(params.id, body);
  if (!charge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ charge });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const repo = new RecurringChargesRepository(db);
  repo.delete(params.id);
  return NextResponse.json({ ok: true });
}
