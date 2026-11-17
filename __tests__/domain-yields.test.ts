import { computeDebitSummary } from "@/lib/domain/yields";
import { ACCOUNTS } from "./fixtures/dataset";

const debitAccounts = ACCOUNTS.filter((a) => a.type === "debit" || a.type === "investment");

describe("computeDebitSummary", () => {
  it("calcula proyección anual correcta (yield_rate × capital)", () => {
    const { accounts } = computeDebitSummary(debitAccounts);
    const gbm = accounts.find((a) => a.id === "invest-1")!;
    // 100 000 × 10% = 10 000
    expect(gbm.annual_projection).toBeCloseTo(10000, 2);
  });

  it("calcula proyección diaria correcta (anual / 365)", () => {
    const { accounts } = computeDebitSummary(debitAccounts);
    const gbm = accounts.find((a) => a.id === "invest-1")!;
    expect(gbm.daily_projection).toBeCloseTo(10000 / 365, 4);
  });

  it("cuenta sin rendimiento tiene projection = 0", () => {
    const { accounts } = computeDebitSummary(debitAccounts);
    const bbva = accounts.find((a) => a.id === "debit-1")!;
    expect(bbva.annual_projection).toBe(0);
    expect(bbva.daily_projection).toBe(0);
  });

  it("totals suma correctamente el capital de todas las cuentas", () => {
    const { totals } = computeDebitSummary(debitAccounts);
    expect(totals.capital).toBe(150000); // 50 000 + 100 000
  });

  it("totals.annual_projection = suma de proyecciones individuales", () => {
    const { accounts, totals } = computeDebitSummary(debitAccounts);
    const sum = accounts.reduce((s, a) => s + a.annual_projection, 0);
    expect(totals.annual_projection).toBeCloseTo(sum, 6);
  });

  it("lista vacía retorna totals en cero", () => {
    const { totals } = computeDebitSummary([]);
    expect(totals.capital).toBe(0);
    expect(totals.annual_projection).toBe(0);
  });
});
