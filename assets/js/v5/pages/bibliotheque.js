// Page de la Bibliothèque : le manifeste, la thèse, la carte de gouvernance. Page de lecture seule.
// - Elle ne contacte pas l'API : elle ne lit que des fichiers du site (le contenu de la langue affichée, la
//   liste des racines). Elle n'envoie ni clé ni mot de passe, et n'en demande pas : le bouton de la clé n'y est pas.
// - L'adresse dit ce qui est ouvert (?doc=these&ch=phase-1, ?doc=gouvernance&v=2) : elle se partage, et les
//   boutons « précédent » et « suivant » du navigateur retrouvent ce qui était affiché. Un changement de
//   langue recharge la page à la même adresse.
import { libraryHref, parseLibraryContent, parseLibraryQuery } from '../lib/library.js';
import { EXECUTION_FLOW } from '../lib/library-diagrams.js';
import { parseRootsIndex } from '../lib/roots-index.js';
import { mountFlow } from '../ui/diagrams.js';
import { browserStore } from '../ui/dom.js';
import { currentLang, initI18n, t } from '../ui/i18n-dom.js';
import { mountLibraryView } from '../ui/library-view.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
await initI18n({ store });
document.title = `${t('Bibliothèque')} — Veritas Analyst`;
mountShell({ page: 'bibliotheque', store });

// Le schéma du manifeste, et le nombre de racines : celui de la liste que le site livre déjà au Scanner.
// Sans cette liste, la ligne reste sans nombre.
mountFlow(document.getElementById('schema-execution'), EXECUTION_FLOW);
fetch('/assets/data/racines.json', { cache: 'no-cache' })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    const count = parseRootsIndex(data).length;
    if (count) document.getElementById('nombre-racines').textContent = String(count);
  })
  .catch(() => {});

// Le contenu d'une langue (thèse et volets de gouvernance), refait chaque nuit par la publication du corpus :
// le navigateur vérifie donc à chaque visite qu'il a le dernier. code : un code de langue du site, déjà
// vérifié. Rend null quand le fichier manque ou ne se lit pas.
async function load(code) {
  const response = await fetch(`/assets/bibliotheque/${code}.json`, { cache: 'no-cache' });
  if (!response.ok) return null;
  const data = await response.json();
  return data && typeof data === 'object' && !Array.isArray(data) ? parseLibraryContent(data) : null;
}

const here = () => `${window.location.pathname}${window.location.search}`;

const view = mountLibraryView(document.getElementById('bibliotheque'), {
  manifesto: document.getElementById('manifeste'),
  lang: currentLang(),
  load,
  // Le visiteur a changé d'onglet, de chapitre ou de volet : une ligne de plus dans l'historique
  onNavigate(target) {
    const address = libraryHref(target);
    if (address !== here()) window.history.pushState(null, '', address);
  },
});

// « Précédent », « suivant » : ce que l'adresse désigne
window.addEventListener('popstate', () => view.show(parseLibraryQuery(window.location.search)));

// À l'ouverture : ce que l'adresse désigne ; une adresse inconnue ouvre le manifeste
view.show(parseLibraryQuery(window.location.search));
