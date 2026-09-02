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

/**
 * Mois déjà porteurs d'un objectif : c'est la répartition en place.
 *
 * La boîte de dialogue s'ouvrait auparavant sur les *mois travaillés*, sans
 * jamais relire ce qui avait été enregistré : on cochait décembre, on
 * enregistrait, on rouvrait — décembre était redevenu vide. Rien n'avait été
 * perdu en base, mais l'écran disait le contraire (issue #30).
 */
export function monthsWithGoal(byMonth: Record<number, unknown>): number[] {
  return Object.keys(byMonth)
    .map(Number)
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b);
}

/**
 * Mois à effacer quand on enregistre une répartition annuelle : ceux qui
 * portaient un objectif et ne font plus partie de la sélection.
 *
 * Sans cela, un objectif mensuel resté d'une répartition précédente continuait
 * de s'appliquer — l'objectif du mois « primait » sur l'année qu'on venait de
 * poser, alors que la répartition est justement censée faire loi.
 */
export function monthsToClear(existing: number[], selected: number[]): number[] {
  const kept = new Set(selected);
  return [...new Set(existing)].filter((month) => !kept.has(month)).sort((a, b) => a - b);
}
