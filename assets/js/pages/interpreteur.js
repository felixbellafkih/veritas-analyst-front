// Page de l'Interpréteur : elle relie le formulaire du passage, l'API et l'affichage de l'analyse.
// L'état (lib/interpreter-state.js) décide de ce qui s'affiche ; cette page ne fait que le suivre.
import { createApi } from '../api.js';
import { API_PROD, apiBase } from '../lib/config.js';
import { previousExchanges } from '../lib/conversation.js';
import { initialState, reduce, snapshot } from '../lib/interpreter-state.js';
import { analysisRequest, followUpRequest } from '../lib/request.js';
import { parsePassageQuery } from '../lib/verses.js';
import { mountAnalysis } from '../ui/analysis-view.js';
import { browserStore, el } from '../ui/dom.js';
import { currentLang, initI18n, languageLabel, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountPassageForm } from '../ui/passage-form.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
const api = createApi({ base: apiBase(window.location) });
await initI18n({ store });
document.title = `${t('Interpréteur')} — Veritas Analyst`;

const article = document.getElementById('analyse');
let state = initialState();

const openKey = () => openKeyDialog({ store, api, onChange: showAccess });
const shell = mountShell({ page: 'interpreteur', store, onKeyClick: openKey });
const form = mountPassageForm(document.getElementById('passage'), { api, store, onLaunch: launch, onManageKey: openKey });
const view = mountAnalysis(article, { onRetry: retry, onManageKey: openKey, onFollowUp: followUp, onNewConversation: newConversation });

// En local seulement : dire quelle API répond, pour ne pas confondre le faux serveur et la vraie
if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  const real = apiBase(window.location) === API_PROD;
  document.querySelector('#pied .pied__dans').append(el('span', { class: 'pied__local', text: real ? 'Essai local — API réelle' : 'Essai local — faux serveur d’API' }));
}

// Accès en service : mode développeur, clé du visiteur, ou rien
function showAccess() {
  const status = store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente';
  shell.setKeyStatus(status);
  form.setAccess(status, store.keyIsRemembered());
}

// Langue de la réponse et modèle : pour l'instant, la langue de l'interface et le modèle par défaut
function requestOptions() {
  return { language: languageLabel(currentLang()), model: null, defaultModel: null };
}

function render() {
  const waiting = state.phase === 'attente';
  form.setDisabled(waiting);
  shell.setBusy(waiting);
  document.body.dataset.attente = waiting ? 'oui' : 'non';
  if (state.phase === 'vide') view.showEmpty();
  else if (waiting) view.showWaiting();
  else if (state.phase === 'resultat') {
    view.showResult({
      result: state.result,
      passage: state.resultPassage,
      input: state.history.length ? state.history[0].text : '',
      previous: previousExchanges(state.history, state.result),
    });
  }
  else view.showFailure(state.failure, { keepResult: Boolean(state.result) });
  // L'analyse et la conversation sont gardées pour l'onglet : un rechargement ne les perd pas
  if (state.phase === 'resultat') store.saveConversation(snapshot(state));
  else if (state.phase === 'vide') store.clearConversation();
}

// Applique un événement ; rend faux quand il est sans effet (par exemple un second clic pendant l'attente)
function dispatch(event) {
  const next = reduce(state, event);
  if (next === state) return false;
  state = next;
  render();
  return true;
}

async function send() {
  try {
    const result = await api.analyze(state.request, store.credentials(), { onPing: () => view.notePing() });
    dispatch({ type: 'success', result });
  } catch (failure) {
    dispatch({ type: 'failure', failure });
    // Clé absente ou refusée par le serveur : la fenêtre de la clé s'ouvre
    if (failure.kind === 'http' && failure.status === 401) openKey();
  }
}

function showAnalysis() {
  if (window.matchMedia('(max-width: 1023.98px)').matches) article.scrollIntoView({ block: 'start' });
  article.focus({ preventScroll: true });
}

function launch(passage) {
  const { key, devPassword } = store.credentials();
  if (!key && !devPassword) {
    openKey(); // sans clé, rien ne part
    return;
  }
  if (!dispatch({ type: 'launch', passage, request: analysisRequest(passage, requestOptions()) })) return;
  showAnalysis();
  send();
}

function retry() {
  if (dispatch({ type: state.requestKind, passage: state.passage, request: state.request })) send();
}

// Suite de la conversation : le message part avec les échanges gardés par la page
function followUp(message) {
  const { key, devPassword } = store.credentials();
  if (!key && !devPassword) {
    openKey();
    return;
  }
  if (!dispatch({ type: 'followup', request: followUpRequest(message, state.history, requestOptions()) })) return;
  article.scrollIntoView({ block: 'start' }); // l'état d'attente est en haut de l'analyse
  send();
}

function newConversation() {
  if (dispatch({ type: 'new-conversation' })) article.scrollIntoView({ block: 'start' });
}

// Quitter la page pendant une analyse la ferait perdre, alors qu'elle est facturée : le navigateur prévient
window.addEventListener('beforeunload', (event) => {
  if (state.phase !== 'attente') return;
  event.preventDefault();
  event.returnValue = '';
});

showAccess();
if (!dispatch({ type: 'restore', saved: store.loadConversation() })) render();

// Passage demandé par l'adresse (venue de l'accueil), sinon celui du formulaire gardé pour l'onglet.
// Dans les deux cas le formulaire est seulement placé : c'est le visiteur qui lance l'analyse.
const asked = parsePassageQuery(window.location.search);
const kept = store.loadForm();
if (asked) form.setPassage(asked);
else if (kept && kept.mode === 'verset') form.setPassage(kept);
