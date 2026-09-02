import { prisma } from "@/lib/db";
import { firstDayOfMonth, lastDayOfMonth } from "@/lib/dates";
import { forfaitRevenueIn } from "@/lib/calculations/missions";

export interface CalendarEntry {
  id: string;
  date: string;
  clientId: string | null;
  clientName: string | null;
  color: string | null;
  /** Mission rattachée, quand le jour a été posé sur l'une d'elles. */
  missionId: string | null;
  missionTitle: string | null;
  /** "forfait" : le jour ne vaut que du temps passé, son TJM est nul. */
  missionBillingType: string | null;
  fraction: number;
  rate: number;
  type: string;
  billing: string;
  note: string | null;
}

/** Une seule lecture pour toute la période : les vues n'interrogent jamais mois par mois. */
async function getEntriesBetween(from: string, to: string): Promise<CalendarEntry[]> {
  const days = await prisma.workDay.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      client: { select: { name: true, color: true } },
      mission: { select: { title: true, billingType: true } },
    },
    orderBy: { date: "asc" },
  });

  return days.map((day) => ({
    id: day.id,
    date: day.date,
    clientId: day.clientId,
    clientName: day.client?.name ?? null,
    color: day.client?.color ?? null,
    missionId: day.missionId,
    missionTitle: day.mission?.title ?? null,
    missionBillingType: day.mission?.billingType ?? null,
    fraction: day.fraction,
    rate: day.rate,
    type: day.type,
    billing: day.billing,
    note: day.note,
  }));
}

export function getMonthEntries(year: number, month: number): Promise<CalendarEntry[]> {
  return getEntriesBetween(firstDayOfMonth(year, month), lastDayOfMonth(year, month));
}

/** Jours de l'année pour la vue heatmap annuelle — 365 jours en une requête. */
export function getYearEntries(year: number): Promise<CalendarEntry[]> {
  return getEntriesBetween(`${year}-01-01`, `${year}-12-31`);
}

/**
 * CA des missions au forfait rattachées à une période — `prefix` est un mois
 * « AAAA-MM » ou une année « AAAA ».
 *
 * Le pied de calendrier additionne les jours cochés : sans cette lecture, un
 * forfait signé dans le mois serait bien compté sur le tableau de bord et
 * absent ici, pour le même mois. Deux écrans, deux chiffres.
 */
export async function getForfaitRevenue(prefix: string): Promise<number> {
  const missions = await prisma.mission.findMany({ where: { billingType: "forfait" } });
  return forfaitRevenueIn(missions, prefix);
}
