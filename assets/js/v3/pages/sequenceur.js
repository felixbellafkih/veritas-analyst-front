// Page du Séquenceur : la séquence d'un passage (versets choisis, ou texte arabe collé), en chaîne de cartes.
// Lectures publiques seulement : cette page n'envoie ni clé ni mot de passe, et ne lance aucune analyse.
// « Analyser dans l'Interpréteur » y ouvre le même passage ; l'analyse se lance là-bas, par le visiteur.
// L'adresse porte le passage (?s=…&de=…&a=…), jamais un texte libre : un passage se partage, et les boutons
// « précédent » et « suivant » du navigateur retrouvent ce qui était affiché.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { openingState, planOpen, planPop } from '../lib/sequence-history.js';
import { createSequenceRun } from '../lib/sequence-run.js';
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountSequenceForm } from '../ui/sequence-form.js';
import { mountSequenceView } from '../ui/sequence-view.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
// Essai en local : la vraie API ou le faux serveur, choix gardé pour l'onglet (null en ligne)
const localApi = apiChoice(window.location, store.getApiChoice());
if (localApi) store.setApiChoice(localApi);
const api = createApi({ base: apiBase(window.location, localApi) });
await initI18n({ store });
document.title = `${t('Séquenceur')} — Veritas Analyst`;

const shell = mountShell({ page: 'sequenceur', store, onKeyClick: () => openKeyDialog({ store, api, onChange: showAccess }), localApi });
function showAccess() {
  shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
}
showAccess();

// Le formulaire gardé pour l'onglet (un changement de langue recharge la page) ; l'adresse l'emporte
const state = openingState(store.loadSequenceForm(), window.location.search);
const save = () => store.saveSequenceForm(state);

const view = mountSequenceView(document.getElementById('resultat'), {
  onRetry: (index) => run.retry(index),
  address: () => window.location.href,
});
const run = createSequenceRun({ api, onChange: (next) => view.show(next) });
const form = mountSequenceForm(document.getElementById('saisie'), { state, onChange: save, onSubmit: (request) => open(request, true) });

// Séquence ce que le formulaire désigne. Un texte vide n'envoie rien : la zone de résultat se vide.
function start() {
  if (state.mode === 'verset') run.startPassage(state);
  else if (!run.startText(state.text)) run.cancel();
}

// Met le formulaire dans cet état, le garde pour l'onglet, puis séquence
function show(next) {
  Object.assign(state, next);
  form.paint();
  save();
  start();
}

// Affiche une demande : {mode: 'verset', sura, start, end} ou {mode: 'texte', text} ; à l'ouverture, une
// demande vide. Ce qui s'écrit dans l'adresse et dans l'historique est décidé par lib/sequence-history.js.
function open(request, push) {
  const plan = planOpen({
    state,
    request,
    shown: window.history.state,
    location: `${window.location.pathname}${window.location.search}`,
    push,
  });
  if (plan.method === 'push') window.history.pushState(plan.entry, '', plan.address);
  else window.history.replaceState(plan.entry, '', plan.address);
  show(plan.state);
}

// « Précédent », « suivant » : ce que cette ligne de l'historique affichait ; à défaut, ce que dit l'adresse
window.addEventListener('popstate', (event) => {
  show(planPop({ state, shown: event.state, search: window.location.search }));
});

// À l'ouverture : le passage de l'adresse, sinon le formulaire gardé, sinon le verset 1:1. Il est séquencé aussitôt.
open({}, false);
