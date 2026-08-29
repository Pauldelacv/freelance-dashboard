import { describe, expect, it } from "vitest";
import {
  billableDaysPerYear,
  billableMonthsPerYear,
  compareToActual,
  netFromRate,
  netFromRevenue,
  rateFromNet,
  simulate,
} from "@/lib/calculations/rate-simulator";

const base = { daysPerMonth: 15, weeksOff: 5, chargeRate: 0.261 };

describe("temps facturable", () => {
  it("déduit les congés des mois facturés", () => {
    expect(billableMonthsPerYear(0)).toBe(12);
    expect(billableMonthsPerYear(5)).toBeCloseTo(10.846, 3);
    expect(billableMonthsPerYear(52)).toBeCloseTo(0.231, 3); // borné à 51 semaines
  });

  it("convertit en jours facturés par an", () => {
    expect(billableDaysPerYear({ ...base, weeksOff: 0 })).toBe(180);
    expect(billableDaysPerYear(base)).toBeCloseTo(162.7, 1);
  });
});

describe("net ↔ TJM", () => {
  it("calcule le net mensuel depuis un TJM", () => {
    // 600 € × 180 j = 108 000 € de CA, −26,1 % = 79 812 €, soit 6 651 €/mois.
    const net = netFromRate(60000, { ...base, weeksOff: 0 });
    expect(net).toBe(665100);
  });

  it("calcule le TJM nécessaire pour un net visé", () => {
    const rate = rateFromNet(665100, { ...base, weeksOff: 0 });
    expect(rate).toBe(60000);
  });

  it("boucle dans les deux sens sans dérive", () => {
    for (const target of [200000, 350000, 500000, 900000]) {
      const rate = rateFromNet(target, base);
      // L'aller-retour retombe à moins d'un euro près.
      expect(Math.abs(netFromRate(rate, base) - target)).toBeLessThan(100);
    }
  });

  it("tient compte des charges fixes mensuelles", () => {
    const sansCharges = rateFromNet(400000, base);
    const avecCharges = rateFromNet(400000, { ...base, monthlyExpenses: 20000 });
    expect(avecCharges).toBeGreaterThan(sansCharges);
    expect(netFromRate(avecCharges, { ...base, monthlyExpenses: 20000 })).toBeCloseTo(400000, -2);
  });

  it("reste robuste aux entrées absurdes", () => {
    expect(rateFromNet(500000, { ...base, daysPerMonth: 0 })).toBe(0);
    expect(rateFromNet(500000, { ...base, chargeRate: 1 })).toBe(0);
    expect(rateFromNet(0, base)).toBe(0);
  });
});

describe("simulation complète", () => {
  it("détaille CA, cotisations et net", () => {
    const result = simulate(60000, { ...base, weeksOff: 0 });
    expect(result.yearlyRevenue).toBe(10800000);
    expect(result.yearlyCharges).toBe(2818800);
    expect(result.yearlyNet).toBe(7981200);
    expect(result.monthlyNet).toBe(665100);
    expect(result.monthlyRevenue).toBe(900000);
  });
});

describe("comparaison au TJM réel", () => {
  it("chiffre l'écart à combler", () => {
    const comparison = compareToActual(65000, 55000);
    expect(comparison.gap).toBe(10000);
    expect(comparison.gapRatio).toBeCloseTo(0.1818, 4);
  });

  it("n'invente pas d'écart sans historique", () => {
    expect(compareToActual(65000, 0).gapRatio).toBeNull();
  });
});

describe("net d'un CA constaté", () => {
  it("retranche les cotisations du CA", () => {
    expect(netFromRevenue(442500, 0.261)) // 4 425,00 €
      .toBe(327008);
  });

  it("laisse le CA intact à taux nul et le vide à 100 %", () => {
    expect(netFromRevenue(442500, 0)).toBe(442500);
    expect(netFromRevenue(442500, 1)).toBe(0);
  });

  it("borne un taux aberrant plutôt que de rendre un net négatif", () => {
    expect(netFromRevenue(442500, 1.5)).toBe(0);
    expect(netFromRevenue(442500, -0.2)).toBe(442500);
  });

  it("reste cohérent avec le simulateur : même taux, même net avant charges fixes", () => {
    const revenue = simulate(60000, { ...base, weeksOff: 0 }).yearlyRevenue;
    expect(netFromRevenue(revenue, base.chargeRate)).toBe(7981200);
  });
});
