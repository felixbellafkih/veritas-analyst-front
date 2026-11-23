// État du formulaire du Séquenceur, gardé pour l'onglet : un rechargement de la page (par exemple au
// changement de langue) ne perd ni le passage ni le texte collé. Ce qui revient du stockage est vérifié
// avant de servir. Sans interface.
import { SEQUENCE_TEXT_MAX } from './sequence.js';
import { clampRange } from './verses.js';

const MODES = ['verset', 'texte'];

// saved : ce que store.loadSequenceForm() rend. Rend toujours un état complet :
// {mode: 'verset' | 'texte', sura, start, end, text}. Sans rien de gardé : le verset 1:1.
export function sequenceFormState(saved) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const range = clampRange(source.sura, source.start, source.end);
  return {
    mode: MODES.includes(source.mode) ? source.mode : 'verset',
    sura: range ? Number(source.sura) : 1,
    start: range ? range.start : 1,
    end: range ? range.end : 1,
    text: typeof source.text === 'string' ? source.text.slice(0, SEQUENCE_TEXT_MAX) : '',
  };
}
