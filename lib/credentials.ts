import { prisma } from "@/lib/db";

/**
 * Le mot de passe est modifiable depuis les réglages : son hash ne peut donc
 * pas rester figé dans une variable d'environnement. Il est rangé dans la table
 * Setting, sous une clé à part — jamais mélangé aux réglages applicatifs, qui
 * eux sont lus par l'interface et exportés dans la sauvegarde JSON.
 *
 * APP_PASSWORD_HASH reste le mot de passe d'amorçage : il sert tant qu'aucun
 * changement n'a eu lieu, et redevient valable si l'on supprime cette ligne
 * (procédure de secours documentée dans DEPLOY.md).
 */
export const AUTH_SETTING_KEY = "auth";

export interface StoredCredentials {
  /** Hash argon2 du mot de passe courant. */
  passwordHash: string;
  /** Date du changement, en secondes epoch : les sessions plus anciennes tombent. */
  changedAt: number;
}

function parse(value: string): StoredCredentials | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredCredentials>;
    if (typeof parsed.passwordHash !== "string" || !parsed.passwordHash.startsWith("$argon2")) {
      return null;
    }
    return {
      passwordHash: parsed.passwordHash,
      changedAt: typeof parsed.changedAt === "number" ? parsed.changedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Lecture tolérante : au tout premier démarrage la table peut ne pas exister
 * encore. On retombe alors sur la variable d'environnement plutôt que de
 * rendre la page de connexion inaccessible.
 */
export async function readStoredCredentials(): Promise<StoredCredentials | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: AUTH_SETTING_KEY } });
    return row ? parse(row.value) : null;
  } catch {
    return null;
  }
}

export async function writeStoredPassword(
  passwordHash: string,
  now = Date.now(),
): Promise<StoredCredentials> {
  const credentials: StoredCredentials = {
    passwordHash,
    changedAt: Math.floor(now / 1000),
  };
  const value = JSON.stringify(credentials);
  await prisma.setting.upsert({
    where: { key: AUTH_SETTING_KEY },
    create: { key: AUTH_SETTING_KEY, value },
    update: { value },
  });
  return credentials;
}
