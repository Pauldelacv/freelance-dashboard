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
  const secret = randomBytes(32).toString("base64url");

  console.log("\n── Coolify (onglet Environment Variables) ─────────────────────\n");
  console.log(`APP_PASSWORD_HASH=${digest}`);
  console.log(`SESSION_SECRET=${secret}`);

  console.log("\n── Fichier .env local ────────────────────────────────────────\n");
  console.log(`APP_PASSWORD_HASH=${digest.replaceAll("$", "\\$")}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log(
    "\nLes $ sont échappés pour le fichier .env : sans cela, dotenv les prend\n" +
      "pour des variables et vide le hash — la connexion échouerait silencieusement.\n" +
      "Dans Coolify, coller la valeur brute (premier bloc), sans échappement.\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
