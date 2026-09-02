import { prisma } from "@/lib/db";
import { addMonths, firstDayOfMonth, lastDayOfMonth, monthKey, todayIso } from "@/lib/dates";
import { businessDaysInMonth } from "@/lib/holidays";
import {
  averageRealRate,
  billableDays,
  occupancyRate,
  revenueByBillingStatus,
  revenueByMonth,
  totalRevenue,
  workedDays,
  type WorkDayLike,
} from "@/lib/calculations/revenue";
import {
  groupAwaitingInvoices,
  type AwaitingInvoice,
  type InvoicedForfait,
} from "@/lib/calculations/invoices";
import {
  forfaitDate,
  forfaitRevenueByMonth,
  forfaitRevenueByStatus,
  forfaitRevenueIn,
  missionAmount,
} from "@/lib/calculations/missions";
import { dueProspects, openPipelineValue, weightedValue } from "@/lib/calculations/pipeline";
import {
  collectedInQuarter,
  daysLeft as declarationDaysLeft,
  isOverdue,
  openDeclaration,
} from "@/lib/calculations/urssaf";
import { getSettings } from "@/lib/settings";

export type { AwaitingInvoice };

export interface MonthlyPoint {
  key: string;
  label: string;
  revenue: number;
}

/**
 * Échéance de déclaration trimestrielle URSSAF telle que l'affiche le tableau
 * de bord (issue #31).
 *
 * Elle est envoyée même une fois faite, avec `done` à `true` : c'est le
 * composant client qui décide de ne rien afficher. La renvoyer à `null`
 * démonterait l'encadré à la seconde du clic, et avec lui le « Annuler » qui
 * vient d'apparaître.
 */
export interface DeclarationNotice {
  key: string;
  label: string;
  /** Déclaration marquée faite : l'encadré ne s'affiche plus. */
  done: boolean;
  /** Date limite, et jours restants (négatifs une fois passée). */
  dueAt: string;
  daysLeft: number;
  overdue: boolean;
  /** CA encaissé sur le trimestre : le montant à reporter dans la déclaration. */
  collected: number;
  /** Cotisations estimées au taux des réglages. */
  charges: number;
}

export interface DashboardSummary {
  year: number;
  month: number;
  /** CA facturable du mois en cours, jours et forfaits confondus, en centimes. */
  monthRevenue: number;
  /**
   * Part de `monthRevenue` venue d'un forfait rattaché au mois : ces missions
   * n'occupent aucune case du calendrier, et sans ce chiffre à part le total
   * du mois grimperait sans qu'on sache pourquoi (issue #27).
   */
  monthForfaitRevenue: number;
  monthBillableDays: number;
  monthWorkedDays: number;
  monthBusinessDays: number;
  occupancy: number;
  /** TJM moyen réel constaté sur les 12 derniers mois. */
  averageRate: number;
  /** Jours facturables pas encore facturés dans Indy, toutes périodes. */
  toInvoice: number;
  /** Facturé dans Indy, pas encore encaissé. */
  awaitingPayment: number;
  collectedThisYear: number;
  /** Factures émises restant à pointer, de la plus ancienne à la plus récente. */
  awaitingInvoices: AwaitingInvoice[];
  /** Déclaration trimestrielle URSSAF ouverte à la date du jour. */
  declaration: DeclarationNotice;
  revenueTarget: number | null;
  daysTarget: number | null;
  last12Months: MonthlyPoint[];
  clientCount: number;
  /** Pipeline pondéré des affaires encore ouvertes. */
  pipelineValue: number;
  /** Prospects dont la relance est due ou en retard. */
  dueProspects: {
    id: string;
    name: string;
    company: string | null;
    nextAction: string | null;
    nextActionAt: string | null;
    weighted: number;
    late: boolean;
  }[];
}

