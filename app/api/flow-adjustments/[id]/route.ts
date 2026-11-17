import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { FlowAdjustmentsRepository } from "@/lib/repositories/flow-adjustments.repo";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = new FlowAdjustmentsRepository(getDb());
    repo.delete(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar ajuste" }, { status: 500 });
  }
}
