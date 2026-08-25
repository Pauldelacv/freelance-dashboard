import { prisma } from "@/lib/db";
import { isoAddDays, todayIso } from "@/lib/dates";
import {
  buildForecast,
  forecastTotals,
  type CashflowDay,
  type PipelineEntry,
  type WeekBucket,
} from "@/lib/calculations/cashflow";
import { OPEN_STAGES, weightedValue } from "@/lib/calculations/pipeline";

export interface CashflowData {
  weeks: WeekBucket[];
  totals: ReturnType<typeof forecastTotals>;
  /** Le pipeline pondéré est calculé à part : il n'est affiché que sur demande. */
  pipelineWeeks: WeekBucket[];
  pipelineTotal: number;
  clients: { id: string; name: string; color: string }[];
  today: string;
}

export async function getCashflow(): Promise<CashflowData> {
  const today = todayIso();

  const [days, prospects, clients] = await Promise.all([
    prisma.workDay.findMany({
      where: { type: "billable", billing: { in: ["pending", "invoiced"] } },
      include: { client: { select: { name: true, color: true, paymentTerms: true } } },
    }),
    prisma.prospect.findMany({ where: { stage: { in: [...OPEN_STAGES] } } }),
    prisma.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const cashflowDays: CashflowDay[] = days.map((day) => ({
    date: day.date,
    fraction: day.fraction,
    rate: day.rate,
    type: day.type,
    billing: day.billing,
    billedAt: day.billedAt,
    clientId: day.clientId,
    clientName: day.client?.name ?? null,
    color: day.client?.color ?? null,
    paymentTerms: day.client?.paymentTerms ?? 30,
  }));

  // Une affaire gagnée se facture rarement le jour même : on place la valeur
  // pondérée six semaines après la prochaine action prévue.
  const pipeline: PipelineEntry[] = prospects
    .map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      weighted: weightedValue(prospect),
      expectedAt: isoAddDays(prospect.nextActionAt ?? today, 42),
    }))
    .filter((entry) => entry.weighted > 0);

  const weeks = buildForecast(cashflowDays, today);
  const pipelineWeeks = buildForecast([], today, { pipeline });

  return {
    weeks,
    totals: forecastTotals(weeks),
    pipelineWeeks,
    pipelineTotal: forecastTotals(pipelineWeeks).pipeline,
    clients,
    today,
  };
}
