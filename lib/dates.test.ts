import { describe, expect, it } from "vitest";
import {
  addMonths,
  daysInMonth,
  firstDayOfMonth,
  isWeekend,
  isoAddDays,
  isoDaysBetween,
  isoWeekday,
  lastDayOfMonth,
  monthDates,
} from "@/lib/dates";

describe("dates ISO", () => {
  it("connaît la longueur des mois, années bissextiles comprises", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 8)).toBe(31);
  });

  it("borne les mois", () => {
    expect(firstDayOfMonth(2026, 8)).toBe("2026-08-01");
    expect(lastDayOfMonth(2026, 2)).toBe("2026-02-28");
    expect(monthDates(2026, 8)).toHaveLength(31);
    expect(monthDates(2026, 8)[0]).toBe("2026-08-01");
  });

  it("navigue de mois en mois en franchissant les années", () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 8, 5)).toEqual({ year: 2027, month: 1 });
  });

  it("décale les jours sans dérive de fuseau", () => {
    expect(isoAddDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(isoAddDays("2026-01-01", -1)).toBe("2025-12-31");
    // Passage à l'heure d'été en France : le 29 mars 2026.
    expect(isoAddDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(isoAddDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(isoDaysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("identifie les jours de la semaine", () => {
    expect(isoWeekday("2026-08-25")).toBe(2); // mardi
    expect(isWeekend("2026-08-29")).toBe(true);
    expect(isWeekend("2026-08-30")).toBe(true);
    expect(isWeekend("2026-08-31")).toBe(false);
  });
});
