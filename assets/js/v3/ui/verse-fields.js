// Champs de verset : sourate, du verset, au verset (dix versets au plus). Partagés par l'Interpréteur et le
// Séquenceur : un passage se choisit de la même façon dans les deux outils.
import { MAX_VERSES, SURAS, clampRange } from '../lib/verses.js';
import { add, el } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n-dom.js';

// Champ étiqueté : l'étiquette est liée au champ par son identifiant
const field = (id, label, control) => el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control);

// state : {sura, start, end}, modifié sur place à chaque changement valable ; hint(n) : la ligne d'aide,
// pour une sourate de n versets ; onChange() : appelé après chaque changement.
// Rend {nodes, paint(), setDisabled(oui)} : nodes se place tel quel dans un formulaire.
export function mountVerseFields({ state, hint, onChange }) {
  const sura = el('select', { class: 'saisie', attrs: { id: 'sourate' } });
  for (const entry of SURAS) add(sura, el('option', { text: `${entry.n} · ${entry.name}`, attrs: { value: entry.n } }));
  const start = el('input', { class: 'saisie', attrs: { id: 'verset-debut', type: 'number', inputmode: 'numeric', min: 1 } });
  const end = el('input', { class: 'saisie', attrs: { id: 'verset-fin', type: 'number', inputmode: 'numeric', min: 1 } });
  const help = el('p', { class: 'champ__aide' });

  function paint() {
    const limit = SURAS[state.sura - 1].verses;
    sura.value = String(state.sura);
    start.value = String(state.start);
    start.max = String(limit);
    end.value = String(state.end);
    end.min = String(state.start);
    end.max = String(Math.min(limit, state.start + MAX_VERSES - 1));
    help.textContent = hint(limit);
  }

  // Le passage demandé est ramené dans la sourate, à dix versets au plus ; les champs montrent le résultat
  function change(next) {
    const range = clampRange(next.sura, next.start, next.end);
    if (!range) return;
    Object.assign(state, { sura: Number(next.sura), ...range });
    paint();
    onChange();
  }

  sura.addEventListener('change', () => change({ sura: Number(sura.value), start: 1, end: 1 }));
  start.addEventListener('change', () => change({ sura: state.sura, start: start.value, end: Math.max(Number(end.value) || 0, Number(start.value) || 0) }));
  end.addEventListener('change', () => change({ sura: state.sura, start: state.start, end: end.value }));

  paint();
  return {
    nodes: [
      field('sourate', t('Sourate'), el('div', { class: 'choix' }, sura, icon('chevron'))),
      el('div', { class: 'passage__versets' }, field('verset-debut', t('Du verset'), start), field('verset-fin', t('au verset'), end)),
      help,
    ],
    paint,
    setDisabled(value) {
      for (const control of [sura, start, end]) control.disabled = Boolean(value);
    },
  };
}
