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

export async function getMonthEntries(year: number, month: number): Promise<CalendarEntry[]> {
  const days = await prisma.workDay.findMany({
    where: {
      date: { gte: firstDayOfMonth(year, month), lte: lastDayOfMonth(year, month) },
    },
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

/** Jours de l'année pour la vue heatmap annuelle. */
export async function getYearEntries(year: number) {
  return prisma.workDay.findMany({
    where: { date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
    include: { client: { select: { name: true, color: true } } },
    orderBy: { date: "asc" },
  });
}
