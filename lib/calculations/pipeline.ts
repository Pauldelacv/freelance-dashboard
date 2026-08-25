/** Pipeline commercial : valeur pondérée et relances. */

export const STAGES = ["contacted", "quoted", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  contacted: "Contacté",
  quoted: "Devis envoyé",
  won: "Gagné",
  lost: "Perdu",
};

/** Étapes encore en cours : seules elles comptent dans le pipeline pondéré. */
export const OPEN_STAGES: Stage[] = ["contacted", "quoted"];

export interface ProspectLike {
  id: string;
  stage: string;
  estimatedRate: number | null;
  estimatedDays: number | null;
  probability: number;
  nextActionAt?: string | null;
}

/** TJM pressenti × jours estimés, en centimes. 0 si l'un des deux manque. */
export function prospectValue(prospect: ProspectLike): number {
  if (!prospect.estimatedRate || !prospect.estimatedDays) return 0;
  return Math.round(prospect.estimatedRate * prospect.estimatedDays);
}

/** Valeur pondérée par la probabilité : TJM × jours × probabilité. */
export function weightedValue(prospect: ProspectLike): number {
  const probability = Math.min(Math.max(prospect.probability, 0), 100);
  return Math.round((prospectValue(prospect) * probability) / 100);
}

export function totalWeightedValue(prospects: ProspectLike[]): number {
  return prospects.reduce((sum, prospect) => sum + weightedValue(prospect), 0);
}

/** Total pondéré du pipeline encore ouvert (contacté + devis envoyé). */
export function openPipelineValue(prospects: ProspectLike[]): number {
  return totalWeightedValue(
    prospects.filter((prospect) => OPEN_STAGES.includes(prospect.stage as Stage)),
  );
}

export function groupByStage<T extends ProspectLike>(prospects: T[]): Record<Stage, T[]> {
  const groups: Record<Stage, T[]> = { contacted: [], quoted: [], won: [], lost: [] };
  for (const prospect of prospects) {
    const stage = (STAGES as readonly string[]).includes(prospect.stage)
      ? (prospect.stage as Stage)
      : "contacted";
    groups[stage].push(prospect);
  }
  return groups;
}

/**
 * Prospects dont la prochaine action est due (ou en retard), hors gagné/perdu.
 * `today` au format "YYYY-MM-DD".
 */
export function dueProspects<T extends ProspectLike>(prospects: T[], today: string): T[] {
  return prospects
    .filter(
      (prospect) =>
        OPEN_STAGES.includes(prospect.stage as Stage) &&
        prospect.nextActionAt != null &&
        prospect.nextActionAt <= today,
    )
    .sort((a, b) => (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""));
}
