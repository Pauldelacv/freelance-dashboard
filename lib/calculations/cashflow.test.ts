import { describe, expect, it } from "vitest";
import {
  buildForecast,
  expectedPaymentDate,
  forecastTotals,
  type CashflowDay,
  type CashflowForfait,
} from "@/lib/calculations/cashflow";

const day = (overrides: Partial<CashflowDay> = {}): CashflowDay => ({
  date: "2026-08-10",
  fraction: 1,
  rate: 60000,
  type: "billable",
  billing: "pending",
  billedAt: null,
  clientId: "c1",
  clientName: "Agence Nord",
  color: "#6366f1",
  paymentTerms: 30,
  ...overrides,
});

const forfait = (overrides: Partial<CashflowForfait> = {}): CashflowForfait => ({
  date: "2026-08-20",
  amount: 450000,
  billing: "pending",
  billedAt: null,
  clientId: "c1",
  clientName: "Agence Nord",
  color: "#6366f1",
  paymentTerms: 30,
  ...overrides,
});

describe("date d'encaissement attendue", () => {
  it("part de la fin du mois pour un jour à facturer", () => {
    // Travaillé le 10 août, facturé fin août, payé à 30 jours.
    expect(expectedPaymentDate(day())).toBe("2026-09-30");
  });

  it("part de la date de facture pour un jour déjà facturé", () => {
    expect(
      expectedPaymentDate(day({ billing: "invoiced", billedAt: "2026-08-05", paymentTerms: 45 })),
    ).toBe("2026-09-19");
  });

  it("retombe sur la fin du mois si la date de facture manque", () => {
    expect(expectedPaymentDate(day({ billing: "invoiced", billedAt: null }))).toBe("2026-09-30");
  });

  it("respecte le délai propre à chaque client", () => {
    expect(expectedPaymentDate(day({ paymentTerms: 0 }))).toBe("2026-08-31");
    expect(expectedPaymentDate(day({ paymentTerms: 60 }))).toBe("2026-10-30");
  });
});

describe("prévisionnel", () => {
  const today = "2026-08-25"; // mardi

  it("commence au lundi de la semaine en cours", () => {
    const buckets = buildForecast([], today);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].weekStart).toBe("2026-08-24");
    expect(buckets[11].weekStart).toBe("2026-11-09");
  });

  it("classe le facturé en certain et le reste en probable", () => {
    const buckets = buildForecast(
      [
        day({ billing: "invoiced", billedAt: "2026-08-05", paymentTerms: 30 }), // → 04/09
        day({ billing: "pending", paymentTerms: 30 }), // → 30/09
      ],
      today,
    );

    const semaineDu31Aout = buckets.find((bucket) => bucket.weekStart === "2026-08-31");
    const semaineDu28Sept = buckets.find((bucket) => bucket.weekStart === "2026-09-28");
    expect(semaineDu31Aout?.certain).toBe(60000);
    expect(semaineDu31Aout?.probable).toBe(0);
    expect(semaineDu28Sept?.probable).toBe(60000);
  });

  it("ignore ce qui est déjà encaissé et ce qui n'est pas facturable", () => {
    const buckets = buildForecast(
      [day({ billing: "paid" }), day({ type: "internal" }), day({ type: "off" })],
      today,
    );
    expect(forecastTotals(buckets).total).toBe(0);
  });

  it("reporte les retards sur la première semaine", () => {
    // Jour de juin, payable fin juin + 30 j = 30/07, déjà passé.
    const buckets = buildForecast([day({ date: "2026-06-10" })], today);
    expect(buckets[0].probable).toBe(60000);
  });

  it("laisse de côté ce qui tombe après l'horizon", () => {
    const buckets = buildForecast([day({ date: "2027-01-10" })], today);
    expect(forecastTotals(buckets).total).toBe(0);
  });

  it("empile par client", () => {
    const buckets = buildForecast(
      [day(), day({ clientId: "c2", clientName: "Studio Kappa", color: "#10b981", rate: 70000 })],
      today,
    );
    const semaine = buckets.find((bucket) => bucket.weekStart === "2026-09-28");
    expect(semaine?.byClient).toHaveLength(2);
    // Trié par montant décroissant.
    expect(semaine?.byClient[0].name).toBe("Studio Kappa");
  });

  it("ajoute le pipeline pondéré quand l'option est activée", () => {
    const buckets = buildForecast([], today, {
      pipeline: [{ id: "p1", name: "Refonte", weighted: 250000, expectedAt: "2026-09-15" }],
    });
    const totals = forecastTotals(buckets);
    expect(totals.pipeline).toBe(250000);
    expect(totals.total).toBe(250000);
  });

  it("totalise les 4 prochaines semaines hors pipeline", () => {
    const buckets = buildForecast(
      [day({ billing: "invoiced", billedAt: "2026-08-05", paymentTerms: 30 })],
      today,
      { pipeline: [{ id: "p1", name: "X", weighted: 500000, expectedAt: "2026-09-01" }] },
    );
    expect(forecastTotals(buckets).nextMonth).toBe(60000);
  });

  it("place une mission au forfait comme un jour, à la date qui lui est propre", () => {
    // À facturer : fin du mois de rattachement + délai, soit le 30/09.
    // Facturée : date de facture + délai, soit le 04/09.
    const buckets = buildForecast([], today, {
      forfaits: [
        forfait(),
        forfait({ amount: 200000, billing: "invoiced", billedAt: "2026-08-05" }),
      ],
    });

    const semaineDu31Aout = buckets.find((bucket) => bucket.weekStart === "2026-08-31");
    const semaineDu28Sept = buckets.find((bucket) => bucket.weekStart === "2026-09-28");
    expect(semaineDu31Aout?.certain).toBe(200000);
    expect(semaineDu28Sept?.probable).toBe(450000);
  });

  it("laisse dehors un forfait déjà encaissé", () => {
    const buckets = buildForecast([], today, { forfaits: [forfait({ billing: "paid" })] });
    expect(forecastTotals(buckets).total).toBe(0);
  });

  it("empile forfait et jours sous le même client", () => {
    const buckets = buildForecast([day()], today, { forfaits: [forfait()] });
    const semaine = buckets.find((bucket) => bucket.weekStart === "2026-09-28");
    expect(semaine?.byClient).toHaveLength(1);
    expect(semaine?.byClient[0].amount).toBe(510000);
  });
});
