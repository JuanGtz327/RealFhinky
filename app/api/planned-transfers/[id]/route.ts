import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PlannedTransfersRepository } from "@/lib/repositories/planned-transfers.repo";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  const body = await req.json();
  const transfer = repo.update(params.id, body);
  if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ transfer });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  repo.delete(params.id);
  return NextResponse.json({ ok: true });
}
