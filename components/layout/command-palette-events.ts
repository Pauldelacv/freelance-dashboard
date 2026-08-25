/**
 * La palette s'ouvre au clavier (⌘K) mais aussi depuis deux boutons éloignés
 * dans l'arbre : la barre latérale et la barre basse du téléphone. Un événement
 * de fenêtre évite d'envelopper toute la mise en page — qui est un composant
 * serveur — dans un fournisseur de contexte client juste pour un booléen.
 */
export const COMMAND_PALETTE_EVENT = "freelance-dashboard:open-command-palette";

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}
