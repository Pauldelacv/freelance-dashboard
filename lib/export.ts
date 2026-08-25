/** Export CSV : séparateur point-virgule, décimales à la française (Excel FR). */

export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "oui" : "non") : String(value);
  // Les guillemets se doublent ; on entoure dès qu'un séparateur ou un saut de
  // ligne traîne, sinon Excel casse la colonne.
  if (/[";\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCsvCell).join(";")];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(";"));
  // BOM UTF-8 : sans lui, Excel affiche « Ã© » à la place des accents.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Centimes → "1234,56" (sans symbole, pour rester exploitable en tableur). */
export function csvMoney(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function csvNumber(value: number): string {
  return String(value).replace(".", ",");
}
