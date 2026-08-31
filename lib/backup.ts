import { z } from "zod";
import { AUTH_SETTING_KEY } from "@/lib/credentials";
import { RESTORE_CONFIRMATION } from "@/lib/validation";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Sauvegarde complète en JSON : écriture (`/api/backup`) et relecture (import
 * depuis les réglages) partagent ce fichier, pour qu'un champ ajouté à un
 * modèle ne parte pas dans l'export sans revenir à l'import.
 *
 * Trois décisions, arbitrées à l'issue #7 :
 *
 * 1. **On remplace, on ne fusionne pas.** Fusionner demanderait une règle de
 *    conflit par table, invérifiable à l'œil ; remplacer se raconte en une
 *    phrase et se vérifie par un aller-retour.
 * 2. **La confirmation est explicite** : le mot REMPLACER, saisi à la main.
 * 3. **Une version inconnue est refusée** plutôt qu'importée de travers.
 *
 * Le hash du mot de passe (`Setting` / clé `auth`) n'est ni exporté ni écrasé :
 * une sauvegarde s'échange, un secret non — et restaurer ne doit pas enfermer
 * dehors celui qui restaure.
 */

export { RESTORE_CONFIRMATION };

export const BACKUP_VERSION = 1;

/** Versions que cet import sait relire. */
export const SUPPORTED_BACKUP_VERSIONS = [1];

const timestamp = z.coerce.date().default(() => new Date());
const text = z.string();
const optionalText = z.string().nullable().default(null);
const optionalInt = z.number().int().nullable().default(null);
const optionalFloat = z.number().nullable().default(null);

