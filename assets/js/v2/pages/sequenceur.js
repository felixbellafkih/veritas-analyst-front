// Page du Séquenceur : la séquence d'un passage (versets choisis, ou texte arabe collé), en chaîne de cartes.
// Lectures publiques seulement : cette page n'envoie ni clé ni mot de passe, et ne lance aucune analyse.
// « Analyser dans l'Interpréteur » y ouvre le même passage ; l'analyse se lance là-bas, par le visiteur.
// L'adresse porte le passage (?s=…&de=…&a=…), jamais un texte libre : un passage se partage, et les boutons
// « précédent » et « suivant » du navigateur retrouvent ce qui était affiché.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { sequenceFormState } from '../lib/sequence-form.js';
import { createSequenceRun } from '../lib/sequence-run.js';
import { parsePassageQuery, sequencerHref } from '../lib/verses.js';
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountSequenceForm } from '../ui/sequence-form.js';
import { mountSequenceView } from '../ui/sequence-view.js';
import { mountShell } from '../ui/shell.js';

const HOME = '/sequenceur/';

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
const state = sequenceFormState(store.loadSequenceForm());
const asked = parsePassageQuery(window.location.search);
if (asked) Object.assign(state, { mode: 'verset', ...asked });
const save = () => store.saveSequenceForm(state);

const view = mountSequenceView(document.getElementById('resultat'), {
  onRetry: (index) => run.retry(index),
  address: () => window.location.href,
});
const run = createSequenceRun({ api, onChange: (next) => view.show(next) });
const form = mountSequenceForm(document.getElementById('saisie'), { state, onChange: save, onSubmit: (request) => open(request, true) });

// Ce que l'historique du navigateur retient d'un affichage. Un texte libre y reste, hors de l'adresse.
const entryOf = () => (state.mode === 'verset'
  ? { mode: 'verset', sura: state.sura, start: state.start, end: state.end }
  : { mode: 'texte', text: state.text });
const addressOf = () => (state.mode === 'verset' ? sequencerHref(state) : HOME);

// Séquence ce que le formulaire désigne. Un texte vide n'envoie rien : la zone de résultat se vide.
function start() {
  if (state.mode === 'verset') run.startPassage(state);
  else if (!run.startText(state.text)) run.cancel();
}

// Affiche une demande : {mode: 'verset', sura, start, end} ou {mode: 'texte', text}. push : une ligne de plus
// dans l'historique, quand l'adresse change ; sinon la ligne en cours est mise à jour.
function open(request, push) {
  Object.assign(state, sequenceFormState({ ...state, ...request }));
  form.paint();
  save();
  const target = addressOf();
  const shown = window.history.state;
  // Un autre texte libre garde la même adresse : il a pourtant sa ligne dans l'historique
  const otherText = state.mode === 'texte' && !(shown && shown.mode === 'texte' && shown.text === state.text);
  const moved = target !== `${window.location.pathname}${window.location.search}` || otherText;
  if (push && moved) window.history.pushState(entryOf(), '', target);
  else window.history.replaceState(entryOf(), '', target);
  start();
}

// « Précédent », « suivant » : ce que cette ligne de l'historique affichait ; à défaut, ce que dit l'adresse
window.addEventListener('popstate', (event) => {
  const passage = parsePassageQuery(window.location.search);
  const kept = event.state && typeof event.state === 'object' ? event.state : passage ? { mode: 'verset', ...passage } : {};
  Object.assign(state, sequenceFormState({ ...state, ...kept }));
  form.paint();
  save();
  start();
});

// À l'ouverture : le passage de l'adresse, sinon le formulaire gardé, sinon le verset 1:1. Il est séquencé aussitôt.
open({}, false);
