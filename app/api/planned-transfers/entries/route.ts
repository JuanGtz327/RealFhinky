import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PlannedTransfersRepository } from "@/lib/repositories/planned-transfers.repo";

export async function GET(req: NextRequest) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  const transferId = req.nextUrl.searchParams.get("transfer_id");
  const month = req.nextUrl.searchParams.get("month");
  if (transferId && month) {
    const entries = repo.findEntriesByTransferAndMonth(transferId, month);
    return NextResponse.json({ entries });
  }
  if (month) {
    const entries = repo.findEntriesByMonth(month);
    return NextResponse.json({ entries });
  }
  return NextResponse.json({ entries: [] });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  const body = await req.json();
  const entry = repo.createEntry(body);
  return NextResponse.json({ entry }, { status: 201 });
}
