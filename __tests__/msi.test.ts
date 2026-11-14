import { expandMsi, getMsiProgress } from "@/lib/utils/msi";

describe("expandMsi", () => {
  it("distribuye correctamente una compra divisible exacta", () => {
    const result = expandMsi(1200, 12, "2025-01-01");
    expect(result.monthlyAmount).toBe(100);
    expect(result.residual).toBe(0);
    expect(result.installments).toHaveLength(12);
    expect(result.installments[11].isLast).toBe(true);
    const total = result.installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBeCloseTo(1200, 2);
  });

  it("calcula residual cuando no es divisible — redondea a 2 decimales", () => {
    // 1250 / 12 = 104.1666… → base = 104.17, último absorbe el ajuste de redondeo
    const result = expandMsi(1250, 12, "2025-01-01");
    expect(result.monthlyAmount).toBeCloseTo(104.17, 2);
    // El total siempre debe cuadrar exacto
    const total = result.installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBeCloseTo(1250, 2);
    // La diferencia máxima entre el último mes y el resto es (meses-1) × 0.005
    const base = result.installments[0].amount;
    const last = result.installments[11].amount;
    expect(Math.abs(last - base)).toBeLessThanOrEqual(12 * 0.005);
  });

  it("asigna el residual al último mes", () => {
    const result = expandMsi(999.99, 3, "2025-01-01");
    const total = result.installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBeCloseTo(999.99, 2);
    expect(result.installments[2].isLast).toBe(true);
  });

  it("genera los meses correctos a partir de la fecha de inicio", () => {
    const result = expandMsi(300, 3, "2025-01-15");
    expect(result.installments[0].month).toBe("2025-01");
    expect(result.installments[1].month).toBe("2025-02");
    expect(result.installments[2].month).toBe("2025-03");
  });

  it("lanza error si meses es 1 o menos", () => {
    expect(() => expandMsi(1000, 1)).toThrow();
    expect(() => expandMsi(1000, 0)).toThrow();
  });

  it("lanza error si monto es 0 o negativo", () => {
    expect(() => expandMsi(0, 12)).toThrow();
    expect(() => expandMsi(-100, 12)).toThrow();
  });
});

describe("getMsiProgress", () => {
  it("calcula pagadas y restantes correctamente", () => {
    const result = getMsiProgress("2025-01", 12, "2025-04");
    expect(result.paid).toBe(3);
    expect(result.remaining).toBe(9);
    expect(result.total).toBe(12);
  });

  it("retorna 0 pagadas si estamos en el mes de inicio", () => {
    const result = getMsiProgress("2025-06", 6, "2025-06");
    expect(result.paid).toBe(0);
    expect(result.remaining).toBe(6);
  });

  it("retorna 0 restantes si ya terminó el plan", () => {
    const result = getMsiProgress("2024-01", 6, "2025-06");
    expect(result.remaining).toBe(0);
    expect(result.paid).toBe(6);
  });
});
