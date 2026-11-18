import { describe, it, expect } from "vitest";
import {
  deduplicateCycleItems,
  type CycleDirectItem,
  type CycleRecurringItem,
} from "@/lib/domain/recurring-charges";
import type { RecurringChargeEntry } from "@/lib/types";

describe("deduplicateCycleItems — avoid double-counting subscriptions in NextCyclePreview", () => {
  it("confirmed charge with transaction_id: removes from recurring, marks directItem", () => {
    const directItems: CycleDirectItem[] = [
      { txId: "tx-1", merchant: "Totalplay", amount: 439.88, date: "2026-11-18", category: "Suscripciones" },
      { txId: "tx-2", merchant: "Uber Eats", amount: 150, date: "2026-11-15" },
    ];
    const recurringItems: CycleRecurringItem[] = [
      { chargeId: "ch-1", name: "Totalplay", amount: 439.88, isConfirmed: true },
      { chargeId: "ch-2", name: "YT Premium", amount: 99, isConfirmed: false },
    ];
    const entriesByCharge = new Map<string, RecurringChargeEntry[]>([
      ["ch-1", [{
        id: "e-1", recurring_charge_id: "ch-1", date: "2026-11-18",
        amount: 439.88, transaction_id: "tx-1", created_at: "2026-11-18T12:00:00Z",
      }]],
    ]);

    const result = deduplicateCycleItems(directItems, recurringItems, entriesByCharge);

    // Totalplay should be removed from recurringItems (it's already in directItems)
    expect(result.recurringItems).toHaveLength(1);
    expect(result.recurringItems[0].name).toBe("YT Premium");

    // Totalplay transaction should be marked as from subscription
    const totalplayTx = result.directItems.find((d) => d.merchant === "Totalplay");
    expect(totalplayTx?.isFromSubscription).toBe(true);

    // Uber Eats should NOT be marked
    const uberTx = result.directItems.find((d) => d.merchant === "Uber Eats");
    expect(uberTx?.isFromSubscription).toBeFalsy();
  });

  it("confirmed charge WITHOUT transaction_id (old data): matches by name, removes from recurring", () => {
    const directItems: CycleDirectItem[] = [
      { txId: "tx-1", merchant: "Spotify", amount: 149, date: "2026-11-10", category: "Suscripciones" },
    ];
    const recurringItems: CycleRecurringItem[] = [
      { chargeId: "ch-1", name: "Spotify", amount: 149, isConfirmed: true },
    ];
    const entriesByCharge = new Map<string, RecurringChargeEntry[]>([
      ["ch-1", [{
        id: "e-1", recurring_charge_id: "ch-1", date: "2026-11-10",
        amount: 149, transaction_id: null, created_at: "2026-11-10T12:00:00Z",
      }]],
    ]);

    const result = deduplicateCycleItems(directItems, recurringItems, entriesByCharge);

    expect(result.recurringItems).toHaveLength(0);
    expect(result.directItems[0].isFromSubscription).toBe(true);
  });

  it("unconfirmed charge stays in recurringItems (projection)", () => {
    const directItems: CycleDirectItem[] = [];
    const recurringItems: CycleRecurringItem[] = [
      { chargeId: "ch-1", name: "Netflix", amount: 299, isConfirmed: false },
    ];
    const entriesByCharge = new Map<string, RecurringChargeEntry[]>();

    const result = deduplicateCycleItems(directItems, recurringItems, entriesByCharge);

    expect(result.recurringItems).toHaveLength(1);
    expect(result.recurringItems[0].name).toBe("Netflix");
  });

  it("confirmed charge with no matching transaction stays in recurringItems", () => {
    const directItems: CycleDirectItem[] = [
      { txId: "tx-1", merchant: "Uber Eats", amount: 200, date: "2026-11-12" },
    ];
    const recurringItems: CycleRecurringItem[] = [
      { chargeId: "ch-1", name: "Netflix", amount: 299, isConfirmed: true },
    ];
    const entriesByCharge = new Map<string, RecurringChargeEntry[]>([
      ["ch-1", [{
        id: "e-1", recurring_charge_id: "ch-1", date: "2026-11-10",
        amount: 299, transaction_id: null, created_at: "2026-11-10T12:00:00Z",
      }]],
    ]);

    const result = deduplicateCycleItems(directItems, recurringItems, entriesByCharge);

    // No match by name → stays
    expect(result.recurringItems).toHaveLength(1);
    expect(result.directItems[0].isFromSubscription).toBeFalsy();
  });

  it("total amount is correct after dedup (no double-counting)", () => {
    const directItems: CycleDirectItem[] = [
      { txId: "tx-1", merchant: "Totalplay", amount: 439.88, date: "2026-11-18", category: "Suscripciones" },
      { txId: "tx-2", merchant: "Meli +", amount: 399, date: "2026-11-16" },
    ];
    const recurringItems: CycleRecurringItem[] = [
      { chargeId: "ch-1", name: "Totalplay", amount: 439.88, isConfirmed: true },
      { chargeId: "ch-2", name: "YT Premium", amount: 99, isConfirmed: false },
    ];
    const entriesByCharge = new Map<string, RecurringChargeEntry[]>([
      ["ch-1", [{
        id: "e-1", recurring_charge_id: "ch-1", date: "2026-11-18",
        amount: 439.88, transaction_id: "tx-1", created_at: "2026-11-18T12:00:00Z",
      }]],
    ]);

    const result = deduplicateCycleItems(directItems, recurringItems, entriesByCharge);

    const directTotal = result.directItems.reduce((s, d) => s + d.amount, 0);
    const recurringTotal = result.recurringItems.reduce((s, r) => s + r.amount, 0);
    // 439.88 (Totalplay tx) + 399 (Meli+) + 99 (YT Premium projected) = 937.88
    // NOT 439.88 + 399 + 439.88 + 99 = 1377.76 (double-counted)
    expect(directTotal + recurringTotal).toBeCloseTo(937.88, 2);
  });
});
