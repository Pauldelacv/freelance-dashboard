import { describe, expect, it } from "vitest";
import {
  forfaitDate,
  forfaitRevenueByMonth,
  forfaitRevenueByStatus,
  forfaitRevenueIn,
  missionAmount,
  type MissionLike,
} from "@/lib/calculations/missions";

const mission = (overrides: Partial<MissionLike> = {}): MissionLike => ({
  billingType: "forfait",
  forfaitAmount: 450000, // 4 500 €
  billing: "pending",
  billedAt: null,
  startDate: "2026-08-03",
  endDate: "2026-09-18",
  createdAt: new Date("2026-07-01T10:00:00Z"),
  ...overrides,
});

describe("montant d'une mission", () => {
  it("retient le forfait convenu", () => {
    expect(missionAmount(mission())).toBe(450000);
  });

  it("ignore une mission en régie", () => {
    // Son CA, ce sont ses jours cochés : le compter ici le doublerait.
    expect(missionAmount(mission({ billingType: "regie", forfaitAmount: 450000 }))).toBe(0);
  });

  it("ignore un forfait sans montant", () => {
    expect(missionAmount(mission({ forfaitAmount: null }))).toBe(0);
  });
});

describe("date de rattachement d'un forfait", () => {
  it("préfère la date de facture", () => {
    expect(forfaitDate(mission({ billedAt: "2026-10-02" }))).toBe("2026-10-02");
  });

  it("retombe sur la fin de mission, puis sur son début", () => {
    expect(forfaitDate(mission())).toBe("2026-09-18");
    expect(forfaitDate(mission({ endDate: null }))).toBe("2026-08-03");
  });

  it("retombe enfin sur la création, pour qu'un forfait compte toujours quelque part", () => {
    expect(forfaitDate(mission({ startDate: null, endDate: null }))).toBe("2026-07-01");
  });
});

describe("répartition par statut", () => {
  it("sépare à facturer, facturé et encaissé", () => {
    const breakdown = forfaitRevenueByStatus([
      mission({ forfaitAmount: 100000 }),
      mission({ forfaitAmount: 200000, billing: "invoiced", billedAt: "2026-09-30" }),
      mission({ forfaitAmount: 300000, billing: "paid", billedAt: "2026-06-30" }),
      mission({ billingType: "regie", forfaitAmount: 999999 }),
    ]);

    expect(breakdown).toEqual({
      pending: 100000,
      invoiced: 200000,
      paid: 300000,
      total: 600000,
    });
  });
});

describe("CA des forfaits par période", () => {
  it("classe chaque forfait au mois de sa date de rattachement", () => {
    const byMonth = forfaitRevenueByMonth([
      mission({ forfaitAmount: 100000 }), // fin de mission : septembre
      mission({ forfaitAmount: 200000, billedAt: "2026-10-02" }), // facture : octobre
      mission({ forfaitAmount: 50000, endDate: "2026-09-01" }), // septembre aussi
    ]);

    expect(byMonth.get("2026-09")).toBe(150000);
    expect(byMonth.get("2026-10")).toBe(200000);
  });

  it("additionne sur un mois ou sur une année, selon le préfixe", () => {
    const missions = [
      mission({ forfaitAmount: 100000 }), // 2026-09
      mission({ forfaitAmount: 200000, billedAt: "2027-01-05" }), // 2027-01
    ];

    expect(forfaitRevenueIn(missions, "2026-09")).toBe(100000);
    expect(forfaitRevenueIn(missions, "2026")).toBe(100000);
    expect(forfaitRevenueIn(missions, "2027")).toBe(200000);
  });
});
