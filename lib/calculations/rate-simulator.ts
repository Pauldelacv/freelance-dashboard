/**
 * Simulateur de TJM — « pour X € net par mois, il me faut un TJM de Z ».
 *
 * Conventions :
 *  - tous les montants sont en **centimes** ;
 *  - `chargeRate` est une fraction (0,261 = 26,1 %) appliquée au chiffre
 *    d'affaires, comme les cotisations du micro-BNC ;
 *  - sans TVA (franchise en base), CA facturé = CA encaissé : on raisonne
 *    directement sur le CA.
 */

export interface SimulationInput {
  /** Jours facturés par mois travaillé. */
  daysPerMonth: number;
  /** Semaines de congés par an — elles réduisent les mois réellement facturés. */
  weeksOff: number;
  /** Taux de cotisations, en fraction. */
  chargeRate: number;
  /** Charges fixes mensuelles (logiciels, assurance…), en centimes. */
  monthlyExpenses?: number;
}

export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

/**
 * Nombre de mois réellement facturés dans l'année, congés déduits.
 * 5 semaines de congés → 47/52 × 12 ≈ 10,85 mois.
 */
export function billableMonthsPerYear(weeksOff: number): number {
  const weeks = Math.min(Math.max(weeksOff, 0), WEEKS_PER_YEAR - 1);
  return ((WEEKS_PER_YEAR - weeks) / WEEKS_PER_YEAR) * MONTHS_PER_YEAR;
}

/** Jours facturés dans l'année, congés déduits. */
export function billableDaysPerYear(input: SimulationInput): number {
  return input.daysPerMonth * billableMonthsPerYear(input.weeksOff);
}

/**
 * Net mensuel obtenu avec un TJM donné.
 * net annuel = CA − cotisations − charges fixes, lissé sur 12 mois.
 */
export function netFromRate(rate: number, input: SimulationInput): number {
  const yearlyRevenue = rate * billableDaysPerYear(input);
  const yearlyExpenses = (input.monthlyExpenses ?? 0) * MONTHS_PER_YEAR;
  const yearlyNet = yearlyRevenue * (1 - input.chargeRate) - yearlyExpenses;
  return Math.round(yearlyNet / MONTHS_PER_YEAR);
}

/**
 * TJM nécessaire pour atteindre un net mensuel visé.
 * C'est l'inverse exact de `netFromRate`.
 */
export function rateFromNet(targetMonthlyNet: number, input: SimulationInput): number {
  const days = billableDaysPerYear(input);
  if (days <= 0 || input.chargeRate >= 1) return 0;

  const yearlyNet = targetMonthlyNet * MONTHS_PER_YEAR;
  const yearlyExpenses = (input.monthlyExpenses ?? 0) * MONTHS_PER_YEAR;
  const yearlyRevenue = (yearlyNet + yearlyExpenses) / (1 - input.chargeRate);
  return Math.max(0, Math.round(yearlyRevenue / days));
}

export interface Simulation {
  rate: number;
  /** Jours facturés par an, congés déduits. */
  billableDays: number;
  yearlyRevenue: number;
  monthlyRevenue: number;
  yearlyCharges: number;
  monthlyNet: number;
  yearlyNet: number;
}

export function simulate(rate: number, input: SimulationInput): Simulation {
  const days = billableDaysPerYear(input);
  const yearlyRevenue = Math.round(rate * days);
  const yearlyCharges = Math.round(yearlyRevenue * input.chargeRate);
  const yearlyExpenses = (input.monthlyExpenses ?? 0) * MONTHS_PER_YEAR;
  const yearlyNet = yearlyRevenue - yearlyCharges - yearlyExpenses;

  return {
    rate,
    billableDays: days,
    yearlyRevenue,
    monthlyRevenue: Math.round(yearlyRevenue / MONTHS_PER_YEAR),
    yearlyCharges,
    monthlyNet: Math.round(yearlyNet / MONTHS_PER_YEAR),
    yearlyNet,
  };
}

export interface RateComparison {
  /** TJM requis pour l'objectif. */
  requiredRate: number;
  /** TJM moyen réellement constaté sur 12 mois (0 si aucun historique). */
  actualRate: number;
  /** Écart en centimes : positif = il faut augmenter. */
  gap: number;
  /** Écart en fraction du TJM réel (0,1 = +10 %). null si pas d'historique. */
  gapRatio: number | null;
}

export function compareToActual(requiredRate: number, actualRate: number): RateComparison {
  return {
    requiredRate,
    actualRate,
    gap: requiredRate - actualRate,
    gapRatio: actualRate > 0 ? (requiredRate - actualRate) / actualRate : null,
  };
}
