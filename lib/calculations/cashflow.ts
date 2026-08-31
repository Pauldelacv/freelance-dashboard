/**
 * Prévisionnel de trésorerie sur 12 semaines.
 *
 * Aucune facture n'existe dans l'application (Indy s'en charge) : les
 * encaissements attendus se déduisent des jours travaillés.
 *  - jour *facturé*   → date de facture + délai de paiement du client → **certain**
 *  - jour *à facturer* → fin du mois + délai de paiement               → **probable**
 *  - jour *encaissé*  → déjà rentré, hors prévisionnel
 *
 * Une mission au forfait suit exactement la même règle : elle entre ici comme
 * un montant unique daté (voir `lib/calculations/missions.ts`), et se range
 * dans le certain ou le probable selon qu'elle est facturée ou non.
 */
import { isoAddDays, lastDayOfMonth, startOfWeekIso } from "@/lib/dates";
import { dayAmount } from "@/lib/money";

/** Ce qu'il faut pour dater un encaissement : un rattachement et un délai. */
export interface Schedulable {
  /** Date de rattachement : le jour travaillé, ou la date du forfait. */
  date: string;
  billing: string;
  billedAt: string | null;
  paymentTerms: number;
}

export interface CashflowDay extends Schedulable {
  fraction: number;
  rate: number;
  type: string;
  clientId: string | null;
  clientName: string | null;
  color: string | null;
}

/** Ce que le prévisionnel manipule réellement : une somme, une date, un client. */
interface CashflowItem extends Schedulable {
  amount: number;
  clientId: string | null;
  clientName: string | null;
  color: string | null;
}

/** Une mission au forfait : elle entre déjà sous cette forme, sans conversion. */
export type CashflowForfait = CashflowItem;

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

/** Date d'encaissement attendue pour un jour travaillé ou un forfait. */
export function expectedPaymentDate(item: Schedulable): string {
  const base =
    item.billing === "invoiced" && item.billedAt
      ? item.billedAt
      : lastDayOfMonth(Number(item.date.slice(0, 4)), Number(item.date.slice(5, 7)));
  return isoAddDays(base, item.paymentTerms);
}

function emptyBucket(weekStart: string): WeekBucket {
  return { weekStart, certain: 0, probable: 0, pipeline: 0, byClient: [] };
}

function addToClient(bucket: WeekBucket, item: CashflowItem) {
  const clientId = item.clientId ?? "";
  const existing = bucket.byClient.find((entry) => entry.clientId === clientId);
  if (existing) existing.amount += item.amount;
  else
    bucket.byClient.push({
      clientId,
      name: item.clientName ?? "Sans client",
      color: item.color ?? "#94a3b8",
      amount: item.amount,
    });
}

export interface ForecastOptions {
  weeks?: number;
  pipeline?: PipelineEntry[];
  /** Missions au forfait à facturer ou facturées. */
  forfaits?: CashflowForfait[];
}

/**
 * Jours et forfaits ramenés à une même liste de sommes datées. Ce qui est déjà
 * encaissé, ou n'est pas facturable, n'attend plus rien : il sort ici.
 */
function schedulableItems(days: CashflowDay[], forfaits: CashflowForfait[]): CashflowItem[] {
  const items: CashflowItem[] = [];

  for (const day of days) {
    if (day.type !== "billable" || day.billing === "paid") continue;
    const amount = dayAmount(day.rate, day.fraction);
    if (amount === 0) continue;
    items.push({ ...day, amount });
  }

  for (const forfait of forfaits) {
    if (forfait.billing === "paid" || forfait.amount === 0) continue;
    items.push(forfait);
  }

  return items;
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

  for (const item of schedulableItems(days, options.forfaits ?? [])) {
    const week = startOfWeekIso(expectedPaymentDate(item));
    if (week > lastWeek) continue;

    const bucket = buckets.find(
      (candidate) => candidate.weekStart === (week < firstWeek ? firstWeek : week),
    );
    if (!bucket) continue;

    if (item.billing === "invoiced") bucket.certain += item.amount;
    else bucket.probable += item.amount;
    addToClient(bucket, item);
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
