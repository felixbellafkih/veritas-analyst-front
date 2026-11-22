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
});

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Adresse de l'API.
// En ligne : toujours l'API de production, quel que soit le paramètre de l'adresse. Un lien piégé ne doit
// pas pouvoir envoyer la clé du visiteur ailleurs.
// En local : le faux serveur (_dev/serveur.mjs), ou la vraie API avec ?api=reel.
export function apiBase(loc) {
  if (!loc || !LOCAL_HOSTS.has(loc.hostname)) return API_PROD;
  if (new URLSearchParams(loc.search || '').get('api') === 'reel') return API_PROD;
  return `${loc.origin}/__api`;
}
