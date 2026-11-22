// Panneau « Valider / Corriger » du corpus public, sans interface : le corps des trois demandes.
// Mode développeur seulement. Les routes et leurs champs sont ceux du panneau de l'app mobile
// (api.py, section 8) : POST /corpus/draft, POST /corpus/entries, PUT /corpus/entries/{id}.
import { referenceLabel } from './verses.js';

// Brouillon : le texte à relire et la référence proposée, demandés au serveur.
// input : la dernière saisie envoyée au moteur ; first : l'analyse affichée est la première de sa
// conversation. La référence n'est fournie par le site que pour la première analyse d'un passage du mode
// Verset ; sinon le serveur la déduit (phrase du mode Tarteel, ou tête de la réponse).
export function draftRequest({ input, result, passage, first }) {
  const body = { verse_input: String(input ?? ''), result: String(result ?? '') };
  if (first && passage && passage.mode === 'verset') {
    body.reference = referenceLabel(passage);
    body.kind = passage.end > passage.start ? 'range' : 'verse';
  }
  return body;
}

// Premier enregistrement. action : 'validate' (tel quel) ou 'correct'. Le texte final part tel que
// l'auteur le laisse : c'est le serveur qui décide s'il diffère de la réponse du moteur.
export function saveRequest({ action, input, result, kind, language, reference, finalText, note }) {
  return {
    action,
    verse_input: String(input ?? ''),
    result: String(result ?? ''),
    reference: String(reference ?? '').trim(),
    kind: kind || 'free',
    language: language || 'Français',
    final_text: String(finalText ?? ''),
    note: String(note ?? '').trim(),
  };
}

// Mise à jour de l'entrée déjà enregistrée. expected : l'entrée telle que le serveur l'a rendue ; si elle
// a changé ailleurs depuis (Google Sheet, autre écran), le serveur n'écrit rien.
export function updateRequest(saved, { reference, finalText, note }) {
  return {
    id: saved.id,
    body: { reference: String(reference ?? '').trim(), final_text: String(finalText ?? ''), note: String(note ?? '').trim(), expected: saved },
  };
}

// Le corpus est tenu dans un tableur : une cellule n'accepte pas plus de 50 000 caractères, et le serveur
// refuse l'entrée dont un texte les dépasse (engine/corpus_store.py, CELL_LIMIT). La saisie d'un grand
// cluster peut les atteindre.
export const CORPUS_CELL_LIMIT = 50000;
export const tooLongForCorpus = (text) => String(text ?? '').length > CORPUS_CELL_LIMIT;

// Après un échec, l'enregistrement a-t-il pu se faire quand même ? Oui, sauf refus net du serveur (400 à 499)
// ou demande jamais partie : une coupure, une erreur du serveur ou du relais, une réponse illisible laissent
// le doute. Un second « Valider » créerait alors une seconde entrée.
export function maybeSaved(failure) {
  if (!failure) return true;
  if (failure.kind === 'credential') return false;
  if (failure.kind !== 'http') return true;
  // Le serveur rend 500 pour tous ses refus d'écriture ; celui d'un texte trop long est certain : rien n'est écrit
  if (failure.status === 500 && String(failure.detail ?? '').startsWith('Texte trop long')) return false;
  return !(failure.status >= 400 && failure.status < 500);
}

// Ce que l'auteur doit savoir avant de valider : verses, le nombre de versets analysés d'un cluster (sinon
// null) ; followUp, l'analyse est une réponse de conversation ; tooLong, la saisie dépasse la limite du corpus.
export function entryContext({ passage, first, input }) {
  return {
    verses: passage && passage.mode === 'tarteel' && Array.isArray(passage.verses) ? passage.verses.length : null,
    followUp: !first,
    tooLong: tooLongForCorpus(input),
  };
}

// Une entrée rendue par le serveur : son identifiant et ses champs modifiables, tous en texte
export function validEntry(entry) {
  return Boolean(entry) && typeof entry === 'object' && typeof entry.id === 'string' && entry.id !== ''
    && ['reference', 'status', 'final_output', 'note'].every((name) => typeof entry[name] === 'string');
}
