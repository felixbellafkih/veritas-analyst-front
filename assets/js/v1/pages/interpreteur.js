// Page de l'Interpréteur : elle relie le formulaire du passage, l'API et l'affichage de l'analyse.
// Ce qui part, quand, et ce qui s'affiche se décide dans lib/interpreter-controller.js (testé sans page) ;
// ici, seulement le branchement et ce qui touche à la fenêtre du navigateur.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { corpusExcerpts } from '../lib/corpus-list.js';
import { createInterpreter } from '../lib/interpreter-controller.js';
import { parsePassageQuery } from '../lib/verses.js';
import { mountAnalysis } from '../ui/analysis-view.js';
import { openConfirm } from '../ui/dialog.js';
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { createLeaveGuard } from '../ui/leave-guard.js';
import { mountPassageForm } from '../ui/passage-form.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
// Essai en local : la vraie API ou le faux serveur, choix gardé pour l'onglet (null en ligne)
const localApi = apiChoice(window.location, store.getApiChoice());
if (localApi) store.setApiChoice(localApi);
const api = createApi({ base: apiBase(window.location, localApi) });
await initI18n({ store });
document.title = `${t('Interpréteur')} — Veritas Analyst`;

const article = document.getElementById('analyse');
const guard = createLeaveGuard();

const openKey = () => openKeyDialog({ store, api, onChange: showAccess });
const shell = mountShell({ page: 'interpreteur', store, onKeyClick: openKey, localApi });

// Adresses publiées du corpus, lues une fois sur sa liste : les références d'une analyse ne deviennent
// des liens que vers ces pages. Sans la liste, elles restent du texte.
let published = null;
function publishedPages() {
  if (!published) {
    published = fetch('/corpus/')
      .then((response) => (response.ok ? response.text() : ''))
      .then((html) => corpusExcerpts(html))
      .catch(() => null);
  }
  return published;
}

// Passage demandé par l'adresse (venue de l'accueil) : le formulaire est seulement placé dessus, c'est le
// visiteur qui lance l'analyse. Sinon le formulaire reprend ce qui était gardé pour l'onglet.
const form = mountPassageForm(document.getElementById('passage'), {
  api, store, asked: parsePassageQuery(window.location.search), onLaunch: (passage) => interpreter.launch(passage), onManageKey: openKey,
});
const view = mountAnalysis(article, {
  onRetry: () => interpreter.retry(),
  onManageKey: openKey,
  onFollowUp: (message) => interpreter.followUp(message),
  onNewConversation: () => interpreter.newConversation(),
  publishedPages,
  // Panneau « Valider / Corriger » du corpus public : mode développeur seulement
  corpus: { api, credentials: () => store.credentials(), onSaved: (result, entry) => interpreter.corpusSaved(result, entry) },
});

const interpreter = createInterpreter({
  api,
  store,
  form,
  view,
  // Pendant une demande : formulaire et langue verrouillés, et le départ de la page demande confirmation
  onWaiting(waiting) {
    form.setDisabled(waiting);
    shell.setBusy(waiting);
    guard.setActive(waiting);
    document.body.dataset.attente = waiting ? 'oui' : 'non';
  },
  openKey,
  // L'état d'attente et l'analyse sont en haut de la colonne : sur un écran étroit, la page y descend
  reveal(what) {
    if (what !== 'launch' || window.matchMedia('(max-width: 1023.98px)').matches) article.scrollIntoView({ block: 'start' });
    if (what === 'launch') article.focus({ preventScroll: true });
  },
  // L'analyse affichée a été payée : l'effacer demande une confirmation
  confirmNewConversation: () => openConfirm({
    title: t('Nouvelle conversation'),
    text: t('L’analyse affichée et sa conversation seront effacées.'),
    confirmLabel: t('Effacer'),
    cancelLabel: t('Annuler'),
  }),
});

// Accès en service : mode développeur, clé du visiteur, ou rien
function showAccess() {
  const status = store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente';
  shell.setKeyStatus(status);
  form.setAccess(status, store.keyIsRemembered());
  view.setDevMode(status === 'dev');
}

showAccess();
interpreter.restore();
