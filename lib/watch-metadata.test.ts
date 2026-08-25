import { describe, expect, it } from "vitest";
import { normalizeTags, normalizeUrl, parseTags } from "@/lib/watch-metadata";

describe("normalizeUrl", () => {
  it("complète le protocole manquant", () => {
    expect(normalizeUrl("exemple.fr")).toBe("https://exemple.fr/");
    expect(normalizeUrl("  exemple.fr/veille  ")).toBe("https://exemple.fr/veille");
  });

  it("conserve une URL déjà complète", () => {
    expect(normalizeUrl("http://exemple.fr/a?b=1")).toBe("http://exemple.fr/a?b=1");
  });

  it("refuse ce qui n'est pas une URL http(s)", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://exemple.fr")).toBeNull();
  });
});

describe("tags", () => {
  it("nettoie, met en minuscules et dédoublonne", () => {
    expect(normalizeTags("Veille, seo , tech,SEO")).toBe("veille,seo,tech");
    expect(normalizeTags("")).toBe("");
  });

  it("relit une liste de tags", () => {
    expect(parseTags("veille,seo")).toEqual(["veille", "seo"]);
    expect(parseTags("")).toEqual([]);
  });
});
