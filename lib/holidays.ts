import { isWeekend, monthDates, yearOf } from "@/lib/dates";

/**
 * Jours fériés français, calculés localement — aucune API externe.
 * Métropole uniquement (pas d'Alsace-Moselle ni d'outre-mer).
 */

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher), en "YYYY-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Map "YYYY-MM-DD" -> nom du jour férié, pour une année donnée. */
export function holidaysOfYear(year: number): Map<string, string> {
  const easter = easterSunday(year);
  return new Map<string, string>([
    [`${year}-01-01`, "Jour de l'an"],
    [shift(easter, 1), "Lundi de Pâques"],
    [`${year}-05-01`, "Fête du travail"],
    [`${year}-05-08`, "Victoire 1945"],
    [shift(easter, 39), "Ascension"],
    [shift(easter, 50), "Lundi de Pentecôte"],
    [`${year}-07-14`, "Fête nationale"],
    [`${year}-08-15`, "Assomption"],
    [`${year}-11-01`, "Toussaint"],
    [`${year}-11-11`, "Armistice 1918"],
    [`${year}-12-25`, "Noël"],
  ]);
}

export function isHoliday(iso: string): boolean {
  return holidaysOfYear(yearOf(iso)).has(iso);
}

export function holidayName(iso: string): string | undefined {
  return holidaysOfYear(yearOf(iso)).get(iso);
}

/** Jour ouvré = ni week-end, ni férié. Base du taux d'occupation. */
export function isBusinessDay(iso: string): boolean {
  return !isWeekend(iso) && !isHoliday(iso);
}

export function businessDaysInMonth(year: number, month: number): number {
  return monthDates(year, month).filter(isBusinessDay).length;
}
