import { formatMonthLabel, isoAddDays } from "@/lib/dates";
import { workDayAmount, type WorkDayLike } from "@/lib/calculations/revenue";

/**
 * Une facture émise dans Indy et pas encore pointée comme encaissée : un
 * client, un mois, un montant — l'unité que l'on valide d'un clic, la même que
 * celle de la clôture de mois sur la fiche client.
 */
export interface AwaitingInvoice {
  /** Clé stable pour React et pour l'action : client + mois. */
  key: string;
  clientId: string | null;
  clientName: string;
  color: string | null;
  month: string;
  monthLabel: string;
  days: number;
  amount: number;
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
export function groupAwaitingInvoices(days: InvoicedDay[], today: string): AwaitingInvoice[] {
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
      clientId: day.clientId ?? null,
      clientName: day.client?.name ?? "Sans client",
      color: day.client?.color ?? null,
      month,
      monthLabel: formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
      days: day.fraction,
      amount,
      billedAt: day.billedAt,
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