/** Les 12 derniers mois, du plus ancien au mois en cours. */
function last12MonthKeys(year: number, month: number): { year: number; month: number }[] {
  return Array.from({ length: 12 }, (_, index) => addMonths(year, month, index - 11));
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const windowStart = addMonths(year, month, -11);
  const from = firstDayOfMonth(windowStart.year, windowStart.month);
  const to = lastDayOfMonth(year, month);

  // La déclaration ouverte ne dépend que de la date : on la connaît avant
  // d'interroger la base, ce qui permet de ne lire que ses encaissements.
  const declaration = openDeclaration(today);

  const [
    windowDays,
    pendingDays,
    invoicedDays,
    yearDays,
    quarterPaidDays,
    missions,
    goal,
    settings,
    clientCount,
    prospects,
  ] = await Promise.all([
    prisma.workDay.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.workDay.findMany({ where: { billing: "pending", type: "billable" } }),
    prisma.workDay.findMany({
      where: { billing: "invoiced", type: "billable" },
      include: { client: { select: { name: true, color: true, paymentTerms: true } } },
    }),
    prisma.workDay.findMany({
      where: { date: { gte: `${year}-01-01`, lte: `${year}-12-31` }, billing: "paid" },
    }),
    // Filtré sur la date d'**encaissement** et non sur celle du travail :
    // c'est le CA encaissé du trimestre qui se déclare à l'URSSAF.
    prisma.workDay.findMany({
      where: {
        billing: "paid",
        type: "billable",
        paidAt: { gte: declaration.from, lte: declaration.to },
      },
    }),
    // Les forfaits ne passent par aucun jour coché : sans cette lecture, tout
    // un pan du CA manquerait à l'écran d'accueil.
    prisma.mission.findMany({
      where: { billingType: "forfait" },
      include: { client: { select: { name: true, color: true, paymentTerms: true } } },
    }),
    prisma.goal.findFirst({ where: { year, month } }),
    getSettings(),
    prisma.client.count({ where: { status: "active" } }),
    prisma.prospect.findMany({ where: { stage: { in: ["contacted", "quoted"] } } }),
  ]);

  const days = windowDays as WorkDayLike[];
  const monthDays = days.filter((day) => day.date.startsWith(monthKey(year, month)));
  const byMonth = revenueByMonth(days);
  const forfaitsByMonth = forfaitRevenueByMonth(missions);
  const forfaits = forfaitRevenueByStatus(missions);
  const businessDays = businessDaysInMonth(year, month);
  const monthForfaitRevenue = forfaitRevenueIn(missions, monthKey(year, month));
  const collected = collectedInQuarter(quarterPaidDays, missions, declaration);

  const invoicedForfaits: InvoicedForfait[] = missions
    .filter((mission) => mission.billing === "invoiced" && missionAmount(mission) > 0)
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      amount: missionAmount(mission),
      date: forfaitDate(mission),
      billedAt: mission.billedAt,
      clientId: mission.clientId,
      client: mission.client,
    }));

  return {
    year,
    month,
    monthRevenue: totalRevenue(monthDays) + monthForfaitRevenue,
    monthForfaitRevenue,
    monthBillableDays: billableDays(monthDays),
    monthWorkedDays: workedDays(monthDays),
    monthBusinessDays: businessDays,
    occupancy: occupancyRate(monthDays, businessDays),
    averageRate: averageRealRate(days),
    toInvoice: totalRevenue(pendingDays as WorkDayLike[]) + forfaits.pending,
    awaitingPayment: totalRevenue(invoicedDays as WorkDayLike[]) + forfaits.invoiced,
    collectedThisYear:
      revenueByBillingStatus(yearDays as WorkDayLike[]).paid +
      forfaitRevenueIn(
        missions.filter((mission) => mission.billing === "paid"),
        String(year),
      ),
    awaitingInvoices: groupAwaitingInvoices(invoicedDays, today, invoicedForfaits),
    declaration: {
      key: declaration.key,
      label: declaration.label,
      done: settings.urssaf.done.includes(declaration.key),
      dueAt: declaration.dueAt,
      daysLeft: declarationDaysLeft(declaration, today),
      overdue: isOverdue(declaration, today),
      collected,
      charges: Math.round(collected * settings.tax.chargeRate),
    },
    revenueTarget: goal?.revenueTarget ?? settings.goals.monthlyRevenue,
    daysTarget: goal?.daysTarget ?? settings.goals.monthlyDays,
    last12Months: last12MonthKeys(year, month).map((point) => ({
      key: monthKey(point.year, point.month),
      label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
        new Date(Date.UTC(point.year, point.month - 1, 15)),
      ),
      revenue:
        (byMonth.get(monthKey(point.year, point.month)) ?? 0) +
        (forfaitsByMonth.get(monthKey(point.year, point.month)) ?? 0),
    })),
    clientCount,
    pipelineValue: openPipelineValue(prospects),
    dueProspects: dueProspects(prospects, today).map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      company: prospect.company,
      nextAction: prospect.nextAction,
      nextActionAt: prospect.nextActionAt,
      weighted: weightedValue(prospect),
      late: (prospect.nextActionAt ?? today) < today,
    })),
  };
}
