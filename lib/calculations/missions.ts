/**
 * Missions au forfait — un montant convenu d'avance, indépendant des jours
 * passés (issue #20).
 *
 * En **régie**, le CA se déduit des jours cochés dans le calendrier : le TJM
 * figé sur chaque `WorkDay` fait foi, et la mission ne sert qu'à porter un TJM
 * particulier. Au **forfait**, il n'y a pas de jours à multiplier : la mission
 * porte elle-même son montant et son statut de facturation, sur le modèle
 * exact du `WorkDay` (à facturer → facturé → encaissé). La facture, elle,
 * reste dans Indy.
 *
 * Reste une question que la régie ne pose pas : **à quelle date un forfait
 * compte-t-il ?** Un montant unique n'a pas de jour de travail. On retient, dans
 * l'ordre : la date de facture, la fin de mission, son début, à défaut le jour
 * de sa création. C'est cette date qui décide du mois où le forfait apparaît
 * dans le CA et du point de départ de l'encaissement attendu.
 */
import { toIsoDate } from "@/lib/dates";
import type { RevenueBreakdown } from "@/lib/calculations/revenue";

export const MISSION_BILLING_TYPES = ["regie", "forfait"] as const;
export type MissionBillingType = (typeof MISSION_BILLING_TYPES)[number];

export const MISSION_STATUSES = ["active", "done", "paused"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/** Vue minimale d'une mission : tout ce dont les calculs ont besoin. */
export interface MissionLike {
  billingType: string;
  forfaitAmount: number | null;
  billing: string;
  billedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
}

export function isForfait(mission: Pick<MissionLike, "billingType">): boolean {
  return mission.billingType === "forfait";
}

/**
 * Montant d'une mission au forfait. Zéro pour une mission en régie : son CA
 * est celui de ses jours, l'ajouter ici le compterait deux fois.
 */
export function missionAmount(mission: MissionLike): number {
  if (!isForfait(mission) || mission.forfaitAmount === null) return 0;
  return Math.max(0, Math.round(mission.forfaitAmount));
}

/** Date à laquelle un forfait compte — voir l'en-tête du fichier. */
export function forfaitDate(mission: MissionLike): string {
  return mission.billedAt ?? mission.endDate ?? mission.startDate ?? toIsoDate(mission.createdAt);
}

/** Les seules missions qui portent du CA : celles au forfait, avec un montant. */
export function forfaits(missions: MissionLike[]): MissionLike[] {
  return missions.filter((mission) => missionAmount(mission) > 0);
}

/** Répartition à facturer / facturé / encaissé, comme pour les jours. */
export function forfaitRevenueByStatus(missions: MissionLike[]): RevenueBreakdown {
  const breakdown: RevenueBreakdown = { pending: 0, invoiced: 0, paid: 0, total: 0 };
  for (const mission of forfaits(missions)) {
    const amount = missionAmount(mission);
    if (mission.billing === "invoiced") breakdown.invoiced += amount;
    else if (mission.billing === "paid") breakdown.paid += amount;
    else breakdown.pending += amount;
    breakdown.total += amount;
  }
  return breakdown;
}

/** CA des forfaits par mois, clé "YYYY-MM" — même forme que pour les jours. */
export function forfaitRevenueByMonth(missions: MissionLike[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const mission of forfaits(missions)) {
    const key = forfaitDate(mission).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + missionAmount(mission));
  }
  return byMonth;
}

/**
 * CA des forfaits rattachés à une période, désignée par son préfixe ISO :
 * "2026" pour une année, "2026-08" pour un mois.
 */
export function forfaitRevenueIn(missions: MissionLike[], prefix: string): number {
  return forfaits(missions)
    .filter((mission) => forfaitDate(mission).startsWith(prefix))
    .reduce((sum, mission) => sum + missionAmount(mission), 0);
}
