import { prisma } from "@/lib/db";
import { addMonths, firstDayOfMonth, lastDayOfMonth, todayIso } from "@/lib/dates";
import { averageRealRate, billableDays, type WorkDayLike } from "@/lib/calculations/revenue";
import { getSettings } from "@/lib/settings";

export interface SimulatorContext {
  chargeRate: number;
  /** TJM moyen réellement constaté sur 12 mois glissants, en centimes. */
  actualRate: number;
  /** Moyenne de jours facturables par mois sur la même période. */
  actualDaysPerMonth: number;
  /** Objectif de CA mensuel s'il est défini, pour pré-remplir le simulateur. */
  monthlyRevenueTarget: number | null;
}

export async function getSimulatorContext(): Promise<SimulatorContext> {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = addMonths(year, month, -11);

  const [days, settings] = await Promise.all([
    prisma.workDay.findMany({
      where: {
        date: {
          gte: firstDayOfMonth(start.year, start.month),
          lte: lastDayOfMonth(year, month),
        },
      },
    }),
    getSettings(),
  ]);

  const typed = days as WorkDayLike[];
  const monthsWithActivity = new Set(typed.map((day) => day.date.slice(0, 7))).size;

  return {
    chargeRate: settings.tax.chargeRate,
    actualRate: averageRealRate(typed),
    actualDaysPerMonth:
      monthsWithActivity > 0 ? Math.round((billableDays(typed) / monthsWithActivity) * 10) / 10 : 0,
    monthlyRevenueTarget: settings.goals.monthlyRevenue,
  };
}
