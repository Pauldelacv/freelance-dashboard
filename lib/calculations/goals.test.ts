import { describe, expect, it } from "vitest";
import {
  distributeAnnualGoal,
  splitDays,
  splitEvenly,
  workedMonths,
} from "@/lib/calculations/goals";

describe("répartition d'un entier", () => {
  it("répartit exactement, le reste aux premières parts", () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(1000, 3).reduce((sum, part) => sum + part, 0)).toBe(1000);
  });

  it("tombe juste quand ça tombe rond", () => {
    expect(splitEvenly(12000, 12)).toEqual(Array.from({ length: 12 }, () => 1000));
  });

  it("ne répartit rien sur zéro part", () => {
    expect(splitEvenly(1000, 0)).toEqual([]);
  });
});

describe("répartition de jours", () => {
  it("s'arrête à la demi-journée sans perdre le total", () => {
    expect(splitDays(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(splitDays(10, 3)).toEqual([3.5, 3.5, 3]);
    expect(splitDays(10, 3).reduce((sum, part) => sum + part, 0)).toBe(10);
  });
});

describe("objectif annuel réparti", () => {
  it("ne vise que les mois retenus et refait le total", () => {
    const parts = distributeAnnualGoal({ revenueTarget: 10_000_00, daysTarget: 200 }, [1, 2, 3]);
    expect(parts.map((part) => part.month)).toEqual([1, 2, 3]);
    expect(parts.reduce((sum, part) => sum + (part.revenueTarget ?? 0), 0)).toBe(10_000_00);
    expect(parts.reduce((sum, part) => sum + (part.daysTarget ?? 0), 0)).toBe(200);
  });

  it("laisse vide ce qui n'est pas visé", () => {
    const parts = distributeAnnualGoal({ revenueTarget: 90_000_00, daysTarget: null }, [11, 12]);
    expect(parts).toEqual([
      { month: 11, revenueTarget: 45_000_00, daysTarget: null },
      { month: 12, revenueTarget: 45_000_00, daysTarget: null },
    ]);
  });

  it("ignore les doublons et trie les mois", () => {
    const parts = distributeAnnualGoal({ revenueTarget: 300, daysTarget: null }, [3, 1, 3]);
    expect(parts.map((part) => part.month)).toEqual([1, 3]);
    expect(parts.map((part) => part.revenueTarget)).toEqual([150, 150]);
  });
});

describe("mois travaillés", () => {
  it("retient les mois portant au moins un jour", () => {
    expect(workedMonths(["2026-01-05", "2026-01-06", "2026-03-02", "2026-12-31"])).toEqual([
      1, 3, 12,
    ]);
  });

  it("ne retient rien sans jour saisi", () => {
    expect(workedMonths([])).toEqual([]);
  });
});
