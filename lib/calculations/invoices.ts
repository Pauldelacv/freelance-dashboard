import { formatMonthLabel, isoAddDays } from "@/lib/dates";
import { workDayAmount, type WorkDayLike } from "@/lib/calculations/revenue";

/**
 * Une facture émise dans Indy et pas encore pointée comme encaissée : un
 * client, un mois, un montant — l'unité que l'on valide d'un clic, la même que
 * celle de la clôture de mois sur la fiche client.
 */
export interface AwaitingInvoice {
  /** Clé stable pour React et pour l'action : client + mois, ou mission. */
  key: string;
  /**
   * Ce que le pointage doit déplacer : les jours d'un mois, ou une mission au
   * forfait — qui porte son statut elle-même et n'a pas de jours à parcourir.
   */
  kind: "days" | "mission";
  clientId: string | null;
  /** Renseigné pour un forfait, `null` pour un mois de jours travaillés. */
  missionId: string | null;
  clientName: string;
  color: string | null;
  month: string;
  monthLabel: string;
  /** Nombre de jours facturés — zéro pour un forfait, qui ne s'en compte pas. */
  days: number;
  amount: number;
  /** Intitulé de la mission, pour distinguer deux forfaits du même mois. */
  label: string | null;
  /** Date de la facture Indy, quand elle a été renseignée. */
  billedAt: string | null;
  /** Échéance théorique : date de facture + délai de paiement du client. */
  dueAt: string | null;
  late: boolean;
}

/** Jour facturé, tel qu'il est lu avec son client. */
export type InvoicedDay = WorkDayLike & {
  billedAt: string | null;
  client: { name: string; color: string; paymentTerms: number } | null;
};

/** Mission au forfait facturée dans Indy, en attente de règlement. */
export interface InvoicedForfait {
  id: string;
  title: string;
  amount: number;
  /** Date de rattachement du forfait — voir `lib/calculations/missions.ts`. */
  date: string;
  billedAt: string | null;
  clientId: string;
  client: { name: string; color: string; paymentTerms: number } | null;
}

/** Délai de paiement retenu quand le jour n'est rattaché à aucun client. */
export const DEFAULT_PAYMENT_TERMS = 30;

/**
 * Les jours facturés regroupés par client et par mois — c'est-à-dire par
 * facture : la clôture de mois en émet une par client et par période, pointer
 * jour par jour n'aurait donc aucun sens.
 *
 * L'échéance retenue est celle de la facture la plus ancienne du lot : c'est
 * elle qui décide si le paiement est en retard.
 */
export function groupAwaitingInvoices(
  days: InvoicedDay[],
  today: string,
  forfaits: InvoicedForfait[] = [],
): AwaitingInvoice[] {
  const groups = new Map<string, AwaitingInvoice>();
  const terms = new Map<string, number>();

  for (const day of days) {
    const amount = workDayAmount(day);
    if (amount === 0) continue;

    const month = day.date.slice(0, 7);
    const key = `${day.clientId ?? ""}|${month}`;
    terms.set(key, day.client?.paymentTerms ?? DEFAULT_PAYMENT_TERMS);

    const existing = groups.get(key);
    if (existing) {
      existing.days += day.fraction;
      existing.amount += amount;
      if (day.billedAt && (!existing.billedAt || day.billedAt < existing.billedAt)) {
        existing.billedAt = day.billedAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      kind: "days",
      clientId: day.clientId ?? null,
      missionId: null,
      clientName: day.client?.name ?? "Sans client",
      color: day.client?.color ?? null,
      month,
      monthLabel: formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
      days: day.fraction,
      amount,
      label: null,
      billedAt: day.billedAt,
      dueAt: null,
      late: false,
    });
  }

  // Un forfait ne se regroupe avec rien : c'est une facture à lui seul, et deux
  // forfaits d'un même client se pointent séparément.
  for (const forfait of forfaits) {
    if (forfait.amount === 0) continue;
    const reference = forfait.billedAt ?? forfait.date;
    const month = reference.slice(0, 7);
    const key = `mission|${forfait.id}`;
    terms.set(key, forfait.client?.paymentTerms ?? DEFAULT_PAYMENT_TERMS);

    groups.set(key, {
      key,
      kind: "mission",
      clientId: forfait.clientId,
      missionId: forfait.id,
      clientName: forfait.client?.name ?? "Sans client",
      color: forfait.client?.color ?? null,
      month,
      monthLabel: formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
      days: 0,
      amount: forfait.amount,
      label: forfait.title,
      billedAt: forfait.billedAt,
      dueAt: null,
      late: false,
    });
  }

  return [...groups.values()]
    .map((group) => {
      const paymentTerms = terms.get(group.key) ?? DEFAULT_PAYMENT_TERMS;
      const dueAt = group.billedAt ? isoAddDays(group.billedAt, paymentTerms) : null;
      return { ...group, dueAt, late: dueAt !== null && dueAt < today };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.clientName.localeCompare(b.clientName));
}
