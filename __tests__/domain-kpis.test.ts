import { computeAccountKpis } from "@/lib/domain/kpis";
import { ACCOUNTS } from "./fixtures/dataset";

describe("computeAccountKpis", () => {
  it("totalCapital suma solo débito e inversión", () => {
    const { totalCapital } = computeAccountKpis(ACCOUNTS);
    // debit-1: 50 000 + invest-1: 100 000 = 150 000
    expect(totalCapital).toBe(150000);
  });

  it("totalDeuda suma solo crédito y préstamos", () => {
    const { totalDeuda } = computeAccountKpis(ACCOUNTS);
    // credit-1: 15 000 + credit-2: 38 000 + loan-1: 80 000 = 133 000
    expect(totalDeuda).toBe(133000);
  });

  it("totalDisponible = suma (límite − saldo) para crédito y préstamos", () => {
    const { totalDisponible } = computeAccountKpis(ACCOUNTS);
    // credit-1: 50 000 − 15 000 = 35 000
    // credit-2: 50 000 − 38 000 = 12 000
    // loan-1:  150 000 − 80 000 = 70 000
    // total = 117 000
    expect(totalDisponible).toBe(117000);
  });

  it("lista vacía retorna ceros", () => {
    const kpis = computeAccountKpis([]);
    expect(kpis.totalCapital).toBe(0);
    expect(kpis.totalDeuda).toBe(0);
    expect(kpis.totalDisponible).toBe(0);
  });

  it("solo cuentas débito: totalDeuda y totalDisponible son 0", () => {
    const debitOnly = ACCOUNTS.filter((a) => a.type === "debit");
    const { totalDeuda, totalDisponible } = computeAccountKpis(debitOnly);
    expect(totalDeuda).toBe(0);
    expect(totalDisponible).toBe(0);
  });

  it("cuenta crédito sin credit_limit: contribuye 0 a totalDisponible", () => {
    const { totalDisponible } = computeAccountKpis([{
      ...ACCOUNTS[2], credit_limit: undefined,
    }]);
    // (0 − 15000) = −15000 → no hay línea disponible
    expect(totalDisponible).toBe(-15000);
  });
});
