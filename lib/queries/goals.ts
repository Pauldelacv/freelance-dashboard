import { prisma } from "@/lib/db";
import { workedMonths } from "@/lib/calculations/goals";

export interface GoalValues {
  revenueTarget: number | null;
  daysTarget: number | null;
}

export interface YearGoals {
  year: number;
  /** Objectif annuel (`month = null`), s'il a été saisi. */
  annual: GoalValues | null;
  /** Objectifs mensuels, indexés par numéro de mois. */
  byMonth: Record<number, GoalValues>;
  /** Mois portant au moins un jour saisi — répartition proposée par défaut. */
  worked: number[];
}

/**
 * Tous les objectifs d'une année en une lecture, plus les mois travaillés.
 *
 * Les objets renvoyés traversent la frontière serveur → client (boîte de
 * dialogue de saisie) : ils ne portent donc que des valeurs sérialisables.
 */
export async function getYearGoals(year: number): Promise<YearGoals> {
  const [goals, days] = await Promise.all([
    prisma.goal.findMany({ where: { year } }),
    prisma.workDay.findMany({
      where: { date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
      select: { date: true },
    }),
  ]);

  const byMonth: Record<number, GoalValues> = {};
  let annual: GoalValues | null = null;

  for (const goal of goals) {
    const values = { revenueTarget: goal.revenueTarget, daysTarget: goal.daysTarget };
    if (goal.month === null) annual = values;
    else byMonth[goal.month] = values;
  }

  return { year, annual, byMonth, worked: workedMonths(days.map((day) => day.date)) };
}
