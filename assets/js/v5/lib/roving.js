// Déplacement du curseur du clavier dans une longue liste, sans interface.
// La liste n'offre qu'un seul arrêt à la touche Tab ; les flèches, Début et Fin passent d'une ligne à l'autre.

// Une touche tenue avec Alt, Ctrl, Cmd ou Maj appartient au navigateur ou au système (Alt+← : page
// précédente) : la liste ne doit ni l'avaler ni déplacer son curseur.
export const hasModifier = (event) => Boolean(event) && Boolean(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);

// current : rang de la ligne qui a le curseur ; total : nombre de lignes.
// Rend le rang où aller, ou null quand la touche ne déplace rien (une autre touche, une liste vide).
export function nextIndex(current, key, total) {
  if (!(total > 0)) return null;
  const last = total - 1;
  const here = Math.min(Math.max(Number(current) || 0, 0), last);
  if (key === 'ArrowDown') return Math.min((current < 0 ? -1 : here) + 1, last);
  if (key === 'ArrowUp') return Math.max((current > last ? total : here) - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}
