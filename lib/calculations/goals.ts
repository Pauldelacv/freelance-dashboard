import { monthOf } from "@/lib/dates";

/**
 * Objectifs : un montant annuel se répartit sur les mois réellement travaillés.
 *
 * Toute la répartition passe par de l'arithmétique entière — centimes pour le
 * CA, demi-journées pour les jours. Douze douzièmes d'un nombre flottant ne
 * refont jamais le total ; ici la somme des parts est exactement le total.
 */

/** Répartit un entier sur `count` parts, le reste allant aux premières. */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const sign = total < 0 ? -1 : 1;
  const absolute = Math.abs(total);
  const base = Math.floor(absolute / count);
  const remainder = absolute - base * count;
  return Array.from({ length: count }, (_, index) => sign * (base + (index < remainder ? 1 : 0)));
}

/** Répartit un nombre de jours par pas d'une demi-journée : 10 j sur 3 mois = 3,5 · 3,5 · 3. */
export function splitDays(total: number, count: number): number[] {
  return splitEvenly(Math.round(total * 2), count).map((halves) => halves / 2);
}

export interface MonthlyGoal {
  month: number;
  revenueTarget: number | null;
  daysTarget: number | null;
}

/**
 * Objectif annuel → objectifs mensuels, sur les mois retenus uniquement.
 * Un objectif absent (null) le reste sur chaque mois : on ne fabrique pas
 * une cible de jours à partir d'une cible de CA.
 */
export function distributeAnnualGoal(
  annual: { revenueTarget: number | null; daysTarget: number | null },
  months: number[],
): MonthlyGoal[] {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const revenues =
    annual.revenueTarget === null ? null : splitEvenly(annual.revenueTarget, sorted.length);
  const days = annual.daysTarget === null ? null : splitDays(annual.daysTarget, sorted.length);

  return sorted.map((month, index) => ({
    month,
    revenueTarget: revenues ? revenues[index] : null,
    daysTarget: days ? days[index] : null,
  }));
}

/** Mois (1–12) portant au moins un jour saisi — base de la répartition proposée. */
export function workedMonths(dates: string[]): number[] {
  const months = new Set<number>();
  for (const date of dates) months.add(monthOf(date));
  return [...months].sort((a, b) => a - b);
}
