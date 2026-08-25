import { describe, expect, it } from "vitest";
import {
  businessDaysInMonth,
  easterSunday,
  holidayName,
  isBusinessDay,
  isHoliday,
} from "@/lib/holidays";

describe("easterSunday", () => {
  it("retrouve les dates de Pâques connues", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
});

describe("jours fériés", () => {
  it("gère les fériés fixes", () => {
    expect(holidayName("2026-01-01")).toBe("Jour de l'an");
    expect(holidayName("2026-07-14")).toBe("Fête nationale");
    expect(holidayName("2026-12-25")).toBe("Noël");
  });

  it("gère les fériés mobiles adossés à Pâques", () => {
    expect(holidayName("2026-04-06")).toBe("Lundi de Pâques");
    expect(holidayName("2026-05-14")).toBe("Ascension");
    expect(holidayName("2026-05-25")).toBe("Lundi de Pentecôte");
  });

  it("ne signale pas un jour ordinaire", () => {
    expect(isHoliday("2026-08-25")).toBe(false);
  });
});

describe("jours ouvrés", () => {
  it("exclut week-ends et fériés", () => {
    expect(isBusinessDay("2026-08-25")).toBe(true); // mardi
    expect(isBusinessDay("2026-08-29")).toBe(false); // samedi
    expect(isBusinessDay("2026-08-15")).toBe(false); // Assomption
  });

  it("compte les jours ouvrés du mois", () => {
    // Août 2026 : 31 jours, 21 jours de semaine, le 15 (Assomption) tombe un samedi.
    expect(businessDaysInMonth(2026, 8)).toBe(21);
    // Mai 2026 : 1er (vendredi), 8 (vendredi), 14 (Ascension, jeudi), 25 (Pentecôte, lundi).
    expect(businessDaysInMonth(2026, 5)).toBe(17);
  });
});
