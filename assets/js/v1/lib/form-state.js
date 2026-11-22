// État du formulaire « Passage », gardé pour l'onglet : un rechargement de la page (par exemple au
// changement de langue) ne perd pas la saisie. Ce qui revient du stockage est vérifié avant de servir.
import { clampRange } from './verses.js';

export const FREE_TEXT_MAX = 10000; // caractères du mode Texte libre, comme l'app actuelle
export const ROOT_MAX = 100;        // caractères d'une racine du mode Tarteel

const MODES = ['verset', 'tarteel', 'libre'];
const LANG_SHAPE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

// saved : ce que store.loadForm() rend. Rend toujours un état complet :
// {mode, sura, start, end, primary, constraint, text, language} — language est le code choisi par le
// visiteur pour la réponse, ou null tant qu'elle suit la langue de l'interface.
export function formState(saved) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const range = clampRange(source.sura, source.start, source.end);
  return {
    mode: MODES.includes(source.mode) ? source.mode : 'verset',
    sura: range ? Number(source.sura) : 1,
    start: range ? range.start : 1,
    end: range ? range.end : 1,
    primary: text(source.primary, ROOT_MAX),
    constraint: text(source.constraint, ROOT_MAX),
    text: text(source.text, FREE_TEXT_MAX),
    language: typeof source.language === 'string' && LANG_SHAPE.test(source.language) ? source.language : null,
  };
}
