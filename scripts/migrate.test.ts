import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Le chemin réel du conteneur, sur une vraie base : `scripts/migrate.mjs`
 * remplace `prisma migrate deploy`, c'est donc lui qui décide de ce qui
 * survit à un redéploiement.
 *
 * Le test rejoue une mise à jour telle qu'elle se produit chez l'utilisateur :
 * une base déjà en service, avec des données rattachées les unes aux autres,
 * à qui l'on applique les migrations suivantes.
 */

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "migrate.mjs");
const MIGRATIONS = join(ROOT, "prisma", "migrations");

let directory: string;
let file: string;

/** Exécute le script sur une racine ne contenant que les migrations voulues. */
function migrate(): string {
  return execFileSync(process.execPath, [SCRIPT], {
    cwd: directory,
    env: { ...process.env, DATABASE_URL: `file:${file}` },
    encoding: "utf8",
  });
}

/** Copie une migration du dépôt vers la racine de travail. */
function stage(name: string) {
  cpSync(join(MIGRATIONS, name), join(directory, "prisma", "migrations", name), {
    recursive: true,
  });
}

const names = readdirSync(MIGRATIONS)
  .filter((name) => /^\d/.test(name))
  .sort();

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "fd-migrate-"));
  file = join(directory, "app.db");
  mkdirSync(join(directory, "prisma", "migrations"), { recursive: true });
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("application des migrations", () => {
  it("garde les rattachements d'une base déjà en service", () => {
    // 1. La base telle qu'elle était à la première mise en ligne.
    stage(names[0]);
    expect(migrate()).toContain("migration appliquée");

    const before = new Database(file);
    before.exec(`
      INSERT INTO "Client" (id, name, defaultRate, color, updatedAt)
        VALUES ('cli1', 'Agence Nord', 55000, '#2a78d6', CURRENT_TIMESTAMP);
      INSERT INTO "Mission" (id, clientId, title, rate, status, updatedAt)
        VALUES ('mis1', 'cli1', 'Refonte', 60000, 'active', CURRENT_TIMESTAMP);
      INSERT INTO "WorkDay" (id, date, fraction, clientId, missionId, rate, updatedAt)
        VALUES ('jour1', '2026-08-10', 1, 'cli1', 'mis1', 60000, CURRENT_TIMESTAMP);
    `);
    before.close();

    // 2. Le redéploiement : toutes les migrations suivantes d'un coup.
    for (const name of names.slice(1)) stage(name);
    migrate();

    // 3. SQLite ne sait pas modifier une colonne : Prisma reconstruit la table
    //    (DROP puis RENAME). Si les contraintes sont actives à ce moment-là, le
    //    ON DELETE SET NULL du jour se déclenche et le rattachement disparaît
    //    en silence — régression déjà vue, et invisible jusqu'à la facture.
    const after = new Database(file);
    const day = after.prepare(`SELECT missionId FROM "WorkDay" WHERE id = 'jour1'`).get() as {
      missionId: string | null;
    };
    const dangling = after.pragma("foreign_key_check") as unknown[];
    const missions = after.prepare(`SELECT COUNT(*) AS total FROM "Mission"`).get() as {
      total: number;
    };
    after.close();

    expect(day.missionId).toBe("mis1");
    expect(missions.total).toBe(1);
    expect(dangling).toEqual([]);
  });

  it("ne rejoue pas une migration déjà appliquée", () => {
    expect(migrate()).toContain("Base à jour");
  });

  it("refuse de démarrer si une migration appliquée a été modifiée", () => {
    const target = join(directory, "prisma", "migrations", names[0], "migration.sql");
    cpSync(target, `${target}.bak`);
    execFileSync("sh", ["-c", `printf '\\n-- retouche\\n' >> ${JSON.stringify(target)}`]);

    expect(() => migrate()).toThrow();
    cpSync(`${target}.bak`, target);
  });
});
