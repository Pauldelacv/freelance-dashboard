/**
 * Session mono-utilisateur : un cookie signé HMAC-SHA256, sans état côté serveur.
 * Implémenté avec la Web Crypto API pour fonctionner à la fois dans le runtime
 * Node (Server Actions, Server Components) et dans le middleware.
 */

export const SESSION_COOKIE = "fd_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export interface SessionClaims {
  /** Expiration, en secondes epoch. */
  exp: number;
  /** Émission, en secondes epoch. Sert à révoquer les sessions plus anciennes
   *  qu'un changement de mot de passe (voir lib/auth.ts). Absent des jetons
   *  émis avant cette version : ils valent alors 0, donc antérieurs à tout. */
  iat: number;
  /** Version du format, pour pouvoir invalider les sessions plus tard. */
  v: 1;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court : 32 caractères aléatoires minimum sont requis.",
    );
  }
  return secret;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Fabrique un jeton signé valable SESSION_MAX_AGE_SECONDS. */
export async function createSessionToken(now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionClaims = {
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
    iat: issuedAt,
    v: 1,
  };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importKey(),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Vérifie la signature puis l'expiration, et renvoie la charge utile.
 * `crypto.subtle.verify` fait la comparaison en temps constant.
 */
export async function readSessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<SessionClaims | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await importKey(),
    signatureBytes as unknown as ArrayBuffer,
    new TextEncoder().encode(encoded),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as SessionClaims;
    if (payload.v !== 1 || payload.exp <= Math.floor(now / 1000)) return null;
    return { exp: payload.exp, iat: typeof payload.iat === "number" ? payload.iat : 0, v: 1 };
  } catch {
    return null;
  }
}

/** Raccourci booléen : signature et expiration seulement (utilisé par le middleware). */
export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  return (await readSessionToken(token, now)) !== null;
}

/**
 * La requête arrive-t-elle réellement en HTTPS ?
 *
 * Le cookie de session ne doit porter l'attribut `Secure` que dans ce cas : un
 * cookie Secure servi en http:// est *silencieusement ignoré* par le navigateur
 * (sauf sur localhost), et l'application redemande alors le mot de passe à
 * chaque navigation. Derrière le reverse-proxy de Coolify, le protocole d'origine
 * n'arrive que par en-tête — d'où l'ordre de lecture ci-dessous.
 */
export function isSecureConnection(
  getHeader: (name: string) => string | null | undefined,
): boolean {
  const forwardedProto = getHeader("x-forwarded-proto");
  if (forwardedProto) return firstValue(forwardedProto) === "https";

  // En-tête standard RFC 7239 : `Forwarded: for=…;proto=https`.
  const forwarded = getHeader("forwarded");
  if (forwarded) {
    const proto = /proto=("?)([a-z]+)\1/i.exec(firstValue(forwarded));
    if (proto) return proto[2].toLowerCase() === "https";
  }

  // Pas de proxy : l'origine de la page (Server Action) ou le référent suffisent.
  for (const name of ["origin", "referer"]) {
    const value = getHeader(name);
    if (value && /^https?:/i.test(value)) return value.toLowerCase().startsWith("https:");
  }

  // Dernier recours : le domaine public déclaré dans les variables d'environnement.
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").toLowerCase().startsWith("https://");
}

function firstValue(header: string): string {
  return header.split(",")[0]!.trim().toLowerCase();
}
