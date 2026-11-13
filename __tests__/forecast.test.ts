import { generateForecast, projectIncomeForMonth, calcAvgMonthlyExpenses } from "@/lib/utils/forecast";
import { IncomeSource } from "@/lib/types";

const mockSource = (overrides: Partial<IncomeSource> = {}): IncomeSource => ({
  id: "1",
  name: "Nómina",
  frequency: "biweekly",
  base_amount: 15000,
  is_variable: false,
  is_active: true,
  created_at: "2025-01-01",
  ...overrides,
});

describe("projectIncomeForMonth", () => {
  it("mensual retorna base_amount", () => {
    const src = mockSource({ frequency: "monthly", base_amount: 20000 });
    expect(projectIncomeForMonth(src, "2025-06")).toBe(20000);
  });

  it("quincenal retorna base_amount * 2", () => {
    const src = mockSource({ frequency: "biweekly", base_amount: 15000 });
    expect(projectIncomeForMonth(src, "2025-06")).toBe(30000);
  });

  it("semanal retorna base_amount * 4", () => {
    const src = mockSource({ frequency: "weekly", base_amount: 5000 });
    expect(projectIncomeForMonth(src, "2025-06")).toBe(20000);
  });

  it("retorna 0 si fuente inactiva", () => {
    const src = mockSource({ is_active: false });
    expect(projectIncomeForMonth(src, "2025-06")).toBe(0);
  });

  it("retorna 0 si mes es antes de start_date", () => {
    const src = mockSource({ start_date: "2025-06-01" });
    expect(projectIncomeForMonth(src, "2025-05")).toBe(0);
  });
});

describe("generateForecast", () => {
  it("genera N meses de pronóstico", () => {
    const result = generateForecast({
      incomeSources: [mockSource()],
      monthlyMsiCommitments: {},
      avgMonthlyExpenses: 10000,
      startMonth: "2025-01",
      monthsAhead: 6,
    });
    expect(result).toHaveLength(6);
  });

  it("marca meses negativos correctamente", () => {
    const result = generateForecast({
      incomeSources: [mockSource({ frequency: "monthly", base_amount: 5000 })],
      monthlyMsiCommitments: {},
      avgMonthlyExpenses: 20000,
      startMonth: "2025-01",
      monthsAhead: 1,
    });
    expect(result[0].isNegative).toBe(true);
    expect(result[0].netFlow).toBeLessThan(0);
  });

  it("suma compromisos MSI en gastos estimados", () => {
    const result = generateForecast({
      incomeSources: [],
      monthlyMsiCommitments: { "2025-03": 3000 },
      avgMonthlyExpenses: 10000,
      startMonth: "2025-03",
      monthsAhead: 2,
    });
    const march = result.find((r) => r.month === "2025-03")!;
    expect(march.committedMsi).toBe(3000);
    expect(march.estimatedExpenses).toBe(13000);
  });
});

describe("calcAvgMonthlyExpenses", () => {
  it("promedia correctamente los últimos 3 meses", () => {
    expect(calcAvgMonthlyExpenses([1000, 2000, 3000, 4000, 5000], 3)).toBeCloseTo(4000, 1);
  });

  it("retorna 0 si no hay historial", () => {
    expect(calcAvgMonthlyExpenses([])).toBe(0);
  });
});
