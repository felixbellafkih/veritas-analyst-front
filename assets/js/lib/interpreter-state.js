// État de l'Interpréteur, sans interface : ce que la page affiche, la conversation en cours, la demande en vol.
// Phases : 'vide' (aucune analyse), 'attente' (une demande est partie), 'resultat', 'erreur'.
// reduce(état, événement) rend un nouvel état, ou le même objet quand l'événement est sans effet.
import { addExchange } from './conversation.js';
import { succeeded } from './engine-output.js';
import { ApiFailure } from './failures.js';

export function initialState() {
  return { phase: 'vide', history: [], result: null, resultPassage: null, passage: null, request: null, requestKind: null, failure: null };
}

function validHistory(history) {
  return Array.isArray(history) && history.length % 2 === 0 && history.every((turn, index) => turn
    && turn.role === (index % 2 === 0 ? 'user' : 'model') && typeof turn.text === 'string');
}

// Ce qui est gardé pour l'onglet, afin qu'un rechargement de la page ne perde ni l'analyse ni la conversation
export function snapshot(state) {
  return { history: state.history, result: state.result, resultPassage: state.resultPassage, passage: state.passage };
}

export function reduce(state, event) {
  switch (event.type) {
    // Analyse d'un passage : une nouvelle conversation commence. L'analyse affichée reste à l'écran
    // jusqu'à l'arrivée de la suivante. Pendant l'attente, un second lancement est sans effet : chaque
    // demande est facturée, il n'en part qu'une.
    case 'launch':
      if (state.phase === 'attente' || !event.request) return state;
      return { ...state, phase: 'attente', history: [], passage: event.passage, request: event.request, requestKind: 'launch', failure: null };

    // Suite de la conversation : la demande porte déjà l'historique (lib/request.js, followUpRequest)
    case 'followup':
      if (state.phase === 'attente' || !event.request) return state;
      return { ...state, phase: 'attente', request: event.request, requestKind: 'followup', failure: null };

    case 'success':
      if (state.phase !== 'attente') return state;
      // Une réponse sans en-tête [TARGET] est une erreur du moteur : elle n'entre pas dans la conversation
      if (!succeeded(event.result)) {
        return { ...state, phase: 'erreur', failure: new ApiFailure('engine', { detail: String(event.result ?? '') }) };
      }
      return {
        ...state,
        phase: 'resultat',
        result: event.result,
        resultPassage: state.passage,
        history: addExchange(state.history, state.request.verse_text, event.result),
        failure: null,
      };

    // En cas d'échec, l'analyse précédente reste affichée et la conversation ne bouge pas
    case 'failure':
      if (state.phase !== 'attente') return state;
      return { ...state, phase: 'erreur', failure: event.failure };

    case 'new-conversation':
      return state.phase === 'attente' ? state : initialState();

    // Au chargement de la page : ce que snapshot() avait gardé, s'il est encore cohérent
    case 'restore': {
      const saved = event.saved;
      if (state.phase !== 'vide' || !saved || !succeeded(saved.result) || !validHistory(saved.history)) return state;
      return { ...initialState(), phase: 'resultat', history: saved.history, result: saved.result, resultPassage: saved.resultPassage || null, passage: saved.passage || null };
    }

    default:
      return state;
  }
}

// Plusieurs demandes peuvent se croiser (le visiteur change de sourate pendant qu'un texte charge) :
// seule la réponse à la dernière demande compte.
export function createLatest() {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent: (token) => token === current,
  };
}
