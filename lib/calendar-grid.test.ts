import { describe, expect, it } from "vitest";
import { rectangleBetween } from "@/lib/calendar-grid";
import { firstDayOfMonth, isoWeekday, monthDates } from "@/lib/dates";

/** Le mois tel que la grille le pose : les dates et le décalage du 1er. */
function grid(year: number, month: number) {
  return {
    dates: monthDates(year, month),
    leading: isoWeekday(firstDayOfMonth(year, month)) - 1,
  };
}

// Octobre 2026 commence un jeudi : la première ligne est amputée de trois cases.
const octobre = grid(2026, 10);

describe("rectangleBetween", () => {
  it("garde la plage sur une seule ligne", () => {
    // Lundi 5 → jeudi 8 : une semaine, quatre jours.
    expect(rectangleBetween(octobre.dates, octobre.leading, "2026-10-05", "2026-10-08")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
  });

  it("n'emporte pas les week-ends quand on descend d'une ligne", () => {
    // Lundi 5 → vendredi 16 : deux semaines de jours ouvrés, sans les 10, 11,
    // 17 et 18. C'est tout l'objet du rectangle.
    const selection = rectangleBetween(octobre.dates, octobre.leading, "2026-10-05", "2026-10-16");

    expect(selection).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });

  it("suit une seule colonne quand le glissement reste vertical", () => {
    // Tous les lundis de la période, et rien d'autre.
    expect(rectangleBetween(octobre.dates, octobre.leading, "2026-10-05", "2026-10-19")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
  });

  it("donne le même rectangle dans les deux sens de glissement", () => {
    const descendant = rectangleBetween(octobre.dates, octobre.leading, "2026-10-05", "2026-10-16");
    const montant = rectangleBetween(octobre.dates, octobre.leading, "2026-10-16", "2026-10-05");
    expect(montant).toEqual(descendant);
  });

  it("tient compte des cases vides du début de mois", () => {
    // Novembre 2026 commence un dimanche : sans le décalage, le 1er serait pris
    // pour un lundi et toutes les colonnes seraient décalées d'un cran.
    const novembre = grid(2026, 11);
    expect(novembre.leading).toBe(6);
    expect(rectangleBetween(novembre.dates, novembre.leading, "2026-11-01", "2026-11-15")).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
    ]);
  });

  it("ignore une date hors du mois affiché", () => {
    expect(rectangleBetween(octobre.dates, octobre.leading, "2026-09-30", "2026-10-05")).toEqual(
      [],
    );
  });
});
