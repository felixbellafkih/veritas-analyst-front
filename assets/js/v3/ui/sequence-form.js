// Formulaire du Séquenceur : ce qui sera séquencé, en deux modes.
// - Verset : sourate, du verset, au verset (dix versets au plus) — les champs de l'Interpréteur.
// - Texte libre : une zone où l'on colle ou tape de l'arabe, 5 000 caractères au plus.
// Aucune clé n'est demandée : le Séquenceur ne fait que des lectures publiques.
import { SEQUENCE_TEXT_MAX } from '../lib/sequence.js';
import { el, fill } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n-dom.js';
import { mountVerseFields } from './verse-fields.js';

// state : l'état de lib/sequence-form.js ({mode, sura, start, end, text}), modifié sur place ;
// onChange() : à chaque modification, pour que la page le garde ;
// onSubmit(demande) : {mode: 'verset', sura, start, end} ou {mode: 'texte', text}.
export function mountSequenceForm(container, { state, onChange, onSubmit }) {
  // ------------------------------------------------------------------ mode Verset

  const verseFields = mountVerseFields({
    state,
    hint: (count) => t('Sourate de {n} versets · 10 versets au plus', { n: count }),
    onChange,
  });
  const versePanel = el('div', { class: 'sequence__mode' }, verseFields.nodes);

  // ------------------------------------------------------------------ mode Texte libre

  const text = el('textarea', {
    class: 'saisie sequence__texte',
    attrs: { id: 'texte-sequence', rows: 4, maxlength: SEQUENCE_TEXT_MAX, dir: 'rtl', lang: 'ar', placeholder: t('Ex: ...بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ ...') },
  });
  const counter = el('p', { class: 'champ__aide sequence__compteur', attrs: { dir: 'ltr' } });
  const paintCounter = () => {
    counter.textContent = `${state.text.length} / ${SEQUENCE_TEXT_MAX}`;
  };
  text.addEventListener('input', () => {
    state.text = text.value;
    paintCounter();
    onChange();
  });
  const textPanel = el('div', { class: 'sequence__mode' },
    el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: t('Texte à séquencer'), attrs: { for: 'texte-sequence' } }), text),
    counter);

  // ------------------------------------------------------------------ sélecteur de mode

  const panels = { verset: versePanel, texte: textPanel };
  const modeButtons = {
    verset: el('button', { class: 'segments__bouton', text: t('Verset'), attrs: { type: 'button' } }),
    texte: el('button', { class: 'segments__bouton', text: t('Texte libre'), attrs: { type: 'button' } }),
  };
  const modes = el('div', { class: 'segments', attrs: { role: 'group', 'aria-label': t('Mode de saisie') } }, Object.values(modeButtons));

  function showMode() {
    for (const [name, button] of Object.entries(modeButtons)) button.setAttribute('aria-pressed', String(name === state.mode));
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== state.mode;
  }
  for (const [name, button] of Object.entries(modeButtons)) {
    button.addEventListener('click', () => {
      state.mode = name;
      showMode();
      onChange();
    });
  }

  // ------------------------------------------------------------------ envoi

  const form = el('form', { class: 'sequence__saisie carte', attrs: { novalidate: true } },
    modes,
    versePanel,
    textPanel,
    el('button', { class: 'bouton sequence__lancer', attrs: { type: 'submit' } }, el('span', { text: t('Séquencer') }), icon('arrow')));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.mode === 'verset') {
      onSubmit({ mode: 'verset', sura: state.sura, start: state.start, end: state.end });
    } else if (state.text.trim()) {
      onSubmit({ mode: 'texte', text: state.text });
    } else {
      // Rien à séquencer : le curseur revient dans la zone de texte
      text.focus();
    }
  });

  // Les champs reprennent l'état, après un changement venu d'ailleurs (adresse, bouton « précédent »)
  function paint() {
    verseFields.paint();
    text.value = state.text;
    paintCounter();
    showMode();
  }

  fill(container, form);
  paint();
  return { paint };
}
