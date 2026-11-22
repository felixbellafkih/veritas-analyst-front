// Colonne « Passage » de l'Interpréteur : le choix de ce qui sera analysé.
// Mode Verset : sourate, du verset, au verset (10 versets au plus), avec le texte arabe affiché aussitôt.
import { createLatest } from '../lib/interpreter-state.js';
import { MAX_VERSES, SURAS, clampRange, cleanVerseText, referenceLabel } from '../lib/verses.js';
import { clear, el } from './dom.js';
import { icon } from './icons.js';
import { t, td } from './i18n-dom.js';

// Champ étiqueté : l'étiquette est liée au champ par son identifiant
function field(id, label, control) {
  return el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control);
}

// onLaunch(passage) : le visiteur lance l'analyse ; onManageKey() : il ouvre la fenêtre de la clé
export function mountPassageForm(container, { api, store, onLaunch, onManageKey }) {
  const latest = createLatest();
  const cache = new Map(); // textes déjà lus pendant cette visite
  let passage = { sura: 1, start: 1, end: 1 };
  let text = '';
  let pending = null;
  let disabled = false;

  // ---- sélecteur de mode (les modes Tarteel et Texte libre arrivent avec leur tâche)
  const modes = el('div', { class: 'segments', attrs: { role: 'group', 'aria-label': t('Mode de saisie') } },
    el('button', { class: 'segments__bouton', text: t('Verset'), attrs: { type: 'button', 'aria-pressed': 'true' } }),
    el('button', { class: 'segments__bouton', text: t('Tarteel'), attrs: { type: 'button', 'aria-pressed': 'false', disabled: true } }),
    el('button', { class: 'segments__bouton', text: t('Texte libre'), attrs: { type: 'button', 'aria-pressed': 'false', disabled: true } }));

  // ---- sourate et versets
  const sura = el('select', { class: 'saisie', attrs: { id: 'sourate' } });
  for (const entry of SURAS) sura.append(el('option', { text: `${entry.n} · ${entry.name}`, attrs: { value: entry.n } }));
  const start = el('input', { class: 'saisie', attrs: { id: 'verset-debut', type: 'number', inputmode: 'numeric', min: 1 } });
  const end = el('input', { class: 'saisie', attrs: { id: 'verset-fin', type: 'number', inputmode: 'numeric', min: 1 } });
  const hint = el('p', { class: 'champ__aide' });

  // ---- texte du passage
  const reference = el('span', { class: 'verset__ref' });
  const verseBody = el('div', { class: 'verset__corps' });
  const verse = el('div', { class: 'verset', attrs: { 'aria-live': 'polite' } }, reference, verseBody);

  // ---- lancement, et état de la clé
  const launchButton = el('button', { class: 'bouton bouton--large', attrs: { type: 'submit' } }, el('span', { text: t('Analyser le passage') }), icon('arrow'));
  const accessText = el('span', { class: 'passage__cle-etat' });
  const access = el('div', { class: 'passage__cle' }, accessText,
    el('button', { class: 'bouton-lien', text: t('Gérer'), attrs: { type: 'button' }, on: { click: () => onManageKey() } }));

  const form = el('form', { class: 'passage carte', attrs: { novalidate: true } },
    modes,
    field('sourate', t('Sourate'), el('div', { class: 'choix' }, sura, icon('chevron'))),
    el('div', { class: 'passage__versets' }, field('verset-debut', t('Du verset'), start), field('verset-fin', t('au verset'), end)),
    hint,
    verse,
    launchButton,
    access);
  clear(container).append(form);

  function showText() {
    clear(verseBody).append(el('p', { class: 'verset__texte', text: cleanVerseText(text), attrs: { lang: 'ar', dir: 'rtl' } }));
  }

  function showLoading() {
    clear(verseBody).append(el('p', { class: 'verset__attente', text: t('Chargement du texte…') }));
  }

  function showFailure(failure) {
    clear(verseBody).append(
      el('p', { class: 'verset__erreur', text: failure.kind === 'http' && failure.status === 404 ? t('Passage introuvable.') : t('Texte indisponible pour l’instant.') }),
      el('button', { class: 'bouton-lien', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: load } }));
  }

  // Lit le texte du passage. Si le visiteur change de choix entre-temps, seule la dernière lecture compte.
  async function load() {
    const key = `${passage.sura}:${passage.start}-${passage.end}`;
    const token = latest.next();
    if (pending) pending.abort();
    reference.textContent = referenceLabel(passage);
    if (cache.has(key)) {
      text = cache.get(key);
      showText();
      return;
    }
    text = '';
    showLoading();
    pending = new AbortController();
    try {
      const loaded = await api.verseRange(passage.sura, passage.start, passage.end, { signal: pending.signal });
      cache.set(key, loaded);
      if (!latest.isCurrent(token)) return;
      text = loaded;
      showText();
    } catch (failure) {
      if (latest.isCurrent(token) && failure.kind !== 'aborted') showFailure(failure);
    }
  }

  function paint() {
    const limit = SURAS[passage.sura - 1].verses;
    sura.value = String(passage.sura);
    start.value = String(passage.start);
    start.max = String(limit);
    end.value = String(passage.end);
    end.min = String(passage.start);
    end.max = String(Math.min(limit, passage.start + MAX_VERSES - 1));
    hint.textContent = t('Sourate de {n} versets · 10 versets au plus par analyse', { n: limit });
  }

  function change(next) {
    const range = clampRange(next.sura, next.start, next.end);
    if (!range) return;
    passage = { sura: Number(next.sura), ...range };
    paint();
    store.saveForm({ mode: 'verset', ...passage });
    load();
  }

  sura.addEventListener('change', () => change({ sura: Number(sura.value), start: 1, end: 1 }));
  start.addEventListener('change', () => change({ sura: passage.sura, start: start.value, end: Math.max(Number(end.value) || 0, Number(start.value) || 0) }));
  end.addEventListener('change', () => change({ sura: passage.sura, start: passage.start, end: end.value }));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (disabled) return;
    // Tant que le texte n'est pas là, il n'y a rien à analyser : l'attention revient au passage
    if (!text) {
      verse.scrollIntoView({ block: 'nearest' });
      return;
    }
    onLaunch({ mode: 'verset', ...passage, text });
  });

  paint();
  load();

  return {
    // Place le formulaire sur un passage (adresse de la page, formulaire gardé pour l'onglet)
    setPassage(next) {
      if (next && clampRange(next.sura, next.start, next.end)) change(next);
    },
    // Pendant une analyse, le formulaire est verrouillé
    setDisabled(value) {
      disabled = Boolean(value);
      for (const control of form.querySelectorAll('select, input, .segments__bouton[aria-pressed], button[type="submit"]')) {
        if (control.classList.contains('segments__bouton') && control.getAttribute('aria-pressed') !== 'true') continue;
        control.disabled = disabled;
      }
    },
    currentPassage: () => ({ mode: 'verset', ...passage, text }),
    // État de la clé, sous le bouton : 'absente', 'presente' ou 'dev'
    setAccess(status, remembered) {
      const labels = {
        absente: t('Aucune clé API : elle vous sera demandée.'),
        presente: remembered ? t('Clé API gardée sur cet appareil.') : t('Clé API gardée pour cet onglet.'),
        dev: td('Mode Développeur : API Interne Connectée.'),
      };
      clear(accessText).append(icon(status === 'absente' ? 'key' : 'check', 16), el('span', { text: labels[status] || labels.absente }));
      access.dataset.etat = status;
    },
  };
}
