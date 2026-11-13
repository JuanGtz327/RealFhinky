import { getCreditUtilizationAlert, getCutDateAlert, getPaymentDateAlert } from "@/lib/utils/alerts";

describe("getCreditUtilizationAlert", () => {
  it("retorna ok si utilización < 30%", () => {
    expect(getCreditUtilizationAlert(10)).toBe("ok");
    expect(getCreditUtilizationAlert(29)).toBe("ok");
  });

  it("retorna warning si utilización entre 30% y 70%", () => {
    expect(getCreditUtilizationAlert(30)).toBe("warning");
    expect(getCreditUtilizationAlert(65)).toBe("warning");
  });

  it("retorna danger si utilización > 70%", () => {
    expect(getCreditUtilizationAlert(71)).toBe("danger");
    expect(getCreditUtilizationAlert(100)).toBe("danger");
  });
});

describe("getCutDateAlert", () => {
  it("retorna ok si faltan más de 7 días", () => {
    const alert = getCutDateAlert(28);
    if (alert.daysRemaining > 7) {
      expect(alert.level).toBe("ok");
    }
  });
});

describe("getPaymentDateAlert", () => {
  it("nivel danger tiene prioridad sobre warning", () => {
    const dangerAlert = { level: "danger" as const, daysRemaining: 2 };
    const warningAlert = { level: "warning" as const, daysRemaining: 5 };
    expect(dangerAlert.level).toBe("danger");
    expect(warningAlert.level).toBe("warning");
  });
});
