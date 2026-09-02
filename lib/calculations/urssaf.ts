/**
 * Échéances de déclaration trimestrielle URSSAF (issue #31).
 *
 * Le dashboard ne déclare rien : la déclaration se fait sur le site de
 * l'URSSAF, la comptabilité reste dans Indy. Ce qu'il sait faire, en revanche,
 * c'est **ne pas laisser passer la date** — et rappeler le montant à saisir.
 *
 * Le calendrier du micro-entrepreneur en déclaration trimestrielle est fixe :
 * une déclaration s'ouvre le 1ᵉʳ du mois qui suit le trimestre et se termine à
 * la fin de ce même mois.
 *
 *  | trimestre déclaré | ouverture | date limite |
 *  | ----------------- | --------- | ----------- |
 *  | janvier → mars    | 1ᵉʳ avril | 30 avril    |
 *  | avril → juin      | 1ᵉʳ juil. | 31 juillet  |
 *  | juillet → sept.   | 1ᵉʳ oct.  | 31 octobre  |
 *  | octobre → déc.    | 1ᵉʳ janv. | 31 janvier  |
 *
 * Il en découle qu'à toute date **une seule** déclaration est ouverte : celle
 * du trimestre précédent. Elle laisse la place à la suivante au trimestre
 * d'après — le rappel ne s'accumule donc jamais.
 *
 * Ce qui se déclare est le **CA encaissé** du trimestre, pas le CA facturé :
 * on additionne donc les jours et les forfaits pointés « encaissé », à leur
 * date d'encaissement.
 */
import { daysInMonth, isoDaysBetween, monthKey, monthOf, yearOf } from "@/lib/dates";
import type { WorkDayLike } from "@/lib/calculations/revenue";
import { workDayAmount } from "@/lib/calculations/revenue";
import { forfaits, missionAmount, type MissionLike } from "@/lib/calculations/missions";

/** Libellés ordinaux, dans la typographie du reste de l'application. */
const ORDINALS = ["1ᵉʳ", "2ᵉ", "3ᵉ", "4ᵉ"];

export interface Declaration {
  /** "2026-T2" — clé stable, c'est elle que l'utilisateur masque. */
  key: string;
  /** Année du trimestre déclaré (pas celle de l'échéance : T4 se déclare en N+1). */
  year: number;
  /** 1 à 4. */
  quarter: number;
  /** « 2ᵉ trimestre 2026 » */
  label: string;
  /** Premier et dernier jour du trimestre déclaré. */
  from: string;
  to: string;
  /** Ouverture de la déclaration : le 1ᵉʳ du mois qui suit le trimestre. */
  opensAt: string;
  /** Date limite : la fin de ce même mois. */
  dueAt: string;
}

/** Trimestre (1–4) contenant une date ISO. */
export function quarterOf(iso: string): number {
  return Math.floor((monthOf(iso) - 1) / 3) + 1;
}

/** Le trimestre qui précède, en changeant d'année au passage de janvier. */
function previousQuarter(year: number, quarter: number): { year: number; quarter: number } {
  return quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
}

/** Description complète d'un trimestre et de son échéance. */
export function declarationFor(year: number, quarter: number): Declaration {
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = firstMonth + 2;
  // Le mois de déclaration suit le trimestre : T4 se déclare en janvier N+1.
  const dueYear = quarter === 4 ? year + 1 : year;
  const dueMonth = quarter === 4 ? 1 : lastMonth + 1;

  return {
    key: `${year}-T${quarter}`,
    year,
    quarter,
    label: `${ORDINALS[quarter - 1]} trimestre ${year}`,
    from: `${monthKey(year, firstMonth)}-01`,
    to: `${monthKey(year, lastMonth)}-${String(daysInMonth(year, lastMonth)).padStart(2, "0")}`,
    opensAt: `${monthKey(dueYear, dueMonth)}-01`,
    dueAt: `${monthKey(dueYear, dueMonth)}-${String(daysInMonth(dueYear, dueMonth)).padStart(2, "0")}`,
  };
}

/**
 * La déclaration ouverte à une date donnée : celle du trimestre précédent.
 * Il y en a toujours exactement une, du 1ᵉʳ jour du trimestre au dernier.
 */
export function openDeclaration(today: string): Declaration {
  const { year, quarter } = previousQuarter(yearOf(today), quarterOf(today));
  return declarationFor(year, quarter);
}

/** Jours restants avant la date limite : négatif une fois celle-ci passée. */
export function daysLeft(declaration: Declaration, today: string): number {
  return isoDaysBetween(today, declaration.dueAt);
}

export function isOverdue(declaration: Declaration, today: string): boolean {
  return today > declaration.dueAt;
}

/** Un jour ou un forfait n'entre dans une déclaration qu'une fois encaissé. */
function paidWithin(paidAt: string | null, declaration: Declaration): boolean {
  return paidAt !== null && paidAt >= declaration.from && paidAt <= declaration.to;
}

/**
 * CA encaissé sur le trimestre — le montant à reporter dans la déclaration.
 *
 * Il est *indicatif* : il ne vaut que ce que valent les pointages
 * « encaissé » du dashboard, et c'est la banque, pas lui, qui fait foi.
 */
export function collectedInQuarter(
  days: (WorkDayLike & { paidAt: string | null })[],
  missions: MissionLike[],
  declaration: Declaration,
): number {
  const fromDays = days
    .filter((day) => day.billing === "paid" && paidWithin(day.paidAt, declaration))
    .reduce((sum, day) => sum + workDayAmount(day), 0);

  const fromForfaits = forfaits(missions)
    .filter(
      (mission) => mission.billing === "paid" && paidWithin(mission.paidAt ?? null, declaration),
    )
    .reduce((sum, mission) => sum + missionAmount(mission), 0);

  return fromDays + fromForfaits;
}
