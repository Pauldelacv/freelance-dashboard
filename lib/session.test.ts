import { beforeAll, describe, expect, it } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isSecureConnection,
  readSessionToken,
  verifySessionToken,
} from "@/lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-pour-passer";
});

describe("jeton de session", () => {
  it("accepte un jeton fraîchement signé", async () => {
    const token = await createSessionToken();
    await expect(verifySessionToken(token)).resolves.toBe(true);
  });

  it("refuse un jeton absent ou malformé", async () => {
    await expect(verifySessionToken(undefined)).resolves.toBe(false);
    await expect(verifySessionToken("")).resolves.toBe(false);
    await expect(verifySessionToken("nimportequoi")).resolves.toBe(false);
    await expect(verifySessionToken("a.b")).resolves.toBe(false);
  });

  it("refuse un jeton dont la charge utile a été modifiée", async () => {
    const token = await createSessionToken();
    const [, signature] = token.split(".");
    const forged = `${btoa(JSON.stringify({ exp: 99999999999, v: 1 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}.${signature}`;
    await expect(verifySessionToken(forged)).resolves.toBe(false);
  });

  it("refuse un jeton signé avec une autre clé", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "un-autre-secret-tout-aussi-long-que-le-premier";
    await expect(verifySessionToken(token)).resolves.toBe(false);
    process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-pour-passer";
  });

  it("refuse un jeton expiré", async () => {
    const token = await createSessionToken();
    const later = Date.now() + (SESSION_MAX_AGE_SECONDS + 60) * 1000;
    await expect(verifySessionToken(token, later)).resolves.toBe(false);
  });

  it("date le jeton pour permettre sa révocation", async () => {
    const now = 1_800_000_000_000;
    const claims = await readSessionToken(await createSessionToken(now), now);
    expect(claims).toEqual({
      iat: now / 1000,
      exp: now / 1000 + SESSION_MAX_AGE_SECONDS,
      v: 1,
    });
  });

  it("exige un secret d'au moins 32 caractères", async () => {
    process.env.SESSION_SECRET = "trop-court";
    await expect(createSessionToken()).rejects.toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-pour-passer";
  });
});

describe("détection du protocole", () => {
  const from = (headers: Record<string, string>) =>
    isSecureConnection((name) => headers[name] ?? null);

  it("suit l'en-tête du reverse-proxy", () => {
    expect(from({ "x-forwarded-proto": "https" })).toBe(true);
    expect(from({ "x-forwarded-proto": "http" })).toBe(false);
    // Chaîne de proxies : c'est le premier saut, côté client, qui compte.
    expect(from({ "x-forwarded-proto": "https, http" })).toBe(true);
  });

  it("comprend l'en-tête Forwarded standard", () => {
    expect(from({ forwarded: "for=192.0.2.1;proto=https" })).toBe(true);
    expect(from({ forwarded: 'for=192.0.2.1;proto="http"' })).toBe(false);
  });

  it("retombe sur l'origine de la requête", () => {
    expect(from({ origin: "https://dashboard.exemple.fr" })).toBe(true);
    expect(from({ referer: "http://37.59.111.223/clients" })).toBe(false);
  });

  it("sans aucun indice, suit l'URL publique déclarée", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;

    process.env.NEXT_PUBLIC_APP_URL = "https://dashboard.exemple.fr";
    expect(from({})).toBe(true);

    // Déploiement encore servi en clair (adresse IP) : le cookie ne doit surtout
    // pas être marqué Secure, sinon le navigateur le jette silencieusement.
    process.env.NEXT_PUBLIC_APP_URL = "http://37.59.111.223";
    expect(from({})).toBe(false);

    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(from({})).toBe(false);

    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
});
