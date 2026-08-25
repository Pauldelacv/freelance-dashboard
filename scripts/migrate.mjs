/**
 * Applique les migrations Prisma au démarrage du conteneur.
 *
 * Pourquoi ne pas appeler `prisma migrate deploy` ? Le CLI Prisma tire ~150 Mo
 * de dépendances (Studio compris) qu'il faudrait embarquer dans l'image. Ce
 * script fait le même travail avec better-sqlite3, déjà présent, et écrit dans
 * la table `_prisma_migrations` au format exact de Prisma (checksum = sha256
 * du fichier migration.sql) : `prisma migrate status` reste juste en local.
 */
import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

function databaseFile() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) {
    throw new Error(`DATABASE_URL doit pointer sur un fichier SQLite (reçu : ${url}).`);
  }
  return url.slice("file:".length);
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

function main() {
  const file = databaseFile();
  const directory = dirname(file);
  if (directory && directory !== "." && !existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATIONS_TABLE);

  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  if (!existsSync(migrationsDir)) {
    console.log("Aucun dossier de migrations : rien à appliquer.");
    return;
  }

  const names = readdirSync(migrationsDir)
    .filter((name) => existsSync(join(migrationsDir, name, "migration.sql")))
    .sort();

  const applied = new Map(
    db
      .prepare(
        `SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
      )
      .all()
      .map((row) => [row.migration_name, row.checksum]),
  );

  let count = 0;
  for (const name of names) {
    const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
    const digest = checksum(sql);
    const previous = applied.get(name);

    if (previous !== undefined) {
      if (previous !== digest) {
        // Une migration déjà appliquée a été modifiée : la base et le code ne
        // correspondent plus. On refuse de démarrer plutôt que de corrompre.
        throw new Error(
          `La migration "${name}" a changé après avoir été appliquée. ` +
            `Créez une nouvelle migration au lieu de modifier celle-ci.`,
        );
      }
      continue;
    }

    const startedAt = Date.now();
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      ).run(randomUUID(), digest, Date.now(), name, startedAt);
    });
    run();

    console.log(`✓ migration appliquée : ${name}`);
    count += 1;
  }

  console.log(
    count === 0
      ? `Base à jour (${names.length} migration${names.length > 1 ? "s" : ""} déjà appliquée${names.length > 1 ? "s" : ""}).`
      : `${count} migration${count > 1 ? "s" : ""} appliquée${count > 1 ? "s" : ""}.`,
  );
  db.close();
}

try {
  main();
} catch (error) {
  console.error("✗ Migration impossible :", error instanceof Error ? error.message : error);
  process.exit(1);
}
