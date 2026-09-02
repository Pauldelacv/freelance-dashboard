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
import {
  forfaitDate,
  forfaitRevenueByStatus,
  forfaitRevenueIn,
  missionAmount,
  type MissionLike,
} from "@/lib/calculations/missions";

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
  /** CA facturable de l'année en cours — jours travaillés et forfaits. */
  yearRevenue: number;
  totalRevenue: number;
  totalDays: number;
  averageRate: number;
  toInvoice: number;
  awaitingPayment: number;
  lastWorkedDate: string | null;
  /** Nombre de jours saisis, congés compris : ce qui interdit la suppression. */
  workDayCount: number;
}

export async function listClientSummaries(): Promise<ClientSummary[]> {
  const year = todayIso().slice(0, 4);
  const [clients, days, missions] = await Promise.all([
    prisma.client.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.workDay.findMany({ where: { clientId: { not: null } } }),
    prisma.mission.findMany({ where: { billingType: "forfait" } }),
  ]);

  const byClient = new Map<string, WorkDayLike[]>();
  for (const day of days as WorkDayLike[]) {
    if (!day.clientId) continue;
    const list = byClient.get(day.clientId);
    if (list) list.push(day);
    else byClient.set(day.clientId, [day]);
  }

  const missionsByClient = new Map<string, MissionLike[]>();
  for (const mission of missions) {
    const list = missionsByClient.get(mission.clientId);
    if (list) list.push(mission);
    else missionsByClient.set(mission.clientId, [mission]);
  }

  return clients.map((client) => {
    const clientDays = byClient.get(client.id) ?? [];
    const yearDays = clientDays.filter((day) => day.date.startsWith(year));
    const breakdown = revenueByBillingStatus(clientDays);

    // Un client peut n'avoir aucun jour coché et tout de même du CA : c'est
    // exactement le cas d'une mission vendue au forfait.
    const clientMissions = missionsByClient.get(client.id) ?? [];
    const forfaits = forfaitRevenueByStatus(clientMissions);

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
      yearRevenue: totalRevenue(yearDays) + forfaitRevenueIn(clientMissions, year),
      totalRevenue: breakdown.total + forfaits.total,
      totalDays: billableDays(clientDays),
      averageRate: averageRealRate(clientDays),
      toInvoice: breakdown.pending + forfaits.pending,
      awaitingPayment: breakdown.invoiced + forfaits.invoiced,
      lastWorkedDate:
        clientDays.length > 0
          ? clientDays.reduce((latest, day) => (day.date > latest ? day.date : latest), "")
          : null,
      workDayCount: clientDays.length,
    };
  });
}

/** Une mission telle que la fiche client l'affiche et la modifie. */
export interface MissionRow {
  id: string;
  title: string;
  billingType: string;
  /** TJM propre à la mission, en régie. */
  rate: number | null;
  /** Montant convenu, au forfait. */
  forfaitAmount: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  estimatedDays: number | null;
  billing: string;
  billedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  /** Date à laquelle le forfait compte — `null` en régie. */
  countedOn: string | null;
  /** Jours cochés rattachés à la mission : ce qui interdit la suppression. */
  workDayCount: number;
  /** Ces mêmes jours en durée, demi-journées comprises. */
  workedDays: number;
}

