import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PlannedTransfersRepository } from "@/lib/repositories/planned-transfers.repo";

export async function GET(req: NextRequest) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  const accountId = req.nextUrl.searchParams.get("account_id");
  const transfers = accountId ? repo.findByAccount(accountId) : repo.findAll();
  return NextResponse.json({ transfers });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const repo = new PlannedTransfersRepository(db);
  const body = await req.json();
  const transfer = repo.create(body);
  return NextResponse.json({ transfer }, { status: 201 });
}
