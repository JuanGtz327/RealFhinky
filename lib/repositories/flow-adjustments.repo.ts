import { randomUUID } from "crypto";
import { IDatabase } from "@/lib/db/adapter";
import { FlowAdjustment } from "@/lib/types";

export class FlowAdjustmentsRepository {
  constructor(private db: IDatabase) {}

  findByMonth(month: string): FlowAdjustment[] {
    return this.db.query<FlowAdjustment>(
      "SELECT * FROM flow_adjustments WHERE month = ? ORDER BY created_at",
      [month]
    );
  }

  findByMonthAndType(month: string, type: "expense" | "income"): FlowAdjustment[] {
    return this.db.query<FlowAdjustment>(
      "SELECT * FROM flow_adjustments WHERE month = ? AND type = ? ORDER BY created_at",
      [month, type]
    );
  }

  create(input: { month: string; type: "expense" | "income"; description: string; amount: number }): FlowAdjustment {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.execute(
      "INSERT INTO flow_adjustments (id, month, type, description, amount, created_at) VALUES (?,?,?,?,?,?)",
      [id, input.month, input.type, input.description, input.amount, now]
    );
    return this.db.query<FlowAdjustment>(
      "SELECT * FROM flow_adjustments WHERE id = ?", [id]
    )[0];
  }

  delete(id: string): void {
    this.db.execute("DELETE FROM flow_adjustments WHERE id = ?", [id]);
  }
}
