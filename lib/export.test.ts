import { describe, expect, it } from "vitest";
import { csvMoney, csvNumber, escapeCsvCell, toCsv } from "@/lib/export";

describe("échappement CSV", () => {
  it("laisse passer une valeur simple", () => {
    expect(escapeCsvCell("Agence Nord")).toBe("Agence Nord");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("traduit les booléens", () => {
    expect(escapeCsvCell(true)).toBe("oui");
    expect(escapeCsvCell(false)).toBe("non");
  });

  it("vide les valeurs absentes", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("protège les séparateurs, guillemets et sauts de ligne", () => {
    expect(escapeCsvCell("Dupont; Martin")).toBe('"Dupont; Martin"');
    expect(escapeCsvCell('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(escapeCsvCell("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
  });
});

describe("document CSV", () => {
  it("commence par un BOM et sépare par des points-virgules", () => {
    const csv = toCsv(["nom", "tjm"], [["Agence Nord", "550,00"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("nom;tjm");
    expect(csv).toContain("Agence Nord;550,00");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("nombres à la française", () => {
  it("formate les montants en centimes", () => {
    expect(csvMoney(55000)).toBe("550,00");
    expect(csvMoney(0)).toBe("0,00");
    expect(csvMoney(123)).toBe("1,23");
  });

  it("formate les fractions de journée", () => {
    expect(csvNumber(0.5)).toBe("0,5");
    expect(csvNumber(1)).toBe("1");
  });
});
