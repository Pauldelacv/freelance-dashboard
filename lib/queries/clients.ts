import { prisma } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import {
  averageRealRate,
  billableDays,
  revenueByBillingStatus,
  totalRevenue,
  workedDays,
  type WorkDayLike,
} from "@/lib/calculations/revenue";

export interface ClientSummary {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  defaultRate: number;
  color: string;
  status: string;
  paymentTerms: number;
  notes: string | null;
  /** CA facturable de l'année en cours. */
  yearRevenue: number;
  totalRevenue: number;
  totalDays: number;
  averageRate: number;
  toInvoice: number;
  awaitingPayment: number;
  lastWorkedDate: string | null;
}

export async function listClientSummaries(): Promise<ClientSummary[]> {
  const year = todayIso().slice(0, 4);
  const [clients, days] = await Promise.all([
    prisma.client.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.workDay.findMany({ where: { clientId: { not: null } } }),
  ]);

  const byClient = new Map<string, WorkDayLike[]>();
  for (const day of days as WorkDayLike[]) {
    if (!day.clientId) continue;
    const list = byClient.get(day.clientId);
    if (list) list.push(day);
    else byClient.set(day.clientId, [day]);
  }

  return clients.map((client) => {
    const clientDays = byClient.get(client.id) ?? [];
    const yearDays = clientDays.filter((day) => day.date.startsWith(year));
    const breakdown = revenueByBillingStatus(clientDays);

    return {
      id: client.id,
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      defaultRate: client.defaultRate,
      color: client.color,
      status: client.status,
      paymentTerms: client.paymentTerms,
      notes: client.notes,
      yearRevenue: totalRevenue(yearDays),
      totalRevenue: breakdown.total,
      totalDays: billableDays(clientDays),
      averageRate: averageRealRate(clientDays),
      toInvoice: breakdown.pending,
      awaitingPayment: breakdown.invoiced,
      lastWorkedDate:
        clientDays.length > 0
          ? clientDays.reduce((latest, day) => (day.date > latest ? day.date : latest), "")
          : null,
    };
  });
}

export interface ClientDetail extends ClientSummary {
  workedDaysCount: number;
  missions: {
    id: string;
    title: string;
    rate: number | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }[];
  /** Jours du client, du plus récent au plus ancien. */
  days: {
    id: string;
    date: string;
    fraction: number;
    rate: number;
    type: string;
    billing: string;
    billedAt: string | null;
    note: string | null;
    missionId: string | null;
  }[];
  /** Périodes facturables regroupées par mois, pour la clôture vers Indy. */
  months: {
    key: string;
    pendingDays: number;
    pendingRevenue: number;
  }[];
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      missions: { orderBy: { title: "asc" } },
      workDays: { orderBy: { date: "desc" } },
    },
  });
  if (!client) return null;

  const days = client.workDays as WorkDayLike[];
  const year = todayIso().slice(0, 4);
  const breakdown = revenueByBillingStatus(days);

  const monthMap = new Map<string, { pendingDays: number; pendingRevenue: number }>();
  for (const day of days) {
    if (day.type !== "billable" || day.billing !== "pending") continue;
    const key = day.date.slice(0, 7);
    const entry = monthMap.get(key) ?? { pendingDays: 0, pendingRevenue: 0 };
    entry.pendingDays += day.fraction;
    entry.pendingRevenue += Math.round(day.rate * day.fraction);
    monthMap.set(key, entry);
  }

  return {
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    defaultRate: client.defaultRate,
    color: client.color,
    status: client.status,
    paymentTerms: client.paymentTerms,
    notes: client.notes,
    yearRevenue: totalRevenue(days.filter((day) => day.date.startsWith(year))),
    totalRevenue: breakdown.total,
    totalDays: billableDays(days),
    averageRate: averageRealRate(days),
    toInvoice: breakdown.pending,
    awaitingPayment: breakdown.invoiced,
    lastWorkedDate: client.workDays[0]?.date ?? null,
    workedDaysCount: workedDays(days),
    missions: client.missions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      rate: mission.rate,
      status: mission.status,
      startDate: mission.startDate,
      endDate: mission.endDate,
    })),
    days: client.workDays.map((day) => ({
      id: day.id,
      date: day.date,
      fraction: day.fraction,
      rate: day.rate,
      type: day.type,
      billing: day.billing,
      billedAt: day.billedAt,
      note: day.note,
      missionId: day.missionId,
    })),
    months: [...monthMap.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.key.localeCompare(a.key)),
  };
}

/** Clients sélectionnables dans le calendrier. */
export async function listActiveClients() {
  return prisma.client.findMany({
    where: { status: { not: "archived" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, defaultRate: true },
  });
}
