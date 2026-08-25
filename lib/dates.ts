import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

export const TIME_ZONE = "Europe/Paris";

const isoFormatter = new Intl.DateTimeFormat("fr-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthLabelFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  month: "long",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Date du jour à Paris, au format "YYYY-MM-DD". */
export function todayIso(): string {
  return isoFormatter.format(new Date());
}

/** Un Date (instant) -> "YYYY-MM-DD" tel que vu à Paris. */
export function toIsoDate(date: Date): string {
  return isoFormatter.format(date);
}

/**
 * "2026-08-25" -> Date à midi UTC.
 * Midi et non minuit : aucun décalage de fuseau ne peut faire changer de jour.
 */
export function fromIsoDate(iso: string): Date {
  return parseISO(`${iso}T12:00:00Z`);
}

export function isoAddDays(iso: string, days: number): string {
  return toIsoDate(addDays(fromIsoDate(iso), days));
}

export function isoDaysBetween(from: string, to: string): number {
  return differenceInCalendarDays(fromIsoDate(to), fromIsoDate(from));
}

/** Numéro de jour de la semaine, 1 = lundi … 7 = dimanche. */
export function isoWeekday(iso: string): number {
  const day = fromIsoDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isWeekend(iso: string): boolean {
  return isoWeekday(iso) >= 6;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Premier jour du mois, "YYYY-MM-01". month est 1-indexé. */
export function firstDayOfMonth(year: number, month: number): string {
  return `${monthKey(year, month)}-01`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function lastDayOfMonth(year: number, month: number): string {
  return `${monthKey(year, month)}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
}

/** Toutes les dates ISO d'un mois donné. */
export function monthDates(year: number, month: number): string[] {
  const total = daysInMonth(year, month);
  return Array.from({ length: total }, (_, index) => {
    return `${monthKey(year, month)}-${String(index + 1).padStart(2, "0")}`;
  });
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** "août 2026" */
export function formatMonthLabel(year: number, month: number): string {
  return monthLabelFormatter.format(fromIsoDate(firstDayOfMonth(year, month)));
}

/** "mardi 25 août 2026" */
export function formatLongDate(iso: string): string {
  return longDateFormatter.format(fromIsoDate(iso));
}

/** Lundi de la semaine contenant cette date, au format ISO. */
export function startOfWeekIso(iso: string): string {
  return isoAddDays(iso, -(isoWeekday(iso) - 1));
}

/** "sem. du 24/08" — étiquette courte pour les axes de graphiques. */
export function formatWeekLabel(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}
