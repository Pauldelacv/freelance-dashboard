/**
 * Palette catégorielle des clients.
 *
 * Cet ordre est **validé** (séparation daltonisme, plancher de vision normale,
 * bande de luminosité) par le validateur de la charte de dataviz, en mode clair
 * comme en mode sombre. Ne pas réordonner ni ajouter une teinte sans revalider :
 * l'ordre des paires adjacentes fait partie de la garantie.
 *
 * Trois teintes claires passent sous 3:1 de contraste : partout où elles servent
 * de repère, un libellé visible les accompagne (nom du client sur la pastille du
 * calendrier, légende et tableau sous le graphique).
 */
export const CLIENT_COLORS = [
  "#2a78d6", // bleu
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // jaune
  "#e87ba4", // magenta
  "#008300", // vert
  "#4a3aa7", // violet
  "#e34948", // rouge
] as const;

/** Mêmes teintes, redéclinées pour une surface sombre (pas un simple éclaircissement). */
const DARK_STEPS: Record<string, string> = {
  "#2a78d6": "#3987e5",
  "#eb6834": "#d95926",
  "#1baf7a": "#199e70",
  "#eda100": "#c98500",
  "#e87ba4": "#d55181",
  "#008300": "#008300",
  "#4a3aa7": "#9085e9",
  "#e34948": "#e66767",
};

/** Couleur à utiliser pour un fond donné. Les couleurs inconnues sont rendues telles quelles. */
export function seriesColor(color: string, dark: boolean): string {
  if (!dark) return color;
  return DARK_STEPS[color.toLowerCase()] ?? color;
}
