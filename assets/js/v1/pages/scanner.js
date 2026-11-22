// Page du Scanner : une racine, ou un mot complexe que l'API ramène à sa racine, puis sa fiche.
// Lectures publiques seulement : cette page n'envoie ni clé ni mot de passe.
// L'adresse porte la saisie (?q=…) : une fiche se partage, et « précédent » revient à la fiche d'avant.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { createLatest } from '../lib/interpreter-state.js';
import { parseRootsIndex, scannerHref, scannerQuery } from '../lib/roots-index.js';
import { rootSheet } from '../lib/root-sheet.js';
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountRootList } from '../ui/root-list.js';
import { mountRootSearch } from '../ui/root-search.js';
import { mountRootSheet } from '../ui/root-sheet-view.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
// Essai en local : la vraie API ou le faux serveur, choix gardé pour l'onglet (null en ligne)
const localApi = apiChoice(window.location, store.getApiChoice());
if (localApi) store.setApiChoice(localApi);
const api = createApi({ base: apiBase(window.location, localApi) });
await initI18n({ store });
document.title = `${t('Scanner')} — Veritas Analyst`;

const shell = mountShell({ page: 'scanner', store, onKeyClick: () => openKeyDialog({ store, api, onChange: showAccess }), localApi });
function showAccess() {
  shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
}
showAccess();

const latest = createLatest();
let pending = null;

const sheet = mountRootSheet(document.getElementById('fiche'), { onOpen: (query) => open(query) });
const search = mountRootSearch(document.getElementById('recherche'), { onPick: (query) => open(query) });
const roots = mountRootList(document.getElementById('racines'), { onOpen: (query) => open(query) });

// Affiche la fiche de cette saisie, sans toucher à l'adresse. Seule la réponse à la dernière saisie compte.
async function show(query) {
  const token = latest.next();
  if (pending) pending.abort();
  search.setValue(query);
  roots.setHidden(Boolean(query));
  if (!query) {
    sheet.showEmpty();
    return;
  }
  sheet.showWaiting();
  pending = new AbortController();
  try {
    const found = rootSheet(await api.scan(query, { signal: pending.signal }));
    if (!latest.isCurrent(token)) return;
    if (found) sheet.showSheet(found);
    else sheet.showUnknown(query);
  } catch (failure) {
    if (!latest.isCurrent(token) || (failure && failure.kind === 'aborted')) return;
    // 404 : la saisie ne correspond à aucune racine connue du serveur
    if (failure && failure.kind === 'http' && failure.status === 404) sheet.showUnknown(query);
    else sheet.showFailure(failure, () => show(query));
  }
}

// Le visiteur ouvre une fiche : l'adresse suit, pour le partage et pour « précédent »
function open(query) {
  const wanted = scannerQuery(`?q=${encodeURIComponent(query)}`);
  if (wanted !== scannerQuery(window.location.search)) {
    window.history.pushState(null, '', wanted ? scannerHref(wanted) : '/scanner/');
  }
  show(wanted);
  if (wanted) document.getElementById('fiche').scrollIntoView({ block: 'nearest' });
}

window.addEventListener('popstate', () => show(scannerQuery(window.location.search)));

// La liste des racines, livrée par le site et refaite par la publication du corpus. Sans elle, la recherche
// marche quand même : sans suggestions, ni liste à parcourir.
fetch('/assets/data/racines.json', { cache: 'no-cache' })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    const index = parseRootsIndex(data);
    search.setIndex(index);
    roots.setIndex(index);
  })
  .catch(() => {});

show(scannerQuery(window.location.search));