const clientSchema = z.object({
  id: z.string().min(1),
  name: text,
  company: optionalText,
  email: optionalText,
  phone: optionalText,
  defaultRate: z.number().int(),
  currency: z.string().default("EUR"),
  color: text,
  status: z.string().default("active"),
  paymentTerms: z.number().int().default(30),
  notes: optionalText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const missionSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  title: text,
  // Champs du forfait, arrivés après la version 1 du format : leurs valeurs par
  // défaut relisent une sauvegarde antérieure sans la refuser.
  billingType: z.string().default("regie"),
  rate: optionalInt,
  forfaitAmount: optionalInt,
  startDate: optionalText,
  endDate: optionalText,
  estimatedDays: optionalFloat,
  status: z.string().default("active"),
  billing: z.string().default("pending"),
  billedAt: optionalText,
  paidAt: optionalText,
  notes: optionalText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const workDaySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ."),
  fraction: z.number().default(1),
  clientId: optionalText,
  missionId: optionalText,
  rate: z.number().int(),
  type: z.string().default("billable"),
  note: optionalText,
  billing: z.string().default("pending"),
  billedAt: optionalText,
  paidAt: optionalText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const prospectSchema = z.object({
  id: z.string().min(1),
  name: text,
  company: optionalText,
  email: optionalText,
  phone: optionalText,
  source: optionalText,
  stage: z.string().default("contacted"),
  estimatedRate: optionalInt,
  estimatedDays: optionalFloat,
  probability: z.number().int().default(50),
  nextAction: optionalText,
  nextActionAt: optionalText,
  notes: optionalText,
  clientId: optionalText,
  position: z.number().int().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const expenseSchema = z.object({
  id: z.string().min(1),
  date: text,
  label: text,
  amount: z.number().int(),
  category: text,
  recurring: z.boolean().default(false),
  receiptUrl: optionalText,
  createdAt: timestamp,
});

const watchSiteSchema = z.object({
  id: z.string().min(1),
  title: text,
  url: text,
  category: z.string().default("Divers"),
  tags: z.string().default(""),
  frequency: optionalText,
  favorite: z.boolean().default(false),
  lastVisit: optionalText,
  faviconUrl: optionalText,
  notes: optionalText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const goalSchema = z.object({
  id: z.string().min(1),
  year: z.number().int(),
  month: optionalInt,
  revenueTarget: optionalInt,
  daysTarget: optionalFloat,
});

const settingSchema = z.object({
  key: z.string().min(1),
  value: text,
  updatedAt: timestamp,
});

export const backupSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string().optional(),
  clients: z.array(clientSchema).default([]),
  missions: z.array(missionSchema).default([]),
  workDays: z.array(workDaySchema).default([]),
  prospects: z.array(prospectSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  watchSites: z.array(watchSiteSchema).default([]),
  goals: z.array(goalSchema).default([]),
  settings: z.array(settingSchema).default([]),
});

export type BackupPayload = z.infer<typeof backupSchema>;

/** Le client Prisma, réduit à ce dont la sauvegarde a besoin. */
type BackupClient = Pick<
  PrismaClient,
  | "client"
  | "mission"
  | "workDay"
  | "prospect"
  | "expense"
  | "watchSite"
  | "goal"
  | "setting"
  | "$transaction"
>;

/** Lit toute la base. Le hash du mot de passe reste dehors. */
export async function collectBackup(db: BackupClient): Promise<BackupPayload> {
  const [clients, missions, workDays, prospects, expenses, watchSites, goals, settings] =
    await Promise.all([
      db.client.findMany(),
      db.mission.findMany(),
      db.workDay.findMany(),
      db.prospect.findMany(),
      db.expense.findMany(),
      db.watchSite.findMany(),
      db.goal.findMany(),
      db.setting.findMany({ where: { key: { not: AUTH_SETTING_KEY } } }),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clients,
    missions,
    workDays,
    prospects,
    expenses,
    watchSites,
    goals,
    settings,
  };
}

export type ParseResult = { ok: true; data: BackupPayload } | { ok: false; error: string };

/** Relit un fichier de sauvegarde. Refuse tout ce qui n'est pas sûr d'être relisible. */
export function parseBackup(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Fichier illisible : ce n'est pas du JSON." };
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde de cette application." };
  }

  // La version se lit avant le reste : une sauvegarde d'une version inconnue
  // peut avoir la bonne forme et le mauvais sens.
  const version = (json as { version?: unknown }).version;
  if (typeof version !== "number") {
    return { ok: false, error: "Sauvegarde sans numéro de version : import refusé." };
  }
  if (!SUPPORTED_BACKUP_VERSIONS.includes(version)) {
    return {
      ok: false,
      error: `Sauvegarde en version ${version}, or cette application relit la version ${SUPPORTED_BACKUP_VERSIONS.join(" ou ")}.`,
    };
  }

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return {
      ok: false,
      error: `Sauvegarde mal formée${where} : ${issue?.message ?? "champ invalide."}`,
    };
  }

  return { ok: true, data: parsed.data };
}

export interface RestoreCounts {
  clients: number;
  missions: number;
  workDays: number;
  prospects: number;
  expenses: number;
  watchSites: number;
  goals: number;
  settings: number;
}

export function countRows(data: BackupPayload): RestoreCounts {
  return {
    clients: data.clients.length,
    missions: data.missions.length,
    workDays: data.workDays.length,
    prospects: data.prospects.length,
    expenses: data.expenses.length,
    watchSites: data.watchSites.length,
    goals: data.goals.length,
    settings: data.settings.length,
  };
}

/**
 * Remplace le contenu de la base par celui de la sauvegarde.
 *
 * Tout part dans une seule transaction : un import interrompu ne doit pas
 * laisser une base à moitié vidée. L'ordre des suppressions descend les
 * dépendances (jours → missions → clients), et les identifiants d'origine sont
 * repris tels quels pour que les rattachements survivent.
 */
export async function restoreBackup(db: BackupClient, data: BackupPayload): Promise<RestoreCounts> {
  // Un fichier bricolé pourrait porter une ligne `auth` : elle est écartée ici
  // comme elle l'est à l'export.
  const settings = data.settings.filter((setting) => setting.key !== AUTH_SETTING_KEY);

  await db.$transaction([
    db.workDay.deleteMany(),
    db.mission.deleteMany(),
    db.client.deleteMany(),
    db.prospect.deleteMany(),
    db.expense.deleteMany(),
    db.watchSite.deleteMany(),
    db.goal.deleteMany(),
    db.setting.deleteMany({ where: { key: { not: AUTH_SETTING_KEY } } }),

    db.client.createMany({ data: data.clients }),
    db.mission.createMany({ data: data.missions }),
    db.workDay.createMany({ data: data.workDays }),
    db.prospect.createMany({ data: data.prospects }),
    db.expense.createMany({ data: data.expenses }),
    db.watchSite.createMany({ data: data.watchSites }),
    db.goal.createMany({ data: data.goals }),
    db.setting.createMany({ data: settings }),
  ]);

  return countRows({ ...data, settings });
}

/** « 3 clients, 120 jours, 2 sites » — récapitulatif après import. */
export function summarizeCounts(counts: RestoreCounts): string {
  const parts: string[] = [];
  const push = (count: number, singular: string, plural: string) => {
    if (count > 0) parts.push(`${count} ${count > 1 ? plural : singular}`);
  };
  push(counts.clients, "client", "clients");
  push(counts.missions, "mission", "missions");
  push(counts.workDays, "jour", "jours");
  push(counts.prospects, "prospect", "prospects");
  push(counts.expenses, "dépense", "dépenses");
  push(counts.watchSites, "site", "sites");
  push(counts.goals, "objectif", "objectifs");
  push(counts.settings, "réglage", "réglages");
  return parts.length > 0 ? parts.join(", ") : "aucune donnée";
}
