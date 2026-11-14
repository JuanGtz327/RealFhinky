import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      accounts: db.query("SELECT * FROM accounts"),
      transactions: db.query("SELECT * FROM transactions"),
      msi_installments: db.query("SELECT * FROM msi_installments"),
      income_sources: db.query("SELECT * FROM income_sources"),
      income_entries: db.query("SELECT * FROM income_entries"),
      preferences: db.query("SELECT * FROM user_preferences"),
    };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error al exportar datos" }, { status: 500 });
  }
}
