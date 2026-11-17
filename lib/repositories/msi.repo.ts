import { IDatabase } from "@/lib/db/adapter";
import { MsiInstallment } from "@/lib/types";

export class MsiRepository {
  constructor(private db: IDatabase) {}

  findByMonth(yearMonth: string): MsiInstallment[] {
    return this.db
      .query<MsiInstallment>(
        "SELECT * FROM msi_installments WHERE month = ? ORDER BY account_id",
        [yearMonth]
      )
      .map(this.deserialize);
  }

  findByAccount(accountId: string): MsiInstallment[] {
    return this.db
      .query<MsiInstallment>(
        "SELECT * FROM msi_installments WHERE account_id = ? ORDER BY month",
        [accountId]
      )
      .map(this.deserialize);
  }

  findByTransaction(transactionId: string): MsiInstallment[] {
    return this.db
      .query<MsiInstallment>(
        "SELECT * FROM msi_installments WHERE transaction_id = ? ORDER BY month",
        [transactionId]
      )
      .map(this.deserialize);
  }

  sumByAccountAndMonth(accountId: string, yearMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM msi_installments WHERE account_id = ? AND month = ?",
      [accountId, yearMonth]
    );
    return rows[0]?.total ?? 0;
  }

  sumByMonth(yearMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM msi_installments WHERE month = ?",
      [yearMonth]
    );
    return rows[0]?.total ?? 0;
  }

  sumPendingFromMonth(accountId: string, fromMonth: string): number {
    const rows = this.db.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM msi_installments WHERE account_id = ? AND month >= ?",
      [accountId, fromMonth]
    );
    return rows[0]?.total ?? 0;
  }

  findActiveMsiByAccount(accountId: string, fromMonth: string): MsiInstallment[] {
    return this.db
      .query<MsiInstallment>(
        "SELECT * FROM msi_installments WHERE account_id = ? AND month >= ? ORDER BY month",
        [accountId, fromMonth]
      )
      .map(this.deserialize);
  }

  private deserialize(row: MsiInstallment): MsiInstallment {
    return { ...row, is_last: Boolean(row.is_last) };
  }
}
