import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verify } from "@node-rs/argon2";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

/** Le mot de passe unique est fourni hashé par variable d'environnement. */
export function isPasswordConfigured(): boolean {
  const hash = process.env.APP_PASSWORD_HASH;
  return typeof hash === "string" && hash.startsWith("$argon2");
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

export async function signIn(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPasswordConfigured()) {
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
    valid = await verify(process.env.APP_PASSWORD_HASH as string, password);
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

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** À appeler en tête de toute page ou Server Action du groupe (app). */
export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
