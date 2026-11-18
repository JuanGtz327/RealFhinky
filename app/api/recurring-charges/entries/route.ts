import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { RecurringChargesRepository } from "@/lib/repositories/recurring-charges.repo";

export async function GET(req: NextRequest) {
  const db = getDb();
  const repo = new RecurringChargesRepository(db);
  const chargeId = req.nextUrl.searchParams.get("charge_id");
  const month = req.nextUrl.searchParams.get("month");
  if (chargeId && month) {
    const entries = repo.findEntriesByChargeAndMonth(chargeId, month);
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
  const repo = new RecurringChargesRepository(db);
  const body = await req.json();
  const entry = repo.createEntry(body);
  return NextResponse.json({ entry }, { status: 201 });
}
