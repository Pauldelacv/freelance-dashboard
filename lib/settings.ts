import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Tous les réglages tiennent dans une ligne JSON de la table Setting.
 * Rien n'est codé en dur : changer de taux de charges ou d'URL Indy se fait
 * depuis l'interface, sans redéploiement.
 */
export const SETTINGS_KEY = "app";

export const settingsSchema = z.object({
  /** Lien direct vers l'espace Indy (facturation externe). */
  indyUrl: z.string().url().or(z.literal("")).default(""),
  tax: z
    .object({
      /** Taux de cotisations, en fraction : 0,261 = 26,1 %. */
      chargeRate: z.number().min(0).max(0.9).default(0.261),
      /** Assujetti à la TVA. Non par défaut (franchise en base, art. 293 B). */
      vat: z.boolean().default(false),
      vatRate: z.number().min(0).max(0.3).default(0.2),
    })
    .default({ chargeRate: 0.261, vat: false, vatRate: 0.2 }),
  modules: z
    .object({
      /** Suivi des dépenses : Indy le fait déjà, désactivé par défaut. */
      expenses: z.boolean().default(false),
    })
    .default({ expenses: false }),
  goals: z
    .object({
      /** Objectifs par défaut, repris quand aucun objectif mensuel n'est saisi. */
      monthlyRevenue: z.number().int().nonnegative().nullable().default(null),
      monthlyDays: z.number().nonnegative().nullable().default(null),
    })
    .default({ monthlyRevenue: null, monthlyDays: null }),
  workday: z
    .object({
      /** Fraction posée par défaut au clic sur un jour. */
      defaultFraction: z.union([z.literal(1), z.literal(0.5)]).default(1),
    })
    .default({ defaultFraction: 1 }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = settingsSchema.parse({});

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return settingsSchema.parse(JSON.parse(row.value));
  } catch {
    // Réglages illisibles (édition manuelle, migration ratée) : on repart des
    // valeurs par défaut plutôt que de casser toute l'application.
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged = settingsSchema.parse({
    ...current,
    ...patch,
    tax: { ...current.tax, ...patch.tax },
    modules: { ...current.modules, ...patch.modules },
    goals: { ...current.goals, ...patch.goals },
    workday: { ...current.workday, ...patch.workday },
  });
  const value = JSON.stringify(merged);
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value },
    update: { value },
  });
  return merged;
}
