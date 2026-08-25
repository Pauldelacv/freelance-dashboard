import { describe, expect, it } from "vitest";
import { MATCH_NONE, matchScore, normalize, scoreItem, searchItems } from "./search";

describe("normalize", () => {
  it("retire les accents et la casse", () => {
    expect(normalize("Société Générale")).toBe("societe generale");
    expect(normalize("  Agence Nord  ")).toBe("agence nord");
    expect(normalize("Élodie")).toBe("elodie");
  });

  it("laisse les chaînes déjà normalisées intactes", () => {
    expect(normalize("studio kappa")).toBe("studio kappa");
  });
});

describe("matchScore", () => {
  it("trouve un texte accentué à partir d'une saisie sans accent", () => {
    expect(matchScore("Société Générale", "societe")).toBeGreaterThan(MATCH_NONE);
    expect(matchScore("Trésorerie", "tresorerie")).toBeGreaterThan(MATCH_NONE);
  });

  it("classe le début de libellé au-dessus du début de mot", () => {
    expect(matchScore("Kappa Studio", "kappa")).toBeGreaterThan(
      matchScore("Studio Kappa", "kappa"),
    );
  });

  it("classe le début de mot au-dessus d'une sous-chaîne interne", () => {
    expect(matchScore("Studio Kappa", "kappa")).toBeGreaterThan(matchScore("Skappale", "kappa"));
  });

  it("classe la sous-chaîne au-dessus des lettres éparses", () => {
    expect(matchScore("Skappale", "kappa")).toBeGreaterThan(
      matchScore("Kanban pour Paris", "kappa"),
    );
  });

  it("accepte les lettres dans l'ordre, même séparées", () => {
    expect(matchScore("Agence Nord", "agnord")).toBeGreaterThan(MATCH_NONE);
  });

  it("rejette ce qui ne correspond pas", () => {
    expect(matchScore("Agence Nord", "zzz")).toBe(MATCH_NONE);
    // Les lettres y sont, mais pas dans l'ordre.
    expect(matchScore("abc", "cba")).toBe(MATCH_NONE);
  });

  it("traite les séparateurs d'URL comme des débuts de mot", () => {
    expect(matchScore("https://blog.exemple.fr", "exemple")).toBeGreaterThan(
      matchScore("Skappale", "kappa"),
    );
  });

  it("ne casse pas sur les caractères spéciaux d'expression régulière", () => {
    expect(() => matchScore("Coût (HT)", "(ht)")).not.toThrow();
    expect(matchScore("Coût (HT)", "(ht)")).toBeGreaterThan(MATCH_NONE);
  });

  it("considère une requête vide comme la meilleure correspondance", () => {
    expect(matchScore("Agence Nord", "")).toBeGreaterThan(MATCH_NONE);
  });
});

describe("scoreItem", () => {
  it("privilégie le libellé sur les mots-clés", () => {
    const parLabel = { label: "Nord SAS", keywords: [] };
    const parKeyword = { label: "Studio Kappa", keywords: ["Nord SAS"] };
    expect(scoreItem(parLabel, "nord")).toBeGreaterThan(scoreItem(parKeyword, "nord"));
  });

  it("trouve un élément par son mot-clé seul", () => {
    const item = { label: "Studio Kappa", keywords: ["contact@exemple.fr"] };
    expect(scoreItem(item, "exemple")).toBeGreaterThan(MATCH_NONE);
  });

  it("supporte l'absence de mots-clés", () => {
    expect(scoreItem({ label: "Veille" }, "zzz")).toBe(MATCH_NONE);
  });
});

describe("searchItems", () => {
  const items = [
    { label: "Studio Kappa", keywords: ["design"] },
    { label: "Kappa Conseil", keywords: [] },
    { label: "Agence Nord", keywords: ["Nord SAS"] },
  ];

  it("renvoie tout pour une requête vide, dans l'ordre d'origine", () => {
    expect(searchItems(items, "  ").map((item) => item.label)).toEqual([
      "Studio Kappa",
      "Kappa Conseil",
      "Agence Nord",
    ]);
  });

  it("filtre et classe par pertinence", () => {
    expect(searchItems(items, "kappa").map((item) => item.label)).toEqual([
      "Kappa Conseil",
      "Studio Kappa",
    ]);
  });

  it("départage à égalité de score par ordre alphabétique français", () => {
    const egaux = [{ label: "Zèbre" }, { label: "Écran" }, { label: "Avion" }];
    expect(searchItems(egaux, "").map((item) => item.label)).toEqual(["Zèbre", "Écran", "Avion"]);
    // Les trois ont le même score sur une sous-chaîne commune.
    const communs = [{ label: "beta" }, { label: "alpha" }];
    expect(searchItems(communs, "a").map((item) => item.label)).toEqual(["alpha", "beta"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const source = [{ label: "b" }, { label: "a" }];
    searchItems(source, "a");
    expect(source.map((item) => item.label)).toEqual(["b", "a"]);
  });
});
