import type { AccountsRepository } from "@/lib/repositories/accounts.repo";
import type { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import type { MsiRepository } from "@/lib/repositories/msi.repo";

export function computeBreakdownMatrix(
  year: string,
  repos: {
    accRepo: AccountsRepository;
    txRepo: TransactionsRepository;
    msiRepo: MsiRepository;
  }
): { matrix: Record<string, Record<string, number>>; accounts: { id: string; name: string; bank: string }[] } {
  const { accRepo, txRepo, msiRepo } = repos;
  const creditAccounts = accRepo.findByType("credit");
  const matrix: Record<string, Record<string, number>> = {};

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, "0")}`;
    matrix[monthStr] = {};
    for (const acc of creditAccounts) {
      matrix[monthStr][acc.id] = txRepo.sumByAccountAndMonth(acc.id, monthStr)
                                + msiRepo.sumByAccountAndMonth(acc.id, monthStr);
    }
  }

  return {
    matrix,
    accounts: creditAccounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank })),
  };
}
