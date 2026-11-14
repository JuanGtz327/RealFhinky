import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";

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
    const result = seedDatabase(db);
    return NextResponse.json({ message: "Datos de ejemplo cargados", ...result });
  } catch {
    return NextResponse.json({ error: "Error al cargar datos de ejemplo" }, { status: 500 });
  }
}
