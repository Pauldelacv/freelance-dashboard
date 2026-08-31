/**
 * Tout l'argent est stocké en **centimes** (Int). On ne formate qu'à l'affichage.
 * Aucun calcul ne doit passer par un float d'euros.
 */

const eurosFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 125000 -> "1 250,00 €" */
export function formatMoney(cents: number): string {
  return eurosFormatter.format(cents / 100);
}

/** 125000 -> "1 250 €" (tuiles KPI, axes de graphiques) */
export function formatMoneyShort(cents: number): string {
  return compactFormatter.format(Math.round(cents / 100));
}

/**
 * 0,261 -> « 26,1 % ». Le taux de cotisations est stocké en fraction : il ne
 * s'affiche jamais brut, et le même formatage sert partout où le net estimé
 * apparaît (tableau de bord, calendrier).
 */
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

/** "1 250,50" | "1250.5" | "1250,50 €" -> 125050 centimes. null si illisible. */
export function parseMoney(input: string): number | null {
  const normalized = input
    .replace(/\s| |€/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (normalized === "" || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Convertit des euros saisis en centimes, en arrondissant au centime. */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

export function toEuros(cents: number): number {
  return cents / 100;
}

/**
 * Montant d'une journée : TJM × fraction (1 ou 0,5), arrondi au centime.
 * Le TJM est déjà figé sur le WorkDay, on ne relit jamais celui du client.
 */
export function dayAmount(rateInCents: number, fraction: number): number {
  return Math.round(rateInCents * fraction);
}
