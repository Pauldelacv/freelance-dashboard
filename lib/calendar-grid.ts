/**
 * Géométrie de la grille mensuelle.
 *
 * La grille est un tableau : sept colonnes (lundi → dimanche) et autant de
 * lignes que de semaines. Une sélection par glissement y est donc un
 * **rectangle**, comme dans un tableur — et non la suite des jours compris
 * entre deux dates.
 *
 * La différence n'est pas cosmétique : sur une plage linéaire, descendre d'une
 * ligne emporte la fin de la semaine, week-ends compris. Le rectangle laisse
 * au contraire cocher « du lundi au vendredi, sur trois semaines » d'un seul
 * geste — le cas courant. Pour rester sur un seul jour de la semaine, on
 * glisse dans une seule colonne.
 */

/**
 * Position d'une date dans la grille : `leading` cases vides précèdent le 1er
 * du mois, le reste suit dans l'ordre.
 */
function cellIndexes(dates: string[], leading: number): Map<string, number> {
  return new Map(dates.map((date, index) => [date, index + leading]));
}

interface Bounds {
  min: number;
  max: number;
}

function bounds(a: number, b: number): Bounds {
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Dates couvertes par le rectangle qui joint deux cases, bornes comprises.
 * Retourne une liste vide si l'une des deux dates n'est pas dans le mois.
 */
export function rectangleBetween(
  dates: string[],
  leading: number,
  from: string,
  to: string,
): string[] {
  const indexes = cellIndexes(dates, leading);
  const start = indexes.get(from);
  const end = indexes.get(to);
  if (start === undefined || end === undefined) return [];

  const rows = bounds(Math.floor(start / 7), Math.floor(end / 7));
  const columns = bounds(start % 7, end % 7);

  return dates.filter((date) => {
    const index = indexes.get(date) ?? -1;
    if (index < 0) return false;
    const row = Math.floor(index / 7);
    const column = index % 7;
    return row >= rows.min && row <= rows.max && column >= columns.min && column <= columns.max;
  });
}
