import { dayAmount } from "@/lib/money";
import { businessDaysInMonth } from "@/lib/holidays";
import { monthOf, yearOf } from "@/lib/dates";

export const DAY_TYPES = ["billable", "internal", "training", "off"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const BILLING_STATUSES = ["pending", "invoiced", "paid"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/** Vue minimale d'un jour travaillé : tout ce dont les calculs ont besoin. */
export interface WorkDayLike {
  date: string;
  fraction: number;
  rate: number;
  type: string;
  billing: string;
  clientId?: string | null;
}

/** Un jour ne rapporte que s'il est facturable. Le TJM est celui figé sur le jour. */
export function workDayAmount(day: WorkDayLike): number {
  if (day.type !== "billable") return 0;
  return dayAmount(day.rate, day.fraction);
}

export function totalRevenue(days: WorkDayLike[]): number {
  return days.reduce((sum, day) => sum + workDayAmount(day), 0);
}

export interface RevenueBreakdown {
  /** Jours facturables pas encore facturés dans Indy. */
  pending: number;
  /** Facturés dans Indy, pas encore encaissés. */
  invoiced: number;
  paid: number;
  total: number;
}

export function revenueByBillingStatus(days: WorkDayLike[]): RevenueBreakdown {
  const breakdown: RevenueBreakdown = { pending: 0, invoiced: 0, paid: 0, total: 0 };
  for (const day of days) {
    const amount = workDayAmount(day);
    if (amount === 0) continue;
    if (day.billing === "invoiced") breakdown.invoiced += amount;
    else if (day.billing === "paid") breakdown.paid += amount;
    else breakdown.pending += amount;
    breakdown.total += amount;
  }
  return breakdown;
}

/** Nombre de jours facturables (0,5 compte pour une demi-journée). */
export function billableDays(days: WorkDayLike[]): number {
  return days.filter((day) => day.type === "billable").reduce((sum, day) => sum + day.fraction, 0);
}

/** Jours réellement travaillés : facturable + interne + formation, hors congés. */
export function workedDays(days: WorkDayLike[]): number {
  return days.filter((day) => day.type !== "off").reduce((sum, day) => sum + day.fraction, 0);
}

export function daysByType(days: WorkDayLike[]): Record<DayType, number> {
  const totals: Record<DayType, number> = { billable: 0, internal: 0, training: 0, off: 0 };
  for (const day of days) {
    const type = (DAY_TYPES as readonly string[]).includes(day.type)
      ? (day.type as DayType)
      : "billable";
    totals[type] += day.fraction;
  }
  return totals;
}

/**
 * Taux d'occupation = jours travaillés / jours ouvrés de la période.
 * Retourne une fraction (0,75 = 75 %). Peut dépasser 1 si l'on travaille le week-end.
 */
export function occupancyRate(days: WorkDayLike[], businessDays: number): number {
  if (businessDays <= 0) return 0;
  return workedDays(days) / businessDays;
}

export function occupancyRateForMonth(days: WorkDayLike[], year: number, month: number): number {
  return occupancyRate(days, businessDaysInMonth(year, month));
}

/** TJM moyen réellement constaté : CA facturable / jours facturables. */
export function averageRealRate(days: WorkDayLike[]): number {
  const billable = billableDays(days);
  if (billable === 0) return 0;
  return Math.round(totalRevenue(days) / billable);
}

/** CA par mois, clé "YYYY-MM", pour les graphiques 12 mois. */
export function revenueByMonth(days: WorkDayLike[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const day of days) {
    const amount = workDayAmount(day);
    if (amount === 0) continue;
    const key = `${yearOf(day.date)}-${String(monthOf(day.date)).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + amount);
  }
  return byMonth;
}

/** CA par client, pour la répartition. Les jours sans client sont regroupés sous "". */
export function revenueByClient(days: WorkDayLike[]): Map<string, number> {
  const byClient = new Map<string, number>();
  for (const day of days) {
    const amount = workDayAmount(day);
    if (amount === 0) continue;
    const key = day.clientId ?? "";
    byClient.set(key, (byClient.get(key) ?? 0) + amount);
  }
  return byClient;
}
