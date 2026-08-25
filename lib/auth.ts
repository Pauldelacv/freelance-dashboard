import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isSecureConnection,
  readSessionToken,
} from "@/lib/session";
import { readStoredCredentials, writeStoredPassword } from "@/lib/credentials";

function envPasswordHash(): string | null {
  const hashFromEnv = process.env.APP_PASSWORD_HASH;
  return typeof hashFromEnv === "string" && hashFromEnv.startsWith("$argon2") ? hashFromEnv : null;
}

/**
 * Hash à opposer à une saisie : celui enregistré depuis les réglages s'il
 * existe, sinon celui d'amorçage fourni par variable d'environnement.
 */
async function getPasswordHash(): Promise<string | null> {
  const stored = await readStoredCredentials();
  return stored?.passwordHash ?? envPasswordHash();
}

/** Un mot de passe est-il utilisable (variable d'environnement ou réglages) ? */
export async function isPasswordConfigured(): Promise<boolean> {
  return (await getPasswordHash()) !== null;
}

export function isSecretConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return typeof secret === "string" && secret.length >= 32;
}

// Anti-force brute. Mono-utilisateur : un compteur global suffit, et il reste
// juste derrière le reverse-proxy Coolify (où l'IP cliente n'est pas fiable).
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const attempts = { count: 0, lockedUntil: 0 };

export function loginLockRemainingMs(now = Date.now()): number {
  return Math.max(0, attempts.lockedUntil - now);
}

/**
 * Pose le cookie de session.
 *
 * `secure` suit le protocole réel de la requête et non NODE_ENV : sur un
 * déploiement encore servi en http:// (adresse IP, domaine pas encore posé),
 * un cookie Secure serait ignoré par le navigateur et le mot de passe
 * redemandé à chaque page.
 */
async function setSessionCookie(now = Date.now()): Promise<void> {
  const [store, headerList] = await Promise.all([cookies(), headers()]);
  store.set(SESSION_COOKIE, await createSessionToken(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureConnection((name) => headerList.get(name)),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function signIn(password: string): Promise<{ ok: boolean; error?: string }> {
  const passwordHash = await getPasswordHash();
  if (!passwordHash) {
    return { ok: false, error: "Aucun mot de passe n'est configuré sur ce serveur." };
  }
  const remaining = loginLockRemainingMs();
  if (remaining > 0) {
    return {
      ok: false,
      error: `Trop de tentatives. Réessayez dans ${Math.ceil(remaining / 1000)} secondes.`,
    };
  }

  let valid = false;
  try {
    valid = await verify(passwordHash, password);
  } catch {
    return { ok: false, error: "Le hash du mot de passe est illisible (APP_PASSWORD_HASH)." };
  }

  if (!valid) {
    attempts.count += 1;
    if (attempts.count >= MAX_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_MS;
      attempts.count = 0;
    }
    return { ok: false, error: "Mot de passe incorrect." };
  }

  attempts.count = 0;
  attempts.lockedUntil = 0;

  await setSessionCookie();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Change le mot de passe et invalide les autres sessions.
 *
 * Le middleware ne vérifie que la signature du jeton (il n'a pas accès à la
 * base) : la révocation est appliquée ici, à chaque page et à chaque Server
 * Action, en comparant la date d'émission du jeton à celle du changement.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string; field?: string }> {
  const passwordHash = await getPasswordHash();
  if (!passwordHash) {
    return { ok: false, error: "Aucun mot de passe n'est configuré sur ce serveur." };
  }

  let valid = false;
  try {
    valid = await verify(passwordHash, currentPassword);
  } catch {
    return { ok: false, error: "Le hash du mot de passe est illisible (APP_PASSWORD_HASH)." };
  }
  if (!valid) {
    return { ok: false, error: "Mot de passe actuel incorrect.", field: "currentPassword" };
  }

  await writeStoredPassword(await hash(newPassword));
  // La session courante est renouvelée juste après, sinon le changement
  // déconnecterait aussi le navigateur qui vient de le demander.
  await setSessionCookie();
  return { ok: true };
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const claims = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return false;

  // Session émise avant le dernier changement de mot de passe : révoquée.
  const stored = await readStoredCredentials();
  if (stored && claims.iat < stored.changedAt) return false;

  return true;
}

/** À appeler en tête de toute page ou Server Action du groupe (app). */
export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
