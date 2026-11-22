// Conduite de l'Interpréteur, sans interface : ce qui part, quand, et ce qui s'affiche.
// La page (pages/interpreteur.js) lui confie le formulaire, la vue, l'API et le stockage ; ce module décide.
// Trois règles tiennent ici, parce qu'une demande est facturée sur la clé du visiteur :
// - il ne part qu'une demande à la fois ;
// - ce qui part est ce que le visiteur a sous les yeux : « Réessayer » ne renvoie jamais une demande gardée,
//   il relance le formulaire (ou la zone de suite) tel qu'il est, avec la langue et le modèle en place ;
// - une analyse reçue est gardée avant d'être mise en forme, et s'affiche même si la mise en forme échoue.
import { previousExchanges } from './conversation.js';
import { initialState, reduce, snapshot } from './interpreter-state.js';
import { analysisRequest, followUpRequest } from './request.js';

// api : {analyze(body, credentials, {onPing})} ; store : lib/store.js ;
// form : {options(), submit()} ; view : {showEmpty, showWaiting, showResult, showPlainResult, showFailure,
// notePing, submitFollowUp} ; onWaiting(bool) : une demande est en cours, ou non ; openKey() : ouvrir la
// fenêtre de la clé ; reveal('launch' | 'followup' | 'new') : amener l'analyse à l'écran ;
// confirmNewConversation() : promesse d'un oui ou d'un non.
export function createInterpreter({ api, store, form, view, onWaiting, openKey, reveal, confirmNewConversation }) {
  let state = initialState();

  function showResult() {
    const shown = {
      result: state.result,
      passage: state.resultPassage,
      input: state.history.length ? state.history[0].text : '',
      previous: previousExchanges(state.history, state.result),
    };
    try {
      view.showResult(shown);
    } catch {
      view.showPlainResult(shown); // la mise en forme a échoué : le texte reçu s'affiche tel quel
    }
  }

  function render() {
    const waiting = state.phase === 'attente';
    onWaiting(waiting);
    if (state.phase === 'vide') view.showEmpty();
    else if (waiting) view.showWaiting();
    else if (state.phase === 'resultat') showResult();
    else view.showFailure(state.failure, { keepResult: Boolean(state.result) });
  }

  // Applique un événement ; rend faux quand il est sans effet (par exemple un second clic pendant l'attente)
  function dispatch(event) {
    const next = reduce(state, event);
    if (next === state) return false;
    state = next;
    // L'analyse et la conversation sont gardées pour l'onglet avant tout affichage : un rechargement ne les perd pas
    if (state.phase === 'resultat') store.saveConversation(snapshot(state));
    else if (state.phase === 'vide') store.clearConversation();
    render();
    return true;
  }

  async function send() {
    let result;
    try {
      result = await api.analyze(state.request, store.credentials(), { onPing: () => view.notePing() });
    } catch (failure) {
      dispatch({ type: 'failure', failure });
      // Clé absente ou refusée par le serveur : la fenêtre de la clé s'ouvre
      if (failure && failure.kind === 'http' && failure.status === 401) openKey();
      return;
    }
    dispatch({ type: 'success', result });
  }

  function hasAccess() {
    const { key, devPassword } = store.credentials();
    return Boolean(key || devPassword);
  }

  // Vrai si la demande est partie
  function start(event, shown) {
    if (!event.request) return false; // rien à envoyer
    if (!hasAccess()) {
      openKey(); // sans clé, rien ne part
      return false;
    }
    if (!dispatch(event)) return false;
    reveal(shown);
    send();
    return true;
  }

  return {
    // Au chargement de la page : l'analyse et la conversation gardées pour l'onglet, ou l'état vide
    restore() {
      if (!dispatch({ type: 'restore', saved: store.loadConversation() })) render();
    },

    // Le visiteur lance l'analyse du passage que montre le formulaire
    launch(passage) {
      if (state.phase === 'attente') return false;
      return start({ type: 'launch', passage, request: analysisRequest(passage, form.options()) }, 'launch');
    },

    // Suite de la conversation affichée : le message part avec les échanges gardés par la page
    followUp(message) {
      if (state.phase === 'attente' || !state.result) return false;
      return start({ type: 'followup', request: followUpRequest(message, state.history, form.options()) }, 'followup');
    },

    // « Réessayer » : la demande en échec repart de ce que le visiteur a sous les yeux
    retry() {
      if (state.phase !== 'erreur') return;
      if (state.requestKind === 'followup') view.submitFollowUp();
      else form.submit();
    },

    // Efface l'analyse affichée et sa conversation, après confirmation : elles ont été payées
    async newConversation() {
      if (state.phase === 'attente' || state.phase === 'vide') return false;
      if (!(await confirmNewConversation())) return false;
      if (!dispatch({ type: 'new-conversation' })) return false;
      reveal('new');
      return true;
    },

    waiting: () => state.phase === 'attente',
  };
}
