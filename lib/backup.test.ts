import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { AUTH_SETTING_KEY } from "@/lib/credentials";
import {
  BACKUP_VERSION,
  collectBackup,
  parseBackup,
  restoreBackup,
  summarizeCounts,
} from "@/lib/backup";

/**
 * Aller-retour sur deux vraies bases SQLite : c'est le seul contrôle qui vaut
 * pour une restauration. Un test sur des objets en mémoire ne dirait rien des
 * identifiants repris, des rattachements conservés ni des lignes effacées.
 */

const MIGRATIONS = join(process.cwd(), "prisma", "migrations");

let directory: string;
const clients: PrismaClient[] = [];

function createDatabase(name: string): PrismaClient {
  const file = join(directory, name);
  const raw = new Database(file);
  raw.pragma("foreign_keys = ON");
  for (const migration of readdirSync(MIGRATIONS).sort()) {
    const sql = join(MIGRATIONS, migration, "migration.sql");
    if (existsSync(sql)) raw.exec(readFileSync(sql, "utf8"));
  }
  raw.close();

  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
  clients.push(client);
  return client;
}

async function readAll(db: PrismaClient) {
  const [clientRows, missions, workDays, prospects, expenses, watchSites, goals, settings] =
    await Promise.all([
      db.client.findMany({ orderBy: { id: "asc" } }),
      db.mission.findMany({ orderBy: { id: "asc" } }),
      db.workDay.findMany({ orderBy: { id: "asc" } }),
      db.prospect.findMany({ orderBy: { id: "asc" } }),
      db.expense.findMany({ orderBy: { id: "asc" } }),
      db.watchSite.findMany({ orderBy: { id: "asc" } }),
      db.goal.findMany({ orderBy: { id: "asc" } }),
      db.setting.findMany({ orderBy: { key: "asc" } }),
    ]);

  // Les horodatages sont comparés comme le reste : une restauration qui
  // réécrirait `createdAt` ou `updatedAt` ne restituerait pas l'état d'origine.
  return {
    clients: clientRows,
    missions,
    workDays,
    prospects,
    expenses,
    watchSites,
    goals,
    settings,
  };
}

async function seedSource(db: PrismaClient) {
  await db.client.create({
    data: {
      id: "client-nord",
      name: "Agence Nord",
      company: "Nord SAS",
      email: "contact@nord.fr",
      defaultRate: 55000,
      color: "#2a78d6",
      paymentTerms: 45,
      notes: "Paie à 45 jours.",
    },
  });
  await db.client.create({
    data: { id: "client-sud", name: "Studio Sud", defaultRate: 62000, color: "#eb6834" },
  });
  await db.mission.create({
    data: {
      id: "mission-refonte",
      clientId: "client-nord",
      title: "Refonte du site",
      rate: 60000,
      estimatedDays: 12.5,
    },
  });
  await db.workDay.createMany({
    data: [
      {
        id: "jour-1",
        date: "2026-08-24",
        clientId: "client-nord",
        missionId: "mission-refonte",
        rate: 60000,
        fraction: 1,
      },
      {
        id: "jour-2",
        date: "2026-08-25",
        clientId: "client-nord",
        rate: 55000,
        fraction: 0.5,
        billing: "invoiced",
        billedAt: "2026-08-31",
        note: "Demi-journée de recette.",
      },
      { id: "jour-3", date: "2026-08-26", clientId: "client-sud", rate: 62000, type: "off" },
    ],
  });
  await db.prospect.create({
    data: {
      id: "prospect-1",
      name: "Coopérative Ouest",
      stage: "quoted",
      estimatedRate: 58000,
      estimatedDays: 20,
      probability: 60,
      nextActionAt: "2026-09-10",
    },
  });
  await db.expense.create({
    data: {
      id: "depense-1",
      date: "2026-08-01",
      label: "Hébergement",
      amount: 1200,
      category: "logiciel",
    },
  });
  await db.watchSite.create({
    data: {
      id: "site-1",
      title: "Next.js",
      url: "https://nextjs.org",
      category: "Technique",
      tags: "next,react",
      favorite: true,
    },
  });
  await db.goal.createMany({
    data: [
      { id: "goal-annee", year: 2026, month: null, revenueTarget: 10800000, daysTarget: 200 },
      { id: "goal-aout", year: 2026, month: 8, revenueTarget: 900000, daysTarget: 18 },
    ],
  });
  await db.setting.createMany({
    data: [
      { key: "app", value: JSON.stringify({ indyUrl: "https://app.indy.fr" }) },
      { key: AUTH_SETTING_KEY, value: JSON.stringify({ passwordHash: "$argon2id$source" }) },
    ],
  });
}

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "fd-backup-"));
});

