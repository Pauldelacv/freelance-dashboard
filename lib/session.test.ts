import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, createSessionToken, verifySessionToken } from "@/lib/session";

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

  it("exige un secret d'au moins 32 caractères", async () => {
    process.env.SESSION_SECRET = "trop-court";
    await expect(createSessionToken()).rejects.toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-pour-passer";
  });
});
