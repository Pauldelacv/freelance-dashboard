/**
 * Session mono-utilisateur : un cookie signé HMAC-SHA256, sans état côté serveur.
 * Implémenté avec la Web Crypto API pour fonctionner à la fois dans le runtime
 * Node (Server Actions, Server Components) et dans le middleware.
 */

export const SESSION_COOKIE = "fd_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

interface SessionPayload {
  /** Expiration, en secondes epoch. */
  exp: number;
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
  const payload: SessionPayload = {
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
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
 * Vérifie la signature puis l'expiration.
 * `crypto.subtle.verify` fait la comparaison en temps constant.
 */
export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await importKey(),
    signatureBytes as unknown as ArrayBuffer,
    new TextEncoder().encode(encoded),
  );
  if (!valid) return false;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encoded)),
    ) as SessionPayload;
    return payload.v === 1 && payload.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}
