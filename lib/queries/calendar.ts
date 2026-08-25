import { prisma } from "@/lib/db";
import { firstDayOfMonth, lastDayOfMonth } from "@/lib/dates";

export interface CalendarEntry {
  id: string;
  date: string;
  clientId: string | null;
  clientName: string | null;
  color: string | null;
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
    include: { client: { select: { name: true, color: true } } },
    orderBy: { date: "asc" },
  });

  return days.map((day) => ({
    id: day.id,
    date: day.date,
    clientId: day.clientId,
    clientName: day.client?.name ?? null,
    color: day.client?.color ?? null,
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
