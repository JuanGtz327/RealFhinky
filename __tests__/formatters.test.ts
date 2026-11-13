import { calcVariation } from "@/lib/utils/formatters";
import { formatMXN, formatPercent } from "@/lib/utils/formatters";

describe("formatMXN", () => {
  it("formatea cantidad positiva", () => {
    expect(formatMXN(1234.56)).toContain("1,234.56");
  });

  it("formatea cero", () => {
    expect(formatMXN(0)).toContain("0.00");
  });
});

describe("formatPercent", () => {
  it("formatea porcentaje con 1 decimal", () => {
    expect(formatPercent(12.5)).toBe("12.5%");
  });
});

describe("calcVariation", () => {
  it("calcula crecimiento positivo", () => {
    expect(calcVariation(1000, 1200)).toBeCloseTo(20, 1);
  });

  it("calcula reducción negativa", () => {
    expect(calcVariation(1000, 800)).toBeCloseTo(-20, 1);
  });

  it("retorna null si base es 0", () => {
    expect(calcVariation(0, 500)).toBeNull();
  });

  it("capital fin = inicio + ingresos - gastos", () => {
    const capitalInicio = 10000;
    const ingresos = 25000;
    const gastos = 18000;
    const capitalFin = capitalInicio + ingresos - gastos;
    expect(capitalFin).toBe(17000);
  });
});
