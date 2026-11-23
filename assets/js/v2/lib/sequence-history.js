// Adresse et historique du Séquenceur : ce que la page affiche à l'ouverture, ce qu'elle écrit dans l'adresse
// et dans l'historique du navigateur, ce que « précédent » et « suivant » rendent. Sans interface : la page
// (pages/sequenceur.js) applique ces décisions à l'historique du navigateur.
// - L'adresse porte le passage (?s=…&de=…&a=…), jamais un texte libre.
// - Une ligne de l'historique retient ce qui était affiché ; un texte libre y reste, hors de l'adresse.
// - Tout ce qui revient de l'adresse, de l'historique ou du stockage est vérifié avant de servir.
import { sequenceFormState } from './sequence-form.js';
import { parsePassageQuery, sequencerHref } from './verses.js';

export const SEQUENCER_HOME = '/sequenceur/';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Ce que l'historique retient d'un affichage. state : l'état du formulaire (lib/sequence-form.js).
export const historyEntry = (state) => (state.mode === 'verset'
  ? { mode: 'verset', sura: state.sura, start: state.start, end: state.end }
  : { mode: 'texte', text: state.text });

// L'adresse d'un affichage : celle du passage ; pour un texte libre, l'adresse nue de la page
export const historyAddress = (state) => (state.mode === 'verset' ? sequencerHref(state) : SEQUENCER_HOME);

// À l'ouverture : le passage de l'adresse l'emporte sur le formulaire gardé pour l'onglet ; sans rien, 1:1.
// saved : ce que store.loadSequenceForm() rend ; search : la requête de l'adresse (« ?s=2&de=255&a=255 »).
export function openingState(saved, search) {
  const state = sequenceFormState(saved);
  const asked = parsePassageQuery(search);
  return asked ? { ...state, mode: 'verset', ...asked } : state;
}

// Une demande du formulaire ({mode: 'verset', sura, start, end} ou {mode: 'texte', text}), ou l'ouverture de
// la page (demande vide). shown : la ligne en cours de l'historique (history.state) ; location : le chemin
// et la requête de l'adresse en cours ; push : le visiteur vient d'envoyer le formulaire.
// Rend {state, entry, address, method}. method vaut 'push' (une ligne de plus) quand l'affichage change
// pour de bon : un autre passage, donc une autre adresse, ou un autre texte libre, qui garde la même adresse.
// Sinon 'replace' : la ligne en cours est mise à jour, et renvoyer le même passage n'allonge pas l'historique.
export function planOpen({ state, request, shown, location, push }) {
  const next = sequenceFormState({ ...state, ...(isRecord(request) ? request : {}) });
  const address = historyAddress(next);
  const otherText = next.mode === 'texte' && !(isRecord(shown) && shown.mode === 'texte' && shown.text === next.text);
  const moved = address !== location || otherText;
  return { state: next, entry: historyEntry(next), address, method: push && moved ? 'push' : 'replace' };
}

// « Précédent », « suivant » : ce que la ligne de l'historique affichait (shown : event.state) ; à défaut, ce
// que dit l'adresse ; à défaut, le formulaire tel qu'il est. Rend l'état du formulaire à afficher.
export function planPop({ state, shown, search }) {
  const passage = parsePassageQuery(search);
  const kept = isRecord(shown) ? shown : passage ? { mode: 'verset', ...passage } : {};
  return sequenceFormState({ ...state, ...kept });
}
