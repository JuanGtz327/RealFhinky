import { computeCreditUtilization, computeDebtSummary } from "@/lib/domain/credit";
import { ACCOUNTS } from "./fixtures/dataset";

describe("computeCreditUtilization", () => {
  it("retorna 0 cuando limit = 0", () => {
    expect(computeCreditUtilization(5000, 0)).toBe(0);
  });

  it("calcula porcentaje correctamente", () => {
    expect(computeCreditUtilization(15000, 50000)).toBeCloseTo(30, 4);
    expect(computeCreditUtilization(25000, 50000)).toBeCloseTo(50, 4);
    expect(computeCreditUtilization(40000, 50000)).toBeCloseTo(80, 4);
  });

  it("puede superar 100% (saldo > límite)", () => {
    expect(computeCreditUtilization(55000, 50000)).toBeCloseTo(110, 4);
  });
});

describe("computeDebtSummary", () => {
  const creditAccounts = ACCOUNTS.filter((a) => a.type === "credit" || a.type === "loan");

  it("nivel verde cuando utilización < 30%", () => {
    const summary = computeDebtSummary([ACCOUNTS.find((a) => a.id === "credit-1")!]);
    // 15 000 / 50 000 = 30% — exactamente en el umbral
    // getCreditUtilizationAlert: <30 → ok, 30-70 → warning, >70 → danger
    expect(summary[0].utilization_pct).toBeCloseTo(30, 1);
    expect(summary[0].utilization_level).toBe("warning");
  });

  it("nivel rojo cuando utilización > 70%", () => {
    const summary = computeDebtSummary([ACCOUNTS.find((a) => a.id === "credit-2")!]);
    // 38 000 / 50 000 = 76%
    expect(summary[0].utilization_level).toBe("danger");
  });

  it("calcula available = limit − balance", () => {
    const summary = computeDebtSummary([ACCOUNTS.find((a) => a.id === "credit-1")!]);
    expect(summary[0].available).toBe(35000); // 50 000 − 15 000
  });

  it("cuenta sin credit_limit tiene utilization_pct = 0", () => {
    const loan = ACCOUNTS.find((a) => a.id === "loan-1")!;
    // loan-1 tiene credit_limit = 150 000
    const summary = computeDebtSummary([loan]);
    expect(summary[0].utilization_pct).toBeCloseTo((80000 / 150000) * 100, 2);
  });

  it("mapea todos los campos correctamente", () => {
    const [a] = computeDebtSummary([ACCOUNTS.find((a) => a.id === "credit-1")!]);
    expect(a.id).toBe("credit-1");
    expect(a.credit_limit).toBe(50000);
    expect(a.current_balance).toBe(15000);
  });
});
