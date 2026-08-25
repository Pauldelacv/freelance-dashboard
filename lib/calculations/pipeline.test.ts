import { describe, expect, it } from "vitest";
import {
  dueProspects,
  groupByStage,
  openPipelineValue,
  prospectValue,
  weightedValue,
} from "@/lib/calculations/pipeline";
import type { ProspectLike } from "@/lib/calculations/pipeline";

const prospect = (overrides: Partial<ProspectLike> = {}): ProspectLike => ({
  id: "p1",
  stage: "contacted",
  estimatedRate: 60000,
  estimatedDays: 10,
  probability: 50,
  ...overrides,
});

describe("valeur d'un prospect", () => {
  it("multiplie TJM et jours", () => {
    expect(prospectValue(prospect())).toBe(600000);
  });

  it("pondère par la probabilité", () => {
    expect(weightedValue(prospect())).toBe(300000);
    expect(weightedValue(prospect({ probability: 0 }))).toBe(0);
    expect(weightedValue(prospect({ probability: 100 }))).toBe(600000);
  });

  it("borne une probabilité aberrante", () => {
    expect(weightedValue(prospect({ probability: 150 }))).toBe(600000);
    expect(weightedValue(prospect({ probability: -10 }))).toBe(0);
  });

  it("vaut zéro si le TJM ou les jours manquent", () => {
    expect(prospectValue(prospect({ estimatedRate: null }))).toBe(0);
    expect(prospectValue(prospect({ estimatedDays: null }))).toBe(0);
  });
});

describe("pipeline", () => {
  const prospects = [
    prospect({ id: "a", stage: "contacted", probability: 30 }),
    prospect({ id: "b", stage: "quoted", probability: 70 }),
    prospect({ id: "c", stage: "won", probability: 100 }),
    prospect({ id: "d", stage: "lost", probability: 0 }),
  ];

  it("ne compte que les affaires encore ouvertes", () => {
    expect(openPipelineValue(prospects)).toBe(180000 + 420000);
  });

  it("regroupe par colonne", () => {
    const groups = groupByStage(prospects);
    expect(groups.contacted).toHaveLength(1);
    expect(groups.quoted).toHaveLength(1);
    expect(groups.won).toHaveLength(1);
    expect(groups.lost).toHaveLength(1);
  });
});

describe("relances", () => {
  const prospects = [
    prospect({ id: "retard", nextActionAt: "2026-08-20" }),
    prospect({ id: "aujourdhui", nextActionAt: "2026-08-25" }),
    prospect({ id: "futur", nextActionAt: "2026-09-10" }),
    prospect({ id: "sans-date", nextActionAt: null }),
    prospect({ id: "gagné", stage: "won", nextActionAt: "2026-08-01" }),
  ];

  it("remonte ce qui est dû, du plus ancien au plus récent", () => {
    expect(dueProspects(prospects, "2026-08-25").map((item) => item.id)).toEqual([
      "retard",
      "aujourdhui",
    ]);
  });

  it("ignore les affaires closes", () => {
    expect(dueProspects(prospects, "2026-12-31").some((item) => item.id === "gagné")).toBe(false);
  });
});
