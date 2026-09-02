import { describe, expect, it } from "vitest";
import {
  collectedInQuarter,
  daysLeft,
  declarationFor,
  isOverdue,
  openDeclaration,
  quarterOf,
} from "@/lib/calculations/urssaf";
import type { MissionLike } from "@/lib/calculations/missions";
import type { WorkDayLike } from "@/lib/calculations/revenue";

describe("trimestre d'une date", () => {
  it("découpe l'année en quatre", () => {
    expect(quarterOf("2026-01-01")).toBe(1);
    expect(quarterOf("2026-03-31")).toBe(1);
    expect(quarterOf("2026-04-01")).toBe(2);
    expect(quarterOf("2026-09-30")).toBe(3);
    expect(quarterOf("2026-10-01")).toBe(4);
    expect(quarterOf("2026-12-31")).toBe(4);
  });
});

describe("échéance d'un trimestre", () => {
  it("ouvre le 1ᵉʳ du mois suivant, ferme à la fin de ce mois", () => {
    expect(declarationFor(2026, 1)).toMatchObject({
      key: "2026-T1",
      label: "1ᵉʳ trimestre 2026",
      from: "2026-01-01",
      to: "2026-03-31",
      opensAt: "2026-04-01",
      dueAt: "2026-04-30",
    });
    expect(declarationFor(2026, 2)).toMatchObject({
      from: "2026-04-01",
      to: "2026-06-30",
      opensAt: "2026-07-01",
      dueAt: "2026-07-31",
    });
    expect(declarationFor(2026, 3)).toMatchObject({
      from: "2026-07-01",
      to: "2026-09-30",
      opensAt: "2026-10-01",
      dueAt: "2026-10-31",
    });
  });

  it("reporte le 4ᵉ trimestre sur janvier de l'année suivante", () => {
    expect(declarationFor(2026, 4)).toMatchObject({
      key: "2026-T4",
      label: "4ᵉ trimestre 2026",
      from: "2026-10-01",
      to: "2026-12-31",
      opensAt: "2027-01-01",
      dueAt: "2027-01-31",
    });
  });

  it("tient compte des années bissextiles pour la fin de trimestre", () => {
    expect(declarationFor(2028, 1).to).toBe("2028-03-31");
    expect(declarationFor(2028, 1).from).toBe("2028-01-01");
  });
});

describe("déclaration ouverte à une date", () => {
  it("est celle du trimestre précédent", () => {
    expect(openDeclaration("2026-07-01").key).toBe("2026-T2");
    expect(openDeclaration("2026-09-02").key).toBe("2026-T2");
    expect(openDeclaration("2026-09-30").key).toBe("2026-T2");
  });

  it("bascule le jour où le trimestre suivant commence", () => {
    expect(openDeclaration("2026-10-01").key).toBe("2026-T3");
  });

  it("remonte à l'année précédente en janvier", () => {
    const declaration = openDeclaration("2027-01-15");
    expect(declaration.key).toBe("2026-T4");
    expect(declaration.dueAt).toBe("2027-01-31");
  });

  it("est toujours ouverte : sa date d'ouverture est déjà passée", () => {
    for (const today of ["2026-01-01", "2026-04-15", "2026-07-31", "2026-12-31"]) {
      expect(openDeclaration(today).opensAt <= today).toBe(true);
    }
  });
});

describe("compte à rebours", () => {
  const declaration = declarationFor(2026, 2); // limite au 31 juillet 2026

  it("compte les jours restants", () => {
    expect(daysLeft(declaration, "2026-07-01")).toBe(30);
    expect(daysLeft(declaration, "2026-07-31")).toBe(0);
  });

  it("passe en retard le lendemain de la date limite", () => {
    expect(isOverdue(declaration, "2026-07-31")).toBe(false);
    expect(isOverdue(declaration, "2026-08-01")).toBe(true);
    expect(daysLeft(declaration, "2026-08-05")).toBe(-5);
  });
});

describe("CA encaissé du trimestre", () => {
  const declaration = declarationFor(2026, 2); // avril → juin

  const day = (
    overrides: Partial<WorkDayLike & { paidAt: string | null }> = {},
  ): WorkDayLike & { paidAt: string | null } => ({
    date: "2026-05-04",
    fraction: 1,
    rate: 50000,
    type: "billable",
    billing: "paid",
    paidAt: "2026-05-20",
    ...overrides,
  });

  const mission = (overrides: Partial<MissionLike> = {}): MissionLike => ({
    billingType: "forfait",
    forfaitAmount: 300000,
    billing: "paid",
    billedAt: "2026-05-02",
    paidAt: "2026-06-10",
    startDate: null,
    endDate: null,
    createdAt: new Date("2026-04-01T10:00:00Z"),
    ...overrides,
  });

  it("additionne jours et forfaits encaissés dans le trimestre", () => {
    expect(collectedInQuarter([day()], [mission()], declaration)).toBe(50000 + 300000);
  });

  it("range chaque encaissement à sa date d'encaissement, pas à celle du travail", () => {
    // Un jour de mars encaissé en mai se déclare au 2ᵉ trimestre.
    expect(collectedInQuarter([day({ date: "2026-03-10" })], [], declaration)).toBe(50000);
    // Un jour de mai encaissé en juillet appartient au trimestre suivant.
    expect(collectedInQuarter([day({ paidAt: "2026-07-02" })], [], declaration)).toBe(0);
  });

  it("ignore ce qui n'est pas encaissé", () => {
    expect(collectedInQuarter([day({ billing: "invoiced", paidAt: null })], [], declaration)).toBe(
      0,
    );
    expect(
      collectedInQuarter([], [mission({ billing: "invoiced", paidAt: null })], declaration),
    ).toBe(0);
  });

  it("ignore les journées non facturables et les missions en régie", () => {
    expect(collectedInQuarter([day({ type: "off" })], [], declaration)).toBe(0);
    expect(collectedInQuarter([], [mission({ billingType: "regie" })], declaration)).toBe(0);
  });

  it("compte une demi-journée pour une demi-journée", () => {
    expect(collectedInQuarter([day({ fraction: 0.5 })], [], declaration)).toBe(25000);
  });
});
