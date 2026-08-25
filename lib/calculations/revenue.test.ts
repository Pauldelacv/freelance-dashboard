import { describe, expect, it } from "vitest";
import {
  averageRealRate,
  billableDays,
  occupancyRate,
  revenueByBillingStatus,
  revenueByClient,
  revenueByMonth,
  totalRevenue,
  workDayAmount,
  workedDays,
} from "@/lib/calculations/revenue";
import type { WorkDayLike } from "@/lib/calculations/revenue";

const day = (overrides: Partial<WorkDayLike> = {}): WorkDayLike => ({
  date: "2026-08-25",
  fraction: 1,
  rate: 60000, // 600 €
  type: "billable",
  billing: "pending",
  clientId: "c1",
  ...overrides,
});

describe("montant d'une journée", () => {
  it("applique la fraction au TJM figé", () => {
    expect(workDayAmount(day())).toBe(60000);
    expect(workDayAmount(day({ fraction: 0.5 }))).toBe(30000);
  });

  it("ne facture ni l'interne, ni la formation, ni les congés", () => {
    expect(workDayAmount(day({ type: "internal" }))).toBe(0);
    expect(workDayAmount(day({ type: "training" }))).toBe(0);
    expect(workDayAmount(day({ type: "off" }))).toBe(0);
  });

  it("arrondit au centime, jamais de flottant qui traîne", () => {
    expect(workDayAmount(day({ rate: 55555, fraction: 0.5 }))).toBe(27778);
  });
});

describe("agrégats de CA", () => {
  const days = [
    day({ date: "2026-08-03", billing: "paid" }),
    day({ date: "2026-08-04", billing: "invoiced" }),
    day({ date: "2026-08-05", billing: "pending", fraction: 0.5 }),
    day({ date: "2026-08-06", type: "internal" }),
    day({ date: "2026-09-01", billing: "pending", clientId: "c2", rate: 70000 }),
  ];

  it("totalise le CA facturable", () => {
    expect(totalRevenue(days)).toBe(60000 + 60000 + 30000 + 70000);
  });

  it("ventile par statut de facturation", () => {
    expect(revenueByBillingStatus(days)).toEqual({
      pending: 30000 + 70000,
      invoiced: 60000,
      paid: 60000,
      total: 220000,
    });
  });

  it("compte les jours facturables et les jours travaillés", () => {
    expect(billableDays(days)).toBe(3.5);
    expect(workedDays(days)).toBe(4.5); // + la journée interne, hors congés
  });

  it("ventile par mois et par client", () => {
    expect(revenueByMonth(days).get("2026-08")).toBe(150000);
    expect(revenueByMonth(days).get("2026-09")).toBe(70000);
    expect(revenueByClient(days).get("c1")).toBe(150000);
    expect(revenueByClient(days).get("c2")).toBe(70000);
  });

  it("calcule le TJM moyen réel", () => {
    // 220 000 centimes pour 3,5 jours facturables
    expect(averageRealRate(days)).toBe(62857);
  });

  it("reste neutre sur une liste vide", () => {
    expect(totalRevenue([])).toBe(0);
    expect(averageRealRate([])).toBe(0);
    expect(occupancyRate([], 21)).toBe(0);
  });
});

describe("taux d'occupation", () => {
  it("rapporte les jours travaillés aux jours ouvrés", () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day({ date: `2026-08-${String(i + 3).padStart(2, "0")}` }),
    );
    expect(occupancyRate(days, 20)).toBe(0.5);
  });

  it("évite la division par zéro", () => {
    expect(occupancyRate([day()], 0)).toBe(0);
  });
});
