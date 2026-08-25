/**
 * Prévisionnel de trésorerie sur 12 semaines.
 *
 * Aucune facture n'existe dans l'application (Indy s'en charge) : les
 * encaissements attendus se déduisent des jours travaillés.
 *  - jour *facturé*   → date de facture + délai de paiement du client → **certain**
 *  - jour *à facturer* → fin du mois + délai de paiement               → **probable**
 *  - jour *encaissé*  → déjà rentré, hors prévisionnel
 */
import { isoAddDays, lastDayOfMonth, startOfWeekIso } from "@/lib/dates";
import { dayAmount } from "@/lib/money";

export interface CashflowDay {
  date: string;
  fraction: number;
  rate: number;
  type: string;
  billing: string;
  billedAt: string | null;
  clientId: string | null;
  clientName: string | null;
  color: string | null;
  paymentTerms: number;
}

export interface PipelineEntry {
  id: string;
  name: string;
  weighted: number;
  expectedAt: string;
}

export interface WeekBucket {
  /** Lundi de la semaine. */
  weekStart: string;
  /** Déjà facturé dans Indy : encaissement quasi sûr. */
  certain: number;
  /** Jours travaillés pas encore facturés. */
  probable: number;
  /** Pipeline prospects pondéré, si l'option est activée. */
  pipeline: number;
  byClient: { clientId: string; name: string; color: string; amount: number }[];
}

/** Date d'encaissement attendue pour un jour travaillé. */
export function expectedPaymentDate(day: CashflowDay): string {
  const base =
    day.billing === "invoiced" && day.billedAt
      ? day.billedAt
      : lastDayOfMonth(Number(day.date.slice(0, 4)), Number(day.date.slice(5, 7)));
  return isoAddDays(base, day.paymentTerms);
}

function emptyBucket(weekStart: string): WeekBucket {
  return { weekStart, certain: 0, probable: 0, pipeline: 0, byClient: [] };
}

function addToClient(bucket: WeekBucket, day: CashflowDay, amount: number) {
  const clientId = day.clientId ?? "";
  const existing = bucket.byClient.find((entry) => entry.clientId === clientId);
  if (existing) existing.amount += amount;
  else
    bucket.byClient.push({
      clientId,
      name: day.clientName ?? "Sans client",
      color: day.color ?? "#94a3b8",
      amount,
    });
}

export interface ForecastOptions {
  weeks?: number;
  pipeline?: PipelineEntry[];
}

/**
 * Répartit les encaissements attendus sur les prochaines semaines.
 * Ce qui est déjà en retard est reporté sur la première semaine — c'est de
 * l'argent attendu maintenant, pas de l'argent perdu.
 */
export function buildForecast(
  days: CashflowDay[],
  today: string,
  options: ForecastOptions = {},
): WeekBucket[] {
  const weeks = options.weeks ?? 12;
  const firstWeek = startOfWeekIso(today);

  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, index) =>
    emptyBucket(isoAddDays(firstWeek, index * 7)),
  );
  const lastWeek = buckets[buckets.length - 1].weekStart;

  for (const day of days) {
    if (day.type !== "billable" || day.billing === "paid") continue;
    const amount = dayAmount(day.rate, day.fraction);
    if (amount === 0) continue;

    const week = startOfWeekIso(expectedPaymentDate(day));
    if (week > lastWeek) continue;

    const bucket = buckets.find((item) => item.weekStart === (week < firstWeek ? firstWeek : week));
    if (!bucket) continue;

    if (day.billing === "invoiced") bucket.certain += amount;
    else bucket.probable += amount;
    addToClient(bucket, day, amount);
  }

  for (const entry of options.pipeline ?? []) {
    const week = startOfWeekIso(entry.expectedAt);
    if (week > lastWeek) continue;
    const bucket = buckets.find((item) => item.weekStart === (week < firstWeek ? firstWeek : week));
    if (bucket) bucket.pipeline += entry.weighted;
  }

  for (const bucket of buckets) {
    bucket.byClient.sort((a, b) => b.amount - a.amount);
  }

  return buckets;
}

export interface ForecastTotals {
  certain: number;
  probable: number;
  pipeline: number;
  total: number;
  /** Encaissements attendus dans les 4 prochaines semaines. */
  nextMonth: number;
}

export function forecastTotals(buckets: WeekBucket[]): ForecastTotals {
  const totals = buckets.reduce(
    (accumulator, bucket) => ({
      certain: accumulator.certain + bucket.certain,
      probable: accumulator.probable + bucket.probable,
      pipeline: accumulator.pipeline + bucket.pipeline,
    }),
    { certain: 0, probable: 0, pipeline: 0 },
  );

  const nextMonth = buckets
    .slice(0, 4)
    .reduce((sum, bucket) => sum + bucket.certain + bucket.probable, 0);

  return {
    ...totals,
    total: totals.certain + totals.probable + totals.pipeline,
    nextMonth,
  };
}
