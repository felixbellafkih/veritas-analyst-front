// Navigation : ce qui ferait quitter la page en cours.

// link : {href, target, download} d'un lien ; current : l'adresse de la page.
// Vrai si suivre ce lien remplacerait la page : ni autre onglet, ni téléchargement, ni simple repère (#…)
// de la page affichée.
export function leavesPage(link, current) {
  if (!link || typeof link.href !== 'string' || !link.href.trim()) return false;
  if (link.target === '_blank') return false;
  if (link.download !== null && link.download !== undefined) return false;
  let from;
  let to;
  try {
    from = new URL(current);
    to = new URL(link.href, from);
  } catch {
    return false;
  }
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return false;
  return to.origin !== from.origin || to.pathname !== from.pathname || to.search !== from.search;
}
