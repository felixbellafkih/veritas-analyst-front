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

// Une entrée rendue par le serveur : son identifiant et ses champs modifiables, tous en texte
export function validEntry(entry) {
  return Boolean(entry) && typeof entry === 'object' && typeof entry.id === 'string' && entry.id !== ''
    && ['reference', 'status', 'final_output', 'note'].every((name) => typeof entry[name] === 'string');
}
