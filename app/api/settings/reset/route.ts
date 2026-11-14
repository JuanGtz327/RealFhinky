import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    const db = getDb();
    db.transaction(() => {
      db.execute("DELETE FROM msi_installments");
      db.execute("DELETE FROM transactions");
      db.execute("DELETE FROM income_entries");
      db.execute("DELETE FROM income_sources");
      db.execute("DELETE FROM accounts");
      db.execute("DELETE FROM user_preferences");
    });
    return NextResponse.json({ message: "Datos eliminados correctamente" });
  } catch {
    return NextResponse.json({ error: "Error al resetear datos" }, { status: 500 });
  }
}
