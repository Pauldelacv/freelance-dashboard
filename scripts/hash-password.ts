/**
 * Génère le hash argon2 à coller dans APP_PASSWORD_HASH.
 *
 *   npm run hash-password              (saisie interactive)
 *   npm run hash-password -- "secret"  (non interactif)
 *
 * Le mot de passe en clair n'est jamais écrit sur le disque.
 */
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";

async function readPassword(): Promise<string> {
  const fromArgs = process.argv.slice(2).join(" ").trim();
  if (fromArgs) return fromArgs;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Mot de passe : ");
  rl.close();
  return answer.trim();
}

async function main() {
  const password = await readPassword();
  if (password.length < 8) {
    console.error("\n✗ Mot de passe trop court : 8 caractères minimum.");
    process.exit(1);
  }

  const digest = await hash(password);

  console.log("\nÀ reporter dans les variables d'environnement Coolify :\n");
  console.log(`APP_PASSWORD_HASH=${digest}`);
  console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
  console.log("\n(le SESSION_SECRET ci-dessus est généré au hasard, à ne garder qu'une fois)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
