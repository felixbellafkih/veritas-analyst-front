// Configuration du site. Aucune dépendance au navigateur : Node teste ce module tel quel.

export const API_PROD = 'https://api.veritas-analyst.org';
export const CLASSIC_URL = 'https://veritas-analyst.streamlit.app';

// Noms des valeurs gardées dans le navigateur (voir lib/store.js)
export const STORAGE = Object.freeze({
  theme: 'veritas.theme',
  lang: 'veritas.lang',
  key: 'veritas.cle',
  dev: 'veritas.dev',
  conversation: 'veritas.conversation',
  model: 'veritas.modele',
  form: 'veritas.formulaire',
  api: 'veritas.api',
  handoff: 'veritas.tarteel', // sélection reportée de la page Tarteel à l'Interpréteur, pour l'onglet
  sequence: 'veritas.sequence', // formulaire du Séquenceur, pour l'onglet
});

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Quelle API répond pendant un essai en local : 'reel' (la vraie API) ou 'faux' (le faux serveur de
// _dev/serveur.mjs). Hors de localhost : null, la question ne se pose pas.
// ?api=reel ou ?api=faux dans l'adresse décide ; sinon le choix gardé pour l'onglet (remembered) tient, car
// les liens internes ne portent pas le paramètre ; sinon le faux serveur.
export function apiChoice(loc, remembered) {
  if (!loc || !LOCAL_HOSTS.has(loc.hostname)) return null;
  const asked = new URLSearchParams(loc.search || '').get('api');
  if (asked === 'reel' || asked === 'faux') return asked;
  return remembered === 'reel' ? 'reel' : 'faux';
}

// Adresse de l'API.
// En ligne : toujours l'API de production, quel que soit le paramètre de l'adresse ou ce que le navigateur
// a gardé. Un lien piégé ne doit pas pouvoir envoyer la clé du visiteur ailleurs.
// En local : le faux serveur, ou la vraie API (voir apiChoice).
export function apiBase(loc, remembered) {
  return apiChoice(loc, remembered) === 'faux' ? `${loc.origin}/__api` : API_PROD;
}
