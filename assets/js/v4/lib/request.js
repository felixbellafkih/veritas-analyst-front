// Corps d'une demande à POST /analyze/interpreter/stream, et en-têtes d'accès.
// Ces formes sont un contrat avec le moteur : il vérifie la référence sur le texte envoyé (api.py,
// _request_reference), et reconnaît la phrase du mode Tarteel (engine/corpus_store.py).
import { clusterText } from './tarteel.js';
import { cleanVerseText } from './verses.js';

function withOptions(body, { language, model, defaultModel } = {}) {
  const request = { ...body, language };
  // Le modèle n'est envoyé que si le visiteur en a choisi un autre que celui par défaut
  if (model && model !== defaultModel) request.model = model;
  return request;
}

// passage : {mode:'verset', sura, start, end, text} | {mode:'tarteel', primary, constraint, verses} | {mode:'libre', text}
// Rend null quand il n'y a rien à envoyer.
export function analysisRequest(passage, options) {
  if (!passage) return null;
  if (passage.mode === 'verset') {
    // Le texte rendu par l'API, sans le caractère U+FEFF, sans autre retouche
    const text = cleanVerseText(passage.text);
    if (!text.trim()) return null;
    return withOptions({ verse_text: text, sura_num: passage.sura, verse_start: passage.start, verse_end: passage.end }, options);
  }
  if (passage.mode === 'tarteel') {
    if (!passage.verses || !passage.verses.length) return null;
    return withOptions({ verse_text: clusterText(passage.primary, passage.constraint, passage.verses) }, options);
  }
  if (passage.mode === 'libre') {
    const text = String(passage.text ?? '');
    if (!text.trim()) return null;
    return withOptions({ verse_text: text }, options);
  }
  return null;
}

// Suite de conversation : le message du visiteur et la conversation gardée par le site, sans champ de sourate
export function followUpRequest(message, history, options) {
  const text = String(message ?? '');
  if (!text.trim()) return null;
  const body = { verse_text: text };
  if (history && history.length) body.history = history;
  return withOptions(body, options);
}

// Une demande ne porte jamais les deux en-têtes : l'API vérifie d'abord le mot de passe développeur,
// et le refuse même si une clé valable l'accompagne.
export function credentialHeaders({ key = '', devPassword = '' } = {}) {
  if (devPassword) return { 'X-Dev-Password': devPassword };
  if (key) return { 'X-API-Key': key };
  return {};
}
