import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";

export async function GET(req: NextRequest) {
  const db = getDb();
  const repo = new RecurringChargesRepository(db);
  const accountId = req.nextUrl.searchParams.get("account_id");
  const charges = accountId ? repo.findByAccount(accountId) : repo.findAll();
  return NextResponse.json({ charges });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const repo = new RecurringChargesRepository(db);
  const body = await req.json();
  const charge = repo.create(body);
  return NextResponse.json({ charge }, { status: 201 });
}
