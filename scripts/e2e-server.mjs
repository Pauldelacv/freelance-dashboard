/**
 * Serveur utilisé par Playwright.
 *
 * Il démarre la sortie `standalone` depuis un dossier isolé (`.e2e-run/`), pour
 * deux raisons :
 *  - aucun fichier `.env` du poste de dev ne vient écraser les variables du test
 *    (Next charge `.env` et ses valeurs l'emportent sur l'environnement réel) ;
 *  - c'est exactement le chemin d'exécution de l'image Docker, donc les tests
 *    valident aussi ce que Coolify fera tourner.
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const runDir = resolve(root, ".e2e-run");
const dataFile = join(runDir, "e2e.db");
const port = process.env.E2E_PORT ?? "3100";

if (!existsSync(join(root, ".next", "standalone", "server.js"))) {
  console.log("→ build Next manquant, construction…");
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
}

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });
cpSync(join(root, ".next", "standalone"), runDir, { recursive: true });
cpSync(join(root, ".next", "static"), join(runDir, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(runDir, "public"), { recursive: true });
}
// La sortie standalone embarque une copie des fichiers .env du poste : on les
// retire pour que seules les variables du test s'appliquent.
for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  rmSync(join(runDir, file), { force: true });
}

cpSync(join(root, "prisma", "migrations"), join(runDir, "prisma", "migrations"), {
  recursive: true,
});
cpSync(join(root, "scripts", "migrate.mjs"), join(runDir, "scripts", "migrate.mjs"));
cpSync(
  join(root, "node_modules", "better-sqlite3"),
  join(runDir, "node_modules", "better-sqlite3"),
  {
    recursive: true,
  },
);
for (const pkg of ["bindings", "file-uri-to-path"]) {
  const source = join(root, "node_modules", pkg);
  if (existsSync(source)) {
    cpSync(source, join(runDir, "node_modules", pkg), { recursive: true });
  }
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  TZ: "Europe/Paris",
  PORT: port,
  HOSTNAME: "127.0.0.1",
  DATABASE_URL: `file:${dataFile}`,
  SESSION_SECRET: "secret-e2e-suffisamment-long-pour-etre-valide",
  // Hash argon2 du mot de passe "motdepasse-e2e" — jeu de test jetable.
  APP_PASSWORD_HASH:
    "$argon2id$v=19$m=19456,t=2,p=1$ohlj62XMvPl30cXGT9z4cg$Bku8w6SK7ae0qdnuT/ddAEZuo4GRQJmYBIMptVHKwqo",
};

execFileSync(process.execPath, ["scripts/migrate.mjs"], { cwd: runDir, env, stdio: "inherit" });

const server = spawn(process.execPath, ["server.js"], { cwd: runDir, env, stdio: "inherit" });
const stop = () => server.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