export interface ClientDetail extends ClientSummary {
  workedDaysCount: number;
  missions: MissionRow[];
  /** CA des missions au forfait, réparti par statut de facturation. */
  forfaits: { pending: number; invoiced: number; paid: number; total: number };
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
    /** Mission rattachée, pour distinguer un jour au forfait d'un jour à 0 €. */
    missionTitle: string | null;
    missionBillingType: string | null;
  }[];
  /** Périodes regroupées par mois, pour la clôture vers Indy. */
  months: {
    key: string;
    pendingDays: number;
    pendingRevenue: number;
    invoicedDays: number;
    invoicedRevenue: number;
    paidRevenue: number;
    /** TJM le plus fréquent du mois, pour le récapitulatif copiable. */
    rate: number;
  }[];
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      missions: {
        orderBy: [{ status: "asc" }, { title: "asc" }],
        include: { _count: { select: { workDays: true } } },
      },
      workDays: { orderBy: { date: "desc" } },
    },
  });
  if (!client) return null;

  const days = client.workDays as WorkDayLike[];
  const year = todayIso().slice(0, 4);

  // Durée réellement passée par mission : `_count` compte des lignes, pas des
  // journées, et une demi-journée compte pour une demi-journée.
  const daysByMission = new Map<string, number>();
  for (const day of client.workDays) {
    if (!day.missionId || day.type === "off") continue;
    daysByMission.set(day.missionId, (daysByMission.get(day.missionId) ?? 0) + day.fraction);
  }

  const missionTitles = new Map(
    client.missions.map((mission) => [
      mission.id,
      { title: mission.title, billingType: mission.billingType },
    ]),
  );

  const breakdown = revenueByBillingStatus(days);
  const forfaits = forfaitRevenueByStatus(client.missions);

  interface MonthAccumulator {
    pendingDays: number;
    pendingRevenue: number;
    invoicedDays: number;
    invoicedRevenue: number;
    paidRevenue: number;
    rates: Map<number, number>;
  }

  const monthMap = new Map<string, MonthAccumulator>();
  for (const day of days) {
    if (day.type !== "billable") continue;
    const key = day.date.slice(0, 7);
    const entry: MonthAccumulator = monthMap.get(key) ?? {
      pendingDays: 0,
      pendingRevenue: 0,
      invoicedDays: 0,
      invoicedRevenue: 0,
      paidRevenue: 0,
      rates: new Map(),
    };
    const amount = Math.round(day.rate * day.fraction);

    if (day.billing === "pending") {
      entry.pendingDays += day.fraction;
      entry.pendingRevenue += amount;
    } else if (day.billing === "invoiced") {
      entry.invoicedDays += day.fraction;
      entry.invoicedRevenue += amount;
    } else {
      entry.paidRevenue += amount;
    }

    entry.rates.set(day.rate, (entry.rates.get(day.rate) ?? 0) + day.fraction);
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
    yearRevenue:
      totalRevenue(days.filter((day) => day.date.startsWith(year))) +
      forfaitRevenueIn(client.missions, year),
    totalRevenue: breakdown.total + forfaits.total,
    totalDays: billableDays(days),
    averageRate: averageRealRate(days),
    toInvoice: breakdown.pending + forfaits.pending,
    awaitingPayment: breakdown.invoiced + forfaits.invoiced,
    lastWorkedDate: client.workDays[0]?.date ?? null,
    workDayCount: client.workDays.length,
    workedDaysCount: workedDays(days),
    forfaits,
    missions: client.missions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      billingType: mission.billingType,
      rate: mission.rate,
      forfaitAmount: mission.forfaitAmount,
      status: mission.status,
      startDate: mission.startDate,
      endDate: mission.endDate,
      estimatedDays: mission.estimatedDays,
      billing: mission.billing,
      billedAt: mission.billedAt,
      paidAt: mission.paidAt,
      notes: mission.notes,
      countedOn: missionAmount(mission) > 0 ? forfaitDate(mission) : null,
      workDayCount: mission._count.workDays,
      workedDays: daysByMission.get(mission.id) ?? 0,
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
      missionTitle: missionTitles.get(day.missionId ?? "")?.title ?? null,
      missionBillingType: missionTitles.get(day.missionId ?? "")?.billingType ?? null,
    })),
    months: [...monthMap.entries()]
      .map(([key, value]) => {
        const [dominantRate] = [...value.rates.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
          client.defaultRate,
        ];
        return {
          key,
          pendingDays: value.pendingDays,
          pendingRevenue: value.pendingRevenue,
          invoicedDays: value.invoicedDays,
          invoicedRevenue: value.invoicedRevenue,
          paidRevenue: value.paidRevenue,
          rate: dominantRate,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key)),
  };
}

/**
 * Clients sélectionnables dans le calendrier, avec leurs missions en cours.
 *
 * Les missions voyagent avec le client parce que le calendrier doit pouvoir
 * rattacher un jour à l'une d'elles : sans ça, un contrat au forfait n'a
 * aucune date de travail, alors que c'est bien ce qu'on cherche à poser
 * (issue #29). Les missions terminées sont écartées — on ne coche pas des
 * jours sur une prestation livrée.
 */
export async function listActiveClients() {
  const clients = await prisma.client.findMany({
    where: { status: { not: "archived" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      defaultRate: true,
      missions: {
        where: { status: { not: "done" } },
        orderBy: [{ status: "asc" }, { title: "asc" }],
        select: { id: true, title: true, billingType: true, rate: true, forfaitAmount: true },
      },
    },
  });

  return clients.map((client) => ({
    ...client,
    missions: client.missions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      billingType: mission.billingType,
      // TJM figé sur les jours à venir : celui de la mission, sinon celui du
      // client. Au forfait il vaut zéro — le CA est porté par le montant
      // convenu, pas par les jours.
      rate: mission.billingType === "forfait" ? 0 : (mission.rate ?? client.defaultRate),
      forfaitAmount: mission.forfaitAmount,
    })),
  }));
}
