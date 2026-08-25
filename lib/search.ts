/**
 * Appariement de la palette ⌘K.
 *
 * Deux exigences, dans cet ordre :
 *
 * 1. **Insensible aux accents et à la casse.** En français, taper « societe »
 *    doit trouver « Société » — sinon le raccourci oblige à sortir les
 *    caractères accentués et perd tout son intérêt.
 * 2. **Le classement doit être stable et explicable.** Un score qui remonte
 *    « Studio Kappa » avant « Kappa Studio » sur la requête « kappa » paraît
 *    arbitraire ; on classe donc par nature de correspondance (début de
 *    libellé > début de mot > sous-chaîne > lettres dans l'ordre), puis par
 *    ordre alphabétique à égalité.
 */

/** Minuscules sans diacritiques : « Société Générale » -> « societe generale ». */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const MATCH_NONE = 0;
const MATCH_SUBSEQUENCE = 1;
const MATCH_SUBSTRING = 2;
const MATCH_WORD_PREFIX = 3;
const MATCH_PREFIX = 4;

/** Toutes les lettres de `query` apparaissent dans `text`, dans l'ordre. */
function isSubsequence(text: string, query: string): boolean {
  let index = 0;
  for (const char of text) {
    if (char === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return query.length === 0;
}

/**
 * Score d'une chaîne face à une requête. 0 = pas de correspondance ;
 * plus le score est haut, meilleure est la correspondance.
 */
export function matchScore(text: string, query: string): number {
  const haystack = normalize(text);
  const needle = normalize(query);
  if (needle === "") return MATCH_PREFIX;
  if (haystack === "") return MATCH_NONE;

  if (haystack.startsWith(needle)) return MATCH_PREFIX;
  // Début d'un mot : « kappa » trouve « Studio Kappa ». Les séparateurs
  // couvrent les noms composés et les URL.
  if (new RegExp(`(^|[\\s\\-_/.,'’(])${escapeRegExp(needle)}`).test(haystack)) {
    return MATCH_WORD_PREFIX;
  }
  if (haystack.includes(needle)) return MATCH_SUBSTRING;
  if (isSubsequence(haystack, needle)) return MATCH_SUBSEQUENCE;
  return MATCH_NONE;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Searchable {
  label: string;
  keywords?: string[];
}

/**
 * Meilleur score entre le libellé et les mots-clés. Une correspondance sur un
 * mot-clé vaut toujours moins qu'une correspondance équivalente sur le libellé :
 * on ne veut pas qu'un client remonte devant un autre à cause de son e-mail.
 */
export function scoreItem(item: Searchable, query: string): number {
  const labelScore = matchScore(item.label, query);
  if (labelScore !== MATCH_NONE) return labelScore * 2;

  let best = MATCH_NONE;
  for (const keyword of item.keywords ?? []) {
    best = Math.max(best, matchScore(keyword, query));
  }
  return best;
}

/** Filtre et classe une liste. À égalité de score, ordre alphabétique. */
export function searchItems<T extends Searchable>(items: readonly T[], query: string): T[] {
  if (normalize(query) === "") return [...items];

  return items
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter((entry) => entry.score !== MATCH_NONE)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "fr"))
    .map((entry) => entry.item);
}
