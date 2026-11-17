import { computePaymentStatus, computeCycleAmountDue } from "@/lib/domain/payments";
import type { CyclePayment } from "@/lib/types";

const makePayment = (overrides: Partial<CyclePayment> = {}): CyclePayment => ({
  id: "pay-1",
  account_id: "acc-1",
  cycle_month: "2026-11",
  amount_due: 5000,
  amount_paid: 5000,
  paid_date: "2026-11-25",
  created_at: "2026-11-25T12:00:00.000Z",
  ...overrides,
});

describe("computePaymentStatus", () => {
  it("sin pago retorna pending con remaining = amountDue", () => {
    const result = computePaymentStatus(null, 3000);
    expect(result.status).toBe("pending");
    expect(result.amountDue).toBe(3000);
    expect(result.amountPaid).toBe(0);
    expect(result.remaining).toBe(3000);
  });

  it("sin pago (undefined) retorna pending", () => {
    const result = computePaymentStatus(undefined, 1500);
    expect(result.status).toBe("pending");
    expect(result.remaining).toBe(1500);
  });

  it("pago total exacto retorna paid con remaining = 0", () => {
    const payment = makePayment({ amount_due: 5000, amount_paid: 5000 });
    const result = computePaymentStatus(payment, 5000);
    expect(result.status).toBe("paid");
    expect(result.remaining).toBe(0);
  });

  it("pago mayor al adeudado retorna paid con remaining = 0", () => {
    const payment = makePayment({ amount_due: 5000, amount_paid: 6000 });
    const result = computePaymentStatus(payment, 5000);
    expect(result.status).toBe("paid");
    expect(result.remaining).toBe(0);
  });

  it("pago parcial retorna partial con remaining correcto", () => {
    const payment = makePayment({ amount_due: 5000, amount_paid: 2000 });
    const result = computePaymentStatus(payment, 5000);
    expect(result.status).toBe("partial");
    expect(result.amountPaid).toBe(2000);
    expect(result.remaining).toBe(3000);
  });

  it("pago mínimo retorna partial", () => {
    const payment = makePayment({ amount_due: 10000, amount_paid: 1 });
    const result = computePaymentStatus(payment, 10000);
    expect(result.status).toBe("partial");
    expect(result.remaining).toBe(9999);
  });

  it("usa amount_due del pago guardado, no el amountDue externo", () => {
    // Si el saldo cambió después de confirmar, el snapshot es el que manda
    const payment = makePayment({ amount_due: 4000, amount_paid: 4000 });
    const result = computePaymentStatus(payment, 5000); // 5000 es un recálculo posterior
    expect(result.amountDue).toBe(4000); // usa el snapshot
    expect(result.status).toBe("paid");
  });
});

describe("computeCycleAmountDue", () => {
  it("solo MSI sin directos ni créditos", () => {
    expect(computeCycleAmountDue(2000, 0, 0)).toBe(2000);
  });

  it("solo compras directas", () => {
    expect(computeCycleAmountDue(0, 1500, 0)).toBe(1500);
  });

  it("MSI + directos sin créditos", () => {
    expect(computeCycleAmountDue(1000, 500, 0)).toBe(1500);
  });

  it("MSI + directos con créditos (abonos)", () => {
    expect(computeCycleAmountDue(1000, 500, 300)).toBe(1200);
  });

  it("créditos mayores que cargos retorna 0 (no negativo)", () => {
    expect(computeCycleAmountDue(0, 500, 1000)).toBe(0);
  });

  it("todo en cero retorna cero", () => {
    expect(computeCycleAmountDue(0, 0, 0)).toBe(0);
  });
});