afterAll(async () => {
  await Promise.all(clients.map((client) => client.$disconnect()));
  rmSync(directory, { recursive: true, force: true });
});

describe("aller-retour export → import", () => {
  it("restitue l'état d'origine sur une base vierge", async () => {
    const source = createDatabase("source.db");
    const target = createDatabase("cible.db");
    await seedSource(source);

    // Ce que téléchargerait /api/backup, tel qu'il serait relu.
    const json = JSON.stringify(await collectBackup(source), null, 2);

    // La cible n'est pas vierge : elle porte des données à remplacer et son
    // propre mot de passe, qu'un import ne doit pas emporter.
    await target.client.create({
      data: { id: "client-a-effacer", name: "Ancien", defaultRate: 10000, color: "#008300" },
    });
    await target.workDay.create({
      data: { id: "jour-a-effacer", date: "2020-01-02", clientId: "client-a-effacer", rate: 10000 },
    });
    await target.setting.createMany({
      data: [
        { key: "app", value: JSON.stringify({ indyUrl: "" }) },
        { key: AUTH_SETTING_KEY, value: JSON.stringify({ passwordHash: "$argon2id$cible" }) },
      ],
    });

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const counts = await restoreBackup(target, parsed.data);
    expect(counts).toEqual({
      clients: 2,
      missions: 1,
      workDays: 3,
      prospects: 1,
      expenses: 1,
      watchSites: 1,
      goals: 2,
      settings: 1,
    });

    const before = await readAll(source);
    const after = await readAll(target);

    // Le mot de passe de la cible est le seul écart attendu : il n'est ni
    // exporté ni écrasé.
    expect(after.settings.filter((row) => row.key !== AUTH_SETTING_KEY)).toEqual(
      before.settings.filter((row) => row.key !== AUTH_SETTING_KEY),
    );
    expect(after.settings.find((row) => row.key === AUTH_SETTING_KEY)?.value).toContain("cible");

    expect(after.clients).toEqual(before.clients);
    expect(after.missions).toEqual(before.missions);
    expect(after.workDays).toEqual(before.workDays);
    expect(after.prospects).toEqual(before.prospects);
    expect(after.expenses).toEqual(before.expenses);
    expect(after.watchSites).toEqual(before.watchSites);
    expect(after.goals).toEqual(before.goals);

    // Les données de la cible ont bien disparu, rattachements compris.
    expect(after.clients.some((row) => row.id === "client-a-effacer")).toBe(false);
    expect(after.workDays.some((row) => row.id === "jour-a-effacer")).toBe(false);
    expect(after.workDays.find((row) => row.id === "jour-1")?.missionId).toBe("mission-refonte");

    expect(summarizeCounts(counts)).toContain("2 clients");
  });
});

describe("refus des sauvegardes non relisibles", () => {
  it("refuse ce qui n'est pas du JSON", () => {
    expect(parseBackup("<opml>")).toEqual({
      ok: false,
      error: "Fichier illisible : ce n'est pas du JSON.",
    });
  });

  it("refuse un JSON qui n'est pas une sauvegarde", () => {
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup('{"clients":[]}').ok).toBe(false);
  });

  it("refuse une version inconnue plutôt que d'importer de travers", () => {
    const result = parseBackup(JSON.stringify({ version: BACKUP_VERSION + 1, clients: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("version 2");
  });

  it("refuse une table mal formée", () => {
    const result = parseBackup(
      JSON.stringify({ version: BACKUP_VERSION, clients: [{ id: "x", name: "Sans TJM" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("accepte une sauvegarde vide", () => {
    const result = parseBackup(JSON.stringify({ version: BACKUP_VERSION }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clients).toEqual([]);
  });
});
